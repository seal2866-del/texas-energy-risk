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
from services.data_verification import verify_ercot_price, get_last_known_good, ErcotVerification

logger = logging.getLogger(__name__)


# -- Thresholds ----------------------------------------------------------------
PRICE_SPIKE_THRESHOLD_PCT = 50.0
PRICE_ABS_HIGH_MWH        = 150.0
PRICE_LOW_FLOOR           = 10.0
TEMP_HIGH_THRESHOLD_F     = 100.0
TEMP_LOW_THRESHOLD_F      = 28.0
GAS_STORAGE_PCT_THRESHOLD = -10.0

# -- Data validation constants -------------------------------------------------
DATA_FRESHNESS_MINUTES = 15
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
        note = (
            f"Confidence is {conf_word} ({confidence}%). {driver_phrase}. "
            "Slightly reduced because one or more data sources have not refreshed within the expected interval."
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
            context = "balanced supply and demand conditions"
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
        if current >= 500:
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

    if current >= PRICE_ABS_HIGH_MWH * 0.7:
        pct_note = f" {pct_display} vs previous interval." if pct_change is not None else ""
        return _signal(
            "price_volatility", "VOLATILITY", False, "low", None,
            "Price Approaching Threshold", current, PRICE_ABS_HIGH_MWH,
            "Short-term (0-6h): within range, approaching threshold · Near-term (6-24h): monitor closely · Outlook (24-48h): watch for escalation",
            f"ERCOT Houston Hub at ${current:.0f}/MWh, approaching the elevated-risk threshold.{pct_note}"
            " Conditions suggest rising but not yet confirmed volatility.",
            "Continued price movement may push conditions into an elevated risk zone within the next 6-24 hours.",
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
        "No weather-driven demand signals active. Demand conditions are expected to remain stable.",
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
        short = f"Short-term (0-6h): High risk -- {primary_driver} is the primary driver. Close monitoring is recommended."
    elif risk_score == "medium":
        short = f"Short-term (0-6h): Medium risk -- {primary_driver} is elevating conditions. Continued monitoring is recommended."
    else:
        short = "Short-term (0-6h): Low risk -- all monitored drivers within normal operating range."

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

    # Summary
    summary = (
        f"Short-term Texas energy risk is {risk_label}. "
        f"The primary driver is {primary_driver}. "
        f"{context} "
        f"Short-term (24-48 hours) outlook: risk {direction_phrase}. "
        f"Monitoring is recommended."
    ).strip()

    # Explanation (for risk score card)
    triggered_labels = {
        "price_volatility": "ERCOT price volatility",
        "weather_demand":   "weather-driven demand pressure",
        "gas_supply":       "natural gas supply tightness",
    }
    stable_labels = {
        "price_volatility": "ERCOT prices are stable",
        "weather_demand":   "weather demand is normal",
        "gas_supply":       "natural gas supply is adequate",
    }
    triggered_types = {s["signal_type"] for s in signals if s.get("triggered")}
    stable_types    = {"price_volatility", "weather_demand", "gas_supply"} - triggered_types

    if risk_score == "high":
        driver_str  = " and ".join(triggered_labels[t] for t in triggered_types if t in triggered_labels)
        stable_str  = ", ".join(stable_labels[t] for t in stable_types if t in stable_labels)
        explanation = f"High risk driven by simultaneous {driver_str}."
        if stable_str:
            explanation += f" {stable_str.capitalize()}."
    elif risk_score == "medium" and triggered_types:
        t           = next(iter(triggered_types))
        stable_str  = " and ".join(stable_labels[s] for s in stable_types if s in stable_labels)
        explanation = f"Medium risk driven by {triggered_labels.get(t, t)}."
        if stable_str:
            explanation += f" {stable_str.capitalize()}."
    else:
        explanation = "All monitored risk drivers -- price, weather, and gas supply -- are within normal ranges."

    # Impact
    triggered_signals = [s for s in signals if s.get("triggered")]
    if not triggered_signals:
        impact = (
            "All monitored risk drivers are within normal operating ranges. "
            "No near-term risk elevation detected. Conditions are expected to remain stable "
            "over the short-term (0-6h) and near-term (6-24h) outlook."
        )
    elif risk_score == "high" and len(triggered_signals) >= 2:
        impact = (
            "Multiple converging risk signals are active, increasing the likelihood of "
            "short-term grid stress and price volatility over the next 24-48 hours. "
            "Conditions warrant close monitoring."
        )
    else:
        impact_map = {
            "weather_demand": {
                "high":   "Extreme temperatures may significantly increase grid load and tighten reserve margins, increasing the likelihood of short-term price volatility over the next 24-48 hours.",
                "medium": "Elevated temperatures may increase grid load and pressure peak-hour pricing, increasing the likelihood of reserve margin tightening over the next 24 hours.",
            },
            "price_volatility": {
                "high":   "Sustained ERCOT price spikes may signal constrained grid conditions, increasing the likelihood of continued volatility and potential supply stress over the next 24 hours.",
                "medium": "Elevated ERCOT prices may reflect a tightening supply-demand balance, increasing the likelihood of further price movement over the next 24-48 hours.",
            },
            "gas_supply": {
                "high":   "A critical gas storage deficit may constrain fuel supply for gas-fired generation, increasing the likelihood of supply-side stress during demand peaks over the next 48-72 hours.",
                "medium": "Below-average gas storage may reduce the supply buffer, increasing the likelihood of price sensitivity during any demand surge over the next 48-72 hours.",
            },
        }
        target   = triggered_signals[0]
        sig_type = target.get("signal_type", "")
        severity = target.get("severity", "medium")
        impact   = impact_map.get(sig_type, {}).get(severity, "Active risk signals detected. Monitor conditions closely over the next 24-48 hours.")

    # market_context is the short authoritative contrast sentence for all panels
    market_context = context if context else (
        f"Short-term Texas energy risk is {risk_score.capitalize()}. "
        f"The primary driver is {primary_driver}."
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
            "Demand pressure is low. Weather conditions are within normal seasonal range "
            "with no significant demand signals active."
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
            f"Supply pressure is low. Natural gas storage is {pct_str} the 5-year average, "
            "suggesting adequate fuel supply buffer."
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
    elif val >= PRICE_ABS_HIGH_MWH * 0.7 and val > 0:
        level = "low"
        expl  = (
            f"Market reaction remains low but approaching elevated thresholds. "
            f"ERCOT pricing at ${val:.0f}/MWh is within range but warrants monitoring."
        )
    else:
        price_str = f"${val:.0f}/MWh" if val > 0 else "within normal range"
        level     = "low"
        expl      = (
            f"Market reaction remains low. ERCOT Houston Hub pricing at {price_str} "
            "is stable and within normal operating range."
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
            "Gas-to-power impact is low. Natural gas storage and pricing conditions "
            "suggest adequate fuel supply for current power generation demand." + henry_note
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
                "severity": "high" if current >= 500 else "medium",
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

    # Temporal framing (Phase 11 item 4)
    headline       = f"Texas energy risk is {risk_label} for the next 0–6 hours"
    temporal_ctx   = "0–6 hours"
    next_period    = "Conditions may change within the next 6–24 hours based on forecast demand trends."

    demand_level = demand_pressure.get("level", "low")
    supply_level = supply_pressure.get("level", "low")
    market_level = market_reaction.get("level", "low")

    # ── Sentence 1: weather → demand chain ────────────────────────────────────
    if demand_level == "high":
        if weather_val >= TEMP_HIGH_THRESHOLD_F:
            s1 = (
                f"Extreme temperatures of {weather_val:.0f}°F are driving significant "
                "cooling demand across the Texas grid, placing substantial load on power "
                "generation resources."
            )
        else:
            s1 = (
                f"Severe cold of {weather_val:.0f}°F is driving significant heating "
                "demand across Texas, placing substantial load on the grid."
            )
    elif demand_level == "medium":
        if weather_val >= TEMP_HIGH_THRESHOLD_F:
            s1 = (
                f"Elevated temperatures of {weather_val:.0f}°F are increasing cooling "
                "demand pressure on the Texas grid, with peak load expected during "
                "afternoon hours."
            )
        elif weather_val > 0:
            s1 = (
                f"Cold temperatures of {weather_val:.0f}°F are increasing heating "
                "demand, with elevated overnight grid load expected."
            )
        else:
            s1 = "Weather-driven demand pressure is moderate, with conditions above normal levels."
    else:
        s1 = (
            "Weather conditions are within normal seasonal ranges, with no elevated "
            "demand pressure on the Texas grid at this time."
        )

    # ── Sentence 2: gas → generation cost chain ───────────────────────────────
    gas_abs = abs(gas_pct)
    if supply_level == "high":
        s2 = (
            f"Natural gas — which fuels a significant portion of Texas power generation — "
            f"is critically below seasonal averages ({gas_abs:.0f}% below the 5-year average), "
            "substantially reducing the fuel buffer available to meet any demand surge."
        )
    elif supply_level == "medium":
        s2 = (
            f"Natural gas supply remains {gas_abs:.0f}% below seasonal averages, "
            "which may increase cost sensitivity and reduce the available fuel buffer "
            "during periods of elevated generation demand."
        )
    else:
        s2 = (
            "Natural gas supply conditions appear adequate, with storage near seasonal "
            "norms and no fuel availability concerns that would compound demand pressure."
        )

    # ── Sentence 3: ERCOT → real-time balance reflection ─────────────────────
    price_str = f"${price_val:.0f}/MWh" if price_val > 0 else "current levels"
    if market_level == "high":
        s3 = (
            f"ERCOT Houston Hub pricing at {price_str} already reflects these converging "
            "pressures — the real-time market is pricing in elevated risk conditions."
        )
    elif market_level == "medium":
        s3 = (

            f"ERCOT pricing at {price_str} is showing sensitivity to current conditions, "
            "with moderate market stress reflected in near-term pricing."
        )
    else:
        s3 = (
            f"ERCOT pricing at {price_str} remains within normal bounds, "
            "suggesting the market has not yet priced in significant stress."
        )

    # ── Direction modifier ────────────────────────────────────────────────────
    if risk_direction == "increasing":
        next_period = (
            "Risk conditions are trending higher — conditions within the next 6–24 hours "
            "may exceed current levels if demand and supply pressures persist."
        )
    elif risk_direction == "decreasing":
        next_period = (
            "Risk conditions are trending lower — the 6–24 hour outlook suggests "
            "easing pressure barring new weather or supply disruptions."
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
    Classify overall market condition.
    Returns {label, description} where label is one of:
    Stable | Tightening | Volatile | Elevated Risk
    """
    demand_level = demand_pressure.get("level", "low")
    supply_level = supply_pressure.get("level", "low")
    market_level = market_reaction.get("level", "low")

    if risk_score == "high":
        return {
            "label":       "Elevated Risk",
            "description": (
                "Multiple risk drivers are simultaneously elevated. "
                "Market conditions reflect converging demand, supply, and pricing pressures."
            ),
        }
    elif market_level in ("medium", "high"):
        return {
            "label":       "Volatile",
            "description": (
                "ERCOT pricing is showing volatility signals. "
                "Market reaction to current conditions is elevated above normal."
            ),
        }
    elif demand_level in ("medium", "high") or supply_level in ("medium", "high"):
        direction_note = " and trending higher" if risk_direction == "increasing" else ""
        return {
            "label":       "Tightening",
            "description": (
                f"Supply or demand conditions are tightening{direction_note}. "
                "Market balance is under moderate stress."
            ),
        }
    else:
        return {
            "label":       "Stable",
            "description": (
                "All monitored market drivers are within normal ranges. "
                "No significant supply, demand, or pricing stress detected."
            ),
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
# Main orchestration entry point
# ------------------------------------------------------------------------------

def run_all_signals(
    prices:      List[Dict],
    forecasts:   List[Dict],
    gas_records: List[Dict],
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

        # ── Run the three individual signal checks ────────────────────────────
        price_sig   = check_price_volatility(prices)
        weather_sig = check_weather_demand(forecasts)
        gas_sig     = check_gas_supply(gas_records)

        all_sigs = [price_sig, weather_sig, gas_sig]

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
        events             = _detect_events(prices, forecasts, gas_records, data_sources)

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

        # ── ERCOT data verification ───────────────────────────────────────────
        latest_price = prices[-1] if prices else {}
        prev_price   = prices[-2] if len(prices) >= 2 else {}
        ercot_verif  = verify_ercot_price(
            current_price  = latest_price.get("price_mwh"),
            previous_price = prev_price.get("price_mwh"),
            timestamp      = latest_price.get("timestamp"),
            location       = latest_price.get("settlement_point", "HB_HOUSTON"),
            market         = "ERCOT Real-Time Market",
        )
        # Enrich ERCOT data-source entry with verification detail
        data_sources["ercot"]["verification_status"] = ercot_verif.status
        data_sources["ercot"]["verification_reason"] = ercot_verif.reason
        data_sources["ercot"]["last_valid_price"]    = ercot_verif.last_known_price
        data_sources["ercot"]["price_range"]         = ercot_verif.price_range

        # ── Narrative + confidence ────────────────────────────────────────────
        confidence, confidence_note = _compute_confidence(prices, all_sigs, data_sources)
        # Apply verification penalty on top of data-source confidence
        if ercot_verif.confidence_adjustment < 0:
            penalty_pct = abs(ercot_verif.confidence_adjustment)
            confidence  = max(50, confidence - penalty_pct)
            if ercot_verif.status in ("stale", "unavailable"):
                confidence_note += f" Confidence adjusted due to ERCOT data {ercot_verif.status}."
            elif ercot_verif.status == "pending_confirmation":
                confidence_note += " Confidence reduced while large price movement is being verified."
            elif ercot_verif.status == "delayed":
                confidence_note += " Confidence adjusted due to ERCOT data delay."
        time_horizons = _build_time_horizons(risk_score, all_sigs, risk_direction, primary_driver)
        summary, explanation, impact, market_ctx = _build_narrative(risk_score, all_sigs, primary_driver, risk_direction)

        # ── Signal driver badges ──────────────────────────────────────────────
        sig_map = {
            "price_volatility": price_sig,
            "weather_demand":   weather_sig,
            "gas_supply":       gas_sig,
        }
        signal_drivers = []
        for sig_type, sig in sig_map.items():
            signal_drivers.append({
                "name":     sig.get("title", sig_type),
                "type":     sig_type,
                "active":   bool(sig.get("triggered", False)),
                "severity": sig.get("severity", "low"),
            })

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
            "ercot_verification": {
                "is_valid":              ercot_verif.is_valid,
                "status":                ercot_verif.status,
                "confidence_adjustment": ercot_verif.confidence_adjustment,
                "reason":                ercot_verif.reason,
                "last_known_price":      ercot_verif.last_known_price,
                "last_known_ts":         ercot_verif.last_known_ts,
                "price_range":           ercot_verif.price_range,
            },
            "demand_pressure":        demand_pressure,
            "supply_pressure":        supply_pressure,
            "market_reaction":        market_reaction,
            "gas_to_power_impact":    gas_to_power,
            "events":                 events,
            "risk_narrative":         risk_narrative,
            "cost_impact":            cost_impact,
            "market_condition":       market_condition,
            "alert_severity":         alert_severity,
            "signals": {
                "price_volatility": price_sig,
                "weather_demand":   weather_sig,
                "gas_supply":       gas_sig,
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
