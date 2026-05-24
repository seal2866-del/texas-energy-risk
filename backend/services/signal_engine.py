"""
signal_engine.py
Professional risk intelligence engine for Texas energy market conditions.
Produces structured signals with titles, confidence scores, and impact statements.

LEGAL NOTE: All output is informational only. No trading,
procurement, or investment advice is expressed or implied.
"""
import logging
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


# ── Thresholds ────────────────────────────────────────────────────────────────
PRICE_SPIKE_THRESHOLD_PCT = 50.0     # % change to trigger volatility alert
PRICE_ABS_HIGH_MWH        = 150.0    # alert if price exceeds this absolute level
PRICE_LOW_FLOOR           = 10.0     # below this, % change is unreliable
TEMP_HIGH_THRESHOLD_F     = 100.0
TEMP_LOW_THRESHOLD_F      = 28.0
GAS_STORAGE_PCT_THRESHOLD = -10.0


DATA_FRESHNESS_MINUTES = 15   # max age of latest reading before failsafe
DATA_MIN_REAL_POINTS   = 2    # need at least this many real (non-mock) readings
MOCK_SOURCES           = {"mock", "mock_data", "generated", "demo", None, ""}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────────────────────────────────────
# Task 4 — Data validation layer
# ──────────────────────────────────────────────────────────────────────────────

def _validate_data(prices: List[Dict]) -> Tuple[bool, str]:
    """
    Validates ERCOT price data before signals fire.
    Returns (is_valid, status_message).

    Requirements:
    1. At least DATA_MIN_REAL_POINTS consecutive real datapoints
    2. Latest reading is fresh (< DATA_FRESHNESS_MINUTES old)
    3. No mock sources

    If any condition fails → signals are suppressed.
    """
    if not prices:
        logger.warning("[VALIDATE] No price data — failsafe active")
        return False, "no_data"

    # Check for mock contamination
    real_prices = [
        p for p in prices
        if p.get("source") not in MOCK_SOURCES
    ]

    if len(real_prices) < DATA_MIN_REAL_POINTS:
        got = len(real_prices)
        logger.warning(
            "[VALIDATE] Insufficient real data: %d/%d real readings — failsafe active",
            got, DATA_MIN_REAL_POINTS
        )
        if got == 0:
            return False, "mock_only"
        return False, f"building_cache_{got}_of_{DATA_MIN_REAL_POINTS}"

    # Check freshness of latest reading
    latest = prices[-1]
    ts_raw = latest.get("timestamp", "")
    try:
        ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
        age_minutes = (_utcnow() - ts).total_seconds() / 60
        if age_minutes > DATA_FRESHNESS_MINUTES:
            logger.warning(
                "[VALIDATE] Stale data: latest reading is %.1f minutes old — failsafe active",
                age_minutes
            )
            return False, f"stale_{age_minutes:.0f}m"
    except Exception as exc:
        logger.warning("[VALIDATE] Cannot parse timestamp '%s': %s", ts_raw, exc)
        return False, "bad_timestamp"

    logger.debug(
        "[VALIDATE] Data valid: %d real readings, latest %.1f minutes old, source=%s",
        len(real_prices), age_minutes, latest.get("source")
    )
    return True, "valid"


def _failsafe_response() -> Dict[str, Any]:
    """
    Task 8 — Returned when real data is unavailable or invalid.
    Disables risk score and all signals. Shows monitoring-paused message.
    """
    now = _utcnow().isoformat()
    paused_signal = _signal(
        signal_type="unavailable",
        sig_type="UNAVAILABLE",
        triggered=False,
        severity="low",
        confidence=None,
        title="Monitoring Paused",
        value=None,
        threshold=None,
        message="Live data unavailable. Monitoring paused.",
        impact="Signals will resume automatically once real-time data is confirmed.",
    )
    return {
        "computed_at":    now,
        "risk_score":     "low",
        "active_signals": 0,
        "confidence":     None,
        "explanation":    "Live data unavailable. Monitoring paused.",
        "impact":         "Risk signals are suppressed until real-time data is confirmed.",
        "data_valid":     False,
        "data_status":    "unavailable",
        "signals": {
            "price_volatility": paused_signal,
            "weather_demand":   paused_signal,
            "gas_supply":       paused_signal,
        },
        "summary":     "Live data unavailable. Monitoring paused. Signals will resume automatically once real-time ERCOT data is confirmed.",
        "disclaimer":  (
            "This information is provided for situational awareness only. "
            "It does not constitute investment, trading, or procurement advice."
        ),
    }


