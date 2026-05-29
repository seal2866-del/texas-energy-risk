"""
EngergyLens — Daily Report Job
Runs every morning via Railway cron. Fetches all Business plan subscribers
from Supabase, generates a PDF report for each, and sends it via email.

Railway cron setup (railway.toml):
    [cron]
    schedule = "0 6 * * *"   # 06:00 UTC = 01:00 CT
    command = "python -m jobs.daily_report_job"

Environment variables required (already in Railway):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    RESEND_API_KEY              (using Resend — already in your Railway vars)
"""

import asyncio
import logging
import os
import sys
import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

# Allow imports from the backend root
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.supabase_client import get_supabase
from services.external_apis import fetch_weather_forecast, fetch_ercot_prices, fetch_gas_data
from services.signal_engine import run_all_signals

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# Cities to include per Business subscriber (can be made per-user later)
DEFAULT_CITIES = ["Houston", "Dallas", "Austin", "San Antonio",
                  "Midland", "Odessa", "Corpus Christi", "Lubbock"]


# ---------------------------------------------------------------------------
# FETCH BUSINESS SUBSCRIBERS
# ---------------------------------------------------------------------------

def get_business_subscribers() -> list[dict]:
    """Return all active Business plan users with their email addresses."""
    sb = get_supabase()
    result = (
        sb.table("subscriptions")
        .select("user_id, plan, status")
        .eq("plan", "business")
        .eq("status", "active")
        .execute()
    )

    if not result.data:
        log.info("No active Business subscribers found.")
        return []

    subscribers = []
    for sub in result.data:
        user = sb.table("users").select("id, email, full_name").eq("id", sub["user_id"]).single().execute()
        if user.data and user.data.get("email"):
            subscribers.append({
                "user_id":   sub["user_id"],
                "email":     user.data["email"],
                "name":      user.data.get("full_name") or user.data["email"].split("@")[0],
                "plan":      sub["plan"],
            })

    log.info(f"Found {len(subscribers)} active Business subscriber(s).")
    return subscribers


# ---------------------------------------------------------------------------
# BUILD REPORT DATA FROM LIVE SIGNALS
# ---------------------------------------------------------------------------

