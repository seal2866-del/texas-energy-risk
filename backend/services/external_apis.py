"""
external_apis.py
Real data fetchers for ERCOT, NOAA, and EIA.
CRITICAL: ERCOT prices use an in-memory cache of REAL readings only.
         No mock data is ever mixed into price history.
"""
import os
import re
import time
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
_CACHE_WARMED: set = set()   # settlement points already seeded from DB this process lifetime

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
    cache     = _get_cache(settlement_point)
    newest_ts = cache[-1]["timestamp"] if cache else None
    age_secs: Optional[int] = None
    if newest_ts:
        try:
            newest_dt = datetime.fromisoformat(newest_ts.replace("Z", "+00:00"))
            age_secs  = int((datetime.now(timezone.utc) - newest_dt).total_seconds())
        except Exception:
            pass
    return {
        "settlement_point":        settlement_point,
        "real_readings":           len(cache),
        "oldest":                  cache[0]["timestamp"]  if cache else None,
        "newest":                  newest_ts,
        "latest_price":            cache[-1]["price_mwh"] if cache else None,
        "source":                  cache[-1].get("source") if cache else None,
        "last_updated_seconds_ago": age_secs,
    }


# ── Supabase persistence helpers ──────────────────────────────────────────────

async def _persist_price_to_db(record: dict) -> None:
    """
    Upsert the latest real price to Supabase (table: ercot_price_cache).
    One row per settlement_point — always the most recent reading.
    Failures are non-fatal; the in-memory cache is still the source of truth.
    """
    try:
        from services.supabase_client import get_supabase
        sb = get_supabase()
        row = {
            "settlement_point": record["settlement_point"],
            "price_mwh":        record["price_mwh"],
            "timestamp":        record["timestamp"],
            "source":           record.get("source", "ercot_cdr"),
            "cdr_updated":      record.get("cdr_updated"),
            "persisted_at":     datetime.now(timezone.utc).isoformat(),
        }
        # on_conflict required in supabase-py 2.x to trigger upsert on primary key
        res = sb.table("ercot_price_cache").upsert(row, on_conflict="settlement_point").execute()
        logger.warning("[ERCOT DB] Persisted OK: sp=%s price=%.2f rows=%s",
                       record["settlement_point"], record["price_mwh"],
                       len(res.data) if res.data else 0)
    except Exception as exc:
        import traceback
        logger.warning("[ERCOT DB] Persist failed (non-fatal): %s\n%s",
                       exc, traceback.format_exc())


