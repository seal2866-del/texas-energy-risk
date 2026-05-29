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
_last_error: Optional[str] = None  # last Claude API error (for diagnostics)


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

    # -- Executive summary (actionable, prescriptive)
    if risk == "high":
        exec_summary = f"Immediate attention required. {primary_driver} is driving high-risk conditions — assess open exposure now and confirm contingency protocols are ready."
    elif risk == "medium":
        exec_summary = f"Review operational exposure now. {primary_driver} is building near-term pressure — confirm hedging positions ahead of the next demand peak."
    else:
        exec_summary = f"No action required. Current conditions present minimal procurement or operational exposure. Continue standard monitoring and watch afternoon demand peaks between 14:00–19:00 CDT."

    # -- Current market interpretation
    if risk == "high":
        interpretation = f"ERCOT at ${ercot_price:.0f}/MWh is pricing in active stress — avoid unhedged spot exposure. {primary_driver} is the dominant driver; conditions warrant continuous monitoring."
    elif risk == "medium":
        interpretation = f"ERCOT at ${ercot_price:.0f}/MWh is showing early sensitivity. {primary_driver} is the leading pressure factor — lock in forward positions if procurement windows are open."
    else:
        interpretation = f"ERCOT at ${ercot_price:.0f}/MWh is within normal operating range. No fuel-side or demand-side constraints require immediate action."

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
        escalation = f"Monitor ERCOT real-time pricing and weather forecasts closely. Conditions may escalate if {primary_driver.lower()} intensifies."
    elif risk == "medium":
        escalation = f"Near-term escalation risk may increase if {primary_driver.lower()} worsens. Continued monitoring is warranted."
    else:
        escalation = "No escalation signals active. Routine monitoring of ERCOT pricing and weather forecasts is sufficient."

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
        monitoring_items.append("ERCOT pricing and weather forecasts")
    if gas_pressure in ("medium", "high"):
        monitoring_items.append("Henry Hub and EIA storage")
    if ercot_volatility in ("medium", "high"):
        monitoring_items.append("ERCOT settlement prices")
    if not monitoring_items:
        monitoring_items = ["ERCOT price trends and EIA gas storage"]
    monitoring = f"Monitor {', '.join(monitoring_items)}. Risk direction: {risk_direction}."

    # Historical context (generalized seasonal pattern language)
    season_note = ""
    if weather_pressure in ("medium", "high"):
        season_note = "Current conditions reflect elevated summer demand patterns typical of Texas peak heat periods."
    elif gas_pressure in ("medium", "high"):
        season_note = "Current supply conditions resemble prior tightening periods during seasonal storage draws."
    elif risk == "high":
        season_note = "Conditions resemble prior elevated market stress periods with multiple active drivers."
    else:
        season_note = "Current conditions are within normal seasonal operating parameters."

    return {
        "executive_summary":             exec_summary,
        "current_market_interpretation": interpretation,
        "key_driver_analysis":           driver_analysis,
        "escalation_watch":              escalation,
        "confidence_note":               conf_note,
        "recommended_monitoring_focus":  monitoring,
        "historical_context":            season_note,
        "generated_at":                  datetime.now(timezone.utc).isoformat(),
        "model":                         "rule-based-fallback",
        "disclaimer":                    DISCLAIMER,
        "ai_powered":                    False,
        "fallback_reason":               _fallback_reason,
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

    return f"""You are an operational intelligence engine for Texas energy professionals — traders, procurement managers, and grid operations teams.

Your job is to turn market data into ACTIONABLE operational guidance. Not descriptions. Not observations. Actions.

Rules:
- Lead with what the operator should DO or NOT DO, not what conditions ARE.
- Use direct, confident language. Operators trust specific guidance over vague hedging.
- Synthesize driver relationships (weather → demand → ERCOT price → gas cost). Never analyze signals in isolation.
- Do NOT provide investment, trading, financial, or legal advice.
- Do NOT say: "conditions remain", "monitoring recommended", "risk is low", "situation is stable". These are observations, not guidance.
- DO say: "No action required", "Review exposure now", "Confirm hedging positions", "Watch the 14:00–19:00 CDT window", "Avoid unhedged spot exposure".
- Bloomberg terminal tone: direct, specific, zero filler.
- Return ONLY valid JSON. No markdown. No preamble.

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

Return this JSON structure. Each field is 1-2 sentences max. Be specific and prescriptive:
{{
  "executive_summary": "Start with action status: 'No action required.' or 'Review exposure now.' or 'Immediate attention required.' Then one sentence on why.",
  "current_market_interpretation": "Synthesize what the data means operationally. Name the risk chain. Use contrast where relevant (e.g. price stable but demand elevated).",
  "key_driver_analysis": "Name the dominant driver relationship and its operational implication. E.g.: Heat at 92°F is pressuring afternoon peak demand — watch the 14:00–18:00 CDT window.",
  "escalation_watch": "One specific condition that would trigger escalation. Name the threshold. E.g.: If ERCOT prices cross $75/MWh or temperatures exceed 100°F, reassess immediately.",
  "confidence_note": "Data quality status in one sentence.",
  "recommended_monitoring_focus": "Name 1-2 specific metrics to watch and why.",
  "historical_context": "One sentence of generalized seasonal pattern context. No fabricated dates or events."
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
    _fallback_reason: str = "no_api_key"  # overwritten on success or specific error
    if ANTHROPIC_API_KEY:
        _fallback_reason = "api_error"    # default if something goes wrong inside
        try:
            import anthropic
            client  = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            prompt  = _build_prompt(inputs)
            message = await client.messages.create(
                model=AI_MODEL,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
                timeout=30.0,
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
            result["from_cache"]     = False
            result["fallback_reason"] = None
            if "historical_context" not in result:
                result["historical_context"] = ""
            _set_cache(key, result)
            logger.info("[AI_REASONING] Generated via Claude, cached %d min", CACHE_TTL_MINUTES)
            return result

        except json.JSONDecodeError as exc:
            logger.warning("[AI_REASONING] JSON parse error from Claude: %s", exc)
            _fallback_reason = "parse_error"
            global _last_error
            _last_error = f"JSON parse error: {exc}"
        except Exception as exc:
            logger.warning("[AI_REASONING] Claude API error, using fallback: %s", exc)
            _fallback_reason = "api_error"
            _last_error = f"{type(exc).__name__}: {exc}"
    else:
        logger.info("[AI_REASONING] No ANTHROPIC_API_KEY — using rule-based fallback")
        _fallback_reason = "no_api_key"

    # -- Rule-based fallback
    result = _rule_based_fallback(inputs)
    result["from_cache"] = False
    _set_cache(key, result)
    return result

def get_ai_status() -> dict:
    """Return diagnostic info about the AI reasoning layer (no secrets exposed)."""
    cache_count = len(_cache)
    ai_entries  = sum(1 for v in _cache.values() if v["data"].get("ai_powered"))
    return {
        "api_key_configured": bool(ANTHROPIC_API_KEY),
        "api_key_prefix":     (ANTHROPIC_API_KEY[:8] + "...") if ANTHROPIC_API_KEY else None,
        "model":              AI_MODEL,
        "cache_ttl_minutes":  CACHE_TTL_MINUTES,
        "cached_entries":     cache_count,
        "ai_powered_entries": ai_entries,
        "last_error":         _last_error,
    }
