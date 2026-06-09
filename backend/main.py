"""
main.py — Texas Energy Risk Alert Platform API
FastAPI backend. Deploy on Railway.

LEGAL DISCLAIMER: All data and signals provided by this API are for
informational purposes only. They do not constitute investment, trading,
financial, or procurement advice. Risk assessments are probabilistic and
may not reflect actual market conditions. Always consult qualified
professionals before making decisions.
"""
import os
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron      import CronTrigger

from routers import ercot, weather, gas, signals, alerts, stripe_webhooks, stripe_checkout, ai_reasoning, export
from routers import digest, grid, history

try:
    from routers import newsletter, prospecting
    _has_newsletter = True
except Exception:
    _has_newsletter = False

# Chatbot router loaded separately -- disabled until startup crash is resolved
_has_chatbot = False
try:
    from routers import chatbot as _chatbot_router
    _has_chatbot = True
except Exception as _chatbot_err:
    import logging as _clog
    _clog.getLogger(__name__).warning("[STARTUP] Chatbot router skipped: %s", _chatbot_err)

load_dotenv()

log = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENVIRONMENT  = os.getenv("ENVIRONMENT", "development")

# Background price poller
# Keeps the in-memory ERCOT price cache warm regardless of user traffic.
POLL_INTERVAL_SECONDS    = int(os.getenv("ERCOT_POLL_INTERVAL", "300"))    # default 5 min
GRID_POLL_INTERVAL_SECS  = int(os.getenv("GRID_POLL_INTERVAL",  "300"))    # default 5 min

# All cities that need background signal snapshots
GRID_LOCATIONS = [
    "Houston", "Dallas", "Austin", "San Antonio",
    "Midland", "Odessa", "Corpus Christi", "Lubbock",
]


async def _grid_signal_loop():
    """
    Background task: run the signal engine for every monitored city every
    GRID_POLL_INTERVAL_SECS.  Snapshots are written as a side-effect of
    run_all_signals -> save_snapshot, so the grid map and analytics pages
    have fresh data for all 8 locations.
    """
    from services.external_apis  import fetch_ercot_prices, fetch_weather_forecast, fetch_gas_data, fetch_henry_hub_price
    from services.signal_engine  import run_all_signals
    from services.snapshot_service import save_snapshot

    # Brief pause to let FastAPI fully start before first pass
    await asyncio.sleep(15)

    log.info("[GRID-POLLER] Multi-location signal poller starting (interval=%ds, %d cities)",
             GRID_POLL_INTERVAL_SECS, len(GRID_LOCATIONS))

    while True:
        for loc in GRID_LOCATIONS:
            try:
                prices_r, wx_r, gas_r, hh_r = await asyncio.gather(
                    fetch_ercot_prices(hours=6, settlement_point="HB_HOUSTON"),
                    fetch_weather_forecast(location=loc, days=3),
                    fetch_gas_data(weeks=4),
                    fetch_henry_hub_price(),
                    return_exceptions=True,
                )
                prices         = prices_r if not isinstance(prices_r, Exception) else []
                forecasts      = wx_r     if not isinstance(wx_r,     Exception) else []
                henry_hub_data = hh_r     if not isinstance(hh_r,     Exception) else {}

                # fetch_gas_data() returns List[Dict] -- treat it directly
                gas_records = gas_r if isinstance(gas_r, list) else []

                # Inject real Henry Hub price into gas records (overrides hardcoded $2.80)
                if isinstance(henry_hub_data, dict) and henry_hub_data.get("price"):
                    real_hh = henry_hub_data["price"]
                    for record in gas_records:
                        record["henry_hub_price"] = real_hh

                result = run_all_signals(prices, forecasts, gas_records, location=loc, henry_hub_data=henry_hub_data)

                # price records are dicts -- use .get()
                ercot_latest = prices[-1].get("price_mwh") if prices and isinstance(prices[-1], dict) else None
                henry_hub    = henry_hub_data.get("price") if isinstance(henry_hub_data, dict) else None
                await save_snapshot(result, loc, ercot_latest, henry_hub)
                log.info("[GRID-POLLER] %s -> %s", loc, result.get("risk_score", "?"))

            except Exception as exc:
                log.warning("[GRID-POLLER] Failed for %s: %s", loc, exc)

            # Brief pause between cities to avoid thundering-herd on external APIs
            await asyncio.sleep(10)

        log.info("[GRID-POLLER] Full grid pass complete. Next in %ds.", GRID_POLL_INTERVAL_SECS)
        await asyncio.sleep(GRID_POLL_INTERVAL_SECS)


