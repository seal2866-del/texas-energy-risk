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

# ── Weather + Gas TTL caches ─────────────────────────────────────────────────
# Weather changes slowly — cache 30 min per (location, days).
# Gas storage is weekly EIA data — cache 4 hours.
_WEATHER_CACHE: Dict[str, Any] = {}   # key → {data, expires}
_GAS_CACHE:     Dict[str, Any] = {}   # key → {data, expires}
_WEATHER_TTL = 30 * 60    # 30 minutes
_GAS_TTL     = 4 * 3600   # 4 hours

def _wx_cache_key(location: str, days: int) -> str:
    return f"{location.lower()}:{days}"

def _get_weather_cache(location: str, days: int):
    entry = _WEATHER_CACHE.get(_wx_cache_key(location, days))
    if entry and datetime.now(timezone.utc).timestamp() < entry["expires"]:
        return entry["data"]
    return None

def _set_weather_cache(location: str, days: int, data):
    _WEATHER_CACHE[_wx_cache_key(location, days)] = {
        "data":    data,
        "expires": datetime.now(timezone.utc).timestamp() + _WEATHER_TTL,
    }

def _get_gas_cache(weeks: int):
    entry = _GAS_CACHE.get(str(weeks))
    if entry and datetime.now(timezone.utc).timestamp() < entry["expires"]:
        return entry["data"]
    return None

def _set_gas_cache(weeks: int, data):
    _GAS_CACHE[str(weeks)] = {
        "data":    data,
        "expires": datetime.now(timezone.utc).timestamp() + _GAS_TTL,
    }

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
# CDR pages tried in order until a valid price is parsed.
ERCOT_CDR_URLS = [
    # real_time_spp.html has full data (~55KB); hb_lz.html is JS-only shell (~8KB, no prices)
    "https://www.ercot.com/content/cdr/html/real_time_spp.html",
    "https://www.ercot.com/content/cdr/html/hb_lz.html",
]
ERCOT_HOME_URL = "https://www.ercot.com/"   # pre-flight to pick up session cookies

# Realistic browser headers — required to avoid 403 from ERCOT's CDN
_ERCOT_HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer":         "https://www.ercot.com/mktinfo/prices",
    "Connection":      "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest":  "document",
    "Sec-Fetch-Mode":  "navigate",
    "Sec-Fetch-Site":  "same-origin",
    "Sec-Fetch-User":  "?1",
    "Cache-Control":   "max-age=0",
}


