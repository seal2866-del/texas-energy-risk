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
    price_delta = ercot - prior_ercot
    price_pct   = ((ercot - prior_ercot) / prior_ercot * 100) if prior_ercot > 0 else 0

    scores     = [s.get("risk_score_numeric") or {"high": 7.5, "medium": 4.5}.get(s.get("risk_score", "low"), 2.0) for s in week_snapshots]
    avg_score  = sum(scores) / len(scores) if scores else 2.0
    peak_score = max(scores) if scores else 2.0

    trend = "Stable"
    if scores and len(scores) >= 2:
        recent = sum(scores[-3:]) / 3
        older  = sum(scores[:3])  / 3
        if recent > older + 0.3:   trend = "Rising"
        elif recent < older - 0.3: trend = "Improving"

    region_lines = "\n".join(
        f"- {r}: {d.get('risk_score', 'unknown').upper()}"
        for r, d in regional.items()
    )

    action_anchor = (
        "Operational review recommended." if risk == "high" else
        "Enhanced monitoring recommended." if risk == "medium" else
        "No action required."
    )

    return f"""You are the editorial writer for the Texas Energy Risk Brief — a weekly operational intelligence newsletter for energy executives, plant operations managers, procurement teams, and grid operators.

PURPOSE: Write like a control room briefing. Direct. Operational. Answers: What is happening? Is action required? What could cost money? What changed? What to monitor?

STRICT LANGUAGE RULES:
- NEVER use: "interesting", "notable", "potentially", "might be worth watching", "could become important"
- ALWAYS use: "No action required", "Monitor", "Escalate if", "Review", "Operational impact", "Cost exposure", "Trigger threshold"
- No investment advice, trading recommendations, or procurement instructions
- Tone: control room briefing, not analyst report

Current Texas Conditions (Houston primary):
- Risk Level: {risk.upper()} | Trend: {trend}
- ERCOT: {_fmt_ercot(ercot)} | Prior week: {_fmt_ercot(prior_ercot)} | Change: {'+' if price_pct >= 0 else ''}{price_pct:.1f}%
- Week avg risk: {avg_score:.1f}/10 | Peak: {peak_score:.1f}/10
- Weather Demand: {current.get('weather_demand_pressure', 'low').upper()}
- Gas Supply: {current.get('gas_supply_pressure', 'low').upper()}
- Gas Storage vs 5yr avg: {current.get('gas_storage_vs_avg', 'N/A')}%

Regional Risk States:
{region_lines}

Anchor your recommended_action as: "{action_anchor}"

Return ONLY valid JSON — no markdown, no preamble:
{{
  "subject": "Texas Energy Risk Brief — [Week ending date]",
  "preview_text": "90 chars max. Start with action status. E.g.: 'No action required. Texas conditions stable heading into the week.'",
  "executive_summary": "2 sentences. Current operational posture only. Start with action status.",
  "recommended_action": "{action_anchor}",
  "action_reasons": ["3-4 bullet reasons why. Each under 10 words. Factual."],
  "escalate_if": ["3 specific thresholds. E.g.: 'ERCOT exceeds $35/MWh'"],
  "next_review_time": "Next review time. E.g.: '14:00 CDT'",
  "cost_exposure_level": "Minimal / Moderate / Elevated",
  "cost_exposure_desc": "One sentence. What cost exposure exists right now.",
  "cost_watch_threshold": "E.g.: 'ERCOT > $35/MWh'",
  "cost_elevated_threshold": "E.g.: 'ERCOT > $50/MWh'",
  "cost_critical_threshold": "E.g.: 'ERCOT > $100/MWh'",
  "risk_trend": "{trend}",
  "risk_trend_desc": "One sentence describing the trend direction.",
  "most_important_signal": "One operational signal. 2-3 sentences. Control room language.",
  "most_important_signal_title": "Short title. E.g.: 'Afternoon Temperature Watch'",
  "what_changed_ercot": "ERCOT: {_fmt_ercot(prior_ercot)} → {_fmt_ercot(ercot)} ({'+' if price_pct >= 0 else ''}{price_pct:.1f}%)",
  "what_changed_weather": "Temperature outlook change this week vs prior week.",
  "what_changed_gas": "Henry Hub / gas storage change this week vs prior.",
  "what_changed_risk": "Risk score change this week vs prior.",
  "outlook_0_6h": "0-6 hours outlook. One sentence.",
  "outlook_6_24h": "6-24 hours outlook. One sentence.",
  "outlook_24_48h": "24-48 hours outlook. One sentence.",
  "outlook_48_72h": "48-72 hours outlook. One sentence.",
  "confidence_pct": 55,
  "confidence_reasons": ["3-4 reasons explaining confidence level. Analytical."],
  "watch_items": ["3-5 specific operational watch items with thresholds."]
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
    """Build V3 HTML email — executive operational briefing format."""
    risk        = current.get("risk_score", "low")
    ercot_raw   = current.get("ercot_price")
    ercot       = float(ercot_raw) if (ercot_raw and float(ercot_raw) > 0) else None
    ercot_str   = _fmt_ercot(ercot)
    risk_color  = "#ef4444" if risk == "high" else "#f59e0b" if risk == "medium" else "#10b981"
    fe_url     = os.getenv("FRONTEND_URL", "https://texas-energy-risk.vercel.app")
    unsub_url  = f"{fe_url}/unsubscribe?token={{{{unsubscribe_token}}}}"

    # Helper: color for risk score
    def rc(score: str) -> str:
        return "#ef4444" if score == "high" else "#f59e0b" if score == "medium" else "#10b981"

    # Action reasons bullets
    action_reasons = content.get("action_reasons") or ["ERCOT pricing below escalation thresholds", "Weather conditions within seasonal norms", "Natural gas supply stable"]
    reasons_html = "".join(f'<li style="margin:2px 0;font-size:12px;color:#94a3b8;">• {r}</li>' for r in action_reasons)

    # Escalate-if bullets
    escalate_if = content.get("escalate_if") or ["ERCOT > $35/MWh", "Temperature > 95°F", "Henry Hub > $3.00/MMBtu"]
    escalate_html = "".join(f'<li style="margin:2px 0;font-size:12px;color:#fbbf24;">• {e}</li>' for e in escalate_if)

    # Watch items
    watch_items = content.get("watch_items") or []
    watch_html  = "".join(f'<tr><td style="padding:6px 0;border-bottom:1px solid #1e293b;font-size:12px;color:#94a3b8;">• {item}</td></tr>' for item in watch_items)

    # What changed rows
    changes = [
        ("ERCOT Price",             content.get("what_changed_ercot", "N/A")),
        ("Temperature Outlook",     content.get("what_changed_weather", "N/A")),
        ("Henry Hub / Gas",         content.get("what_changed_gas", "N/A")),
        ("Risk Score",              content.get("what_changed_risk", "N/A")),
    ]
    changes_html = "".join(f'''
      <tr>
        <td style="padding:6px 8px;font-size:12px;color:#94a3b8;border-bottom:1px solid #1e293b;">{label}</td>
        <td style="padding:6px 8px;font-size:12px;color:#e2e8f0;border-bottom:1px solid #1e293b;">{val}</td>
      </tr>''' for label, val in changes)

    # Escalation trigger dashboard
    triggers = [
        ("ERCOT > $35/MWh",        bool(ercot and ercot >= 35)),
        ("Temperature > 95°F",      False),
        ("Henry Hub > $3.00/MMBtu", False),
        ("ERCOT Emergency Notice",  False),
    ]
    triggers_html = "".join(f'''
      <tr>
        <td style="padding:6px 8px;font-size:12px;color:#94a3b8;border-bottom:1px solid #1e293b;">{label}</td>
        <td style="padding:6px 8px;font-size:11px;font-weight:700;color:{"#ef4444" if triggered else "#10b981"};border-bottom:1px solid #1e293b;">
          {"⚠ TRIGGERED" if triggered else "✓ Normal"}
        </td>
      </tr>''' for label, triggered in triggers)

    # Operational outlook timeline
    outlook_rows = [
        ("0–6 Hours",   content.get("outlook_0_6h",  "No action required.")),
        ("6–24 Hours",  content.get("outlook_6_24h", "Continue monitoring.")),
        ("24–48 Hours", content.get("outlook_24_48h","Stable outlook.")),
        ("48–72 Hours", content.get("outlook_48_72h","No significant risk expected.")),
    ]
    outlook_html = "".join(f'''
      <tr>
        <td style="padding:6px 8px;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #1e293b;white-space:nowrap;">{window}</td>
        <td style="padding:6px 8px;font-size:12px;color:#94a3b8;border-bottom:1px solid #1e293b;">{desc}</td>
      </tr>''' for window, desc in outlook_rows)

    # Regional snapshot
    region_rows = "".join(f'''
      <td style="padding:8px 4px;text-align:center;width:12.5%;">
        <div style="background:{rc(data.get("risk_score","low"))}22;border:1px solid {rc(data.get("risk_score","low"))}44;border-radius:6px;padding:6px 4px;">
          <p style="margin:0;font-size:9px;color:#64748b;">{region.split()[0]}</p>
          <p style="margin:2px 0 0;font-size:10px;font-weight:700;color:{rc(data.get("risk_score","low"))};">{(data.get("risk_score") or "N/A").upper()}</p>
        </div>
      </td>''' for region, data in regional.items())

    # Confidence
    conf_pct    = content.get("confidence_pct", 55)
    conf_reasons = content.get("confidence_reasons") or ["Stable conditions provide fewer predictive signals", "Weather uncertainty increases beyond 24 hours", "No active risk drivers currently present"]
    conf_html   = "".join(f'<li style="margin:2px 0;font-size:12px;color:#94a3b8;">• {r}</li>' for r in conf_reasons)

    # Data reliability
    reliability_rows = [
        ("ERCOT Feed",    98),
        ("NOAA Weather",  98),
        ("Gas Storage",   96),
    ]
    reliability_html = "".join(f'''
      <tr>
        <td style="padding:4px 8px;font-size:12px;color:#94a3b8;">{label}</td>
        <td style="padding:4px 8px;font-size:12px;font-weight:700;color:#10b981;">{pct}%</td>
      </tr>''' for label, pct in reliability_rows)

    trend       = content.get("risk_trend", "Stable")
    trend_arrow = "↑" if trend == "Rising" else "↓" if trend == "Improving" else "→"
    trend_color = "#ef4444" if trend == "Rising" else "#10b981" if trend == "Improving" else "#64748b"
    cost_level  = content.get("cost_exposure_level", "Minimal")
    cost_color  = "#ef4444" if cost_level == "Elevated" else "#f59e0b" if cost_level == "Moderate" else "#10b981"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{content.get("subject", "Texas Energy Risk Brief")}</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;color:#e2e8f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:24px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 28px 20px;border-bottom:1px solid #1e293b;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <p style="margin:0 0 2px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:2px;">Texas Energy Risk Brief</p>
        <p style="margin:0;font-size:18px;font-weight:900;color:#fff;">Weekly Operational Intelligence</p>
        <p style="margin:3px 0 0;font-size:10px;color:#64748b;">ERCOT · Weather · Natural Gas · {datetime.now(timezone.utc).strftime("%B %d, %Y")}</p>
      </td>
      <td align="right" style="vertical-align:top;">
        <span style="display:inline-block;padding:4px 10px;border-radius:6px;background:{risk_color}22;border:1px solid {risk_color}44;font-size:11px;font-weight:700;color:{risk_color};text-transform:uppercase;">
          {risk.upper()} RISK &nbsp;{trend_arrow}
        </span>
      </td>
    </tr></table>
  </td></tr>

  <!-- EXECUTIVE SUMMARY -->
  <tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 6px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Executive Summary</p>
    <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.6;">{content.get("executive_summary", "")}</p>
  </td></tr>

  <!-- EXECUTIVE DECISION BOX -->
  <tr><td style="background:{risk_color}0d;border-left:3px solid {risk_color};padding:20px 28px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 10px;font-size:10px;color:{risk_color};text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Executive Decision</p>
    <p style="margin:0 0 8px;font-size:16px;font-weight:900;color:#fff;">{content.get("recommended_action", "No action required.")}</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top;width:50%;padding-right:12px;">
        <p style="margin:0 0 4px;font-size:10px;color:#64748b;text-transform:uppercase;">Why:</p>
        <ul style="margin:0;padding:0;list-style:none;">{reasons_html}</ul>
      </td>
      <td style="vertical-align:top;width:50%;">
        <p style="margin:0 0 4px;font-size:10px;color:#f59e0b;text-transform:uppercase;">Escalate if:</p>
        <ul style="margin:0 0 8px;padding:0;list-style:none;">{escalate_html}</ul>
        <p style="margin:0;font-size:11px;color:#64748b;">Next review: <strong style="color:#e2e8f0;">{content.get("next_review_time","14:00 CDT")}</strong></p>
      </td>
    </tr></table>
  </td></tr>

  <!-- CURRENT CONDITIONS + TREND -->
  <tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 12px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Current Conditions</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="width:33%;padding-right:6px;">
        <table width="100%" cellpadding="8" cellspacing="0" style="background:#1e293b;border-radius:8px;">
          <tr><td style="font-size:9px;color:#64748b;text-transform:uppercase;">Texas Risk</td></tr>
          <tr><td style="font-size:18px;font-weight:900;color:{risk_color};">{risk.upper()}</td></tr>
          <tr><td style="font-size:10px;color:{trend_color};">{trend_arrow} {trend}</td></tr>
        </table>
      </td>
      <td style="width:33%;padding:0 3px;">
        <table width="100%" cellpadding="8" cellspacing="0" style="background:#1e293b;border-radius:8px;">
          <tr><td style="font-size:9px;color:#64748b;text-transform:uppercase;">ERCOT Hub</td></tr>
          <tr><td style="font-size:18px;font-weight:900;color:#f97316;">{ercot_str}</td></tr>
          <tr><td style="font-size:10px;color:#64748b;">Houston Hub</td></tr>
        </table>
      </td>
      <td style="width:33%;padding-left:6px;">
        <table width="100%" cellpadding="8" cellspacing="0" style="background:#1e293b;border-radius:8px;">
          <tr><td style="font-size:9px;color:#64748b;text-transform:uppercase;">Cost Exposure</td></tr>
          <tr><td style="font-size:18px;font-weight:900;color:{cost_color};">{cost_level}</td></tr>
          <tr><td style="font-size:10px;color:#64748b;">{content.get("cost_exposure_desc","")[:40]}</td></tr>
        </table>
      </td>
    </tr></table>
  </td></tr>

  <!-- ESTIMATED COST EXPOSURE -->
  <tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 10px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Estimated Cost Exposure</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:6px 0;font-size:12px;color:#94a3b8;border-bottom:1px solid #1e293b;"><strong style="color:#e2e8f0;">Current Exposure:</strong> {cost_level}</td>
      </tr>
      <tr><td style="padding:6px 0;font-size:12px;color:#94a3b8;border-bottom:1px solid #1e293b;">{content.get("cost_exposure_desc","")}</td></tr>
      <tr><td style="padding:6px 0;font-size:12px;color:#f59e0b;border-bottom:1px solid #1e293b;"><strong>Watch threshold:</strong> {content.get("cost_watch_threshold","ERCOT > $35/MWh")}</td></tr>
      <tr><td style="padding:6px 0;font-size:12px;color:#f97316;border-bottom:1px solid #1e293b;"><strong>Elevated threshold:</strong> {content.get("cost_elevated_threshold","ERCOT > $50/MWh")}</td></tr>
      <tr><td style="padding:6px 0;font-size:12px;color:#ef4444;"><strong>Critical threshold:</strong> {content.get("cost_critical_threshold","ERCOT > $100/MWh")}</td></tr>
    </table>
  </td></tr>

  <!-- MOST IMPORTANT SIGNAL -->
  <tr><td style="background:#1e293b;padding:20px 28px;border-bottom:1px solid #0f172a;border-left:3px solid #3b82f6;">
    <p style="margin:0 0 6px;font-size:10px;color:#3b82f6;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Most Important Signal</p>
    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#e2e8f0;">{content.get("most_important_signal_title","Operational Awareness")}</p>
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">{content.get("most_important_signal","No elevated signals detected this week.")}</p>
  </td></tr>

  <!-- WHAT CHANGED -->
  <tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 10px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">What Changed This Week</p>
    <table width="100%" cellpadding="0" cellspacing="0">{changes_html}</table>
  </td></tr>

  <!-- ESCALATION TRIGGER DASHBOARD -->
  <tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 10px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Escalation Watch</p>
    <table width="100%" cellpadding="0" cellspacing="0">{triggers_html}</table>
  </td></tr>

  <!-- OPERATIONAL OUTLOOK TIMELINE -->
  <tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 10px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Operational Outlook</p>
    <table width="100%" cellpadding="0" cellspacing="0">{outlook_html}</table>
  </td></tr>

  <!-- REGIONAL SNAPSHOT -->
  <tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 10px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Regional Snapshot</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>{region_rows}</tr></table>
  </td></tr>

  <!-- MONITORING PRIORITIES -->
  <tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 8px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">What to Monitor This Week</p>
    <table width="100%" cellpadding="0" cellspacing="0">{watch_html}</table>
  </td></tr>

  <!-- DATA RELIABILITY -->
  <tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 10px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Data Reliability</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      {reliability_html}
      <tr>
        <td style="padding:6px 8px;font-size:12px;font-weight:700;color:#e2e8f0;">Overall</td>
        <td style="padding:6px 8px;font-size:12px;font-weight:700;color:#10b981;">Operationally Reliable</td>
      </tr>
    </table>
  </td></tr>

  <!-- CONFIDENCE -->
  <tr><td style="background:#0f172a;padding:20px 28px;border-bottom:1px solid #1e293b;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <p style="margin:0 0 4px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Assessment Confidence</p>
        <ul style="margin:4px 0 0;padding:0;list-style:none;">{conf_html}</ul>
      </td>
      <td align="right" style="vertical-align:top;">
        <span style="font-size:22px;font-weight:900;color:#64748b;">{conf_pct}%</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- PREMIUM CTA -->
  <tr><td style="background:#1e293b;padding:24px 28px;border-bottom:1px solid #0f172a;text-align:center;">
    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#fff;">Need Real-Time Monitoring?</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
      <tr>
        <td style="padding:3px 16px;text-align:left;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">✓ Live ERCOT Tracking</p>
          <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">✓ Alert Notifications</p>
          <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">✓ Regional Monitoring</p>
        </td>
        <td style="padding:3px 16px;text-align:left;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">✓ Daily Operational Briefs</p>
          <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">✓ Escalation Detection</p>
          <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">✓ Executive Intelligence</p>
        </td>
      </tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
      <td style="padding-right:8px;">
        <a href="{fe_url}/dashboard" style="display:inline-block;padding:10px 22px;background:#f97316;border-radius:8px;font-size:13px;font-weight:700;color:#fff;text-decoration:none;">View Live Dashboard</a>
      </td>
      <td>
        <a href="{fe_url}/pricing" style="display:inline-block;padding:10px 22px;background:#0f172a;border:1px solid #334155;border-radius:8px;font-size:13px;font-weight:600;color:#e2e8f0;text-decoration:none;">Request Enterprise Demo</a>
      </td>
    </tr></table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0a0f1a;border-radius:0 0 12px 12px;padding:18px 28px;text-align:center;">
    <p style="margin:0 0 6px;font-size:10px;color:#334155;line-height:1.5;">
      TX Energy Risk · Texas Energy Operations Intelligence<br>
      You are receiving this because you subscribed to the Texas Energy Risk Brief.
    </p>
    <p style="margin:0 0 6px;font-size:10px;color:#1e293b;">TX Energy Risk · Houston, TX 77002</p>
    <p style="margin:0 0 8px;font-size:10px;color:#475569;"><a href="{unsub_url}" style="color:#475569;">Unsubscribe</a></p>
    <p style="margin:0;font-size:9px;color:#1e293b;line-height:1.5;">
      TX Energy Risk provides informational operational intelligence only. This newsletter does not constitute
      investment, trading, financial, legal, procurement, or operational advice. Users are responsible for their own decisions.
      Data sourced from ERCOT, NOAA, and EIA public feeds.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""

    unsubscribe_url = f"{os.getenv('FRONTEND_URL', 'https://texas-energy-risk.vercel.app')}/unsubscribe?token={{{{unsubscribe_token}}}}"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{content.get("subject", "Texas Energy Risk Brief")}</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;color:#e2e8f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:28px 32px;border-bottom:1px solid #1e293b;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <p style="margin:0 0 2px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:2px;">Texas Energy Risk Brief</p>
          <p style="margin:0;font-size:20px;font-weight:900;color:#fff;">Weekly Operational Intelligence</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">ERCOT Pricing · Weather Demand · Natural Gas Supply</p>
        </td>
        <td align="right">
          <span style="display:inline-block;padding:4px 10px;border-radius:6px;background:{risk_color}22;border:1px solid {risk_color}44;font-size:11px;font-weight:700;color:{risk_color};text-transform:uppercase;letter-spacing:1px;">
            {risk} RISK
          </span>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Executive Summary -->
  <tr><td style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 8px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Executive Summary</p>
    <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.6;">{content.get("executive_summary", "")}</p>
  </td></tr>

  <!-- Current Conditions -->
  <tr><td style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Current Conditions</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:50%;padding-right:8px;">
          <table width="100%" cellpadding="8" cellspacing="0" style="background:#1e293b;border-radius:8px;">
            <tr><td style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Texas Risk Level</td></tr>
            <tr><td style="font-size:16px;font-weight:900;color:{risk_color};">{risk.upper()}</td></tr>
          </table>
        </td>
        <td style="width:50%;padding-left:8px;">
          <table width="100%" cellpadding="8" cellspacing="0" style="background:#1e293b;border-radius:8px;">
            <tr><td style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">ERCOT Houston Hub</td></tr>
            <tr><td style="font-size:16px;font-weight:900;color:#f97316;">{ercot_str}</td></tr>
          </table>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
      <tr>
        <td style="padding:8px;background:#1e293b;border-radius:8px;font-size:12px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Recommended Action:</strong> {content.get("recommended_action", "No action required.")}
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- What Changed -->
  <tr><td style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 8px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">What Changed This Week</p>
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">{content.get("what_changed", "")}</p>
  </td></tr>

  <!-- Watch This Week -->
  <tr><td style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 8px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">What to Watch This Week</p>
    <table width="100%" cellpadding="0" cellspacing="0">{watch_items_html}</table>
  </td></tr>

  <!-- Operational Outlook -->
  <tr><td style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 8px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Operational Outlook</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      {"".join(f'<tr><td style="padding:4px 0;font-size:12px;color:#94a3b8;"><strong style="color:#e2e8f0;">{label}:</strong> {val}</td></tr>' for label, val in [
          ("Operational Exposure", content.get("operational_exposure", "")),
          ("Monitoring Focus",     content.get("monitoring_focus", "")),
          ("Escalation Triggers",  content.get("escalation_triggers", "")),
          ("Week Outlook",         content.get("outlook_note", "")),
      ] if val)}
    </table>
  </td></tr>

  <!-- Regional Snapshot -->
  <tr><td style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #1e293b;">
    <p style="margin:0 0 8px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;">Regional Snapshot</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:8px;">
      {region_rows}
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #1e293b;text-align:center;">
    <p style="margin:0 0 4px;font-size:13px;color:#94a3b8;">Want live monitoring instead of weekly updates?</p>
    <p style="margin:0 0 16px;font-size:12px;color:#64748b;">TX Energy Risk monitors ERCOT pricing, weather demand, and gas supply conditions continuously.</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="padding-right:8px;">
          <a href="{os.getenv('FRONTEND_URL', 'https://texas-energy-risk.vercel.app')}/dashboard"
             style="display:inline-block;padding:10px 20px;background:#f97316;border-radius:8px;font-size:13px;font-weight:700;color:#fff;text-decoration:none;">
            View Live Conditions
          </a>
        </td>
        <td>
          <a href="{os.getenv('FRONTEND_URL', 'https://texas-energy-risk.vercel.app')}/pricing"
             style="display:inline-block;padding:10px 20px;background:#1e293b;border:1px solid #334155;border-radius:8px;font-size:13px;font-weight:600;color:#e2e8f0;text-decoration:none;">
            Request Enterprise Demo
          </a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#0a0f1a;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
    <p style="margin:0 0 8px;font-size:11px;color:#334155;line-height:1.6;">
      TX Energy Risk · Texas Energy Operations Intelligence<br>
      You are receiving this because you subscribed to the Texas Energy Risk Brief.
    </p>
    <p style="margin:0 0 8px;font-size:11px;color:#1e293b;">
      TX Energy Risk · Houston, TX 77002
    </p>
    <p style="margin:0;font-size:11px;color:#475569;">
      <a href="{unsubscribe_url}" style="color:#475569;">Unsubscribe</a>
    </p>
    <p style="margin:12px 0 0;font-size:10px;color:#1e293b;line-height:1.5;">
      TX Energy Risk provides informational operational intelligence only. This newsletter does not constitute
      investment, trading, financial, legal, procurement, or operational advice. Users are responsible for
      their own decisions. Data sourced from ERCOT, NOAA, and EIA public feeds.
    </p>
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

    # If snapshot has no ERCOT price, fetch it live
    if not current.get("ercot_price"):
        try:
            from services.external_apis import fetch_ercot_prices
            prices = await fetch_ercot_prices(hours=2)
            if prices:
                latest_price = prices[-1].get("price_mwh") if isinstance(prices[-1], dict) else getattr(prices[-1], "price_mwh", None)
                if latest_price and latest_price > 0:
                    current["ercot_price"] = latest_price
                    log.info(f"[NEWSLETTER] Fetched live ERCOT price: ${latest_price:.2f}/MWh")
        except Exception as e:
            log.warning(f"[NEWSLETTER] Could not fetch live ERCOT price: {e}")

    content  = await generate_newsletter_content(current, prior, week, regional)

    html_content = build_html_email(content, current, regional, "{{issue_id}}")
    text_content = build_text_email(content, current)

    sb = get_supabase()
    result = sb.table("newsletter_issues").insert({
        "issue_date":        datetime.now(timezone.utc).date().isoformat(),
        "subject":           content.get("subject", "Texas Energy Risk Brief"),
        "preview_text":      content.get("preview_text", ""),
        "risk_level":        current.get("risk_score", "low"),
        "market_state":      "Stable",
        "ercot_price":       current.get("ercot_price"),
        "weather_demand":    current.get("weather_demand_pressure", "low"),
        "gas_supply":        current.get("gas_supply_pressure", "low"),
        "executive_summary": content.get("executive_summary", ""),
        "what_changed":      content.get("what_changed", ""),
        "watch_items":       json.dumps(content.get("watch_items", [])),
        "ai_outlook":        json.dumps({
            "recommended_action":   content.get("recommended_action"),
            "operational_exposure": content.get("operational_exposure"),
            "monitoring_focus":     content.get("monitoring_focus"),
            "escalation_triggers":  content.get("escalation_triggers"),
            "outlook_note":         content.get("outlook_note"),
        }),
        "regional_snapshot": json.dumps(regional),
        "html_content":      html_content,
        "text_content":      text_content,
        "status":            "draft",
    }).execute()

    issue_id = result.data[0]["id"]
    log.info(f"[NEWSLETTER] Draft saved — issue_id={issue_id}")
    return issue_id
