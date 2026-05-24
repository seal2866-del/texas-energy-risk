"""
signal_engine.py
Professional risk intelligence engine for Texas energy market conditions.
Produces structured analyst-style signals with primary drivers, risk direction,
time horizons, and business-impact statements.

LEGAL NOTE: All output is informational only. No trading,
procurement, or investment advice is expressed or implied.
"""
import logging
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


# ── Thresholds ────────────────────────────────────────────────────────────────
PRICE_SPIKE_THRESHOLD_PCT = 50.0
PRICE_ABS_HIGH_MWH        = 150.0
PRICE_LOW_FLOOR           = 10.0
TEMP_HIGH_THRESHOLD_F     = 100.0
TEMP_LOW_THRESHOLD_F      = 28.0
GAS_STORAGE_PCT_THRESHOLD = -10.0

# ── Data validation constants ─────────────────────────────────────────────────
DATA_FRESHNESS_MINUTES = 15
DATA_MIN_REAL_POINTS   = 2
MOCK_SOURCES           = {"mock", "mock_data", "generated", "demo", None, ""}

# ── Severity rank for driver comparison ──────────────────────────────────────
_SEVERITY_RANK = {"high": 2, "medium": 1, "low": 0}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────────────────────────────────────
# Data validation layer
# ──────────────────────────────────────────────────────────────────────────────

def _validate_data(prices: List[Dict]) -> Tuple[bool, str]:
    """
    Validates ERCOT price data before signals fire.
    Returns (is_valid, status_message).
    Requirements:
    1. At least DATA_MIN_REAL_POINTS consecutive real datapoints
    2. Latest reading is fresh (< DATA_FRESHNESS_MINUTES old)
    3. No mock sources
    """
    if not prices:
        logger.warning("[VALIDATE] No price data — failsafe active")
        return False, "no_data"

    real_prices = [p for p in prices if p.get("source") not in MOCK_SOURCES]

    if len(real_prices) < DATA_MIN_REAL_POINTS:
        got = len(real_prices)
        logger.warning(
            "[VALIDATE] Insufficient real data: %d/%d real readings — failsafe active",
            got, DATA_MIN_REAL_POINTS
        )
        return False, ("mock_only" if got == 0 else f"building_cache_{got}_of_{DATA_MIN_REAL_POINTS}")

    latest  = prices[-1]
    ts_raw  = latest.get("timestamp", "")
    age_minutes = 0.0
    try:
        ts          = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
        age_minutes = (_utcnow() - ts).total_seconds() / 60
        if age_minutes > DATA_FRESHNESS_MINUTES:
            logger.warning("[VALIDATE] Stale data: %.1f min old — failsafe active", age_minutes)
            return False, f"stale_{age_minutes:.0f}m"
    except Exception as exc:
        logger.warning("[VALIDATE] Cannot parse timestamp '%s': %s", ts_raw, exc)
        return False, "bad_timestamp"

    logger.debug(
        "[VALIDATE] Data valid: %d real readings, latest %.1f min old, source=%s",
        len(real_prices), age_minutes, latest.get("source")
    )
    return True, "valid"


def _failsafe_response() -> Dict[str, Any]:
    """Returned when real data is unavailable. Disables risk score and all signals."""
    now = _utcnow().isoformat()
    paused = _signal(
        signal_type="unavailable", sig_type="UNAVAILABLE",
        triggered=False, severity="low", confidence=None,
        title="Monitoring Paused", value=None, threshold=None,
        time_horizon="Short-term (0–24h): unavailable · Near-term (24–72h): unavailable",
        message="Live data unavailable. Monitoring paused.",
        impact="Signals will resume automatically once real-time data is confirmed.",
    )
    return {
        "computed_at":        now,
        "risk_score":         "low",
        "active_signals":     0,
        "confidence":         None,
        "explanation":        "Live data unavailable. Monitoring paused.",
        "impact":             "Risk signals are suppressed until real-time data is confirmed.",
        "primary_driver":     "None",
        "primary_driver_type": "none",
        "risk_direction":     "stable",
        "secondary_factors":  [],
        "data_valid":         False,
        "data_status":        "unavailable",
        "signals": {
            "price_volatility": paused,
            "weather_demand":   paused,
            "gas_supply":       paused,
        },
        "summary":    "Live data unavailable. Monitoring paused. Signals will resume automatically once real-time ERCOT data is confirmed.",
        "disclaimer": (
            "This information is provided for situational awareness only. "
            "It does not constitute investment, trading, or procurement advice."
        ),
    }


