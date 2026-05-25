"""
alerts.py
Manages user alert preferences, alert log retrieval, and alert history.
Phase 4-5: email alert preferences + structured alert history.
"""
from fastapi import APIRouter, Header, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from services.supabase_client import get_supabase

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


# ── Schemas ───────────────────────────────────────────────────

class AlertPrefs(BaseModel):
    email_alerts:              Optional[bool]  = True
    sms_alerts:                Optional[bool]  = False
    alert_frequency:           Optional[str]   = "immediate"   # immediate | daily | weekly
    risk_threshold:            Optional[str]   = "medium"      # medium | high
    city:                      Optional[str]   = "Houston"
    price_volatility_alert:    Optional[bool]  = True
    weather_demand_alert:      Optional[bool]  = True
    gas_supply_alert:          Optional[bool]  = True
    price_threshold_mwh:       Optional[float] = 150.0
    temp_high_threshold_f:     Optional[float] = 105.0
    temp_low_threshold_f:      Optional[float] = 25.0
    gas_storage_pct_threshold: Optional[float] = -10.0


# ── Helpers ───────────────────────────────────────────────────

def _get_user_id(authorization: str) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    sb = get_supabase()
    try:
        user = sb.auth.get_user(token)
        return user.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Routes ────────────────────────────────────────────────────

@router.get("/preferences")
async def get_preferences(authorization: str = Header(default="")):
    user_id = _get_user_id(authorization)
    sb = get_supabase()
    result = (
        sb.table("alert_preferences")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else {}


@router.put("/preferences")
async def update_preferences(
    prefs: AlertPrefs = Body(...),
    authorization: str = Header(default=""),
):
    user_id = _get_user_id(authorization)
    sb = get_supabase()
    data = prefs.model_dump(exclude_none=True)
    data["user_id"]    = user_id
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = (
        sb.table("alert_preferences")
        .upsert(data, on_conflict="user_id")
        .execute()
    )
    return {"status": "ok", "data": result.data}


@router.get("/logs")
async def get_alert_logs(
    limit: int = 20,
    authorization: str = Header(default=""),
):
    user_id = _get_user_id(authorization)
    sb = get_supabase()
    result = (
        sb.table("alert_logs")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"logs": result.data or []}


@router.post("/logs/{log_id}/acknowledge")
async def acknowledge_alert(
    log_id: str,
    authorization: str = Header(default=""),
):
    _get_user_id(authorization)
    sb = get_supabase()
    sb.table("alert_logs").update({
        "acknowledged":    True,
        "acknowledged_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", log_id).execute()
    return {"status": "acknowledged"}
