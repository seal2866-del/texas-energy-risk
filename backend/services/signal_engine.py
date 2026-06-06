"""
signal_engine.py
Professional risk intelligence engine for Texas energy market conditions.
Produces structured analyst-style signals with primary drivers, risk direction,
structured time horizons, explainable confidence scores, and enterprise-safe language.

LEGAL NOTE: All output is informational only. No trading,
procurement, or investment advice is expressed or implied.
"""
import logging
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, timezone, timedelta

try:
    from services.data_verification import verify_ercot_price, get_last_known_good
    _VERIFICATION_ENABLED = True
except ImportError:
    _VERIFICATION_ENABLED = False

logger = logging.getLogger(__name__)

# Module-level memory for delta tracking (keyed by location)
_PREV_SIGNALS: Dict[str, Dict[str, Any]] = {}


# -- Thresholds ----------------------------------------------------------------
# ERCOT price tiers — updated to reflect actual Texas market conditions
PRICE_NORMAL_MAX          = 75.0    # Normal operating range
PRICE_WATCH_MWH           = 75.0    # Watch tier starts
PRICE_ELEVATED_MWH        = 150.0   # Elevated operational risk threshold
PRICE_HIGH_MWH            = 300.0   # High risk
PRICE_CRITICAL_MWH        = 1000.0  # Critical / extreme event
PRICE_ABS_HIGH_MWH        = 150.0   # Alias — elevated threshold (used throughout)
PRICE_SPIKE_THRESHOLD_PCT = 100.0   # % move needed to flag volatility (raised from 50)
PRICE_LOW_FLOOR           = 10.0
TEMP_HIGH_THRESHOLD_F     = 100.0
TEMP_LOW_THRESHOLD_F      = 28.0
GAS_STORAGE_PCT_THRESHOLD = -10.0

# -- Data validation constants -------------------------------------------------
DATA_FRESHNESS_MINUTES = 1440  # 24h — tolerate CDR cache lag on Railway
DATA_MIN_REAL_POINTS   = 1
MOCK_SOURCES           = {"mock", "mock_data", "generated", "demo", None, ""}

# -- Severity rank for driver comparison ---------------------------------------
_SEVERITY_RANK = {"high": 2, "medium": 1, "low": 0}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ------------------------------------------------------------------------------
# Data validation layer
# ------------------------------------------------------------------------------

def _validate_data(prices: List[Dict]) -> Tuple[bool, str]:
    if not prices:
        logger.warning("[VALIDATE] No price data -- failsafe active")
        return False, "no_data"

    real_prices = [p for p in prices if p.get("source") not in MOCK_SOURCES]

    if len(real_prices) < DATA_MIN_REAL_POINTS:
        got = len(real_prices)
        logger.warning("[VALIDATE] Insufficient real data: %d/%d real readings -- failsafe active", got, DATA_MIN_REAL_POINTS)
        return False, ("mock_only" if got == 0 else f"building_cache_{got}_of_{DATA_MIN_REAL_POINTS}")

    latest      = prices[-1]
    ts_raw      = latest.get("timestamp", "")
    age_minutes = 0.0
    try:
        ts          = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
        age_minutes = (_utcnow() - ts).total_seconds() / 60
        if age_minutes > DATA_FRESHNESS_MINUTES:
            logger.warning("[VALIDATE] Stale data: %.1f min old -- failsafe active", age_minutes)
            return False, f"stale_{age_minutes:.0f}m"
    except Exception as exc:
        logger.warning("[VALIDATE] Cannot parse timestamp '%s': %s", ts_raw, exc)
        return False, "bad_timestamp"

    return True, "valid"


def _assess_data_sources(
    prices:      List[Dict],
    forecasts:   List[Dict],
    gas_records: List[Dict],
) -> Dict[str, Any]:
    """
    Phase 6 -- assess freshness and availability of each data source.
    Returns a dict with status (active/stale/unavailable) and last_updated per source.
    """
    now = _utcnow()

    def _source_status(records: List[Dict], ts_field: str, fresh_minutes: int, source_label: str) -> Dict:
        if not records:
            return {"status": "unavailable", "last_updated": None, "age_minutes": None}
        latest = records[-1]
        ts_raw = latest.get(ts_field, "")
        try:
            ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
            # EIA returns date-only strings ("2024-01-26") which parse as
            # naive datetimes. Make them UTC-aware so subtraction works.
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            age_minutes = (now - ts).total_seconds() / 60
            status      = "active" if age_minutes <= fresh_minutes else "stale"
            return {
                "status":       status,
                "last_updated": ts.isoformat(),
                "age_minutes":  round(age_minutes, 1),
                "source":       latest.get("source", source_label),
            }
        except Exception as exc:
            logger.warning("[SOURCE_STATUS] parse error for %s ts=%r: %s", source_label, ts_raw, exc)
            return {"status": "unavailable", "last_updated": None, "age_minutes": None}

    ercot_status = _source_status(prices,      "timestamp",    15,    "ercot_cdr")
    noaa_status  = _source_status(forecasts,   "forecast_time", 60,   "noaa")
    eia_status   = _source_status(gas_records, "report_date",   21600, "eia")  # EIA weekly — allow up to 15 days

    return {
        "ercot": ercot_status,
        "noaa":  noaa_status,
        "eia":   eia_status,
    }



# ------------------------------------------------------------------------------
# Signal dict factory
# ------------------------------------------------------------------------------

def _signal(
    signal_type: str,
    sig_type:    str,
    triggered:   bool,
    severity:    str,
    confidence:  Optional[int],
    title:       str,
    value:       Optional[float],
    threshold:   Optional[float],
    time_horizon: str,
    message:     str,
    impact:      str,
) -> Dict[str, Any]:
    """Build a standardised signal dict consumed by the frontend."""
    return {
        "type":         sig_type,
        "signal_type":  signal_type,
        "title":        title,
        "triggered":    triggered,
        "severity":     severity,
        "value":        value,
        "threshold":    threshold,
        "message":      message,
        "impact":       impact,
        "time_horizon": time_horizon,
        "confidence":   confidence,
        "computed_at":  _utcnow().isoformat(),
    }