def _awaiting_signal(signal_type: str, sig_type: str, status: str) -> Dict[str, Any]:
    reading_count = 0
    if "building_cache_" in status:
        try:
            reading_count = int(status.split("_")[2])
        except Exception:
            pass

    if status == "mock_only":
        title   = "Awaiting Real-Time Data"
        message = "Real-time data feed is initializing. Mock data has been excluded."
    elif "building_cache" in status:
        title   = "Building Data Cache"
        message = (
            f"Accumulating real-time readings ({reading_count}/{DATA_MIN_REAL_POINTS} received), "
            "indicating that signal analysis will activate once consecutive verified data points are available."
        )
    elif "stale" in status:
        title   = "Data Feed Interrupted"
        message = "Last real-time reading is older than expected, suggesting a temporary feed interruption."
    else:
        title   = "Monitoring Paused"
        message = "Live data unavailable. Monitoring paused."

    return _signal(
        signal_type=signal_type, sig_type=sig_type,
        triggered=False, severity="low", confidence=None,
        title=title, value=None, threshold=None,
        time_horizon="Short-term (0–24h): pending · Near-term (24–72h): pending",
        message=message,
        impact="Signals will activate automatically once verified data is available.",
    )


# ──────────────────────────────────────────────────────────────────────────────
# Price change helpers
# ──────────────────────────────────────────────────────────────────────────────

def _safe_pct_change(current: float, previous: float) -> Tuple[Optional[float], str]:
    """Guards against divide-by-small-number (prev < PRICE_LOW_FLOOR)."""
    if previous < PRICE_LOW_FLOOR:
        return None, "Large movement detected"
    pct  = ((current - previous) / previous) * 100
    sign = "+" if pct >= 0 else ""
    return pct, f"{sign}{pct:.1f}%"


def _validate_spike(prices: List[Dict], window: int = 2) -> bool:
    """Require spike to persist across N consecutive intervals."""
    if len(prices) < window:
        return False
    recent = prices[-window:]
    return sum(1 for p in recent if float(p["price_mwh"]) >= PRICE_ABS_HIGH_MWH) >= window


# ──────────────────────────────────────────────────────────────────────────────
# Confidence scoring
# ──────────────────────────────────────────────────────────────────────────────

def _compute_confidence(prices: List[Dict], all_signals: List[Dict]) -> int:
    confidence = 50

    if len(prices) >= 3:
        recent = [float(p["price_mwh"]) for p in prices[-3:]]
        avg    = sum(recent) / len(recent)
        if sum(1 for p in recent if p >= PRICE_ABS_HIGH_MWH) >= 2:
            confidence += 20
        elif sum(1 for p in recent if abs(p - avg) / max(avg, 1) > 0.30) >= 2:
            confidence += 20
        else:
            confidence += 5

    if len([s for s in all_signals if s.get("triggered")]) >= 2:
        confidence += 10

    if prices and prices[-1].get("source") not in MOCK_SOURCES:
        confidence += 10

    return min(confidence, 90)


# ──────────────────────────────────────────────────────────────────────────────
# Task 1 — Primary Driver
# ──────────────────────────────────────────────────────────────────────────────

_DRIVER_LABELS = {
    "price_volatility": "Market volatility",
    "weather_demand":   "Weather-driven demand",
    "gas_supply":       "Supply pressure",
}

