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
          .select("risk_score, risk_numeric, computed_at, ercot_price, henry_hub")
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
    risk       = current.get("risk_score", "low")
    ercot      = current.get("ercot_price", 0) or 0
    prior_ercot = prior.get("ercot_price", ercot) or ercot
    price_delta = ercot - prior_ercot

    # Week trend
    scores     = [s.get("risk_numeric", 2.0) for s in week_snapshots if s.get("risk_numeric")]
    avg_score  = sum(scores) / len(scores) if scores else 2.0
    peak_score = max(scores) if scores else 2.0

    # Regional summary
    region_lines = "\n".join(
        f"- {r}: {d.get('risk_score', 'unknown').upper()}"
        for r, d in regional.items()
    )

    return f"""You are the editorial AI for the Texas Energy Risk Brief — a weekly operational intelligence newsletter for Texas energy executives, procurement teams, and operations managers.

Write a professional, concise weekly newsletter brief. Use operational language only.

STRICT RULES:
- No investment advice, trading recommendations, or procurement instructions
- No price predictions stated as certainty
- Use: "may indicate", "conditions suggest", "monitor", "no action required", "enhanced monitoring recommended"
- Avoid: "buy", "sell", "will spike", "guaranteed", "profit", "investment opportunity"
- Tone: executive, operational, concise, credible
- This is informational intelligence — not advice

Current Texas Conditions (Houston as primary reference):
- Risk Level: {risk.upper()}
- ERCOT Houston Hub: ${ercot:.2f}/MWh
- Prior week ERCOT: ${prior_ercot:.2f}/MWh (change: {'+' if price_delta >= 0 else ''}{price_delta:.2f})
- Week avg risk score: {avg_score:.1f}/10 | Peak: {peak_score:.1f}/10
- Weather Demand: {current.get('weather_demand_pressure', 'low').upper()}
- Gas Supply: {current.get('gas_supply_pressure', 'low').upper()}
- Gas Storage vs 5yr avg: {current.get('gas_storage_vs_avg', 'N/A')}%

Regional Risk States:
{region_lines}

Return ONLY valid JSON — no markdown, no preamble:
{{
  "subject": "Texas Energy Risk Brief — [Week ending date, e.g. May 30, 2026]",
  "preview_text": "One sentence, 90 chars max. Operational summary.",
  "executive_summary": "2-3 sentences. Current operational posture. Recommended monitoring stance. No hype.",
  "what_changed": "2-3 sentences comparing this week to last week. Factual changes only.",
  "watch_items": ["3-5 specific watch items for this week. Operational. Specific metrics and thresholds."],
  "recommended_action": "One sentence. 'No action required.' or 'Enhanced monitoring recommended.' or 'Operational review recommended.'",
  "operational_exposure": "One sentence. Current cost/supply exposure level.",
  "monitoring_focus": "One sentence. What to specifically track and when.",
  "escalation_triggers": "One sentence. Specific thresholds that would change the posture.",
  "outlook_note": "1-2 sentences. Operational outlook for the coming week. Cautious language only."
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
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw  = msg.content[0].text.strip()
        data = json.loads(raw)
        log.info("[NEWSLETTER] AI content generated successfully")
        return data
    except Exception as e:
        log.error(f"[NEWSLETTER] AI generation failed: {e}")
        return _fallback_content(current, prior)


def _fallback_content(current: dict, prior: dict) -> dict:
    """Rule-based fallback if AI is unavailable."""
    risk   = current.get("risk_score", "low")
    ercot  = current.get("ercot_price", 0) or 0
    action = (
        "Operational review recommended." if risk == "high" else
        "Enhanced monitoring recommended." if risk == "medium" else
        "No action required."
    )
    return {
        "subject":              f"Texas Energy Risk Brief — Week of {datetime.now().strftime('%B %d, %Y')}",
        "preview_text":         f"Texas operations remain {risk} risk. ERCOT at ${ercot:.2f}/MWh.",
        "executive_summary":    f"Current Texas energy conditions indicate {risk} operational risk. ERCOT Houston Hub pricing at ${ercot:.2f}/MWh. {action}",
        "what_changed":         "Conditions were stable this week relative to the prior period. No material changes detected.",
        "watch_items":          [
            "ERCOT pricing during the 14:00–19:00 CDT afternoon peak window",
            "Temperature forecasts — escalation watch above 95°F",
            "Henry Hub pricing — watch threshold $3.00/MMBtu",
            "EIA weekly gas storage report",
        ],
        "recommended_action":   action,
        "operational_exposure": "Minimal operational exposure detected under current conditions.",
        "monitoring_focus":     "Monitor ERCOT 5-minute LMP during the afternoon demand window.",
        "escalation_triggers":  "Risk may increase if ERCOT exceeds $35/MWh or temperatures exceed 95°F.",
        "outlook_note":         "Conditions are expected to remain stable barring significant weather or supply disruptions.",
    }


# ---------------------------------------------------------------------------
# BUILD HTML EMAIL
# ---------------------------------------------------------------------------

def build_html_email(content: dict, current: dict, regional: dict[str, dict], issue_id: str) -> str:
    """Build the full HTML email from newsletter content."""
    risk       = current.get("risk_score", "low")
    ercot      = current.get("ercot_price", 0) or 0
    risk_color = "#ef4444" if risk == "high" else "#f59e0b" if risk == "medium" else "#10b981"

    watch_items_html = "".join(
        f'<tr><td style="padding:6px 0;border-bottom:1px solid #1e293b;font-size:13px;color:#94a3b8;">• {item}</td></tr>'
        for item in (content.get("watch_items") or [])
    )

    region_rows = "".join(
        f'''<tr>
            <td style="padding:5px 8px;font-size:12px;color:#94a3b8;">{region}</td>
            <td style="padding:5px 8px;font-size:12px;font-weight:700;color:{"#ef4444" if data.get("risk_score") == "high" else "#f59e0b" if data.get("risk_score") == "medium" else "#10b981"};">
              {(data.get("risk_score") or "unknown").upper()}
            </td>
          </tr>'''
        for region, data in regional.items()
    )

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
            <tr><td style="font-size:16px;font-weight:900;color:#f97316;">${ercot:.2f}/MWh</td></tr>
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
    risk  = current.get("risk_score", "low").upper()
    ercot = current.get("ercot_price", 0) or 0
    watch = "\n".join(f"  • {item}" for item in (content.get("watch_items") or []))

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
ERCOT Houston Hub:    ${ercot:.2f}/MWh
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
View live conditions: https://texas-energy-risk.vercel.app/dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TX Energy Risk provides informational operational intelligence only.
Not investment, trading, financial, or procurement advice.
To unsubscribe: https://texas-energy-risk.vercel.app/unsubscribe
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