def _awaiting_signal(signal_type: str, sig_type: str, status: str) -> Dict[str, Any]:
    """
    Returns a non-triggered 'building cache' signal for use while data is accumulating.
    """
    reading_count = 0
    if "building_cache_" in status:
        try:
            reading_count = int(status.split("_")[2])
        except Exception:
            pass

    if status == "mock_only":
        message = "Real-time data feed is initializing. Mock data has been excluded."
        title   = "Awaiting Real-Time Data"
    elif "building_cache" in status:
        message = (
            f"Accumulating real-time readings ({reading_count}/{DATA_MIN_REAL_POINTS} received). "
            "Signal analysis requires consecutive verified data points."
        )
        title = "Building Data Cache"
    elif "stale" in status:
        message = "Last real-time reading is older than expected. Waiting for fresh data."
        title   = "Data Feed Interrupted"
    else:
        message = "Live data unavailable. Monitoring paused."
        title   = "Monitoring Paused"

    return _signal(
        signal_type=signal_type,
        sig_type=sig_type,
        triggered=False,
        severity="low",
        confidence=None,
        title=title,
        value=None,
        threshold=None,
        message=message,
        impact="Signals will activate automatically once verified data is available.",
    )


# ──────────────────────────────────────────────────────────────────────────────
# Task 1 + 6 — Price change validation
# ──────────────────────────────────────────────────────────────────────────────

def _safe_pct_change(current: float, previous: float) -> Tuple[float | None, str]:
    """
    Returns (pct_change, display_string).
    Guards against divide-by-small-number (prev < PRICE_LOW_FLOOR).
    Requires both values to be from the same settlement point.
    """
    if previous < PRICE_LOW_FLOOR:
        return None, "Large movement detected"

    pct = ((current - previous) / previous) * 100
    sign = "+" if pct >= 0 else ""
    return pct, f"{sign}{pct:.1f}%"


def _validate_spike(prices: List[Dict], window: int = 2) -> bool:
    """
    Task 6 — Require spike to persist across N consecutive intervals.
    Returns True only if last `window` prices all exceed PRICE_ABS_HIGH_MWH
    OR if % change is sustained over multiple readings.
    Single-interval outliers are suppressed.
    """
    if len(prices) < window:
        return False

    recent = prices[-window:]
    high_count = sum(1 for p in recent if float(p["price_mwh"]) >= PRICE_ABS_HIGH_MWH)
    return high_count >= window


# ──────────────────────────────────────────────────────────────────────────────
# Task 5 — Confidence scoring
# ──────────────────────────────────────────────────────────────────────────────

def _compute_confidence(prices: List[Dict], all_signals: List[Dict]) -> int:
    """
    Base: 50
    +20  signal persists over 2+ consecutive intervals
    +10  multiple signals align
    +10  data from real source (not mock)
    Cap: 90
    """
    confidence = 50

    # +20 if volatility or high price persists across last 3 readings
    if len(prices) >= 3:
        recent_prices = [float(p["price_mwh"]) for p in prices[-3:]]
        avg = sum(recent_prices) / len(recent_prices)
        # Sustained high price
        if sum(1 for p in recent_prices if p >= PRICE_ABS_HIGH_MWH) >= 2:
            confidence += 20
        # Sustained volatility (all readings deviate >30% from their own avg)
        elif sum(1 for p in recent_prices if abs(p - avg) / max(avg, 1) > 0.30) >= 2:
            confidence += 20
        else:
            confidence += 5  # some data continuity

    # +10 if multiple signals triggered simultaneously
    active = [s for s in all_signals if s.get("triggered")]
    if len(active) >= 2:
        confidence += 10

    # +10 if data from live source
    if prices and prices[-1].get("source") not in ("mock", None, ""):
        confidence += 10

    return min(confidence, 90)