def _determine_primary_driver(signals: List[Dict]) -> Tuple[str, str]:
    """
    Returns (driver_type, display_label).
    Triggered high > triggered medium > approaching threshold > none.
    """
    triggered = [s for s in signals if s.get("triggered")]

    if triggered:
        best = max(triggered, key=lambda s: _SEVERITY_RANK.get(s.get("severity", "low"), 0))
        t    = best.get("signal_type", "")
        return t, _DRIVER_LABELS.get(t, t)

    # No triggered signals — check for approaching conditions
    for s in signals:
        if s.get("signal_type") == "price_volatility":
            val = s.get("value") or 0
            if val >= PRICE_ABS_HIGH_MWH * 0.7:
                return "price_volatility", "Market volatility (approaching threshold)"
        if s.get("signal_type") == "weather_demand":
            val = s.get("value") or 0
            if val >= TEMP_HIGH_THRESHOLD_F * 0.9:
                return "weather_demand", "Weather-driven demand (building)"

    return "none", "No active risk drivers"


# ──────────────────────────────────────────────────────────────────────────────
# Task 2 — Risk Direction
# ──────────────────────────────────────────────────────────────────────────────

def _determine_risk_direction(prices: List[Dict], signals: List[Dict]) -> str:
    """
    Returns 'increasing', 'stable', or 'decreasing'.
    Combines price trend with signal severity.
    """
    triggered    = [s for s in signals if s.get("triggered")]
    high_active  = any(s.get("severity") == "high" for s in triggered)
    multi_active = len(triggered) >= 2

    # Price trend
    price_trend = "flat"
    if len(prices) >= 3:
        vals      = [float(p["price_mwh"]) for p in prices[-3:]]
        pct_delta = ((vals[-1] - vals[0]) / max(vals[0], 1)) * 100
        if pct_delta > 8:
            price_trend = "rising"
        elif pct_delta < -8:
            price_trend = "falling"

    if high_active or multi_active:
        return "increasing" if price_trend in ("rising", "flat") else "stable"

    if triggered:
        if price_trend == "rising":
            return "increasing"
        if price_trend == "falling":
            return "decreasing"
        return "stable"

    # No triggers
    if price_trend == "falling":
        return "decreasing"
    return "stable"


# ──────────────────────────────────────────────────────────────────────────────
# Task 5 — Secondary Factors
# ──────────────────────────────────────────────────────────────────────────────

def _secondary_factors(signals: List[Dict], primary_type: str) -> List[str]:
    """Returns descriptive labels for non-primary signals."""
    label_map = {
        "price_volatility": {True: "Elevated price volatility",   False: "Stable ERCOT pricing"},
        "weather_demand":   {True: "Elevated weather demand",     False: "Normal weather conditions"},
        "gas_supply":       {True: "Gas supply below average",    False: "Adequate gas supply"},
    }
    factors = []
    for s in signals:
        sig_type = s.get("signal_type", "")
        if sig_type == primary_type:
            continue
        triggered = s.get("triggered", False)
        factors.append(label_map.get(sig_type, {}).get(triggered, sig_type))
    return factors


# ──────────────────────────────────────────────────────────────────────────────
# Individual signal detectors
# ──────────────────────────────────────────────────────────────────────────────

