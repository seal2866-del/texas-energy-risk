"""
alert_service.py
Complete alert system for TX Energy Risk Alert Platform.
Phases 1-10: delivery, dedup, quiet hours, compliance, data source alerts.

LEGAL: All content is informational only. No investment, trading,
financial, legal, or procurement advice is expressed or implied.
"""
import os
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Tuple
from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
ALERT_FROM     = os.getenv("ALERT_FROM_EMAIL", "onboarding@resend.dev")
RESEND_URL     = "https://api.resend.com/emails"
DASHBOARD_URL  = "https://texasgridintel.com/dashboard"
ALERTS_URL     = "https://texasgridintel.com/alerts"

# ── Twilio / Slack ────────────────────────────────────────────
TWILIO_SID          = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN        = os.getenv("TWILIO_AUTH_TOKEN", "")       # master token fallback
TWILIO_API_KEY_SID  = os.getenv("TWILIO_API_KEY_SID", "")     # SK... API Key SID
TWILIO_API_KEY_SEC  = os.getenv("TWILIO_API_KEY_SECRET", "")  # API Key Secret
TWILIO_FROM         = os.getenv("TWILIO_FROM_NUMBER", "")

COMPLIANCE = (
    "TX Energy Risk provides informational analytics and market intelligence only. "
    "This alert does not constitute investment, trading, financial, legal, or procurement advice. "
    "Users are responsible for their own decisions."
)

LEVEL_RANK  = {"low": 0, "medium": 1, "high": 2}
RISK_COLOR  = {"high": "#ef4444", "medium": "#f59e0b", "low": "#22c55e"}
RISK_LABEL  = {"high": "HIGH RISK", "medium": "MEDIUM RISK", "low": "LOW RISK"}


# ── User preferences ──────────────────────────────────────────

def _get_user_prefs(user_id: str) -> dict:
    try:
        sb = get_supabase()
        r = sb.table("alert_preferences").select("*").eq("user_id", user_id).limit(1).execute()
        return r.data[0] if r.data else {}
    except Exception as exc:
        logger.error("[PREFS] %s", exc)
        return {}


# ── Quiet hours ───────────────────────────────────────────────

def _in_quiet_hours(prefs: dict, risk_level: str) -> bool:
    """True = currently quiet. High risk always breaks quiet hours."""
    if not prefs.get("quiet_hours_enabled", False):
        return False
    if risk_level == "high":
        return False  # high risk overrides quiet hours
    start_str = prefs.get("quiet_start_time", "22:00")
    end_str   = prefs.get("quiet_end_time",   "06:00")
    try:
        try:
            import zoneinfo
            ct = zoneinfo.ZoneInfo("America/Chicago")
            now = datetime.now(ct)
        except Exception:
            now = datetime.now(timezone.utc)
        cur = now.hour * 60 + now.minute
        sh, sm = [int(x) for x in start_str.split(":")]
        eh, em = [int(x) for x in end_str.split(":")]
        s = sh * 60 + sm
        e = eh * 60 + em
        return (cur >= s or cur < e) if s > e else (s <= cur < e)
    except Exception:
        return False


# ── Deduplication ─────────────────────────────────────────────

def _dedup_ok(user_id: str, risk_level: str, primary_driver: str,
              city: str, alert_type: str) -> Tuple[bool, str]:
    """
    Returns (should_send, reason).
    Windows: high=30 min, others=60 min.
    Daily summary: once per calendar day.
    """
    try:
        sb = get_supabase()

        # -- Daily summary: one per day
        if alert_type in ("daily_summary", "weekly_summary"):
            day_start = datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            ).isoformat()
            r = (sb.table("alert_logs")
                 .select("id")
                 .eq("user_id", user_id)
                 .eq("alert_type", alert_type)
                 .gte("created_at", day_start)
                 .limit(1)
                 .execute())
            if r.data:
                return False, "daily_already_sent"
            return True, "daily_not_sent"

        # -- Risk / data-source: dedup window
        minutes = 30 if risk_level == "high" else 60
        cutoff  = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()
        r = (sb.table("alert_logs")
             .select("risk_level, primary_driver, alert_type")
             .eq("user_id", user_id)
             .eq("city", city)
             .gte("created_at", cutoff)
             .order("created_at", desc=True)
             .limit(1)
             .execute())

        if not r.data:
            return True, "no_recent"

        last = r.data[0]
        ll, ld = last.get("risk_level", "low"), last.get("primary_driver", "")

        # Risk escalated -- always send
        if LEVEL_RANK.get(risk_level, 0) > LEVEL_RANK.get(ll, 0):
            return True, "escalated"

        # Same level + same driver within window -- skip
        if ll == risk_level and ld == primary_driver:
            return False, f"deduped_{minutes}min"

        # Driver changed at same or lower level
        if risk_level in ("medium", "high") and primary_driver != ld:
            return True, "driver_changed"

        return False, "no_change"

    except Exception as exc:
        logger.error("[DEDUP] %s", exc)
        return True, "error_allow"


def _get_previous_risk(user_id: str, city: str) -> str:
    try:
        sb = get_supabase()
        r = (sb.table("alert_logs")
             .select("risk_level")
             .eq("user_id", user_id)
             .eq("city", city)
             .eq("alert_type", "risk_change")
             .order("created_at", desc=True)
             .limit(1)
             .execute())
        return r.data[0].get("risk_level", "low") if r.data else "low"
    except Exception:
        return "low"


