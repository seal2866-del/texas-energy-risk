"""
forecast_engine.py
Generates 24h / 72h / 7-day risk outlooks from ERCOT, NOAA, Henry Hub, and EIA storage.
Produces an AI narrative: "What is likely to happen next and why."
Cached 15 minutes — AI call only fires when cache is stale.
"""
import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

log = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ── Cache ─────────────────────────────────────────────────────────────────────
_FORECAST_CACHE: Dict[str, Any] = {}
_CACHE_TTL_SECONDS = 900  # 15 minutes

def _cache_key(location: str) -> str:
    return f"forecast:{location}"

def _get_cache(location: str) -> Optional[Dict]:
    entry = _FORECAST_CACHE.get(_cache_key(location))
    if not entry:
        return None
    age = (datetime.now(timezone.utc) - entry["ts"]).total_seconds()
    return entry["data"] if age < _CACHE_TTL_SECONDS else None

def _set_cache(location: str, data: Dict):
    _FORECAST_CACHE[_cache_key(location)] = {"ts": datetime.now(timezone.utc), "data": data}


# ── Risk level helpers ────────────────────────────────────────────────────────
RISK_LEVELS = ["low", "watch", "elevated", "high"]
RISK_LABELS = {
    "low":      "LOW",
    "watch":    "WATCH",
    "elevated": "ELEVATED",
    "high":     "HIGH",
}
RISK_COLORS = {
    "low":      "#22c55e",
    "watch":    "#f59e0b",
    "elevated": "#f97316",
    "high":     "#ef4444",
}

def _escalate(base: str, to: str) -> str:
    """Return the higher of two risk levels."""
    return to if RISK_LEVELS.index(to) > RISK_LEVELS.index(base) else base


# ── Horizon risk calculators ──────────────────────────────────────────────────

def _compute_24h(
    prices: List[Dict],
    forecasts: List[Dict],
    henry_hub: Optional[Dict],
    gas_records: List[Dict],
) -> Dict[str, Any]:
    """24-hour outlook based on current price momentum + tomorrow's weather."""
    risk      = "low"
    drivers   = []
    confidence = 75

    # Price momentum
    if prices and len(prices) >= 3:
        recent = [float(p.get("price_mwh", 0)) for p in prices[-6:]]
        current = recent[-1]
        trend   = recent[-1] - recent[0]

        if current >= 300:
            risk = _escalate(risk, "high")
            drivers.append(f"ERCOT at ${current:.0f}/MWh — extreme price event active")
        elif current >= 150:
            risk = _escalate(risk, "elevated")
            drivers.append(f"ERCOT at ${current:.0f}/MWh — above elevated threshold")
        elif current >= 75:
            risk = _escalate(risk, "watch")
            drivers.append(f"ERCOT at ${current:.0f}/MWh — in Watch range")

        if trend > 20:
            risk = _escalate(risk, "watch")
            drivers.append(f"Price rising +${trend:.0f}/MWh over last 6 intervals")
        elif trend > 50:
            risk = _escalate(risk, "elevated")

    # Tomorrow temperature
    if forecasts:
        tmw = forecasts[0]
        high = float(tmw.get("temp_high_f", 75))
        if high >= 105:
            risk = _escalate(risk, "elevated")
            drivers.append(f"Forecast high {high:.0f}°F — extreme heat demand")
            confidence = min(confidence + 10, 90)
        elif high >= 100:
            risk = _escalate(risk, "watch")
            drivers.append(f"Forecast high {high:.0f}°F — elevated cooling demand")
        elif high <= 28:
            risk = _escalate(risk, "elevated")
            drivers.append(f"Forecast low {high:.0f}°F — extreme cold demand spike risk")

    # Henry Hub
    if henry_hub and henry_hub.get("price"):
        hh = float(henry_hub["price"])
        if hh >= 6:
            risk = _escalate(risk, "elevated")
            drivers.append(f"Henry Hub ${hh:.2f}/MMBtu — critical gas cost")
        elif hh >= 4:
            risk = _escalate(risk, "watch")
            drivers.append(f"Henry Hub ${hh:.2f}/MMBtu — elevated gas cost")

    primary = drivers[0] if drivers else "Stable conditions across all inputs"
    return {
        "horizon":    "24h",
        "label":      "24 Hour",
        "risk":       risk,
        "risk_label": RISK_LABELS[risk],
        "color":      RISK_COLORS[risk],
        "primary_driver": primary,
        "drivers":    drivers,
        "confidence": confidence,
    }


