"""
stripe_webhooks.py
Handles Stripe webhook events for subscription lifecycle management.
"""
import os
import stripe
from fastapi import APIRouter, Request, HTTPException
from services.supabase_client import get_supabase

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")


@router.post("/stripe")
async def stripe_webhook(request: Request):
    payload   = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    sb = get_supabase()
    etype = event["type"]
    data  = event["data"]["object"]

    if etype == "checkout.session.completed":
        _handle_checkout_completed(sb, data)

    elif etype in ("customer.subscription.updated", "customer.subscription.created"):
        _handle_subscription_updated(sb, data)

    elif etype == "customer.subscription.deleted":
        _handle_subscription_deleted(sb, data)

    elif etype == "invoice.payment_failed":
        _handle_payment_failed(sb, data)

    return {"received": True}


# ── Event handlers ────────────────────────────────────────────

def _handle_checkout_completed(sb, session):
    customer_id = session.get("customer")
    sub_id      = session.get("subscription")
    user_email  = session.get("customer_email") or session.get("customer_details", {}).get("email")

    if not user_email:
        return

    user = sb.table("users").select("id").eq("email", user_email).single().execute()
    if not user.data:
        return

    user_id = user.data["id"]

    sb.table("subscriptions").upsert({
        "user_id":                user_id,
        "stripe_customer_id":     customer_id,
        "stripe_subscription_id": sub_id,
        "plan":                   "pro",
        "status":                 "active",
    }, on_conflict="user_id").execute()

    sb.table("users").update({"tier": "pro"}).eq("id", user_id).execute()


def _handle_subscription_updated(sb, subscription):
    sub_id = subscription.get("id")
    status = subscription.get("status")
    plan   = "pro" if status == "active" else "free"

    from datetime import datetime, timezone
    period_start = subscription.get("current_period_start")
    period_end   = subscription.get("current_period_end")

    result = (
        sb.table("subscriptions")
        .update({
            "status": status,
            "plan":   plan,
            "current_period_start": datetime.fromtimestamp(period_start, timezone.utc).isoformat() if period_start else None,
            "current_period_end":   datetime.fromtimestamp(period_end, timezone.utc).isoformat() if period_end else None,
            "cancel_at_period_end": subscription.get("cancel_at_period_end", False),
        })
        .eq("stripe_subscription_id", sub_id)
        .execute()
    )

    if result.data:
        user_id = result.data[0].get("user_id")
        if user_id:
            sb.table("users").update({"tier": plan}).eq("id", user_id).execute()


def _handle_subscription_deleted(sb, subscription):
    sub_id = subscription.get("id")
    result = (
        sb.table("subscriptions")
        .update({"status": "canceled", "plan": "free"})
        .eq("stripe_subscription_id", sub_id)
        .execute()
    )
    if result.data:
        user_id = result.data[0].get("user_id")
        if user_id:
            sb.table("users").update({"tier": "free"}).eq("id", user_id).execute()


def _handle_payment_failed(sb, invoice):
    customer_id = invoice.get("customer")
    sb.table("subscriptions").update({"status": "past_due"}).eq(
        "stripe_customer_id", customer_id
    ).execute()