# ── Alert logging ─────────────────────────────────────────────

def log_alert(
    user_id:              str,
    risk_level:           str,
    confidence:           Optional[int],
    primary_driver:       str,
    city:                 str,
    ercot_price:          Optional[float],
    weather_temp:         Optional[float],
    gas_storage:          Optional[float],
    message:              str,
    alert_type:           str  = "risk_change",
    previous_risk_level:  Optional[str]   = None,
    risk_direction:       Optional[str]   = None,
    source_health_status: Optional[str]   = None,
    delivery_status:      str  = "sent",
    delivered_email:      bool = False,
    delivered_sms:        bool = False,
    voice_sent:           bool = False,
) -> Optional[str]:
    """Log alert to Supabase. Returns inserted row id."""
    try:
        sb = get_supabase()
        row = {
            "user_id":              user_id,
            "alert_type":           alert_type,
            "risk_level":           risk_level,
            "previous_risk_level":  previous_risk_level,
            "confidence":           confidence,
            "primary_driver":       primary_driver,
            "risk_direction":       risk_direction,
            "city":                 city,
            "ercot_price":          ercot_price,
            "weather_temp":         weather_temp,
            "gas_storage":          gas_storage,
            "source_health_status": source_health_status,
            "message":              message,
            "delivery_status":      delivery_status,
            "delivered_email":      delivered_email,
            "delivered_sms":        delivered_sms,
            "voice_sent":           voice_sent,
            "acknowledged":         False,
            "created_at":           datetime.now(timezone.utc).isoformat(),
            "sent_at":              datetime.now(timezone.utc).isoformat(),
            "severity":             risk_level,
            "channel":              "email",
        }
        # Drop None except booleans
        row = {k: v for k, v in row.items()
               if v is not None or isinstance(v, bool)}
        r = sb.table("alert_logs").insert(row).execute()
        if r.data:
            return r.data[0].get("id")
    except Exception as exc:
        logger.error("[LOG] %s", exc)
    return None


# ── Email builders ─────────────────────────────────────────────

def _subject(alert_type: str, risk_level: str = "low") -> str:
    if alert_type == "daily_summary":
        return "TX Energy Intelligence — Daily Operational Summary"
    if alert_type == "weekly_summary":
        return "TX Energy Intelligence — Weekly Operational Summary"
    if alert_type == "data_source":
        return "TX Energy Intelligence — Data Source Degraded · Feed Health Notice"
    if risk_level == "high":
        return "TX Energy Intelligence — Elevated Operational Risk · Immediate Monitoring Warranted"
    if risk_level == "medium":
        return "TX Energy Intelligence — Increased Operational Risk · Monitoring Recommended"
    return "TX Energy Intelligence — Operational Risk Level Update"


def _row(label: str, value: str) -> str:
    return (
        f"<tr>"
        f"<td style='padding:7px 12px 7px 0;color:#9ca3af;font-size:13px;white-space:nowrap;'>{label}</td>"
        f"<td style='padding:7px 0;color:#f3f4f6;font-size:13px;font-weight:600;'>{value}</td>"
        f"</tr>"
    )


def _driver_badge(level: str) -> str:
    colors = {"high": "#ef4444", "medium": "#f59e0b", "low": "#22c55e"}
    c      = colors.get(level, "#6b7280")
    return (
        f"<span style='display:inline-block;background:{c}20;border:1px solid {c}40;"
        f"border-radius:4px;padding:1px 8px;color:{c};font-size:11px;"
        f"font-weight:700;text-transform:uppercase;'>{level}</span>"
    )


