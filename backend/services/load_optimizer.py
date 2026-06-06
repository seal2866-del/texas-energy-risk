"""
load_optimizer.py
Computes optimal load scheduling windows for industrial operators.
Uses ERCOT price history + NOAA weather forecast to identify
the cheapest hours to run heavy loads in the next 24-48 hours.
Cached 30 minutes.
"""
import logging, re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

log = logging.getLogger(__name__)

_CACHE: Dict[str, Any] = {}
_CACHE_TTL = 1800  # 30 minutes

def _fresh(key: str) -> bool:
    entry = _CACHE.get(key)
    if not entry: return False
    return (datetime.now(timezone.utc) - entry["ts"]).total_seconds() < _CACHE_TTL

def _get(key): return _CACHE[key]["data"]
def _set(key, data): _CACHE[key] = {"ts": datetime.now(timezone.utc), "data": data}


# Typical ERCOT hourly price multipliers by hour (0-23, CT)
# Based on historical ERCOT average patterns — summer peak 2-8pm, overnight low
HOUR_MULTIPLIERS = {
    0:  0.72, 1:  0.68, 2:  0.65, 3:  0.63, 4:  0.64,
    5:  0.68, 6:  0.78, 7:  0.88, 8:  0.92, 9:  0.95,
    10: 0.97, 11: 1.00, 12: 1.02, 13: 1.05, 14: 1.12,
    15: 1.18, 16: 1.22, 17: 1.20, 18: 1.15, 19: 1.08,
    20: 1.02, 21: 0.95, 22: 0.88, 23: 0.80,
}

def _temp_multiplier(temp_f: float) -> float:
    """Price multiplier based on temperature — hot days = higher prices."""
    if temp_f >= 105: return 1.45
    if temp_f >= 100: return 1.28
    if temp_f >= 95:  return 1.15
    if temp_f >= 90:  return 1.05
    if temp_f >= 85:  return 1.00
    if temp_f <= 28:  return 1.35  # cold snap
    if temp_f <= 35:  return 1.20
    return 0.95

def _build_hourly_forecast(
    current_price: float,
    forecasts: List[Dict],
    prices: List[Dict],
) -> List[Dict]:
    """Build 48-hour hourly price estimate."""
    now_ct = datetime.now(timezone.utc) - timedelta(hours=5)  # approx CT
    current_hour = now_ct.hour

    # Get recent price trend
    recent_prices = [float(p.get("price_mwh", 0)) for p in prices[-4:] if p.get("price_mwh")]
    base = sum(recent_prices) / len(recent_prices) if recent_prices else current_price

    # Get temp forecast for next 2 days
    temp_today = float(forecasts[0].get("temp_high_f", 85)) if forecasts else 85
    temp_tmw   = float(forecasts[1].get("temp_high_f", 85)) if len(forecasts) > 1 else temp_today

    hours = []
    for h in range(48):
        abs_hour = (current_hour + h) % 24
        day_offset = (current_hour + h) // 24
        temp = temp_today if day_offset == 0 else temp_tmw
        label_day = "Today" if day_offset == 0 else "Tomorrow"

        hour_mult = HOUR_MULTIPLIERS.get(abs_hour, 1.0)
        temp_mult = _temp_multiplier(temp)
        est_price = round(base * hour_mult * temp_mult, 2)

        dt = now_ct + timedelta(hours=h)
        hours.append({
            "offset_h":   h,
            "hour_ct":    abs_hour,
            "day":        label_day,
            "label":      f"{label_day} {dt.strftime('%I %p').lstrip('0')}",
            "est_price":  est_price,
            "temp_f":     temp,
            "multiplier": round(hour_mult * temp_mult, 3),
        })
    return hours


def _find_windows(hourly: List[Dict], window_size: int = 6) -> List[Dict]:
    """Find cheapest N-hour consecutive windows in next 48 hours."""
    windows = []
    for start in range(len(hourly) - window_size + 1):
        chunk  = hourly[start:start + window_size]
        avg    = sum(h["est_price"] for h in chunk) / window_size
        peak   = max(h["est_price"] for h in chunk)
        low    = min(h["est_price"] for h in chunk)
        windows.append({
            "start_offset": start,
            "start_label":  chunk[0]["label"],
            "end_label":    chunk[-1]["label"],
            "avg_price":    round(avg, 2),
            "peak_price":   round(peak, 2),
            "low_price":    round(low, 2),
            "day":          chunk[0]["day"],
            "hours":        [h["hour_ct"] for h in chunk],
        })
    windows.sort(key=lambda x: x["avg_price"])
    return windows[:5]  # top 5 cheapest


def _risk_label(price: float) -> str:
    if price >= 150: return "HIGH"
    if price >= 75:  return "WATCH"
    return "LOW"


async def compute_load_optimizer(
    prices:    List[Dict],
    forecasts: List[Dict],
    location:  str = "Houston",
) -> Dict[str, Any]:
    cache_key = f"loadopt:{location}"
    if _fresh(cache_key):
        return _get(cache_key)

    current_price = float(prices[-1].get("price_mwh", 50)) if prices else 50.0
    hourly = _build_hourly_forecast(current_price, forecasts, prices)
    best_windows = _find_windows(hourly, window_size=6)
    best_4h      = _find_windows(hourly, window_size=4)
    best_2h      = _find_windows(hourly, window_size=2)

    best = best_windows[0] if best_windows else None
    temp_tmw = float(forecasts[1].get("temp_high_f", 85)) if len(forecasts) > 1 else 85

    # Recommendation
    if best:
        if best["day"] == "Today" and best["start_offset"] <= 6:
            rec = f"Run heavy loads now — lowest prices in next 48 hours"
        elif best["avg_price"] < current_price * 0.8:
            rec = f"Shift load to {best['start_label']} — est. {round((1 - best['avg_price']/current_price)*100)}% savings vs now"
        else:
            rec = f"Best window: {best['start_label']} at ~${best['avg_price']:.0f}/MWh"
    else:
        rec = "Insufficient data for load scheduling recommendation"

    result = {
        "computed_at":    datetime.now(timezone.utc).isoformat(),
        "location":       location,
        "current_price":  current_price,
        "current_risk":   _risk_label(current_price),
        "temp_tomorrow":  temp_tmw,
        "recommendation": rec,
        "best_6h_windows": best_windows,
        "best_4h_windows": best_4h[:3],
        "best_2h_windows": best_2h[:3],
        "hourly_48h":     hourly,
        "disclaimer":     (
            "Estimated prices based on historical ERCOT load patterns and temperature forecasts. "
            "Actual real-time prices may vary significantly. Not financial or procurement advice."
        ),
    }
    _set(cache_key, result)
    return result
