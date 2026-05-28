"""
mock_data.py
Generates realistic-looking mock data for all three data streams.
When real APIs are connected, these functions are bypassed.
"""
import random
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────────────────────
# ERCOT price mock
# ──────────────────────────────────────────────────────────────

SETTLEMENT_POINTS = ["HB_HOUSTON", "HB_NORTH", "HB_SOUTH", "HB_WEST", "HB_BUSAVG"]


def mock_ercot_prices(hours: int = 24, settlement_point: str = "HB_HOUSTON") -> List[Dict[str, Any]]:
    """Return `hours` hours of mock ERCOT real-time prices."""
    now = _utcnow().replace(minute=0, second=0, microsecond=0)
    base_price = 45.0
    prices = []

    for i in range(hours, 0, -1):
        ts = now - timedelta(hours=i)
        hour = ts.hour

        # Simulate peak pricing during hot afternoon hours (CDT 14-19 = UTC 19-24)
        if 13 <= hour <= 18:
            spike_factor = random.uniform(2.5, 8.0)
        elif 7 <= hour <= 12:
            spike_factor = random.uniform(1.2, 2.0)
        else:
            spike_factor = random.uniform(0.5, 1.2)

        # Occasionally inject a price spike
        if random.random() < 0.05:
            spike_factor *= random.uniform(4.0, 15.0)

        price = round(max(0.01, base_price * spike_factor + random.gauss(0, 5)), 2)

        prices.append({
            "timestamp": ts.isoformat(),
            "settlement_point": settlement_point,
            "price_mwh": price,
            "price_type": "real_time",
            "source": "mock",
        })

    return prices


def mock_current_ercot_price(settlement_point: str = "HB_HOUSTON") -> Dict[str, Any]:
    """Single current price snapshot."""
    return mock_ercot_prices(hours=1, settlement_point=settlement_point)[-1]


# ──────────────────────────────────────────────────────────────
# Weather mock (NOAA/NWS style)
# ──────────────────────────────────────────────────────────────

TX_STATIONS = {
    "Houston":        {"station": "KHOU", "lat": 29.76,  "lon": -95.37},
    "Dallas":         {"station": "KDFW", "lat": 32.89,  "lon": -97.04},
    "Austin":         {"station": "KAUS", "lat": 30.19,  "lon": -97.67},
    "San Antonio":    {"station": "KSAT", "lat": 29.53,  "lon": -98.47},
    "Midland":        {"station": "KMAF", "lat": 31.94,  "lon": -102.20},
    "Odessa":         {"station": "KODO", "lat": 31.92,  "lon": -102.39},
    "Corpus Christi": {"station": "KCRP", "lat": 27.77,  "lon": -97.50},
    "Lubbock":        {"station": "KLBB", "lat": 33.66,  "lon": -101.82},
}



# Per-city temperature offsets (degrees F relative to base) for realistic regional variation
_CITY_TEMP_OFFSETS = {
    "Houston":        0,
    "Dallas":         2,
    "Austin":         1,
    "San Antonio":    2,
    "Midland":        5,   # hotter, drier desert climate
    "Odessa":         5,
    "Corpus Christi": -3,  # coastal, slightly cooler
    "Lubbock":        3,   # high plains, hot summers
}


def mock_weather_forecast(days: int = 7, location: str = "Houston") -> List[Dict[str, Any]]:
    now = _utcnow()
    forecasts = []

    city_offset = _CITY_TEMP_OFFSETS.get(location, 0)

    # May through September — simulate Texas summer heat
    month = now.month
    if month in range(5, 10):
        base_high = random.uniform(95, 108) + city_offset
    elif month in range(11, 13) or month in range(1, 3):
        base_high = random.uniform(35, 65) + city_offset
    else:
        base_high = random.uniform(70, 90) + city_offset

    for day_offset in range(1, days + 1):
        forecast_dt = now + timedelta(days=day_offset)
        high_f = round(base_high + random.gauss(0, 4), 1)
        low_f  = round(high_f - random.uniform(18, 26), 1)

        # Determine demand risk
        if high_f >= 100 or low_f <= 28:
            demand_risk = "high"
        elif high_f >= 90 or low_f <= 38:
            demand_risk = "medium"
        else:
            demand_risk = "low"

        conditions = random.choices(
            ["sunny", "partly_cloudy", "cloudy", "thunderstorm"],
            weights=[50, 25, 15, 10],
        )[0]

        forecasts.append({
            "forecast_time": forecast_dt.isoformat(),
            "fetched_at": now.isoformat(),
            "station_id": TX_STATIONS[location]["station"],
            "location_name": f"{location}, TX",
            "temp_high_f": high_f,
            "temp_low_f": low_f,
            "humidity_pct": round(random.uniform(40, 80), 1),
            "wind_mph": round(random.uniform(5, 20), 1),
            "condition": conditions,
            "demand_risk": demand_risk,
            "source": "mock",
        })

    return forecasts


# ──────────────────────────────────────────────────────────────
# EIA natural gas storage mock
# ──────────────────────────────────────────────────────────────

def mock_gas_data(weeks: int = 8) -> List[Dict[str, Any]]:
    now = _utcnow()
    records = []
    storage = 2250.0  # Bcf

    for week in range(weeks, 0, -1):
        report_date = (now - timedelta(weeks=week)).date()
        # Gradual drawdown trend with noise
        storage += random.gauss(-30, 20)
        storage = max(1