# ──────────────────────────────────────────────────────────────────────────────
# Individual signal detectors
# ──────────────────────────────────────────────────────────────────────────────

def check_price_volatility(prices: List[Dict]) -> Dict[str, Any]:
    """
    Tasks 1, 2, 6:
    - Correct % change calculation (same point, same interval)
    - Safe divide guard
    - Requires 2 consecutive data points for sustained spikes
    - Stronger, confident signal wording
    """
    if not prices or len(prices) < 2:
        return _signal(
            signal_type="price_volatility",
            sig_type="VOLATILITY",
            triggered=False,
            severity="low",
            confidence=40,
            title="Awaiting Price Data",
            value=None,
            threshold=PRICE_ABS_HIGH_MWH,
            message="Insufficient price data to assess volatility.",
            impact="Monitoring will begin once two consecutive readings are available.",
        )

    current_price = float(prices[-1]["price_mwh"])
    prev_price    = float(prices[-2]["price_mwh"])

    pct_change, pct_display = _safe_pct_change(current_price, prev_price)
    pct_abs = abs(pct_change) if pct_change is not None else None

    # Determine if this is a real sustained spike (Task 6 validation)
    sustained_spike = _validate_spike(prices, window=2)

    spike_by_pct    = pct_abs is not None and pct_abs >= PRICE_SPIKE_THRESHOLD_PCT
    spike_by_abs    = sustained_spike and current_price >= PRICE_ABS_HIGH_MWH
    single_outlier  = (not sustained_spike) and current_price >= PRICE_ABS_HIGH_MWH

    if spike_by_abs or spike_by_pct:
        # Severity based on price level
        if current_price >= 500:
            severity = "high"
            title    = "Extreme Price Event Detected"
            message  = (
                f"ERCOT Houston Hub reached ${current_price:.0f}/MWh"
                + (f", a {pct_display} move from ${prev_price:.0f}/MWh in the last interval." if pct_change is not None else ".")
                + " Sustained high-price conditions are active across consecutive readings."
            )
            impact   = "Extreme price levels are persisting. Elevated short-term risk is confirmed."
        else:
            severity = "medium"
            title    = "ERCOT Volatility Detected"
            message  = (
                f"Prices moved from ${prev_price:.0f} to ${current_price:.0f}/MWh"
                + (f" ({pct_display} change)" if pct_change is not None else "")
                + " within the last interval, indicating increased instability in real-time pricing."
                + (" Movement is sustained across multiple readings." if sustained_spike else "")
            )
            impact   = "Short-term price volatility risk is elevated. Monitor for further movement."

        return _signal("price_volatility", "VOLATILITY", True, severity,
                       None, title, current_price, PRICE_ABS_HIGH_MWH, message, impact)

    # Single unconfirmed outlier — flag but don't trigger
    if single_outlier:
        return _signal(
            "price_volatility", "VOLATILITY", False, "low", None,
            "Transient Price Movement",
            current_price, PRICE_ABS_HIGH_MWH,
            f"ERCOT price reached ${current_price:.0f}/MWh but movement is not yet sustained across consecutive readings.",
            "Monitoring for confirmation. Single-interval spikes are filtered to reduce noise.",
        )

    # Normal — outside-normal-range flag if close to threshold
    if current_price >= PRICE_ABS_HIGH_MWH * 0.7:
        msg = (f"ERCOT Houston Hub at ${current_price:.0f}/MWh — approaching elevated range."
               + (f" {pct_display} vs previous interval." if pct_change is not None else ""))
        impact = "Price is nearing the volatility threshold. Continue monitoring."
        return _signal("price_volatility", "VOLATILITY", False, "low", None,
                       "Price Approaching Threshold",
                       current_price, PRICE_ABS_HIGH_MWH, msg, impact)

    pct_note = f" {pct_display} vs previous interval." if pct_change is not None else ""
    return _signal(
        "price_volatility", "VOLATILITY", False, "low", None,
        "Price Within Normal Range",
        current_price, PRICE_ABS_HIGH_MWH,
        f"ERCOT Houston Hub at ${current_price:.0f}/MWh — within normal operating range.{pct_note}",
        "No price-based risk signals active.",
    )


