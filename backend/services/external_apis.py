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
    if not html or len(html) < 100:
        logger.warning("[ERCOT] Response too short (%d chars) -- likely an error page", len(html))
        return None

    # Log a preview for Railway diagnostics
    preview = html[:400].replace("\n", " ").replace("\r", "")
    logger.info("[ERCOT] HTML preview (first 400): %s", preview)

    # Pattern 1: standard CDR table  <td>HB_HOUSTON</td><td>45.23</td>
    p1 = rf'{re.escape(settlement_point)}[^<]*</td>\s*<td[^>]*>\s*([\d]+\.[\d]+)'
    m1 = re.search(p1, html, re.IGNORECASE)
    if m1:
        val = float(m1.group(1))
        if val > 0:
            logger.info("[ERCOT] Pattern1 matched %s = %.2f", settlement_point, val)
            return val

    # Pattern 2: value appears anywhere near the settlement point name
    p2 = rf'{re.escape(settlement_point)}[^0-9\n]{{0,80}}?([\d]{{1,6}}\.[\d]{{2}})'
    m2 = re.search(p2, html, re.IGNORECASE | re.DOTALL)
    if m2:
        val = float(m2.group(1))
        if val > 0.5:          # ignore 0.00 false positives
            logger.info("[ERCOT] Pattern2 matched %s = %.2f", settlement_point, val)
            return val

    # Pattern 3: JSON-style  "HB_HOUSTON": 45.23  or  "price": 45.23 near the name
    p3 = rf'{re.escape(settlement_point)}[^}}]{{0,120}}"(?:price|value|lmp)"[^0-9]{{0,20}}([\d]+\.[\d]+)'
    m3 = re.search(p3, html, re.IGNORECASE | re.DOTALL)
    if m3:
        val = float(m3.group(1))
        if val > 0.5:
            logger.info("[ERCOT] Pattern3 (JSON) matched %s = %.2f", settlement_point, val)
            return val

    logger.warning(
        "[ERCOT] No pattern matched for %s -- HTML snippet: %s",
        settlement_point, html[:300].replace("\n", " ")
    )
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

    - If ERCOT_API_ENABLED=false -> returns full mock (dev/test only, clearly labeled)
    - If ERCOT_API_ENABLED=true  -> fetches CDR, caches new reading, returns real cache only
    - If CDR fetch fails          -> returns existing real cache (may be empty)
    """
    enabled = os.getenv("ERCOT_API_ENABLED", "false").lower() == "true"

    if not enabled:
        logger.debug("[ERCOT] API disabled -- returning mock data (dev mode)")
        return mock_data.mock_ercot_prices(hours, settlement_point)

    try:
        async with httpx.AsyncClient(timeout=15, headers=_ERCOT_HEADERS, follow_redirects=True) as client:
            r = await client.get(ERCOT_CDR_URL)

        logger.info("[ERCOT] CDR response: status=%d content-type=%s length=%d",
                    r.status_code, r.headers.get("content-type", "?"), len(r.text))

        if r.status_code != 200:
            logger.warning("[ERCOT] Non-200 status %d -- returning cache", r.status_code)
            return _get_cached_prices(settlement_point)

        live_price = _parse_ercot_cdr(r.text, settlement_point)

        if live_price is None:
            logger.warning("[ERCOT] CDR parse failed -- returning existing cache only")
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
    """
    Fetch weekly natural gas storage from EIA API v2.
    URL is built as a string -- httpx params dict URL-encodes brackets
    (data[0] -> data%5B0%5D) which EIA does not accept.
    """
    eia_key = os.getenv("EIA_API_KEY", "")
    if not eia_key:
        logger.warning("[EIA] EIA_API_KEY not set")
        return mock_data.mock_gas_data(weeks)

    fetch_n = max(weeks * 2, 16)   # fetch extra; transform filters to weeks
    url = (
        "https://api.eia.gov/v2/natural-gas/stor/wkly/data/"
        f"?api_key={eia_key}"
        "&frequency=weekly"
        "&data[0]=value"
        "&facets[duoarea][]=NUS"
        "&facets[process][]=SAT"
        "&sort[0][column]=period"
        "&sort[0][direction]=desc"
        f"&length={fetch_n}"
    )

    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(url)
            if r.status_code != 200:
                logger.error("[EIA] HTTP %s: %s", r.status_code, r.text[:300])
                # Try alternate process code on second attempt
                if attempt == 0:
                    url = url.replace("process][]=SAT", "process][]=EWG")
                    continue
                return mock_data.mock_gas_data(weeks)
            result = _transform_eia(r.json(), weeks)
            if result:
                logger.info("[EIA] Fetched %d storage records", len(result))
                return result
            logger.warning("[EIA] Empty response body: %s", r.text[:300])
            if attempt == 0:
                url = url.replace("process][]=SAT", "process][]=EWG")
                continue
            return mock_data.mock_gas_data(weeks)
        except Exception as exc:
            logger.error("[EIA] Exception (attempt %d): %s", attempt + 1, exc)

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
