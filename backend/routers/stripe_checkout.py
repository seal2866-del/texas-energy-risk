"""
stripe_checkout.py
Creates Stripe Checkout sessions for Pro subscription upgrades.
"""
import os
import stripe
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from services.supabase_client import get_supabase

router = APIRouter(prefix="/api/stripe", tags=["Stripe"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")


class CheckoutRequest(BaseModel):
    price_id:    str
    success_url: str
    cancel_url:  str


def _get_user(authorization: str):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    sb = get_supabase()
    try:
        return sb.auth.get_user(token).user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/create-checkout")
async def create_checkout(
    body: CheckoutRequest,
    authorization: str = Header(default=""),
):
    """Creates a Stripe Checkout session and returns the redirect URL."""
    user = _get_user(authorization)

    # Look up or create Stripe customer
    sb = get_supabase()
    sub = sb.table("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybe_single().execute()
    customer_id = sub.data.get("stripe_customer_id") if sub.data else None

    if not customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            metadata={"supabase_user_id": user.id},
        )
        customer_id = customer.id

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": body.price_id, "quantity": 1}],
        mode="subscription",
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        customer_update={"address": "auto"},
        metadata={"supabase_user_id": user.id},
    )

    return {"url": session.url}


@router.post("/create-portal")
async def create_portal(
    return_url: str,
    authorization: str = Header(default=""),
):
    """Creates a Stripe Billing Portal session so users can manage their subscription."""
    user = _get_user(authorization)
    sb = get_supabase()
    sub = sb.table("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybe_single().execute()

    if not sub.data or not sub.data.get("stripe_customer_id"):
        raise HTTPException(status_code=404, detail="No Stripe customer found")

    session = stripe.billing_portal.Session.create(
        customer=sub.data["stripe_customer_id"],
        return_url=return_url,
    )
    return {"url": session.url}