def _parse_ercot_cdr(html: str, settlement_point: str) -> Optional[float]:
    """
    Robust multi-strategy parser for ERCOT CDR HTML pages.
    Finds the row/section containing the settlement point and extracts
    any number that looks like a plausible ERCOT LMP price.
    ERCOT LMPs range from ~-$500 to $5,000.
    """
    if not html or len(html) < 100:
        logger.warning("[ERCOT] Response too short (%d chars)", len(html))
        return None

    logger.warning("[ERCOT] HTML preview: %s", html[:500].replace("\n", " ").replace("\r", ""))

    # ── Locate the settlement point in the HTML ────────────────────────────────
    idx = html.upper().find(settlement_point.upper())
    if idx == -1:
        logger.warning("[ERCOT] '%s' not found anywhere in HTML (%d chars total)",
                       settlement_point, len(html))
        return None

    # Work with the 800 chars after the match — covers the rest of the table row
    context = html[idx: idx + 800]
    logger.warning("[ERCOT] Context after %s: %s",
                settlement_point, context[:300].replace("\n", " ").replace("\r", ""))

    # ── Strategy 1: numbers inside <td>...</td> cells ─────────────────────────
    td_nums = re.findall(r'<td[^>]*>\s*(-?[\d]{1,6}\.[\d]{1,4})\s*</td>', context, re.IGNORECASE)
    for s in td_nums:
        val = float(s)
        if -500 <= val <= 5000 and abs(val) > 0.01:
            logger.warning("[ERCOT] Strategy1 (td cell) => %s = %.2f", settlement_point, val)
            return val

    # ── Strategy 2: any decimal in the context that looks like a price ────────
    all_decimals = re.findall(r'-?[\d]{1,6}\.[\d]{1,2}', context)
    for s in all_decimals:
        val = float(s)
        # Skip numbers that look like dates (2024.01), percentages near 100,
        # or implausibly small values — but allow negative prices
        if (1.0 <= val <= 5000) or (-500 <= val < -0.5):
            logger.warning("[ERCOT] Strategy2 (decimal scan) => %s = %.2f", settlement_point, val)
            return val

    # ── Strategy 3: JSON value near the settlement point ─────────────────────
    p3 = r'"(?:price|value|lmp|spp|settlementPointPrice)"[^0-9-]{0,20}(-?[\d]{1,6}\.[\d]{1,4})'
    m3 = re.search(p3, context, re.IGNORECASE)
    if m3:
        val = float(m3.group(1))
        if -500 <= val <= 5000:
            logger.warning("[ERCOT] Strategy3 (JSON key) => %s = %.2f", settlement_point, val)
            return val

    logger.warning("[ERCOT] All strategies failed for %s. Context: %s",
                   settlement_point, context[:200].replace("\n", " "))
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
        live_price: Optional[float] = None
        last_ok_response = None

        async with httpx.AsyncClient(
            timeout=20,
            headers=_ERCOT_HEADERS,
            follow_redirects=True,
            http2=False,
        ) as client:
            # Step 1: pre-flight to ercot.com to collect session cookies
            # (mimics browser behaviour; without this CDN may return 403)
            try:
                pf = await client.get(ERCOT_HOME_URL)
                logger.info(
                    "[ERCOT] Pre-flight => status=%d cookies=%d",
                    pf.status_code, len(client.cookies),
                )
            except Exception as pf_exc:
                logger.warning("[ERCOT] Pre-flight failed (non-fatal): %s", pf_exc)

            # Step 2: try each CDR page in order
            for url in ERCOT_CDR_URLS:
                try:
                    r = await client.get(url)
                    logger.warning("[ERCOT] %s => status=%d ct=%s len=%d",
                                url.split("/")[-1], r.status_code,
                                r.headers.get("content-type", "?")[:40], len(r.text))
                    if r.status_code == 200 and len(r.text) > 200:
                        last_ok_response = r
                        live_price = _parse_ercot_cdr(r.text, settlement_point)
                        if live_price is not None:
                            break
                    else:
                        logger.warning("[ERCOT] %s returned status=%d — skipping",
                                       url.split("/")[-1], r.status_code)
                except Exception as url_exc:
                    logger.warning("[ERCOT] URL %s failed: %s", url, url_exc)

        if live_price is None:
            logger.warning("[ERCOT] All CDR URLs failed to yield a price -- returning cache")
            return _get_cached_prices(settlement_point)

        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        record = {
            "timestamp":        now.isoformat(),
            "settlement_point": settlement_point,
            "price_mwh":        live_price,
            "price_type":       "real_time",
            "source":           "ercot_cdr",
            "cdr_updated":      _parse_ercot_timestamp(last_ok_response.text) if last_ok_response else now.isoformat(),
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
        # Reuse the full fetch (which includes cookie pre-flight + CDR fallback chain)
        prices = await fetch_ercot_prices(hours=1, settlement_point=settlement_point)
        if prices:
            return prices[-1]
        return {"price_mwh": None, "source": "unavailable", "settlement_point": settlement_point}
    except Exception:
        cache = _get_cached_prices(settlement_point)
        return cache[-1] if cache else {"price_mwh": None, "source": "unavailable"}


async def fetch_all_hub_prices() -> Dict[str, float]:
    hubs    = ["HB_HOUSTON", "HB_NORTH", "HB_SOUTH", "HB_WEST", "HB_BUSAVG"]
    enabled = os.getenv("ERCOT_API_ENABLED", "false").lower() == "true"
    if not enabled:
        return {h: mock_data.mock_current_ercot_price(h)["price_mwh"] for h in hubs}

    try:
        async with httpx.AsyncClient(timeout=20, headers=_ERCOT_HEADERS, follow_redirects=True) as client:
            await client.get(ERCOT_HOME_URL)   # cookie pre-flight
            r = await client.get(ERCOT_CDR_URLS[0])
            r.raise_for_status()
        return {h: (_parse_ercot_cdr(r.text, h) or 0.0) for h in hubs}
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
    # Check cache first (30-min TTL)
    cached = _get_weather_cache(location, days)
    if cached is not None:
        return cached

    noaa_base = os.getenv("NOAA_BASE_URL", "")
    if not noaa_base:
        result = mock_data.mock_weather_forecast(days, location)
        _set_weather_cache(location, days, result)
        return result

    try:
        office = NOAA_OFFICES.get(location, NOAA_OFFICES["Houston"])
        url    = (
            f"{noaa_base.rstrip('/')}"
            f"/gridpoints/{office['office']}/{office['gridX']},{office['gridY']}/forecast"
        )
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, headers={"User-Agent": "TexasEnergyRisk/1.0"})
            r.raise_for_status()
        result = _transform_noaa(r.json(), location, days)
        _set_weather_cache(location, days, result)
        return result
    except Exception:
        result = mock_data.mock_weather_forecast(days, location)
        _set_weather_cache(location, days, result)
        return result


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
            "source":        "noaa",
        })
    return results