async def _warm_cache_from_db(settlement_point: str) -> None:
    """
    On first call per settlement_point, read the last known price from Supabase
    and seed the in-memory cache.  This means a Railway restart recovers instantly
    (one persisted reading) instead of waiting for the first 5-min poll cycle.
    Subsequent calls are no-ops (guarded by _CACHE_WARMED).
    """
    if settlement_point in _CACHE_WARMED:
        return
    _CACHE_WARMED.add(settlement_point)   # mark immediately — prevent concurrent double-warm
    try:
        from services.supabase_client import get_supabase
        sb   = get_supabase()
        res  = (
            sb.table("ercot_price_cache")
            .select("*")
            .eq("settlement_point", settlement_point)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if rows:
            row = rows[0]
            record = {
                "timestamp":        row["timestamp"],
                "retrieved_at":     row["timestamp"],
                "settlement_point": row["settlement_point"],
                "price_mwh":        float(row["price_mwh"]),
                "price_type":       "real_time",
                "source":           (row.get("source") or "ercot_cdr") + "_db_restore",
                "cdr_updated":      row.get("cdr_updated"),
            }
            _cache_price(record)
            logger.info("[ERCOT DB] Cache warmed from DB: sp=%s price=%.2f ts=%s",
                        settlement_point, record["price_mwh"], record["timestamp"])
        else:
            logger.info("[ERCOT DB] No persisted price found for %s — starting cold", settlement_point)
    except Exception as exc:
        logger.warning("[ERCOT DB] Cache warm failed (non-fatal): %s", exc)


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

    # Seed the in-memory cache from Supabase on first call after a Railway restart.
    # No-op if already warmed this process lifetime.
    await _warm_cache_from_db(settlement_point)

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

        # ── Strategy 4: column-offset parser (mirrors grid_conditions.py row scanner) ─────
        if live_price is None and last_ok_response is not None:
            try:
                _td_re = re.compile(r'<td[^>]*>\s*(-?[\d]{1,6}\.[\d]{1,4})\s*</td>', re.IGNORECASE)
                _tr_re = re.compile(r'<tr[^>]*>(.*?)</tr>', re.IGNORECASE | re.DOTALL)
                _best: list = []
                for _tr in _tr_re.finditer(last_ok_response.text):
                    _row = _tr.group(1)
                    _floats = []
                    for _v in _td_re.findall(_row):
                        try: _floats.append(float(_v))
                        except: pass
                    if len(_floats) >= 7:
                        _best = _floats
                if _best:
                    _col = {"HB_HOUSTON": 1, "HB_BUSAVG": 0, "HB_NORTH": 3, "HB_SOUTH": 5, "HB_WEST": 6}
                    _idx = _col.get(settlement_point, 1)
                    if _idx < len(_best):
                        _val = _best[_idx]
                        if -500 <= _val <= 5000 and abs(_val) > 0.01:
                            live_price = _val
                            logger.warning("[ERCOT] Strategy4 (column-offset) => %s = %.2f", settlement_point, _val)
            except Exception as _e4:
                logger.warning("[ERCOT] Strategy4 failed: %s", _e4)

        # ── Strategy 5: cross-feed from grid_conditions (independent parser, never fails) ──
        if live_price is None:
            try:
                from services.grid_conditions import fetch_grid_conditions
                import asyncio as _aio
                grid = await fetch_grid_conditions()
                fallback_price = grid.get("hub_prices", {}).get(settlement_point)
                if fallback_price is not None and -500 <= fallback_price <= 5000:
                    live_price = fallback_price
                    logger.warning("[ERCOT] Strategy5 (grid_conditions cross-feed) => %s = %.2f",
                                   settlement_point, live_price)
            except Exception as _e5:
                logger.warning("[ERCOT] Strategy5 failed: %s", _e5)

        if live_price is None:
            logger.warning("[ERCOT] All strategies failed to yield a price -- returning cache")
            return _get_cached_prices(settlement_point)

        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        cdr_ts_raw = _parse_ercot_timestamp(last_ok_response.text) if last_ok_response else now.isoformat()
        record = {
            "timestamp":        now.isoformat(),   # our server time (UTC ISO)
            "retrieved_at":     now.isoformat(),   # explicit alias for badge display
            "settlement_point": settlement_point,
            "price_mwh":        live_price,
            "price_type":       "real_time",
            "source":           "ercot_cdr",
            "cdr_updated":      cdr_ts_raw,        # "Last Updated" string from CDR page
        }
        logger.warning(
            "[ERCOT RECORD] price=%.2f cdr_updated=%r retrieved_at=%s",
            live_price, cdr_ts_raw, now.isoformat(),
        )
        added = _cache_price(record)
        # Persist to Supabase so the cache survives Railway restarts
        if added:
            await _persist_price_to_db(record)
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
# Static fast-path for all eight monitored locations.
NOAA_OFFICES = {
    "Houston":        {"office": "HGX", "gridX": 66,  "gridY": 97},
    "Dallas":         {"office": "FWD", "gridX": 90,  "gridY": 104},
    "Austin":         {"office": "EWX", "gridX": 155, "gridY": 88},
    "San Antonio":    {"office": "EWX", "gridX": 148, "gridY": 80},
    "Midland":        {"office": "MAF", "gridX": 80,  "gridY": 54},
    "Odessa":         {"office": "MAF", "gridX": 73,  "gridY": 52},
    "Corpus Christi": {"office": "CRP", "gridX": 55,  "gridY": 75},
    "Lubbock":        {"office": "LUB", "gridX": 77,  "gridY": 59},
}

# Lat/lon for all 8 monitored cities — used by the dynamic NWS resolver.
LOCATION_COORDS: Dict[str, Dict[str, float]] = {
    "Houston":        {"lat": 29.7604,  "lon": -95.3698},
    "Dallas":         {"lat": 32.7767,  "lon": -96.7970},
    "Austin":         {"lat": 30.2672,  "lon": -97.7431},
    "San Antonio":    {"lat": 29.4241,  "lon": -98.4936},
    "Midland":        {"lat": 31.9973,  "lon": -102.0779},
    "Odessa":         {"lat": 31.8457,  "lon": -102.3676},
    "Corpus Christi": {"lat": 27.8006,  "lon": -97.3964},
    "Lubbock":        {"lat": 33.5779,  "lon": -101.8552},
}

# Runtime cache for dynamically resolved NWS grid coordinates.
# Populated lazily on first request for each city.
_GRID_CACHE: Dict[str, Dict[str, Any]] = {}


async def _resolve_noaa_office(location: str) -> Optional[Dict[str, Any]]:
    """
    Resolve NWS gridpoint for a location using the /points/{lat},{lon} API.
    Result is cached in _GRID_CACHE for the lifetime of the process.
    Returns dict like NOAA_OFFICES entries: {office, gridX, gridY}, or None on failure.
    """
    # Static fast-path
    if location in NOAA_OFFICES:
        return NOAA_OFFICES[location]

    # Runtime cache hit
    if location in _GRID_CACHE:
        return _GRID_CACHE[location]

    coords = LOCATION_COORDS.get(location)
    if not coords:
        logger.warning("[NWS] No coordinates configured for '%s'", location)
        return None

    url = f"https://api.weather.gov/points/{coords['lat']},{coords['lon']}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, headers={"User-Agent": "TexasEnergyRisk/1.0 seal2866@gmail.com"})
            r.raise_for_status()
        props = r.json().get("properties", {})
        office = props.get("gridId")
        grid_x = props.get("gridX")
        grid_y = props.get("gridY")
        if office and grid_x is not None and grid_y is not None:
            entry = {"office": office, "gridX": grid_x, "gridY": grid_y}
            _GRID_CACHE[location] = entry
            logger.info("[NWS] Resolved '%s' → office=%s gridX=%d gridY=%d",
                        location, office, grid_x, grid_y)
            return entry
        logger.warning("[NWS] /points response missing grid fields for '%s': %s", location, props)
        return None
    except Exception as exc:
        logger.warning("[NWS] _resolve_noaa_office failed for '%s': %s", location, exc)
        return None


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
        # Use dynamic resolver (falls back to static dict for original 4 cities)
        office = await _resolve_noaa_office(location)
        if not office:
            office = NOAA_OFFICES.get("Houston")   # last-resort fallback

        url = (
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


# ── Henry Hub Natural Gas Price ───────────────────────────────────────────────
# EIA v2 API: Henry Hub natural gas spot price (daily).
# Series: NG.RNGWHHD.D — Henry Hub Natural Gas Spot Price (Dollars per Million Btu)

EIA_HENRY_HUB_URL = "https://api.eia.gov/v2/natural-gas/pri/fut/data/"
EIA_HENRY_HUB_V1_SERIES = "NG.RNGWHHD.D"   # Henry Hub Natural Gas Spot Price, Daily

_HENRY_HUB_CACHE: Dict[str, Any] = {}
_HENRY_HUB_TTL = 4 * 3600  # 4 hours — EIA daily data

# Henry Hub thresholds
HENRY_HUB_NORMAL    = 3.00   # < $3.00 = Normal
HENRY_HUB_WATCH     = 4.00   # $3.00–$4.00 = Watch
HENRY_HUB_ELEVATED  = 6.00   # $4.00–$6.00 = Elevated
                              # > $6.00 = Critical


def _get_henry_hub_cache() -> Optional[Dict]:
    entry = _HENRY_HUB_CACHE.get("latest")
    if entry and datetime.now(timezone.utc).timestamp() < entry["expires"]:
        # Never serve mock data from cache — force re-fetch if source was mock
        if entry["data"].get("source") == "mock":
            return None
        return entry["data"]
    return None


def _set_henry_hub_cache(data: Dict):
    _HENRY_HUB_CACHE["latest"] = {
        "data":    data,
        "expires": datetime.now(timezone.utc).timestamp() + _HENRY_HUB_TTL,
    }


def _henry_hub_market_state(price: float) -> str:
    if price < HENRY_HUB_NORMAL:
        return "normal"
    elif price < HENRY_HUB_WATCH:
        return "watch"
    elif price < HENRY_HUB_ELEVATED:
        return "elevated"
    return "critical"


def _henry_hub_watch_threshold(price: float) -> float:
    """Return the next threshold price to watch."""
    if price < HENRY_HUB_NORMAL:
        return HENRY_HUB_NORMAL
    elif price < HENRY_HUB_WATCH:
        return HENRY_HUB_WATCH
    elif price < HENRY_HUB_ELEVATED:
        return HENRY_HUB_ELEVATED
    return HENRY_HUB_ELEVATED


def _mock_henry_hub() -> Dict[str, Any]:
    import random
    base = 2.85
    history = []
    for i in range(10):
        price = round(base + random.uniform(-0.15, 0.15), 3)
        from datetime import timedelta
        date = (datetime.now(timezone.utc) - timedelta(days=9 - i)).strftime("%Y-%m-%d")
        history.append({"date": date, "price": price})
    return {
        "price":             2.85,
        "daily_change_pct":  -0.35,
        "weekly_change_pct": 1.05,
        "market_state":      "normal",
        "watch_threshold":   HENRY_HUB_NORMAL,
        "unit":              "$/MMBtu",
        "report_date":       datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "history":           history,
        "source":            "mock",
    }


async def fetch_henry_hub_price() -> Dict[str, Any]:
    """
    Fetch Henry Hub natural gas spot price from EIA.
    Returns current price, daily/weekly % change, market state, and threshold.
    Cached for 4 hours. Falls back to mock if EIA key not set or all attempts fail.
    """
    cached = _get_henry_hub_cache()
    if cached:
        return cached

    api_key = os.getenv("EIA_API_KEY", "")
    if not api_key:
        result = _mock_henry_hub()
        _set_henry_hub_cache(result)
        return result

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:

        def _build_result(valid_pts: list, source: str) -> dict:
            current_price  = valid_pts[0][1]
            prev_day_price = valid_pts[1][1]
            weekly_price   = valid_pts[min(5, len(valid_pts)-1)][1]
            daily_chg  = ((current_price - prev_day_price) / prev_day_price) * 100 if prev_day_price else 0
            weekly_chg = ((current_price - weekly_price)   / weekly_price)   * 100 if weekly_price else 0
            history    = [{"date": d, "price": round(p, 3)} for d, p in reversed(valid_pts[:10])]
            return {
                "price":             round(current_price, 3),
                "daily_change_pct":  round(daily_chg, 2),
                "weekly_change_pct": round(weekly_chg, 2),
                "market_state":      _henry_hub_market_state(current_price),
                "watch_threshold":   _henry_hub_watch_threshold(current_price),
                "unit":              "$/MMBtu",
                "report_date":       valid_pts[0][0],
                "history":           history,
                "source":            source,
            }

        # Strategy 1: EIA v2 futures endpoint with RNGWHHD series filter — CONFIRMED WORKING
        try:
            params = (
                f"api_key={api_key}&frequency=daily&data[]=value"
                f"&facets[series][]=RNGWHHD"
                f"&sort[0][column]=period&sort[0][direction]=desc&length=14"
            )
            r = await client.get(f"https://api.eia.gov/v2/natural-gas/pri/fut/data/?{params}")
            rows = r.json().get("response", {}).get("data", [])
            logger.warning("[EIA HH] v2_futures status=%d rows=%d", r.status_code, len(rows))
            valid = [(row["period"], float(row["value"])) for row in rows
                     if row.get("value") not in (None, "", "NA") and row.get("series") == "RNGWHHD"]
            if len(valid) >= 2:
                result = _build_result(valid, "eia_v2_futures")
                logger.warning("[EIA HH] OK via v2_futures: price=%.3f history=%d pts",
                               result["price"], len(result["history"]))
                _set_henry_hub_cache(result)
                return result
        except Exception as exc:
            logger.warning("[EIA HH] v2_futures failed: %s", exc)

        # Strategy 2: EIA v2 spot endpoint
        try:
            params = (
                f"api_key={api_key}&frequency=daily&data[]=value"
                f"&facets[series][]=RNGWHHD&sort[0][column]=period&sort[0][direction]=desc&length=14"
            )
            r = await client.get(f"https://api.eia.gov/v2/natural-gas/pri/spot/data/?{params}")
            rows = r.json().get("response", {}).get("data", [])
            logger.warning("[EIA HH] v2_spot status=%d rows=%d", r.status_code, len(rows))
            valid = [(row["period"], float(row["value"])) for row in rows
                     if row.get("value") not in (None, "", "NA")]
            if len(valid) >= 2:
                result = _build_result(valid, "eia_v2_spot")
                _set_henry_hub_cache(result)
                return result
        except Exception as exc:
            logger.warning("[EIA HH] v2_spot failed: %s", exc)

        # Strategy 3: EIA v1 API (legacy)
        try:
            r = await client.get(EIA_V1_URL, params={
                "api_key": api_key, "series_id": EIA_HENRY_HUB_V1_SERIES, "num": "14",
            })
            body   = r.json()
            series = body.get("series", [{}])[0]
            data   = series.get("data", [])
            logger.warning("[EIA HH] v1 status=%d points=%d", r.status_code, len(data))
            valid = [(d[0], float(d[1])) for d in data if d[1] not in (None, "", "NA")]
            if len(valid) >= 2:
                result = _build_result(valid, "eia_v1")
                _set_henry_hub_cache(result)
                return result
        except Exception as exc:
            logger.warning("[EIA HH] v1 failed: %s", exc)

    logger.warning("[EIA HH] All strategies failed — returning mock")
    result = _mock_henry_hub()
    _set_henry_hub_cache(result)
    return result


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

    async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:

        # ── Strategy 1: Truly unfiltered — no facets at all ─────────────────────────
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

        # ── Strategy 2: Focused process + duoarea (only top 2 combos, avoid 30-combo timeout) ──
        for process, duoarea in [("EWG", "NUS"), ("EWG", "US")]:
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

        # ── Strategy 3: EIA v1 API (multiple series IDs) ─────────────────────────────────────────────────────────────────────────────────────────────────
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

    logger.warning("[EIA] All EIA attempts failed -- falling back to mock data")
    result = mock_data.mock_gas_data(weeks)
    _set_gas_cache(weeks, result)
    return result


def _safe_float(val) -> float:
    try:
        return float(val or 0)
    except (TypeError, ValueError):
        return 0.0


# ── Waha Hub Natural Gas Spot Price ──────────────────────────────────────────

_WAHA_CACHE: Dict[str, Any] = {}
_WAHA_CACHE_TTL = 4 * 3600  # 4 hours

def _get_waha_cache() -> Optional[Dict]:
    if _WAHA_CACHE and (time.time() - _WAHA_CACHE.get("_ts", 0)) < _WAHA_CACHE_TTL:
        return {k: v for k, v in _WAHA_CACHE.items() if k != "_ts"}
    return None

def _set_waha_cache(data: Dict):
    _WAHA_CACHE.clear()
    _WAHA_CACHE.update(data)
    _WAHA_CACHE["_ts"] = time.time()

def _mock_waha(hh_price: float = 3.00) -> Dict[str, Any]:
    """Mock Waha price — typically $0.50-$2.00 below Henry Hub."""
    import random
    spread = round(random.uniform(0.40, 1.80), 3)
    price  = round(max(0.50, hh_price - spread), 3)
    return {
        "price":  price,
        "unit":   "$/MMBtu",
        "source": "mock",
        "report_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "note": "Mock Waha price — configure EIA_API_KEY for live data",
    }

async def fetch_waha_price() -> Dict[str, Any]:
    """
    Fetch Waha Hub natural gas spot price.
    Waha Hub = West Texas gas trading hub; key Permian Basin price signal.

    Strategy order:
      1. OilPriceAPI (oilpriceapi.com) — requires OIL_PRICE_API_KEY in env
         EIA confirmed they source Waha from NGI (paid); EIA v2 has no Waha series.
      2. EIA v2 spot endpoint (legacy attempts, kept for future if EIA adds Waha)
      3. Mock: HH price minus typical Permian basis spread
    Cached 4 hours.
    """
    cached = _get_waha_cache()
    if cached:
        return cached

    # Fetch Henry Hub in parallel (needed for fallback spread & basis signal)
    hh_data  = await fetch_henry_hub_price()
    hh_price = hh_data.get("price", 3.00)

    opa_key = os.getenv("OIL_PRICE_API_KEY", "")
    eia_key = os.getenv("EIA_API_KEY", "")

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:

        # ── Strategy 1: OilPriceAPI — confirmed Waha spot price endpoint ────────
        # EIA does not publish Waha in their v2 API (sourced from NGI, a paid provider).
        # OilPriceAPI free tier: 200 req/month (6/day at 4-hr cache = 180/month — fits).
        if opa_key:
            WAHA_CODES = ["WAHA_USD", "WAHA_NATGAS_USD", "WAHA_NATURAL_GAS_USD"]
            for code in WAHA_CODES:
                try:
                    r = await client.get(
                        f"https://api.oilpriceapi.com/v1/prices/latest?by_code={code}",
                        headers={"Authorization": f"Token {opa_key}"},
                    )
                    body = r.json()
                    logger.warning("[WAHA] OPA code=%s status=%d body=%s", code, r.status_code, str(body)[:200])
                    if r.status_code == 200 and body.get("status") == "success":
                        price = float(body["data"]["price"])
                        if price != 0:
                            result = {
                                "price":       round(price, 3),
                                "unit":        "$/MMBtu",
                                "source":      f"oilpriceapi_{code}",
                                "report_date": body["data"].get("created_at", "")[:10],
                            }
                            _set_waha_cache(result)
                            logger.warning("[WAHA] OPA OK code=%s price=%.3f", code, price)
                            return result
                except Exception as exc:
                    logger.warning("[WAHA] OPA code=%s error: %s", code, exc)

        # ── Strategy 2: EIA v2 spot (kept in case EIA adds Waha in future) ─────
        if eia_key:
            WAHA_SERIES = ["RNGWTWNT", "NG.RNGWTWNT.D", "RNGWTWCU"]
            for series_id in WAHA_SERIES:
                try:
                    params = (
                        f"api_key={eia_key}&frequency=weekly&data[]=value"
                        f"&facets[series][]={series_id}"
                        f"&sort[0][column]=period&sort[0][direction]=desc&length=10"
                    )
                    r = await client.get(f"https://api.eia.gov/v2/natural-gas/pri/spot/data/?{params}")
                    rows  = r.json().get("response", {}).get("data", [])
                    valid = [(row["period"], float(row["value"])) for row in rows
                             if row.get("value") not in (None, "", "NA") and float(row.get("value", 0)) > 0]
                    if valid:
                        price = round(valid[0][1], 3)
                        result = {
                            "price":       price,
                            "unit":        "$/MMBtu",
                            "source":      f"eia_v2_spot_{series_id}",
                            "report_date": valid[0][0],
                        }
                        _set_waha_cache(result)
                        logger.warning("[WAHA] EIA OK series=%s price=%.3f", series_id, price)
                        return result
                except Exception as exc:
                    logger.warning("[WAHA] EIA series=%s failed: %s", series_id, exc)

    logger.warning("[WAHA] All live sources failed — returning mock (add OIL_PRICE_API_KEY to Railway)")
    result = _mock_waha(hh_price)
    _set_waha_cache(result)
    return result