async def _price_watchdog_loop():
    """
    Watchdog: every 5 minutes, check how old the latest cached ERCOT price is.
    If stale (>15 min), log CRITICAL so Railway surfaces it immediately in the log stream.
    A throttled secondary alert fires via alert_service at most once every 30 minutes.
    Only active when ERCOT_API_ENABLED=true.
    """
    from services.external_apis import get_cache_status

    STALE_THRESHOLD_MIN = 15
    CHECK_INTERVAL_SECS = 300    # 5 min
    ALERT_THROTTLE_SECS = 1800   # re-alert at most once per 30 min

    # Wait for the first poll cycle to complete before starting checks
    await asyncio.sleep(90)

    enabled = os.getenv("ERCOT_API_ENABLED", "false").lower() == "true"
    if not enabled:
        log.info("[WATCHDOG] ERCOT_API_ENABLED=false -- price watchdog idle")
        return

    log.info("[WATCHDOG] ERCOT price watchdog started (stale_threshold=%d min)", STALE_THRESHOLD_MIN)
    last_alert_at = None

    while True:
        try:
            status      = get_cache_status("HB_HOUSTON")
            age_secs    = status.get("last_updated_seconds_ago")
            age_minutes = (age_secs / 60.0) if age_secs is not None else None

            if age_minutes is None:
                log.critical(
                    "[WATCHDOG] ERCOT price cache EMPTY -- no readings since startup. "
                    "CDR fetch may be failing. Check /api/ercot/debug."
                )
            elif age_minutes > STALE_THRESHOLD_MIN:
                log.critical(
                    "[WATCHDOG] ERCOT price STALE: %.1f min since last update "
                    "(threshold=%d min). Last: $%s/MWh @ %s source=%s",
                    age_minutes, STALE_THRESHOLD_MIN,
                    status.get("latest_price"), status.get("newest"), status.get("source"),
                )
                now = datetime.now(timezone.utc)
                if last_alert_at is None or (now - last_alert_at).total_seconds() > ALERT_THROTTLE_SECS:
                    last_alert_at = now
                    try:
                        from services.alert_service import send_admin_alert
                        await send_admin_alert(
                            subject="[Texas Grid Intel] ERCOT Price Feed Stale",
                            message=(
                                f"ERCOT HB_HOUSTON has not updated in {age_minutes:.0f} min "
                                f"(threshold {STALE_THRESHOLD_MIN} min).\n"
                                f"Last: ${status.get('latest_price')}/MWh at {status.get('newest')}.\n"
                                f"Check Railway logs + /api/ercot/debug."
                            ),
                        )
                    except Exception as ae:
                        log.warning("[WATCHDOG] Secondary alert failed (non-fatal): %s", ae)
            else:
                log.debug("[WATCHDOG] ERCOT price OK -- %.1f min old", age_minutes)

        except Exception as exc:
            log.warning("[WATCHDOG] Check error: %s", exc)

        await asyncio.sleep(CHECK_INTERVAL_SECS)