def _build_risk_email(
    risk_level:          str,
    previous_risk_level: str,
    confidence:          Optional[int],
    primary_driver:      str,
    risk_direction:      Optional[str],
    time_horizons:       dict,
    city:                str,
    ercot_price:         Optional[float],
    weather_temp:        Optional[float],
    gas_storage:         Optional[float],
    why_it_matters:      str,
    computed_at:         str,
    demand_pressure:     Optional[dict] = None,
    supply_pressure:     Optional[dict] = None,
    market_reaction:     Optional[dict] = None,
    gas_to_power_impact: Optional[dict] = None,
    risk_narrative:      Optional[dict] = None,
    cost_impact:         Optional[dict] = None,
    market_condition:    Optional[dict] = None,
    alert_severity:      Optional[dict] = None,
    ai_reasoning:        Optional[dict] = None,
) -> str:
    color = RISK_COLOR.get(risk_level, "#6b7280")
    label = RISK_LABEL.get(risk_level, risk_level.upper())
    prev_label = previous_risk_level.capitalize() if previous_risk_level else "Unknown"
    direction  = (risk_direction or "stable").capitalize()

    # Phase 11: Alert severity badge
    sev_colors = {"critical": "#ef4444", "elevated": "#f97316", "monitoring": "#f59e0b", "informational": "#6b7280"}
    sev_label  = alert_severity.get("label", "Informational") if alert_severity else "Informational"
    sev_desc   = alert_severity.get("description", "") if alert_severity else ""
    sev_level  = alert_severity.get("level", "informational") if alert_severity else "informational"
    sev_color  = sev_colors.get(sev_level, "#6b7280")

    # Phase 11: Market condition
    mkt_label  = market_condition.get("label", "") if market_condition else ""
    mkt_desc   = market_condition.get("description", "") if market_condition else ""

    # Phase 11: Narrative body
    narrative_body = risk_narrative.get("body", "") if risk_narrative else ""

    # Phase 11: Cost impact
    cost_label = cost_impact.get("label", "") if cost_impact else ""
    cost_desc  = cost_impact.get("description", "") if cost_impact else ""

    rows = ""
    rows += _row("Location", city)
    if previous_risk_level and previous_risk_level != risk_level:
        rows += _row("Changed from", prev_label)
    rows += _row("Primary driver", primary_driver)
    rows += _row("Risk direction", direction)
    if confidence is not None:
        rows += _row("Confidence", f"{confidence}%")
    if ercot_price is not None:
        rows += _row("ERCOT price", f"${ercot_price:.2f}/MWh")
    if weather_temp is not None:
        rows += _row("Forecast high", f"{weather_temp:.0f}&deg;F")
    if gas_storage is not None:
        vs_avg = "below" if gas_storage < 0 else "above"
        rows += _row("Gas storage", f"{abs(gas_storage):.1f}% {vs_avg} 5-yr avg")

    # Driver model rows
    drivers_html = ""
    driver_rows = []
    if demand_pressure:
        driver_rows.append(("Demand Pressure", demand_pressure.get("level", "low"), demand_pressure.get("explanation", "")))
    if supply_pressure:
        driver_rows.append(("Supply Pressure", supply_pressure.get("level", "low"), supply_pressure.get("explanation", "")))
    if market_reaction:
        driver_rows.append(("Market Reaction", market_reaction.get("level", "low"), market_reaction.get("explanation", "")))
    if gas_to_power_impact:
        driver_rows.append(("Gas-to-Power Impact", gas_to_power_impact.get("level", "low"), gas_to_power_impact.get("explanation", "")))

    if driver_rows:
        driver_items = "".join(
            f"<tr><td style='padding:6px 12px 6px 0;color:#9ca3af;font-size:12px;white-space:nowrap;vertical-align:top;'>{name}</td>"
            f"<td style='padding:6px 0;font-size:12px;vertical-align:top;'>{_driver_badge(level)}"
            f"<span style='color:#9ca3af;font-size:12px;margin-left:6px;'>{expl}</span></td></tr>"
            for name, level, expl in driver_rows
        )
        drivers_html = (
            f"<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);"
            f"border-radius:12px;padding:16px 18px;margin-bottom:18px;'>"
            f"<p style='color:#9ca3af;font-size:11px;font-weight:700;text-transform:uppercase;"
            f"letter-spacing:0.08em;margin:0 0 10px;'>ENERGY RISK DRIVERS</p>"
            f"<table style='width:100%;border-collapse:collapse;'>{driver_items}</table>"
            f"</div>"
        )

    short  = time_horizons.get("short_term", "")
    near   = time_horizons.get("near_term",  "")
    outlook = time_horizons.get("outlook",   "")

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060c1a;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:40px 20px;">

  <div style="text-align:center;margin-bottom:28px;">
    <div style="display:inline-block;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);border-radius:20px;padding:6px 18px;margin-bottom:18px;">
      <span style="color:#f97316;font-size:12px;font-weight:700;letter-spacing:0.06em;">TX ENERGY RISK</span>
    </div>
    <h1 style="color:#f3f4f6;font-size:20px;font-weight:900;margin:0 0 6px;">Texas Energy Risk Alert</h1>
    <p style="color:#6b7280;font-size:12px;margin:0;">{city} &middot; {computed_at}</p>
  </div>

  <div style="background:rgba(255,255,255,0.04);border:2px solid {color}40;border-radius:14px;padding:24px;margin-bottom:18px;text-align:center;">
    <p style="color:#9ca3af;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px;">CURRENT RISK LEVEL</p>
    <p style="color:{color};font-size:34px;font-weight:900;margin:0 0 6px;">{label}</p>
    {"<p style='color:#d1d5db;font-size:13px;margin:0 0 10px;'>Increased from <strong>" + prev_label + "</strong></p>" if previous_risk_level and previous_risk_level != risk_level else ""}
    <div style="display:inline-flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;justify-content:center;">
      {"<span style='background:" + sev_color + "20;border:1px solid " + sev_color + "40;border-radius:20px;padding:3px 12px;color:" + sev_color + ";font-size:11px;font-weight:700;'>⚠ " + sev_label + "</span>" if sev_level != "informational" else ""}
      {"<span style='background:#ffffff10;border:1px solid #ffffff20;border-radius:20px;padding:3px 12px;color:#9ca3af;font-size:11px;font-weight:600;'>" + mkt_label + "</span>" if mkt_label else ""}
    </div>
  </div>

  {"<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px 18px;margin-bottom:18px;'><p style='color:#f3f4f6;font-size:14px;line-height:1.7;margin:0;'>" + narrative_body + "</p></div>" if narrative_body else ""}

  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px 20px;margin-bottom:18px;">
    <table style="width:100%;border-collapse:collapse;">
      {rows}
    </table>
  </div>

  {drivers_html}


  {"<div style='background:rgba(20,184,166,0.05);border:1px solid rgba(20,184,166,0.18);border-radius:12px;padding:16px 18px;margin-bottom:18px;'><p style='color:#2dd4bf;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;'>&#129504; AI MARKET REASONING</p><p style='color:#f3f4f6;font-size:13px;font-weight:600;line-height:1.65;margin:0 0 6px;'>" + (ai_reasoning.get("executive_summary","") if ai_reasoning else "") + "</p><p style='color:#9ca3af;font-size:12px;line-height:1.65;margin:0 0 8px;'>" + (ai_reasoning.get("escalation_watch","") if ai_reasoning else "") + "</p><p style='color:#4b5563;font-size:11px;line-height:1.55;margin:0;font-style:italic;'>" + (ai_reasoning.get("recommended_monitoring_focus","") if ai_reasoning else "") + "</p></div>" if ai_reasoning and ai_reasoning.get("executive_summary") else ""}

  {"<div style='background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.18);border-radius:12px;padding:16px 18px;margin-bottom:18px;'><p style='color:#fb923c;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;'>WHY THIS MATTERS</p><p style='color:#d1d5db;font-size:13px;line-height:1.65;margin:0;'>" + why_it_matters + "</p></div>" if why_it_matters else ""}

  {"<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px 18px;margin-bottom:18px;'><p style='color:#9ca3af;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px;'>COST IMPACT INTERPRETATION</p><p style='color:#f59e0b;font-size:12px;font-weight:700;margin:0 0 4px;'>" + cost_label + "</p><p style='color:#9ca3af;font-size:12px;line-height:1.6;margin:0;'>" + cost_desc + "</p></div>" if cost_label else ""}

  {"<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px 18px;margin-bottom:18px;'><p style='color:#9ca3af;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px;'>TIME HORIZON</p>" + ("<p style='color:#e5e7eb;font-size:13px;font-family:monospace;margin:0 0 6px;'>" + short + "</p>" if short else "") + ("<p style='color:#9ca3af;font-size:12px;font-family:monospace;margin:0 0 6px;'>" + near + "</p>" if near else "") + ("<p style='color:#6b7280;font-size:12px;font-family:monospace;margin:0;'>" + outlook + "</p>" if outlook else "") + "</div>" if (short or near or outlook) else ""}

  <div style="text-align:center;margin-bottom:28px;">
    <a href="{DASHBOARD_URL}" style="display:inline-block;background:#f97316;color:#fff;font-weight:700;font-size:14px;padding:13px 30px;border-radius:10px;text-decoration:none;">
      View Live Dashboard &rarr;
    </a>
  </div>

  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:18px;">
    <p style="color:#4b5563;font-size:11px;line-height:1.65;margin:0 0 10px;">{COMPLIANCE}</p>
    <p style="color:#374151;font-size:11px;margin:0;">
      Receiving this because email alerts are enabled on TX Energy Risk. &nbsp;
      <a href="{ALERTS_URL}" style="color:#6b7280;">Manage alerts</a>
    </p>
  </div>

