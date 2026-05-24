"""
external_apis.py
Thin wrappers around real data APIs.
Each function checks an env flag; if disabled or key is missing,
it falls back to mock_data so the rest of the app keeps working.

Real API integration points:
  - ERCOT CDR HTML scraper:  https://www.ercot.com/content/cdr/html/hb_lz.html
  - NOAA/NWS API:            https://api.weather.gov
  - EIA API v2:              https://api.eia.gov/v2/
"""
import os
import re
import httpx
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from . import mock_data


# ── ERCOT ─────────────────────────────────────────────────────────────────────
# ERCOT publishes real-time LMPs via a public CDR HTML page (no auth needed).
# We scrape HB_HOUSTON (and other hubs) every call; Railway caches at the
# nginx/proxy level so we won't hammer ercot.com.

ERCOT_CDR_URL = "https://www.ercot.com/content/cdr/html/hb_lz.html"

# 24-hour rolling history is built from mock for older hours + live for current
_ERCOT_HEADERS = {
    "User-Agent": "TexasEnergyRiskPlatform/1.0 (informational research tool)",
    "Accept": "text/html,application/xhtml+xml",
}


def _parse_ercot_cdr(html: str, settlement_point: str) -> Optional[float]:
    """
    Extract the LMP for a given settlement point from ERCOT's CDR HTML page.
    The table looks like:
      <td>HB_HOUSTON</td><td align="right">23.92</td> ...
    Falls back to a broader regex if the table structure changes.
    """
    # Primary: standard table cell pattern
    pattern = rf'{re.escape(settlement_point)}[^<]*</td>\s*<td[^>]*>\s*([\d.]+)'
    match = re.search(pattern, html, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass

    # Fallback: settlement point name followed by first number on the same line
    pattern2 = rf'{re.escape(settlement_point)}[^\d\n]*?([\d]+\.[\d]+)'
    match2 = re.search(pattern2, html)
    if match2:
        try:
            return float(match2.group(1))
        except ValueError:
            pass

    return None


def _parse_ercot_timestamp(html: str) -> str:
    """Extract the 'Last Updated' timestamp from the CDR page."""
    m = re.search(r'Last Updated[:\s]+([\w\s,:.]+?)(?:<|\n|$)', html, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return datetime.now(timezone.utc).isoformat()


async def fetch_ercot_prices(
    hours: int = 24,
    settlement_point: str = "HB_HOUSTON",
) -> List[Dict[str, Any]]:
    """
    Returns `hours` of price history.
    - If ERCOT_API_ENABLED=true: last data point is live from ERCOT CDR;
      earlier hours use mock (CDR only publishes the current 5-min interval).
    - Otherwise: full mock history.
    """
    enabled = os.getenv("ERCOT_API_ENABLED", "false").lower() == "true"
    if not enabled:
        return mock_data.mock_ercot_prices(hours, settlement_point)

    try:
        async with httpx.AsyncClient(timeout=15, headers=_ERCOT_HEADERS) as client:
            r = await client.get(ERCOT_CDR_URL)
            r.raise_for_status()

        live_price = _parse_ercot_cdr(r.text, settlement_point)
        if live_price is None:
            # Parsing failed — graceful fallback
            return mock_data.mock_ercot_prices(hours, settlement_point)

        # Build history: mock for past (hours-1) + live current price
        history = mock_data.mock_ercot_prices(hours - 1, settlement_point)

        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        history.append({
            "timestamp":        now.isoformat(),
            "settlement_point": settlement_point,
            "price_mwh":        live_price,
            "price_type":       "real_time",
            "source":           "ercot_cdr",
        })
        return history

    except Exception:
        return mock_data.mock_ercot_prices(hours, settlement_point)


async def fetch_current_ercot_price(
    settlement_point: str = "HB_HOUSTON",
) -> Dict[str, Any]:
    """Single live price snapshot from ERCOT CDR."""
    enabled = os.getenv("ERCOT_API_ENABLED", "false").lower() == "true"
    if not enabled:
        return mock_data.mock_current_ercot_price(settlement_point)

    try:
        async with httpx.AsyncClient(timeout=15, headers=_ERCOT_HEADERS) as client:
            r = await client.get(ERCOT_CDR_URL)
            r.raise_for_status()

        live_price = _parse_ercot_cdr(r.text, settlement_point)
        if live_price is None:
            return mock_data.mock_current_ercot_price(settlement_point)

        return {
            "timestamp":        datetime.now(timezone.utc).isoformat(),
            "settlement_point": settlement_point,
            "price_mwh":        live_price,
            "price_type":       "real_time",
            "source":           "ercot_cdr",
            "last_updated":     _parse_ercot_timestamp(r.text),
        }

    except Exception:
        return mock_data.mock_current_ercot_price(settlement_point)


async def fetch_all_hub_prices() -> Dict[str, float]:
    """Fetch all ERCOT hub prices in one CDR page hit."""
    hubs = ["HB_HOUSTON", "HB_NORTH", "HB_SOUTH", "HB_WEST", "HB_BUSAVG"]
    enabled = os.getenv("ERCOT_API_ENABLED", "false").lower() == "true"
    if not enabled:
        return {h: mock_data.mock_current_ercot_price(h)["price_mwh"] for h in hubs}

    try:
        async with httpx.AsyncClient(timeout=15, headers=_ERCOT_HEADERS) as client:
            r = await client.get(ERCOT_CDR_URL)
            r.raise_for_status()

        return {
            h: (_parse_ercot_cdr(r.text, h) or mock_data.mock_current_ercot_price(h)["price_mwh"])
            for h in hubs
        }
    except Exception:
        return {h: mock_data.mock_current_ercot_price(h)["price_mwh"] for h in hubs}


# ── NOAA / NWS ────────────────────────────────────────────────────────────────
# Free, no API key. Set NOAA_BASE_URL=https://api.weather.gov on Railway.

NOAA_OFFICES = {
    "Houston":     {"office": "HGX", "gridX": 66,  "gridY": 97},
    "Dallas":      {"office": "FWD", "gridX": 90,  "gridY": 104},
    "Austin":      {"office": "EWX", "gridX": 155, "gridY": 88},
    "San Antonio": {"office": "EWX", "gridX": 148, "gridY": 80},
}


async def fetch_weather_forecast(
    location: str = "Houston",
    days: int = 7,
) -> List[Dict[str, Any]]:
    noaa_base = os.getenv("NOAA_BASE_URL", "")
    if not noaa_base:
        return mock_data.mock_weather_forecast(days, location)

    try:
        office = NOAA_OFFICES.get(location, NOAA_OFFICES["Houston"])
        url = (
            f"{noaa_base.rstrip('/')}"
            f"/gridpoints/{office['office']}/{office['gridX']},{office['gridY']}/forecast"
        )
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, headers={"User-Agent": "TexasEnergyRisk/1.0"})
            r.raise_for_status()
        return _transform_noaa(r.json(), location, days)
    except Exception:
        return mock_data.mock_weather_forecast(days, location)


def _transform_noaa(data: dict, location: str, days: int) -> List[Dict[str, Any]]:
    """Transform NWS API response to our schema."""
    periods = data.get("properties", {}).get("periods", [])
    results = []

    day_periods   = [p for p in periods if     p.get("isDaytime", True)][:days]
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
# Free API key at https://api.eia.gov/registrations/new
# Set EIA_API_KEY=your_key on Railway.

async def fetch_gas_data(weeks: int = 8) -> List[Dict[str, Any]]:
    eia_key = os.getenv("EIA_API_KEY", "")
    if not eia_key:
        return mock_data.mock_gas_data(weeks)

    try:
        url = "https://api.eia.gov/v2/natural-gas/stor/wkly/data/"
        params = {
            "api_key":              eia_key,
            "frequency":            "weekly",
            "data[0]":              "value",
            "facets[duoarea][]":    "NUS",   # National US total
            "facets[process][]":    "SAT",   # All salt + non-salt (total working gas)
            "sort[0][column]":      "period",
            "sort[0][direction]":   "desc",
            "length":               weeks,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
        result = _transform_eia(r.json(), weeks)
        # If EIA returned empty rows, fall back to mock
        return result if result else mock_data.mock_gas_data(weeks)
    except Exception:
        return mock_data.mock_gas_data(weeks)


def _transform_eia(data: dict, weeks: int) -> List[Dict[str, Any]]:
    """Transform EIA v2 API response to our gas_data schema."""
    rows    = data.get("response", {}).get("data", [])
    avg_5yr = 2310.0
    results = []

    for row in rows[:weeks]:
        storage = float(row.get("value", 0))
        pct     = round(((storage - avg_5yr) / avg_5yr) * 100, 2)

        pressure = "low" if pct <= -10 else ("high" if pct >= 5 else "normal")

        results.append({
            "report_date":          row.get("period", ""),
            "storage_bcf":          round(storage / 1000, 1),
            "storage_5yr_avg_bcf":  round(avg_5yr, 1),
            "storage_pct_vs_avg":   pct,
            "henry_hub_price":      None,
            "supply_pressure":      pressure,
            "source":               "eia_api",
        })

    return list(reversed(results))
