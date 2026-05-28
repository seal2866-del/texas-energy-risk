"""
snapshot_service.py
Persists signal snapshots to Supabase for historical trend analysis.
Called after every run_all_signals() computation.
Writes are fire-and-forget — never block the signals response.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict

logger = logging.getLogger(__name__)

# Numeric map for risk_score text values
_RISK_NUMERIC = {"low": 2.0, "medium": 5.0, "high": 8.5}


def _extract_snapshot(signals: Dict[str, Any], location: str) -> Dict[str, Any]:
    """Pull the fields we care about from a full signals dict."""
    risk_text = signals.get("risk_score", "low")

    # Use escalation_probability pct if available, else None
    esc = signals.get("escalation_probability") or {}
    esc_pct = esc.get("pct") if isinstance(esc, dict) else None

    alignment = signals.get("signal_alignment") or {}
    align_score = alignment.get("score") if isinstance(alignment, dict) else None

    demand  = (signals.get("demand_pressure")  or {}).get("level")
    supply  = (signals.get("supply_pressure")  or {}).get("level")
    market  = (signals.get("market_reaction")  or {}).get("level")

    # Pull latest ERCOT price from cost_impact or signals context
    ercot_price = None
    cost = signals.get("cost_impact") or {}
    # Try to get from data_sources context — not always present
    # Fall back to None; the chart just skips null points

    gas = signals.get("gas_to_power_impact") or {}
    henry_hub = None  # populated by router when available

    computed_at = signals.get("computed_at") or datetime.now(timezone.utc).isoformat()

    return {
        "location":               location,
        "computed_at":            computed_at,
        "risk_score":             risk_text,
        "risk_score_numeric":     _RISK_NUMERIC.get(risk_text, 2.0),
        "risk_direction":         signals.get("risk_direction"),
        "confidence":             signals.get("confidence"),
        "escalation_pct":         esc_pct,
        "demand_level":           demand,
        "supply_level":           supply,
        "market_level":           market,
        "ercot_price":            ercot_price,
        "henry_hub_price":        henry_hub,
        "primary_driver":         signals.get("primary_driver"),
        "signal_alignment_score": align_score,
        "data_valid":             bool(signals.get("data_valid", False)),
        "active_signals":         int(signals.get("active_signals", 0)),
    }


async def save_snapshot(signals: Dict[str, Any], location: str,
                        ercot_price: float | None = None,
                        henry_hub: float | None = None) -> bool:
    """
    Persist a signal snapshot to Supabase.
    Returns True on success, False on any error.
    Never raises — callers should not await the result if fire-and-forget.
    """
    try:
        from services.supabase_client import get_supabase
        sb = get_supabase()

        row = _extract_snapshot(signals, location)
        if ercot_price is not None:
            row["ercot_price"] = ercot_price
        if henry_hub is not None:
            row["henry_hub_price"] = henry_hub

        sb.table("signal_snapshots").insert(row).execute()
        logger.debug("[SNAPSHOT] Saved snapshot for %s risk=%s", location, row["risk_score"])
        return True

    except Exception as exc:
        logger.warning("[SNAPSHOT] Failed to save snapshot: %s", exc)
        return False


async def get_history(location: str, hours: int = 168) -> list:
    """
    Fetch signal snapshots for a location over the last N hours.
    Returns list of snapshot dicts ordered oldest → newest.
    """
    try:
        from services.supabase_client import get_supabase
        from datetime import timedelta
        sb = get_supabase()

        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

        resp = (
            sb.table("signal_snapshots")
            .select(
                "computed_at, risk_score, risk_score_numeric, risk_direction, "
                "confidence, escalation_pct, demand_level, supply_level, "
                "market_level, ercot_price, primary_driver, active_signals"
            )
            .eq("location", location)
            .gte("computed_at", since)
            .order("computed_at", desc=False)
            .limit(2016)   # 7 days × 24h × 12 per hour max
            .execute()
        )
        return resp.data or []

    except Exception as exc:
        logger.warning("[SNAPSHOT] Failed to fetch history: %s", exc)
        return []
