"""
alert_service.py
Email alert delivery using Resend + Supabase alert logging.
Implements Phase 4 (delivery) and Phase 5 (history) of the upgrade spec.

LEGAL NOTE: All alert content is informational only.
No trading, procurement, or investment advice is expressed or implied.
"""
import os
import logging
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
ALERT_FROM     = os.getenv("ALERT_FROM_EMAIL", "alerts@txenergyrisk.com")
RESEND_URL     = "https://api.resend.com/emails"

DISCLAIMER = (
    "This alert is for informational and analytical purposes only and does not constitute "
    "investment, trading, or procurement advice. Risk indicators are probabilistic and may not "
    "reflect actual market conditions. Consult qualified advisors before making decisions."
)


# ──────────────────────────────────────────────────────────────────────────────
# Alert trigger logic — Phase 4
# ──────────────────────────────────────────────────────────────────────────────

def should_send_alert(
    user_id:         str,
    new_risk_level:  str,
    primary_driver:  str,
    city:            str,
) -> bool:
    """
    Check if an alert should be sent based on risk level change logic.
    Rules:
    - Send when risk changes Low→Medium or Medium→High
    - Send when a new primary driver appears
    - Do not spam repeated alerts if level hasn't changed
    """
    try:
        sb = get_supabase()
        # Get most recent alert for this user + city
        result = (
            sb.table("alert_logs")
            .select("risk_level, primary_driver, created_at")
            .eq("user_id", user_id)
            .eq("city", city)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if not result.data:
            # No previous alert — send if risk is medium or high
            return new_risk_level in ("medium", "high")

        last = result.data[0]
        last_level  = last.get("risk_level", "low")
        last_driver = last.get("primary_driver", "")

        # Risk level escalated
        LEVEL_RANK = {"low": 0, "medium": 1, "high": 2}
        if LEVEL_RANK.get(new_risk_level, 0) > LEVEL_RANK.get(last_level, 0):
            return True

        # New primary driver appeared (even if level same)
        if new_risk_level in ("medium", "high") and primary_driver != last_driver and primary_driver not in ("No active risk drivers", "None"):
            return True

        return False

    except Exception as exc:
        logger.error("[ALERT] Error checking alert history: %s", exc)
        return False


def log_alert(
    user_id:        str,
    risk_level:     str,
    confidence:     Optional[int],
    primary_driver: str,
    city:           str,
    ercot_price:    Optional[float],
    weather_temp:   Optional[float],
    gas_storage:    Optional[float],
    message:        str,
    delivered_email: bool = False,
    delivered_sms:   bool = False,
) -> Optional[str]:
    """Phase 5 — Log alert to Supabase alert_logs table. Returns inserted ID."""
    try:
        sb = get_supabase()
        result = sb.table("alert_logs").insert({
            "user_id":        user_id,
            "risk_level":     risk_level,
            "confidence":     confidence,
            "primary_driver": primary_driver,
            "city":           city,
            "ercot_price":    ercot_price,
            "weather_temp":   weather_temp,
            "gas_storage":    gas_storage,
            "message":        message,
            "delivered_email": delivered_email,
            "delivered_sms":   delivered_sms,
            "acknowledged":   False,
            "created_at":     datetime.now(timezone.utc).isoformat(),
        }).execute()
        if result.data:
            return result.data[0].get("id")
    except Exception as exc:
        logger.error("[ALERT] Error logging alert: %s", exc)
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Email builder — Phase 4
# ──────────────────────────────────────────────────────────────────────────────

def _build_subject(risk_level: str, primary_driver: str) -> str:
    subject_map = {
        ("high",   "Weather-driven demand"):   "TX Energy Risk Alert: High Weather Demand Pressure",
        ("high",   "Market volatility"):        "TX Energy Risk Alert: High ERCOT Volatility",
        ("high",   "Supply pressure"):          "TX Energy Risk Alert: High Gas Supply Pressure",
        ("medium", "Weather-driven demand"):    "TX Energy Risk Alert: Medium Risk — Weather Demand Elevated",
        ("medium", "Market volatility"):        "ERCOT Volatility Update: Monitoring Recommended",
        ("medium", "Supply pressure"):          "TX Energy Risk Alert: Medium Risk — Gas Supply Pressure",
    }
    key = (risk_level, primary_driver)
    return subject_map.get(key, f"TX Energy Risk Alert: {risk_level.capitalize()} Risk Detected")


def _build_html_email(
    risk_level:     str,
    confidence:     Optional[int],
    primary_driver: str,
    time_horizon:   str,
    ercot_price:    Optional[float],
    weather_temp:   Optional[float],
    gas_storage:    Optional[float],
    why_it_matters: str,
    city:           str,
    computed_at:    str,
) -> str:
    risk_color = {"high": "#ef4444", "medium": "#f59e0b", "low": "#22c55e"}.get(risk_level, "#6b7280")
    risk_label = risk_level.upper()

    price_row  = f"<tr><td style='padding:6px 0;color:#9ca3af;'>ERCOT Price</td><td style='padding:6px 0;color:#f3f4f6;font-weight:600;'>${ercot_price:.2f}/MWh</td></tr>" if ercot_price else ""
    temp_row   = f"<tr><td style='padding:6px 0;color:#9ca3af;'>Weather</td><td style='padding:6px 0;color:#f3f4f6;'>{weather_temp:.0f}°F forecast high</td></tr>" if weather_temp else ""
    gas_row    = f"<tr><td style='padding:6px 0;color:#9ca3af;'>Gas Storage</td><td style='padding:6px 0;color:#f3f4f6;'>{abs(gas_storage):.1f}% {'below' if gas_storage and gas_storage < 0 else 'above'} 5-yr avg</td></tr>" if gas_storage is not None else ""
    conf_row   = f"<tr><td style='padding:6px 0;color:#9ca3af;'>Confidence</td><td style='padding:6px 0;color:#f3f4f6;'>{confidence}%</td></tr>" if confidence else ""

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060c1a;font-family:'Inter',system-ui,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);border-radius:20px;padding:6px 16px;margin-bottom:20px;">
      <span style="color:#f97316;font-size:12px;font-weight:700;letter-spacing:0.05em;">⚡ TX ENERGY RISK</span>
    </div>
    <h1 style="color:#f3f4f6;font-size:22px;font-weight:900;margin:0 0 8px;">Texas Energy Risk Alert</h1>
    <p style="color:#6b7280;font-size:13px;margin:0;">{city} · {computed_at}</p>
  </div>

  <!-- Risk level badge -->
  <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
    <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">Current Risk Level</p>
    <p style="color:{risk_color};font-size:32px;font-weight:900;margin:0 0 8px;">{risk_label}</p>
    <p style="color:#d1d5db;font-size:13px;margin:0;">Primary Driver: <strong style="color:#f3f4f6;">{primary_driver}</strong></p>
  </div>

  <!-- Data table -->
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin-bottom:20px;">
    <table style="width:100%;border-collapse:collapse;">
      {conf_row}{price_row}{temp_row}{gas_row}
      <tr><td style="padding:6px 0;color:#9ca3af;">Time Horizon</td><td style="padding:6px 0;color:#f3f4f6;font-size:12px;">{time_horizon}</td></tr>
    </table>
  </div>

  <!-- Why it matters -->
  <div style="background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.15);border-radius:12px;padding:18px;margin-bottom:20px;">
    <p style="color:#fb923c;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">ℹ Why This Matters</p>
    <p style="color:#d1d5db;font-size:13px;line-height:1.6;margin:0;">{why_it_matters}</p>
  </div>

  <!-- CTA -->
  <div style="text-align:center;margin-bottom:28px;">
    <a href="https://texas-energy-risk.vercel.app/dashboard" style="display:inline-block;background:#f97316;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">
      View Live Dashboard →
    </a>
  </div>

  <!-- Disclaimer -->
  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
    <p style="color:#4b5563;font-size:11px;line-height:1.6;margin:0;">{DISCLAIMER}</p>
    <p style="color:#374151;font-size:11px;margin:12px 0 0;">
      You are receiving this alert because you have email alerts enabled on TX Energy Risk.
      <a href="https://texas-energy-risk.vercel.app/alerts" style="color:#6b7280;">Manage alerts</a>
    </p>
  </div>