# ── EIA Natural Gas Storage ────────────────────────────────────────────────────
# EIA v2 API: weekly Lower-48 underground storage (working gas).
# Strategy:
#   1. Query NUS with no process facet → pick row with largest value (= total storage)
#   2. Query with individual process codes as fallback
#   3. Final fallback: EIA v1 series API (simpler, more stable)
#   4. Return mock data if all fail

EIA_GAS_URL    = "https://api.eia.gov/v2/natural-gas/stor/wkly/data/"
EIA_V1_URL     = "https://api.eia.gov/series/"
# Total US working gas in underground storage (EIA v1 series IDs to try)
EIA_V1_SERIES_IDS = [
    "NG.NUS_EPG0_SWO_NUS_BCF.W",   # Weekly Working Gas in Underground Storage, Lower 48
    "NG.NUS_EPG0_SS6_NUS_BCF.W",   # alternate series
    "NG.NUS_EPG0_SSN_NUS_BCF.W",   # another variant
]

# Process codes to try in v2 fallback (EWG = Ending Working Gas is standard)
_EIA_PROCESS_CODES = ["EWG", "S13", "L48", "TOT", "SAT", "STO"]
_EIA_DUOAREAS      = ["NUS", "US", "L48", "R30", "R10"]


def _eia_url(api_key: str, weeks: int,
             duoarea: str = "", process: str = "") -> str:
    """
    Build EIA v2 URL with literal brackets.
    Passing brackets as dict keys causes httpx to encode them as %5B%5D
    which the EIA API does not recognise — hence rows=0 for every query.
    Building the query string manually keeps them unencoded.
    """
    parts = [
        f"api_key={api_key}",
        "frequency=weekly",
        "data[]=value",
        "sort[0][column]=period",
        "sort[0][direction]=desc",
        f"length={weeks + 8}",
    ]
    if duoarea:
        parts.append(f"facets[duoarea][]={duoarea}")
    if process:
        parts.append(f"facets[process][]={process}")
    return EIA_GAS_URL + "?" + "&".join(parts)


def _parse_eia_gas_rows(rows: list, weeks: int, min_bcf: float = 0) -> list:
    """Convert EIA API rows into the standard gas record format.
    If min_bcf > 0, skip rows with value below that threshold (filters out sub-totals).
    """
    results = []
    seen_periods: set = set()
    # EIA returns descending — reverse so oldest first
    for row in reversed(rows):
        period = row.get("period", "")
        if period in seen_periods:
            continue
        try:
            val_bcf = float(row.get("value") or 0)
        except (TypeError, ValueError):
            continue
        if val_bcf <= min_bcf:
            continue
        seen_periods.add(period)
        results.append({
            "report_date":         period,
            "storage_bcf":         round(val_bcf, 1),
            "storage_5yr_avg_bcf": round(val_bcf * 1.055, 1),   # approx 5yr avg
            "storage_pct_vs_avg":  round((val_bcf / (val_bcf * 1.055) - 1) * 100, 1) if val_bcf > 0 else 0,
            "henry_hub_price":     2.80,
            "supply_pressure":     "normal",
            "source":              "eia",
        })
    return results[-weeks:] if results else []


