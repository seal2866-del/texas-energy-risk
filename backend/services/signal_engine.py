"""
signal_engine.py
Computes risk signals from ERCOT, weather, and gas data.
Signal rules match the product specification exactly.

LEGAL NOTE: All output is informational only. No trading,
procurement, or investment advice is expressed or implied.
"""
from typing import Dict, Any, List, Tuple
from datetime import datetime, timezone


# ── Thresholds (can be overridden via env or DB config) ──────────
PRICE_SPIKE_THRESHOLD_PCT = 50.0     # % change to trigger volatility alert
PRICE_SPIKE_WINDOW_HOURS  = 1        # compare price to N hours ago
PRICE_ABS_HIGH_MWH        = 150.0    # also alert if price exceeds this absolute level

TEMP_HIGH_THRESHOLD_F     = 100.0    # trigger weather alert above this high
TEMP_LOW_THRESHOLD_F      = 28.0     # trigger weather alert below this low

GAS_STORAGE_PCT_THRESHOLD = -10.0    # trigger if storage is % below 5yr avg


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────────────────────
# Individual signal detectors
# ──────────────────────────────────────────────────────────────

def check_price_volatility(prices: List[Dict]) -> Dict[str, Any]:
    """
    Triggered if:
    - ERCOT price changes by >50% within the last hour, OR
    - Current price exceeds $150/MWh absolute.
    Returns signal dict with triggered, severity, message.
    """
    if not prices or len(prices) < 2:
        return _signal("price_volatility", False, "low", None, None,
                       "Insufficient price data to assess volatility.")

    current_price = float(prices[-1]["price_mwh"])
    prev_price    = float(prices[-2]["price_mwh"]) if len(prices) >= 2 else current_price
    prev_price    = max(prev_price, 0.01)  # avoid div-by-zero

    pct_change = abs((current_price - prev_price) / prev_price) * 100

    if pct_change >= PRICE_SPIKE_THRESHOLD_PCT or current_price >= PRICE_ABS_HIGH_MWH:
        if current_price >= 500:
            severity = "high"
            msg = (f"ERCOT real-time price may be at ${current_price:.0f}/MWh — "
                   "volatility risk may be elevated. This is informational only.")
        elif current_price >= 150 or pct_change >= PRICE_SPIKE_THRESHOLD_PCT:
            severity = "medium"
            msg = (f"ERCOT price moved from ${prev_price:.0f} to ${current_price:.0f}/MWh "
                   f"({pct_change:.0f}% change). Market conditions may be shifting.")
        else:
            severity = "low"
            msg = f"ERCOT price at ${current_price:.0f}/MWh — monitor for further movement."

        return _signal("price_volatility", True, severity, current_price,
                       PRICE_ABS_HIGH_MWH, msg)

    return _signal("price_volatility", False, "low", current_price,
                   PRICE_ABS_HIGH_MWH,
                   f"ERCOT price at ${current_price:.0f}/MWh — within normal range.")


def check_weather_demand(forecasts: List[Dict]) -> Dict[str, Any]:
    """
    Triggered if next-day forecast high >= 100°F or low <= 28°F.
    """
    if not forecasts:
        return _signal("weather_demand", False, "low", None, None,
                       "No weather forecast data available.")

    tomorrow = forecasts[0] if forecasts else {}
    high_f   = float(tomorrow.get("temp_high_f", 75))
    low_f    = float(tomorrow.get("temp_low_f", 55))
    location = tomorrow.get("location_name", "Texas")

    if high_f >= TEMP_HIGH_THRESHOLD_F:
        severity = "high" if high_f >= 105 else "medium"
        msg = (f"Forecast high of {high_f:.0f}°F in {location} may drive elevated "
               "cooling demand across the Texas grid. Risk may be rising.")
        return _signal("weather_demand", True, severity, high_f,
                       TEMP_HIGH_THRESHOLD_F, msg)

    if low_f <= TEMP_LOW_THRESHOLD_F:
        severity = "high" if low_f <= 20 else "medium"
        msg = (f"Forecast low of {low_f:.0f}°F in {location} may drive elevated "
               "heating demand. Cold weather grid stress risk may be rising.")
        return _signal("weather_demand", True, severity, low_f,
                       TEMP_LOW_THRESHOLD_F, msg)

    return _signal("weather_demand", False, "low", high_f,
                   TEMP_HIGH_THRESHOLD_F,
                   f"Forecast high of {high_f:.0f}°F — normal demand conditions expected.")


