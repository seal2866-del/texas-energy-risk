"""
signals.py
Signal computation router. Runs all three risk detectors and returns
the composite risk snapshot. Triggers email alerts for Pro users.

DISCLAIMER: All output is informational only. This does not constitute
investment, trading, or procurement advice.
"""
import os
import asyncio
import logging
from fastapi import APIRouter, Query, Header
from services.external_apis import fetch_ercot_prices, fetch_weather_forecast, fetch_gas_data
from services.signal_engine import run_all_signals
from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/signals", tags=["Signals"])


async def _maybe_trigger_alert(result: dict, location: str, authorization: str) -> None:
    """
    Phase 4 - Check if the requesting user has email alerts enabled (Pro),
    and if so, dispatch via alert_service.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return
    if not result.get("data_valid", False):
        return

    try:
        token = authorization.split(" ", 1)[1]
        sb    = get_supabase()

        user_resp = sb.auth.get_user(token)
        if not user_resp or not user_resp.user:
            return
        user    = user_resp.user
        user_id = user.id
        email   = user.email

        sub = sb.table("subscriptions").select("plan, status").eq("user_id", user_id).limit(1).execute()
        if not sub.data or sub.data[0].get("plan") not in ("pro", "business", "enterprise"):
            return
        if sub.data[0].get("status") not in ("active", "trialing"):
            return

        prefs = sb.table("alert_preferences").select("*").eq("user_id", user_id).limit(1).execute()
        if prefs.data and not prefs.data[0].get("email_alerts", True):
            return

        from services.alert_service import maybe_send_alert
        await maybe_send_alert(
            user_id=user_id,
            to_email=email,
            signals_data=result,
            city=location,
        )

    except Exception as exc:
        logger.warning("[SIGNALS] Alert dispatch error (non-fatal): %s", exc)


@router.get("/")
async def get_signals(
    location:      str = Query(default="Houston"),
    authorization: str = Header(default=""),
):
    logger.warning("[SIGNALS] Request received for location=%s", location)
    try:
        prices, forecasts, gas_data = await asyncio.gather(
            fetch_ercot_prices(hours=4),
            fetch_weather_forecast(location=location, days=3),
            fetch_gas_data(weeks=4),
        )
        logger.warning("[SIGNALS] Data fetched: prices=%d forecasts=%d gas=%d",
                       len(prices), len(forecasts), len(gas_data))

        result = run_all_signals(prices, forecasts, gas_data, location=location)

        logger.warning("[SIGNALS] Signal engine done: risk=%s data_valid=%s",
                       result.get("risk_score"), result.get("data_valid"))

        await _maybe_trigger_alert(result, location, authorization)

        # Fire-and-forget snapshot — never blocks the response
        import asyncio as _asyncio
        ercot_vals = [p.get("price_mwh", 0) for p in prices if (p.get("price_mwh") or 0) > 0]
        ercot_latest = ercot_vals[-1] if ercot_vals else None
        gas_latest = gas_data[-1] if gas_data else {}
        henry_hub = gas_latest.get("henry_hub_price") if gas_latest else None
        _asyncio.create_task(_save_snapshot(result, location, ercot_latest, henry_hub))

        return result

    except Exception as exc:
        logger.error("[SIGNALS] Unhandled exception: %s", exc, exc_info=True)
        raise


@router.get("/risk-score")
async def get_risk_score(location: str = Query(default="Houston")):
    """Returns just the Texas Energy Risk Score (Low / Medium / High)."""
    prices, forecasts, gas_data = await asyncio.gather(
        fetch_ercot_prices(hours=4),
        fetch_weather_forecast(location=location, days=1),
        fetch_gas_data(weeks=2),
    )
    result = run_all_signals(prices, forecasts, gas_data, location=location)
    return {
        "risk_score":     result["risk_score"],
        "active_signals": result["active_signals"],
        "computed_at":    result["computed_at"],
        "disclaimer":     result["disclaimer"],
    }

async def _save_snapshot(result, location, ercot_price, henry_hub):
    """Fire-and-forget wrapper — errors are logged, never raised."""
    try:
        from services.snapshot_service import save_snapshot
        await save_snapshot(result, location, ercot_price, henry_hub)
    except Exception as exc:
        logger.warning("[SIGNALS] Snapshot save error: %s", exc)


@router.get("/history")
async def get_signal_history(
    location: str = Query(default="Houston"),
    hours:    int  = Query(default=168, ge=1, le=720),
):
    """
    Returns historical signal snapshots for a location.
    Default: last 7 days (168 hours). Max: 30 days (720 hours).
    """
    from services.snapshot_service import get_history
    data = await get_history(location=location, hours=hours)
    return {
        "location": location,
        "hours":    hours,
        "count":    len(data),
        "snapshots": data,
    }