def check_price_volatility(prices: List[Dict]) -> Dict[str, Any]:
    """Tasks 1,2,6,7 — Validated, time-horizon aware, analyst-language price signal."""
    if not prices or len(prices) < 2:
        return _signal(
            "price_volatility", "VOLATILITY", False, "low", 40,
            "Awaiting Price Data", None, PRICE_ABS_HIGH_MWH,
            "Short-term (0–24h): monitoring · Near-term (24–72h): monitoring",
            "Insufficient price data to assess volatility.",
            "Monitoring will begin once two consecutive readings are available.",
        )

    current = float(prices[-1]["price_mwh"])
    prev    = float(prices[-2]["price_mwh"])

    pct_change, pct_display = _safe_pct_change(current, prev)
    pct_abs         = abs(pct_change) if pct_change is not None else None
    sustained_spike = _validate_spike(prices, window=2)
    spike_by_pct    = pct_abs is not None and pct_abs >= PRICE_SPIKE_THRESHOLD_PCT
    spike_by_abs    = sustained_spike and current >= PRICE_ABS_HIGH_MWH
    single_outlier  = (not sustained_spike) and current >= PRICE_ABS_HIGH_MWH

    if spike_by_abs or spike_by_pct:
        if current >= 500:
            return _signal(
                "price_volatility", "VOLATILITY", True, "high", None,
                "Extreme Price Event",
                current, PRICE_ABS_HIGH_MWH,
                "Short-term (0–24h): extreme volatility active · Near-term (24–72h): monitor for price relief",
                (
                    f"ERCOT Houston Hub reached ${current:.0f}/MWh"
                    + (f", reflecting a {pct_display} move from ${prev:.0f}/MWh." if pct_change is not None else ".")
                    + " Sustained extreme pricing is confirmed across consecutive intervals,"
                      " indicating constrained grid conditions."
                ),
                "Sustained extreme prices may signal severe supply-demand imbalance, increasing the likelihood"
                " of continued volatility and potential grid stress over the next 24 hours.",
            )
        return _signal(
            "price_volatility", "VOLATILITY", True, "medium", None,
            "ERCOT Price Volatility Active",
            current, PRICE_ABS_HIGH_MWH,
            "Short-term (0–24h): elevated volatility · Near-term (24–72h): monitor for stabilisation",
            (
                f"ERCOT prices moved from ${prev:.0f} to ${current:.0f}/MWh"
                + (f" ({pct_display})" if pct_change is not None else "")
                + ", indicating increased instability in real-time settlement pricing."
                + (" Movement is sustained across consecutive readings, reflecting persistent pressure." if sustained_spike else "")
            ),
            f"Elevated ERCOT prices may reflect a tightening supply-demand balance, increasing the likelihood"
            f" of further price movement over the next 24–48 hours.",
        )

    if single_outlier:
        return _signal(
            "price_volatility", "VOLATILITY", False, "low", None,
            "Transient Price Movement",
            current, PRICE_ABS_HIGH_MWH,
            "Short-term (0–24h): elevated but unconfirmed · Near-term (24–72h): monitoring",
            f"ERCOT price reached ${current:.0f}/MWh, suggesting a transient spike."
            " Movement is not yet confirmed across consecutive readings, indicating a potential outlier.",
            "Monitoring for confirmation. Single-interval spikes are filtered to reduce noise.",
        )

    if current >= PRICE_ABS_HIGH_MWH * 0.7:
        pct_note = f" {pct_display} vs previous interval." if pct_change is not None else ""
        return _signal(
            "price_volatility", "VOLATILITY", False, "low", None,
            "Price Approaching Threshold",
            current, PRICE_ABS_HIGH_MWH,
            "Short-term (0–24h): within range, approaching threshold · Near-term (24–72h): monitor closely",
            f"ERCOT Houston Hub at ${current:.0f}/MWh, approaching the elevated-risk threshold.{pct_note}"
            " Conditions suggest rising but not yet confirmed volatility.",
            "Continued price movement may push conditions into an elevated risk zone within the next 24 hours.",
        )

    pct_note = f" {pct_display} vs previous interval." if pct_change is not None else ""
    return _signal(
        "price_volatility", "VOLATILITY", False, "low", None,
        "ERCOT Pricing Stable",
        current, PRICE_ABS_HIGH_MWH,
        "Short-term (0–24h): stable · Near-term (24–72h): no immediate risk",
        f"ERCOT Houston Hub at ${current:.0f}/MWh, reflecting normal operating conditions.{pct_note}"
        " Current pricing indicates low immediate volatility risk.",
        "No price-based risk signals active. Stable conditions are expected to persist short-term.",
    )


