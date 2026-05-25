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


@router.get("/debug")
async def debug_cdr():
    """
    Diagnostic endpoint — tests ERCOT CDR connectivity.
    Returns raw HTTP status, content-type, and first 500 chars.
    Purely informational; no price data stored.
    """
    import os, httpx
    from services.external_apis import ERCOT_CDR_URLS, ERCOT_HOME_URL, _ERCOT_HEADERS, get_cache_status
    results = []
    async with httpx.AsyncClient(timeout=20, headers=_ERCOT_HEADERS, follow_redirects=True) as client:
        try:
            pf = await client.get(ERCOT_HOME_URL)
            results.append({"url": ERCOT_HOME_URL, "status": pf.status_code,
                            "cookies": len(client.cookies), "len": len(pf.text)})
        except Exception as e:
            results.append({"url": ERCOT_HOME_URL, "error": str(e)})
        for url in ERCOT_CDR_URLS:
            try:
                r = await client.get(url)
                results.append({
                    "url":     url,
                    "status":  r.status_code,
                    "ct":      r.headers.get("content-type", "?")[:60],
                    "len":     len(r.text),
                    "preview": r.text[:500],
                })
            except Exception as e:
                results.append({"url": url, "error": str(e)})
    cache = get_cache_status("HB_HOUSTON")
    return {
        "cache":   cache,
        "enabled": os.getenv("ERCOT_API_ENABLED", "false"),
        "cdr_tests": results,
        "disclaimer": "Informational only.",
    }
