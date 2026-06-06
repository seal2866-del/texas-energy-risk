"""
grid_conditions.py
Fetches ERCOT real-time system conditions:
  - Actual demand vs total capacity → reserve margin → EEA risk level
  - All hub prices → spread monitor (HB_WEST vs HB_HOUSTON etc.)
Cached 5 minutes.
"""
import os, logging, re
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import httpx

log = logging.getLogger(__name__)

ERCOT_SYS_URL = "https://www.ercot.com/content/cdr/html/real_time_system_conditions.html"

_CACHE: Dict[str, Any] = {}
_CACHE_TTL = 300  # 5 minutes

def _fresh(key: str) -> bool:
    entry = _CACHE.get(key)
    if not entry: return False
    return (datetime.now(timezone.utc) - entry["ts"]).total_seconds() < _CACHE_TTL

def _get(key): return _CACHE[key]["data"]
def _set(key, data): _CACHE[key] = {"ts": datetime.now(timezone.utc), "data": data}


# ── EEA Risk Level ────────────────────────────────────────────────────────────

def _eea_level(reserve_pct: float, freq: float) -> Dict[str, Any]:
    """
    Derive EEA risk from reserve margin + frequency deviation.
    ERCOT EEA thresholds (approximate):
      EEA Watch:      reserve < 2300 MW or ~3.4% of typical 68GW capacity
      EEA Warning:    reserve < 1750 MW
      EEA Emergency 1: reserve < 1000 MW
      EEA Emergency 2: reserve < 500 MW
      EEA Emergency 3: reserve < 100 MW / freq deviation > 0.3 Hz
    """
    freq_dev = abs(freq - 60.0) if freq else 0

    if reserve_pct < 0.15 or freq_dev > 0.3:
        return {"level": 3, "label": "EEA EMERGENCY 3", "color": "#7c3aed",
                "description": "Extreme grid stress — load shedding possible", "triggered": True}
    if reserve_pct < 0.75:
        return {"level": 2, "label": "EEA EMERGENCY 2", "color": "#dc2626",
                "description": "Critical reserve shortage — curtailment risk high", "triggered": True}
    if reserve_pct < 1.5:
        return {"level": 1, "label": "EEA EMERGENCY 1", "color": "#ef4444",
                "description": "Emergency conditions — demand response activated", "triggered": True}
    if reserve_pct < 3.5:
        return {"level": 0, "label": "EEA WARNING", "color": "#f97316",
                "description": "Reserve margin critically low — watch closely", "triggered": True}
    if reserve_pct < 7.0:
        return {"level": -1, "label": "EEA WATCH", "color": "#f59e0b",
                "description": "Reserves tightening — monitor for escalation", "triggered": False}
    return {"level": -2, "label": "NORMAL OPERATIONS", "color": "#22c55e",
            "description": "Adequate reserves — no emergency conditions", "triggered": False}


def _parse_system_conditions(html: str) -> Dict[str, Any]:
    def _val(label: str) -> Optional[float]:
        pattern = rf"{re.escape(label)}\s*\|?\s*\|?\s*([\d,\.]+)"
        m = re.search(pattern, html, re.IGNORECASE)
        if m:
            try: return float(m.group(1).replace(",", ""))
            except: return None
        return None

    demand   = _val("Actual System Demand")
    capacity = _val("Total System Capacity (not including Ancillary Services)")
    wind     = _val("Total Wind Output")
    solar    = _val("Total PVGR Output")
    freq     = _val("Current Frequency")
    inertia  = _val("Current System Inertia")

    reserve_mw  = (capacity - demand) if capacity and demand else None
    reserve_pct = (reserve_mw / capacity * 100) if reserve_mw and capacity else None
    wind_pct    = (wind / demand * 100) if wind and demand else None
    solar_pct   = (solar / demand * 100) if solar and demand else None
    renewable_pct = ((wind + (solar or 0)) / demand * 100) if wind and demand else None

    eea = _eea_level(reserve_pct or 999, freq or 60.0)

    return {
        "demand_mw":       round(demand)   if demand   else None,
        "capacity_mw":     round(capacity) if capacity else None,
        "reserve_mw":      round(reserve_mw)  if reserve_mw  else None,
        "reserve_pct":     round(reserve_pct, 2) if reserve_pct else None,
        "wind_mw":         round(wind)  if wind  else None,
        "solar_mw":        round(solar) if solar else None,
        "wind_pct":        round(wind_pct, 1)      if wind_pct      else None,
        "solar_pct":       round(solar_pct, 1)     if solar_pct     else None,
        "renewable_pct":   round(renewable_pct, 1) if renewable_pct else None,
        "frequency":       freq,
        "inertia":         inertia,
        "eea":             eea,
    }


