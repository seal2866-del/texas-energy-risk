"""
stripe_checkout.py
Creates Stripe Checkout sessions for Pro subscription upgrades.
"""
import os
import stripe
import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from services.supabase_client import get_supabase

router = APIRouter(prefix="/api/stripe", tags=["Stripe"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")


class CheckoutRequest(BaseModel):
    price_id:    str
    success_url: str
    cancel_url:  str


class _UserInfo:
    def __init__(self, id: str, email: str):
        self.id    = id
        self.email = email


async def _get_user(authorization: str) -> _UserInfo:
    """Verify the Supabase JWT by calling /auth/v1/user directly (async).
    Works with any signing algorithm (HS256, ES256, etc.)."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]

    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key  = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": service_key,
                },
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Could not reach auth server: {exc}")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail=f"Invalid token: {resp.text}")

    data = resp.json()
    return _UserInfo(id=data["id"], email=data.get("email", ""))


@router.post("/create-checkout")
async def create_checkout(
    body: CheckoutRequest,
    authorization: str = Header(default=""),
):
    """Creates a Stripe Checkout session and returns the redirect URL."""
    try:
        user = await _get_user(authorization)

        # Look up or create Stripe customer
        sb = get_supabase()
        sub = sb.table("subscriptions").select("stripe_customer_id").eq("user_id", user.id).limit(1).execute()
        customer_id = sub.data[0].get("stripe_customer_id") if sub.data else None

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

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Checkout error: {exc}")


@router.post("/create-portal")
async def create_portal(
    return_url: str,
    authorization: str = Header(default=""),
):
    """Creates a Stripe Billing Portal session so users can manage their subscription."""
    try:
        user = await _get_user(authorization)
        sb = get_supabase()
        sub = sb.table("subscriptions").select("stripe_customer_id").eq("user_id", user.id).limit(1).execute()

        if not sub.data or not sub.data[0].get("stripe_customer_id"):
            raise HTTPException(status_code=404, detail="No Stripe customer found")

        session = stripe.billing_portal.Session.create(
            customer=sub.data[0]["stripe_customer_id"],
            return_url=return_url,
        )
        return {"url": session.url}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Portal error: {exc}")