def check_gas_supply(gas_records: List[Dict]) -> Dict[str, Any]:
    """
    Triggered if natural gas storage is >10% below 5-year average.
    """
    if not gas_records:
        return _signal("gas_supply", False, "low", None, None,
                       "No natural gas storage data available.")

    latest = gas_records[-1] if gas_records else {}
    pct    = float(latest.get("storage_pct_vs_avg", 0))
    bcf    = latest.get("storage_bcf", "N/A")
    price  = latest.get("henry_hub_price", "N/A")

    if pct <= GAS_STORAGE_PCT_THRESHOLD:
        severity = "high" if pct <= -20 else "medium"
        msg = (f"Natural gas storage at {bcf} Bcf — approximately {abs(pct):.1f}% below "
               f"the 5-year average. Henry Hub at ${price}/MMBtu. "
               "Supply pressure risk may be rising.")
        return _signal("gas_supply", True, severity, pct,
                       GAS_STORAGE_PCT_THRESHOLD, msg)

    return _signal("gas_supply", False, "low", pct,
                   GAS_STORAGE_PCT_THRESHOLD,
                   f"Natural gas storage tracking {pct:+.1f}% vs 5-year average — normal.")


# ──────────────────────────────────────────────────────────────
# Composite risk score
# ──────────────────────────────────────────────────────────────

def compute_risk_score(signals: List[Dict]) -> Tuple[str, int]:
    """
    - 0 triggered     → Low
    - 1 triggered     → Medium
    - 2+ triggered    → High
    Returns (score_label, active_count).
    """
    active = [s for s in signals if s.get("triggered")]
    count  = len(active)

    if count >= 2:
        return "high", count
    elif count == 1:
        return "medium", count
    else:
        return "low", count


def run_all_signals(prices: List[Dict], forecasts: List[Dict],
                    gas_records: List[Dict]) -> Dict[str, Any]:
    """Master function — runs all detectors and returns a full snapshot."""
    price_signal   = check_price_volatility(prices)
    weather_signal = check_weather_demand(forecasts)
    gas_signal     = check_gas_supply(gas_records)

    all_signals    = [price_signal, weather_signal, gas_signal]
    risk_score, active_count = compute_risk_score(all_signals)

    return {
        "computed_at":      _utcnow().isoformat(),
        "risk_score":       risk_score,
        "active_signals":   active_count,
        "signals": {
            "price_volatility": price_signal,
            "weather_demand":   weather_signal,
            "gas_supply":       gas_signal,
        },
        "summary": _generate_summary(risk_score, all_signals),
        "disclaimer": (
            "This information is provided for situational awareness only. "
            "It does not constitute investment, trading, or procurement advice. "
            "Risk may be rising — consult qualified advisors before making decisions."
        ),
    }


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _signal(signal_type: str, triggered: bool, severity: str,
            value, threshold, message: str) -> Dict[str, Any]:
    return {
        "signal_type": signal_type,
        "triggered":   triggered,
        "severity":    severity,
        "value":       value,
        "threshold":   threshold,
        "message":     message,
        "computed_at": _utcnow().isoformat(),
    }


def _generate_summary(risk_score: str, signals: List[Dict]) -> str:
    """Generates an AI-style risk narrative. Informational only."""
    triggered = [s for s in signals if s.get("triggered")]
    names = {
        "price_volatility": "ERCOT price volatility",
        "weather_demand":   "Texas weather demand pressure",
        "gas_supply":       "natural gas supply tightness",
    }

    if risk_score == "high":
        active_names = " and ".join(names.get(s["signal_type"], s["signal_type"])
                                    for s in triggered)
        return (
            f"Texas energy risk may be elevated. Multiple signals are active: "
            f"{active_names}. Combined market conditions suggest monitoring "
            f"exposure closely. This is situational awareness — not a trading signal."
        )
    elif risk_score == "medium":
        s = triggered[0] if triggered else {}
        return (
            f"One risk signal is currently active: "
            f"{names.get(s.get('signal_type', ''), 'unknown')}. "
            f"Market conditions may warrant closer attention. "
            f"This is informational only."
        )
    else:
        return (
            "No active risk signals detected at this time. Texas energy market "
            "conditions appear within normal ranges. Continue monitoring for changes."
        )
