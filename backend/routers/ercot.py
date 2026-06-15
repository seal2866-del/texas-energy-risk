from fastapi import APIRouter, Query
from services.external_apis import fetch_ercot_prices, fetch_current_ercot_price, fetch_all_hub_prices

router = APIRouter(prefix="/api/ercot", tags=["ERCOT"])


@router.get("/prices")
async def get_prices(
    hours: int = Query(default=24, ge=1, le=168),
    settlement_point: str = Query(default="HB_HOUSTON"),
):
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
    hubs = await fetch_all_hub_prices()
    return {
        "hubs":       hubs,
        "disclaimer": "Informational only. Not investment or trading advice.",
    }


@router.get("/debug")
async def debug_cdr():
    """
    Diagnostic endpoint. Returns CDR connectivity info AND a fresh parsed
    price bypassing the in-memory cache (cdr_live_price) so the hourly
    consistency check can catch systematic parser errors (wrong column/row).
    """
    import os, httpx
    from services.external_apis import (
        ERCOT_CDR_URLS, ERCOT_HOME_URL, _ERCOT_HEADERS,
        get_cache_status, _parse_ercot_cdr,
    )
    results = []
    cdr_live_price = None
    cdr_live_source = None

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
                if cdr_live_price is None and r.status_code == 200 and len(r.text) > 200:
                    parsed = _parse_ercot_cdr(r.text, "HB_HOUSTON")
                    if parsed is not None:
                        cdr_live_price = parsed
                        cdr_live_source = url.split("/")[-1]
            except Exception as e:
                results.append({"url": url, "error": str(e)})

    cache = get_cache_status("HB_HOUSTON")
    cache_price = cache.get("latest_price")
    drift = None
    drift_alert = False
    if cdr_live_price is not None and cache_price is not None:
        drift = round(cdr_live_price - cache_price, 2)
        drift_alert = abs(drift) > 3.0

    return {
        "cache":           cache,
        "cdr_live_price":  cdr_live_price,
        "cdr_live_source": cdr_live_source,
        "drift":           drift,
        "drift_alert":     drift_alert,
        "enabled":         os.getenv("ERCOT_API_ENABLED", "false"),
        "cdr_tests":       results,
        "disclaimer":      "Informational only.",
    }


@router.get("/grid")
async def get_grid_conditions():
    from services.grid_conditions import fetch_grid_conditions
    return await fetch_grid_conditions()
