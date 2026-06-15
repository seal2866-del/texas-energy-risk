"""
TX Energy Risk — Newsletter API Router
Handles subscribers, issue management, and Resend delivery.
"""
import csv
import io
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Body, Header, HTTPException, Query
from pydantic import BaseModel

from services.supabase_client import get_supabase
from services.newsletter_service import generate_and_save_draft, build_html_email, build_text_email

log    = logging.getLogger(__name__)
router = APIRouter(prefix="/api/newsletter", tags=["Newsletter"])

RESEND_API_KEY  = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL      = os.getenv("RESEND_FROM_EMAIL", os.getenv("ALERT_FROM_EMAIL", "alerts@texasgridintel.com"))
NEWSLETTER_FROM = f"Texas Energy Risk Brief <{FROM_EMAIL}>"
FRONTEND_URL    = os.getenv("FRONTEND_URL", "https://texas-energy-risk.vercel.app")
ADMIN_SECRET    = os.getenv("NEWSLETTER_ADMIN_SECRET", "")


# ---------------------------------------------------------------------------
# MODELS
# ---------------------------------------------------------------------------

class SubscribeRequest(BaseModel):
    email:      str
    first_name: Optional[str] = None
    last_name:  Optional[str] = None
    company:    Optional[str] = None
    title:      Optional[str] = None
    city:       Optional[str] = None
    industry:   Optional[str] = None
    source:     Optional[str] = "homepage"

class IssueUpdate(BaseModel):
    subject:          Optional[str] = None
    preview_text:     Optional[str] = None
    executive_summary: Optional[str] = None
    what_changed:     Optional[str] = None
    status:           Optional[str] = None


# ---------------------------------------------------------------------------
# AUTH HELPER
# ---------------------------------------------------------------------------

def _require_admin(authorization: str):
    if not ADMIN_SECRET:
        return  # no secret configured — allow in dev
    if authorization != f"Bearer {ADMIN_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


# ---------------------------------------------------------------------------
# PUBLIC: SUBSCRIBE
# ---------------------------------------------------------------------------

@router.post("/subscribe")
async def subscribe(body: SubscribeRequest):
    """Public endpoint — add a new subscriber."""
    sb = get_supabase()

    # Check if already subscribed
    existing = sb.table("newsletter_subscribers").select("id, status").eq("email", body.email).limit(1).execute()
    if existing.data:
        sub = existing.data[0]
        if sub["status"] == "active":
            return {"status": "already_subscribed"}
        # Re-activate if unsubscribed
        sb.table("newsletter_subscribers").update({"status": "active", "unsubscribed_at": None}).eq("id", sub["id"]).execute()
        return {"status": "resubscribed"}

    sb.table("newsletter_subscribers").insert({
        "email":    body.email,
        "company":  body.company,
        "title":    body.title,
        "city":     body.city,
        "industry": body.industry,
        "source":   body.source or "homepage",
        "status":   "active",
    }).execute()

    # Send welcome email via Resend
    first = (body.first_name or "").strip() or "there"
    fe_url = FRONTEND_URL
    welcome_html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:20px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
<tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 28px;border-bottom:3px solid #f97316;">
  <p style="margin:0 0 2px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:2px;">Texas Grid Intel</p>
  <p style="margin:0;font-size:20px;font-weight:900;color:#fff;">Texas Energy Risk Brief</p>
  <p style="margin:4px 0 0;font-size:11px;color:#64748b;">Weekly Operational Intelligence for Texas Energy Markets</p>