async def _ercot_price_loop():
    """Background task: fetch ERCOT CDR price every POLL_INTERVAL_SECONDS."""
    from services.external_apis import fetch_ercot_prices, get_cache_status
    enabled = os.getenv("ERCOT_API_ENABLED", "false").lower() == "true"

    if not enabled:
        log.info("[POLLER] ERCOT_API_ENABLED=false -- price poller idle (dev mode)")
        return

    log.info("[POLLER] ERCOT price poller starting (interval=%ds)", POLL_INTERVAL_SECONDS)

    while True:
        try:
            prices = await fetch_ercot_prices(hours=24, settlement_point="HB_HOUSTON")
            status = get_cache_status("HB_HOUSTON")
            log.info(
                "[POLLER] Poll complete -- cache=%d readings, latest=%.2f",
                status["real_readings"],
                status["latest_price"] or 0,
            )
        except Exception as exc:
            log.warning("[POLLER] Poll error: %s", exc)
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Background ERCOT price poller
    task = asyncio.create_task(_ercot_price_loop())
    log.info("[STARTUP] Background ERCOT price poller scheduled")

    # Staleness watchdog
    watchdog_task = asyncio.create_task(_price_watchdog_loop())
    log.info("[STARTUP] ERCOT price staleness watchdog scheduled (stale_threshold=15 min)")

    # Multi-location grid signal poller
    grid_task = asyncio.create_task(_grid_signal_loop())
    log.info("[STARTUP] Multi-location grid poller scheduled (%d cities, every %ds)",
             len(GRID_LOCATIONS), GRID_POLL_INTERVAL_SECS)

    # Morning digest scheduler (7am CT = 12:00 UTC)
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _run_morning_digest,
        CronTrigger(hour=12, minute=0, timezone="UTC"),   # 7am CDT / 8am CST
        id="morning_digest",
        replace_existing=True,
    )
    scheduler.start()
    log.info("[STARTUP] Morning digest scheduler started (07:00 CT daily)")

    yield

    scheduler.shutdown(wait=False)
    for t in (task, watchdog_task, grid_task):
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass
    log.info("[SHUTDOWN] Price poller + watchdog + grid poller + digest scheduler stopped")


async def _run_morning_digest():
    """Wrapper so APScheduler can call the async digest function."""
    from services.digest_service import send_morning_digest
    await send_morning_digest()


app = FastAPI(
    title="Texas Energy Risk Alert Platform API",
    description=(
        "Informational energy market risk signals for Texas. "
        "Not investment, trading, or procurement advice."
    ),
    version="1.0.0",
    docs_url="/docs" if ENVIRONMENT == "development" else None,
    redoc_url=None,
    lifespan=lifespan,
)

# CORS
origins = [
    FRONTEND_URL,
    "https://texasgridintel.com",
    "https://www.texasgridintel.com",
    "https://texas-energy-risk.vercel.app",
    "https://texas-energy-risk-production.up.railway.app",
]
if ENVIRONMENT == "development":
    origins += ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # open for now -- tighten after admin is working
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(ercot.router)
app.include_router(weather.router)
app.include_router(gas.router)
app.include_router(signals.router)
app.include_router(alerts.router)
app.include_router(stripe_webhooks.router)
app.include_router(stripe_checkout.router)
app.include_router(ai_reasoning.router)
app.include_router(export.router)
app.include_router(digest.router)
app.include_router(grid.router)
app.include_router(history.router)
if _has_chatbot:
    app.include_router(_chatbot_router.router)
if _has_newsletter:
    app.include_router(newsletter.router)
    app.include_router(prospecting.router)


# Health check
@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    from services.external_apis import get_cache_status
    cache       = get_cache_status("HB_HOUSTON")
    age_secs    = cache.get("last_updated_seconds_ago")
    age_minutes = round(age_secs / 60.0, 1) if age_secs is not None else None
    is_stale    = (age_minutes is None) or (age_minutes > 15)
    return {
        "status":               "ok",
        "service":              "texas-energy-risk-api",
        "version":              "1.0.0",
        "ercot_cache":          cache,
        "ercot_price_age_min":  age_minutes,
        "ercot_price_stale":    is_stale,
        "ercot_enabled":        os.getenv("ERCOT_API_ENABLED", "false"),
    }


@app.get("/")
async def root():
    return {
        "service":    "Texas Energy Risk Alert Platform API",
        "version":    "1.0.0",
        "disclaimer": (
            "All signals and data are for informational purposes only. "
            "Not investment, trading, or procurement advice."
        ),
    }
