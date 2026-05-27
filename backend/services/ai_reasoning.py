"""
ai_reasoning.py
AI Reasoning Layer for TX Energy Risk platform.
Calls Claude API to generate professional energy market interpretation.
10-minute in-memory cache per location to minimize API cost.

LEGAL: All AI output is informational analytics only.
No investment, trading, financial, legal, or procurement advice.
"""
import os
import json
import hashlib
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY  = os.getenv("ANTHROPIC_API_KEY", "")
AI_MODEL           = os.getenv("AI_REASONING_MODEL", "claude-haiku-4-5-20251001")
CACHE_TTL_MINUTES  = int(os.getenv("AI_CACHE_MINUTES", "10"))

DISCLAIMER = (
    "AI-assisted interpretation is for informational analytics only and does not "
    "constitute investment, trading, financial, legal, or procurement advice."
)

# In-memory cache: key -> {"data": dict, "expires_at": datetime}
_cache: Dict[str, Dict[str, Any]] = {}


def _cache_key(location: str, risk_score: str, primary_driver: str, data_valid: bool) -> str:
    raw = f"{location}|{risk_score}|{primary_driver}|{data_valid}"
    return hashlib.md5(raw.encode()).hexdigest()


def _get_cached(key: str) -> Optional[Dict[str, Any]]:
    entry = _cache.get(key)
    if not entry:
        return None
    if datetime.now(timezone.utc) > entry["expires_at"]:
        del _cache[key]
        return None
    return entry["data"]


def _set_cache(key: str, data: Dict[str, Any]) -> None:
    _cache[key] = {
        "data": data,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=CACHE_TTL_MINUTES),
    }


