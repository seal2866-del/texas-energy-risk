from fastapi import APIRouter, Query
from services.external_apis import fetch_gas_data, fetch_henry_hub_price

router = APIRouter(prefix="/api/gas", tags=["Natural Gas"])


@router.get("/storage")
async def get_storage(weeks: int = Query(default=8, ge=1, le=52)):
    """
    Returns EIA natural gas storage data with supply pressure signal.
    Informational only — not trading or procurement advice.
    """
    records = await fetch_gas_data(weeks=weeks)
    return {
        "weeks":      weeks,
        "records":    records,
        "latest":     records[-1] if records else None,
        "disclaimer": "Informational only. Not trading or procurement advice.",
    }


@router.get("/henry-hub")
async def get_henry_hub():
    """
    Returns Henry Hub natural gas spot price with daily/weekly change,
    market state classification, and watch threshold.

    Market States:
      normal   — < $3.00/MMBtu
      watch    — $3.00–$4.00/MMBtu
      elevated — $4.00–$6.00/MMBtu
      critical — > $6.00/MMBtu

    Informational only — not trading or procurement advice.
    """
    data = await fetch_henry_hub_price()
    return {
        **data,
        "thresholds": {
            "normal":   3.00,
            "watch":    4.00,
            "elevated": 6.00,
            "critical": 6.00,
        },
        "disclaimer": "Informational only. Not trading or procurement advice.",
    }
