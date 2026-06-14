"""
TX Energy Risk — Weekly Newsletter Generation Service
Generates the Texas Energy Risk Brief using live signal data and AI.
"""
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import anthropic

from services.supabase_client import get_supabase

log = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
AI_MODEL          = "claude-haiku-4-5-20251001"

REGIONS = ["Houston", "Dallas", "Austin", "San Antonio", "Midland", "Odessa", "Corpus Christi", "Lubbock"]


# ---------------------------------------------------------------------------
# FETCH DATA
# ---------------------------------------------------------------------------

def _fetch_latest_snapshot(location: str = "Houston") -> dict:
    """Get the most recent signal snapshot for a location."""
    sb = get_supabase()
    r  = (
        sb.table("signal_snapshots")
          .select("*")
          .eq("location", location)
          .order("computed_at", desc=True)
          .limit(1)
          .execute()
    )
    return r.data[0] if r.data else {}


def _fetch_week_snapshots(location: str = "Houston") -> list[dict]:
    """Get snapshots from the past 7 days."""
    sb     = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    r = (
        sb.table("signal_snapshots")
          .select("risk_score, risk_score_numeric, computed_at, ercot_price, henry_hub_price")
          .eq("location", location)
          .gte("computed_at", cutoff)
          .order("computed_at")
          .execute()
    )
    return r.data or []


def _fetch_prior_week_snapshot(location: str = "Houston") -> dict:
    """Get a snapshot from ~7 days ago for comparison."""
    sb     = get_supabase()
    start  = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    end    = (datetime.now(timezone.utc) - timedelta(days=6)).isoformat()
    r = (
        sb.table("signal_snapshots")
          .select("*")
          .eq("location", location)
          .gte("computed_at", start)
          .lte("computed_at", end)
          .order("computed_at", desc=True)
          .limit(1)
          .execute()
    )
    return r.data[0] if r.data else {}


def _fetch_regional_snapshots() -> dict[str, dict]:
    """Get the latest snapshot for each monitored region."""
    result = {}
    for region in REGIONS:
        snap = _fetch_latest_snapshot(region)
        result[region] = {
            "risk_score": snap.get("risk_score", "unknown"),
            "ercot_price": snap.get("ercot_price"),
        }
    return result


# ---------------------------------------------------------------------------
# AI GENERATION
# ---------------------------------------------------------------------------