def check_weather_demand(forecasts: List[Dict]) -> Dict[str, Any]:
    """Tasks 2,6,7 — Analyst-language weather demand signal with time horizons."""
    if not forecasts:
        return _signal(
            "weather_demand", "WEATHER", False, "low", None,
            "Awaiting Weather Data", None, TEMP_HIGH_THRESHOLD_F,
            "Short-term (0–24h): monitoring · Near-term (24–72h): monitoring",
            "No weather forecast data available.",
            "Weather-based demand signals will activate once forecast data loads.",
        )

    tomorrow = forecasts[0]
    high_f   = float(tomorrow.get("temp_high_f", 75))
    low_f    = float(tomorrow.get("temp_low_f",  55))
    location = tomorrow.get("location_name", "Texas")

    if high_f >= TEMP_HIGH_THRESHOLD_F:
        if high_f >= 105:
            return _signal(
                "weather_demand", "WEATHER", True, "high", None,
                "Extreme Heat — Grid Load Alert",
                high_f, TEMP_HIGH_THRESHOLD_F,
                "Short-term (0–24h): extreme demand expected · Near-term (24–72h): sustained heat stress likely",
                f"Forecast high of {high_f:.0f}°F in {location} indicates extreme cooling demand across the Texas grid."
                " Historical data reflects sharp ERCOT load increases above 105°F, suggesting tight reserve margins.",
                f"Extreme temperatures may significantly increase grid load and tighten reserve margins,"
                f" increasing the likelihood of short-term price volatility over the next 24–48 hours.",
            )
        return _signal(
            "weather_demand", "WEATHER", True, "medium", None,
            "Heat Demand Risk Elevated",
            high_f, TEMP_HIGH_THRESHOLD_F,
            "Short-term (0–24h): elevated demand during peak hours · Near-term (24–72h): continued heat risk",
            f"Forecast high of {high_f:.0f}°F in {location} indicates elevated cooling demand."
            " Temperatures above 100°F reflect a pattern of increased ERCOT load during peak afternoon hours.",
            f"Elevated temperatures may increase grid load, increasing the likelihood of price pressure"
            f" during peak afternoon hours over the next 24 hours.",
        )

    if low_f <= TEMP_LOW_THRESHOLD_F:
        if low_f <= 20:
            return _signal(
                "weather_demand", "WEATHER", True, "high", None,
                "Freeze Event Risk",
                low_f, TEMP_LOW_THRESHOLD_F,
                "Short-term (0–24h): severe heating demand · Near-term (24–72h): freeze conditions possible",
                f"Forecast low of {low_f:.0f}°F in {location} indicates severe freeze risk."
                " Extreme cold reflects compounding grid stress from elevated heating demand and potential gas supply constraints.",
                "Severe freeze conditions may simultaneously stress gas-fired generation and heating demand,"
                " increasing the likelihood of supply-side constraints over the next 48–72 hours.",
            )
        return _signal(
            "weather_demand", "WEATHER", True, "medium", None,
            "Cold Weather Demand Elevated",
            low_f, TEMP_LOW_THRESHOLD_F,
            "Short-term (0–24h): elevated heating demand · Near-term (24–72h): continued cold risk",
            f"Forecast low of {low_f:.0f}°F in {location} indicates elevated heating demand."
            " Cold weather reflects increased overnight grid stress and natural gas consumption.",
            "Elevated heating demand may tighten reserve margins overnight, increasing the likelihood"
            " of price pressure during peak morning hours over the next 24 hours.",
        )

    return _signal(
        "weather_demand", "WEATHER", False, "low", None,
        "Normal Weather Conditions",
        high_f, TEMP_HIGH_THRESHOLD_F,
        "Short-term (0–24h): normal demand · Near-term (24–72h): no weather risk",
        f"Forecast high of {high_f:.0f}°F in {location}, reflecting normal seasonal conditions."
        " Current temperatures indicate no weather-driven demand pressure on the grid.",
        "No weather-driven demand signals active. Demand conditions are expected to remain stable.",
    )


