"""
digest.py — Morning Digest Router
Exposes a manual trigger endpoint and a status endpoint.
The scheduled job is wired in main.py via APScheduler.
"""
import logging
from fastapi import APIRouter, Header, HTTPException
from services.digest_service import send_morning_digest
from services.supabase_client import get_supabase

log    = logging.getLogger(__name__)
router = APIRouter(prefix="/api/digest", tags=["Digest"])


def _get_user(authorization: str):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.split(" ", 1)[1]
    sb    = get_supabase()
    try:
        resp = sb.auth.get_user(token)
        if not resp.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return resp.user
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))


@router.post("/trigger")
async def trigger_digest(authorization: str = Header(...)):
    """
    Manually trigger the morning digest for all opted-in users.
    Requires a valid auth token (any logged-in user can trigger for testing).
    """
    _get_user(authorization)
    log.info("[DIGEST] Manual trigger via API")
    result = await send_morning_digest()
    return {"status": "ok", "result": result}


@router.post("/test-send")
async def test_digest_send(authorization: str = Header(...)):
    """
    Send a test digest to the requesting user's email only.
    Useful for previewing the digest format before enabling it.
    """
    user    = _get_user(authorization)
    to_email = user.email
    if not to_email:
        raise HTTPException(status_code=400, detail="No email on account")

    from services.signal_engine import compute_signals
    from services.alert_service import _build_daily_summary_email, _send_email, _subject
    from datetime import datetime, timezone

    try:
        signals      = await compute_signals()
        computed_str = datetime.now(timezone.utc).strftime("%b %d, %Y")
        html         = _build_daily_summary_email(signals, "Houston", computed_str)
        subject      = "[TEST] " + _subject("daily_summary")
        delivered    = await _send_email(to_email, subject, html)
        return {"status": "ok", "delivered": delivered, "to": to_email}
    except Exception as exc:
        log.error("[DIGEST] Test send error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
