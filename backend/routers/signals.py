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
from services.external_apis import fetch_ercot_prices, fetch_weather_forecast, fetch_gas_data, fetch_henry_hub_price
from services.signal_engine import run_all_signals
from services.forecast_engine import compute_forecast_outlook
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
        _results = await asyncio.gather(
            fetch_ercot_prices(hours=4),
            fetch_weather_forecast(location=location, days=3),
            fetch_gas_data(weeks=4),
            fetch_henry_hub_price(),
            return_exceptions=True,
        )
        prices         = _results[0] if not isinstance(_results[0], Exception) else []
        forecasts      = _results[1] if not isinstance(_results[1], Exception) else []
        gas_data       = _results[2] if not isinstance(_results[2], Exception) else []
        henry_hub_data = _results[3] if not isinstance(_results[3], Exception) else {}
        if isinstance(_results[0], Exception):
            logger.warning("[SIGNALS] ERCOT fetch error: %s", _results[0])
        if isinstance(_results[2], Exception):
            logger.warning("[SIGNALS] Gas fetch error: %s", _results[2])
        logger.warning("[SIGNALS] Data fetched: prices=%d forecasts=%d gas=%d henry_hub=%.3f",
                       len(prices), len(forecasts), len(gas_data),
                       henry_hub_data.get("price", 0) if isinstance(henry_hub_data, dict) else 0)

        # Inject real Henry Hub price into gas records (overrides hardcoded $2.80 placeholder)
        if isinstance(henry_hub_data, dict) and henry_hub_data.get("price"):
            real_hh = henry_hub_data["price"]
            for record in gas_data:
                record["henry_hub_price"] = real_hh

        result = run_all_signals(prices, forecasts, gas_data, location=location, henry_hub_data=henry_hub_data)

        logger.warning("[SIGNALS] Signal engine done: risk=%s data_valid=%s",
                       result.get("risk_score"), result.get("data_valid"))

        await _maybe_trigger_alert(result, location, authorization)

        # Fire-and-forget snapshot — never blocks the response
        import asyncio as _asyncio
        ercot_vals = [p.get("price_mwh", 0) for p in prices if (p.get("price_mwh") or 0) > 0]
        ercot_latest = ercot_vals[-1] if ercot_vals else None
        henry_hub = henry_hub_data.get("price") if isinstance(henry_hub_data, dict) else None
        _asyncio.create_task(_save_snapshot(result, location, ercot_latest, henry_hub))

        return result

    except Exception as exc:
        logger.error("[SIGNALS] Unhandled exception: %s", exc, exc_info=True)
        raise


@router.get("/risk-score")
async def get_risk_score(location: str = Query(default="Houston")):
    """Returns just the Texas Energy Risk Score (Low / Medium / High)."""
    _r = await asyncio.gather(
        fetch_ercot_prices(hours=4),
        fetch_weather_forecast(location=location, days=1),
        fetch_gas_data(weeks=2),
        return_exceptions=True,
    )
    prices    = _r[0] if not isinstance(_r[0], Exception) else []
    forecasts = _r[1] if not isinstance(_r[1], Exception) else []
    gas_data  = _r[2] if not isinstance(_r[2], Exception) else []
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


@router.get("/forecast")
async def get_forecast_outlook(
    location: str = Query(default="Houston"),
):
    """
    Returns 24h / 72h / 7-day probabilistic risk outlook with AI narrative.
    Cached 15 minutes. Uses ERCOT trends, NOAA forecast, Henry Hub, EIA storage.
    """
    try:
        prices, forecasts, gas_data, henry_hub_data = await asyncio.gather(
            fetch_ercot_prices(hours=6, settlement_point="HB_HOUSTON"),
            fetch_weather_forecast(location=location, days=7),
            fetch_gas_data(weeks=4),
            fetch_henry_hub_price(),
            return_exceptions=True,
        )
        prices      = prices      if not isinstance(prices,      Exception) else []
        forecasts   = forecasts   if not isinstance(forecasts,   Exception) else []
        gas_data    = gas_data    if not isinstance(gas_data,    Exception) else {}
        henry_hub   = henry_hub_data if not isinstance(henry_hub_data, Exception) else None

        gas_records = gas_data.get("records", []) if isinstance(gas_data, dict) else []

        # Convert ERCOTPrice objects to dicts if needed
        price_dicts = [
            p if isinstance(p, dict) else {"price_mwh": getattr(p, "price_mwh", 0),
                                            "timestamp": str(getattr(p, "timestamp", ""))}
            for p in (prices or [])
        ]

        result = await compute_forecast_outlook(
            prices=price_dicts,
            forecasts=forecasts if isinstance(forecasts, list) else [],
            gas_records=gas_records,
            henry_hub=henry_hub,
            location=location,
        )
        return result

    except Exception as exc:
        logger.error("[FORECAST] Error: %s", exc)
        return {
            "computed_at":   "",
            "location":      location,
            "overall_risk":  "low",
            "overall_label": "LOW",
            "overall_color": "#22c55e",
            "horizons":      [],
            "narrative":     "Forecast data temporarily unavailable. Current conditions are within normal range.",
            "error":         str(exc),
        }


@router.get("/load-optimizer")
async def get_load_optimizer(
    location: str = Query(default="Houston"),
):
    """
    Returns optimal load scheduling windows for next 24-48 hours.
    Identifies cheapest 2h/4h/6h windows based on ERCOT price patterns + temp forecast.
    Cached 30 minutes.
    """
    try:
        from services.load_optimizer import compute_load_optimizer
        prices_raw, forecasts_raw = await asyncio.gather(
            fetch_ercot_prices(hours=6, settlement_point="HB_HOUSTON"),
            fetch_weather_forecast(location=location, days=2),
            return_exceptions=True,
        )
        prices    = prices_raw    if not isinstance(prices_raw,    Exception) else []
        forecasts = forecasts_raw if not isinstance(forecasts_raw, Exception) else []
        price_dicts = [
            p if isinstance(p, dict) else {"price_mwh": getattr(p, "price_mwh", 0)}
            for p in (prices or [])
        ]
        return await compute_load_optimizer(price_dicts, forecasts, location=location)
    except Exception as exc:
        logger.error("[LOAD-OPT] Error: %s", exc)
        return {"error": str(exc), "recommendation": "Data temporarily unavailable"}


@router.get("/dam")
async def get_dam_comparison(
    location: str = Query(default="Houston"),
):
    """
    Returns ERCOT Day-Ahead Market prices vs Real-Time.
    Includes lock-in signal: LOCK IN / STAY FLOATING / MONITOR.
    DAM posts ~2PM CT daily. Cached 1 hour.
    """
    try:
        from services.dam_tracker import fetch_dam_comparison
        prices_raw = await fetch_ercot_prices(hours=2, settlement_point="HB_HOUSTON")
        prices = prices_raw if not isinstance(prices_raw, Exception) else []