# ── Hub price spreads ─────────────────────────────────────────────────────────

HUBS = ["HB_HOUSTON", "HB_NORTH", "HB_SOUTH", "HB_WEST", "HB_BUSAVG"]

def _parse_hub_prices(html: str) -> Dict[str, Optional[float]]:
    prices = {}
    for hub in HUBS:
        idx = html.upper().find(hub.upper())
        if idx < 0:
            prices[hub] = None
            continue
        snippet = html[idx:idx+200]
        nums = re.findall(r'>\s*([-]?\d+\.\d+)\s*<', snippet)
        if nums:
            try: prices[hub] = float(nums[0])
            except: prices[hub] = None
        else:
            prices[hub] = None
    return prices


def _build_spreads(prices: Dict[str, Optional[float]]) -> list:
    base = prices.get("HB_HOUSTON")
    if not base:
        return []
    spreads = []
    labels = {
        "HB_NORTH":  "North Hub",
        "HB_SOUTH":  "South Hub",
        "HB_WEST":   "West Hub",
        "HB_BUSAVG": "Bus Average",
    }
    for hub, label in labels.items():
        p = prices.get(hub)
        if p is None: continue
        diff = round(p - base, 2)
        pct  = round((diff / base) * 100, 1) if base else 0
        alert = abs(diff) >= 15  # significant spread
        spreads.append({
            "hub":      hub,
            "label":    label,
            "price":    p,
            "spread":   diff,
            "spread_pct": pct,
            "direction": "above" if diff > 0 else "below",
            "alert":    alert,
            "color":    "#ef4444" if diff > 25 else "#f97316" if diff > 10 else
                        "#22c55e" if diff < -10 else "#6b7280",
        })
    return sorted(spreads, key=lambda x: abs(x["spread"]), reverse=True)


# ── Main fetch ────────────────────────────────────────────────────────────────

async def fetch_grid_conditions() -> Dict[str, Any]:
    if _fresh("grid"):
        return _get("grid")

    try:
        async with httpx.AsyncClient(timeout=15, headers={"Cache-Control": "no-cache"}) as client:
            sys_r = await client.get(ERCOT_SYS_URL)

        # System conditions
        sys_data = {}
        if not isinstance(sys_r, Exception) and sys_r.status_code == 200:
            sys_data = _parse_system_conditions(sys_r.text)
        else:
            log.warning("[GRID] System conditions fetch failed: %s", sys_r)

        # Hub prices — use live cache for HB_HOUSTON, fresh CDR for other hubs
        hub_prices = {}
        spreads    = []
        try:
            from services.external_apis import fetch_all_hub_prices, _get_cached_prices
            hub_prices = await fetch_all_hub_prices()
            # Override HB_HOUSTON with the live poller cache (updated every 5 min)
            cached = _get_cached_prices("HB_HOUSTON")
            if cached:
                live_price = float(cached[-1].get("price_mwh", 0))
                if live_price > 0:
                    hub_prices["HB_HOUSTON"] = live_price
            spreads = _build_spreads(hub_prices)
        except Exception as he:
            log.warning("[GRID] Hub prices fetch failed: %s", he)

        result = {
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "system":      sys_data,
            "hub_prices":  hub_prices,
            "spreads":     spreads,
            "base_hub":    "HB_HOUSTON",
            "base_price":  hub_prices.get("HB_HOUSTON"),
        }
        _set("grid", result)
        return result

    except Exception as e:
        log.error("[GRID] fetch_grid_conditions error: %s", e)
        return {
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "system":      {},
            "hub_prices":  {},
            "spreads":     [],
            "base_hub":    "HB_HOUSTON",
            "base_price":  None,
            "error":       str(e),
        }