def _failsafe_response() -> Dict[str, Any]:
    now    = _utcnow().isoformat()
    paused = _signal(
        signal_type="unavailable", sig_type="UNAVAILABLE",
        triggered=False, severity="low", confidence=None,
        title="Monitoring Paused", value=None, threshold=None,
        time_horizon="Short-term (0-6h): unavailable · Near-term (6-24h): unavailable · Outlook (24-48h): unavailable",
        message="Live data unavailable. Monitoring paused.",
        impact="Risk signals will resume automatically once real-time data is confirmed.",
    )
    return {
        "computed_at":            now,
        "risk_score":             "low",
        "risk_headline":          "Live data unavailable. Monitoring paused.",
        "active_signals":         0,
        "confidence":             None,
        "confidence_note":        "Confidence unavailable -- data source offline.",
        "explanation":            "Live data unavailable. Monitoring paused.",
        "impact":                 "Risk signals are suppressed until real-time data is confirmed.",
        "primary_driver":         "None",
        "primary_driver_type":    "none",
        "risk_direction":         "stable",
        "risk_direction_context": "data unavailable",
        "market_context":         "Live data unavailable. Monitoring paused.",
        "signal_drivers": [
            {"name": "ERCOT Volatility",        "type": "price_volatility", "active": False, "severity": "low"},
            {"name": "Weather Demand Pressure", "type": "weather_demand",   "active": False, "severity": "low"},
            {"name": "Natural Gas Supply",      "type": "gas_supply",       "active": False, "severity": "low"},
        ],
        "secondary_factors":  [],
        "data_valid":         False,
        "data_status":        "unavailable",
        "demand_pressure":    {"level": "low", "explanation": "Demand pressure unavailable — data source offline.", "score": 0},
        "supply_pressure":    {"level": "low", "explanation": "Supply pressure unavailable — data source offline.", "score": 0},
        "market_reaction":    {"level": "low", "explanation": "Market reaction unavailable — data source offline.", "score": 0},
        "gas_to_power_impact": {"level": "low", "explanation": "Gas-to-power impact unavailable — data source offline."},
        "events":             [],
        "risk_narrative":     {
            "headline":        "Texas energy risk monitoring is paused",
            "body":            "Live data is currently unavailable. Risk signals will resume automatically once real-time ERCOT data is confirmed.",
            "temporal_context": "0–6 hours",
            "next_period_note": "Monitoring will resume once data feeds are restored.",
        },
        "cost_impact":        {"level": "low", "label": "Unavailable", "description": "Cost impact assessment unavailable — data source offline."},
        "market_condition":   {"label": "Unavailable", "description": "Market condition assessment unavailable — data source offline."},
        "alert_severity":     {"level": "informational", "label": "Informational", "description": "Monitoring paused — awaiting live data."},
        "time_horizons": {
            "short_term": "Short-term (0-6h): unavailable",
            "near_term":  "Near-term (6-24h): unavailable",
            "outlook":    "Outlook (24-48h): unavailable",
        },
        "data_sources": {
            "ercot": {"status": "unavailable", "last_updated": None, "age_minutes": None},
            "noaa":  {"status": "unavailable", "last_updated": None, "age_minutes": None},
            "eia":   {"status": "unavailable", "last_updated": None, "age_minutes": None},
        },
        "signals": {
            "price_volatility": paused,
            "weather_demand":   paused,
            "gas_supply":       paused,
        },
        "summary":    "Live data unavailable. Monitoring paused. Risk signals will resume automatically once real-time ERCOT data is confirmed.",
        "disclaimer": (
            "TX Energy Risk provides informational analytics and market intelligence only. "
            "This does not constitute investment, trading, financial, legal, or procurement advice. "
            "Users are responsible for their own decisions."
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
            f"Accumulating real-time readings ({reading_count}/{DATA_MIN_REAL_POINTS} received). "
            "Signal analysis will activate once consecutive verified data points are available."
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
        time_horizon="Short-term (0-6h): pending · Near-term (6-24h): pending · Outlook (24-48h): pending",
        message=message,
        impact="Signals will activate automatically once verified data is available.",
    )


# ------------------------------------------------------------------------------
# Price change helpers
# ------------------------------------------------------------------------------

def _safe_pct_change(current: float, previous: float) -> Tuple[Optional[float], str]:
    if previous < PRICE_LOW_FLOOR:
        return None, "Large movement detected"
    pct  = ((current - previous) / previous) * 100
    sign = "+" if pct >= 0 else ""
    return pct, f"{sign}{pct:.1f}%"


def _validate_spike(prices: List[Dict], window: int = 2) -> bool:
    if len(prices) < window:
        return False
    recent = prices[-window:]
    return sum(1 for p in recent if float(p["price_mwh"]) >= PRICE_ABS_HIGH_MWH) >= window


# ------------------------------------------------------------------------------
# Phase 3 -- Explainable confidence scoring
# ------------------------------------------------------------------------------

def _compute_confidence(
    prices:       List[Dict],
    all_signals:  List[Dict],
    data_sources: Dict[str, Any],
) -> Tuple[int, str]:
    """
    Phase 3 -- Explainable confidence based on active drivers, data freshness, and persistence.
    Returns (confidence_int, note_string).

    Base:
      0 active drivers  -> 50
      1 active driver   -> 70
      2 active drivers  -> 80
      3 active drivers  -> 87

    Adjustments:
      +5 all data fresh (ercot + noaa active)
      +5 signal persists 2+ consecutive intervals
      -10 any source stale
      -15 any source unavailable

    Task 1: clamp min raised to 50. Note flags partial data availability.
    """
    triggered_count = len([s for s in all_signals if s.get("triggered")])

    base_map = {0: 50, 1: 70, 2: 80, 3: 87}
    base     = base_map.get(triggered_count, 87)

    adjustments = []
    adj         = 0

    # Freshness bonuses/penalties
    ercot_status = data_sources.get("ercot", {}).get("status", "unavailable")
    noaa_status  = data_sources.get("noaa",  {}).get("status", "unavailable")
    eia_status   = data_sources.get("eia",   {}).get("status", "unavailable")

    all_active   = all(s == "active"      for s in [ercot_status, noaa_status, eia_status])
    any_stale    = any(s == "stale"       for s in [ercot_status, noaa_status, eia_status])
    any_unavail  = any(s == "unavailable" for s in [ercot_status, noaa_status, eia_status])

    unavail_count = sum(1 for s in [ercot_status, noaa_status, eia_status] if s == "unavailable")

    if all_active:
        adj += 5
        adjustments.append("+5% all data sources active")
    if any_stale:
        adj -= 10
        adjustments.append("-10% data source delayed")
    if unavail_count == 1:
        adj -= 15
        adjustments.append("-15% one data source unavailable")
    elif unavail_count >= 2:
        adj -= 25
        adjustments.append("-25% multiple data sources unavailable")

    # Signal persistence bonus
    if len(prices) >= 2:
        recent_high = sum(1 for p in prices[-2:] if float(p.get("price_mwh", 0)) >= PRICE_ABS_HIGH_MWH)
        if recent_high >= 2:
            adj += 5
            adjustments.append("+5% signal persists across 2+ intervals")

    # Task 1: floor raised from 30 to 50
    confidence = max(50, min(90, base + adj))

    # Phase 11: plain-English WHY explanation
    conf_word = "high" if confidence >= 75 else "moderate" if confidence >= 60 else "limited"
    driver_phrase = {
        0: "No active risk drivers detected",
        1: "1 active risk driver detected",
        2: "2 active risk drivers detected",
        3: "3 active risk drivers detected",
    }.get(triggered_count, "Multiple drivers detected")

    if any_unavail:
        unavail_names = [
            src.upper()
            for src, info in {"ercot": ercot_status, "noaa": noaa_status, "eia": eia_status}.items()
            if info == "unavailable"
        ]
        note = (
            f"Confidence is {conf_word} ({confidence}%). {driver_phrase}. "
            f"Reduced because {', '.join(unavail_names)} data is currently unavailable — "
            "signal precision is limited to available sources."
        )
    elif any_stale:
        stale_names = [
            {"ercot": "ERCOT price feed", "noaa": "NOAA weather forecast", "eia": "EIA gas storage"}[src]
            for src, info in {"ercot": ercot_status, "noaa": noaa_status, "eia": eia_status}.items()
            if info == "stale"
        ]
        stale_label = ", ".join(stale_names) if stale_names else "one data source"
        note = (
            f"Confidence is {conf_word} ({confidence}%). {driver_phrase}. "
            f"Reduced due to delayed {stale_label} — operating on last known values."
        )
    elif all_active and triggered_count >= 2:
        note = (
            f"Confidence is {conf_word} ({confidence}%). {driver_phrase} with strong alignment "
            "across weather, gas, and ERCOT signals. All data sources are active and current."
        )
    elif all_active:
        note = (
            f"Confidence is {conf_word} ({confidence}%). {driver_phrase}. "
            "All data sources are active and current."
        )
    else:
        note = (
            f"Confidence is {conf_word} ({confidence}%). {driver_phrase}."
        )

    return confidence, note


# ------------------------------------------------------------------------------
# Task 1 -- Primary Driver
# ------------------------------------------------------------------------------

_DRIVER_LABELS = {
    "price_volatility": "Market volatility",
    "weather_demand":   "Weather-driven demand",
    "gas_supply":       "Supply pressure",
}

def _determine_primary_driver(signals: List[Dict]) -> Tuple[str, str]:
    triggered = [s for s in signals if s.get("triggered")]

    if triggered:
        best = max(triggered, key=lambda s: _SEVERITY_RANK.get(s.get("severity", "low"), 0))
        t    = best.get("signal_type", "")
        return t, _DRIVER_LABELS.get(t, t)

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


# ------------------------------------------------------------------------------
# Task 5 -- Risk Direction with driver context
# ------------------------------------------------------------------------------

def _determine_risk_direction(prices: List[Dict], signals: List[Dict]) -> Tuple[str, str]:
    """Returns (direction, context) -- direction tied to dominant driver for clarity."""
    triggered    = [s for s in signals if s.get("triggered")]
    high_active  = any(s.get("severity") == "high" for s in triggered)
    multi_active = len(triggered) >= 2

    price_trend = "flat"
    if len(prices) >= 3:
        vals      = [float(p["price_mwh"]) for p in prices[-3:]]
        pct_delta = ((vals[-1] - vals[0]) / max(vals[0], 1)) * 100
        if pct_delta > 8:
            price_trend = "rising"
        elif pct_delta < -8:
            price_trend = "falling"

    triggered_types = {s.get("signal_type", "") for s in triggered}

    if high_active or multi_active:
        direction = "increasing" if price_trend in ("rising", "flat") else "stable"
    elif triggered:
        if price_trend == "rising":
            direction = "increasing"
        elif price_trend == "falling":
            direction = "decreasing"
        else:
            direction = "stable"
    elif price_trend == "falling":
        direction = "decreasing"
    else:
        direction = "stable"

    # Context phrase tied directly to dominant driver
    if direction == "increasing":
        if "weather_demand" in triggered_types:
            context = "weather-driven demand pressure rising"
        elif "gas_supply" in triggered_types:
            context = "supply constraints building"
        elif "price_volatility" in triggered_types:
            context = "price volatility escalating"
        else:
            context = "multiple pressure factors building"
    elif direction == "decreasing":
        if "weather_demand" in triggered_types:
            context = "cooling demand easing"
        elif price_trend == "falling":
            context = "price pressure easing"
        else:
            context = "risk conditions improving"
    else:  # stable
        if not triggered:
            context = "no directional pressure detected"
        elif "price_volatility" in triggered_types:
            context = "price conditions stabilizing"
        else:
            context = "current conditions holding steady"

    return direction, context


# ------------------------------------------------------------------------------
# Secondary Factors
# ------------------------------------------------------------------------------

def _secondary_factors(signals: List[Dict], primary_type: str) -> List[str]:
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


# ------------------------------------------------------------------------------
# Individual signal detectors
# ------------------------------------------------------------------------------

def check_price_volatility(prices: List[Dict]) -> Dict[str, Any]:
    if not prices or len(prices) < 2:
        return _signal(
            "price_volatility", "VOLATILITY", False, "low", 40,
            "Awaiting Price Data", None, PRICE_ABS_HIGH_MWH,
            "Short-term (0-6h): monitoring · Near-term (6-24h): monitoring · Outlook (24-48h): monitoring",
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
        if current >= 1000:
            return _signal(
                "price_volatility", "VOLATILITY", True, "high", None,
                "Extreme Price Event", current, PRICE_ABS_HIGH_MWH,
                "Short-term (0-6h): extreme volatility active · Near-term (6-24h): monitor for stabilisation · Outlook (24-48h): elevated risk persists",
                (
                    f"ERCOT Houston Hub reached ${current:.0f}/MWh"
                    + (f", reflecting a {pct_display} move from ${prev:.0f}/MWh." if pct_change is not None else ".")
                    + " Sustained extreme pricing confirmed across consecutive intervals, indicating constrained grid conditions."
                ),
                "Sustained extreme prices may signal severe supply-demand imbalance, increasing the likelihood"
                " of continued volatility and potential grid stress over the next 24 hours.",
            )
        return _signal(
            "price_volatility", "VOLATILITY", True, "medium", None,
            "ERCOT Price Volatility Active", current, PRICE_ABS_HIGH_MWH,
            "Short-term (0-6h): elevated volatility · Near-term (6-24h): monitor for stabilisation · Outlook (24-48h): conditions suggest continued uncertainty",
            (
                f"ERCOT prices moved from ${prev:.0f} to ${current:.0f}/MWh"
                + (f" ({pct_display})" if pct_change is not None else "")
                + ", indicating increased instability in real-time settlement pricing."
                + (" Movement sustained across consecutive readings, reflecting persistent pressure." if sustained_spike else "")
            ),
            "Elevated ERCOT prices may reflect a tightening supply-demand balance, increasing the likelihood"
            " of further price movement over the next 24-48 hours.",
        )

    if single_outlier:
        return _signal(
            "price_volatility", "VOLATILITY", False, "low", None,
            "Transient Price Movement", current, PRICE_ABS_HIGH_MWH,
            "Short-term (0-6h): elevated but unconfirmed · Near-term (6-24h): monitoring · Outlook (24-48h): monitoring",
            f"ERCOT price reached ${current:.0f}/MWh, suggesting a transient spike."
            " Movement not yet confirmed across consecutive readings, indicating a potential outlier.",
            "Monitoring for confirmation. Single-interval spikes are filtered to reduce noise.",
        )

    if current >= PRICE_WATCH_MWH:
        pct_note = f" {pct_display} vs previous interval." if pct_change is not None else ""
        return _signal(
            "price_volatility", "VOLATILITY", False, "low", None,
            "Price in Watch Range", current, PRICE_ELEVATED_MWH,
            "Short-term (0-6h): elevated but within normal market range · Near-term (6-24h): monitor for sustained move above $150 · Outlook (24-48h): watch for escalation",
            f"ERCOT Houston Hub at ${current:.0f}/MWh, within the Watch range ($75–$150/MWh).{pct_note}"
            " Normal market conditions for Texas — no operational action required unless sustained above $150/MWh.",
            "Monitor for price movement above $150/MWh before escalating operational response.",
        )

    pct_note = f" {pct_display} vs previous interval." if pct_change is not None else ""
    return _signal(
        "price_volatility", "VOLATILITY", False, "low", None,
        "ERCOT Pricing Stable", current, PRICE_ABS_HIGH_MWH,
        "Short-term (0-6h): stable · Near-term (6-24h): no immediate risk · Outlook (24-48h): stable conditions expected",
        f"ERCOT Houston Hub at ${current:.0f}/MWh, reflecting normal operating conditions.{pct_note}"
        " Current pricing indicates low immediate volatility risk.",
        "No price-based risk signals active. Stable conditions are expected to persist short-term.",
    )


def check_weather_demand(forecasts: List[Dict]) -> Dict[str, Any]:
    if not forecasts:
        return _signal(
            "weather_demand", "WEATHER", False, "low", None,
            "Awaiting Weather Data", None, TEMP_HIGH_THRESHOLD_F,
            "Short-term (0-6h): monitoring · Near-term (6-24h): monitoring · Outlook (24-48h): monitoring",
            "No weather forecast data available.",
            "Weather-based demand signals will activate once forecast data loads.",
        )

    tomorrow = forecasts[0]
    high_f   = float(tomorrow.get("temp_high_f", 75))
    low_f    = float(tomorrow.get("temp_low_f",  55))
    location = tomorrow.get("location_name", "Texas")

    # Check multi-day pattern from extended forecast
    multi_day_heat = False
    if len(forecasts) >= 3:
        multi_day_heat = sum(1 for f in forecasts[:3] if float(f.get("temp_high_f", 0)) >= TEMP_HIGH_THRESHOLD_F) >= 2

    if high_f >= TEMP_HIGH_THRESHOLD_F:
        if high_f >= 105:
            return _signal(
                "weather_demand", "WEATHER", True, "high", None,
                "Extreme Heat -- Grid Load Alert", high_f, TEMP_HIGH_THRESHOLD_F,
                "Short-term (0-6h): extreme demand expected · Near-term (6-24h): peak load during afternoon hours · Outlook (24-48h): sustained heat stress likely",
                f"Forecast high of {high_f:.0f}\u00b0F in {location} indicates extreme cooling demand across the Texas grid."
                " Historical patterns reflect sharp ERCOT load increases above 105F, suggesting tight reserve margins."
                + (" Pattern persists across multiple forecast days." if multi_day_heat else ""),
                "Extreme temperatures may significantly increase grid load and tighten reserve margins,"
                " increasing the likelihood of short-term price volatility over the next 24-48 hours.",
            )
        return _signal(
            "weather_demand", "WEATHER", True, "medium", None,
            "Heat Demand Risk Elevated", high_f, TEMP_HIGH_THRESHOLD_F,
            "Short-term (0-6h): elevated demand building · Near-term (6-24h): peak load during afternoon hours · Outlook (24-48h): continued heat risk",
            f"Forecast high of {high_f:.0f}\u00b0F in {location} indicates elevated cooling demand."
            " Temperatures above 100F reflect a pattern of increased ERCOT load during peak afternoon hours."
            + (" Sustained heat pattern detected across multiple forecast days." if multi_day_heat else ""),
            "Elevated temperatures may increase grid load, increasing the likelihood of price pressure"
            " during peak afternoon hours over the next 24 hours.",
        )

    if low_f <= TEMP_LOW_THRESHOLD_F:
        if low_f <= 20:
            return _signal(
                "weather_demand", "WEATHER", True, "high", None,
                "Freeze Event Risk", low_f, TEMP_LOW_THRESHOLD_F,
                "Short-term (0-6h): severe heating demand · Near-term (6-24h): freeze conditions possible · Outlook (24-48h): compounding grid stress risk",
                f"Forecast low of {low_f:.0f}\u00b0F in {location} indicates severe freeze risk."
                " Extreme cold reflects compounding grid stress from elevated heating demand and potential gas supply constraints.",
                "Severe freeze conditions may simultaneously stress gas-fired generation and heating demand,"
                " increasing the likelihood of supply-side constraints over the next 48-72 hours.",
            )
        return _signal(
            "weather_demand", "WEATHER", True, "medium", None,
            "Cold Weather Demand Elevated", low_f, TEMP_LOW_THRESHOLD_F,
            "Short-term (0-6h): elevated heating demand · Near-term (6-24h): continued cold risk · Outlook (24-48h): monitor for sustained cold pattern",
            f"Forecast low of {low_f:.0f}\u00b0F in {location} indicates elevated heating demand."
            " Cold weather reflects increased overnight grid stress and natural gas consumption.",
            "Elevated heating demand may tighten reserve margins overnight, increasing the likelihood"
            " of price pressure during peak morning hours over the next 24 hours.",
        )

    return _signal(
        "weather_demand", "WEATHER", False, "low", None,
        "Normal Weather Conditions", high_f, TEMP_HIGH_THRESHOLD_F,
        "Short-term (0-6h): normal demand · Near-term (6-24h): no weather risk · Outlook (24-48h): stable demand expected",
        f"Forecast high of {high_f:.0f}\u00b0F in {location}, reflecting normal seasonal conditions."
        " Current temperatures indicate no weather-driven demand pressure on the grid.",
        "No weather-driven action required. Normal seasonal conditions — no demand pressure on the grid.",
    )


def check_gas_supply(gas_records: List[Dict]) -> Dict[str, Any]:
    if not gas_records:
        return _signal(
            "gas_supply", "GAS", False, "low", None,
            "Awaiting Storage Data", None, GAS_STORAGE_PCT_THRESHOLD,
            "Short-term (0-6h): monitoring · Near-term (6-24h): monitoring · Outlook (24-48h): monitoring",
            "No natural gas storage data available.",
            "Gas supply signals will activate once EIA storage data loads.",
        )

    latest     = gas_records[-1]
    pct        = float(latest.get("storage_pct_vs_avg", 0))
    bcf        = latest.get("storage_bcf", "N/A")
    price      = latest.get("henry_hub_price")
    price_note = f" Henry Hub at ${price:.2f}/MMBtu." if price else ""

    if pct <= GAS_STORAGE_PCT_THRESHOLD:
        if pct <= -20:
            return _signal(
                "gas_supply", "GAS", True, "high", None,
                "Critical Gas Supply Deficit", pct, GAS_STORAGE_PCT_THRESHOLD,
                "Short-term (0-6h): supply buffer severely reduced · Near-term (6-24h): sensitive to demand spikes · Outlook (24-48h): risk elevated if demand increases",
                f"Working gas storage at {bcf} Bcf -- {abs(pct):.1f}% below the 5-year seasonal average.{price_note}"
                " A deficit of this magnitude reflects critical supply tightness, suggesting"
                " elevated sensitivity to any demand surge or supply disruption.",
                "Critical gas storage deficit may constrain fuel supply for gas-fired generation,"
                " increasing the likelihood of supply-side stress during demand peaks over the next 48-72 hours.",
            )
        return _signal(
            "gas_supply", "GAS", True, "medium", None,
            "Gas Storage Below Seasonal Average", pct, GAS_STORAGE_PCT_THRESHOLD,
            "Short-term (0-6h): supply buffer reduced · Near-term (6-24h): sensitivity elevated · Outlook (24-48h): monitor for further draws",
            f"Working gas storage at {bcf} Bcf -- {abs(pct):.1f}% below the 5-year average.{price_note}"
            " Below-average storage indicates a reduced supply buffer,"
            " suggesting increased sensitivity to demand spikes or supply disruptions.",
            "Below-average gas storage may reduce the supply buffer, increasing the likelihood"
            " of price sensitivity during any demand surge over the next 48-72 hours.",
        )

    surplus = "above" if pct >= 0 else "below"
    return _signal(
        "gas_supply", "GAS", False, "low", None,
        "Gas Supply Adequate", pct, GAS_STORAGE_PCT_THRESHOLD,
        "Short-term (0-6h): adequate supply · Near-term (6-24h): stable outlook · Outlook (24-48h): no supply risk expected",
        f"Working gas storage at {bcf} Bcf -- {abs(pct):.1f}% {surplus} the 5-year average.{price_note}"
        " Storage levels reflect adequate supply buffer, indicating no near-term fuel supply risk.",
        "Natural gas supply conditions appear stable. No supply-side risk signals are active.",
    )


# ------------------------------------------------------------------------------
# Phase 1 -- Structured time horizons
# ------------------------------------------------------------------------------

def _build_time_horizons(
    risk_score:     str,
    signals:        List[Dict],
    risk_direction: str,
    primary_driver: str,
) -> Dict[str, str]:
    risk_label = risk_score.capitalize()

    if risk_score == "high":
        short = f"Short-term (0-6h): Elevated operational conditions — {primary_driver} is the primary driver. Increased monitoring priority may apply."
    elif risk_score == "medium":
        short = f"Short-term (0-6h): Moderate operational conditions — {primary_driver} is elevating monitoring priority. Review according to internal procedures."
    else:
        short = "Short-term (0-6h): Stable conditions — all monitored drivers within normal operating range."

    weather_sig = next((s for s in signals if s.get("signal_type") == "weather_demand"), None)
    near_high   = weather_sig and weather_sig.get("triggered") and float(weather_sig.get("value") or 0) >= TEMP_HIGH_THRESHOLD_F

    if risk_direction == "increasing":
        near = "Near-term (6-24h): Risk may be elevated. Conditions suggest upward pressure during afternoon peak hours."
    elif risk_direction == "decreasing":
        near = "Near-term (6-24h): Conditions improving. Risk pressure appears to be easing."
    elif near_high:
        near = "Near-term (6-24h): Monitor. Elevated temperatures may sustain demand pressure through evening hours."
    else:
        near = "Near-term (6-24h): Stable. No escalation signals detected at this time."

    gas_sig     = next((s for s in signals if s.get("signal_type") == "gas_supply"), None)
    gas_tight   = gas_sig and gas_sig.get("triggered")
    weather_val = float((weather_sig or {}).get("value") or 0)

    if gas_tight and near_high:
        outlook = "Outlook (24-48h): Weather-driven demand remains elevated while gas supply buffer is reduced. Combined pressure warrants monitoring."
    elif near_high:
        if weather_val >= 105:
            outlook = "Outlook (24-48h): Extreme heat pattern may persist. Grid demand conditions likely to remain elevated."
        else:
            outlook = "Outlook (24-48h): Weather-driven demand remains elevated. Monitor for sustained heat pattern."
    elif gas_tight:
        outlook = "Outlook (24-48h): Gas supply conditions remain below seasonal average. Sensitivity to demand spikes persists."
    elif risk_direction == "decreasing":
        outlook = "Outlook (24-48h): Conditions are improving. Risk expected to ease if current trends continue."
    else:
        outlook = "Outlook (24-48h): No significant risk escalation signals detected. Stable conditions are expected."

    return {"short_term": short, "near_term": near, "outlook": outlook}


# ------------------------------------------------------------------------------
# Phase 2 -- Single narrative function (consistent cross-panel language)
# ------------------------------------------------------------------------------

def _build_narrative(
    risk_score:     str,
    signals:        List[Dict],
    primary_driver: str,
    risk_direction: str,
) -> Tuple[str, str, str, str]:
    """
    Phase 2 -- Single source of truth for risk narrative.
    Returns (summary, explanation, impact, market_context).
    market_context is the short contrast sentence shown consistently across all panels.
    Ensures panels do not contradict each other.
    """
    risk_label = risk_score.capitalize()

    price_sig   = next((s for s in signals if s.get("signal_type") == "price_volatility"), None)
    weather_sig = next((s for s in signals if s.get("signal_type") == "weather_demand"),   None)
    gas_sig     = next((s for s in signals if s.get("signal_type") == "gas_supply"),       None)

    price_val   = float((price_sig   or {}).get("value") or 0)
    weather_val = float((weather_sig or {}).get("value") or 0)
    gas_val     = float((gas_sig     or {}).get("value") or 0)

    price_triggered   = price_sig   and price_sig.get("triggered")
    weather_triggered = weather_sig and weather_sig.get("triggered")
    gas_triggered     = gas_sig     and gas_sig.get("triggered")

    direction_phrase = {
        "increasing": "is gradually increasing",
        "stable":     "remains stable",
        "decreasing": "is improving",
    }.get(risk_direction, "remains stable")

    # Phase 2 consistency: build context that does not contradict
    # Rule: if price is stable but another driver is active, acknowledge both
    price_context = ""
    if price_triggered:
        price_context = f"ERCOT pricing is elevated at ${price_val:.0f}/MWh, reflecting active volatility"
    elif price_val > 0:
        if weather_triggered or gas_triggered:
            price_context = f"ERCOT prices are currently stable at ${price_val:.0f}/MWh"
        else:
            price_context = f"ERCOT pricing remains stable at ${price_val:.0f}/MWh"

    weather_context = ""
    if weather_triggered:
        weather_context = f"temperatures of {weather_val:.0f}\u00b0F are driving elevated grid load"
    elif weather_val > 0:
        weather_context = "weather conditions are within normal operating range"

    gas_context = ""
    if gas_triggered:
        gas_context = f"natural gas storage stands {abs(gas_val):.1f}% below the 5-year average, suggesting supply tightness"
    else:
        gas_context = "natural gas supply conditions appear adequate"

    # Build context sentence with Phase 2 contrast logic
    parts = [c for c in [price_context, weather_context, gas_context] if c]
    if len(parts) == 0:
        context = ""
    elif len(parts) == 1:
        context = parts[0].capitalize() + "."
    elif price_triggered is False and (weather_triggered or gas_triggered):
        # Stable ERCOT but other risk active -- use "but" contrast
        context = f"{parts[0].capitalize()}, but {parts[1]}"
        if len(parts) >= 3:
            context += f", and {parts[2]}"
        context += "."
    else:
        context = parts[0].capitalize()
        if len(parts) >= 2:
            context += f" while {parts[1]}"
        if len(parts) >= 3:
            context += f", and {parts[2]}"
        context += "."

    # ── Summary (situational awareness — never advisory) ─────────────────────
    triggered_signals = [s for s in signals if s.get("triggered")]

    if risk_score == "low" and not triggered_signals:
        summary = (
            "Current conditions remain stable across monitored signals. "
            f"{context} "
            "Standard monitoring procedures apply. "
            "Reassess during the afternoon demand window (14:00–19:00 CDT)."
        ).strip()
    elif risk_score == "low" and triggered_signals:
        summary = (
            "Conditions are generally stable, though one signal warrants monitoring attention. "
            f"{context} "
            "Increased awareness during peak demand hours may be appropriate according "
            "to internal procedures."
        ).strip()
    elif risk_score == "medium":
        summary = (
            "Moderate operational conditions detected. "
            f"{context} "
            "Increased monitoring frequency during the next 6–24 hours may be warranted. "
            "Review according to internal operational procedures."
        ).strip()
    else:  # high
        summary = (
            "Elevated operational conditions active across multiple signals. "
            f"{context} "
            "Internal escalation procedures and contingency review may be warranted. "
            "Continuous monitoring of ERCOT pricing and grid conditions is appropriate."
        ).strip()

    # ── Explanation (risk score card — one authoritative sentence) ────────────
    triggered_labels = {
        "price_volatility": "ERCOT price volatility",
        "weather_demand":   "weather-driven demand pressure",
        "gas_supply":       "natural gas supply tightness",
    }
    stable_labels = {
        "price_volatility": "ERCOT prices stable",
        "weather_demand":   "weather demand normal",
        "gas_supply":       "gas supply adequate",
    }
    triggered_types = {s["signal_type"] for s in signals if s.get("triggered")}
    stable_types    = {"price_volatility", "weather_demand", "gas_supply"} - triggered_types

    if risk_score == "high":
        driver_str  = " and ".join(triggered_labels[t] for t in triggered_types if t in triggered_labels)
        stable_str  = ", ".join(stable_labels[t] for t in stable_types if t in stable_labels)
        explanation = f"Converging risk: {driver_str} active simultaneously."
        if stable_str:
            explanation += f" {stable_str.capitalize()}."
    elif risk_score == "medium" and triggered_types:
        t           = next(iter(triggered_types))
        stable_str  = " and ".join(stable_labels[s] for s in stable_types if s in stable_labels)
        explanation = f"Elevated exposure from {triggered_labels.get(t, t)}."
        if stable_str:
            explanation += f" {stable_str.capitalize()}."
    else:
        explanation = "All risk drivers within normal operating ranges. No material exposure detected."

    # ── Impact (what this means operationally) ────────────────────────────────
    if not triggered_signals:
        impact = (
            "Minimal operational impact expected under current conditions. "
            "Standard operations are supported through the next 24 hours. "
            "Conditions may warrant increased awareness if afternoon temperatures "
            "or ERCOT prices approach watch thresholds."
        )
    elif risk_score == "high" and len(triggered_signals) >= 2:
        impact = (
            "Multiple converging signals indicate elevated operational significance. "
            "Conditions may warrant internal escalation procedures and management visibility. "
            "Continuous monitoring of ERCOT pricing and grid conditions is appropriate."
        )
    else:
        impact_map = {
            "weather_demand": {
                "high":   "Extreme temperatures are driving grid load toward peak capacity. Operational significance is elevated — conditions may warrant internal review and increased monitoring during afternoon peak hours (14:00–19:00 CDT).",
                "medium": "Elevated temperatures are increasing demand pressure. Operational awareness during afternoon peak periods (14:00–18:00 CDT) may be warranted according to internal procedures.",
            },
            "price_volatility": {
                "high":   "ERCOT pricing reflects elevated grid conditions. Operational significance is high — monitoring frequency and internal visibility may warrant review according to organizational procedures.",
                "medium": "ERCOT pricing is showing moderate sensitivity. Monitoring conditions during peak hours and reviewing according to internal procedures may be appropriate.",
            },
            "gas_supply": {
                "high":   "Gas storage conditions may constrain generation fuel availability during demand peaks. Operational awareness of supply-side conditions is warranted.",
                "medium": "Below-average gas storage is reducing the supply buffer. Monitoring Henry Hub pricing and supply conditions over the next 48–72 hours may be appropriate.",
            },
        }
        target   = triggered_signals[0]
        sig_type = target.get("signal_type", "")
        severity = target.get("severity", "medium")
        impact   = impact_map.get(sig_type, {}).get(severity, "Elevated signal detected. Increased monitoring cadence may be appropriate according to internal operational procedures.")

    # market_context — short authoritative sentence for all panels
    market_context = context if context else (
        f"Risk is {risk_score.capitalize()}. Primary driver: {primary_driver}."
    )

    return summary, explanation, impact, market_context


# ------------------------------------------------------------------------------
# Composite risk score — Phase 3 numerical sum model
# ------------------------------------------------------------------------------

def _driver_score(signal: Dict) -> int:
    """Score a single driver: triggered high=2, triggered medium=1, else 0."""
    if not signal.get("triggered"):
        return 0
    return {"high": 2, "medium": 1, "low": 0}.get(signal.get("severity", "low"), 0)


def compute_risk_score(signals: List[Dict]) -> Tuple[str, int]:
    """
    Numerical sum scoring across three drivers.
    Demand + Supply + Market: each 0 (low) / 1 (medium) / 2 (high).
    Total  0-1 = LOW RISK
    Total  2-3 = MEDIUM RISK
    Total  4-6 = HIGH RISK
    Returns (risk_label, active_driver_count).
    """
    total  = sum(_driver_score(s) for s in signals)
    active = len([s for s in signals if s.get("triggered")])
    if total >= 4:
        return "high", active
    elif total >= 2:
        return "medium", active
    return "low", active


# ------------------------------------------------------------------------------
# Phase 1 — Driver model: Demand Pressure / Supply Pressure / Market Reaction
# ------------------------------------------------------------------------------

def _compute_demand_pressure(weather_sig: Dict) -> Dict[str, Any]:
    """Map weather signal → Demand Pressure driver level + plain-language explanation."""
    triggered = weather_sig.get("triggered", False)
    severity  = weather_sig.get("severity", "low")
    val       = float(weather_sig.get("value") or 0)
    score     = _driver_score(weather_sig)

    if triggered and severity == "high":
        level = "high"
        if val >= TEMP_HIGH_THRESHOLD_F:
            expl = (
                f"Demand pressure is elevated due to forecast temperatures of {val:.0f}°F, "
                "which may significantly increase cooling load across the Texas grid."
            )
        else:
            expl = (
                f"Demand pressure is elevated due to extreme cold at {val:.0f}°F, "
                "which may significantly increase heating load across the Texas grid."
            )
    elif triggered and severity == "medium":
        level = "medium"
        if val >= TEMP_HIGH_THRESHOLD_F:
            expl = (
                f"Demand pressure is moderate. Forecast temperatures of {val:.0f}°F "
                "may increase cooling load during peak afternoon hours."
            )
        else:
            expl = (
                f"Demand pressure is moderate. Cold temperatures of {val:.0f}°F "
                "may increase heating load on the Texas grid."
            )
    else:
        level = "low"
        expl  = (
            "Demand conditions within normal seasonal range. No elevated grid load pressure "
            "detected through the next 24 hours."
        )

    return {"level": level, "explanation": expl, "score": score}


def _compute_supply_pressure(gas_sig: Dict, gas_records: List[Dict]) -> Dict[str, Any]:
    """Map gas signal → Supply Pressure driver level + explanation including Henry Hub trend."""
    triggered = gas_sig.get("triggered", False)
    severity  = gas_sig.get("severity", "low")
    pct_val   = float(gas_sig.get("value") or 0)
    score     = _driver_score(gas_sig)

    # Henry Hub trend
    henry_hub   = None
    henry_trend = "stable"
    if len(gas_records) >= 2:
        lp = gas_records[-1].get("henry_hub_price")
        pp = gas_records[-2].get("henry_hub_price")
        henry_hub = lp
        if lp and pp and pp > 0:
            pct_chg = ((lp - pp) / pp) * 100
            if pct_chg > 5:
                henry_trend = "rising"
            elif pct_chg < -5:
                henry_trend = "falling"

    henry_note = (
        f" Henry Hub at ${henry_hub:.2f}/MMBtu ({henry_trend})."
        if henry_hub else ""
    )

    if triggered and severity == "high":
        level = "high"
        expl  = (
            f"Supply pressure is high. Natural gas storage stands {abs(pct_val):.1f}% "
            "below the 5-year seasonal average, indicating a significant supply buffer reduction."
            + henry_note
        )
    elif triggered and severity == "medium":
        level = "medium"
        expl  = (
            f"Supply pressure is moderate. Natural gas storage is {abs(pct_val):.1f}% "
            "below seasonal averages, which may increase sensitivity to demand spikes."
            + henry_note
        )
    else:
        level    = "low"
        pct_str  = f"{abs(pct_val):.1f}% {'above' if pct_val >= 0 else 'below'}"
        expl     = (
            f"Gas supply within expected range. Storage is {pct_str} the 5-year average — "
            "adequate buffer for current generation demand conditions."
            + henry_note
        )

    return {"level": level, "explanation": expl, "score": score}


def _compute_market_reaction(price_sig: Dict) -> Dict[str, Any]:
    """Map price signal → Market Reaction driver level + explanation."""
    triggered = price_sig.get("triggered", False)
    severity  = price_sig.get("severity", "low")
    val       = float(price_sig.get("value") or 0)
    score     = _driver_score(price_sig)

    if triggered and severity == "high":
        level = "high"
        expl  = (
            f"Market reaction is elevated. ERCOT Houston Hub pricing reached ${val:.0f}/MWh, "
            "indicating extreme settlement price conditions and significant market stress."
        )
    elif triggered and severity == "medium":
        level = "medium"
        expl  = (
            f"Market reaction is elevated. ERCOT prices moved to ${val:.0f}/MWh, "
            "reflecting increasing pricing uncertainty in the real-time settlement market."
        )
    elif val >= PRICE_WATCH_MWH and val > 0:
        level = "low"
        expl  = (
            f"ERCOT at ${val:.0f}/MWh is within range but approaching watch levels. "
            f"Set a price alert above ${int(val * 1.15)}/MWh and monitor the afternoon peak window."
        )
    else:
        price_str = f"${val:.0f}/MWh" if val > 0 else "within normal range"
        level     = "low"
        expl      = (
            f"ERCOT Houston Hub at {price_str} — pricing within normal operating range. "
            "No elevated market-driven pressure detected."
        )

    return {"level": level, "explanation": expl, "score": score}


# ------------------------------------------------------------------------------
# Phase 2 — Gas-to-Power Impact Engine
# ------------------------------------------------------------------------------

def _compute_gas_to_power_impact(
    gas_sig:     Dict,
    weather_sig: Dict,
    gas_records: List[Dict],
) -> Dict[str, Any]:
    """
    Composite intelligence signal: how much does gas supply pressure
    compound with power demand to affect generation cost sensitivity?
    HIGH  : storage sharply below + Henry Hub rising + elevated weather demand
    MEDIUM: storage below seasonal OR henry rising with some demand pressure
    LOW   : storage near normal, stable pricing
    """
    gas_triggered     = gas_sig.get("triggered", False)
    gas_severity      = gas_sig.get("severity", "low")
    weather_triggered = weather_sig.get("triggered", False)
    weather_severity  = weather_sig.get("severity", "low")

    henry_hub    = None
    henry_rising = False
    if len(gas_records) >= 2:
        lp = gas_records[-1].get("henry_hub_price")
        pp = gas_records[-2].get("henry_hub_price")
        henry_hub = lp
        if lp and pp and pp > 0:
            henry_rising = ((lp - pp) / pp) * 100 > 5

    henry_note = (
        f" Henry Hub at ${henry_hub:.2f}/MMBtu ({'rising' if henry_rising else 'stable'})."
        if henry_hub else ""
    )

    high_condition = (
        (gas_severity == "high" and gas_triggered)
        or (
            gas_triggered and henry_rising
            and weather_triggered and weather_severity in ("medium", "high")
        )
    )
    medium_condition = (
        gas_triggered
        or (henry_rising and weather_triggered)
    )

    if high_condition:
        level = "high"
        expl  = (
            "Natural gas supply pressure may significantly increase power generation cost "
            "sensitivity. Below-average storage combined with elevated weather demand "
            "creates compounding risk." + henry_note
        )
    elif medium_condition:
        level = "medium"
        expl  = (
            "Natural gas supply pressure may increase power generation cost sensitivity "
            "if high demand persists. Storage is below seasonal averages, reducing "
            "the fuel supply buffer." + henry_note
        )
    else:
        level = "low"
        expl  = (
            "No gas-to-power action required. Storage and pricing conditions support "
            "adequate fuel supply for current generation demand." + henry_note
        )

    return {"level": level, "explanation": expl}


# ------------------------------------------------------------------------------
# Phase 5 — Event Detection
# ------------------------------------------------------------------------------

def _detect_events(
    prices:       List[Dict],
    forecasts:    List[Dict],
    gas_records:  List[Dict],
    data_sources: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Detect discrete energy risk events. Returns a list of event dicts.
    Events are informational only — they do not modify the risk score.
    """
    events: List[Dict[str, Any]] = []

    # 1. Heatwave
    if forecasts:
        hot_days = sum(
            1 for f in forecasts[:3]
            if float(f.get("temp_high_f", 0)) >= TEMP_HIGH_THRESHOLD_F
        )
        first_high = float(forecasts[0].get("temp_high_f", 0))
        if hot_days >= 2:
            events.append({
                "type":     "heatwave",
                "severity": "high",
                "message":  (
                    "Heatwave conditions detected across multiple forecast days. "
                    "Cooling demand pressure may increase significantly across Texas."
                ),
            })
        elif first_high >= TEMP_HIGH_THRESHOLD_F:
            events.append({
                "type":     "heatwave",
                "severity": "medium",
                "message":  (
                    f"Heat conditions detected with forecast high of {first_high:.0f}°F. "
                    "Cooling demand may increase across the Texas grid."
                ),
            })

    # 2. Cold snap
    if forecasts:
        cold_temp = float(forecasts[0].get("temp_low_f", 70))
        if cold_temp <= TEMP_LOW_THRESHOLD_F:
            events.append({
                "type":     "cold_snap",
                "severity": "high" if cold_temp <= 20 else "medium",
                "message":  (
                    f"Cold weather conditions detected with forecast low of {cold_temp:.0f}°F. "
                    "Heating demand may increase grid load."
                ),
            })

    # 3. ERCOT price volatility
    if len(prices) >= 2:
        current = float(prices[-1].get("price_mwh", 0))
        prev    = float(prices[-2].get("price_mwh", 0))
        if current >= PRICE_ABS_HIGH_MWH:
            events.append({
                "type":     "ercot_volatility",
                "severity": "high" if current >= 1000 else "medium",
                "message":  (
                    f"ERCOT price volatility detected at ${current:.0f}/MWh. "
                    "Short-term pricing uncertainty may be elevated."
                ),
            })
        elif prev > PRICE_LOW_FLOOR and prev > 0:
            move_pct = abs(current - prev) / prev
            if move_pct >= PRICE_SPIKE_THRESHOLD_PCT / 100:
                events.append({
                    "type":     "ercot_volatility",
                    "severity": "medium",
                    "message":  (
                        "Significant ERCOT price movement detected. "
                        "Short-term pricing uncertainty may be elevated."
                    ),
                })

    # 4. Gas storage anomaly (>10% below 5-year average)
    if gas_records:
        latest_pct = float(gas_records[-1].get("storage_pct_vs_avg", 0))
        if latest_pct <= GAS_STORAGE_PCT_THRESHOLD:
            events.append({
                "type":     "gas_storage_anomaly",
                "severity": "high" if latest_pct <= -20 else "medium",
                "message":  (
                    f"Natural gas storage is {abs(latest_pct):.1f}% below seasonal average, "
                    "increasing supply pressure sensitivity."
                ),
            })

    # 5. Data source degradation
    degraded = [
        src.upper()
        for src, status in data_sources.items()
        if status.get("status") in ("stale", "unavailable")
    ]
    if degraded:
        events.append({
            "type":     "data_source_degraded",
            "severity": "low",
            "message":  (
                f"One or more energy data sources are delayed or unavailable "
                f"({', '.join(degraded)}). Confidence scores have been adjusted."
            ),
        })

    return events


# ------------------------------------------------------------------------------
# Phase 11 — Premium Intelligence Layer
# ------------------------------------------------------------------------------

def _compute_risk_narrative(
    risk_score:          str,
    demand_pressure:     Dict[str, Any],
    supply_pressure:     Dict[str, Any],
    market_reaction:     Dict[str, Any],
    gas_to_power_impact: Dict[str, Any],
    risk_direction:      str,
    primary_driver_type: str,
    price_val:           float,
    weather_val:         float,
    gas_pct:             float,
) -> Dict[str, str]:
    """
    System-thinking narrative engine.
    Connects weather → demand pressure → grid load
               gas   → generation cost sensitivity
               ERCOT → real-time market reflection of the balance.
    Returns {headline, body, temporal_context, next_period_note}.
    """
    risk_label = risk_score.capitalize()

    demand_level = demand_pressure.get("level", "low")
    supply_level = supply_pressure.get("level", "low")
    market_level = market_reaction.get("level", "low")

    # ── Headline — situational awareness ──────────────────────────────────────
    if risk_score == "low":
        headline = "Stable conditions — no elevated operational pressure detected"
    elif risk_score == "medium":
        headline = "Moderate conditions — increased monitoring priority may apply"
    else:
        headline = "Elevated conditions — internal escalation procedures may be warranted"

    temporal_ctx = "0–6 hours"
    next_period  = "Reassess at next refresh. Conditions may shift within the next 6–24 hours."

    # ── Sentence 1: weather → demand chain ────────────────────────────────────
    if demand_level == "high":
        if weather_val >= TEMP_HIGH_THRESHOLD_F:
            s1 = (
                f"Extreme heat of {weather_val:.0f}°F is driving significant cooling demand "
                "across the Texas grid — reserve margins are under pressure and afternoon "
                "peak exposure (14:00–19:00 CDT) is elevated."
            )
        else:
            s1 = (
                f"Severe cold of {weather_val:.0f}°F is driving significant heating demand — "
                "grid load is elevated and overnight exposure warrants attention."
            )
    elif demand_level == "medium":
        if weather_val >= TEMP_HIGH_THRESHOLD_F:
            s1 = (
                f"Temperatures of {weather_val:.0f}°F are pressuring afternoon peak demand. "
                "Confirm hedging positions cover the 14:00–18:00 CDT window."
            )
        elif weather_val > 0:
            s1 = (
                f"Cool temperatures of {weather_val:.0f}°F are elevating overnight heating demand. "
                "Monitor early-morning grid load for any supply tightness."
            )
        else:
            s1 = "Demand pressure is moderate — above normal but within manageable operating range."
    else:
        s1 = (
            "Weather conditions are within normal seasonal ranges. "
            "No demand-driven grid pressure expected through the next 24 hours."
        )

    # ── Sentence 2: gas → generation cost chain ───────────────────────────────
    gas_abs = abs(gas_pct)
    if supply_level == "high":
        s2 = (
            f"Gas storage is critically low — {gas_abs:.0f}% below the 5-year average — "
            "reducing the fuel buffer available for gas-fired generation during any demand surge. "
            "Assess fuel supply agreements now."
        )
    elif supply_level == "medium":
        s2 = (
            f"Gas storage is {gas_abs:.0f}% below seasonal averages, reducing the supply buffer "
            "and increasing cost sensitivity during demand peaks. "
            "Monitor Henry Hub for any further movement."
        )
    else:
        s2 = (
            "Natural gas supply is adequate with storage near seasonal norms. "
            "No fuel-side constraints expected to compound demand pressure."
        )

    # ── Sentence 3: ERCOT → real-time market signal ───────────────────────────
    price_str = f"${price_val:.0f}/MWh" if price_val > 0 else "current levels"
    if market_level == "high":
        s3 = (
            f"ERCOT Houston Hub at {price_str} is already pricing in elevated stress — "
            "avoid unhedged spot exposure until prices normalize."
        )
    elif market_level == "medium":
        s3 = (
            f"ERCOT pricing at {price_str} is showing early sensitivity to current conditions. "
            "Set price alerts and confirm forward positions are in place."
        )
    else:
        s3 = (
            f"ERCOT pricing at {price_str} is within normal operating range — "
            "no immediate market-driven action required."
        )

    # ── Direction modifier ────────────────────────────────────────────────────
    if risk_direction == "increasing":
        next_period = (
            "Conditions are trending higher. Increase monitoring frequency and confirm "
            "contingency protocols are ready if risk escalates within the next 6–24 hours."
        )
    elif risk_direction == "decreasing":
        next_period = (
            "Conditions are trending lower. Continue standard monitoring — "
            "risk is expected to ease over the next 6–24 hours barring new disruptions."
        )

    body = f"{s1} {s2} {s3}"

    return {
        "headline":         headline,
        "body":             body,
        "temporal_context": temporal_ctx,
        "next_period_note": next_period,
    }


def _compute_cost_impact(
    risk_score:      str,
    demand_pressure: Dict[str, Any],
    supply_pressure: Dict[str, Any],
    market_reaction: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Plain-language cost impact interpretation.
    Returns {level, label, description}.
    Does NOT provide financial advice — uses probabilistic market language only.
    """
    demand_level = demand_pressure.get("level", "low")
    supply_level = supply_pressure.get("level", "low")
    market_level = market_reaction.get("level", "low")

    if risk_score == "high":
        return {
            "level":       "high",
            "label":       "Elevated Pricing Variability Risk",
            "description": (
                "Significant pricing volatility risk may occur during this period. "
                "Energy-intensive operations may experience cost variability above normal ranges. "
                "Monitoring procurement timing is recommended."
            ),
        }
    elif risk_score == "medium":
        if demand_level == "medium" or demand_level == "high":
            return {
                "level":       "medium",
                "label":       "Moderate Pricing Variability",
                "description": (
                    "Moderate pricing variability may occur during peak demand periods. "
                    "Cost exposure is within normal seasonal ranges but above baseline. "
                    "Awareness of market timing is advisable."
                ),
            }
        elif supply_level == "medium" or supply_level == "high":
            return {
                "level":       "medium",
                "label":       "Supply-Side Cost Sensitivity",
                "description": (
                    "Natural gas supply tightness may increase generation cost sensitivity. "
                    "Moderate pricing variability is possible if demand increases unexpectedly."
                ),
            }
        else:
            return {
                "level":       "medium",
                "label":       "Moderate Market Sensitivity",
                "description": (
                    "Market conditions suggest moderate cost sensitivity. "
                    "Pricing variability is possible but not expected to be severe."
                ),
            }
    else:
        return {
            "level":       "low",
            "label":       "Minimal Expected Cost Impact",
            "description": (
                "Current conditions suggest minimal pricing variability risk. "
                "Energy costs are expected to remain within normal seasonal ranges. "
                "No unusual market stress signals detected."
            ),
        }


def _compute_market_condition(
    risk_score:      str,
    risk_direction:  str,
    demand_pressure: Dict[str, Any],
    supply_pressure: Dict[str, Any],
    market_reaction: Dict[str, Any],
) -> Dict[str, Any]:
    """
    7-state market condition classifier.
    States: Stable | Watch | Tightening | Elevated | Volatile | Stress Building | Critical
    """
    demand_level = demand_pressure.get("level", "low")
    supply_level = supply_pressure.get("level", "low")
    market_level = market_reaction.get("level", "low")

    high_count = sum(1 for l in [demand_level, supply_level, market_level] if l == "high")
    med_count  = sum(1 for l in [demand_level, supply_level, market_level] if l in ("medium", "high"))

    # Critical: all 3 drivers high, or high risk + increasing direction + 2+ high
    if high_count >= 3 or (risk_score == "high" and risk_direction == "increasing" and high_count >= 2):
        return {
            "label":       "Critical",
            "description": "All risk drivers are simultaneously elevated and escalating. Conditions reflect severe near-term market stress.",
        }
    # Stress Building: 2+ high drivers and risk is increasing
    if high_count >= 2 and risk_direction == "increasing":
        return {
            "label":       "Stress Building",
            "description": "Multiple high-severity drivers are reinforcing each other with an increasing risk direction. Near-term conditions are tightening significantly.",
        }
    # Elevated Risk: high risk score or 2+ medium+ drivers
    if risk_score == "high" or (med_count >= 2 and high_count >= 1):
        return {
            "label":       "Elevated Risk",
            "description": "Multiple risk drivers are elevated. Market conditions reflect converging demand, supply, and pricing pressures.",
        }
    # Volatile: market reaction elevated (ERCOT price moving)
    if market_level in ("medium", "high"):
        return {
            "label":       "Volatile",
            "description": "ERCOT pricing is showing volatility signals above normal operating range. Market reaction is elevated.",
        }
    # Tightening: demand or supply elevated + increasing direction
    if (demand_level in ("medium", "high") or supply_level in ("medium", "high")) and risk_direction == "increasing":
        return {
            "label":       "Tightening",
            "description": "Supply or demand conditions are tightening with an increasing risk direction. Market balance is under moderate pressure.",
        }
    # Watch: any single medium driver
    if med_count >= 1:
        return {
            "label":       "Watch",
            "description": "One or more risk drivers are at moderate levels. Conditions are manageable but warrant monitoring.",
        }
    # Stable: all low
    return {
        "label":       "Stable",
        "description": "All monitored market drivers are within normal ranges. No significant supply, demand, or pricing stress detected.",
    }


def _compute_alert_severity(
    risk_score:      str,
    active_count:    int,
    demand_pressure: Dict[str, Any],
    supply_pressure: Dict[str, Any],
    market_reaction: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Classify alert severity for operator awareness.
    Returns {level, label, description} where level is one of:
    informational | monitoring | elevated | critical
    """
    demand_level = demand_pressure.get("level", "low")
    supply_level = supply_pressure.get("level", "low")
    market_level = market_reaction.get("level", "low")

    all_high = all(l == "high" for l in [demand_level, supply_level, market_level])

    if risk_score == "high" and active_count >= 2 and all_high:
        return {
            "level":       "critical",
            "label":       "Critical",
            "description": "All risk drivers are at high levels simultaneously. Immediate monitoring recommended.",
        }
    elif risk_score == "high":
        return {
            "level":       "elevated",
            "label":       "Elevated",
            "description": "Multiple risk signals active. Elevated monitoring recommended.",
        }
    elif risk_score == "medium" or active_count >= 1:
        return {
            "level":       "monitoring",
            "label":       "Monitoring",
            "description": "One or more risk signals are active. Continued monitoring is advisable.",
        }
    else:
        return {
            "level":       "informational",
            "label":       "Informational",
            "description": "No active risk signals. Conditions are within normal ranges.",
        }



# ------------------------------------------------------------------------------
# Signal Alignment Score
# ------------------------------------------------------------------------------

def _compute_signal_alignment(all_sigs: List[Dict]) -> Dict[str, Any]:
    """Measure how many risk drivers are reinforcing each other."""
    triggered = [s for s in all_sigs if s.get("triggered")]
    count     = len(triggered)
    types     = [s.get("signal_type", "").replace("_", " ") for s in triggered]

    if count == 0:
        return {"label": "None",     "score": 0, "description": "No active risk drivers."}
    if count == 1:
        return {"label": "Weak",     "score": 1, "description": f"{types[0].capitalize()} is the sole active driver."}
    if count == 2:
        return {"label": "Moderate", "score": 2, "description": f"{types[0].capitalize()} and {types[1]} are reinforcing — monitoring recommended."}
    return     {"label": "Strong",   "score": 3, "description": "All three risk drivers are simultaneously active — elevated near-term uncertainty."}


# ------------------------------------------------------------------------------
# Driver Trend Directions
# ------------------------------------------------------------------------------

def _compute_driver_trends(
    prices:      List[Dict],
    gas_records: List[Dict],
    demand_pressure: Dict[str, Any],
    supply_pressure: Dict[str, Any],
    market_reaction: Dict[str, Any],
) -> Dict[str, str]:
    """Returns trend direction per driver: rising | stable | falling"""
    trends: Dict[str, str] = {}

    # ERCOT price trend
    if len(prices) >= 3:
        vals = [float(p.get("price_mwh", 0)) for p in prices[-3:] if float(p.get("price_mwh", 0)) > 1]
        if len(vals) >= 2:
            pct = ((vals[-1] - vals[0]) / max(vals[0], 1)) * 100
            trends["price_volatility"] = "rising" if pct > 8 else "falling" if pct < -8 else "stable"
        else:
            trends["price_volatility"] = "stable"
    else:
        trends["price_volatility"] = "stable"

    # Weather demand trend — based on current pressure level
    demand_level = demand_pressure.get("level", "low")
    trends["weather_demand"] = "rising" if demand_level == "high" else "stable" if demand_level == "low" else "rising"

    # Gas supply trend — based on Henry Hub movement
    if len(gas_records) >= 2:
        lp = gas_records[-1].get("henry_hub_price") or 0
        pp = gas_records[-2].get("henry_hub_price") or 0
        if pp > 0:
            pct = ((lp - pp) / pp) * 100
            trends["gas_supply"] = "rising" if pct > 5 else "falling" if pct < -5 else "stable"
        else:
            trends["gas_supply"] = "stable"
    else:
        supply_level = supply_pressure.get("level", "low")
        trends["gas_supply"] = "rising" if supply_level == "high" else "stable"

    return trends


# ------------------------------------------------------------------------------
# What Changed Engine
# ------------------------------------------------------------------------------

def _compute_what_changed(
    risk_score:      str,
    demand_pressure: Dict[str, Any],
    supply_pressure: Dict[str, Any],
    market_reaction: Dict[str, Any],
    prices:          List[Dict],
    location:        str = "Houston",
) -> List[Dict[str, str]]:
    """Compare current state to previous interval. Returns change list."""
    global _PREV_SIGNALS
    prev    = _PREV_SIGNALS.get(location, {})
    changes: List[Dict[str, str]] = []
    rank    = {"low": 0, "medium": 1, "high": 2}

    # Risk score change
    prev_risk   = prev.get("risk_score")
    if prev_risk and prev_risk != risk_score:
        direction = "escalated" if rank.get(risk_score, 0) > rank.get(prev_risk, 0) else "improved"
        changes.append({"driver": "Risk Score", "change": f"{prev_risk.capitalize()} → {risk_score.capitalize()}", "direction": direction})

    # Demand change
    curr_demand = demand_pressure.get("level", "low")
    prev_demand = prev.get("demand_level")
    if prev_demand and prev_demand != curr_demand:
        direction = "rising" if rank.get(curr_demand, 0) > rank.get(prev_demand, 0) else "easing"
        changes.append({"driver": "Demand Pressure", "change": curr_demand.capitalize(), "direction": direction})

    # Supply change
    curr_supply = supply_pressure.get("level", "low")
    prev_supply = prev.get("supply_level")
    if prev_supply and prev_supply != curr_supply:
        direction = "rising" if rank.get(curr_supply, 0) > rank.get(prev_supply, 0) else "easing"
        changes.append({"driver": "Supply Pressure", "change": curr_supply.capitalize(), "direction": direction})

    # ERCOT price change
    if len(prices) >= 2:
        curr_price = float(prices[-1].get("price_mwh", 0))
        prev_price = float(prices[-2].get("price_mwh", 0))
        if prev_price > 1:
            pct = ((curr_price - prev_price) / prev_price) * 100
            if abs(pct) >= 5:
                sign      = "+" if pct > 0 else ""
                direction = "rising" if pct > 0 else "easing"
                changes.append({"driver": "ERCOT Price", "change": f"${curr_price:.0f}/MWh ({sign}{pct:.0f}%)", "direction": direction})

    # Stable fallback
    if not changes:
        changes.append({"driver": "All Drivers", "change": "No material changes since previous interval", "direction": "stable"})

    # Store current state
    _PREV_SIGNALS[location] = {
        "risk_score":   risk_score,
        "demand_level": curr_demand,
        "supply_level": curr_supply,
        "market_level": market_reaction.get("level", "low"),
    }
    return changes


# ------------------------------------------------------------------------------
# Main orchestration entry point
# ------------------------------------------------------------------------------

# ------------------------------------------------------------------------------
# Market Sensitivity Engine
# ------------------------------------------------------------------------------

def _compute_market_sensitivity(
    risk_score:       str,
    signal_alignment: Dict[str, Any],
    active_signals:   int,
    risk_direction:   str,
    demand_pressure:  Dict[str, Any],
    supply_pressure:  Dict[str, Any],
    market_reaction:  Dict[str, Any],
) -> Dict[str, Any]:
    """
    How reactive/sensitive current conditions are — distinct from raw risk level.
    A low-risk market can still be highly sensitive (one trigger away from escalation).
    Returns {level, description}.
    """
    score = 0

    alignment_score = signal_alignment.get("score", 0)
    score += alignment_score * 12   # 0, 12, 24, 36

    if risk_direction == "increasing":  score += 18
    elif risk_direction == "stable":    score += 0
    else:                               score -= 8

    if risk_score == "high":    score += 20
    elif risk_score == "medium": score += 10

    # High-level drivers add sensitivity
    for d in [demand_pressure, supply_pressure, market_reaction]:
        if d and d.get("level") == "high":    score += 8
        elif d and d.get("level") == "medium": score += 4

    score = max(0, min(95, score))

    if score >= 60:
        level = "Elevated Sensitivity"
        desc  = (
            "Current conditions are highly reactive. "
            "Additional demand, supply, or pricing pressure could trigger rapid escalation."
        )
    elif score >= 35:
        level = "Moderate Sensitivity"
        desc  = (
            "Market conditions show elevated responsiveness to new pressure inputs. "
            "Monitoring is advised."
        )
    else:
        level = "Low Sensitivity"
        desc  = (
            "Market conditions are within normal operating bounds. "
            "Sensitivity to new pressure inputs is limited at this time."
        )

    return {"level": level, "score": score, "description": desc}


# ------------------------------------------------------------------------------
# Potential Escalation Drivers
# ------------------------------------------------------------------------------

def _compute_potential_escalation_drivers(
    demand_pressure:  Dict[str, Any],
    supply_pressure:  Dict[str, Any],
    market_reaction:  Dict[str, Any],
    risk_direction:   str,
    signal_alignment: Dict[str, Any],
    events:           List[Dict],
) -> List[str]:
    """
    Generate a list of potential escalation drivers based on current conditions.
    Only returns drivers that are plausibly relevant given current state.
    """
    drivers = []

    demand_level = demand_pressure.get("level", "low")  if demand_pressure  else "low"
    supply_level = supply_pressure.get("level", "low")  if supply_pressure  else "low"
    market_level = market_reaction.get("level", "low")  if market_reaction  else "low"
    alignment    = signal_alignment.get("label", "None")

    if demand_level in ("medium", "high"):
        drivers.append("Sustained heat persistence driving continued grid load elevation")
    if supply_level in ("medium", "high"):
        drivers.append("Gas supply deterioration compounding generation cost sensitivity")
    if market_level == "high":
        drivers.append("Accelerating ERCOT price volatility reducing market predictability")
    if risk_direction == "increasing":
        drivers.append("Rising risk trajectory — conditions trending toward further escalation")
    if alignment in ("Moderate", "Strong"):
        drivers.append("Converging signal alignment increasing compounding risk potential")
    if any(e.get("severity") == "high" for e in events):
        drivers.append("Active high-severity events reinforcing operational risk exposure")

    # Structural risks always relevant
    if demand_level != "low" or supply_level != "low":
        drivers.append("Reserve margin sensitivity during simultaneous demand and supply pressure")

    if not drivers:
        drivers.append("No material escalation catalysts identified at current monitoring interval")

    return drivers[:5]   # cap at 5 for readability


# ------------------------------------------------------------------------------
# Escalation Probability Engine
# ------------------------------------------------------------------------------

def _compute_escalation_probability(
    risk_score:      str,
    risk_direction:  str,
    signal_alignment: Dict[str, Any],
    active_signals:  int,
    events:          List[Dict],
    demand_pressure: Dict[str, Any],
    supply_pressure: Dict[str, Any],
    market_reaction: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Compute probability that conditions will escalate in the near term.
    Returns {level, pct, rationale}.
    """
    score = 0

    # Risk score contribution
    if risk_score == "high":      score += 40
    elif risk_score == "medium":  score += 20

    # Direction contribution
    if risk_direction == "increasing":    score += 20
    elif risk_direction == "decreasing":  score -= 10

    # Signal alignment contribution
    alignment_score = signal_alignment.get("score", 0)
    score += alignment_score * 8   # 0, 8, 16, 24

    # Active events
    high_events = [e for e in events if e.get("severity") == "high"]
    score += len(high_events) * 10

    # High-level drivers compound
    high_drivers = sum(1 for d in [demand_pressure, supply_pressure, market_reaction]
                       if d and d.get("level") == "high")
    score += high_drivers * 5

    # Clamp to 0–95
    score = max(0, min(95, score))

    # Determine level label
    if score >= 65:
        level   = "Elevated"
        rationale = (
            "Multiple reinforcing risk factors active. "
            f"{'Increasing risk direction and ' if risk_direction == 'increasing' else ''}"
            f"signal alignment is {signal_alignment.get('label', 'moderate')}."
        )
    elif score >= 40:
        level   = "Moderate"
        rationale = (
            f"{'Rising conditions detected — ' if risk_direction == 'increasing' else ''}"
            f"{'conditions are stable — ' if risk_direction == 'stable' else ''}"
            f"{signal_alignment.get('description', 'Some drivers active.')}"
        )
    elif score >= 20:
        level   = "Low-Moderate"
        rationale = (
            "Monitoring conditions. "
            f"One or more drivers elevated but not reinforcing broadly. "
            f"Escalation would require additional pressure."
        )
    else:
        level   = "Low"
        rationale = "No active escalation signals. All monitored channels within normal operating range."

    return {
        "level":     level,
        "pct":       score,
        "rationale": rationale.strip(),
    }



# ══════════════════════════════════════════════════════════════════════════════
# PHASE 10 — PREDICTIVE ENERGY INTELLIGENCE
# ══════════════════════════════════════════════════════════════════════════════

def _compute_weather_persistence(forecasts: List[Dict]) -> Dict[str, Any]:
    """Analyze sustained heat duration and overnight cooling recovery."""
    if not forecasts:
        return {
            "consecutive_high_days":  0,
            "overnight_cooling_weak": False,
            "persistence_risk":       "low",
            "description": "Insufficient forecast data for persistence analysis.",
        }
    high_days   = [f for f in forecasts[:7] if (f.get("temp_high_f") or 0) >= 95]
    hot_nights  = [f for f in forecasts[:4] if (f.get("temp_low_f")  or 60) >= 75]
    consec_high = len(high_days)
    cooling_weak = len(hot_nights) >= 2

    if consec_high >= 4 or (consec_high >= 3 and cooling_weak):
        risk = "high"
        desc = (
            f"Extended heat persistence detected — {consec_high} forecast intervals at or above 95°F. "
            + ("Overnight temperatures remain elevated, limiting cooling recovery between demand intervals."
               if cooling_weak else
               "Sustained demand pressure expected through the forecast window.")
        )
    elif consec_high >= 2 and cooling_weak:
        risk = "elevated"
        desc = (
            f"Multiple consecutive high-temperature intervals with limited overnight cooling. "
            "Sustained demand pressure likely through the near-term window."
        )
    elif consec_high >= 2:
        risk = "moderate"
        desc = (
            f"{consec_high} consecutive high-temperature intervals detected. "
            "Weather-driven demand pressure may persist through the near-term outlook."
        )
    elif consec_high == 1 and cooling_weak:
        risk = "moderate"
        desc = "Elevated temperature interval with weak overnight cooling. Demand pressure may continue."
    else:
        risk = "low"
        desc = "No sustained heat persistence pattern detected. Weather conditions within normal seasonal range."

    return {
        "consecutive_high_days":  consec_high,
        "overnight_cooling_weak": cooling_weak,
        "persistence_risk":       risk,
        "description":            desc,
    }


def _compute_early_warnings(
    demand: Dict, supply: Dict, market: Dict,
    forecasts: List[Dict], gas_records: List[Dict],
    escalation_prob: Dict, risk_direction: str,
    signal_alignment: Dict,
) -> Dict[str, Any]:
    """
    Detect pre-escalation patterns BEFORE they trigger formal risk levels.
    Returns probabilistic operational warning strings — not predictions.
    Language is informational, probabilistic, and non-financial.
    """
    warnings: List[str] = []
    severity = "none"

    demand_lvl  = demand.get("level",  "low")
    supply_lvl  = supply.get("level",  "low")
    market_lvl  = market.get("level",  "low")
    align_score = signal_alignment.get("score", 0)
    esc_pct     = escalation_prob.get("pct", 0)

    high_temp_days = sum(1 for f in forecasts[:5] if (f.get("temp_high_f") or 0) >= 95)
    hot_nights     = sum(1 for f in forecasts[:3] if (f.get("temp_low_f") or 60) >= 75)

    # ── Heat persistence ────────────────────────────────────────────────────
    if high_temp_days >= 3:
        warnings.append(
            "Sustained heat persistence detected across multiple forecast intervals — "
            "elevated cooling demand pressure may persist through the near-term window."
        )
        severity = "caution"
    elif high_temp_days >= 2 and demand_lvl in ("medium", "high"):
        warnings.append(
            "Consecutive high-temperature intervals suggest demand pressure may sustain "
            "above baseline through the near-term outlook."
        )
        severity = "watch"

    # ── Overnight cooling weakness ──────────────────────────────────────────
    if hot_nights >= 2 and demand_lvl in ("medium", "high"):
        warnings.append(
            "Overnight temperature recovery appears limited — reduced cooling relief may "
            "sustain demand pressure through consecutive load intervals."
        )
        if severity == "none":
            severity = "watch"

    # ── Gas supply tightening trajectory ────────────────────────────────────
    if len(gas_records) >= 2:
        latest_pct = gas_records[-1].get("storage_pct_vs_avg", 0) or 0
        prior_pct  = gas_records[-2].get("storage_pct_vs_avg", 0) or 0
        if latest_pct < prior_pct and supply_lvl in ("medium", "high"):
            warnings.append(
                "Natural gas storage trending below prior-week levels — "
                "supply-side sensitivity may be increasing despite current market stability."
            )
            if severity == "none":
                severity = "watch"

    # ── Supply + demand convergence ──────────────────────────────────────────
    if demand_lvl in ("medium", "high") and supply_lvl in ("medium", "high"):
        warnings.append(
            "Weather-driven demand pressure and gas supply sensitivity are simultaneously "
            "elevated — convergence conditions increase escalation responsiveness."
        )
        severity = "caution"

    # ── Volatility acceleration ──────────────────────────────────────────────
    if market_lvl in ("medium", "high") and risk_direction == "increasing":
        warnings.append(
            "Market reaction indicators are elevated and conditions are trending in an "
            "increasing direction — price volatility acceleration is possible near-term."
        )
        severity = "caution"

    # ── Multi-driver alignment building ──────────────────────────────────────
    if align_score >= 2 and esc_pct >= 25:
        warnings.append(
            "Multiple risk drivers are simultaneously active — signal alignment suggests "
            "conditions are sensitive to additional pressure from any single driver."
        )
        if severity not in ("alert", "caution"):
            severity = "caution"

    # ── Reserve margin tightening watch ──────────────────────────────────────
    if demand_lvl == "high" and market_lvl in ("medium", "high"):
        warnings.append(
            "High demand conditions combined with active market reaction — "
            "generation reserve margins may be approaching tighter operating bands."
        )
        severity = "alert"

    warnings = warnings[:5]
    return {
        "warnings":         warnings,
        "warning_count":    len(warnings),
        "highest_severity": severity,
    }


def _compute_risk_trend(
    risk_score: str, risk_direction: str, signal_alignment: Dict,
    demand: Dict, supply: Dict, market: Dict,
    what_changed: List[Dict],
) -> Dict[str, Any]:
    """Determine the trajectory of conditions — direction of travel, not current state."""
    rising_count = sum(1 for w in what_changed if w.get("direction") in ("rising", "escalated"))
    easing_count = sum(1 for w in what_changed if w.get("direction") in ("easing", "improved"))
    align_score  = signal_alignment.get("score", 0)

    if risk_score == "high" and risk_direction == "increasing":
        traj     = "accelerating"
        label    = "Conditions Accelerating"
        desc     = ("Multiple risk indicators are simultaneously elevated and trending higher. "
                    "Conditions may escalate further without stabilizing pressure changes.")
        momentum = "negative"
    elif risk_score == "high" and risk_direction == "stable":
        traj     = "deteriorating"
        label    = "Conditions Deteriorated"
        desc     = ("Risk conditions have reached an elevated state and are holding at current levels. "
                    "No immediate improvement signals detected.")
        momentum = "negative"
    elif risk_score == "medium" and risk_direction == "increasing":
        traj     = "tightening"
        label    = "Conditions Tightening"
        desc     = ("Moderate risk indicators are trending toward elevated territory. "
                    "Conditions warrant increased monitoring frequency.")
        momentum = "negative"
    elif risk_direction == "decreasing":
        traj     = "improving"
        label    = "Conditions Improving"
        desc     = ("Risk indicators are trending lower. Conditions appear to be easing toward a "
                    "more stable operational environment.")
        momentum = "positive"
    elif rising_count > easing_count and align_score >= 2:
        traj     = "tightening"
        label    = "Conditions Tightening"
        desc     = ("Multiple drivers showing increasing pressure. Conditions may tighten further "
                    "if current trajectory continues.")
        momentum = "negative"
    elif easing_count > rising_count:
        traj     = "improving"
        label    = "Conditions Easing"
        desc     = ("Several risk indicators have moved to lower levels. Operational pressure "
                    "appears to be reducing from recent intervals.")
        momentum = "positive"
    else:
        traj     = "stable"
        label    = "Conditions Stable"
        desc     = ("Risk indicators are holding at current levels without material directional "
                    "movement in either direction.")
        momentum = "neutral"

    return {
        "trajectory":  traj,
        "label":       label,
        "description": desc,
        "momentum":    momentum,
    }


def _compute_gas_power_correlation(
    gas_records: List[Dict],
    demand: Dict, supply: Dict, market: Dict,
) -> Dict[str, Any]:
    """Analyze relationship between gas supply, weather demand, and ERCOT pricing."""
    demand_lvl = demand.get("level", "low")
    supply_lvl = supply.get("level", "low")
    market_lvl = market.get("level", "low")

    latest_gas  = gas_records[-1] if gas_records else {}
    henry_hub   = float(latest_gas.get("henry_hub_price", 3.0) or 3.0)
    storage_pct = float(latest_gas.get("storage_pct_vs_avg", 0) or 0)

    high_factors = sum([
        demand_lvl in ("medium", "high"),
        supply_lvl in ("medium", "high"),
        market_lvl in ("medium", "high"),
        henry_hub > 3.5,
        storage_pct < -5,
    ])

    direction_str = f"{'below' if storage_pct < 0 else 'above'}"
    storage_abs   = abs(storage_pct)

    if high_factors >= 4:
        corr = "high"
        sens = "Strong coupling between gas supply conditions and ERCOT pricing behavior detected."
        desc = (
            f"Gas-to-power correlation is elevated. Demand pressure, supply sensitivity, and market "
            f"reaction are simultaneously active — fuel-side costs are likely influencing generation "
            f"dispatch decisions. Henry Hub at ${henry_hub:.2f}/MMBtu with storage "
            f"{storage_abs:.0f}% {direction_str} 5-year average."
        )
    elif high_factors >= 2:
        corr = "elevated"
        sens = "Moderate coupling between gas market conditions and power pricing observed."
        demand_note = "Weather-driven demand is increasing gas-fired generation requirements. " if demand_lvl in ("medium","high") else ""
        supply_note = "Gas storage conditions are contributing to supply-side sensitivity. " if supply_lvl in ("medium","high") else ""
        desc = (
            f"Gas-to-power sensitivity is moderately elevated. {demand_note}{supply_note}"
            f"Henry Hub at ${henry_hub:.2f}/MMBtu."
        ).strip()
    elif high_factors == 1:
        corr = "moderate"
        sens = "Limited gas-to-power coupling at current conditions."
        avg_note = "average" if storage_abs < 5 else f"{storage_abs:.0f}% {direction_str} average"
        desc = (
            f"Gas supply conditions are within adequate range. "
            f"Henry Hub at ${henry_hub:.2f}/MMBtu with storage near {avg_note}. "
            "Fuel-side escalation risk remains limited at current conditions."
        )
    else:
        corr = "low"
        sens = "Gas supply adequate — minimal fuel-side escalation risk."
        demand_note = "elevated" if demand_lvl == "high" else "current"
        desc = (
            f"Natural gas storage remains adequate, limiting immediate fuel-side escalation risk "
            f"despite {demand_note} weather demand. Henry Hub at ${henry_hub:.2f}/MMBtu."
        )

    return {
        "correlation_level":   corr,
        "sensitivity":         sens,
        "description":         desc,
        "henry_hub_price":     henry_hub,
        "storage_pct_vs_avg":  storage_pct,
    }


def _compute_interval_intelligence(
    risk_score: str, risk_direction: str,
    demand: Dict, supply: Dict, market: Dict,
    escalation_prob: Dict, confidence: Optional[int],
    weather_persistence: Dict,
    time_horizons: Dict,
) -> Dict[str, Any]:
    """Per-interval (0-6h, 6-24h, 24-48h) operational intelligence with confidence + escalation."""
    base_esc      = escalation_prob.get("pct", 0) or 0
    base_conf     = confidence or 70
    demand_lvl    = demand.get("level", "low")
    supply_lvl    = supply.get("level", "low")
    market_lvl    = market.get("level", "low")
    persist_risk  = weather_persistence.get("persistence_risk", "low")

    # Short-term 0-6h — highest certainty
    st_esc  = min(base_esc + 5, 95) if risk_direction == "increasing" else max(base_esc - 5, 0)
    st_conf = min(base_conf + 5, 95)
    st_out  = time_horizons.get("short_term", "Monitoring active for the next 6-hour interval.")
    if market_lvl == "high":
        st_focus = "Monitor ERCOT real-time pricing for volatility spikes and settlement point deviations."
    elif demand_lvl == "high":
        st_focus = "Track weather-driven load conditions and generation reserve margin reports."
    else:
        st_focus = "Routine monitoring — verify ERCOT pricing remains within normal operating band."

    # Near-term 6-24h — moderate uncertainty
    nt_esc  = min(base_esc + 10, 95) if persist_risk in ("elevated", "high") else base_esc
    nt_conf = max(base_conf - 8, 45)
    nt_out  = time_horizons.get("near_term", "Near-term conditions subject to weather persistence patterns.")
    if persist_risk in ("elevated", "high"):
        nt_focus = "Evaluate weather persistence through daytime peak intervals — cooling demand may remain elevated."
    elif supply_lvl in ("medium", "high"):
        nt_focus = "Monitor EIA storage updates and Henry Hub for supply-side sensitivity changes."
    else:
        nt_focus = "Standard monitoring — no material escalation signals projected for the 6-24h window."

    # Outlook 24-48h — lowest confidence
    out_esc  = min(base_esc + 5, 85) if risk_direction == "increasing" else max(base_esc - 10, 0)
    out_conf = max(base_conf - 18, 35)
    out_out  = time_horizons.get("outlook", "48-hour operational outlook based on current signal trajectory.")
    if persist_risk == "high":
        out_focus = "Review extended forecast models for heat wave duration and overnight recovery patterns."
    elif risk_direction == "decreasing":
        out_focus = "Conditions trending toward improvement — verify stabilization across all data sources."
    else:
        out_focus = "Continue monitoring all signal channels — conditions subject to weather and supply updates."

    return {
        "short_term": {
            "label":            "0–6 Hour Outlook",
            "outlook":          st_out,
            "confidence":       st_conf,
            "escalation_pct":   st_esc,
            "monitoring_focus": st_focus,
        },
        "near_term": {
            "label":            "6–24 Hour Outlook",
            "outlook":          nt_out,
            "confidence":       nt_conf,
            "escalation_pct":   nt_esc,
            "monitoring_focus": nt_focus,
        },
        "outlook": {
            "label":            "24–48 Hour Outlook",
            "outlook":          out_out,
            "confidence":       out_conf,
            "escalation_pct":   out_esc,
            "monitoring_focus": out_focus,
        },
    }



# ══════════════════════════════════════════════════════════════════════════════
# PHASE 12 — ENTERPRISE OPERATIONAL INTELLIGENCE ENGINES
# ══════════════════════════════════════════════════════════════════════════════

def _compute_market_transition(
    risk_score: str, risk_direction: str,
    market_condition: Dict, risk_trend: Dict,
    demand: Dict, supply: Dict, market: Dict,
    signal_alignment: Dict,
) -> Dict[str, Any]:
    """
    Detect operational state transitions BEFORE escalation materialises.
    Tracks: stable → tightening → elevated → volatile → stabilising.
    """
    current_state = market_condition.get("label", "Stable")
    traj          = risk_trend.get("trajectory", "stable")
    align_score   = signal_alignment.get("score", 0)
    demand_lvl    = demand.get("level", "low")
    supply_lvl    = supply.get("level", "low")
    market_lvl    = market.get("level", "low")

    # ── Detect transition type ────────────────────────────────────────────────
    if traj in ("accelerating",) and risk_score == "high":
        transition      = "escalating"
        from_state      = "Elevated"
        to_state        = "Volatile"
        label           = "Escalating"
        urgency         = "high"
        description     = (
            "Conditions are transitioning from elevated toward volatile operating territory. "
            "Multiple risk drivers are simultaneously active and trending higher."
        )
        action          = "Immediate monitoring escalation recommended across all signal channels."

    elif traj == "tightening" and risk_score in ("low", "medium"):
        transition      = "tightening"
        from_state      = "Stable" if risk_score == "low" else "Watch"
        to_state        = "Tightening"
        label           = "Tightening"
        urgency         = "medium"
        description     = (
            "Operational pressure is building. Conditions are transitioning from stable "
            "toward tighter operating bands — a precursor to elevated risk if drivers persist."
        )
        action          = "Increase monitoring frequency. Verify ERCOT pricing and weather demand channels."

    elif traj == "deteriorating" and risk_score == "high":
        transition      = "elevated"
        from_state      = "Tightening"
        to_state        = "Elevated Risk"
        label           = "Elevated"
        urgency         = "high"
        description     = (
            "Conditions have deteriorated into elevated operational territory. "
            "Risk indicators are sustaining at high levels without improvement signals."
        )
        action          = "Activate heightened monitoring posture. Alert thresholds may be approaching."

    elif traj == "improving" and risk_score in ("low", "medium"):
        transition      = "stabilising"
        from_state      = "Elevated" if risk_score == "medium" else "Watch"
        to_state        = "Stabilising"
        label           = "Stabilising"
        urgency         = "low"
        description     = (
            "Operational conditions are transitioning toward a more stable state. "
            "Risk indicators are trending lower — sustained improvement is possible if current trajectory holds."
        )
        action          = "Maintain standard monitoring. Verify improvement across all data sources before reducing posture."

    elif demand_lvl in ("medium", "high") and supply_lvl in ("medium", "high") and align_score >= 2:
        transition      = "convergence"
        from_state      = "Watch"
        to_state        = "Converging Pressure"
        label           = "Pressure Convergence"
        urgency         = "medium"
        description     = (
            "Multiple independent risk drivers are converging simultaneously. "
            "Weather demand and gas supply pressures are both elevated — conditions are sensitive to further pressure."
        )
        action          = "Monitor convergence of supply and demand signals. Escalation risk elevated."

    else:
        transition      = "stable"
        from_state      = "Stable"
        to_state        = "Stable"
        label           = "Stable"
        urgency         = "low"
        description     = (
            "No material state transition detected. Operational conditions are holding at current levels "
            "without significant directional movement."
        )
        action          = "Continue standard monitoring cadence across all signal channels."

    return {
        "transition":  transition,
        "from_state":  from_state,
        "to_state":    to_state,
        "label":       label,
        "urgency":     urgency,
        "description": description,
        "action":      action,
    }


def _compute_scenarios(
    risk_score: str, demand: Dict, supply: Dict, market: Dict,
    weather_persistence: Dict, escalation_prob: Dict,
    risk_direction: str, signal_alignment: Dict,
) -> List[Dict[str, Any]]:
    """
    Generate conditional operational scenarios — what MIGHT happen if conditions evolve.
    Uses probabilistic, non-deterministic language only.
    Max 4 scenarios. Only generates scenarios with meaningful signal basis.
    """
    scenarios: List[Dict[str, Any]] = []

    demand_lvl   = demand.get("level",   "low")
    supply_lvl   = supply.get("level",   "low")
    market_lvl   = market.get("level",   "low")
    persist_risk = weather_persistence.get("persistence_risk", "low")
    esc_pct      = escalation_prob.get("pct", 0) or 0
    align_score  = signal_alignment.get("score", 0)

    # ── Scenario 1: Sustained heat → demand escalation ────────────────────────
    if persist_risk in ("moderate", "elevated", "high") or demand_lvl in ("medium", "high"):
        intensity = "significantly" if persist_risk == "high" else "further"
        scenarios.append({
            "id":          "heat_persistence",
            "trigger":     "If temperatures persist above forecast levels",
            "outcome":     f"demand pressure may {intensity} strengthen through afternoon peak intervals",
            "probability": "elevated" if persist_risk in ("elevated", "high") else "moderate",
            "full":        f"If temperatures persist above forecast levels, demand pressure may {intensity} strengthen through afternoon peak intervals, increasing the likelihood of reserve margin tightening.",
        })

    # ── Scenario 2: Gas supply tightening → fuel-side sensitivity ────────────
    if supply_lvl in ("medium", "high") or (supply_lvl == "low" and demand_lvl in ("medium", "high")):
        scenarios.append({
            "id":          "gas_supply",
            "trigger":     "If natural gas supply conditions tighten alongside elevated weather demand",
            "outcome":     "fuel-side operational sensitivity may elevate and could pressure ERCOT generation dispatch",
            "probability": "moderate" if supply_lvl == "low" else "elevated",
            "full":        "If natural gas supply conditions tighten alongside elevated weather demand, fuel-side operational sensitivity may elevate and could pressure ERCOT generation dispatch margins.",
        })

    # ── Scenario 3: ERCOT volatility acceleration ──────────────────────────
    if market_lvl in ("medium", "high") or risk_direction == "increasing":
        scenarios.append({
            "id":          "volatility",
            "trigger":     "If ERCOT pricing volatility increases alongside active signal alignment",
            "outcome":     "operational market sensitivity may escalate and broader cost exposure conditions could emerge",
            "probability": "elevated" if market_lvl == "high" else "moderate",
            "full":        "If ERCOT pricing volatility increases alongside active signal alignment, operational market sensitivity may escalate and broader cost exposure conditions could emerge across the near-term window.",
        })

    # ── Scenario 4: Multi-driver convergence → rapid escalation ──────────────
    if align_score >= 2 and esc_pct >= 30:
        scenarios.append({
            "id":          "convergence",
            "trigger":     "If current multi-driver alignment sustains or strengthens",
            "outcome":     "escalation conditions may develop more rapidly than single-driver analysis would suggest",
            "probability": "moderate" if esc_pct < 50 else "elevated",
            "full":        "If current multi-driver alignment sustains or strengthens, escalation conditions may develop more rapidly than single-driver analysis would suggest — monitor all three signal channels simultaneously.",
        })

    # ── Scenario 5 (bonus): Stabilisation path ───────────────────────────────
    if risk_direction == "decreasing" and risk_score in ("medium", "high"):
        scenarios.append({
            "id":          "stabilisation",
            "trigger":     "If current improving trajectory continues",
            "outcome":     "conditions may stabilise toward lower operational risk within the near-term outlook",
            "probability": "moderate",
            "full":        "If current improving trajectory continues, conditions may stabilise toward lower operational risk within the near-term outlook — pending verification across weather and gas supply channels.",
        })

    return scenarios[:4]


def _compute_operational_exposure(
    risk_score: str, demand: Dict, supply: Dict, market: Dict,
    weather_persistence: Dict, escalation_prob: Dict,
    signal_alignment: Dict, cost_impact: Dict,
) -> Dict[str, Any]:
    """
    4-level operational cost exposure model.
    Remains strictly informational — no financial advice or guarantees.
    """
    demand_lvl   = demand.get("level",   "low")
    supply_lvl   = supply.get("level",   "low")
    market_lvl   = market.get("level",   "low")
    persist_risk = weather_persistence.get("persistence_risk", "low")
    esc_pct      = escalation_prob.get("pct", 0) or 0
    align_score  = signal_alignment.get("score", 0)

    # Score from 0–10
    score = 0
    score += {"low": 0, "medium": 2, "high": 4}.get(demand_lvl,  0)
    score += {"low": 0, "medium": 1, "high": 3}.get(supply_lvl,  0)
    score += {"low": 0, "medium": 1, "high": 2}.get(market_lvl,  0)
    score += {"low": 0, "moderate": 1, "elevated": 2, "high": 3}.get(persist_risk, 0)
    score += min(2, esc_pct // 30)
    score += min(1, align_score // 2)

    if score >= 8:
        level       = "High Exposure"
        cls         = "high"
        short_desc  = "Operational energy exposure is elevated across multiple risk dimensions."
        detail      = (
            "Persistent heat conditions, active market sensitivity, and supply-side pressure are "
            "converging — operational energy cost exposure may be materially elevated during peak "
            "demand intervals. Operations with significant energy cost sensitivity should monitor "
            "conditions closely."
        )
        drivers = [
            d for d, v in [
                ("Weather-driven demand persistence", persist_risk in ("elevated", "high")),
                ("Market pricing sensitivity active", market_lvl in ("medium", "high")),
                ("Gas supply pressure contributing", supply_lvl in ("medium", "high")),
                ("Multiple signal drivers aligned",   align_score >= 2),
            ] if v
        ]
    elif score >= 5:
        level       = "Elevated Exposure"
        cls         = "elevated"
        short_desc  = "Operational exposure is above baseline — conditions warrant active monitoring."
        detail      = (
            "A combination of active risk drivers is contributing to above-baseline operational "
            "energy exposure. Conditions may increase further if current trajectory continues — "
            "particularly during afternoon and evening peak load intervals."
        )
        drivers = [
            d for d, v in [
                ("Weather demand above normal range", demand_lvl in ("medium", "high")),
                ("ERCOT market reaction active",      market_lvl == "medium"),
                ("Gas supply sensitivity present",    supply_lvl == "medium"),
                ("Escalation probability moderate",   esc_pct >= 25),
            ] if v
        ]
    elif score >= 2:
        level       = "Moderate Exposure"
        cls         = "moderate"
        short_desc  = "Baseline operational exposure with limited escalation signals."
        detail      = (
            "Operational energy exposure is within moderate range. At least one risk driver is "
            "active, but no material convergence of conditions is currently detected. Standard "
            "monitoring cadence is appropriate."
        )
        drivers = [
            d for d, v in [
                ("Minor weather demand variation",    demand_lvl == "medium"),
                ("Limited market price movement",     market_lvl == "medium"),
                ("Gas supply within adequate range",  supply_lvl == "low"),
            ] if v
        ]
    else:
        level       = "Minimal Exposure"
        cls         = "low"
        short_desc  = "Operational energy exposure nominal. No material escalation signals detected."
        detail      = (
            "Current conditions present minimal operational energy cost exposure risk. "
            "All monitored signal channels are within normal operating parameters. "
            "Standard monitoring is sufficient."
        )
        drivers = []

    return {
        "level":       level,
        "cls":         cls,
        "score":       score,
        "short_desc":  short_desc,
        "detail":      detail,
        "drivers":     drivers[:4],
    }


# ── Henry Hub signal detector ──────────────────────────────────────────────────

HENRY_HUB_NORMAL   = 3.00
HENRY_HUB_WATCH    = 4.00
HENRY_HUB_ELEVATED = 6.00

def check_henry_hub(henry_hub_data: Optional[Dict]) -> Dict[str, Any]:
    """
    Evaluate Henry Hub natural gas spot price as a standalone risk signal.
    Thresholds: < $3 Normal | $3-$4 Watch | $4-$6 Elevated | > $6 Critical
    """
    if not henry_hub_data or henry_hub_data.get("price") is None:
        return _signal(
            "henry_hub", "HENRY_HUB", False, "low", None,
            "Awaiting Henry Hub Data", None, HENRY_HUB_WATCH,
            "Short-term (0-6h): monitoring · Near-term (6-24h): monitoring · Outlook (24-48h): monitoring",
            "Henry Hub price data unavailable.",
            "Henry Hub signal will activate once EIA price data loads.",
        )

    price        = float(henry_hub_data.get("price", 0))
    daily_chg    = henry_hub_data.get("daily_change_pct", 0) or 0
    weekly_chg   = henry_hub_data.get("weekly_change_pct", 0) or 0
    market_state = henry_hub_data.get("market_state", "normal")
    report_date  = henry_hub_data.get("report_date", "")

    daily_str  = f"{'+' if daily_chg >= 0 else ''}{daily_chg:.1f}%"
    weekly_str = f"{'+' if weekly_chg >= 0 else ''}{weekly_chg:.1f}%"

    if price > HENRY_HUB_ELEVATED:
        return _signal(
            "henry_hub", "HENRY_HUB", True, "high", None,
            "Henry Hub Critical — Gas Cost Elevated",
            price, HENRY_HUB_ELEVATED,
            "Short-term (0-6h): critical gas price conditions · Near-term (6-24h): generation cost pressure elevated · Outlook (24-48h): fuel cost sensitivity high",
            (
                f"Henry Hub at ${price:.3f}/MMBtu ({daily_str} daily, {weekly_str} weekly). "
                f"Prices above ${HENRY_HUB_ELEVATED:.2f}/MMBtu reflect critical gas cost conditions, "
                "significantly increasing fuel cost for gas-fired generation across Texas."
            ),
            "Critical Henry Hub pricing may materially elevate gas-fired generation costs, "
            "increasing ERCOT pricing sensitivity and operational fuel cost exposure.",
        )

    if price >= HENRY_HUB_WATCH:
        return _signal(
            "henry_hub", "HENRY_HUB", True, "medium", None,
            "Henry Hub Elevated — Gas Cost Watch",
            price, HENRY_HUB_WATCH,
            "Short-term (0-6h): elevated gas cost conditions · Near-term (6-24h): monitor for further movement · Outlook (24-48h): fuel sensitivity above baseline",
            (
                f"Henry Hub at ${price:.3f}/MMBtu ({daily_str} daily, {weekly_str} weekly). "
                f"Prices in the ${HENRY_HUB_WATCH:.2f}–${HENRY_HUB_ELEVATED:.2f}/MMBtu range reflect elevated "
                "fuel cost conditions for gas-fired generation."
            ),
            "Elevated Henry Hub pricing may increase operational fuel cost sensitivity, "
            "particularly during high-demand intervals when gas-fired generation is at peak dispatch.",
        )

    if price >= HENRY_HUB_NORMAL:
        return _signal(
            "henry_hub", "HENRY_HUB", False, "low", None,
            "Henry Hub Watch Level",
            price, HENRY_HUB_NORMAL,
            "Short-term (0-6h): watch level · Near-term (6-24h): monitor for movement · Outlook (24-48h): stable if unchanged",
            (
                f"Henry Hub at ${price:.3f}/MMBtu ({daily_str} daily, {weekly_str} weekly). "
                f"Prices in the ${HENRY_HUB_NORMAL:.2f}–${HENRY_HUB_WATCH:.2f}/MMBtu range are at watch level — "
                "above normal baseline but not yet in elevated territory."
            ),
            "Henry Hub at watch level. Monitor for further price movement that could elevate gas-fired generation costs.",
        )

    return _signal(
        "henry_hub", "HENRY_HUB", False, "low", None,
        "Henry Hub Normal", price, HENRY_HUB_NORMAL,
        "Short-term (0-6h): normal · Near-term (6-24h): stable · Outlook (24-48h): no fuel cost pressure",
        (
            f"Henry Hub at ${price:.3f}/MMBtu ({daily_str} daily, {weekly_str} weekly). "
            f"Prices below ${HENRY_HUB_NORMAL:.2f}/MMBtu reflect normal gas cost conditions "
            "for gas-fired generation."
        ),
        "Henry Hub pricing within normal range. No fuel-side cost pressure on ERCOT generation detected.",
    )


def _compute_henry_hub_exposure(
    henry_hub_data:  Optional[Dict],
    henry_hub_sig:   Dict,
    demand_pressure: Dict,
    supply_pressure: Dict,
) -> Dict[str, Any]:
    """
    Henry Hub contribution to cost/operational exposure.
    Combines price level, trend, and demand context.
    """
    if not henry_hub_data:
        return {"level": "low", "price": None, "contribution": "unavailable",
                "description": "Henry Hub data unavailable."}

    price      = float(henry_hub_data.get("price", 0) or 0)
    daily_chg  = float(henry_hub_data.get("daily_change_pct", 0) or 0)
    weekly_chg = float(henry_hub_data.get("weekly_change_pct", 0) or 0)
    market_state = henry_hub_data.get("market_state", "normal")
    triggered  = henry_hub_sig.get("triggered", False)
    demand_lvl = demand_pressure.get("level", "low")
    supply_lvl = supply_pressure.get("level", "low")

    # High: critical price OR elevated + high demand OR rapidly rising
    if market_state == "critical" or (market_state == "elevated" and demand_lvl == "high") or (triggered and weekly_chg > 15):
        level = "high"
        desc  = (
            f"Henry Hub at ${price:.3f}/MMBtu with {'+' if weekly_chg >= 0 else ''}{weekly_chg:.1f}% weekly change. "
            "Gas cost conditions are materially elevated, increasing fuel cost exposure for operations "
            "with natural gas or electricity cost exposure."
        )
    elif market_state in ("elevated", "watch") or (triggered and demand_lvl in ("medium", "high")):
        level = "medium"
        desc  = (
            f"Henry Hub at ${price:.3f}/MMBtu ({'+' if daily_chg >= 0 else ''}{daily_chg:.1f}% daily). "
            "Gas cost conditions are above normal, contributing to moderate operational cost sensitivity."
        )
    else:
        level = "low"
        desc  = (
            f"Henry Hub at ${price:.3f}/MMBtu — within normal range. "
            "Gas fuel costs are not materially contributing to operational exposure at current levels."
        )

    return {
        "level":        level,
        "price":        price,
        "daily_chg":    daily_chg,
        "weekly_chg":   weekly_chg,
        "market_state": market_state,
        "contribution": level,
        "description":  desc,
    }


def run_all_signals(
    prices:          List[Dict],
    forecasts:       List[Dict],
    gas_records:     List[Dict],
    location:        str = "Houston",
    henry_hub_data:  Optional[Dict] = None,
) -> Dict[str, Any]:
    """
    Run all signal checks and return a unified response dict.
    This is the single entry point called by the /api/signals/ router.
    """
    try:
        # ── Data availability check ───────────────────────────────────────────
        data_valid, data_status = _validate_data(prices)
        data_sources = _assess_data_sources(prices, forecasts, gas_records)

        if not data_valid:
            resp = _failsafe_response()
            resp["data_status"]   = data_status
            resp["data_sources"]  = data_sources
            return resp

        # ── ERCOT data verification layer ─────────────────────────────────────
        ercot_verification = None
        if _VERIFICATION_ENABLED and prices:
            try:
                latest_p   = prices[-1]
                prev_p     = prices[-2] if len(prices) >= 2 else {}
                ercot_v    = verify_ercot_price(
                    current_price  = latest_p.get("price_mwh"),
                    prev_price     = prev_p.get("price_mwh"),
                    timestamp      = latest_p.get("timestamp"),
                    location       = latest_p.get("settlement_point", "HB_HOUSTON"),
                    market         = "ERCOT Real-Time Market",
                )
                ercot_verification = {
                    "is_valid":              ercot_v.is_valid,
                    "status":                ercot_v.status,
                    "confidence_adjustment": ercot_v.confidence_adjustment,
                    "reason":                ercot_v.reason,
                    "last_known_price":      ercot_v.last_known_price,
                    "last_known_ts":         ercot_v.last_known_ts,
                    "price_range":           ercot_v.price_range,
                }
                # Enrich data_sources ERCOT entry with verification detail
                data_sources["ercot"]["verification_status"] = ercot_v.status
                data_sources["ercot"]["verification_reason"] = ercot_v.reason
                data_sources["ercot"]["last_valid_price"]    = ercot_v.last_known_price
                data_sources["ercot"]["price_range"]         = ercot_v.price_range
            except Exception as _ve:
                logger.warning("[VERIFY] Verification error: %s", _ve)

        # ── Run the four individual signal checks ─────────────────────────────
        price_sig      = check_price_volatility(prices)
        weather_sig    = check_weather_demand(forecasts)
        gas_sig        = check_gas_supply(gas_records)
        henry_hub_sig  = check_henry_hub(henry_hub_data)

        all_sigs = [price_sig, weather_sig, gas_sig, henry_hub_sig]

        # ── Core risk score ───────────────────────────────────────────────────
        risk_score, active_count = compute_risk_score(all_sigs)

        # ── Driver prioritization ─────────────────────────────────────────────
        primary_driver, primary_driver_type = _determine_primary_driver(all_sigs)
        risk_direction, risk_direction_ctx  = _determine_risk_direction(prices, all_sigs)
        secondary_factors                   = _secondary_factors(all_sigs, primary_driver_type)

        # ── Phase 11 driver levels ────────────────────────────────────────────
        demand_pressure    = _compute_demand_pressure(weather_sig)
        supply_pressure    = _compute_supply_pressure(gas_sig, gas_records)
        market_reaction    = _compute_market_reaction(price_sig)
        gas_to_power       = _compute_gas_to_power_impact(gas_sig, weather_sig, gas_records)
        henry_hub_exposure = _compute_henry_hub_exposure(henry_hub_data, henry_hub_sig, demand_pressure, supply_pressure)
        events             = _detect_events(prices, forecasts, gas_records, data_sources)

        # ── Boost supply_pressure if Henry Hub is elevated ────────────────────
        if henry_hub_sig.get("triggered") and supply_pressure.get("level") == "low":
            hh_price = float((henry_hub_data or {}).get("price", 0) or 0)
            supply_pressure = dict(supply_pressure)
            supply_pressure["level"] = "medium"
            supply_pressure["explanation"] = (
                supply_pressure.get("explanation", "") +
                f" Henry Hub at ${hh_price:.3f}/MMBtu is contributing to elevated gas cost conditions."
            )

        # ── Raw metric values for narrative engine ────────────────────────────
        price_val   = float((price_sig   or {}).get("value") or 0)
        weather_val = float((weather_sig or {}).get("value") or 0)
        gas_pct_val = float((gas_sig     or {}).get("value") or 0)

        # ── Phase 11 Premium Intelligence ────────────────────────────────────
        risk_narrative   = _compute_risk_narrative(
            risk_score, demand_pressure, supply_pressure, market_reaction,
            gas_to_power, risk_direction, primary_driver_type,
            price_val, weather_val, gas_pct_val,
        )
        cost_impact      = _compute_cost_impact(risk_score, demand_pressure, supply_pressure, market_reaction)
        market_condition = _compute_market_condition(risk_score, risk_direction, demand_pressure, supply_pressure, market_reaction)
        alert_severity   = _compute_alert_severity(risk_score, active_count, demand_pressure, supply_pressure, market_reaction)

        # ── Narrative + confidence ────────────────────────────────────────────
        confidence, confidence_note = _compute_confidence(prices, all_sigs, data_sources)

        # Apply verification confidence penalty
        if ercot_verification and ercot_verification.get("confidence_adjustment", 0) < 0:
            adj = ercot_verification["confidence_adjustment"]
            confidence = max(50, (confidence or 70) + adj)
            verif_note = ercot_verification.get("reason", "")
            if verif_note:
                confidence_note = confidence_note + f" {verif_note}"

        time_horizons = _build_time_horizons(risk_score, all_sigs, risk_direction, primary_driver)
        summary, explanation, impact, market_ctx = _build_narrative(risk_score, all_sigs, primary_driver, risk_direction)

        # ── Signal driver badges ──────────────────────────────────────────────
        sig_map = {
            "price_volatility": price_sig,
            "weather_demand":   weather_sig,
            "gas_supply":       gas_sig,
            "henry_hub":        henry_hub_sig,
        }
        signal_drivers = []
        for sig_type, sig in sig_map.items():
            signal_drivers.append({
                "name":     sig.get("title", sig_type),
                "type":     sig_type,
                "active":   bool(sig.get("triggered", False)),
                "severity": sig.get("severity", "low"),
            })

        # ── Signal alignment + driver trends + what changed ──────────────────
        signal_alignment = _compute_signal_alignment(all_sigs)
        driver_trends    = _compute_driver_trends(prices, gas_records, demand_pressure, supply_pressure, market_reaction)

        # Enrich signal_drivers with trend direction
        for sd in signal_drivers:
            sd["trend"] = driver_trends.get(sd["type"], "stable")

        what_changed = _compute_what_changed(
            risk_score, demand_pressure, supply_pressure, market_reaction, prices, location
        )

        escalation_probability = _compute_escalation_probability(
            risk_score, risk_direction, signal_alignment, active_count,
            events, demand_pressure, supply_pressure, market_reaction,
        )

        market_sensitivity = _compute_market_sensitivity(
            risk_score, signal_alignment, active_count, risk_direction,
            demand_pressure, supply_pressure, market_reaction,
        )

        potential_escalation_drivers = _compute_potential_escalation_drivers(
            demand_pressure, supply_pressure, market_reaction,
            risk_direction, signal_alignment, events,
        )

        # ── Phase 10: Predictive Intelligence ────────────────────────────────
        weather_persistence   = _compute_weather_persistence(forecasts)
        early_warnings        = _compute_early_warnings(
            demand_pressure, supply_pressure, market_reaction,
            forecasts, gas_records, escalation_probability,
            risk_direction, signal_alignment,
        )
        risk_trend            = _compute_risk_trend(
            risk_score, risk_direction, signal_alignment,
            demand_pressure, supply_pressure, market_reaction,
            what_changed,
        )
        gas_power_correlation = _compute_gas_power_correlation(
            gas_records, demand_pressure, supply_pressure, market_reaction,
        )
        interval_intelligence = _compute_interval_intelligence(
            risk_score, risk_direction,
            demand_pressure, supply_pressure, market_reaction,
            escalation_probability, confidence,
            weather_persistence, time_horizons,
        )

        # ── Phase 12: Enterprise Operational Intelligence ────────────────────
        market_transition     = _compute_market_transition(
            risk_score, risk_direction, market_condition, risk_trend,
            demand_pressure, supply_pressure, market_reaction, signal_alignment,
        )
        scenarios             = _compute_scenarios(
            risk_score, demand_pressure, supply_pressure, market_reaction,
            weather_persistence, escalation_probability,
            risk_direction, signal_alignment,
        )
        operational_exposure  = _compute_operational_exposure(
            risk_score, demand_pressure, supply_pressure, market_reaction,
            weather_persistence, escalation_probability,
            signal_alignment, cost_impact,
        )

        # ── Risk headline ─────────────────────────────────────────────────────
        risk_headline = risk_narrative["headline"]

        return {
            "computed_at":            _utcnow().isoformat(),
            "risk_score":             risk_score,
            "risk_headline":          risk_headline,
            "active_signals":         active_count,
            "confidence":             confidence,
            "confidence_note":        confidence_note,
            "explanation":            explanation,
            "impact":                 impact,
            "primary_driver":         primary_driver,
            "primary_driver_type":    primary_driver_type,
            "risk_direction":         risk_direction,
            "risk_direction_context": risk_direction_ctx,
            "market_context":         market_ctx,
            "signal_drivers":         signal_drivers,
            "secondary_factors":      secondary_factors,
            "data_valid":             True,
            "data_status":            data_status,
            "time_horizons":          time_horizons,
            "data_sources":           data_sources,
            "demand_pressure":        demand_pressure,
            "supply_pressure":        supply_pressure,
            "market_reaction":        market_reaction,
            "gas_to_power_impact":    gas_to_power,
            "events":                 events,
            "ercot_verification":     ercot_verification,
            "risk_narrative":         risk_narrative,
            "cost_impact":            cost_impact,
            "market_condition":       market_condition,
            "alert_severity":         alert_severity,
            "signal_alignment":          signal_alignment,
            "what_changed":              what_changed,
            "escalation_probability":         escalation_probability,
            "market_sensitivity":             market_sensitivity,
            "potential_escalation_drivers":   potential_escalation_drivers,
            # Phase 12 — Enterprise Intelligence
            "market_transition":              market_transition,
            "scenarios":                      scenarios,
            "operational_exposure":           operational_exposure,
            # Phase 10 — Predictive Intelligence
            "weather_persistence":            weather_persistence,
            "early_warnings":                 early_warnings,
            "risk_trend":                     risk_trend,
            "gas_power_correlation":          gas_power_correlation,
            "interval_intelligence":          interval_intelligence,
            "henry_hub":              henry_hub_data,
            "henry_hub_signal":       henry_hub_sig,
            "henry_hub_exposure":     henry_hub_exposure,
            "signals": {
                "price_volatility": price_sig,
                "weather_demand":   weather_sig,
                "gas_supply":       gas_sig,
                "henry_hub":        henry_hub_sig,
            },
            "summary":    summary,
            "disclaimer": (
                "TX Energy Risk provides informational analytics and market intelligence only. "
                "This does not constitute investment, trading, financial, legal, or procurement advice. "
                "Users are responsible for their own decisions."
            ),
        }

    except Exception as exc:
        import traceback
        traceback.print_exc()
        return _failsafe_response()