def _rule_based_fallback(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Rule-based fallback when AI API is unavailable.
    Produces professional analytical copy synthesized from signal data.
    """
    risk             = inputs.get("overall_risk_level", "low")
    market_state     = inputs.get("market_state", "Stable")
    primary_driver   = inputs.get("primary_driver", "market conditions")
    risk_direction   = inputs.get("risk_direction", "stable")
    confidence       = inputs.get("confidence_score") or 70
    data_valid       = inputs.get("data_valid", True)
    weather_pressure = inputs.get("weather_demand_pressure", "low")
    gas_pressure     = inputs.get("gas_supply_pressure", "low")
    ercot_volatility = inputs.get("ercot_volatility_level", "low")
    ercot_price      = inputs.get("ercot_price", 0)
    data_health      = inputs.get("data_source_health", "active")

    # -- Executive summary
    if risk == "high":
        exec_summary = (
            f"Texas energy market conditions are elevated. {primary_driver} is the primary risk "
            f"factor, with a {risk_direction} risk direction. Conditions warrant active monitoring."
        )
    elif risk == "medium":
        exec_summary = (
            f"Texas energy conditions are moderately elevated. {primary_driver} is building "
            f"near-term pressure with a {risk_direction} outlook."
        )
    else:
        exec_summary = (
            "Texas energy conditions remain stable. No significant risk escalation signals "
            "are currently active across ERCOT pricing, weather demand, or gas supply."
        )

    # -- Current market interpretation
    if risk == "high":
        interpretation = (
            f"Current ERCOT market conditions reflect elevated stress. Real-time pricing of "
            f"${ercot_price:.0f}/MWh, combined with {primary_driver.lower()}, suggests the "
            f"Texas grid is operating under {market_state.lower()} conditions. "
            f"Near-term pricing sensitivity is heightened."
        )
    elif risk == "medium":
        interpretation = (
            f"Market conditions are tightening modestly. ERCOT pricing at ${ercot_price:.0f}/MWh "
            f"reflects {market_state.lower()} conditions, with {primary_driver.lower()} as the "
            f"leading pressure factor. Conditions may shift if demand or supply dynamics change."
        )
    else:
        interpretation = (
            f"ERCOT pricing at ${ercot_price:.0f}/MWh is within normal operating range. "
            f"Weather-driven demand is manageable, and natural gas conditions are not creating "
            f"significant generation cost pressure. Market state indicates {market_state.lower()} conditions."
        )

    # -- Driver analysis (synthesized)
    if weather_pressure == "high" and gas_pressure in ("medium", "high"):
        driver_analysis = (
            "Elevated weather demand is compounding existing gas supply pressure, increasing "
            "generation cost sensitivity. The alignment of thermal load and fuel cost pressure "
            "suggests heightened near-term pricing uncertainty across Texas power markets."
        )
    elif weather_pressure in ("medium", "high") and ercot_volatility in ("medium", "high"):
        driver_analysis = (
            "Weather-driven demand pressure and ERCOT price volatility are moving in the same "
            "direction, suggesting the grid is beginning to reflect demand stress in real-time "
            "pricing. Gas supply conditions are a secondary monitoring factor."
        )
    elif weather_pressure in ("medium", "high"):
        driver_analysis = (
            f"Weather-driven demand is the primary pressure factor. Elevated temperatures are "
            f"increasing load on the Texas grid. ERCOT pricing has "
            f"{'begun to reflect this stress' if ercot_volatility != 'low' else 'remained relatively stable'}, "
            f"while gas supply conditions are currently {'tightening' if gas_pressure != 'low' else 'adequate'}."
        )
    elif gas_pressure in ("medium", "high"):
        driver_analysis = (
            "Natural gas supply conditions are the primary pressure factor. Tighter storage "
            "or elevated Henry Hub pricing may increase generation cost sensitivity, particularly "
            "if demand rises during peak periods. ERCOT pricing may begin to reflect this "
            "cost pressure if weather demand increases."
        )
    elif ercot_volatility in ("medium", "high"):
        driver_analysis = (
            "ERCOT pricing volatility is elevated relative to current weather and gas conditions. "
            "This divergence suggests the market movement may be driven by localized grid "
            "conditions or short-term imbalances rather than broad weather or fuel demand."
        )
    else:
        driver_analysis = (
            "No dominant risk driver is currently active. Weather demand, gas supply, and ERCOT "
            "pricing are all within normal operating ranges. Market conditions reflect "
            "standard seasonal operating patterns with adequate supply and manageable demand."
        )

    # -- Escalation watch
    if risk == "high":
        escalation = (
            f"Conditions may escalate further if {primary_driver.lower()} intensifies or "
            f"additional demand pressure emerges. Monitor ERCOT real-time pricing and "
            f"weather forecast updates closely over the next 24-48 hours."
        )
    elif risk == "medium":
        escalation = (
            f"If weather demand or gas supply conditions worsen, near-term escalation risk "
            f"may increase. Current signals suggest monitoring is warranted, with particular "
            f"attention to {primary_driver.lower()} trends."
        )
    else:
        escalation = (
            "No active escalation signals detected. Routine monitoring of upcoming weather "
            "forecasts, ERCOT pricing trends, and EIA gas storage reports is sufficient "
            "under current stable conditions."
        )

    # -- Confidence note
    if not data_valid or data_health in ("stale", "unavailable", "degraded"):
        conf_note = (
            "Signal confidence is reduced due to delayed or unavailable data sources. "
            "Current interpretation is based on available data; conclusions should be "
            "reviewed with reduced confidence until source freshness improves."
        )
    elif confidence >= 80:
        conf_note = (
            f"Signal confidence is high at {confidence}%. Assessment is based on verified "
            f"real-time ERCOT, weather, and gas data."
        )
    elif confidence >= 60:
        conf_note = (
            f"Signal confidence is moderate at {confidence}%. Assessment reflects currently "
            f"available market data with standard analytical uncertainty."
        )
    else:
        conf_note = (
            f"Signal confidence is currently {confidence}%. Conditions are monitored but "
            f"assessment certainty is limited by data availability or mixed signals."
        )

    # -- Monitoring focus
    monitoring_items = []
    if weather_pressure in ("medium", "high"):
        monitoring_items.append("ERCOT real-time pricing and weather forecast updates")
    if gas_pressure in ("medium", "high"):
        monitoring_items.append("Henry Hub price movements and EIA storage report")
    if ercot_volatility in ("medium", "high"):
        monitoring_items.append("ERCOT settlement prices and grid congestion indicators")
    if not monitoring_items:
        monitoring_items = ["routine ERCOT price trends and weekly EIA gas storage reports"]
    monitoring = (
        f"Monitor {', '.join(monitoring_items)}. "
        f"Risk direction is {risk_direction}."
    )

    return {
        "executive_summary":             exec_summary,
        "current_market_interpretation": interpretation,
        "key_driver_analysis":           driver_analysis,
        "escalation_watch":              escalation,
        "confidence_note":               conf_note,
        "recommended_monitoring_focus":  monitoring,
        "generated_at":                  datetime.now(timezone.utc).isoformat(),
        "model":                         "rule-based-fallback",
        "disclaimer":                    DISCLAIMER,
        "ai_powered":                    False,
    }


def _build_prompt(inputs: Dict[str, Any]) -> str:
    events_str    = ", ".join(
        f"{e.get('type','')}: {e.get('message','')}"
        for e in (inputs.get("active_events") or [])
    ) or "none"
    secondary_str = ", ".join(inputs.get("secondary_drivers") or []) or "none"
    ercot_price   = inputs.get("ercot_price") or 0
    henry_hub     = inputs.get("henry_hub_price") or 0
    gas_storage   = inputs.get("natural_gas_storage", "N/A")
    gas_vs_avg    = inputs.get("gas_storage_vs_5yr_avg", "N/A")
    wx_temp       = inputs.get("weather_temperature", "N/A")
    wx_high       = inputs.get("weather_forecast_high", "N/A")

    return f"""You are an AI energy market analyst for a Texas energy intelligence platform.
Analyze the following market conditions and generate professional operational reasoning.
Do not provide trading, investment, financial, legal, or procurement advice.
Focus on: market conditions, risk drivers, demand/supply pressure, ERCOT pricing behavior, gas-to-power impact, data confidence, and what to monitor next.
Synthesize the RELATIONSHIP between drivers (weather → demand pressure → ERCOT price → gas-to-power cost). Do not analyze each signal in isolation.
Use language: may, suggests, indicates, monitoring recommended, conditions remain, pressure is building, volatility risk, pricing uncertainty.
Avoid: buy, sell, trade, guaranteed, will happen, must act, fear language.
Return ONLY valid JSON with no markdown fences, no preamble, no postscript.

Market data:
- Risk level: {inputs.get("overall_risk_level", "low")}
- Confidence: {inputs.get("confidence_score", 70)}%
- Market state: {inputs.get("market_state", "Stable")}
- Risk direction: {inputs.get("risk_direction", "stable")}
- Primary driver: {inputs.get("primary_driver", "none")}
- Secondary drivers: {secondary_str}
- ERCOT price: ${ercot_price:.2f}/MWh
- ERCOT price behavior: {inputs.get("ercot_price_behavior", "stable")}
- ERCOT volatility: {inputs.get("ercot_volatility_level", "low")}
- Current temperature: {wx_temp}°F / Forecast high: {wx_high}°F
- Weather demand pressure: {inputs.get("weather_demand_pressure", "low")}
- Gas storage: {gas_storage} Bcf / vs 5yr avg: {gas_vs_avg}%
- Henry Hub: ${henry_hub:.2f}/MMBtu
- Gas supply pressure: {inputs.get("gas_supply_pressure", "low")}
- Gas-to-power impact: {inputs.get("gas_to_power_impact", "low")}
- Active events: {events_str}
- Data source health: {inputs.get("data_source_health", "active")}
- Time horizon: {inputs.get("time_horizon", "next 24-48 hours")}

Return this JSON structure exactly:
{{
  "executive_summary": "1-2 sentence professional overview of current Texas energy market conditions",
  "current_market_interpretation": "2-3 sentences synthesizing ERCOT price, weather, and gas conditions together",
  "key_driver_analysis": "2-3 sentences explaining the relationship between the dominant drivers and how they interact",
  "escalation_watch": "1-2 sentences on what conditions could shift and what specific factors to monitor",
  "confidence_note": "1 sentence on data quality and confidence level",
  "recommended_monitoring_focus": "1-2 sentences naming specific metrics or data points to track"
}}"""


async def generate_ai_reasoning(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate AI market reasoning from structured signal inputs.
    Uses Claude API with in-memory cache. Falls back to rule-based if unavailable.
    """
    key = _cache_key(
        inputs.get("location", "Houston"),
        inputs.get("overall_risk_level", "low"),
        inputs.get("primary_driver", ""),
        inputs.get("data_valid", True),
    )
    cached = _get_cached(key)
    if cached:
        logger.info("[AI_REASONING] Cache hit (key=%s...)", key[:8])
        return {**cached, "from_cache": True}

    # -- Try Claude API
    if ANTHROPIC_API_KEY:
        try:
            import anthropic
            client  = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            prompt  = _build_prompt(inputs)
            message = await client.messages.create(
                model=AI_MODEL,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text.strip()
            # Strip markdown code fences if the model wraps them
            if raw.startswith("```"):
                parts = raw.split("```")
                raw   = parts[1] if len(parts) > 1 else raw
                if raw.startswith("json"):
                    raw = raw[4:].strip()
            result = json.loads(raw)
            result["generated_at"] = datetime.now(timezone.utc).isoformat()
            result["model"]        = AI_MODEL
            result["disclaimer"]   = DISCLAIMER
            result["ai_powered"]   = True
            result["from_cache"]   = False
            _set_cache(key, result)
            logger.info("[AI_REASONING] Generated via Claude, cached %d min", CACHE_TTL_MINUTES)
            return result

        except json.JSONDecodeError as exc:
            logger.warning("[AI_REASONING] JSON parse error from Claude: %s", exc)
        except Exception as exc:
            logger.warning("[AI_REASONING] Claude API error, using fallback: %s", exc)
    else:
        logger.info("[AI_REASONING] No ANTHROPIC_API_KEY — using rule-based fallback")

    # -- Rule-based fallback
    result = _rule_based_fallback(inputs)
    result["from_cache"] = False
    _set_cache(key, result)
    return result
