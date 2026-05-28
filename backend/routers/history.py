"""
history.py
Historical analytics router — Phase 8.
Exposes pattern detection, anomaly scoring, and spike precursor analysis
built on the 30-day signal_snapshots rolling window.

All outputs are informational only — not financial, trading, or procurement advice.
"""
from fastapi import APIRouter, Query
import logging

from services.history_analytics import get_full_analytics

log    = logging.getLogger(__name__)
router = APIRouter(prefix="/api/history", tags=["History"])


@router.get("/analytics")
async def historical_analytics(
    location:     str   = Query(default="Houston", description="City name to analyse"),
    risk_numeric: float = Query(default=2.0, ge=0, le=10, description="Current risk numeric (0-10) for anomaly z-score"),
):
    """
    Returns combined historical analytics for a location:
    - 30-day risk distribution summary
    - Anomaly z-score vs baseline
    - Spike precursor fingerprint

    Useful for: trend overlays, anomaly banners, trader pattern views.
    """
    try:
        data = get_full_analytics(location, risk_numeric)
        return data
    except Exception as exc:
        log.error("[HISTORY] analytics endpoint failed for %s: %s", location, exc)
        return {
            "location":    location,
            "error":       "Analytics unavailable",
            "computed_at": None,
        }