def _build_newsletter_prompt(
    current: dict,
    prior: dict,
    week_snapshots: list[dict],
    regional: dict[str, dict],
) -> str:
    risk        = current.get("risk_score", "low")
    ercot       = current.get("ercot_price", 0) or 0
    prior_ercot = prior.get("ercot_price", ercot) or ercot
    price_pct   = ((ercot - prior_ercot) / prior_ercot * 100) if prior_ercot > 0 else 0

    scores    = [s.get("risk_score_numeric") or {"high": 7.5, "medium": 4.5}.get(s.get("risk_score", "low"), 2.0) for s in week_snapshots]
    avg_score = sum(scores) / len(scores) if scores else 2.0
    peak_score = max(scores) if scores else 2.0

    trend = "Stable"
    if scores and len(scores) >= 2:
        recent = sum(scores[-3:]) / 3
        older  = sum(scores[:3])  / 3
        if recent > older + 0.3:   trend = "Rising"
        elif recent < older - 0.3: trend = "Improving"

    region_lines = "\n".join(f"- {r}: {d.get('risk_score', 'unknown').upper()}" for r, d in regional.items())
    action_anchor = "Operational review recommended." if risk == "high" else "Enhanced monitoring recommended." if risk == "medium" else "No action required."

    # Industry spotlight rotation by week number
    industries = ["Midstream Operations", "Pipeline Operators", "Refineries", "Industrial Facilities", "Data Centers", "Energy Procurement"]
    spotlight_industry = industries[datetime.now(timezone.utc).isocalendar()[1] % len(industries)]

    return f"""You are the editor of the Texas Energy Risk Brief — a weekly operational intelligence newsletter for midstream operators, pipeline operators, refineries, industrial facilities, energy managers, and procurement teams.

PURPOSE: Answer "What could affect my operation this week and what should I do about it?" Be direct, executive, and actionable.

STRICT RULES:
- No investment, trading, financial, or procurement advice
- Tone: control room briefing. Direct. 30-second readability.
- NEVER: "interesting", "notable", "potentially", "might be worth"
- ALWAYS: "No action required", "Monitor", "Watch", "Escalation threshold"

Current Texas Conditions (LIVE — use these exact figures):
- Risk: {risk.upper()} | Trend: {trend}
- ERCOT Houston Hub: {_fmt_ercot(ercot)} | Prior week: {_fmt_ercot(prior_ercot)} | Change: {price_pct:+.1f}%
- ERCOT North Hub: {_fmt_ercot(current["hub_prices"].get("HB_NORTH")) if current.get("hub_prices") else "N/A"}
- ERCOT West Hub: {_fmt_ercot(current["hub_prices"].get("HB_WEST")) if current.get("hub_prices") else "N/A"}
- Henry Hub: ${current.get("henry_hub_price", "N/A")}/MMBtu | Change: {current.get("henry_hub_change_pct", 0):+.1f}% | State: {current.get("henry_hub_market_state", "normal").upper()}
- Grid Demand: {current.get("grid_demand_gw", "N/A")} GW | Reserve: {current.get("grid_reserve_pct", "N/A")}%
- Wind: {current.get("wind_pct", "N/A")}% of load | Solar: {current.get("solar_pct", "N/A")}% of load
- Weather Demand: {current.get("weather_demand_pressure", "low").upper()}
- Gas Supply: {current.get("gas_supply_pressure", "low").upper()}
- Week avg risk: {avg_score:.1f}/10 | Peak: {peak_score:.1f}/10
- Week of: {datetime.now(timezone.utc).strftime("%B %d, %Y")}

Regional: {region_lines}
Industry Spotlight this week: {spotlight_industry}
Anchor recommended_action: "{action_anchor}"

Return ONLY valid JSON:
{{
  "subject": "Texas Energy Risk Brief — [current week, e.g. Week of June 9, 2026]",
  "preview_text": "Under 90 chars. Start with risk level. E.g.: Low risk this week. ERCOT stable, no heat wave concerns for Texas operations.",
  "exec_risk_level": "{risk.upper()}",
  "exec_outlook": "One sentence. Current operating outlook.",
  "exec_primary_driver": "One phrase. What is driving current conditions.",
  "exec_recommendation": "{action_anchor}",
  "exec_expected_outlook": "One sentence. What to expect in next 24-72 hours.",
  "what_changed_ercot": "ERCOT: {_fmt_ercot(prior_ercot)} → {_fmt_ercot(ercot)} ({price_pct:+.1f}%)",
  "what_changed_temp": "Temperature change this week. E.g.: 92°F → 97°F",
  "what_changed_demand": "Demand change. E.g.: Moderate → Elevated",
  "what_changed_gas": "Gas storage/Henry Hub change. E.g.: No material change",
  "what_changed_risk": "Risk level change. E.g.: LOW → LOW",
  "what_changed_explanation": "2 sentences. Why did conditions change this week?",
  "ew_heat_risk": "Normal / Watching / Elevated",
  "ew_demand_pressure": "Normal / Watching / Elevated",
  "ew_gas_supply": "Normal / Watching / Elevated",
  "ew_ercot_reserves": "Healthy / Watching / Tight",
  "ew_grid_reliability": "Normal / Watching / Stressed",
  "ew_escalation_pct": 15,
  "ew_explanation": "2 sentences explaining early warning signals.",
  "threat_heat_wave": "Low / Moderate / High",
  "threat_cold_front": "Low / Moderate / High",
  "threat_hurricane": "Low / Moderate / High",
  "threat_congestion": "None / Moderate / High",
  "threat_pipeline": "None / Moderate / High",
  "threat_refinery": "None / Moderate / High",
  "threat_ercot_notices": "None / Active",
  "threat_grid_reliability": "Stable / Watch / Stressed",
  "ercot_current": "{_fmt_ercot(ercot)}",
  "ercot_24h": "Stable / Rising / Falling",
  "ercot_72h": "Stable / Rising / Falling",
  "ercot_risk": "{risk.capitalize()}",
  "ercot_confidence": 72,
  "ercot_comment": "One sentence. ERCOT outlook context.",
  "recommendations": ["3-5 operational recommendations. Start each with a verb. No financial advice."],
  "fin_current_price": "{_fmt_ercot(ercot)}",
  "fin_elevated_price": "$75/MWh",
  "fin_high_price": "$150/MWh",
  "fin_explanation": "2 sentences. Potential cost exposure context. Informational only.",
  "spotlight_industry": "{spotlight_industry}",
  "spotlight_text": "2-3 sentences. Current conditions for this industry. Operational focus.",
  "risk_trend": "{trend}",
  "confidence_pct": 72,
  "watch_items": ["3-5 specific watch items with thresholds."]
}}"""