async def build_report_data(org_name: str) -> dict:
    """Fetch live signals for all cities and assemble report data dict."""
    now = datetime.now(timezone.utc)
    report_date = now.strftime("%A, %B %-d, %Y")
    generated_at = now.strftime("%I:%M %p CT")

    # Fetch shared data (prices + gas are grid-wide)
    prices, gas_data = await asyncio.gather(
        fetch_ercot_prices(hours=4),
        fetch_gas_data(weeks=4),
    )

    # Fetch weather per city and compute signals
    city_signals = {}
    for city in DEFAULT_CITIES:
        forecasts = await fetch_weather_forecast(location=city, days=3)
        signals   = run_all_signals(prices, forecasts, gas_data, location=city)
        city_signals[city] = {
            "risk_score":   signals.get("risk_score", "low"),
            "confidence":   signals.get("confidence", 70),
            "weather":      forecasts[0] if forecasts else {},
            "signals":      signals,
        }

    # Primary city summary (Houston as lead)
    lead = city_signals.get("Houston", {})
    lead_signals = lead.get("signals", {})

    # Build hourly price outlook from time horizons
    time_horizons = lead_signals.get("time_horizons", [])
    hourly_prices = []
    max_price = 150
    for h in time_horizons:
        label    = h.get("label", "")
        prob     = h.get("escalation_probability", 12)
        level    = "danger" if prob > 30 else "warn" if prob > 15 else "normal"
        # Estimate price from risk score + escalation probability
        base     = float((prices[-1] or {}).get("price_mwh", 30)) if prices else 30
        est      = round(base * (1 + prob / 100))
        hourly_prices.append({"window": label, "price": est, "max_price": max_price, "level": level})

    # Weather table
    weather_rows = []
    flag_map = {"high": "high", "medium": "elevated", "low": "normal"}
    for city in DEFAULT_CITIES:
        wx = city_signals[city].get("weather", {})
        demand_risk = wx.get("demand_risk", "low")
        weather_rows.append({
            "zone":       city,
            "high":       round(wx.get("temp_high_f", 0)),
            "heat_index": round(wx.get("temp_high_f", 0) + 3),  # approx
            "flag":       flag_map.get(demand_risk, "normal"),
        })

    # Alerts from active signals
    alerts = []
    for city, cs in city_signals.items():
        sigs = cs.get("signals", {})
        if sigs.get("risk_score") in ("medium", "high"):
            alerts.append({
                "level":       "critical" if sigs.get("risk_score") == "high" else "warn",
                "icon":        "🔴" if sigs.get("risk_score") == "high" else "🟡",
                "title":       f"{sigs.get('risk_score', '').capitalize()} Risk — {city}",
                "description": sigs.get("explanation", "Elevated risk conditions detected."),
                "time":        generated_at,
            })

    if not alerts:
        alerts.append({
            "level":       "normal",
            "icon":        "🟢",
            "title":       "All Zones Stable",
            "description": "No elevated risk conditions detected across monitored zones.",
            "time":        generated_at,
        })

    # RT price KPI
    rt_price = float((prices[-1] or {}).get("price_mwh", 0)) if prices else 0
    prev_price = float((prices[-2] or {}).get("price_mwh", rt_price)) if len(prices) >= 2 else rt_price
    price_delta = rt_price - prev_price
    price_dir   = "up" if price_delta > 0 else "down" if price_delta < 0 else "neutral"

    # Banner
    high_risk_cities = [c for c, cs in city_signals.items() if cs.get("risk_score") == "high"]
    banner = None
    if high_risk_cities:
        banner = {
            "level":   "critical",
            "message": f"High Risk Active: {', '.join(high_risk_cities)}. Immediate attention recommended.",
        }
    elif any(cs.get("risk_score") == "medium" for cs in city_signals.values()):
        watch_cities = [c for c, cs in city_signals.items() if cs.get("risk_score") == "medium"]
        banner = {
            "level":   "warn",
            "message": f"Watch Condition Active: Elevated risk in {', '.join(watch_cities)}.",
        }

    return {
        "org_name":          org_name,
        "report_date":       report_date,
        "report_date_short": now.strftime("%Y-%m-%d"),
        "generated_at":      generated_at,
        "banner":            banner,
        "grid": {
            "rt_price":       {"value": round(rt_price, 2), "unit": "$/MWh",
                               "delta": f"{'↑' if price_dir == 'up' else '↓' if price_dir == 'down' else '→'} ${abs(price_delta):.2f} vs. prior interval",
                               "direction": price_dir},
            "grid_load":      {"value": "N/A", "unit": "MW", "delta": "Live ERCOT feed", "direction": "neutral"},
            "reserve_margin": {"value": "N/A", "unit": "%",  "delta": "Live ERCOT feed", "direction": "neutral", "status": "normal"},
            "wind_gen":       {"value": "N/A", "unit": "MW", "delta": "Live ERCOT feed", "direction": "neutral"},
            "snapshot_time":  generated_at,
        },
        "hourly_prices":   hourly_prices or [
            {"window": "No forecast data", "price": 0, "max_price": 150, "level": "normal"}
        ],
        "weather":         weather_rows,
        "generation_mix":  [],   # Add EIA generation mix if available
        "alerts":          alerts,
    }


# ---------------------------------------------------------------------------
# GENERATE PDF
# ---------------------------------------------------------------------------

def generate_pdf(data: dict, output_path: Path) -> None:
    """Render HTML template to PDF using WeasyPrint."""
    import weasyprint
    from jinja2 import Environment, FileSystemLoader

    template_path = Path(__file__).parent.parent.parent.parent / "morning_report_template.html"

    # Fallback: check same dir as backend
    if not template_path.exists():
        template_path = Path(__file__).parent.parent.parent / "morning_report_template.html"

    if not template_path.exists():
        raise FileNotFoundError(f"Report template not found. Expected at: {template_path}")

    def bar_width(price, max_price):
        return round(min((price / max_price) * 100, 100))

    env = Environment(loader=FileSystemLoader(str(template_path.parent)))
    env.filters["bar_width"] = bar_width
    template = env.get_template(template_path.name)
    html = template.render(**data)

    weasyprint.HTML(string=html, base_url=str(template_path.parent)).write_pdf(str(output_path))
    log.info(f"PDF generated: {output_path} ({output_path.stat().st_size / 1024:.1f} KB)")


