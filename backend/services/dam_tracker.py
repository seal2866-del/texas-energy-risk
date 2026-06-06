"""
dam_tracker.py
Fetches ERCOT Day-Ahead Market (DAM) prices and compares to Real-Time.
DAM prices post at ~1:30-2:00 PM CT daily for the next operating day.
Cached 1 hour.
"""
import re, logging, httpx
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

log = logging.getLogger(__name__)

DAM_URL      = "https://www.ercot.com/content/cdr/html/dam_spp.html"
_CACHE: Dict = {}
_CACHE_TTL   = 3600  # 1 hour

def _fresh(key):
    e = _CACHE.get(key)
    return e and (datetime.now(timezone.utc) - e["ts"]).total_seconds() < _CACHE_TTL

def _get(k): return _CACHE[k]["data"]
def _set(k, d): _CACHE[k] = {"ts": datetime.now(timezone.utc), "data": d}


def _parse_dam_html(html: str) -> List[Dict]:
    """
    Parse DAM SPP table. Columns: Hour Ending | HB_BUSAVG | HB_HOUSTON | HB_HUBAVG | HB_NORTH | HB_SOUTH | HB_WEST
    Returns list of {hour, price_houston, price_north, price_south, price_west}
    """
    rows = []
    # Find all table rows with numeric data
    # Pattern: hour ending (1-24) followed by prices
    pattern = re.compile(
        r'(\d{1,2})\s*\|.*?\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)',
        re.IGNORECASE
    )
    # Also try simpler approach — find numbers in sequence
    # Look for lines with hour patterns
    for line in html.splitlines():
        line = line.strip()
        # Match pipe-separated rows
        parts = [p.strip() for p in line.split('|') if p.strip()]
        if len(parts) >= 7:
            try:
                hour = int(parts[0])
                if 1 <= hour <= 24:
                    busavg    = float(parts[1])
                    houston   = float(parts[2])
                    hubavg    = float(parts[3])
                    north     = float(parts[4])
                    south     = float(parts[6]) if len(parts) > 6 else None
                    west      = float(parts[7]) if len(parts) > 7 else None
                    rows.append({
                        "hour":          hour,
                        "price_houston": houston,
                        "price_north":   north,
                        "price_south":   south,
                        "price_west":    west,
                        "price_busavg":  busavg,
                    })
            except (ValueError, IndexError):
                continue
    return rows


def _dam_summary(rows: List[Dict], rt_price: float) -> Dict[str, Any]:
    if not rows:
        return {"available": False, "message": "DAM prices not yet posted (posts ~2PM CT)"}

    prices = [r["price_houston"] for r in rows if r.get("price_houston")]
    avg_dam = sum(prices) / len(prices) if prices else 0
    max_dam = max(prices) if prices else 0
    min_dam = min(prices) if prices else 0

    # Current CT hour
    now_ct = datetime.now(timezone.utc) - timedelta(hours=5)
    current_hour = now_ct.hour + 1  # hour ending

    # Find remaining hours
    remaining = [r for r in rows if r["hour"] > current_hour]
    avg_remaining = sum(r["price_houston"] for r in remaining) / len(remaining) if remaining else avg_dam

    spread = round(rt_price - avg_remaining, 2)
    spread_pct = round((spread / rt_price) * 100, 1) if rt_price else 0

    if spread > 15:
        signal = "LOCK IN"
        signal_color = "#22c55e"
        rationale = f"RT ${rt_price:.0f} is ${spread:.0f} above remaining DAM avg ${avg_remaining:.0f} — index buyers overpaying"
    elif spread < -15:
        signal = "STAY FLOATING"
        signal_color = "#ef4444"
        rationale = f"DAM ${avg_remaining:.0f} is ${abs(spread):.0f} above RT ${rt_price:.0f} — real-time cheaper right now"
    else:
        signal = "MONITOR"
        signal_color = "#f59e0b"
        rationale = f"DAM avg ${avg_remaining:.0f} vs RT ${rt_price:.0f} — spread within normal range"

    # Peak hours (top 6 most expensive)
    peak_hours = sorted(rows, key=lambda x: x.get("price_houston", 0), reverse=True)[:6]
    cheap_hours = sorted(rows, key=lambda x: x.get("price_houston", 0))[:6]

    return {
        "available":      True,
        "avg_dam":        round(avg_dam, 2),
        "max_dam":        round(max_dam, 2),
        "min_dam":        round(min_dam, 2),
        "avg_remaining":  round(avg_remaining, 2),
        "rt_price":       rt_price,
        "spread":         spread,
        "spread_pct":     spread_pct,
        "signal":         signal,
        "signal_color":   signal_color,
        "rationale":      rationale,
        "peak_hours":     [r["hour"] for r in peak_hours],
        "cheap_hours":    [r["hour"] for r in cheap_hours],
        "hours":          rows,
    }


async def fetch_dam_comparison(rt_price: float = 50.0) -> Dict[str, Any]:
    key = "dam"
    if _fresh(key):
        return _get(key)

    try:
        async with httpx.AsyncClient(timeout=15, headers={"Cache-Control": "no-cache"}) as client:
            r = await client.get(DAM_URL)

        if r.status_code != 200:
            log.warning("[DAM] Fetch failed: %d", r.status_code)
            return {"available": False, "message": "DAM page unavailable", "rt_price": rt_price}

        rows = _parse_dam_html(r.text)
        result = {
            "computed_at": datetime.now(timezone.utc).isoformat(),
            **_dam_summary(rows, rt_price),
        }
        _set(key, result)
        return result

    except Exception as e:
        log.error("[DAM] Error: %s", e)
        return {"available": False, "message": str(e), "rt_price": rt_price}