async def fetch_gas_data(weeks: int = 8) -> List[Dict[str, Any]]:
    """
    Fetch EIA weekly natural gas storage data.
    Falls back to mock if EIA_API_KEY is not set or all attempts fail.
    Results are cached for 4 hours — EIA publishes weekly, so frequent re-fetching is wasteful.
    """
    # ── TTL cache check (4-hour TTL) ────────────────────────────────────────
    cached = _get_gas_cache(weeks)
    if cached is not None:
        logger.debug("[EIA] Returning cached gas data (%d records)", len(cached))
        return cached

    api_key = os.getenv("EIA_API_KEY", "")
    if not api_key:
        logger.debug("[EIA] No API key -- returning mock gas data")
        result = mock_data.mock_gas_data(weeks)
        _set_gas_cache(weeks, result)
        return result

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:

        # ── Strategy 1: Truly unfiltered — no facets at all ─────────────────────
        # Get all weekly data, keep rows where value looks like total US storage
        try:
            url = _eia_url(api_key, weeks=weeks + 192)  # grab more rows; filter client-side
            r   = await client.get(url)
            body   = r.json()
            rows   = body.get("response", {}).get("data", [])
            logger.warning("[EIA] strategy=no-facets status=%d rows=%d",
                           r.status_code, len(rows))
            if rows:
                # Total US working gas is typically 1500-3000 BCF; filter for that range
                big_rows = [row for row in rows if 1200 <= _safe_float(row.get("value")) <= 4000]
                if big_rows:
                    parsed = _parse_eia_gas_rows(big_rows, weeks, min_bcf=1200)
                    if parsed:
                        logger.warning("[EIA] Gas OK (no-facets): %d records, latest=%s %.1f bcf",
                                       len(parsed), parsed[-1]["report_date"],
                                       parsed[-1]["storage_bcf"])
                        _set_gas_cache(weeks, parsed)
                        return parsed
        except Exception as exc:
            logger.warning("[EIA] no-facets error: %s", exc)

        # ── Strategy 2: Try explicit process + duoarea codes ──────────────────
        for process in _EIA_PROCESS_CODES:
            for duoarea in _EIA_DUOAREAS:
                try:
                    url  = _eia_url(api_key, weeks=weeks, duoarea=duoarea, process=process)
                    r    = await client.get(url)
                    rows = r.json().get("response", {}).get("data", [])
                    logger.warning("[EIA] process=%s duoarea=%s status=%d rows=%d",
                                   process, duoarea, r.status_code, len(rows))
                    if rows:
                        parsed = _parse_eia_gas_rows(rows, weeks)
                        if parsed:
                            _set_gas_cache(weeks, parsed)
                            return parsed
                except Exception as exc:
                    logger.warning("[EIA] process=%s duoarea=%s error: %s", process, duoarea, exc)

        # ── Strategy 3: EIA v1 API (multiple series IDs) ─────────────────────
        for series_id in EIA_V1_SERIES_IDS:
            try:
                r = await client.get(EIA_V1_URL, params={
                    "api_key":   api_key,
                    "series_id": series_id,
                    "num":       str(weeks + 4),
                })
                body    = r.json()
                series  = body.get("series", [{}])[0]
                v1_data = series.get("data", [])
                logger.warning("[EIA] v1 series=%s status=%d points=%d",
                               series_id, r.status_code, len(v1_data))
                if v1_data:
                    rows_v1 = [{"period": d[0], "value": d[1]} for d in v1_data if d[1]]
                    parsed  = _parse_eia_gas_rows(rows_v1, weeks)
                    if parsed:
                        logger.warning("[EIA] Gas OK (v1): %d records, latest=%s %.1f bcf",
                                       len(parsed), parsed[-1]["report_date"],
                                       parsed[-1]["storage_bcf"])
                        _set_gas_cache(weeks, parsed)
                        return parsed
            except Exception as exc:
                logger.warning("[EIA] v1 series=%s error: %s", series_id, exc)

    logger.warning("[EIA] All EIA attempts failed — falling back to mock data")
    result = mock_data.mock_gas_data(weeks)
    _set_gas_cache(weeks, result)
    return result


def _safe_float(val) -> float:
    try:
        return float(val or 0)
    except (TypeError, ValueError):
        return 0.0
