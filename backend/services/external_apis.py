"""
external_apis.py
Real data fetchers for ERCOT, NOAA, and EIA.
CRITICAL: ERCOT prices use an in-memory cache of REAL readings only.
         No mock data is ever mixed into price history.
"""
import os
import re
import logging
import httpx
from collections import deque
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from . import mock_data

logger = logging.getLogger(__name__)

# ── ERCOT Real-Price Cache ────────────────────────────────────────────────────
# Accumulates genuine CDR readings across requests (persists while Railway runs).
# Keyed per settlement point. Max 48 readings per point (~4 hours at 5-min intervals).

_PRICE_CACHE: Dict[str, deque] = {}
_CACHE_MAXLEN = 48
_MIN_INTERVAL_SECONDS = 60   # don't add duplicate if fetched within 60s

def _get_cache(settlement_point: str) -> deque:
    if settlement_point not in _PRICE_CACHE:
        _PRICE_CACHE[settlement_point] = deque(maxlen=_CACHE_MAXLEN)
    return _PRICE_CACHE[settlement_point]


def _cache_price(record: dict) -> bool:
    """
    Add a real price reading to the cache.
    Returns True if added, False if duplicate/skipped.
    """
    sp    = record.get("settlement_point", "HB_HOUSTON")
    cache = _get_cache(sp)

    if cache:
        last = cache[-1]
        try:
            last_ts = datetime.fromisoformat(last["timestamp"].replace("Z", "+00:00"))
            new_ts  = datetime.fromisoformat(record["timestamp"].replace("Z", "+00:00"))
            if abs((new_ts - last_ts).total_seconds()) < _MIN_INTERVAL_SECONDS:
                return False   # duplicate — skip
        except Exception:
            pass

    cache.append(record)
    logger.info(
        "[ERCOT CACHE] Added real price: sp=%s price=%.2f source=%s ts=%s cache_size=%d",
        sp, record.get("price_mwh", 0), record.get("source"), record.get("timestamp"), len(cache)
    )
    return True


def _get_cached_prices(settlement_point: str) -> List[Dict]:
    return list(_get_cache(settlement_point))


def get_cache_status(settlement_point: str = "HB_HOUSTON") -> Dict[str, Any]:
    """Returns diagnostic info about the real-price cache."""
    cache = _get_cache(settlement_point)
    return {
        "settlement_point": settlement_point,
        "real_readings":    len(cache),
        "oldest":           cache[0]["timestamp"]  if cache else None,
        "newest":           cache[-1]["timestamp"] if cache else None,
        "latest_price":     cache[-1]["price_mwh"] if cache else None,
        "source":           cache[-1].get("source") if cache else None,
    }


# ── ERCOT CDR Scraper ─────────────────────────────────────────────────────────
ERCOT_CDR_URL = "https://www.ercot.com/content/cdr/html/hb_lz.html"
_ERCOT_HEADERS = {
    "User-Agent": "TexasEnergyRiskPlatform/1.0 (informational research tool)",
    "Accept":     "text/html,application/xhtml+xml",
}


