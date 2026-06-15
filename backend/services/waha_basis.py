"""
Waha vs Henry Hub Basis Spread
--------------------------------
Waha Hub = West Texas natural gas trading point.
Basis spread = HH price - Waha price (positive = Waha at discount).
Wide discount signals Permian Basin pipeline takeaway constraints.
"""
import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Dict

_CACHE: Dict = {}
_CACHE_TTL   = 15 * 60   # 15 minutes

SPREAD_BLOWOUT = 5.00   # $/MMBtu — severe pipeline constraint
SPREAD_WIDE    = 2.00   # Elevated congestion
SPREAD_NORMAL  = 0.50   # Typical Waha discount floor


def _signal(spread: float) -> Dict[str, str]:
    if spread >= SPREAD_BLOWOUT:
        return {
            "signal":  "BLOWOUT",
            "color":   "red",
            "label":   "Severe Pipeline Congestion",
            "insight": (
                f"Waha is ${spread:.2f}/MMBtu below Henry Hub — extreme takeaway constraint. "
                "Permian producers face severe curtailment risk. Basis risk is critical for "
                "any unfixed gas sales contracts tied to Waha."
            ),
        }
    elif spread >= SPREAD_WIDE:
        return {
            "signal":  "WIDE",
            "color":   "orange",
            "label":   "Elevated Basis Risk",
            "insight": (
                f"Waha trades ${spread:.2f}/MMBtu below HH — above-normal pipeline congestion. "
                "Midstream capacity is strained. Monitor for curtailment notices and "
                "consider Waha-indexed contract renegotiation windows."
            ),
        }
    elif spread >= 0:
        return {
            "signal":  "NORMAL",
            "color":   "green",
            "label":   "Normal Basis",
            "insight": (
                f"Waha-HH spread of ${spread:.2f}/MMBtu is within normal range. "
                "Permian Basin takeaway capacity is adequate. No unusual congestion signals."
            ),
        }
    else:
        return {
            "signal":  "PREMIUM",
            "color":   "blue",
            "label":   "Waha at Premium to HH",
            "insight": (
                f"Waha is ${abs(spread):.2f}/MMBtu ABOVE Henry Hub — rare inversion. "
                "Likely reflects strong Permian regional demand or Henry Hub supply glut. "
                "Unusual arbitrage opportunity may exist."
            ),
        }


async def fetch_waha_basis() -> Dict[str, Any]:
    if _CACHE and (time.time() - _CACHE.get("_ts", 0)) < _CACHE_TTL:
        return {k: v for k, v in _CACHE.items() if k != "_ts"}

    from services.external_apis import fetch_henry_hub_price, fetch_waha_price

    hh_result, waha_result = await asyncio.gather(
        fetch_henry_hub_price(),
        fetch_waha_price(),
        return_exceptions=True,
    )

    hh_price   = hh_result.get("price",   3.00) if isinstance(hh_result,   dict) else 3.00
    waha_price = waha_result.get("price",  2.20) if isinstance(waha_result, dict) else 2.20
    hh_src     = hh_result.get("source",  "mock") if isinstance(hh_result,  dict) else "error"
    waha_src   = waha_result.get("source", "mock") if isinstance(waha_result, dict) else "error"
    waha_date  = waha_result.get("report_date", "") if isinstance(waha_result, dict) else ""

    spread     = round(hh_price - waha_price, 3)
    spread_pct = round((spread / hh_price) * 100, 1) if hh_price else 0
    sig        = _signal(spread)

    result = {
        "henry_hub": {
            "price":  hh_price,
            "unit":   "$/MMBtu",
            "source": hh_src,
        },
        "waha": {
            "price":       waha_price,
            "unit":        "$/MMBtu",
            "source":      waha_src,
            "report_date": waha_date,
        },
        "spread":       spread,
        "spread_pct":   spread_pct,
        "signal":       sig["signal"],
        "signal_color": sig["color"],
        "signal_label": sig["label"],
        "insight":      sig["insight"],
        "thresholds":   {
            "normal_max":  SPREAD_NORMAL,
            "wide":        SPREAD_WIDE,
            "blowout":     SPREAD_BLOWOUT,
        },
        "computed_at":  datetime.now(timezone.utc).isoformat(),
    }

    _CACHE.clear()
    _CACHE.update(result)
    _CACHE["_ts"] = time.time()
    return result