async def generate_newsletter_content(
    current: dict,
    prior: dict,
    week_snapshots: list[dict],
    regional: dict[str, dict],
) -> dict:
    """Generate newsletter content using Claude AI."""
    prompt = _build_newsletter_prompt(current, prior, week_snapshots, regional)

    if not ANTHROPIC_API_KEY:
        log.warning("[NEWSLETTER] No ANTHROPIC_API_KEY — using fallback content")
        return _fallback_content(current, prior)

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        msg    = client.messages.create(
            model=AI_MODEL,
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw  = msg.content[0].text.strip()
        data = json.loads(raw)
        log.info("[NEWSLETTER] AI content generated successfully")
        return data
    except Exception as e:
        log.error(f"[NEWSLETTER] AI generation failed: {e}")
        return _fallback_content(current, prior)


def _fmt_ercot(price) -> str:
    """Format ERCOT price safely — never show $0.00."""
    if price and float(price) > 0:
        return f"${float(price):.2f}/MWh"
    return "Awaiting ERCOT Feed"


def _fallback_content(current: dict, prior: dict) -> dict:
    """Rule-based fallback if AI is unavailable."""
    risk      = current.get("risk_score", "low")
    ercot_raw = current.get("ercot_price")
    ercot     = float(ercot_raw) if (ercot_raw and float(ercot_raw) > 0) else None
    ercot_str = _fmt_ercot(ercot)
    action = (
        "Operational review recommended." if risk == "high" else
        "Enhanced monitoring recommended." if risk == "medium" else
        "No action required."
    )
    return {
        "subject":                  f"Texas Energy Risk Brief — Week of {datetime.now().strftime('%B %d, %Y')}",
        "preview_text":             f"{action} Texas ERCOT at {ercot_str}. {risk.capitalize()} risk conditions.",
        "executive_summary":        f"{action} Current Texas energy conditions reflect {risk} operational risk. ERCOT Houston Hub at {ercot_str}.",
        "recommended_action":       action,
        "action_reasons":           [
            "ERCOT pricing below escalation thresholds",
            "Weather conditions within seasonal norms",
            "Natural gas supply conditions stable",
            "No operational constraints detected",
        ],
        "escalate_if":              ["ERCOT > $35/MWh", "Temperature > 95°F", "Henry Hub > $3.00/MMBtu"],
        "next_review_time":         "14:00 CDT",
        "cost_exposure_level":      "Minimal" if risk == "low" else "Moderate" if risk == "medium" else "Elevated",
        "cost_exposure_desc":       "No material energy-cost escalation expected under current conditions.",
        "cost_watch_threshold":     "ERCOT > $35/MWh",
        "cost_elevated_threshold":  "ERCOT > $50/MWh",
        "cost_critical_threshold":  "ERCOT > $100/MWh",
        "risk_trend":               "Stable",
        "risk_trend_desc":          "Conditions are stable relative to prior reporting period.",
        "most_important_signal_title": "ERCOT Afternoon Price Window",
        "most_important_signal":    "Monitor ERCOT pricing during the 14:00–19:00 CDT afternoon demand window. Current pricing remains below watch thresholds.",
        "what_changed_ercot":       f"ERCOT: {ercot_str} (current week)",
        "what_changed_weather":     "Temperature outlook within seasonal norms",
        "what_changed_gas":         "Gas storage conditions stable",
        "what_changed_risk":        f"Risk Score: {risk.capitalize()} (no material change)",
        "outlook_0_6h":             "No action required.",
        "outlook_6_24h":            "Continue standard monitoring.",
        "outlook_24_48h":           "Stable outlook expected.",
        "outlook_48_72h":           "No significant risk changes expected.",
        "confidence_pct":           55,
        "confidence_reasons":       [
            "Stable conditions provide fewer predictive signals",
            "Weather uncertainty increases beyond 24 hours",
            "No active risk drivers currently present",
            "ERCOT conditions remain within normal range",
        ],
        "watch_items":              [
            "ERCOT pricing during 14:00–19:00 CDT afternoon peak window",
            "Temperature forecasts — escalation watch above 95°F",
            "Henry Hub pricing — watch threshold $3.00/MMBtu",
            "EIA weekly gas storage report",
        ],
    }


# ---------------------------------------------------------------------------
# BUILD HTML EMAIL
# ---------------------------------------------------------------------------

def build_html_email(content: dict, current: dict, regional: dict[str, dict], issue_id: str) -> str:
    """Build Newsletter V4 HTML — 9-section executive operational briefing."""
    risk       = current.get("risk_score", "low")
    ercot_raw  = current.get("ercot_price")
    ercot      = float(ercot_raw) if (ercot_raw and float(ercot_raw) > 0) else None
    ercot_str  = _fmt_ercot(ercot)
    risk_color = "#ef4444" if risk == "high" else "#f59e0b" if risk == "medium" else "#10b981"
    fe_url     = os.getenv("FRONTEND_URL", "https://texasgridintel.com")
    unsub_url  = f"{fe_url}/unsubscribe?token={{{{unsubscribe_token}}}}"

    def ew_dot(level: str) -> str:
        if level in ("Elevated", "Tight", "Stressed", "High", "Active"):
            return "🔴"
        if level in ("Watching", "Moderate", "Watch"):
            return "🟡"
        return "🟢"

    def threat_color(level: str) -> str:
        if level in ("High", "Active", "Stressed"):
            return "#ef4444"
        if level in ("Moderate", "Watch", "Watching"):
            return "#f59e0b"
        return "#10b981"

    # Early warning signals
    ew_signals = [
        (content.get("ew_heat_risk", "Normal"),        "Heat Risk"),
        (content.get("ew_demand_pressure", "Normal"),  "Demand Pressure"),
        (content.get("ew_gas_supply", "Normal"),       "Gas Supply"),
        (content.get("ew_ercot_reserves", "Healthy"),  "ERCOT Reserves"),
        (content.get("ew_grid_reliability", "Normal"), "Grid Reliability"),
    ]
    ew_html = "".join(f'''<tr><td style="padding:5px 0;border-bottom:1px solid #1e293b;font-size:13px;color:#e2e8f0;">{ew_dot(lvl)} {label}</td><td style="padding:5px 0;border-bottom:1px solid #1e293b;font-size:12px;font-weight:700;color:{threat_color(lvl)};text-align:right;">{lvl}</td></tr>''' for lvl, label in ew_signals)

    # Texas Threat Center
    threats = [
        ("Heat Wave",          content.get("threat_heat_wave", "Low")),
        ("Cold Front",         content.get("threat_cold_front", "Low")),
        ("Hurricane",          content.get("threat_hurricane", "Low")),
        ("Transmission",       content.get("threat_congestion", "None")),
        ("Pipeline Constraints", content.get("threat_pipeline", "None")),
        ("Refinery Outages",   content.get("threat_refinery", "None")),
        ("ERCOT Notices",      content.get("threat_ercot_notices", "None")),
        ("Grid Reliability",   content.get("threat_grid_reliability", "Stable")),
    ]
    threat_html = "".join(f'''<tr><td style="padding:5px 0;border-bottom:1px solid #1e293b;font-size:12px;color:#94a3b8;">{name}</td><td style="padding:5px 0;border-bottom:1px solid #1e293b;font-size:12px;font-weight:700;color:{threat_color(level)};text-align:right;">{level}</td></tr>''' for name, level in threats)

    # What changed rows
    changes = [
        ("ERCOT Price",    content.get("what_changed_ercot", ercot_str)),
        ("Temperature",    content.get("what_changed_temp", "Monitoring")),
        ("Demand",         content.get("what_changed_demand", "Stable")),
        ("Gas Storage",    content.get("what_changed_gas", "No material change")),
        ("Risk Level",     content.get("what_changed_risk", f"{risk.upper()} → {risk.upper()}")),
    ]
    changes_html = "".join(f'''<tr><td style="padding:6px 8px;font-size:12px;color:#94a3b8;border-bottom:1px solid #1e293b;">{label}</td><td style="padding:6px 8px;font-size:12px;font-weight:700;color:#e2e8f0;border-bottom:1px solid #1e293b;">{val}</td></tr>''' for label, val in changes)

    # Recommendations
    recs = content.get("recommendations") or ["Continue standard monitoring cadence.", "Monitor afternoon ERCOT pricing (14:00-19:00 CDT).", "Review internal procedures if conditions escalate."]
    recs_html = "".join(f'''<tr><td style="padding:5px 0;font-size:13px;color:#e2e8f0;">✔ {r}</td></tr>''' for r in recs)

    # Watch items
    watch = content.get("watch_items") or []
    watch_html = "".join(f'''<tr><td style="padding:5px 0;border-bottom:1px solid #1e293b;font-size:12px;color:#94a3b8;">• {item}</td></tr>''' for item in watch)

    ercot_conf = content.get("ercot_confidence", 72)
    ew_esc_pct = content.get("ew_escalation_pct", 15)

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{content.get("subject","Texas Energy Risk Brief")}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<!-- HEADER -->
<tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:20px 28px;border-bottom:2px solid {risk_color};">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><p style="margin:0 0 2px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:2px;">Texas Grid Intel</p>
        <p style="margin:0;font-size:20px;font-weight:900;color:#fff;">Texas Energy Risk Brief</p>
        <p style="margin:3px 0 0;font-size:10px;color:#64748b;">Weekly Operational Intelligence · {datetime.now(timezone.utc).strftime("%B %d, %Y")}</p></td>
    <td align="right" style="vertical-align:top;">
      <span style="display:inline-block;padding:6px 14px;border-radius:6px;background:{risk_color}22;border:2px solid {risk_color};font-size:13px;font-weight:900;color:{risk_color};text-transform:uppercase;">{risk.upper()} RISK</span>
    </td>
  </tr></table>
</td></tr>

<!-- MAIN CTA BUTTON -->
<tr><td style="background:#0a0f1a;padding:12px 28px;text-align:center;">
  <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
    <td style="border-radius:6px;background:#f97316;padding:0;">
      <a href="{fe_url}/dashboard" style="display:inline-block;padding:10px 24px;border-radius:6px;background:#f97316;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;">&#8594; View Live Dashboard</a>
    </td>
    <td style="padding-left:12px;">
      <a href="{fe_url}/alerts" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#1e293b;border:1px solid #334155;font-size:12px;font-weight:600;color:#94a3b8;text-decoration:none;">Alert Settings</a>
    </td>
  </tr></table>
</td></tr>

<!-- SECTION 1: EXECUTIVE SUMMARY -->
<tr><td style="background:#0f172a;padding:24px 28px;border-bottom:3px solid {risk_color};">
  <p style="margin:0 0 6px;font-size:10px;color:{risk_color};text-transform:uppercase;letter-spacing:2px;font-weight:700;">Section 1 · Executive Summary</p>
  <p style="margin:0 0 16px;font-size:16px;color:#e2e8f0;line-height:1.6;">{content.get("exec_outlook", "Texas energy conditions are stable this week.")}</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="width:50%;padding-right:8px;">
        <table width="100%" cellpadding="8" cellspacing="0" style="background:#1e293b;border-radius:8px;">
          <tr><td style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Risk Level</td></tr>
          <tr><td style="font-size:22px;font-weight:900;color:{risk_color};">{risk.upper()}</td></tr>
        </table>
      </td>
      <td style="width:50%;padding-left:8px;">
        <table width="100%" cellpadding="8" cellspacing="0" style="background:#1e293b;border-radius:8px;">
          <tr><td style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Primary Driver</td></tr>
          <tr><td style="font-size:14px;font-weight:700;color:#e2e8f0;">{content.get("exec_primary_driver", "Stable market conditions")}</td></tr>
        </table>
      </td>
    </tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
    <tr><td style="background:#1e293b;border-left:3px solid {risk_color};padding:10px 14px;border-radius:0 6px 6px 0;">
      <p style="margin:0 0 2px;font-size:9px;color:#64748b;text-transform:uppercase;">Recommended Action</p>
      <p style="margin:0;font-size:14px;font-weight:700;color:#e2e8f0;">{content.get("exec_recommendation","No action required.")}</p>
    </td></tr>
    <tr><td style="padding-top:8px;">
      <p style="margin:0;font-size:12px;color:#64748b;"><strong style="color:#94a3b8;">Expected Outlook:</strong> {content.get("exec_expected_outlook","Stable over the next 24-72 hours.")}</p>
    </td></tr>
  </table>
</td></tr>

<!-- SECTION 2: WHAT CHANGED -->
<tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
  <p style="margin:0 0 12px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Section 2 · What Changed This Week</p>
  <table width="100%" cellpadding="0" cellspacing="0">{changes_html}</table>
  <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;font-style:italic;">{content.get("what_changed_explanation","Conditions were broadly stable this week relative to prior period.")}</p>
</td></tr>

<!-- SECTION 3: EARLY WARNING -->
<tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
  <p style="margin:0 0 12px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Section 3 · Early Warning Signals</p>
  <table width="100%" cellpadding="0" cellspacing="0">{ew_html}</table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;background:#1e293b;border-radius:6px;">
    <tr><td style="padding:10px 14px;">
      <p style="margin:0 0 2px;font-size:9px;color:#64748b;text-transform:uppercase;">Escalation Probability</p>
      <p style="margin:0;font-size:18px;font-weight:900;color:{"#ef4444" if ew_esc_pct >= 50 else "#f59e0b" if ew_esc_pct >= 25 else "#10b981"};">{ew_esc_pct}%</p>
    </td>
    <td style="padding:10px 14px;text-align:right;vertical-align:middle;">
      <p style="margin:0;font-size:11px;color:#64748b;">{content.get("ew_explanation","All signals within normal operating parameters.")}</p>
    </td></tr>
  </table>
</td></tr>

<!-- SECTION 4: TEXAS THREAT CENTER -->
<tr><td style="background:#0a0f1a;padding:20px 28px;border-bottom:1px solid #1e293b;">
  <p style="margin:0 0 12px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Section 4 · Texas Threat Center</p>
  <table width="100%" cellpadding="0" cellspacing="0">{threat_html}</table>
</td></tr>

<!-- SECTION 5: ERCOT OUTLOOK -->
<tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
  <p style="margin:0 0 12px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Section 5 · ERCOT Outlook</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      {"".join(f'''<td style="padding:8px;text-align:center;"><table cellpadding="6" cellspacing="0" style="background:#1e293b;border-radius:6px;width:100%;"><tr><td style="font-size:9px;color:#64748b;text-transform:uppercase;">{lbl}</td></tr><tr><td style="font-size:13px;font-weight:700;color:#e2e8f0;">{val}</td></tr></table></td>''' for lbl, val in [("Current", content.get("ercot_current", ercot_str)), ("24-Hour", content.get("ercot_24h","Stable")), ("72-Hour", content.get("ercot_72h","Stable")), ("Risk", content.get("ercot_risk",risk.capitalize())), (f"Confidence", f"{ercot_conf}%")])}
    </tr>
  </table>
  <p style="margin:10px 0 0;font-size:12px;color:#64748b;font-style:italic;">{content.get("ercot_comment","ERCOT conditions are within normal operating parameters.")}</p>
  <p style="margin:8px 0 0;font-size:11px;"><a href="{fe_url}/dashboard" style="color:#f97316;text-decoration:underline;font-weight:600;">View real-time ERCOT dashboard → texasgridintel.com/dashboard</a></p>
</td></tr>

<!-- SECTION 6: OPERATIONAL RECOMMENDATIONS -->
<tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
  <p style="margin:0 0 12px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Section 6 · Operational Recommendations</p>
  <table width="100%" cellpadding="0" cellspacing="0">{recs_html}</table>
  <p style="margin:10px 0 0;font-size:10px;color:#475569;font-style:italic;">Operational awareness only. Not financial, procurement, or operational advice.</p>
</td></tr>

<!-- SECTION 7: FINANCIAL IMPACT -->
<tr><td style="background:#0a0f1a;padding:20px 28px;border-bottom:1px solid #1e293b;">
  <p style="margin:0 0 12px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Section 7 · Financial Impact Reference</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      {"".join(f'''<td style="padding:4px;text-align:center;"><table cellpadding="8" cellspacing="0" style="background:#1e293b;border-radius:6px;width:100%;"><tr><td style="font-size:9px;color:#64748b;text-transform:uppercase;">{lbl}</td></tr><tr><td style="font-size:14px;font-weight:900;color:{clr};">{val}</td></tr></table></td>''' for lbl, val, clr in [("Current Environment", content.get("fin_current_price", ercot_str), "#10b981"), ("Elevated Conditions", content.get("fin_elevated_price","$75/MWh"), "#f59e0b"), ("High-Risk Conditions", content.get("fin_high_price","$150/MWh"), "#ef4444")])}
    </tr>
  </table>
  <p style="margin:10px 0 0;font-size:12px;color:#64748b;font-style:italic;">{content.get("fin_explanation","These are reference price levels only. Actual operational cost impact depends on facility load and contract structure.")}</p>
</td></tr>

<!-- SECTION 8: INDUSTRY SPOTLIGHT -->
<tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;border-left:3px solid #3b82f6;">
  <p style="margin:0 0 4px;font-size:10px;color:#3b82f6;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Section 8 · Industry Spotlight</p>
  <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#e2e8f0;">{content.get("spotlight_industry","Midstream Operations")}</p>
  <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">{content.get("spotlight_text","Current conditions support normal operations. No weather-driven disruptions are expected this week.")}</p>
</td></tr>

<!-- SECTION 9: DEMO CTA -->
<tr><td style="background:#1e293b;padding:24px 28px;border-bottom:1px solid #0f172a;text-align:center;">
  <p style="margin:0 0 6px;font-size:12px;font-weight:900;color:#f97316;text-transform:uppercase;letter-spacing:1px;">Want Customized Texas Energy Risk Intelligence?</p>
  <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#fff;">Schedule a 15-Minute Executive Briefing</p>
  <p style="margin:0 0 16px;font-size:12px;color:#94a3b8;">See how Texas Grid Intel helps your organization monitor ERCOT volatility, weather-driven demand risk, natural gas market changes, and early warning signals.</p>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
    <td style="padding-right:8px;">
      <a href="{fe_url}/pricing" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#f97316;font-size:13px;font-weight:700;color:#fff;text-decoration:none;">Schedule Executive Briefing</a>
    </td>
    <td>
      <a href="{fe_url}/dashboard" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#0f172a;border:1px solid #334155;font-size:13px;font-weight:600;color:#e2e8f0;text-decoration:none;">View Live Dashboard</a>
    </td>
  </tr></table>
  <p style="margin:14px 0 0;font-size:11px;color:#475569;">
    ✓ ERCOT volatility alerts &nbsp; ✓ Weather-driven risk forecasts &nbsp; ✓ Natural gas market changes<br>
    ✓ Early warning signals &nbsp; ✓ Operational recommendations
  </p>
</td></tr>

<!-- FOOTER -->
<tr><td style="background:#0a0f1a;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center;">
  <p style="margin:0 0 6px;font-size:10px;color:#334155;line-height:1.5;">Texas Grid Intel · Texas Energy Operations Intelligence<br>You are receiving this because you subscribed to the Texas Energy Risk Brief.</p>
  <p style="margin:0 0 6px;font-size:10px;color:#1e293b;">Texas Grid Intel · Houston, TX 77002</p>
  <p style="margin:0 0 8px;"><a href="{unsub_url}" style="font-size:10px;color:#475569;text-decoration:underline;">Unsubscribe</a></p>
  <p style="margin:0;font-size:9px;color:#1e293b;line-height:1.5;">Texas Grid Intel provides informational operational intelligence only. This newsletter does not constitute investment, trading, financial, legal, procurement, or operational advice. Data sourced from ERCOT, NOAA, and EIA public feeds.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""


def build_text_email(content: dict, current: dict) -> str:
    """Plain text version."""
    risk      = current.get("risk_score", "low").upper()
    ercot_raw = current.get("ercot_price")
    ercot_str = _fmt_ercot(float(ercot_raw) if ercot_raw else None)
    watch     = "\n".join(f"  • {item}" for item in (content.get("watch_items") or []))

    return f"""TEXAS ENERGY RISK BRIEF
Weekly Operational Intelligence for Texas Energy Markets

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{content.get("executive_summary", "")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT CONDITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Texas Risk Level:     {risk}
ERCOT Houston Hub:    {ercot_str}
Recommended Action:   {content.get("recommended_action", "No action required.")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT CHANGED THIS WEEK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{content.get("what_changed", "")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT TO WATCH THIS WEEK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{watch}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPERATIONAL OUTLOOK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exposure:    {content.get("operational_exposure", "")}
Monitor:     {content.get("monitoring_focus", "")}
Escalation:  {content.get("escalation_triggers", "")}
Outlook:     {content.get("outlook_note", "")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
View live conditions: https://texasgridintel.com/dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TX Energy Risk provides informational operational intelligence only.
Not investment, trading, financial, or procurement advice.
To unsubscribe: https://texasgridintel.com/unsubscribe
"""


# ---------------------------------------------------------------------------
# SAVE DRAFT TO SUPABASE
# ---------------------------------------------------------------------------

async def generate_and_save_draft() -> str:
    """Full generation flow — returns the new issue ID."""
    log.info("[NEWSLETTER] Starting weekly draft generation")

    current  = _fetch_latest_snapshot("Houston")
    prior    = _fetch_prior_week_snapshot("Houston")
    week     = _fetch_week_snapshots("Houston")
    regional = _fetch_regional_snapshots()

    # ── Pull live data to make each week genuinely different ──────────────
    # 1. Live ERCOT hub prices
    try:
        from services.grid_conditions import fetch_grid_conditions
        grid = await fetch_grid_conditions()
        hub_prices = grid.get("hub_prices", {})
        if hub_prices.get("HB_HOUSTON"):
            current["ercot_price"] = hub_prices["HB_HOUSTON"]
        current["hub_prices"] = hub_prices
        current["grid_demand_gw"]  = grid.get("demand_gw")
        current["grid_reserve_pct"] = grid.get("reserve_pct")
        current["wind_pct"]  = grid.get("wind_pct")
        current["solar_pct"] = grid.get("solar_pct")
        log.info(f"[NEWSLETTER] Live grid data: ERCOT=${current.get('ercot_price')}, demand={current.get('grid_demand_gw')} GW")
    except Exception as e:
        log.warning(f"[NEWSLETTER] Grid conditions fetch failed: {e}")

    # 2. Live Henry Hub price
    try:
        from services.signal_engine import run_all_signals
        signals = await run_all_signals("Houston")
        hh = signals.get("henry_hub", {})
        if hh.get("price"):
            current["henry_hub_price"] = hh["price"]
            current["henry_hub_change_pct"] = hh.get("change_pct", 0)
            current["henry_hub_market_state"] = hh.get("market_state", "normal")
            log.info(f"[NEWSLETTER] Henry Hub: ${hh['price']}/MMBtu")
    except Exception as e:
        log.warning(f"[NEWSLETTER] Henry Hub fetch failed: {e}")

    # 3. Fallback: fetch ERCOT price directly if still missing
    if not current.get("ercot_price"):
        try:
            from services.external_apis import fetch_ercot_prices
            prices = await fetch_ercot_prices(hours=2)
            if prices:
                latest_price = prices[-1].get("price_mwh") if isinstance(prices[-1], dict) else getattr(prices[-1], "price_mwh", None)
                if latest_price and latest_price > 0:
                    current["ercot_price"] = latest_price
        except Exception as e:
            log.warning(f"[NEWSLETTER] ERCOT fallback fetch failed: {e}")

    content  = await generate_newsletter_content(current, prior, week, regional)

    html_content = build_html_email(content, current, regional, "{{issue_id}}")
    text_content = build_text_email(content, current)

    sb = get_supabase()
    result = sb.table("newsletter_issues").insert({
        "issue_date":        datetime.now(timezone.utc).date().isoformat(),
        "subject":           content.get("subject", f"Texas Energy Risk Brief — Week of {datetime.now().strftime('%B %d, %Y')}"),
        "preview_text":      content.get("preview_text", ""),
        "risk_level":        current.get("risk_score", "low"),
        "market_state":      "Stable",
        "ercot_price":       current.get("ercot_price"),
        "weather_demand":    current.get("weather_demand_pressure", "low"),
        "gas_supply":        current.get("gas_supply_pressure", "low"),
        # Fix field mapping: AI returns exec_outlook, save as executive_summary
        "executive_summary": content.get("exec_outlook") or content.get("executive_summary", ""),
        "what_changed":      content.get("what_changed_explanation") or content.get("what_changed", ""),
        "watch_items":       json.dumps(content.get("watch_items", [])),
        "ai_outlook":        json.dumps({
            "recommended_action":   content.get("exec_recommendation") or content.get("recommended_action"),
            "primary_driver":       content.get("exec_primary_driver"),
            "expected_outlook":     content.get("exec_expected_outlook"),
            "ercot_24h":            content.get("ercot_24h"),
            "ercot_72h":            content.get("ercot_72h"),
            "escalation_pct":       content.get("ew_escalation_pct"),
        }),
        "regional_snapshot": json.dumps(regional),
        "html_content":      html_content,
        "text_content":      text_content,
        "status":            "draft",
    }).execute()

    issue_id = result.data[0]["id"]
    log.info(f"[NEWSLETTER] Draft saved — issue_id={issue_id}")
    return issue_id
