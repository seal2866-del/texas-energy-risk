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

    # ── 1. Situation & Executive Summary ─────────────────────────────────────
    if risk == "high":
        recommended_action = "Elevated operational awareness — consider internal escalation procedures."
        exec_summary = f"Elevated operational conditions detected. {primary_driver} is the primary driver of current risk levels. Conditions may warrant increased monitoring frequency and management visibility according to internal procedures."
    elif risk == "medium":
        recommended_action = "Increased monitoring priority — review according to internal procedures."
        exec_summary = f"Moderate operational conditions detected. {primary_driver} is contributing to elevated monitoring priority. Conditions may warrant increased attention during peak demand windows."
    else:
        recommended_action = "Routine monitoring — no elevated operational conditions detected."
        exec_summary = "Current conditions remain stable across monitored signals. No elevated operational pressure detected. Standard monitoring procedures apply."

    # ── 2. Operational Significance ───────────────────────────────────────────
    if risk == "high":
        operational_exposure = "Current conditions indicate elevated operational significance. Multiple signals are aligned — monitoring frequency and internal visibility may warrant review according to organizational procedures."
    elif risk == "medium":
        operational_exposure = "Conditions indicate moderate operational significance. Potential for increased sensitivity during peak demand periods — monitor according to internal protocols."
    else:
        operational_exposure = "Operational significance is low under current conditions. No indication of near-term disruption to normal operating parameters."

    # ── 3. Escalation Thresholds Being Monitored ──────────────────────────────
    if risk == "high":
        escalation = "Conditions may warrant increased internal visibility if ERCOT exceeds $100/MWh or generation availability notices are issued."
    elif risk == "medium":
        escalation = "Conditions may warrant increased monitoring priority if ERCOT pricing exceeds $50/MWh or temperatures exceed forecast by more than 5°F."
    else:
        escalation = "Monitoring thresholds: ERCOT above $35/MWh or temperatures above 95°F may increase operational monitoring priority."

    # ── 4. Monitoring Focus ───────────────────────────────────────────────────
    if risk == "high":
        monitoring = "Monitor real-time ERCOT pricing, generation availability, and gas supply conditions continuously."
    elif weather_pressure in ("medium", "high") and gas_pressure in ("medium", "high"):
        monitoring = "Track ERCOT 5-minute LMP during 14:00–19:00 CDT and Henry Hub for any spike above $3.00/MMBtu."
    elif weather_pressure in ("medium", "high"):
        monitoring = "Track ERCOT 5-minute LMP 14:00–19:00 CDT for demand-driven price behavior. Monitor updated temperature forecasts every 2 hours."
    elif gas_pressure in ("medium", "high"):
        monitoring = "Monitor Henry Hub pricing and EIA weekly storage report for any further supply deterioration."
    else:
        monitoring = "Monitor ERCOT pricing during the 14:00–19:00 CDT afternoon peak window. No elevated monitoring required outside peak hours."

    # ── 5. Supporting Analysis (driver chain — comes last) ────────────────────
    if weather_pressure == "high" and gas_pressure in ("medium", "high"):
        driver_analysis = "Heat-driven demand is compounding gas supply tightness — thermal load and fuel cost pressure are aligned, increasing near-term pricing sensitivity across Texas power markets."
    elif weather_pressure in ("medium", "high") and ercot_volatility in ("medium", "high"):
        driver_analysis = "Weather demand and ERCOT volatility are moving together — the grid is beginning to price in demand stress. Gas supply is a secondary watch factor."
    elif weather_pressure in ("medium", "high"):
        driver_analysis = f"Temperature-driven demand is the primary pressure factor. ERCOT pricing has {'begun to reflect this stress' if ercot_volatility != 'low' else 'remained stable'}, with gas supply currently {'tightening' if gas_pressure != 'low' else 'adequate'}."
    elif gas_pressure in ("medium", "high"):
        driver_analysis = "Gas supply tightness is the primary pressure factor. Generation cost sensitivity may increase if demand rises during peak periods."
    elif ercot_volatility in ("medium", "high"):
        driver_analysis = "ERCOT pricing volatility is elevated relative to weather and gas fundamentals — likely driven by localized grid conditions or short-term imbalances."
    else:
        driver_analysis = "No dominant risk driver active. Demand, supply, and pricing are within normal seasonal operating ranges."

    # ── Confidence note ───────────────────────────────────────────────────────
    if not data_valid or data_health in ("stale", "unavailable", "degraded"):
        conf_note = f"Confidence limited ({confidence}%). One or more data sources are delayed or unavailable — interpret with caution."
    elif confidence >= 80:
        conf_note = f"High confidence ({confidence}%). Assessment based on verified real-time ERCOT, weather, and gas data."
    elif confidence >= 60:
        conf_note = f"Moderate confidence ({confidence}%). Assessment reflects available market data with standard analytical uncertainty."
    else:
        conf_note = f"Confidence limited ({confidence}%). Mixed or incomplete signals — treat assessment as directional only."

    # ── Historical context ────────────────────────────────────────────────────
    if weather_pressure in ("medium", "high"):
        season_note = "Afternoon demand peaks during Texas summer heat periods typically require 2–4 GW incremental generation; current supply posture appears adequate."
    elif gas_pressure in ("medium", "high"):
        season_note = "Seasonal storage draws during peak demand periods can amplify gas price sensitivity — monitor weekly EIA reports."
    elif risk == "high":
        season_note = "Multi-signal stress events in Texas have historically produced sharp intraday ERCOT price spikes — maintain heightened readiness."
    else:
        season_note = "Current conditions are consistent with normal seasonal operating parameters for this period."

    return {
        "executive_summary":             exec_summary,
        "recommended_action":            recommended_action,
        "operational_exposure":          operational_exposure,
        "escalation_trigger":            escalation,
        "recommended_monitoring_focus":  monitoring,
        "key_driver_analysis":           driver_analysis,
        "current_market_interpretation": driver_analysis,  # backward compat
        "escalation_watch":              escalation,        # backward compat
        "confidence_note":               conf_note,
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

    risk_level = inputs.get("overall_risk_level", "low")

    # Risk-level-specific action templates to anchor Claude's output
    if risk_level == "high":
        action_anchor = "Recommended Action: Operational readiness review recommended."
        exposure_anchor = "Operational Exposure: Elevated energy cost exposure may develop during peak demand intervals."
    elif risk_level == "medium":
        action_anchor = "Recommended Action: Enhanced monitoring recommended."
        exposure_anchor = "Operational Exposure: Moderate pricing sensitivity may emerge during peak demand periods."
    else:
        action_anchor = "Recommended Action: No action required."
        exposure_anchor = "Operational Exposure: Minimal operational or procurement exposure detected."

    return f"""You are an operational intelligence system for Texas energy professionals — refineries, manufacturers, data centers, infrastructure operators, and energy-intensive industrial teams.

PURPOSE: Provide situational awareness and operational context. Never recommend business decisions, transactions, procurement actions, or financial strategies.

STRICT RULES — NEVER generate:
- Recommended actions (buy, sell, hedge, procure, lock contracts, execute)
- Financial advice, trading signals, procurement instructions
- Statements telling users what they "should" or "must" do
- Price predictions stated as certainties

ALWAYS use language that describes conditions and awareness:
- "Current conditions indicate..."
- "Conditions may warrant monitoring..."
- "Operational awareness recommended..."
- "Monitor according to internal procedures..."
- "Potential operational sensitivity..."
- "Situational awareness: conditions are..."
- "Escalation threshold monitoring active..."

OUTPUT STRUCTURE (strictly enforced):
1. Situation — what is currently happening (factual, descriptive)
2. Operational Significance — why it matters operationally (context only)
3. Monitoring Focus — what deserves attention and when
4. Potential Impact — what could change if conditions shift (descriptive only)
5. Escalation Triggers — specific thresholds being monitored
6. Assessment Reliability — data quality status

Tone: Institutional. Factual. Awareness-oriented. Like an operations briefing, not a trading desk.
- Do NOT provide investment, trading, financial, legal, or procurement advice.
- Return ONLY valid JSON. No markdown. No preamble.

Current risk level: {risk_level.upper()}
Anchor your recommended_action exactly as: "{action_anchor}"
Anchor your operational_exposure exactly as: "{exposure_anchor}"

Market data:
- Risk level: {risk_level}
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

Return this exact JSON structure. Each field max 2 sentences. Descriptive and awareness-oriented — never advisory:
{{
  "executive_summary": "Situation summary. E.g.: 'Current conditions remain stable. No elevated operational pressure detected across monitored signals.'",
  "situation": "What is currently happening. Factual description of conditions only.",
  "operational_significance": "Why current conditions matter operationally. Context only — no recommendations.",
  "monitoring_focus": "What deserves monitoring attention, when, and why. Descriptive — not directive.",
  "potential_impact": "What could change if conditions shift. Descriptive consequences only — no certainties.",
  "escalation_trigger": "Specific thresholds being monitored. E.g.: 'Conditions may warrant increased monitoring if ERCOT exceeds $35/MWh or temperatures exceed 95°F.'",
  "assessment_reliability": "Data quality status. Which feeds are current, which may be on slower cadence.",
  "key_driver_analysis": "Synthesize the driver chain briefly. Factual only.",
  "confidence_note": "Overall assessment reliability in one sentence."
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
