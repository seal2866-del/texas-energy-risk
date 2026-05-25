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
    Phase 4 — Check if the requesting user has email alerts enabled (Pro),
    and if so, dispatch via alert_service.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return
    if not result.get("data_valid", False):
        return

    try:
        token = authorization.split(" ", 1)[1]
        sb    = get_supabase()

        # Get user
        user_resp = sb.auth.get_user(token)
        if not user_resp or not user_resp.user:
            return
        user    = user_resp.user
        user_id = user.id
        email   = user.email

        # Check subscription tier (only Pro+ gets alerts)
        sub = sb.table("subscriptions").select("plan, status").eq("user_id", user_id).limit(1).execute()
        if not sub.data or sub.data[0].get("plan") not in ("pro", "business", "enterprise"):
            return
        if sub.data[0].get("status") not in ("active", "trialing"):
            return

        # Check alert preferences
        prefs = sb.table("alert_preferences").select("*").eq("user_id", user_id).limit(1).execute()
        if prefs.data and not prefs.data[0].get("email_alerts", True):
            return

        # Dispatch alert (non-blocking)
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
        # Fetch all three data sources concurrently (was sequential — too slow)
        prices, forecasts, gas_data = await asyncio.gather(
            fetch_ercot_prices(hours=4),
            fetch_weather_forecast(location=location, days=3),
            fetch_gas_data(weeks=4),
        )

        logger.warning("[SIGNALS] Data fetched: prices=%d forecasts=%d gas=%d",
                       len(prices), len(forecasts), len(gas_data))

        result = run_all_signals(prices, forecasts, gas_data)

        logger.warning("[SIGNALS] Signal engine done: risk=%s data_valid=%s",
                       result.get("risk_score"), result.get("data_valid"))

        # Phase 4 — trigger email alert if conditions warrant
        await _maybe_trigger_alert(result, location, authorization)

        return result
    except Exception as exc:
        logger.error("[SIGNALS] Unhandled exception: %s", exc, exc_info=True)
        raise


@router.get("/risk-score")
async def get_risk_score(location: str = Query(default="Houston")):
    """Returns just the Texas Energy Risk Score (Low / Medium / High)."""
    prices    = await fetch_ercot_prices(hours=4)
    forecasts = await fetch_weather_forecast(location=location, days=1)
    gas_data  = await fetch_gas_data(weeks=2)

    result = run_all_signals(prices, forecasts, gas_data)
    return {
        "risk_score":     result["risk_score"],
        "active_signals": result["active_signals"],
        "computed_at":    result["computed_at"],
        "disclaimer":     result["disclaimer"],
    }