</div>
</body>
</html>
"""


async def send_alert_email(
    to_email:       str,
    user_id:        str,
    risk_level:     str,
    confidence:     Optional[int],
    primary_driver: str,
    time_horizon:   str,
    ercot_price:    Optional[float],
    weather_temp:   Optional[float],
    gas_storage:    Optional[float],
    why_it_matters: str,
    city:           str = "Houston",
    computed_at:    str = "",
) -> bool:
    """Send alert email via Resend. Returns True on success."""
    if not RESEND_API_KEY:
        logger.warning("[ALERT] RESEND_API_KEY not set — skipping email send")
        return False

    subject  = _build_subject(risk_level, primary_driver)
    html     = _build_html_email(
        risk_level, confidence, primary_driver, time_horizon,
        ercot_price, weather_temp, gas_storage, why_it_matters,
        city, computed_at or datetime.now(timezone.utc).strftime("%b %d, %Y %H:%M UTC"),
    )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                json={"from": ALERT_FROM, "to": [to_email], "subject": subject, "html": html},
            )
        if resp.status_code == 200:
            logger.info("[ALERT] Email sent to %s — risk=%s driver=%s", to_email, risk_level, primary_driver)
            return True
        else:
            logger.error("[ALERT] Resend error %s: %s", resp.status_code, resp.text)
            return False
    except Exception as exc:
        logger.error("[ALERT] Email send exception: %s", exc)
        return False


# ──────────────────────────────────────────────────────────────────────────────
# Main dispatch — called from signals router after each computation
# ──────────────────────────────────────────────────────────────────────────────

async def maybe_send_alert(
    user_id:      str,
    to_email:     str,
    signals_data: Dict[str, Any],
    city:         str = "Houston",
) -> None:
    """
    Called after signals are computed. Checks if an alert should fire,
    sends the email, and logs the result to Supabase.
    """
    if not signals_data.get("data_valid", False):
        return

    risk_level     = signals_data.get("risk_score", "low")
    primary_driver = signals_data.get("primary_driver", "No active risk drivers")
    confidence     = signals_data.get("confidence")
    impact         = signals_data.get("impact", "")
    computed_at    = signals_data.get("computed_at", "")

    time_horizons  = signals_data.get("time_horizons", {})
    time_horizon   = time_horizons.get("short_term", "") + " · " + time_horizons.get("near_term", "")

    # Extract individual values for logging
    price_sig  = signals_data.get("signals", {}).get("price_volatility", {})
    wx_sig     = signals_data.get("signals", {}).get("weather_demand", {})
    gas_sig    = signals_data.get("signals", {}).get("gas_supply", {})

    ercot_price  = price_sig.get("value")
    weather_temp = wx_sig.get("value")
    gas_storage  = gas_sig.get("value")

    if not should_send_alert(user_id, risk_level, primary_driver, city):
        return

    logger.info("[ALERT] Sending alert to %s — risk=%s driver=%s", to_email, risk_level, primary_driver)

    delivered = await send_alert_email(
        to_email=to_email, user_id=user_id,
        risk_level=risk_level, confidence=confidence,
        primary_driver=primary_driver, time_horizon=time_horizon,
        ercot_price=ercot_price, weather_temp=weather_temp,
        gas_storage=gas_storage, why_it_matters=impact,
        city=city, computed_at=computed_at,
    )

    log_alert(
        user_id=user_id, risk_level=risk_level, confidence=confidence,
        primary_driver=primary_driver, city=city,
        ercot_price=ercot_price, weather_temp=weather_temp,
        gas_storage=gas_storage, message=impact,
        delivered_email=delivered, delivered_sms=False,
    )