</td></tr>
<tr><td style="background:#0f172a;padding:28px 28px 20px;">
  <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;">Hi {first},</p>
  <p style="margin:0 0 14px;font-size:14px;color:#94a3b8;line-height:1.7;">
    You're subscribed to the <strong style="color:#e2e8f0;">Texas Energy Risk Brief</strong> — weekly ERCOT intelligence for Texas energy managers and operations teams.
  </p>
  <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.7;">
    Every Monday morning you'll receive:
  </p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
    <tr><td style="padding:6px 0;font-size:13px;color:#e2e8f0;">✅ &nbsp;Weekly ERCOT price outlook &amp; risk level</td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:#e2e8f0;">✅ &nbsp;What changed this week — prices, weather, gas supply</td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:#e2e8f0;">✅ &nbsp;Early warning signals before conditions escalate</td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:#e2e8f0;">✅ &nbsp;Operational recommendations — actionable, not generic</td></tr>
  </table>
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="border-radius:8px;background:#f97316;">
      <a href="{fe_url}/dashboard" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#f97316;font-size:13px;font-weight:700;color:#fff;text-decoration:none;">View Live Dashboard →</a>
    </td>
  </tr></table>
</td></tr>
<tr><td style="background:#0a0f1a;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center;">
  <p style="margin:0;font-size:10px;color:#334155;">Texas Grid Intel · Houston, TX · Operational intelligence only — not financial advice.</p>
  <p style="margin:6px 0 0;font-size:10px;"><a href="{fe_url}/unsubscribe" style="color:#475569;">Unsubscribe</a></p>