</div>
</body>
</html>"""


def _build_data_source_email(source_name: str, city: str, computed_at: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060c1a;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:40px 20px;">

  <div style="text-align:center;margin-bottom:28px;">
    <div style="display:inline-block;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);border-radius:20px;padding:6px 18px;margin-bottom:18px;">
      <span style="color:#f97316;font-size:12px;font-weight:700;letter-spacing:0.06em;">TX ENERGY RISK</span>
    </div>
    <h1 style="color:#f3f4f6;font-size:20px;font-weight:900;margin:0 0 6px;">Data Source Notice</h1>
    <p style="color:#6b7280;font-size:12px;margin:0;">{city} &middot; {computed_at}</p>
  </div>

  <div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:14px;padding:22px;margin-bottom:18px;">
    <p style="color:#fbbf24;font-size:13px;font-weight:700;margin:0 0 8px;">Data Source Degraded: {source_name}</p>
    <p style="color:#d1d5db;font-size:13px;line-height:1.6;margin:0;">
      {source_name} data is currently unavailable or stale. Confidence scores have been adjusted accordingly.
      Risk signals that depend on this data source may have reduced precision.
      Monitoring continues using available data sources.
    </p>
  </div>

  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px 18px;margin-bottom:18px;">
    <p style="color:#9ca3af;font-size:13px;margin:0;">
      This is an informational notice only. Normal risk monitoring is continuing.
      Risk scores may reflect reduced confidence until the data source recovers.
    </p>
  </div>

  <div style="text-align:center;margin-bottom:28px;">
    <a href="{DASHBOARD_URL}" style="display:inline-block;background:#f97316;color:#fff;font-weight:700;font-size:14px;padding:13px 30px;border-radius:10px;text-decoration:none;">
      View Dashboard &rarr;
    </a>
  </div>

  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:18px;">
    <p style="color:#4b5563;font-size:11px;line-height:1.65;margin:0 0 10px;">{COMPLIANCE}</p>
    <p style="color:#374151;font-size:11px;margin:0;">
      <a href="{ALERTS_URL}" style="color:#6b7280;">Manage alert preferences</a>
    </p>
  </div>

</div>
</body>
</html>"""


