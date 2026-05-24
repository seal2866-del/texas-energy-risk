"""
external_apis.py
Thin wrappers around real data APIs.
Each function checks an env flag; if disabled or key is missing,
it falls back to mock_data so the rest of the app keeps working.

Real API integration points:
  - ERCOT RTBP (Real-Time Binding Prices): https://www.ercot.com/mp/data-products
  - NOAA/NWS API: https://api.weather.gov
  - EIA API v2: https://api.eia.gov/v2/
"""
import os
import httpx
from typing import List, Dict, Any
from . import mock_data


# ── ERCOT ─────────────────────────────────────────────────────────────────────
# ERCOT does not have a public REST API; market participants access data via
# ERCOT's MIS portal or CDR reports. When you have portal access, replace
# the stub below with your authenticated requests.

async def fetch_ercot_prices(hours: int = 24,
                             settlement_point: str = "HB_HOUSTON") -> List[Dict[str, Any]]:
    enabled = os.getenv("ERCOT_API_ENABLED", "false").lower() == "true"
    if not enabled:
        return mock_data.mock_ercot_prices(hours, settlement_point)

    # ── REAL IMPLEMENTATION PLACEHOLDER ──────────────────────────────────────
    # async with httpx.AsyncClient() as client:
    #     r = await client.get(
    #         "https://your-ercot-endpoint/rtbp",
    #         params={"settlementPoint": settlement_point, "hours": hours},
    #         headers={"Authorization": f"Bearer {os.getenv('ERCOT_TOKEN')}"},
    #     )
    #     r.raise_for_status()
    #     return transform_ercot_response(r.json())
    # ─────────────────────────────────────────────────────────────────────────
    return mock_data.mock_ercot_prices(hours, settlement_point)


# ── NOAA / NWS ────────────────────────────────────────────────────────────────

NOAA_OFFICES = {
    "Houston":     {"office": "HGX", "gridX": 66,  "gridY": 97},
    "Dallas":      {"office": "FWD", "gridX": 90,  "gridY": 104},
    "Austin":      {"office": "EWX", "gridX": 155, "gridY": 88},
    "San Antonio": {"office": "EWX", "gridX": 148, "gridY": 80},
}


async def fetch_weather_forecast(location: str = "Houston",
                                  days: int = 7) -> List[Dict[str, Any]]:
    api_key_set = bool(os.getenv("NOAA_BASE_URL"))

    if not api_key_set:
        return mock_data.mock_weather_forecast(days, location)

    try:
        office = NOAA_OFFICES.get(location, NOAA_OFFICES["Houston"])
        url = (
            f"{os.getenv('NOAA_BASE_URL', 'https://api.weather.gov')}"
            f"/gridpoints/{office['office']}/{office['gridX']},{office['gridY']}/forecast"
        )
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, headers={"User-Agent": "TexasEnergyRisk/1.0"})
            r.raise_for_status()
            return _transform_noaa(r.json(), location, days)
    except Exception:
        # Graceful fallback to mock
        return mock_data.mock_weather_forecast(days, location)


def _transform_noaa(data: dict, location: str, days: int) -> List[Dict[str, Any]]:
    """Transform NWS API response to our schema."""
    from datetime import datetime, timezone
    periods = data.get("properties", {}).get("periods", [])
    results = []

    # NWS returns daytime/nighttime alternating periods
    day_periods = [p for p in periods if p.get("isDaytime", True)][:days]
    night_periods = [p for p in periods if not p.get("isDaytime", True)][:days]

    for i, day in enumerate(day_periods):
        night = night_periods[i] if i < len(night_periods) else {}
        high_f = day.get("temperature", 85)
        low_f  = night.get("temperature", 65) if night else high_f - 20

        if high_f >= 100 or low_f <= 28:
            demand_risk = "high"
        elif high_f >= 90 or low_f <= 38:
            demand_risk = "medium"
        else:
            demand_risk = "low"

        results.append({
            "forecast_time": day.get("startTime", ""),
            "fetched_at":    datetime.now(timezone.utc).isoformat(),
            "location_name": f"{location}, TX",
            "temp_high_f":   high_f,
            "temp_low_f":    low_f,
            "condition":     day.get("shortForecast", "").lower()[:50],
            "demand_risk":   demand_risk,
            "source":        "noaa_api",
        })

    return results


# ── EIA Natural Gas ───────────────────────────────────────────────────────────

async def fetch_gas_data(weeks: int = 8) -> List[Dict[str, Any]]:
    eia_key = os.getenv("EIA_API_KEY", "")
    if not eia_key:
        return mock_data.mock_gas_data(weeks)

    try:
        url = "https://api.eia.gov/v2/natural-gas/stor/wkly/data/"
        params = {
            "api_key": eia_key,
            "frequency": "weekly",
            "data[0]": "value",
            "facets[process][]": "NG_S_US_NG_TOTAL_WGS_W",
            "sort[0][column]": "period",
            "sort[0][direction]": "desc",
            "length": weeks,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            return _transform_eia(r.json(), weeks)
    except Exception:
        return mock_data.mock_gas_data(weeks)


def _transform_eia(data: dict, weeks: int) -> List[Dict[str, Any]]:
    """Transform EIA v2 API response to our gas_data schema."""
    rows = data.get("response", {}).get("data", [])
    results = []

    # Approximate 5-year average for South Central region
    avg_5yr = 2310.0

    for row in rows[:weeks]:
        storage = float(row.get("value", 0))
        pct     = round(((storage - avg_5yr) / avg_5yr) * 100, 2)

        if pct <= -10:
            pressure = "low"
        elif pct >= 5:
            pressure = "high"
        else:
            pressure = "normal"

        results.append({
            "report_date":           row.get("period", ""),
            "storage_bcf":           round(storage / 1000, 1),  # EIA in MMcf → Bcf
            "storage_5yr_avg_bcf":   round(avg_5yr, 1),
            "storage_pct_vs_avg":    pct,
            "henry_hub_price":       None,    # pulled separately
            "supply_pressure":       pressure,
            "source":                "eia_api",
        })

    return list(reversed(results))
