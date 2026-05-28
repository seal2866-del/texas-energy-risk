"""
history_analytics.py
Phase 8 — Historical pattern detection, anomaly scoring, and spike precursor analysis.
Operates on the signal_snapshots table (30-day rolling window).

All outputs are informational only — not financial, trading, or procurement advice.
"""
import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)

_RISK_NUMERIC = {"low": 2.0, "medium": 5.0, "high": 8.5}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fetch_snapshots(location: str, days: int = 30) -> List[Dict[str, Any]]:
    """Return snapshots for a location sorted ascending by time."""
    sb      = get_supabase()
    cutoff  = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    try:
        r = (
            sb.table("signal_snapshots")
              .select("*")
              .eq("location", location)
              .gte("computed_at", cutoff)
              .order("computed_at")
              .execute()
        )
        return r.data or []
    except Exception as exc:
        logger.error("[HISTORY] fetch_snapshots failed: %s", exc)
        return []


def _mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _std(values: List[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = _mean(values)
    return math.sqrt(sum((v - m) ** 2 for v in values) / len(values))


# ── Public analytics functions ────────────────────────────────────────────────

def get_historical_summary(location: str, days: int = 30) -> Dict[str, Any]:
    """
    30-day statistics: distribution of risk levels, avg confidence,
    peak price, most common primary driver.
    """
    snaps = _fetch_snapshots(location, days)
    if not snaps:
        return {"location": location, "days": days, "data_available": False,
                "snapshot_count": 0}

    risk_counts: Dict[str, int] = {"low": 0, "medium": 0, "high": 0}
    prices:      List[float]    = []
    confidences: List[float]    = []
    drivers:     Dict[str, int] = {}
    numeric:     List[float]    = []

    for s in snaps:
        rs = s.get("risk_score", "low")
        risk_counts[rs] = risk_counts.get(rs, 0) + 1
        numeric.append(_RISK_NUMERIC.get(rs, 2.0))

        p = s.get("ercot_price")
        if p and p > 0:
            prices.append(p)

        c = s.get("confidence")
        if c:
            confidences.append(c)

        d = s.get("primary_driver")
        if d:
            drivers[d] = drivers.get(d, 0) + 1

    total = len(snaps)
    top_driver = max(drivers, key=drivers.get) if drivers else None

    return {
        "location":        location,
        "days":            days,
        "data_available":  True,
        "snapshot_count":  total,
        "risk_distribution": {
            k: {"count": v, "pct": round(v / total * 100, 1)}
            for k, v in risk_counts.items()
        },
        "avg_risk_numeric":   round(_mean(numeric), 2),
        "avg_confidence":     round(_mean(confidences), 1) if confidences else None,
        "peak_price_mwh":     round(max(prices), 2) if prices else None,
        "avg_price_mwh":      round(_mean(prices), 2) if prices else None,
        "top_primary_driver": top_driver,
        "driver_counts":      dict(sorted(drivers.items(), key=lambda x: -x[1])[:5]),
        "first_snapshot":     snaps[0].get("computed_at"),
        "last_snapshot":      snaps[-1].get("computed_at"),
    }


def get_anomaly_score(location: str, current_risk_numeric: float) -> Dict[str, Any]:
    """
    Z-score of current_risk_numeric vs 30-day baseline.
    |z| > 2.0 = statistically anomalous.
    """
    snaps  = _fetch_snapshots(location, 30)
    values = [_RISK_NUMERIC.get(s.get("risk_score", "low"), 2.0) for s in snaps]

    if len(values) < 10:
        return {
            "location":          location,
            "anomaly_score":     None,
            "is_anomalous":      False,
            "baseline_avg":      None,
            "baseline_std":      None,
            "direction":         "unknown",
            "note":              f"Insufficient history ({len(values)} snapshots — need 10+)",
        }

    avg  = _mean(values)
    std  = _std(values)
    z    = (current_risk_numeric - avg) / (std if std > 0.1 else 0.1)

    direction = (
        "significantly_elevated" if z > 2 else
        "slightly_elevated"      if z > 1 else
        "below_normal"           if z < -1 else
        "normal"
    )

    return {
        "location":        location,
        "anomaly_score":   round(z, 2),
        "is_anomalous":    abs(z) >= 2.0,
        "baseline_avg":    round(avg, 2),
        "baseline_std":    round(std, 2),
        "direction":       direction,
        "sample_size":     len(values),
        "note": (
            f"Current risk is {abs(z):.1f} standard deviations {'above' if z > 0 else 'below'} "
            f"the {len(values)}-reading baseline."
        ),
    }


def get_spike_precursors(location: str) -> Dict[str, Any]:
    """
    Identify the conditions that preceded every high-risk event in the past 30 days.
    A 'spike event' = snapshot with risk_score 'high' following non-high.
    For each spike, examine the 3 preceding snapshots (~6h window).
    Returns averaged precursor fingerprint.
    """
    snaps = _fetch_snapshots(location, 30)
    if len(snaps) < 4:
        return {"location": location, "spike_count": 0,
                "data_available": False, "precursor_pattern": None}

    spike_events: List[Dict[str, Any]] = []

    for i in range(1, len(snaps)):
        prev = snaps[i - 1].get("risk_score", "low")
        curr = snaps[i].get("risk_score", "low")
        if curr == "high" and prev != "high":
            # Found a rising-edge spike — grab preceding window
            window = snaps[max(0, i - 3): i]
            spike_events.append({
                "spike_at":   snaps[i].get("computed_at"),
                "precursors": window,
            })

    if not spike_events:
        return {
            "location":        location,
            "spike_count":     0,
            "data_available":  True,
            "precursor_pattern": None,
            "note":            "No high-risk escalation events in the analysis window.",
        }

    # Aggregate precursor metrics
    pre_risks:      List[str]   = []
    pre_demands:    List[str]   = []
    pre_prices:     List[float] = []
    pre_numerics:   List[float] = []
    pre_drivers:    Dict[str, int] = {}
    pre_directions: Dict[str, int] = {}

    for ev in spike_events:
        for snap in ev["precursors"]:
            pre_risks.append(snap.get("risk_score", "low"))
            pre_numerics.append(_RISK_NUMERIC.get(snap.get("risk_score", "low"), 2.0))
            d = snap.get("demand_level")
            if d:
                pre_demands.append(d)
            p = snap.get("ercot_price")
            if p and p > 0:
                pre_prices.append(p)
            dr = snap.get("primary_driver")
            if dr:
                pre_drivers[dr] = pre_drivers.get(dr, 0) + 1
            rd = snap.get("risk_direction")
            if rd:
                pre_directions[rd] = pre_directions.get(rd, 0) + 1

    top_driver    = max(pre_drivers, key=pre_drivers.get) if pre_drivers else None
    top_direction = max(pre_directions, key=pre_directions.get) if pre_directions else None
    demand_dist   = {d: pre_demands.count(d) for d in set(pre_demands)}

    return {
        "location":       location,
        "spike_count":    len(spike_events),
        "data_available": True,
        "spike_timestamps": [ev["spike_at"] for ev in spike_events],
        "precursor_pattern": {
            "avg_pre_spike_risk_numeric": round(_mean(pre_numerics), 2),
            "avg_pre_spike_price_mwh":    round(_mean(pre_prices), 2) if pre_prices else None,
            "most_common_demand_level":   max(demand_dist, key=demand_dist.get) if demand_dist else None,
            "top_preceding_driver":       top_driver,
            "top_risk_direction":         top_direction,
            "driver_frequency":           dict(sorted(pre_drivers.items(), key=lambda x: -x[1])[:5]),
        },
        "note": (
            f"{len(spike_events)} high-risk escalation events found. "
            f"Typical precursor: risk trending '{top_direction or 'rising'}' "
            f"driven by '{top_driver or 'multiple factors'}'."
        ),
    }


def get_full_analytics(location: str, current_risk_numeric: float = 2.0) -> Dict[str, Any]:
    """Single call combining all three analytics functions."""
    return {
        "location":   location,
        "summary":    get_historical_summary(location),
        "anomaly":    get_anomaly_score(location, current_risk_numeric),
        "precursors": get_spike_precursors(location),
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }
