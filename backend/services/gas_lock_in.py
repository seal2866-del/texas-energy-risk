"""
Natural Gas Contract Lock-In Signal
--------------------------------------
Compares Henry Hub spot price vs near-month futures + rolling volatility
to generate a LOCK IN / MONITOR / STAY FLOATING recommendation.

Logic:
  - Contango (futures > spot): market expects prices to rise; LOCK IN now
  - Backwardation (futures < spot): market expects prices to fall; STAY FLOATING
  - Volatility modifier: high vol pushes toward LOCK IN for risk averse operators
  - 30-day moving average context: is spot cheap or expensive vs recent trend?
"""
import math
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

_CACHE: Dict = {}
_CACHE_TTL   = 30 * 60   # 30 minutes


def _volatility(prices: List[float]) -> float:
    """Annualised daily price volatility (std dev of log returns × sqrt(252))."""
    if len(prices) < 3:
        return 0.0
    log_returns = [
        math.log(prices[i] / prices[i - 1])
        for i in range(1, len(prices))
        if prices[i - 1] > 0 and prices[i] > 0
    ]
    if not log_returns:
        return 0.0
    mean = sum(log_returns) / len(log_returns)
    variance = sum((r - mean) ** 2 for r in log_returns) / len(log_returns)
    return round(math.sqrt(variance) * math.sqrt(252) * 100, 1)   # as %


def _lock_in_signal(
    spot: float,
    futures: float,
    vol_pct: float,
    avg_30d: Optional[float],
) -> Dict[str, Any]:
    contango   = round(futures - spot, 3)        # positive = futures premium
    contango_pct = round((contango / spot) * 100, 2) if spot else 0

    # Price vs 30-day average
    vs_avg = None
    vs_avg_pct = None
    if avg_30d and avg_30d > 0:
        vs_avg     = round(spot - avg_30d, 3)
        vs_avg_pct = round((vs_avg / avg_30d) * 100, 1)

    # Core signal logic
    high_vol = vol_pct >= 40          # annualised vol ≥40% = high
    above_avg = (vs_avg_pct or 0) > 5   # spot >5% above 30d avg = expensive

    if contango >= 0.30 or (contango >= 0.10 and high_vol):
        signal = "LOCK IN"
        color  = "green"
        reason = (
            f"Near-month futures (${futures:.2f}) are ${contango:.2f}/MMBtu above spot "
            f"(${spot:.2f}). Market prices in higher gas costs ahead."
        )
        if high_vol:
            reason += f" Annualised volatility is elevated at {vol_pct:.0f}% — fixing price now reduces budget risk."
        action = "Consider locking in fixed-price gas supply contracts for the next 30–90 days."
    elif contango <= -0.20 and not high_vol:
        signal = "STAY FLOATING"
        color  = "blue"
        reason = (
            f"Futures (${futures:.2f}) are ${abs(contango):.2f}/MMBtu BELOW spot (${spot:.2f}). "
            "Market expects prices to ease — floating purchase favoured."
        )
        if vs_avg_pct is not None and vs_avg_pct < -5:
            reason += f" Spot is already {abs(vs_avg_pct):.0f}% below 30-day average — current pricing is advantageous."
        action = "Stay on index pricing. Re-evaluate if spot rises more than 15% from current level."
    else:
        signal = "MONITOR"
        color  = "amber"
        reason = (
            f"Futures (${futures:.2f}) vs spot (${spot:.2f}) spread is neutral (${contango:+.2f}/MMBtu). "
            "No strong directional signal."
        )
        if high_vol:
            reason += f" However, annualised volatility of {vol_pct:.0f}% is elevated — consider partial hedging."
            action = "Hedge 25–50% of near-term gas volume as a volatility buffer."
        else:
            action = "No action required. Monitor weekly for contango/backwardation shift."

    return {
        "signal":       signal,
        "color":        color,
        "reason":       reason,
        "action":       action,
        "contango":     contango,
        "contango_pct": contango_pct,
        "volatility_pct": vol_pct,
        "vs_30d_avg":   vs_avg,
        "vs_30d_pct":   vs_avg_pct,
    }


async def fetch_gas_lock_in() -> Dict[str, Any]:
    if _CACHE and (time.time() - _CACHE.get("_ts", 0)) < _CACHE_TTL:
        return {k: v for k, v in _CACHE.items() if k != "_ts"}

    from services.external_apis import fetch_henry_hub_price

    hh = await fetch_henry_hub_price()

    spot    = hh.get("price", 3.00)
    history = hh.get("history", [])   # list of {date, price}

    prices_hist = [pt["price"] for pt in history if pt.get("price")]
    vol_pct     = _volatility(prices_hist)

    avg_30d = None
    if len(prices_hist) >= 5:
        avg_30d = round(sum(prices_hist) / len(prices_hist), 3)

    # Futures price: EIA /pri/fut endpoint returns near-month contract
    # fetch_henry_hub_price() tries futures first, so if source is eia_v2_futures
    # we already have a near-futures-influenced price. For a distinct futures price
    # we apply a simple contango/backwardation model from EIA seasonal factors.
    # This is clearly labelled as "estimated near-month futures".
    import datetime as dt
    month = dt.datetime.now().month
    # Typical seasonal natural gas curve adjustments (simplified)
    seasonal_premium = {
        1: 0.25, 2: 0.15, 3: -0.10, 4: -0.20,
        5: -0.15, 6: 0.05, 7: 0.10, 8: 0.15,
        9: 0.10, 10: 0.20, 11: 0.30, 12: 0.35,
    }
    storage_factor = 0.05   # neutral storage
    futures_est = round(spot + seasonal_premium.get(month, 0) + storage_factor, 3)

    sig = _lock_in_signal(spot, futures_est, vol_pct, avg_30d)

    result = {
        "spot_price":        spot,
        "futures_price":     futures_est,
        "futures_note":      "Estimated near-month futures (seasonal curve + storage factor)",
        "unit":              "$/MMBtu",
        "avg_30d":           avg_30d,
        "volatility_pct":    vol_pct,
        "signal":            sig["signal"],
        "signal_color":      sig["color"],
        "reason":            sig["reason"],
        "action":            sig["action"],
        "contango":          sig["contango"],
        "contango_pct":      sig["contango_pct"],
        "vs_30d_avg":        sig["vs_30d_avg"],
        "vs_30d_pct":        sig["vs_30d_pct"],
        "source":            hh.get("source", "mock"),
        "computed_at":       datetime.now(timezone.utc).isoformat(),
    }

    _CACHE.clear()
    _CACHE.update(result)
    _CACHE["_ts"] = time.time()
    return result
