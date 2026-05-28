"""
grid.py
Multi-location grid overview — returns latest risk snapshot for every
monitored Texas zone so the frontend map can render live zone colors.
"""
from fastapi import APIRouter
import logging
from datetime import datetime, timezone, timedelta
from services.supabase_client import get_supabase

log    = logging.getLogger(__name__)
router = APIRouter(prefix="/api/grid", tags=["Grid"])

# All locations the platform monitors
GRID_LOCATIONS = [
    "Houston", "Dallas", "Austin", "San Antonio",
    "Midland", "Odessa", "Corpus Christi", "Lubbock",
]

# ERCOT load-zone each city belongs to
LOCATION_ZONE = {
    "Houston":        "LZ_HOUSTON",
    "Dallas":         "LZ_NORTH",
    "Austin":         "LZ_SOUTH",
    "San Antonio":    "LZ_SOUTH",
    "Midland":        "LZ_WEST",
    "Odessa":         "LZ_WEST",
    "Corpus Christi": "LZ_SOUTH",
    "Lubbock":        "LZ_WEST",
}

RISK_ORDER = {"high": 2, "medium": 1, "low": 0, "unknown": -1}


@router.get("/overview")
async def grid_overview():
    """
    Return the latest signal_snapshot per location.
    Falls back to a placeholder entry when no data exists.
    Clients should call this every 5 min (same cadence as dashboard).
    """
    sb       = get_supabase()
    zones    = []
    staleness_cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()

    for loc in GRID_LOCATIONS:
        entry = {
            "location":      loc,
            "ercot_zone":    LOCATION_ZONE.get(loc, "LZ_HOUSTON"),
            "risk_score":    "unknown",
            "risk_direction": "stable",
            "confidence":    None,
            "ercot_price":   None,
            "primary_driver": None,
            "computed_at":   None,
            "is_stale":      True,
        }
        try:
            r = (
                sb.table("signal_snapshots")
                  .select("*")
                  .eq("location", loc)
                  .gte("computed_at", staleness_cutoff)
                  .order("computed_at", desc=True)
                  .limit(1)
                  .execute()
            )
            if r.data:
                snap = r.data[0]
                entry.update({
                    "risk_score":    snap.get("risk_score", "unknown"),
                    "risk_direction": snap.get("risk_direction", "stable"),
                    "confidence":    snap.get("confidence"),
                    "ercot_price":   snap.get("ercot_price"),
                    "primary_driver": snap.get("primary_driver"),
                    "computed_at":   snap.get("computed_at"),
                    "is_stale":      False,
                })
        except Exception as exc:
            log.warning("[GRID] snapshot query failed for %s: %s", loc, exc)

        zones.append(entry)

    # Aggregate statewide summary
    known = [z for z in zones if z["risk_score"] != "unknown"]
    if known:
        worst = max(known, key=lambda z: RISK_ORDER.get(z["risk_score"], -1))
        high_count = sum(1 for z in known if z["risk_score"] == "high")
        med_count  = sum(1 for z in known if z["risk_score"] == "medium")
    else:
        worst      = None
        high_count = 0
        med_count  = 0

    return {
        "zones": zones,
        "summary": {
            "total_locations":  len(GRID_LOCATIONS),
            "reporting_count":  len(known),
            "high_risk_count":  high_count,
            "medium_risk_count": med_count,
            "statewide_status": (
                "high"    if high_count >= 2 else
                "medium"  if high_count >= 1 or med_count >= 2 else
                "low"
            ),
            "worst_location":   worst["location"] if worst else None,
            "computed_at":      datetime.now(timezone.utc).isoformat(),
        },
    }