def check_weather_demand(forecasts: List[Dict]) -> Dict[str, Any]:
    """Task 2 — Stronger signal wording for weather events."""
    if not forecasts:
        return _signal("weather_demand", "WEATHER", False, "low", None,
                       "Awaiting Weather Data", None, TEMP_HIGH_THRESHOLD_F,
                       "No weather forecast data available.",
                       "Weather-based demand signals will activate once forecast data loads.")

    tomorrow = forecasts[0]
    high_f   = float(tomorrow.get("temp_high_f", 75))
    low_f    = float(tomorrow.get("temp_low_f", 55))
    location = tomorrow.get("location_name", "Texas")

    if high_f >= TEMP_HIGH_THRESHOLD_F:
        severity = "high" if high_f >= 105 else "medium"
        title    = "Extreme Heat Demand Alert" if high_f >= 105 else "Heat Demand Risk Elevated"
        message  = (
            f"Forecast high of {high_f:.0f}°F in {location} on the next forecast day "
            f"will drive elevated cooling demand across the Texas grid. "
            f"Historical patterns show peak ERCOT load increases sharply above 100°F."
        )
        impact   = (
            "Grid demand is expected to rise significantly. Tight reserve margins are possible during peak afternoon hours."
            if high_f >= 105 else
            "Elevated cooling demand may pressure real-time prices during peak afternoon hours."
        )
        return _signal("weather_demand", "WEATHER", True, severity, None,
                       title, high_f, TEMP_HIGH_THRESHOLD_F, message, impact)

    if low_f <= TEMP_LOW_THRESHOLD_F:
        severity = "high" if low_f <= 20 else "medium"
        title    = "Freeze Event Risk" if low_f <= 20 else "Cold Weather Demand Elevated"
        message  = (
            f"Forecast low of {low_f:.0f}°F in {location} is expected to drive elevated "
            f"heating demand. Cold weather events historically increase grid stress and "
            f"natural gas demand simultaneously."
        )
        impact   = (
            "Severe freeze risk. Grid stress and fuel supply pressure may compound."
            if low_f <= 20 else
            "Elevated heating demand may tighten reserve margins overnight."
        )
        return _signal("weather_demand", "WEATHER", True, severity, None,
                       title, low_f, TEMP_LOW_THRESHOLD_F, message, impact)

    return _signal(
        "weather_demand", "WEATHER", False, "low", None,
        "Normal Weather Conditions",
        high_f, TEMP_HIGH_THRESHOLD_F,
        f"Forecast high of {high_f:.0f}°F in {location} — demand conditions appear normal.",
        "No weather-driven demand signals active.",
    )