def _build_daily_summary_email(signals_data: dict, city: str, computed_at: str) -> str:
    risk_level     = signals_data.get("risk_score", "low")
    primary_driver = signals_data.get("primary_driver", "No active risk drivers")
    confidence     = signals_data.get("confidence")
    summary        = signals_data.get("summary", "")
    time_horizons  = signals_data.get("time_horizons", {})
    color          = RISK_COLOR.get(risk_level, "#6b7280")
    label          = RISK_LABEL.get(risk_level, risk_level.upper())
    short          = time_horizons.get("short_term", "")
    near           = time_horizons.get("near_term", "")
    outlook        = time_horizons.get("outlook", "")

    price_sig = signals_data.get("signals", {}).get("price_volatility", {})
    wx_sig    = signals_data.get("signals", {}).get("weather_demand", {})
    gas_sig   = signals_data.get("signals", {}).get("gas_supply", {})

    rows = _row("Location", city)
    rows += _row("Risk level", label)
    rows += _row("Primary driver", primary_driver)
    if confidence is not None:
        rows += _row("Confidence", f"{confidence}%")
    if price_sig.get("value"):
        rows += _row("ERCOT price", f"${price_sig['value']:.2f}/MWh")
    if wx_sig.get("value"):
        rows += _row("Forecast high", f"{wx_sig['value']:.0f}&deg;F")
    if gas_sig.get("value") is not None:
        vs = "below" if gas_sig["value"] < 0 else "above"
        rows += _row("Gas storage", f"{abs(gas_sig['value']):.1f}% {vs} 5-yr avg")

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060c1a;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:40px 20px;">

  <div style="text-align:center;margin-bottom:28px;">
    <div style="display:inline-block;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);border-radius:20px;padding:6px 18px;margin-bottom:18px;">
      <span style="color:#f97316;font-size:12px;font-weight:700;letter-spacing:0.06em;">TX ENERGY RISK</span>
    </div>
    <h1 style="color:#f3f4f6;font-size:20px;font-weight:900;margin:0 0 6px;">Daily Risk Summary</h1>
    <p style="color:#6b7280;font-size:12px;margin:0;">{city} &middot; {computed_at}</p>
  </div>

  <div style="background:rgba(255,255,255,0.04);border:2px solid {color}40;border-radius:14px;padding:20px;margin-bottom:18px;text-align:center;">
    <p style="color:#9ca3af;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">TODAY'S RISK LEVEL</p>
    <p style="color:{color};font-size:32px;font-weight:900;margin:0;">{label}</p>
  </div>

  {"<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px 18px;margin-bottom:18px;'><p style='color:#d1d5db;font-size:13px;line-height:1.65;margin:0;'>" + summary + "</p></div>" if summary else ""}

  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px 20px;margin-bottom:18px;">
    <table style="width:100%;border-collapse:collapse;">{rows}</table>
  </div>

  {"<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px 18px;margin-bottom:18px;'><p style='color:#9ca3af;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px;'>OUTLOOK</p>" + ("<p style='color:#e5e7eb;font-size:13px;font-family:monospace;margin:0 0 6px;'>" + short + "</p>" if short else "") + ("<p style='color:#9ca3af;font-size:12px;font-family:monospace;margin:0 0 6px;'>" + near + "</p>" if near else "") + ("<p style='color:#6b7280;font-size:12px;font-family:monospace;margin:0;'>" + outlook + "</p>" if outlook else "") + "</div>" if (short or near or outlook) else ""}

  <div style="text-align:center;margin-bottom:28px;">
    <a href="{DASHBOARD_URL}" style="display:inline-block;background:#f97316;color:#fff;font-weight:700;font-size:14px;padding:13px 30px;border-radius:10px;text-decoration:none;">
      View Live Dashboard &rarr;
    </a>
  </div>

  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:18px;">
    <p style="color:#4b5563;font-size:11px;line-height:1.65;margin:0 0 10px;">{COMPLIANCE}</p>
    <p style="color:#374151;font-size:11px;margin:0;">
      <a href="{ALERTS_URL}" style="color:#6b7280;">Manage alert preferences</a>
    </p>
  </div>

