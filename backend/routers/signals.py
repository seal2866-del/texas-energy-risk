from fastapi import APIRouter, Query
from services.external_apis import fetch_ercot_prices, fetch_weather_forecast, fetch_gas_data
from services.signal_engine import run_all_signals

router = APIRouter(prefix="/api/signals", tags=["Signals"])


@router.get("/")
async def get_signals(location: str = Query(default="Houston")):
    """
    Runs all three risk signal detectors and returns a composite snapshot
    including the Texas Energy Risk Score.

    DISCLAIMER: All output is informational only. This does not constitute
    investment, trading, or procurement advice. Risk may be rising — consult
    qualified advisors before making any decisions.
    """
    prices    = await fetch_ercot_prices(hours=4)
    forecasts = await fetch_weather_forecast(location=location, days=3)
    gas_data  = await fetch_gas_data(weeks=4)

    result = run_all_signals(prices, forecasts, gas_data)
    return result


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
