"""
ai_reasoning.py — FastAPI router
GET /api/ai-reasoning?location=Houston
Fetches current market data, runs signal engine, generates AI reasoning.
Result cached 10 minutes to control API cost.

DISCLAIMER: All output is informational analytics only.
Not investment, trading, financial, legal, or procurement advice.
"""
import asyncio
import logging
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api", tags=["ai-reasoning"])
logger = logging.getLogger(__name__)


@router.get("/ai-reasoning")
async def get_ai_reasoning(location: str = Query(default="Houston")):
    """
    Generate AI market reasoning for current Texas energy conditions.
    Internally fetches ERCOT, weather, and gas data, runs signal engine,
    then calls AI reasoning layer. Result cached 10 minutes per location/state.
    """
    from services.external_apis import fetch_ercot_prices, fetch_weather_forecast, fetch_gas_data
    from services.signal_engine import run_all_signals
    from services.ai_reasoning import generate_ai_reasoning

    # -- Fetch market data (same as signals endpoint)
    try:
        prices, forecasts, gas_data = await asyncio.gather(
            fetch_ercot_prices(hours=4),
            fetch_weather_forecast(location=location, days=3),
            fetch_gas_data(weeks=4),
        )
    except Exception as exc:
        logger.warning("[AI_REASONING_ROUTER] Data fetch error: %s", exc)
        prices = forecasts = gas_data = []

    # -- Run signal engine
    try:
        signals = run_all_signals(prices, forecasts, gas_data)
    except Exception as exc:
        logger.warning("[AI_REASONING_ROUTER] Signal engine error: %s", exc)
        signals = {}

    # -- Extract ERCOT price metrics
    ercot_vals = [p.get("price_mwh", 0) for p in prices if (p.get("price_mwh") or 0) > 0]
    ercot_current = ercot_vals[-1] if ercot_vals else 0
    ercot_prev    = ercot_vals[-2]  if len(ercot_vals) >= 2 else ercot_current
    if ercot_current > ercot_prev * 1.10:
        price_behavior = "rising"
    elif ercot_current < ercot_prev * 0.90:
        price_behavior = "falling"
    else:
        price_behavior = "stable"

    price_range = (max(ercot_vals) - min(ercot_vals)) if len(ercot_vals) >= 2 else 0
    if price_range > 100:
        ercot_volatility = "high"
    elif price_range > 30:
        ercot_volatility = "medium"
    else:
        ercot_volatility = "low"

    # -- Extract gas data
    gas_latest = gas_data[-1] if gas_data else {}

    # -- Extract weather data
    wx = forecasts[0] if forecasts else {}

    # -- Assess aggregate data health
    data_sources = signals.get("data_sources") or {}
    source_statuses = [
        (data_sources.get("ercot") or {}).get("status"),
        (data_sources.get("noaa")  or {}).get("status"),
        (data_sources.get("eia")   or {}).get("status"),
    ]
    if all(s == "active" for s in source_statuses):
        data_health = "active"
    elif any(s == "unavailable" for s in source_statuses):
        data_health = "degraded"
    else:
        data_health = "partial"

    # -- Build secondary drivers list
    signal_drivers = signals.get("signal_drivers") or []
    primary_type   = signals.get("primary_driver_type", "")
    secondary      = [
        d.get("name", "")
        for d in signal_drivers
        if d.get("active") and d.get("type") != primary_type
    ]

    # -- Compose inputs for AI reasoning
    inputs = {
        "location":                  location,
        "overall_risk_level":        signals.get("risk_score", "low"),
        "confidence_score":          signals.get("confidence"),
        "market_state":              (signals.get("market_condition") or {}).get("label", "Stable"),
        "risk_direction":            signals.get("risk_direction", "stable"),
        "primary_driver":            signals.get("primary_driver", "market conditions"),
        "secondary_drivers":         secondary,
        "ercot_price":               ercot_current,
        "ercot_price_behavior":      price_behavior,
        "ercot_volatility_level":    ercot_volatility,
        "weather_temperature":       wx.get("temp_low_f", "N/A"),
        "weather_forecast_high":     wx.get("temp_high_f", "N/A"),
        "weather_demand_pressure":   (signals.get("demand_pressure") or {}).get("level", "low"),
        "natural_gas_storage":       gas_latest.get("storage_bcf", "N/A"),
        "gas_storage_vs_5yr_avg":    gas_latest.get("storage_pct_vs_avg", "N/A"),
        "henry_hub_price":           gas_latest.get("henry_hub_price", 0),
        "gas_supply_pressure":       (signals.get("supply_pressure") or {}).get("level", "low"),
        "gas_to_power_impact":       (signals.get("gas_to_power_impact") or {}).get("level", "low"),
        "active_events":             signals.get("events") or [],
        "data_source_health":        data_health,
        "data_valid":                signals.get("data_valid", False),
        "time_horizon":              (signals.get("time_horizons") or {}).get("short_term", "next 24-48 hours"),
    }

    result = await generate_ai_reasoning(inputs)
    return result


@router.get("/ai-reasoning/status")
async def ai_reasoning_status():
    """
    Diagnostic endpoint — returns AI layer config without exposing the API key.
    Use to verify ANTHROPIC_API_KEY is set in the deployment environment.
    """
    from services.ai_reasoning import get_ai_status
    return get_ai_status()
