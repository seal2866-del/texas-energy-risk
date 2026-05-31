import os
import httpx
from fastapi import APIRouter, Query
from services.external_apis import fetch_gas_data, fetch_henry_hub_price, _HENRY_HUB_CACHE

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


@router.get("/henry-hub/debug")
async def debug_henry_hub():
    """Debug endpoint — shows raw EIA API responses for Henry Hub."""
    api_key = os.getenv("EIA_API_KEY", "")
    results = {"api_key_set": bool(api_key), "strategies": {}}

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        # Strategy 1: EIA v1
        try:
            r = await client.get("https://api.eia.gov/series/", params={
                "api_key": api_key, "series_id": "NG.RNGWHHD.D", "num": "5"
            })
            body = r.json()
            series = body.get("series", [{}])
            results["strategies"]["v1_RNGWHHD"] = {
                "status": r.status_code,
                "data_points": len(series[0].get("data", [])) if series else 0,
                "sample": series[0].get("data", [])[:3] if series else [],
                "error": body.get("data", {}).get("error") if not series else None,
            }
        except Exception as e:
            results["strategies"]["v1_RNGWHHD"] = {"error": str(e)}

        # Strategy 2: EIA v2 spot
        try:
            url = (f"https://api.eia.gov/v2/natural-gas/pri/spot/data/"
                   f"?api_key={api_key}&frequency=daily&data[]=value"
                   f"&facets[series][]=RNGWHHD&sort[0][column]=period&sort[0][direction]=desc&length=5")
            r = await client.get(url)
            body = r.json()
            rows = body.get("response", {}).get("data", [])
            results["strategies"]["v2_spot_RNGWHHD"] = {
                "status": r.status_code,
                "rows": len(rows),
                "sample": rows[:3],
            }
        except Exception as e:
            results["strategies"]["v2_spot_RNGWHHD"] = {"error": str(e)}

        # Strategy 3: EIA v2 futures browse
        try:
            url = (f"https://api.eia.gov/v2/natural-gas/pri/fut/data/"
                   f"?api_key={api_key}&frequency=daily&data[]=value"
                   f"&sort[0][column]=period&sort[0][direction]=desc&length=3")
            r = await client.get(url)
            body = r.json()
            rows = body.get("response", {}).get("data", [])
            results["strategies"]["v2_futures"] = {
                "status": r.status_code,
                "rows": len(rows),
                "sample": rows[:3],
            }
        except Exception as e:
            results["strategies"]["v2_futures"] = {"error": str(e)}

    results["cache_has_data"] = bool(_HENRY_HUB_CACHE.get("latest"))
    return results
