from fastapi import APIRouter, Query
from services.external_apis import fetch_ercot_prices, fetch_current_ercot_price, fetch_all_hub_prices

router = APIRouter(prefix="/api/ercot", tags=["ERCOT"])


@router.get("/prices")
async def get_prices(
    hours: int = Query(default=24, ge=1, le=168),
    settlement_point: str = Query(default="HB_HOUSTON"),
):
    """
    Returns ERCOT real-time prices for the requested window.
    Data is informational only and does not constitute trading advice.
    """
    prices = await fetch_ercot_prices(hours=hours, settlement_point=settlement_point)
    return {
        "settlement_point": settlement_point,
        "hours_requested":  hours,
        "count":            len(prices),
        "prices":           prices,
        "disclaimer":       "Informational only. Not investment or trading advice.",
    }


@router.get("/prices/current")
async def get_current_price(
    settlement_point: str = Query(default="HB_HOUSTON"),
):
    current = await fetch_current_ercot_price(settlement_point=settlement_point)
    return {
        "current":    current,
        "disclaimer": "Informational only. Not investment or trading advice.",
    }


@router.get("/prices/hubs")
async def get_all_hub_prices():
    """Returns current LMP for all Texas trading hubs."""
    hubs = await fetch_all_hub_prices()
    return {
        "hubs":       hubs,
        "disclaimer": "Informational only. Not investment or trading advice.",
    }