def check_gas_supply(gas_records: List[Dict]) -> Dict[str, Any]:
    """Task 2 — Stronger, data-driven gas supply signal wording."""
    if not gas_records:
        return _signal("gas_supply", "GAS", False, "low", None,
                       "Awaiting Storage Data", None, GAS_STORAGE_PCT_THRESHOLD,
                       "No natural gas storage data available.",
                       "Gas supply signals will activate once EIA storage data loads.")

    latest = gas_records[-1]
    pct    = float(latest.get("storage_pct_vs_avg", 0))
    bcf    = latest.get("storage_bcf", "N/A")
    price  = latest.get("henry_hub_price")

    price_note = f" Henry Hub at ${price:.2f}/MMBtu." if price else ""

    if pct <= GAS_STORAGE_PCT_THRESHOLD:
        severity = "high" if pct <= -20 else "medium"
        title    = "Critical Gas Supply Deficit" if pct <= -20 else "Gas Storage Below Average"
        message  = (
            f"Working gas storage stands at {bcf} Bcf — {abs(pct):.1f}% below the 5-year "
            f"seasonal average.{price_note} Below-average storage increases sensitivity to "
            f"supply disruptions and can pressure real-time gas and power prices."
        )
        impact   = (
            "Supply deficit is severe. Gas-fired generation constraints are possible."
            if pct <= -20 else
            "Below-average storage reduces the buffer against demand spikes or supply disruptions."
        )
        return _signal("gas_supply", "GAS", True, severity, None,
                       title, pct, GAS_STORAGE_PCT_THRESHOLD, message, impact)

    surplus_note = "above" if pct >= 0 else "below"
    return _signal(
        "gas_supply", "GAS", False, "low", None,
        "Gas Supply Normal",
        pct, GAS_STORAGE_PCT_THRESHOLD,
        f"Working gas storage at {bcf} Bcf — {abs(pct):.1f}% {surplus_note} the 5-year average.{price_note}",
        "Natural gas supply conditions appear stable.",
    )


# ──────────────────────────────────────────────────────────────────────────────
# Tasks 3, 4 — Dynamic risk explanation + "why it matters"
# ──────────────────────────────────────────────────────────────────────────────

def _generate_explanation(risk_score: str, signals: List[Dict]) -> str:
    """Task 3 — Driver-specific risk explanation."""
    triggered = [s for s in signals if s.get("triggered")]
    labels = {
        "price_volatility": "ERCOT price volatility",
        "weather_demand":   "weather-driven demand pressure",
        "gas_supply":       "natural gas supply tightness",
    }
    stable = {
        "price_volatility": "ERCOT prices are stable",
        "weather_demand":   "weather demand is normal",
        "gas_supply":       "natural gas supply is adequate",
    }
    all_types = {"price_volatility", "weather_demand", "gas_supply"}
    triggered_types = {s["signal_type"] for s in triggered}
    stable_types    = all_types - triggered_types

    if risk_score == "high":
        driver_str = " and ".join(labels[t] for t in triggered_types if t in labels)
        stable_str = ", ".join(stable[t] for t in stable_types if t in stable)
        base = f"High risk due to simultaneous {driver_str}."
        return base + (f" {stable_str.capitalize()}." if stable_str else "")

    elif risk_score == "medium" and triggered:
        t = triggered[0]["signal_type"]
        stable_str = " and ".join(stable[s] for s in stable_types if s in stable)
        base = f"Medium risk due to {labels.get(t, t)}."
        return base + (f" {stable_str.capitalize()}." if stable_str else "")

    else:
        return "All monitored risk drivers — price, weather, and gas supply — are within normal ranges."


def _generate_impact(risk_score: str, signals: List[Dict]) -> str:
    """Task 4 — 'Why it matters' sentence."""
    triggered = [s for s in signals if s.get("triggered")]

    if risk_score == "high":
        return ("Multiple converging risk signals are active. "
                "Short-term grid conditions warrant close monitoring.")
    elif risk_score == "medium" and triggered:
        t = triggered[0]["signal_type"]
        if t == "price_volatility":
            return "Short-term price volatility risk is elevated. Monitor conditions before making energy commitments."
        elif t == "weather_demand":
            return "Weather-driven demand may pressure grid reserves during peak hours. Monitor ERCOT conditions."
        elif t == "gas_supply":
            return "Below-average gas storage reduces supply buffers. Sensitivity to demand spikes is elevated."
    return "No active risk drivers identified. Market conditions appear stable at this time."