def check_gas_supply(gas_records: List[Dict]) -> Dict[str, Any]:
    """Tasks 2,6,7 — Analyst-language gas supply signal with time horizons."""
    if not gas_records:
        return _signal(
            "gas_supply", "GAS", False, "low", None,
            "Awaiting Storage Data", None, GAS_STORAGE_PCT_THRESHOLD,
            "Short-term (0–24h): monitoring · Near-term (24–72h): monitoring",
            "No natural gas storage data available.",
            "Gas supply signals will activate once EIA storage data loads.",
        )

    latest    = gas_records[-1]
    pct       = float(latest.get("storage_pct_vs_avg", 0))
    bcf       = latest.get("storage_bcf", "N/A")
    price     = latest.get("henry_hub_price")
    price_note = f" Henry Hub at ${price:.2f}/MMBtu." if price else ""

    if pct <= GAS_STORAGE_PCT_THRESHOLD:
        if pct <= -20:
            return _signal(
                "gas_supply", "GAS", True, "high", None,
                "Critical Gas Supply Deficit",
                pct, GAS_STORAGE_PCT_THRESHOLD,
                "Short-term (0–24h): supply buffer severely reduced · Near-term (24–72h): sensitive to demand spikes",
                f"Working gas storage stands at {bcf} Bcf — {abs(pct):.1f}% below the 5-year seasonal average.{price_note}"
                f" A deficit of this magnitude reflects critical supply tightness, suggesting"
                f" elevated sensitivity to any demand surge or supply disruption.",
                f"Critical gas storage deficit may constrain fuel supply for gas-fired generation,"
                f" increasing the likelihood of supply-side stress during demand peaks over the next 48–72 hours.",
            )
        return _signal(
            "gas_supply", "GAS", True, "medium", None,
            "Gas Storage Below Seasonal Average",
            pct, GAS_STORAGE_PCT_THRESHOLD,
            "Short-term (0–24h): supply buffer reduced · Near-term (24–72h): sensitivity elevated",
            f"Working gas storage at {bcf} Bcf — {abs(pct):.1f}% below the 5-year average.{price_note}"
            f" Below-average storage indicates a reduced supply buffer,"
            f" suggesting increased sensitivity to demand spikes or supply disruptions.",
            f"Below-average gas storage may reduce the supply buffer, increasing the likelihood"
            f" of price sensitivity during any demand surge over the next 48–72 hours.",
        )

    surplus = "above" if pct >= 0 else "below"
    return _signal(
        "gas_supply", "GAS", False, "low", None,
        "Gas Supply Adequate",
        pct, GAS_STORAGE_PCT_THRESHOLD,
        "Short-term (0–24h): adequate supply · Near-term (24–72h): stable outlook",
        f"Working gas storage at {bcf} Bcf — {abs(pct):.1f}% {surplus} the 5-year average.{price_note}"
        f" Storage levels reflect adequate supply buffer, indicating no near-term fuel supply risk.",
        "Natural gas supply conditions appear stable. No supply-side risk signals are active.",
    )


# ──────────────────────────────────────────────────────────────────────────────
# Tasks 3, 4 — Structured analyst summary + business impact
# ──────────────────────────────────────────────────────────────────────────────

def _generate_summary(
    risk_score:      str,
    signals:         List[Dict],
    primary_driver:  str,
    risk_direction:  str,
) -> str:
    """Task 3 — 4-part analyst-style structured summary."""
    risk_label = risk_score.capitalize()

    direction_phrase = {
        "increasing": "is gradually increasing",
        "stable":     "remains stable",
        "decreasing": "is improving",
    }.get(risk_direction, "remains stable")

    # Context sentences — what each data stream is doing
    context_parts = []
    price_sig   = next((s for s in signals if s.get("signal_type") == "price_volatility"), None)
    weather_sig = next((s for s in signals if s.get("signal_type") == "weather_demand"),   None)
    gas_sig     = next((s for s in signals if s.get("signal_type") == "gas_supply"),        None)

    if price_sig:
        val = price_sig.get("value") or 0
        if price_sig.get("triggered"):
            context_parts.append(f"ERCOT pricing is elevated at ${val:.0f}/MWh, reflecting active volatility")
        else:
            context_parts.append(f"ERCOT pricing remains stable at ${val:.0f}/MWh")

    if weather_sig:
        val = weather_sig.get("value") or 0
        if weather_sig.get("triggered"):
            context_parts.append(f"temperatures of {val:.0f}°F are driving elevated grid load")
        else:
            context_parts.append("weather conditions are within normal operating range")

    if gas_sig:
        val = gas_sig.get("value") or 0
        if gas_sig.get("triggered"):
            context_parts.append(
                f"natural gas storage stands {abs(val):.1f}% below the 5-year average, suggesting supply tightness"
            )
        else:
            context_parts.append("natural gas supply conditions appear adequate")

    if context_parts:
        context = context_parts[0].capitalize()
        if len(context_parts) >= 2:
            context += f" while {context_parts[1]}"
        if len(context_parts) >= 3:
            context += f", and {context_parts[2]}"
        context += "."
    else:
        context = ""

    return (
        f"Short-term energy risk is {risk_label}. "
        f"This is primarily driven by {primary_driver}. "
        f"{context} "
        f"Short-term (24–48 hours) outlook: risk {direction_phrase}. "
        f"This is situational awareness — not a trading signal."
    ).strip()


