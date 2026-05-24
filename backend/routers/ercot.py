from fastapi import APIRouter, Query
from services.external_apis import fetch_ercot_prices

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
    prices = await fetch_ercot_prices(hours=2, settlement_point=settlement_point)
    return {
        "current":    prices[-1] if prices else None,
        "previous":   prices[-2] if len(prices) >= 2 else None,
        "disclaimer": "Informational only. Not investment or trading advice.",
    }