def _generate_summary(risk_score: str, signals: List[Dict]) -> str:
    """AI-style narrative combining explanation + impact. Informational only."""
    explanation = _generate_explanation(risk_score, signals)
    impact      = _generate_impact(risk_score, signals)
    return f"{explanation} {impact} This is situational awareness — not a trading signal."


# ──────────────────────────────────────────────────────────────────────────────
# Composite risk score
# ──────────────────────────────────────────────────────────────────────────────

def compute_risk_score(signals: List[Dict]) -> Tuple[str, int]:
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
    """
    Master function — runs all detectors and returns a professional risk snapshot.

    Task 4/8: Validates data integrity before firing any signal.
    If data is invalid/unavailable, returns a failsafe response that
    disables the risk score and shows 'Live data unavailable. Monitoring paused.'
    """
    # ── Task 4: Validate data before anything else ────────────────────────────
    data_valid, data_status = _validate_data(prices)

    logger.info(
        "[SIGNALS] data_valid=%s data_status=%s prices=%d forecasts=%d gas=%d",
        data_valid, data_status, len(prices), len(forecasts), len(gas_records)
    )

    if not data_valid:
        # Task 8: Return failsafe — no signals, no risk score
        result = _failsafe_response()
        result["data_status"] = data_status
        return result

    # ── Normal path — data is valid ───────────────────────────────────────────
    price_signal   = check_price_volatility(prices)
    weather_signal = check_weather_demand(forecasts)
    gas_signal     = check_gas_supply(gas_records)

    all_signals               = [price_signal, weather_signal, gas_signal]
    risk_score, active_count  = compute_risk_score(all_signals)

    # Inject confidence into each signal after all signals are computed
    confidence = _compute_confidence(prices, all_signals)
    for sig in all_signals:
        if sig.get("triggered") and sig.get("confidence") is None:
            sig["confidence"] = confidence
        elif not sig.get("triggered"):
            sig["confidence"] = max(confidence - 20, 40)

    explanation = _generate_explanation(risk_score, all_signals)
    impact      = _generate_impact(risk_score, all_signals)

    # Task 7 — Debug log per signal
    for sig in all_signals:
        logger.info(
            "[SIGNAL DEBUG] type=%s triggered=%s severity=%s value=%s confidence=%s",
            sig.get("signal_type"), sig.get("triggered"),
            sig.get("severity"), sig.get("value"), sig.get("confidence")
        )

    return {
        "computed_at":    _utcnow().isoformat(),
        "risk_score":     risk_score,
        "active_signals": active_count,
        "confidence":     confidence,
        "explanation":    explanation,
        "impact":         impact,
        "data_valid":     True,
        "data_status":    data_status,
        "signals": {
            "price_volatility": price_signal,
            "weather_demand":   weather_signal,
            "gas_supply":       gas_signal,
        },
        "summary":     _generate_summary(risk_score, all_signals),
        "disclaimer": (
            "This information is provided for situational awareness only. "
            "It does not constitute investment, trading, or procurement advice. "
            "Risk may be rising — consult qualified advisors before making decisions."
        ),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _signal(signal_type: str, sig_type: str, triggered: bool, severity: str,
            confidence: int | None, title: str, value, threshold,
            message: str, impact: str) -> Dict[str, Any]:
    """Task 8 — Standardized signal output format."""
    return {
        # New standardized fields
        "type":        sig_type,
        "title":       title,
        "message":     message,
        "impact":      impact,
        "confidence":  confidence,
        # Existing fields (backward-compatible)
        "signal_type": signal_type,
        "triggered":   triggered,
        "severity":    severity,
        "value":       value,
        "threshold":   threshold,
        "computed_at": _utcnow().isoformat(),
    }