def _generate_impact(
    risk_score:          str,
    signals:             List[Dict],
    primary_driver_type: str = "none",
) -> str:
    """Task 4 — Business-impact statement: [Driver] → [grid/pricing impact] → [risk outcome] + [time horizon]."""
    triggered = [s for s in signals if s.get("triggered")]

    if not triggered:
        return (
            "All monitored risk drivers are within normal operating ranges. "
            "No near-term risk elevation detected. Conditions are expected to remain stable "
            "over the short-term (0–24h) and near-term (24–72h) outlook."
        )

    _impact_templates = {
        "weather_demand": {
            "high":   (
                "Extreme temperatures may significantly increase grid load and tighten reserve margins, "
                "increasing the likelihood of short-term price volatility over the next 24–48 hours."
            ),
            "medium": (
                "Elevated temperatures may increase grid load and pressure peak-hour pricing, "
                "increasing the likelihood of reserve margin tightening over the next 24 hours."
            ),
        },
        "price_volatility": {
            "high":   (
                "Sustained ERCOT price spikes may signal constrained grid conditions, "
                "increasing the likelihood of continued volatility and potential supply stress over the next 24 hours."
            ),
            "medium": (
                "Elevated ERCOT prices may reflect a tightening supply-demand balance, "
                "increasing the likelihood of further price movement over the next 24–48 hours."
            ),
        },
        "gas_supply": {
            "high":   (
                "A critical gas storage deficit may constrain fuel supply for gas-fired generation, "
                "increasing the likelihood of supply-side stress during demand peaks over the next 48–72 hours."
            ),
            "medium": (
                "Below-average gas storage may reduce the supply buffer, "
                "increasing the likelihood of price sensitivity during any demand surge over the next 48–72 hours."
            ),
        },
    }

    if risk_score == "high" and len(triggered) >= 2:
        return (
            "Multiple converging risk signals are active, increasing the likelihood of "
            "short-term grid stress and price volatility over the next 24–48 hours. "
            "Conditions warrant close monitoring."
        )

    # Use primary driver if available, otherwise first triggered
    target = next(
        (s for s in triggered if s.get("signal_type") == primary_driver_type),
        triggered[0]
    )
    sig_type = target.get("signal_type", "")
    severity = target.get("severity", "medium")

    if sig_type in _impact_templates:
        return _impact_templates[sig_type].get(severity, _impact_templates[sig_type]["medium"])

    return "Active risk signals detected. Monitor conditions closely over the next 24–48 hours."


def _generate_explanation(risk_score: str, signals: List[Dict]) -> str:
    """Driver-specific risk explanation (used in RiskScore card body)."""
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
    all_types      = {"price_volatility", "weather_demand", "gas_supply"}
    triggered_types = {s["signal_type"] for s in triggered}
    stable_types    = all_types - triggered_types

    if risk_score == "high":
        driver_str = " and ".join(labels[t] for t in triggered_types if t in labels)
        stable_str = ", ".join(stable[t] for t in stable_types if t in stable)
        base = f"High risk driven by simultaneous {driver_str}."
        return base + (f" {stable_str.capitalize()}." if stable_str else "")

    if risk_score == "medium" and triggered:
        t          = triggered[0]["signal_type"]
        stable_str = " and ".join(stable[s] for s in stable_types if s in stable)
        base       = f"Medium risk driven by {labels.get(t, t)}."
        return base + (f" {stable_str.capitalize()}." if stable_str else "")

    return "All monitored risk drivers — price, weather, and gas supply — are within normal ranges."


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
    return "low", count