def _compute_72h(
    prices: List[Dict],
    forecasts: List[Dict],
    henry_hub: Optional[Dict],
    gas_records: List[Dict],
) -> Dict[str, Any]:
    """72-hour outlook based on 3-day temp forecast + storage + gas trends."""
    risk       = "low"
    drivers    = []
    confidence = 65

    # 3-day temperature window
    temps_3d = [float(f.get("temp_high_f", 75)) for f in forecasts[:3]]
    hot_days  = sum(1 for t in temps_3d if t >= 100)
    cold_days = sum(1 for t in temps_3d if t <= 28)
    max_temp  = max(temps_3d) if temps_3d else 75

    if hot_days >= 2:
        risk = _escalate(risk, "elevated")
        drivers.append(f"{hot_days} days above 100°F forecast — sustained heat demand")
        confidence = min(confidence + 8, 85)
    elif hot_days == 1 or max_temp >= 95:
        risk = _escalate(risk, "watch")
        drivers.append(f"Heat event likely — peak forecast {max_temp:.0f}°F")

    if cold_days >= 1:
        risk = _escalate(risk, "elevated")
        drivers.append(f"Freeze risk in 72h window — heating demand surge")

    # Gas storage trajectory
    if gas_records and len(gas_records) >= 2:
        latest_pct = float(gas_records[-1].get("storage_pct_vs_avg", 0) or 0)
        prior_pct  = float(gas_records[-2].get("storage_pct_vs_avg", 0) or 0)
        draw_rate  = prior_pct - latest_pct  # positive = drawing down

        if latest_pct < -15:
            risk = _escalate(risk, "elevated")
            drivers.append(f"Gas storage {latest_pct:.1f}% vs avg — critically low buffer")
        elif latest_pct < -5:
            risk = _escalate(risk, "watch")
            drivers.append(f"Gas storage {latest_pct:.1f}% vs avg — below normal")

        if draw_rate > 5 and latest_pct < 0:
            risk = _escalate(risk, "watch")
            drivers.append(f"Storage drawing at {draw_rate:.1f}%/week — tightening supply")

    # Henry Hub weekly trend
    if henry_hub:
        hh_price  = float(henry_hub.get("price", 0) or 0)
        hh_weekly = float(henry_hub.get("weekly_change_pct", 0) or 0)
        if hh_price >= 5 or hh_weekly > 15:
            risk = _escalate(risk, "watch")
            drivers.append(f"Henry Hub ${hh_price:.2f}/MMBtu (+{hh_weekly:.1f}% weekly) — rising gas cost")

    primary = drivers[0] if drivers else "No significant risk drivers in 72-hour window"
    return {
        "horizon":    "72h",
        "label":      "72 Hour",
        "risk":       risk,
        "risk_label": RISK_LABELS[risk],
        "color":      RISK_COLORS[risk],
        "primary_driver": primary,
        "drivers":    drivers,
        "confidence": confidence,
    }