</td></tr>
</table></td></tr></table>
</body></html>"""

    if RESEND_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "from":    f"Texas Energy Risk Brief <{FROM_EMAIL}>",
                        "to":      [body.email],
                        "subject": "You're subscribed — Texas Energy Risk Brief",
                        "html":    welcome_html,
                    },
                )
            log.info(f"[NEWSLETTER] Welcome email sent to {body.email}")
        except Exception as e:
            log.warning(f"[NEWSLETTER] Welcome email failed for {body.email}: {e}")

    return {"status": "subscribed"}


# ---------------------------------------------------------------------------
# PUBLIC: UNSUBSCRIBE
# ---------------------------------------------------------------------------

@router.get("/unsubscribe")
async def unsubscribe(token: str = Query(...)):
    """One-click unsubscribe via token."""
    sb = get_supabase()
    r  = sb.table("newsletter_subscribers").update({
        "status":           "unsubscribed",
        "unsubscribed_at":  datetime.now(timezone.utc).isoformat(),
    }).eq("unsubscribe_token", token).execute()

    if not r.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    return {"status": "unsubscribed"}


# ---------------------------------------------------------------------------
# PUBLIC: LATEST APPROVED ISSUE (used by prospecting Send Campaign)
# ---------------------------------------------------------------------------

@router.get("/public/latest")
async def get_latest_approved():
    """Return subject + html_body of the latest approved newsletter. No auth required."""
    sb = get_supabase()
    r  = sb.table("newsletter_issues")            .select("id, subject, html_body, created_at")            .eq("status", "approved")            .order("created_at", desc=True)            .limit(1)            .execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="No approved newsletter issue found")
    issue = r.data[0]
    if not issue.get("html_body"):
        raise HTTPException(status_code=404, detail="Latest approved issue has no HTML body")
    return {
        "id":       issue["id"],
        "subject":  issue.get("subject", "Texas Grid Intel Newsletter"),
        "html_body": issue["html_body"],
    }


# ---------------------------------------------------------------------------
# ADMIN: GENERATE DRAFT
# ---------------------------------------------------------------------------

@router.post("/admin/generate")
async def generate_draft(authorization: str = Header(default="")):
    """Trigger AI generation of a new weekly draft."""
    _require_admin(authorization)
    try:
        issue_id = await generate_and_save_draft()
        return {"status": "draft_created", "issue_id": issue_id}
    except Exception as e:
        log.error(f"[NEWSLETTER] Generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# ADMIN: LIST ISSUES
# ---------------------------------------------------------------------------

@router.get("/admin/issues")
async def list_issues(authorization: str = Header(default=""), limit: int = 20):
    _require_admin(authorization)
    sb = get_supabase()
    r  = sb.table("newsletter_issues").select(
        "id, issue_date, subject, risk_level, status, created_at, sent_at"
    ).order("created_at", desc=True).limit(limit).execute()
    return r.data or []


# ---------------------------------------------------------------------------
# ADMIN: GET ISSUE
# ---------------------------------------------------------------------------

@router.get("/admin/issues/{issue_id}")
async def get_issue(issue_id: str, authorization: str = Header(default="")):
    _require_admin(authorization)
    sb = get_supabase()
    r  = sb.table("newsletter_issues").select("*").eq("id", issue_id).single().execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Issue not found")
    return r.data


# ---------------------------------------------------------------------------
# ADMIN: UPDATE ISSUE
# ---------------------------------------------------------------------------

@router.patch("/admin/issues/{issue_id}")
async def update_issue(issue_id: str, body: IssueUpdate, authorization: str = Header(default="")):
    _require_admin(authorization)
    sb      = get_supabase()
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    sb.table("newsletter_issues").update(updates).eq("id", issue_id).execute()
    return {"status": "updated"}


# ---------------------------------------------------------------------------
# ADMIN: APPROVE ISSUE
# ---------------------------------------------------------------------------

@router.post("/admin/issues/{issue_id}/approve")
async def approve_issue(issue_id: str, authorization: str = Header(default="")):
    _require_admin(authorization)
    sb = get_supabase()
    sb.table("newsletter_issues").update({
        "status":      "approved",
        "approved_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", issue_id).execute()
    return {"status": "approved"}


# ---------------------------------------------------------------------------
# ADMIN: SEND TEST EMAIL
# ---------------------------------------------------------------------------

@router.post("/admin/issues/{issue_id}/send-test")
async def send_test(issue_id: str, test_email: str = Body(..., embed=True), authorization: str = Header(default="")):
    _require_admin(authorization)
    sb    = get_supabase()
    issue = sb.table("newsletter_issues").select("*").eq("id", issue_id).single().execute()
    if not issue.data:
        raise HTTPException(status_code=404, detail="Issue not found")

    d           = issue.data
    html        = (d.get("html_content") or "").replace("{{unsubscribe_token}}", "test")
    text        = d.get("text_content") or ""
    subject     = d.get('subject', 'Texas Energy Risk Brief')

    result = await _send_via_resend(test_email, subject, html, text, d.get("preview_text"))
    return {"status": "sent" if result else "failed", "to": test_email}


# ---------------------------------------------------------------------------
# ADMIN: SEND TO SEGMENT
# ---------------------------------------------------------------------------

@router.post("/admin/issues/{issue_id}/send")
async def send_issue(
    issue_id: str,
    segment: Optional[str] = Body(None, embed=True),
    authorization: str = Header(default=""),
):
    _require_admin(authorization)
    sb    = get_supabase()
    issue = sb.table("newsletter_issues").select("*").eq("id", issue_id).single().execute()
    if not issue.data:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.data.get("status") not in ("approved",):
        raise HTTPException(status_code=400, detail="Issue must be approved before sending")

    # Fetch subscribers
    query = sb.table("newsletter_subscribers").select("*").eq("status", "active")
    if segment:
        query = query.eq("segment", segment)
    subs  = query.execute().data or []

    if not subs:
        return {"status": "no_subscribers", "sent": 0}

    d           = issue.data
    subject     = d.get("subject", "Texas Energy Risk Brief")
    preview     = d.get("preview_text", "")
    sent        = 0
    failed      = 0

    for sub in subs:
        token   = sub.get("unsubscribe_token", sub["id"])
        html    = (d.get("html_content") or "").replace("{{unsubscribe_token}}", token)
        text    = d.get("text_content") or ""

        ok = await _send_via_resend(sub["email"], subject, html, text, preview)

        # Record send
        sb.table("newsletter_sends").insert({
            "newsletter_issue_id": issue_id,
            "subscriber_id":       sub["id"],
            "email":               sub["email"],
            "status":              "sent" if ok else "failed",
            "sent_at":             datetime.now(timezone.utc).isoformat() if ok else None,
        }).execute()

        # Update last_sent_at
        if ok:
            sb.table("newsletter_subscribers").update({
                "last_sent_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", sub["id"]).execute()
            sent += 1
        else:
            failed += 1

    # Mark issue as sent
    sb.table("newsletter_issues").update({
        "status":  "sent",
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", issue_id).execute()

    log.info(f"[NEWSLETTER] Sent issue {issue_id}: {sent} sent, {failed} failed")
    return {"status": "sent", "sent": sent, "failed": failed}


# ---------------------------------------------------------------------------
# ADMIN: SUBSCRIBERS
# ---------------------------------------------------------------------------

@router.get("/admin/subscribers")
async def list_subscribers(
    authorization: str = Header(default=""),
    status: Optional[str] = None,
    segment: Optional[str] = None,
    limit: int = 100,
):
    _require_admin(authorization)
    sb    = get_supabase()
    query = sb.table("newsletter_subscribers").select("*").order("subscribed_at", desc=True).limit(limit)
    if status:  query = query.eq("status", status)
    if segment: query = query.eq("segment", segment)
    r = query.execute()
    return r.data or []


@router.post("/admin/subscribers")
async def add_subscriber(body: dict = Body(...), authorization: str = Header(default="")):
    _require_admin(authorization)
    sb = get_supabase()
    r  = sb.table("newsletter_subscribers").insert({**body, "source": body.get("source", "manual")}).execute()
    return {"status": "created", "id": r.data[0]["id"] if r.data else None}


@router.patch("/admin/subscribers/{subscriber_id}")
async def update_subscriber(subscriber_id: str, body: dict = Body(...), authorization: str = Header(default="")):
    _require_admin(authorization)
    sb = get_supabase()
    sb.table("newsletter_subscribers").update(body).eq("id", subscriber_id).execute()
    return {"status": "updated"}


# ---------------------------------------------------------------------------
# RESEND WEBHOOK
# ---------------------------------------------------------------------------

@router.post("/webhook/resend")
async def resend_webhook(payload: dict = Body(...)):
    """Process Resend delivery webhooks."""
    event_type = payload.get("type", "")
    data       = payload.get("data", {})
    email_id   = data.get("email_id") or data.get("id")

    sb = get_supabase()

    if not email_id:
        return {"received": True}

    now = datetime.now(timezone.utc).isoformat()
    update: dict = {}

    if event_type == "email.opened":
        update = {"status": "opened", "opened_at": now}
    elif event_type == "email.clicked":
        update = {"status": "clicked", "clicked_at": now}
    elif event_type == "email.bounced":
        update = {"status": "bounced", "bounced_at": now}
        # Mark subscriber as bounced
        send = sb.table("newsletter_sends").select("subscriber_id").eq("resend_message_id", email_id).limit(1).execute()
        if send.data:
            sb.table("newsletter_subscribers").update({"status": "bounced"}).eq("id", send.data[0]["subscriber_id"]).execute()
    elif event_type == "email.complained":
        update = {"status": "complained", "complained_at": now}
        send = sb.table("newsletter_sends").select("subscriber_id").eq("resend_message_id", email_id).limit(1).execute()
        if send.data:
            sb.table("newsletter_subscribers").update({"status": "complained"}).eq("id", send.data[0]["subscriber_id"]).execute()

    if update:
        sb.table("newsletter_sends").update(update).eq("resend_message_id", email_id).execute()

    return {"received": True}


# ---------------------------------------------------------------------------
# RESEND HELPER
# ---------------------------------------------------------------------------

async def _send_via_resend(to: str, subject: str, html: str, text: str, preview: str = "") -> bool:
    if not RESEND_API_KEY:
        log.warning(f"[NEWSLETTER] RESEND_API_KEY not set — skipping send to {to}")
        return False

    payload = {
        "from":    NEWSLETTER_FROM,
        "to":      [to],
        "subject": subject,
        "html":    html,
        "text":    text,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                json=payload,
            )
        if r.status_code in (200, 201):
            log.info(f"[NEWSLETTER] Sent to {to} — {r.status_code}")
            return True
        else:
            log.warning(f"[NEWSLETTER] Failed to send to {to}: {r.status_code} {r.text}")
            return False
    except Exception as e:
        log.error(f"[NEWSLETTER] Exception sending to {to}: {e}")
        return False