# ---------------------------------------------------------------------------
# SEND EMAIL VIA RESEND
# ---------------------------------------------------------------------------

def send_email(recipient_email: str, recipient_name: str, pdf_path: Path, report_date: str) -> bool:
    """Send the PDF report via Resend API."""
    import base64
    import httpx

    api_key = os.getenv("RESEND_API_KEY", "")
    if not api_key:
        log.error("RESEND_API_KEY not set — cannot send email.")
        return False

    with open(pdf_path, "rb") as f:
        pdf_b64 = base64.b64encode(f.read()).decode()

    payload = {
        "from":    "EngergyLens Reports <reports@engergylens.com>",
        "to":      [recipient_email],
        "subject": f"EngergyLens Morning Report — {report_date}",
        "html": f"""
            <div style="font-family: Helvetica Neue, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a2e;">
              <div style="background: #0d1b2a; padding: 24px 32px; border-radius: 8px 8px 0 0;">
                <span style="font-size: 20px; font-weight: 700; color: #fff;">
                  Engergy<span style="color: #00c2a8;">Lens</span>
                </span>
              </div>
              <div style="background: #f8fafc; padding: 32px; border: 1px solid #e8ecf0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="margin: 0 0 16px; font-size: 15px; font-weight: 600;">Good morning, {recipient_name}.</p>
                <p style="margin: 0 0 24px; font-size: 13px; color: #4b5563; line-height: 1.6;">
                  Your Morning Operational Report for <strong>{report_date}</strong> is attached.
                </p>
                <p style="margin: 0; font-size: 11px; color: #9ca3af; border-top: 1px solid #e8ecf0; padding-top: 16px;">
                  Delivered by EngergyLens Business · Manage preferences in your account settings.
                </p>
              </div>
            </div>
        """,
        "attachments": [{
            "filename":    pdf_path.name,
            "content":     pdf_b64,
            "content_type": "application/pdf",
        }],
    }

    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=15,
        )
        if r.status_code in (200, 201):
            log.info(f"Email sent to {recipient_email} — status {r.status_code}")
            return True
        else:
            log.error(f"Email failed for {recipient_email}: {r.status_code} {r.text}")
            return False
    except Exception as e:
        log.error(f"Email exception for {recipient_email}: {e}")
        return False


# ---------------------------------------------------------------------------
# LOG DELIVERY TO SUPABASE
# ---------------------------------------------------------------------------

def log_delivery(user_id: str, email: str, status: str, pdf_filename: str) -> None:
    try:
        sb = get_supabase()
        sb.table("report_deliveries").insert({
            "user_id":      user_id,
            "email":        email,
            "report_type":  "morning_operational",
            "status":       status,
            "pdf_filename": pdf_filename,
            "delivered_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        log.warning(f"Could not log delivery to Supabase: {e}")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

async def run():
    log.info("=== Daily Report Job Starting ===")
    subscribers = get_business_subscribers()

    if not subscribers:
        log.info("No subscribers to send to. Exiting.")
        return

    sent = 0
    failed = 0

    for sub in subscribers:
        log.info(f"Processing report for {sub['email']} ...")
        try:
            # Build live report data
            data = await build_report_data(org_name=sub["name"])
            report_date = data["report_date"]
            report_date_short = data["report_date_short"]

            # Generate PDF in a temp file
            with tempfile.TemporaryDirectory() as tmpdir:
                pdf_filename = f"morning_report_{report_date_short}.pdf"
                pdf_path = Path(tmpdir) / pdf_filename

                generate_pdf(data, pdf_path)
                success = send_email(sub["email"], sub["name"], pdf_path, report_date)

            status = "sent" if success else "failed"
            log_delivery(sub["user_id"], sub["email"], status, pdf_filename)

            if success:
                sent += 1
            else:
                failed += 1

        except Exception as e:
            log.error(f"Failed for {sub['email']}: {e}", exc_info=True)
            log_delivery(sub["user_id"], sub["email"], "error", "")
            failed += 1

    log.info(f"=== Done: {sent} sent, {failed} failed ===")


if __name__ == "__main__":
    asyncio.run(run())