# ──────────────────────────────────────────────────────────────────────────────
# Master runner
# ──────────────────────────────────────────────────────────────────────────────

def run_all_signals(
    prices:      List[Dict],
    forecasts:   List[Dict],
    gas_records: List[Dict],
) -> Dict[str, Any]:
    """
    Master function — runs all detectors, validates data, and returns
    a professional analyst-grade risk snapshot.
    """
    # ── Data validation ───────────────────────────────────────────────────────
    data_valid, data_status = _validate_data(prices)

    logger.info(
        "[SIGNALS] data_valid=%s data_status=%s prices=%d forecasts=%d gas=%d",
        data_valid, data_status, len(prices), len(forecasts), len(gas_records)
    )

    if not data_valid:
        result = _failsafe_response()
        result["data_status"] = data_status
        return result

    # ── Run detectors ─────────────────────────────────────────────────────────
    price_signal   = check_price_volatility(prices)
    weather_signal = check_weather_demand(forecasts)
    gas_signal     = check_gas_supply(gas_records)

    all_signals              = [price_signal, weather_signal, gas_signal]
    risk_score, active_count = compute_risk_score(all_signals)

    # ── Confidence ────────────────────────────────────────────────────────────
    confidence = _compute_confidence(prices, all_signals)
    for sig in all_signals:
        if sig.get("triggered") and sig.get("confidence") is None:
            sig["confidence"] = confidence
        elif not sig.get("triggered"):
            sig["confidence"] = max(confidence - 20, 40)

    # ── Intelligence fields ───────────────────────────────────────────────────
    primary_driver_type, primary_driver_label = _determine_primary_driver(all_signals)
    risk_direction  = _determine_risk_direction(prices, all_signals)
    secondary       = _secondary_factors(all_signals, primary_driver_type)

    explanation = _generate_explanation(risk_score, all_signals)
    impact      = _generate_impact(risk_score, all_signals, primary_driver_type)
    summary     = _generate_summary(risk_score, all_signals, primary_driver_label, risk_direction)

    # ── Debug logging ─────────────────────────────────────────────────────────
    logger.info(
        "[SIGNALS] score=%s direction=%s driver=%s active=%d confidence=%d",
        risk_score, risk_direction, primary_driver_label, active_count, confidence
    )
    for sig in all_signals:
        logger.info(
            "[SIGNAL DEBUG] type=%s triggered=%s severity=%s value=%s confidence=%s",
            sig.get("signal_type"), sig.get("triggered"),
            sig.get("severity"), sig.get("value"), sig.get("confidence")
        )

    return {
        "computed_at":         _utcnow().isoformat(),
        "risk_score":          risk_score,
        "active_signals":      active_count,
        "confidence":          confidence,
        "explanation":         explanation,
        "impact":              impact,
        "primary_driver":      primary_driver_label,
        "primary_driver_type": primary_driver_type,
        "risk_direction":      risk_direction,
        "secondary_factors":   secondary,
        "data_valid":          True,
        "data_status":         data_status,
        "signals": {
            "price_volatility": price_signal,
            "weather_demand":   weather_signal,
            "gas_supply":       gas_signal,
        },
        "summary":    summary,
        "disclaimer": (
            "This information is provided for situational awareness only. "
            "It does not constitute investment, trading, or procurement advice. "
            "Risk may be rising — consult qualified advisors before making decisions."
        ),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Signal builder
# ──────────────────────────────────────────────────────────────────────────────

def _signal(
    signal_type: str, sig_type: str,
    triggered:   bool, severity: str,
    confidence:  Optional[int],
    title:       str, value, threshold,
    time_horizon: str,
    message:     str,
    impact:      str,
) -> Dict[str, Any]:
    """Standardized signal output — all fields required."""
    return {
        "type":         sig_type,
        "title":        title,
        "message":      message,
        "impact":       impact,
        "time_horizon": time_horizon,
        "confidence":   confidence,
        "signal_type":  signal_type,
        "triggered":    triggered,
        "severity":     severity,
        "value":        value,
        "threshold":    threshold,
        "computed_at":  _utcnow().isoformat(),
    }