def _parse_ercot_cdr(html: str, settlement_point: str) -> Optional[float]:
    pattern = rf'{re.escape(settlement_point)}[^<]*</td>\s*<td[^>]*>\s*([\d.]+)'
    match   = re.search(pattern, html, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    pattern2 = rf'{re.escape(settlement_point)}[^\d\n]*?([\d]+\.[\d]+)'
    match2   = re.search(pattern2, html)
    if match2:
        try:
            return float(match2.group(1))
        except ValueError:
            pass
    return None


def _parse_ercot_timestamp(html: str) -> str:
    m = re.search(r'Last Updated[:\s]+([\w\s,:.]+?)(?:<|\n|$)', html, re.IGNORECASE)
    return m.group(1).strip() if m else datetime.now(timezone.utc).isoformat()


async def fetch_ercot_prices(
    hours: int = 24,
    settlement_point: str = "HB_HOUSTON",
) -> List[Dict[str, Any]]:
    """
    CRITICAL: Returns ONLY real ERCOT prices from the in-memory cache.
    NO mock data is mixed in, ever.

    - If ERCOT_API_ENABLED=false → returns full mock (dev/test only, clearly labeled)
    - If ERCOT_API_ENABLED=true  → fetches CDR, caches new reading, returns real cache only
    - If CDR fetch fails          → returns existing real cache (may be empty)
    """
    enabled = os.getenv("ERCOT_API_ENABLED", "false").lower() == "true"

    if not enabled:
        logger.debug("[ERCOT] API disabled — returning mock data (dev mode)")
        return mock_data.mock_ercot_prices(hours, settlement_point)

    try:
        async with httpx.AsyncClient(timeout=15, headers=_ERCOT_HEADERS) as client:
            r = await client.get(ERCOT_CDR_URL)
            r.raise_for_status()

        live_price = _parse_ercot_cdr(r.text, settlement_point)

        if live_price is None:
            logger.warning("[ERCOT] CDR parse failed — returning existing cache only")
            return _get_cached_prices(settlement_point)

        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        record = {
            "timestamp":        now.isoformat(),
            "settlement_point": settlement_point,
            "price_mwh":        live_price,
            "price_type":       "real_time",
            "source":           "ercot_cdr",
            "cdr_updated":      _parse_ercot_timestamp(r.text),
        }
        added = _cache_price(record)
        cached = _get_cached_prices(settlement_point)

        # Task 7 — Debug logging
        if len(cached) >= 2:
            prev = cached[-2]["price_mwh"]
            logger.info(
                "[SIGNAL DEBUG] prev=%.2f curr=%.2f source=ercot_cdr ts=%s",
                prev, live_price, now.isoformat()
            )
        else:
            logger.info(
                "[SIGNAL DEBUG] curr=%.2f source=ercot_cdr ts=%s (building cache: %d/2 readings)",
                live_price, now.isoformat(), len(cached)
            )

        return cached

    except httpx.RequestError as exc:
        logger.error("[ERCOT] Network error fetching CDR: %s", exc)
        return _get_cached_prices(settlement_point)
    except Exception as exc:
        logger.error("[ERCOT] Unexpected error: %s", exc)
        return _get_cached_prices(settlement_point)


async def fetch_current_ercot_price(
    settlement_point: str = "HB_HOUSTON",
) -> Dict[str, Any]:
    """Single live price snapshot."""
    enabled = os.getenv("ERCOT_API_ENABLED", "false").lower() == "true"
    if not enabled:
        return mock_data.mock_current_ercot_price(settlement_point)

    try:
        async with httpx.AsyncClient(timeout=15, headers=_ERCOT_HEADERS) as client:
            r = await client.get(ERCOT_CDR_URL)
            r.raise_for_status()

        live_price = _parse_ercot_cdr(r.text, settlement_point)
        if live_price is None:
            cache = _get_cached_prices(settlement_point)
            return cache[-1] if cache else {"price_mwh": None, "source": "unavailable"}

        return {
            "timestamp":        datetime.now(timezone.utc).isoformat(),
            "settlement_point": settlement_point,
            "price_mwh":        live_price,
            "price_type":       "real_time",
            "source":           "ercot_cdr",
            "last_updated":     _parse_ercot_timestamp(r.text),
        }
    except Exception:
        cache = _get_cached_prices(settlement_point)
        return cache[-1] if cache else {"price_mwh": None, "source": "unavailable"}


async def fetch_all_hub_prices() -> Dict[str, float]:
    hubs    = ["HB_HOUSTON", "HB_NORTH", "HB_SOUTH", "HB_WEST", "HB_BUSAVG"]
    enabled = os.getenv("ERCOT_API_ENABLED", "false").lower() == "true"
    if not enabled:
        return {h: mock_data.mock_current_ercot_price(h)["price_mwh"] for h in hubs}

    try:
        async with httpx.AsyncClient(timeout=15, headers=_ERCOT_HEADERS) as client:
            r = await client.get(ERCOT_CDR_URL)
            r.raise_for_status()
        return {
            h: (_parse_ercot_cdr(r.text, h) or 0.0) for h in hubs
        }
    except Exception:
        return {h: 0.0 for h in hubs}


# ── NOAA / NWS ────────────────────────────────────────────────────────────────
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
        url    = (
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
    from datetime import datetime, timezone
    periods       = data.get("properties", {}).get("periods", [])
    day_periods   = [p for p in periods if     p.get("isDaytime", True)][:days]
    night_periods = [p for p in periods if not p.get("isDaytime", True)][:days]
    results       = []

    for i, day in enumerate(day_periods):
        night  = night_periods[i] if i < len(night_periods) else {}
        high_f = day.get("temperature", 85)
        low_f  = night.get("temperature", 65) if night else high_f - 20

        demand_risk = (
            "high"   if high_f >= 100 or low_f <= 28 else
            "medium" if high_f >= 90  or low_f <= 38 else
            "low"
        )
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
        url    = "https://api.eia.gov/v2/natural-gas/stor/wkly/data/"
        params = {
            "api_key":             eia_key,
            "frequency":           "weekly",
            "data[0]":             "value",
            "facets[duoarea][]":   "NUS",
            "facets[process][]":   "SAT",
            "sort[0][column]":     "period",
            "sort[0][direction]":  "desc",
            "length":              weeks,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
        result = _transform_eia(r.json(), weeks)
        return result if result else mock_data.mock_gas_data(weeks)
    except Exception:
        return mock_data.mock_gas_data(weeks)


def _transform_eia(data: dict, weeks: int) -> List[Dict[str, Any]]:
    rows    = data.get("response", {}).get("data", [])
    avg_5yr = 2310.0
    results = []

    for row in rows[:weeks]:
        storage  = float(row.get("value", 0))
        pct      = round(((storage - avg_5yr) / avg_5yr) * 100, 2)
        pressure = "low" if pct <= -10 else ("high" if pct >= 5 else "normal")

        results.append({
            "report_date":         row.get("period", ""),
            "storage_bcf":         round(storage / 1000, 1),
            "storage_5yr_avg_bcf": round(avg_5yr, 1),
            "storage_pct_vs_avg":  pct,
            "henry_hub_price":     None,
            "supply_pressure":     pressure,
            "source":              "eia_api",
        })

    return list(reversed(results))
