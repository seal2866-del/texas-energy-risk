"""
alerts.py
Alert preferences, history, and test-send endpoints.
All Supabase queries are wrapped in try/except so a DB permission error
(42501) or missing column (42703) never crashes the dashboard.
"""
from fastapi import APIRouter, Header, HTTPException, Body, Query
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime, timezone
from services.supabase_client import get_supabase

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


# ── Schemas ───────────────────────────────────────────────────

class AlertPrefs(BaseModel):
    email_alerts:              Optional[bool]  = True
    sms_alerts:                Optional[bool]  = False
    voice_enabled:             Optional[bool]  = False
    alert_frequency:           Optional[str]   = "immediate"
    risk_threshold:            Optional[str]   = "medium"
    city:                      Optional[str]   = "Houston"
    price_volatility_alert:    Optional[bool]  = True
    weather_demand_alert:      Optional[bool]  = True
    gas_supply_alert:          Optional[bool]  = True
    data_source_alert:         Optional[bool]  = True
    quiet_hours_enabled:       Optional[bool]  = False
    quiet_start_time:          Optional[str]   = "22:00"
    quiet_end_time:            Optional[str]   = "06:00"
    price_threshold_mwh:       Optional[float] = 150.0
    temp_high_threshold_f:     Optional[float] = 105.0
    temp_low_threshold_f:      Optional[float] = 25.0
    gas_storage_pct_threshold: Optional[float] = -10.0
    digest_enabled:            Optional[bool]  = False
    digest_email:              Optional[str]   = None


# ── Auth helper ───────────────────────────────────────────────

def _get_user(authorization: str):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.split(" ", 1)[1]
    sb = get_supabase()
    try:
        resp = sb.auth.get_user(token)
        return resp.user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Safe execute helper ───────────────────────────────────────

def _safe_execute(query, context: str = "query"):
    """Execute a PostgREST query and return the result, or None on error."""
    try:
        return query.execute()
    except Exception as exc:
        log.warning("[alerts] %s failed: %s", context, exc)
        return None


# ── Routes ────────────────────────────────────────────────────

@router.get("/preferences")
async def get_preferences(authorization: str = Header(default="")):
    user = _get_user(authorization)
    sb   = get_supabase()
    r    = _safe_execute(
        sb.table("alert_preferences").select("*").eq("user_id", user.id).limit(1),
        "get_preferences",
    )
    return (r.data[0] if r and r.data else {})


@router.put("/preferences")
async def update_preferences(
    prefs: AlertPrefs = Body(...),
    authorization: str = Header(default=""),
):
    user = _get_user(authorization)
    sb   = get_supabase()
    data = prefs.model_dump(exclude_none=True)
    data["user_id"]    = user.id
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    r = _safe_execute(
        sb.table("alert_preferences").upsert(data, on_conflict="user_id"),
        "update_preferences",
    )
    return {"status": "ok", "data": r.data if r else []}


@router.get("/logs")
async def get_alert_logs(
    limit:      int = 30,
    alert_type: Optional[str] = Query(default=None),
    authorization: str = Header(default=""),
):
    user = _get_user(authorization)
    sb   = get_supabase()
    q = (sb.table("alert_logs")
         .select("*")
         .eq("user_id", user.id)
         .order("created_at", desc=True)
         .limit(limit))
    if alert_type:
        q = q.eq("alert_type", alert_type)
    r = _safe_execute(q, "get_alert_logs")
    return {"logs": r.data if r else []}


@router.get("/logs/recent")
async def get_recent_logs(
    limit: int = 3,
    authorization: str = Header(default=""),
):
    """Returns the N most recent alerts (for dashboard widget)."""
    user = _get_user(authorization)
    sb   = get_supabase()

    # Try the full column set first (requires migration 004 to have run).
    cols_full = "id, alert_type, risk_level, previous_risk_level, primary_driver, city, delivery_status, delivered_email, created_at, sent_at"
    cols_base = "id, alert_type, created_at, sent_at"

    r = _safe_execute(
        sb.table("alert_logs")
          .select(cols_full)
          .eq("user_id", user.id)
          .order("created_at", desc=True)
          .limit(limit),
        "get_recent_logs_full",
    )

    # Fall back to base columns if migration 004 columns are missing.
    if r is None:
        log.info("[alerts] Falling back to base columns for recent logs")
        r = _safe_execute(
            sb.table("alert_logs")
              .select(cols_base)
              .eq("user_id", user.id)
              .order("sent_at", desc=True)
              .limit(limit),
            "get_recent_logs_base",
        )

    return {"logs": r.data if r else []}


@router.post("/logs/{log_id}/acknowledge")
async def acknowledge_alert(
    log_id: str,
    authorization: str = Header(default=""),
):
    _get_user(authorization)
    sb = get_supabase()
    _safe_execute(
        sb.table("alert_logs").update({
            "acknowledged":    True,
            "acknowledged_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", log_id),
        "acknowledge_alert",
    )
    return {"status": "acknowledged"}


@router.post("/send-test")
async def send_test_alert(authorization: str = Header(default="")):
    """Sends a test email to verify alert delivery (Pro only)."""
    user = _get_user(authorization)
    sb   = get_supabase()

    # Check Pro subscription
    sub = _safe_execute(
        sb.table("subscriptions").select("plan, status").eq("user_id", user.id).limit(1),
        "check_subscription",
    )
    sub_data = (sub.data[0] if sub and sub.data else {})
    is_pro = (
        sub_data.get("plan") in ("pro", "business", "enterprise")
        and sub_data.get("status") in ("active", "trialing")
    )
    if not is_pro:
        raise HTTPException(status_code=403, detail="Pro subscription required for email alerts")

    from services.alert_service import _send_email, COMPLIANCE, DASHBOARD_URL, ALERTS_URL
    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#060c1a;font-family:system-ui,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);border-radius:20px;padding:6px 18px;margin-bottom:16px;">
      <span style="color:#f97316;font-size:12px;font-weight:700;letter-spacing:0.06em;">TX ENERGY RISK</span>
    </div>
    <h1 style="color:#f3f4f6;font-size:20px;font-weight:900;margin:0;">Test Alert</h1>
  </div>
  <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:14px;padding:22px;margin-bottom:18px;text-align:center;">
    <p style="color:#22c55e;font-size:28px;font-weight:900;margin:0 0 8px;">LOW RISK</p>
    <p style="color:#d1d5db;font-size:13px;margin:0;">This is a test alert. Your email delivery is working correctly.</p>
  </div>
  <div style="text-align:center;margin-bottom:24px;">
    <a href="{DASHBOARD_URL}" style="display:inline-block;background:#f97316;color:#fff;font-weight:700;font-size:14px;padding:13px 30px;border-radius:10px;text-decoration:none;">View Dashboard &rarr;</a>
  </div>
  <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
    <p style="color:#4b5563;font-size:11px;line-height:1.65;margin:0 0 8px;">{COMPLIANCE}</p>
    <p style="color:#374151;font-size:11px;margin:0;"><a href="{ALERTS_URL}" style="color:#6b7280;">Manage alerts</a></p>
  </div>
</div>
</body>
</html>"""
    delivered = await _send_email(user.email, "TX Energy Risk: Test Alert", html)
    if delivered:
        return {"status": "sent", "email": user.email}
    raise HTTPException(status_code=500, detail="Failed to send test email")
