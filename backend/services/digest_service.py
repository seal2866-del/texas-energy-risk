"""
digest_service.py — Morning Risk Digest
Fetches current signals and sends a 7am CT morning brief to all opted-in users.
Called by APScheduler in main.py and exposed via routers/digest.py manual trigger.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from services.supabase_client import get_supabase
from services.alert_service   import _build_daily_summary_email, _send_email, _subject

log = logging.getLogger(__name__)


# ── Fetch opted-in users ───────────────────────────────────────

def _get_digest_users() -> List[Dict[str, Any]]:
    """Return rows from alert_preferences where digest_enabled = true."""
    try:
        sb   = get_supabase()
        resp = sb.table("alert_preferences").select("*").eq("digest_enabled", True).execute()
        return resp.data or []
    except Exception as exc:
        log.error("[DIGEST] Failed to query digest users: %s", exc)
        return []


def _get_user_email(user_id: str) -> Optional[str]:
    """Look up auth email for a user_id."""
    try:
        sb   = get_supabase()
        resp = sb.auth.admin.get_user_by_id(user_id)
        return resp.user.email if resp.user else None
    except Exception as exc:
        log.warning("[DIGEST] Could not fetch email for %s: %s", user_id, exc)
        return None


# ── Fetch current signals ──────────────────────────────────────

async def _get_signals() -> Optional[Dict[str, Any]]:
    """Pull latest computed signals from the signal engine."""
    try:
        from services.signal_engine import compute_signals
        result = await compute_signals()
        return result
    except Exception as exc:
        log.error("[DIGEST] Failed to fetch signals: %s", exc)
        return None


# ── Core send logic ────────────────────────────────────────────

async def send_morning_digest() -> Dict[str, Any]:
    """
    Main entry point — called by APScheduler at 7am CT and via manual trigger.
    Returns a summary: { sent, skipped, failed, total }.
    """
    log.info("[DIGEST] Morning digest run starting")

    signals = await _get_signals()
    if not signals:
        log.warning("[DIGEST] No signals available — aborting digest run")
        return {"sent": 0, "skipped": 0, "failed": 0, "total": 0, "error": "signals unavailable"}

    users   = _get_digest_users()
    total   = len(users)
    sent    = 0
    skipped = 0
    failed  = 0

    computed_str = datetime.now(timezone.utc).strftime("%b %d, %Y")

    for row in users:
        user_id = row.get("user_id")
        city    = row.get("city", "Houston")

        # Prefer explicit digest_email, fall back to auth email
        to_email = row.get("digest_email") or _get_user_email(user_id)
        if not to_email:
            log.warning("[DIGEST] No email for user %s — skipping", user_id)
            skipped += 1
            continue

        try:
            html      = _build_daily_summary_email(signals, city, computed_str)
            subject   = _subject("daily_summary")
            delivered = await _send_email(to_email, subject, html)
            if delivered:
                sent += 1
                log.info("[DIGEST] Sent to %s (%s)", to_email, user_id)
            else:
                failed += 1
                log.warning("[DIGEST] Send failed for %s", to_email)
        except Exception as exc:
            failed += 1
            log.error("[DIGEST] Error sending to %s: %s", to_email, exc)

    summary = {"sent": sent, "skipped": skipped, "failed": failed, "total": total}
    log.info("[DIGEST] Run complete — %s", summary)
    return summary