def _compute_7d(
    prices: List[Dict],
    forecasts: List[Dict],
    henry_hub: Optional[Dict],
    gas_records: List[Dict],
) -> Dict[str, Any]:
    """7-day outlook based on full NOAA forecast + EIA storage + seasonal factors."""
    risk       = "low"
    drivers    = []
    confidence = 50  # inherently lower at 7-day

    # Full 7-day temperature window
    temps_7d  = [float(f.get("temp_high_f", 75)) for f in forecasts[:7]]
    hot_days  = sum(1 for t in temps_7d if t >= 100)
    warm_days = sum(1 for t in temps_7d if t >= 95)
    cold_days = sum(1 for t in temps_7d if t <= 28)
    peak_temp = max(temps_7d) if temps_7d else 75

    if hot_days >= 4:
        risk = _escalate(risk, "high")
        drivers.append(f"Prolonged heat wave — {hot_days} of 7 days above 100°F")
        confidence = min(confidence + 10, 75)
    elif hot_days >= 2:
        risk = _escalate(risk, "elevated")
        drivers.append(f"{hot_days} extreme heat days in 7-day window — sustained demand risk")
    elif warm_days >= 3 or peak_temp >= 98:
        risk = _escalate(risk, "watch")
        drivers.append(f"Elevated temperatures through week — peak {peak_temp:.0f}°F")

    if cold_days >= 2:
        risk = _escalate(risk, "elevated")
        drivers.append(f"Multiple freeze events in 7-day outlook — grid stress risk")
    elif cold_days == 1:
        risk = _escalate(risk, "watch")
        drivers.append("Cold snap in 7-day window — heating demand spike")

    # Storage — multi-week trajectory
    if gas_records and len(gas_records) >= 2:
        latest_pct = float(gas_records[-1].get("storage_pct_vs_avg", 0) or 0)
        if latest_pct < -20:
            risk = _escalate(risk, "elevated")
            drivers.append(f"Gas storage critically low ({latest_pct:.1f}% vs avg) — week-long supply risk")
        elif latest_pct < -10:
            risk = _escalate(risk, "watch")
            drivers.append(f"Gas storage below average ({latest_pct:.1f}%) — supply sensitivity elevated")

    # Henry Hub multi-week signal
    if henry_hub:
        hh = float(henry_hub.get("price", 0) or 0)
        hw = float(henry_hub.get("weekly_change_pct", 0) or 0)
        if hh >= 6 and hw > 10:
            risk = _escalate(risk, "elevated")
            drivers.append(f"Henry Hub ${hh:.2f}/MMBtu rising — sustained gas-to-power cost pressure")
        elif hh >= 4:
            risk = _escalate(risk, "watch")
            drivers.append(f"Henry Hub ${hh:.2f}/MMBtu — gas cost above normal range")

    primary = drivers[0] if drivers else "7-day outlook stable — no significant risk signals identified"
    return {
        "horizon":    "7d",
        "label":      "7 Day",
        "risk":       risk,
        "risk_label": RISK_LABELS[risk],
        "color":      RISK_COLORS[risk],
        "primary_driver": primary,
        "drivers":    drivers,
        "confidence": confidence,
    }


# ── AI Narrative ──────────────────────────────────────────────────────────────

async def _generate_narrative(
    h24: Dict, h72: Dict, h7: Dict,
    prices: List[Dict],
    forecasts: List[Dict],
    henry_hub: Optional[Dict],
    gas_records: List[Dict],
    location: str,
) -> str:
    """Generate 3-sentence AI narrative: what's likely to happen next and why."""
    if not ANTHROPIC_API_KEY:
        return _fallback_narrative(h24, h72, h7)

    try:
        import anthropic as _anthropic
        client = _anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

        current_price = float(prices[-1].get("price_mwh", 0)) if prices else 0
        tmw_temp      = float(forecasts[0].get("temp_high_f", 75)) if forecasts else 75
        hh_price      = float(henry_hub.get("price", 0)) if henry_hub else 0
        storage_pct   = float(gas_records[-1].get("storage_pct_vs_avg", 0)) if gas_records else 0

        prompt = f"""You are a Texas energy risk analyst. Write exactly 3 sentences about what is likely to happen next with energy market risk in {location}, Texas.

Current conditions:
- ERCOT price: ${current_price:.2f}/MWh ({h24['risk_label']} tier)
- Tomorrow's high: {tmw_temp:.0f}°F
- Henry Hub: ${hh_price:.2f}/MMBtu
- Gas storage: {storage_pct:.1f}% vs 5-year avg

Risk outlook:
- 24h: {h24['risk_label']} — {h24['primary_driver']}
- 72h: {h72['risk_label']} — {h72['primary_driver']}
- 7-day: {h7['risk_label']} — {h7['primary_driver']}

Rules:
- 3 sentences maximum
- Focus on operational implications for energy buyers and industrial operators
- Be specific about timing and thresholds
- Do NOT use the word "stakeholders" or "navigate"
- Do NOT give financial advice
- Plain text only, no bullet points or markdown"""

        resp = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()

    except Exception as e:
        log.warning("[FORECAST] AI narrative failed: %s", e)
        return _fallback_narrative(h24, h72, h7)