</div>
</body>
</html>"""


# ── Email send ─────────────────────────────────────────────────

async def _send_email(to: str, subject: str, html: str) -> bool:
    if not RESEND_API_KEY:
        logger.warning("[EMAIL] RESEND_API_KEY not set")
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {RESEND_API_KEY}",
                         "Content-Type": "application/json"},
                json={"from": ALERT_FROM, "to": [to],
                      "subject": subject, "html": html},
            )
        if r.status_code in (200, 201):
            logger.info("[EMAIL] Sent to %s: %s", to, subject)
            return True
        logger.error("[EMAIL] Resend %s: %s", r.status_code, r.text[:200])
        return False
    except Exception as exc:
        logger.error("[EMAIL] Exception: %s", exc)
        return False


# ── SMS delivery (Twilio REST) ────────────────────────────────

async def _send_sms(to_phone: str, body: str) -> bool:
    """Send SMS via Twilio REST API (no SDK required)."""
    # API Key pair takes priority over master Auth Token
    use_api_key = bool(TWILIO_API_KEY_SID and TWILIO_API_KEY_SEC)
    auth_user   = TWILIO_API_KEY_SID  if use_api_key else TWILIO_SID
    auth_pass   = TWILIO_API_KEY_SEC  if use_api_key else TWILIO_TOKEN

    # Normalize both numbers to E.164 (strip spaces, dashes, add + if missing)
    def _e164(n: str) -> str:
        n = n.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        return ("+" + n) if (n and not n.startswith("+")) else n

    to_phone    = _e164(to_phone)
    from_number = _e164(TWILIO_FROM)

    logger.warning("[SMS] Attempting: from=%s to=%s auth=%s",
                   from_number, to_phone[-4:].rjust(len(to_phone),"*"),
                   "api_key" if use_api_key else "auth_token")

    if not all([TWILIO_SID, auth_pass, from_number, to_phone]):
        logger.debug("[SMS] Twilio not configured or no phone number")
        return False
    try:
        url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json"
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                url,
                data={"From": from_number, "To": to_phone, "Body": body},
                auth=(auth_user, auth_pass),
            )
        if r.status_code == 201:
            logger.info("[SMS] Sent to %s", to_phone[-4:].rjust(len(to_phone), "*"))
            return True
        logger.error("[SMS] Twilio %s: %s", r.status_code, r.text[:200])
        return False
    except Exception as exc:
        logger.error("[SMS] Exception: %s", exc)
        return False


def _build_sms_body(risk_level: str, city: str, primary_driver: str,
                    ercot_price: Optional[float]) -> str:
    """Compact SMS: ≤160 chars for standard SMS, longer for MMS."""
    level_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(risk_level, "⚪")
    price_str = f" | ${ercot_price:.0f}/MWh" if ercot_price else ""
    driver_str = f" | {primary_driver}" if primary_driver else ""
    return (
        f"{level_emoji} TX Energy Risk — {city}{price_str}\n"
        f"Risk: {risk_level.upper()}{driver_str}\n"
        f"Dashboard: {DASHBOARD_URL}"
    )


# ── Slack delivery (Incoming Webhook) ────────────────────────

async def _send_slack(webhook_url: str, risk_level: str, city: str,
                      primary_driver: str, ercot_price: Optional[float],
                      confidence: Optional[float]) -> bool:
    """Post a formatted alert to a Slack channel via Incoming Webhook."""
    if not webhook_url:
        return False
    color = {"high": "#ef4444", "medium": "#f59e0b", "low": "#22c55e"}.get(risk_level, "#6b7280")
    price_str = f"${ercot_price:.0f}/MWh" if ercot_price else "—"
    conf_str  = f"{confidence:.0f}%" if confidence else "—"
    payload = {
        "text": f"TX Energy Risk Alert — {city} — {risk_level.upper()}",
        "attachments": [{
            "color": color,
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": (
                            f"*TX Energy Risk Alert — {city}*\n"
                            f"Risk Level: *{risk_level.upper()}*  |  ERCOT: *{price_str}*  |  Confidence: *{conf_str}*"
                        ),
                    },
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Primary Driver*\n{primary_driver or 'N/A'}"},
                        {"type": "mrkdwn", "text": f"*Location*\n{city}, Texas"},
                    ],
                },
                {
                    "type": "actions",
                    "elements": [{
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Open Dashboard"},
                        "url": DASHBOARD_URL,
                        "style": "primary" if risk_level == "high" else None,
                    }],
                },
                {
                    "type": "context",
                    "elements": [{"type": "mrkdwn", "text": f"_{COMPLIANCE}_"}],
                },
            ],
        }],
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(webhook_url, json=payload)
        if r.status_code == 200:
            logger.info("[SLACK] Alert delivered")
            return True
        logger.error("[SLACK] %s: %s", r.status_code, r.text[:200])
        return False
    except Exception as exc:
        logger.error("[SLACK] Exception: %s", exc)
        return False


# ── Teams delivery (Power Automate / Incoming Webhook) ───────

async def _send_teams(webhook_url: str, risk_level: str, city: str,
                      primary_driver: str, ercot_price: Optional[float]) -> bool:
    """Post to Microsoft Teams via an Incoming Webhook connector."""
    if not webhook_url:
        return False
    color = {"high": "attention", "medium": "warning", "low": "good"}.get(risk_level, "default")
    price_str = f"${ercot_price:.0f}/MWh" if ercot_price else "—"
    payload = {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        "themeColor": {"high": "FF4444", "medium": "F59E0B", "low": "22C55E"}.get(risk_level, "6B7280"),
        "summary": f"TX Energy Risk Alert — {city} — {risk_level.upper()}",
        "sections": [{
            "activityTitle": f"TX Energy Risk Alert — {city}",
            "activitySubtitle": f"{risk_level.upper()} | ERCOT {price_str}",
            "facts": [
                {"name": "Risk Level", "value": risk_level.upper()},
                {"name": "Primary Driver", "value": primary_driver or "N/A"},
                {"name": "ERCOT Price", "value": price_str},
            ],
            "markdown": True,
        }],
        "potentialAction": [{
            "@type": "OpenUri",
            "name": "Open Dashboard",
            "targets": [{"os": "default", "uri": DASHBOARD_URL}],
        }],
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(webhook_url, json=payload)
        if r.status_code == 200:
            logger.info("[TEAMS] Alert delivered")
            return True
        logger.error("[TEAMS] %s: %s", r.status_code, r.text[:200])
        return False
    except Exception as exc:
        logger.error("[TEAMS] Exception: %s", exc)
        return False


# ── Public dispatch ────────────────────────────────────────────

async def maybe_send_alert(
    user_id:      str,
    to_email:     str,
    signals_data: Dict[str, Any],
    city:         str = "Houston",
) -> None:
    """
    Main alert dispatch. Called after every signal computation for Pro users.
    Handles: dedup, quiet hours, email delivery, logging.
    """
    if not signals_data.get("data_valid", False):
        return

    # ── ERCOT verification safety gate ───────────────────────────────────────
    # Block price-driven alerts when ERCOT data is invalid/stale/unconfirmed.
    ercot_v      = signals_data.get("ercot_verification") or {}
    verif_valid  = ercot_v.get("is_valid", True)
    verif_status = ercot_v.get("status", "real-time")
    _BLOCKED = {"stale", "unavailable", "pending_confirmation"}
    primary_raw  = signals_data.get("primary_driver", "").lower()
    _price_driven = any(kw in primary_raw for kw in ("ercot", "price", "volatility", "market"))
    if not verif_valid and _price_driven and verif_status in _BLOCKED:
        logger.warning("[ALERT] Blocked price-volatility alert — ERCOT data %s", verif_status)
        return

    risk_level     = signals_data.get("risk_score", "low")
    primary_driver = signals_data.get("primary_driver", "No active risk drivers")
    confidence     = signals_data.get("confidence")
    impact         = signals_data.get("impact", "")
    computed_at    = signals_data.get("computed_at", "")
    risk_direction = signals_data.get("risk_direction", "stable")
    time_horizons  = signals_data.get("time_horizons", {})

    price_sig  = signals_data.get("signals", {}).get("price_volatility", {})
    wx_sig     = signals_data.get("signals", {}).get("weather_demand", {})
    gas_sig    = signals_data.get("signals", {}).get("gas_supply", {})
    ercot_price  = price_sig.get("value")
    weather_temp = wx_sig.get("value")
    gas_storage  = gas_sig.get("value")

    prefs = _get_user_prefs(user_id)

    # Check threshold preference
    threshold = prefs.get("risk_threshold", "medium")
    if threshold == "high" and risk_level != "high":
        return  # User only wants High alerts

    # Check driver preferences
    driver_lower = primary_driver.lower()
    if "ercot" in driver_lower or "volatility" in driver_lower or "price" in driver_lower:
        if not prefs.get("price_volatility_alert", True):
            return
    elif "weather" in driver_lower or "demand" in driver_lower:
        if not prefs.get("weather_demand_alert", True):
            return
    elif "gas" in driver_lower or "supply" in driver_lower:
        if not prefs.get("gas_supply_alert", True):
            return

    # Check quiet hours
    if _in_quiet_hours(prefs, risk_level):
        logger.info("[ALERT] Quiet hours active -- skipped for %s", to_email)
        return

    # Deduplication
    ok, reason = _dedup_ok(user_id, risk_level, primary_driver, city, "risk_change")
    if not ok:
        logger.info("[ALERT] Dedup skip (%s) for %s", reason, to_email)
        return

    # Resolve previous risk level
    prev_level = _get_previous_risk(user_id, city)

    computed_str = ""
    if computed_at:
        try:
            dt = datetime.fromisoformat(computed_at.replace("Z", "+00:00"))
            computed_str = dt.strftime("%b %d, %Y %H:%M UTC")
        except Exception:
            computed_str = computed_at

    demand_pressure     = signals_data.get("demand_pressure")
    supply_pressure     = signals_data.get("supply_pressure")
    market_reaction     = signals_data.get("market_reaction")
    gas_to_power_impact = signals_data.get("gas_to_power_impact")
    risk_narrative      = signals_data.get("risk_narrative")
    cost_impact         = signals_data.get("cost_impact")
    market_condition    = signals_data.get("market_condition")
    alert_severity_data = signals_data.get("alert_severity")

    # -- AI reasoning for alert email (best-effort, non-blocking)
    ai_reasoning_data: Optional[dict] = None
    try:
        from services.ai_reasoning import generate_ai_reasoning
        ercot_vals   = []  # not available in alert context; use signal level as proxy
        ai_inputs = {
            "location":                  city,
            "overall_risk_level":        risk_level,
            "confidence_score":          confidence,
            "market_state":              (market_condition or {}).get("label", "Stable"),
            "risk_direction":            risk_direction,
            "primary_driver":            primary_driver,
            "secondary_drivers":         signals_data.get("secondary_factors", []),
            "ercot_price":               ercot_price or 0,
            "ercot_price_behavior":      "stable",
            "ercot_volatility_level":    "low" if risk_level == "low" else "medium",
            "weather_temperature":       weather_temp,
            "weather_forecast_high":     weather_temp,
            "weather_demand_pressure":   (demand_pressure or {}).get("level", "low"),
            "natural_gas_storage":       gas_storage,
            "gas_storage_vs_5yr_avg":    gas_storage,
            "henry_hub_price":           0,
            "gas_supply_pressure":       (supply_pressure or {}).get("level", "low"),
            "gas_to_power_impact":       (gas_to_power_impact or {}).get("level", "low"),
            "active_events":             signals_data.get("events", []),
            "data_source_health":        "active",
            "data_valid":                signals_data.get("data_valid", True),
            "time_horizon":              time_horizons.get("short_term", "next 24-48 hours"),
        }
        ai_reasoning_data = await generate_ai_reasoning(ai_inputs)
    except Exception as _ai_exc:
        logger.warning("[ALERT] AI reasoning fetch failed (non-fatal): %s", _ai_exc)

    html     = _build_risk_email(
        risk_level, prev_level, confidence, primary_driver,
        risk_direction, time_horizons, city,
        ercot_price, weather_temp, gas_storage,
        impact, computed_str,
        demand_pressure, supply_pressure, market_reaction, gas_to_power_impact,
        risk_narrative, cost_impact, market_condition, alert_severity_data,
        ai_reasoning_data,
    )
    subject  = _subject("risk_change", risk_level)
    delivered_email = False
    delivered_sms   = False
    delivered_slack = False
    delivered_teams = False

    # ── Email ─────────────────────────────────────────────────
    if prefs.get("email_alerts", True):
        delivered_email = await _send_email(to_email, subject, html)

    # ── SMS (Twilio) ──────────────────────────────────────────
    if prefs.get("sms_enabled", False):
        sms_phone = prefs.get("sms_phone", "")
        if sms_phone:
            sms_body = _build_sms_body(risk_level, city, primary_driver, ercot_price)
            delivered_sms = await _send_sms(sms_phone, sms_body)

    # ── Slack ─────────────────────────────────────────────────
    if prefs.get("slack_enabled", False):
        slack_url = prefs.get("slack_webhook_url", "")
        if slack_url:
            delivered_slack = await _send_slack(
                slack_url, risk_level, city, primary_driver, ercot_price, confidence
            )

    # ── Teams ─────────────────────────────────────────────────
    if prefs.get("teams_enabled", False):
        teams_url = prefs.get("teams_webhook_url", "")
        if teams_url:
            delivered_teams = await _send_teams(teams_url, risk_level, city, primary_driver, ercot_price)

    delivered     = delivered_email or delivered_sms or delivered_slack or delivered_teams
    email_enabled = prefs.get("email_alerts", True)

    freq = prefs.get("alert_frequency", "immediate")
    if freq != "immediate":
        delivery_status = "logged_for_digest"
    else:
        delivery_status = "sent" if delivered else ("failed" if email_enabled else "email_disabled")

    log_alert(
        user_id=user_id, risk_level=risk_level, confidence=confidence,
        primary_driver=primary_driver, city=city,
        ercot_price=ercot_price, weather_temp=weather_temp,
        gas_storage=gas_storage, message=impact,
        alert_type="risk_change", previous_risk_level=prev_level,
        risk_direction=risk_direction,
        delivery_status=delivery_status,
        delivered_email=delivered_email, delivered_sms=delivered_sms,
        voice_sent=False,
    )


async def send_data_source_alert(
    user_id:     str,
    to_email:    str,
    source_name: str,
    city:        str = "Houston",
) -> None:
    """Send a data source degradation notice to a Pro user."""
    prefs = _get_user_prefs(user_id)

    if not prefs.get("data_source_alert", True):
        return
    if _in_quiet_hours(prefs, "low"):
        return

    ok, _ = _dedup_ok(user_id, "low", f"data_source:{source_name}", city, "data_source")
    if not ok:
        return

    computed_str = datetime.now(timezone.utc).strftime("%b %d, %Y %H:%M UTC")
    html    = _build_data_source_email(source_name, city, computed_str)
    subject = _subject("data_source")
    delivered = False

    if prefs.get("email_alerts", True):
        delivered = await _send_email(to_email, subject, html)

    log_alert(
        user_id=user_id, risk_level="low", confidence=None,
        primary_driver=f"Data source: {source_name}", city=city,
        ercot_price=None, weather_temp=None, gas_storage=None,
        message=f"{source_name} data is currently unavailable.",
        alert_type="data_source",
        source_health_status=f"{source_name}:unavailable",
        delivery_status="sent" if delivered else "failed",
        delivered_email=delivered,
    )


async def send_daily_summary(
    user_id:      str,
    to_email:     str,
    signals_data: Dict[str, Any],
    city:         str = "Houston",
) -> None:
    """Send daily summary digest to users on daily frequency."""
    prefs = _get_user_prefs(user_id)
    if prefs.get("alert_frequency") != "daily":
        return

    ok, _ = _dedup_ok(user_id, "low", "daily_summary", city, "daily_summary")
    if not ok:
        return

    computed_str = datetime.now(timezone.utc).strftime("%b %d, %Y")
    html     = _build_daily_summary_email(signals_data, city, computed_str)
    subject  = _subject("daily_summary")
    delivered = False

    if prefs.get("email_alerts", True):
        delivered = await _send_email(to_email, subject, html)

    risk_level = signals_data.get("risk_score", "low")
    log_alert(
        user_id=user_id, risk_level=risk_level, confidence=signals_data.get("confidence"),
        primary_driver=signals_data.get("primary_driver", ""), city=city,
        ercot_price=None, weather_temp=None, gas_storage=None,
        message=signals_data.get("summary", ""),
        alert_type="daily_summary",
        delivery_status="sent" if delivered else "failed",
        delivered_email=delivered,
    )
