from fastapi import APIRouter, Query
from services.external_apis import fetch_weather_forecast

router = APIRouter(prefix="/api/weather", tags=["Weather"])

VALID_LOCATIONS = ["Houston", "Dallas", "Austin", "San Antonio"]


@router.get("/forecast")
async def get_forecast(
    location: str = Query(default="Houston"),
    days: int = Query(default=7, ge=1, le=14),
):
    """
    Returns Texas weather forecast with demand risk classification.
    Informational only — not procurement or operational advice.
    """
    if location not in VALID_LOCATIONS:
        location = "Houston"

    forecasts = await fetch_weather_forecast(location=location, days=days)
    return {
        "location":   location,
        "days":       days,
        "forecasts":  forecasts,
        "disclaimer": "Informational only. Not procurement or operational advice.",
    }


@router.get("/forecast/tomorrow")
async def get_tomorrow(location: str = Query(default="Houston")):
    if location not in VALID_LOCATIONS:
        location = "Houston"
    forecasts = await fetch_weather_forecast(location=location, days=2)
    return {
        "location":   location,
        "tomorrow":   forecasts[0] if forecasts else None,
        "disclaimer": "Informational only.",
    }