def _fallback_narrative(h24: Dict, h72: Dict, h7: Dict) -> str:
    r24, r72, r7 = h24["risk"], h72["risk"], h7["risk"]
    peak = max([r24, r72, r7], key=lambda r: RISK_LEVELS.index(r))

    if peak == "high":
        return (
            f"Conditions are trending toward HIGH risk over the coming week, driven by {h7['primary_driver'].lower()}. "
            f"The 72-hour window shows {r72.upper()} risk — operational teams should review procurement positions and contingency plans. "
            "Sustained adverse conditions may significantly impact energy costs for industrial and commercial operations."
        )
    elif peak == "elevated":
        return (
            f"The near-term outlook indicates ELEVATED risk driven by {h24['primary_driver'].lower()}. "
            f"Risk remains {r72.upper()} through 72 hours — monitor ERCOT prices and temperature forecasts closely. "
            "Consider hedging or adjusting operational schedules if conditions persist above $150/MWh."
        )
    elif peak == "watch":
        return (
            f"Conditions are in the WATCH range, with {h24['primary_driver'].lower()}. "
            f"The 7-day outlook remains {r7.upper()} — no immediate operational action required but continued monitoring is advised. "
            "Risk could escalate if temperature forecasts increase or gas supply tightens further."
        )
    else:
        return (
            "Current and near-term conditions are stable across all risk indicators. "
            "ERCOT prices, temperature forecasts, and gas supply metrics are all within normal operating ranges. "
            "No elevated risk is expected in the 7-day outlook — standard monitoring posture is appropriate."
        )


# ── Main entry point ──────────────────────────────────────────────────────────

async def compute_forecast_outlook(
    prices:      List[Dict],
    forecasts:   List[Dict],
    gas_records: List[Dict],
    henry_hub:   Optional[Dict],
    location:    str = "Houston",
) -> Dict[str, Any]:
    """
    Compute 24h / 72h / 7-day risk outlook with AI narrative.
    Cached 15 minutes. AI narrative generated via claude-haiku.
    """
    cached = _get_cache(location)
    if cached:
        return cached

    h24 = _compute_24h(prices, forecasts, henry_hub, gas_records)
    h72 = _compute_72h(prices, forecasts, henry_hub, gas_records)
    h7  = _compute_7d(prices, forecasts, henry_hub, gas_records)

    narrative = await _generate_narrative(
        h24, h72, h7, prices, forecasts, henry_hub, gas_records, location
    )

    overall_risk = max([h24["risk"], h72["risk"], h7["risk"]],
                       key=lambda r: RISK_LEVELS.index(r))

    result = {
        "computed_at":    datetime.now(timezone.utc).isoformat(),
        "location":       location,
        "overall_risk":   overall_risk,
        "overall_label":  RISK_LABELS[overall_risk],
        "overall_color":  RISK_COLORS[overall_risk],
        "horizons": [h24, h72, h7],
        "narrative":      narrative,
        "disclaimer":     (
            "Forecast outlooks are probabilistic estimates based on available data. "
            "Not financial, trading, or procurement advice."
        ),
    }

    _set_cache(location, result)
    return result
