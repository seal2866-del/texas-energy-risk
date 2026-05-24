from fastapi import APIRouter, Query
from services.external_apis import fetch_gas_data

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
