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
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron      import CronTrigger

from routers import ercot, weather, gas, signals, alerts, stripe_webhooks, stripe_checkout, ai_reasoning, export
from routers import digest, grid, history

# Optional routers — loaded with try/except so a failure doesn't crash the whole app
_optional_routers = []
for _mod_name in ["chatbot", "newsletter", "prospecting"]:
    try:
        import importlib as _il
        _mod = _il.import_module(f"routers.{_mod_name}")
        _optional_routers.append(_mod)
    except Exception as _e:
        import logging as _log
        _log.getLogger(__name__).warning("[STARTUP] Optional router '%s' failed to load: %s", _mod_name, _e)

load_dotenv()

log = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENVIRONMENT  = os.getenv("ENVIRONMENT", "development")

# ── Background price poller ───────────────────────────────────
# Keeps the in-memory ERCOT price cache warm regardless of user traffic.
# Polls immediately on startup then every POLL_INTERVAL_SECONDS.
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
    run_all_signals → save_snapshot, so the grid map and analytics pages
    have fresh data for all 8 locations.
    """
    from services.external_apis  import fetch_ercot_prices, fetch_weather_forecast, fetch_gas_data
    from services.signal_engine  import run_all_signals
    from services.snapshot_service import save_snapshot

    # Brief pause to let FastAPI fully start before first pass
    await asyncio.sleep(15)

    log.info("[GRID-POLLER] Multi-location signal poller starting (interval=%ds, %d cities)",
             GRID_POLL_INTERVAL_SECS, len(GRID_LOCATIONS))

    while True:
        for loc in GRID_LOCATIONS:
            try:
                prices_r, wx_r, gas_r = await asyncio.gather(
                    fetch_ercot_prices(hours=6, settlement_point="HB_HOUSTON"),
                    fetch_weather_forecast(location=loc, days=3),
                    fetch_gas_data(weeks=4),
                    return_exceptions=True,
                )
                prices     = prices_r if not isinstance(prices_r, Exception) else []
                forecasts  = wx_r     if not isinstance(wx_r,     Exception) else []
                gas_data   = gas_r    if not isinstance(gas_r,    Exception) else {}

                gas_records = gas_data.get("records", []) if isinstance(gas_data, dict) else []
                gas_latest  = gas_data.get("latest",  None) if isinstance(gas_data, dict) else None

                result = run_all_signals(prices, forecasts, gas_records, location=loc)

                ercot_latest = prices[-1].price_mwh if prices and hasattr(prices[-1], "price_mwh") else None
                henry_hub    = gas_latest.henry_hub_price if gas_latest and hasattr(gas_latest, "henry_hub_price") else None
                await save_snapshot(result, loc, ercot_latest, henry_hub)
                log.info("[GRID-POLLER] %s → %s", loc, result.get("risk_score", "?"))

            except Exception as exc:
                log.warning("[GRID-POLLER] Failed for %s: %s", loc, exc)

            # Brief pause between cities to avoid thundering-herd on external APIs
            await asyncio.sleep(10)

        log.info("[GRID-POLLER] Full grid pass complete. Next in %ds.", GRID_POLL_INTERVAL_SECS)
        await asyncio.sleep(GRID_POLL_INTERVAL_SECS)


async def _ercot_price_loop():
    """Background task: fetch ERCOT CDR price every POLL_INTERVAL_SECONDS."""
    from services.external_apis import fetch_ercot_prices, get_cache_status
    enabled = os.getenv("ERCOT_API_ENABLED", "false").lower() == "true"

    if not enabled:
        log.info("[POLLER] ERCOT_API_ENABLED=false — price poller idle (dev mode)")
        return

    log.info("[POLLER] ERCOT price poller starting (interval=%ds)", POLL_INTERVAL_SECONDS)

    while True:
        try:
            prices = await fetch_ercot_prices(hours=24, settlement_point="HB_HOUSTON")
            status = get_cache_status("HB_HOUSTON")
            log.info(
                "[POLLER] Poll complete — cache=%d readings, latest=%.2f",
                status["real_readings"],
                status["latest_price"] or 0,
            )
        except Exception as exc:
            log.warning("[POLLER] Poll error: %s", exc)
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Background ERCOT price poller ────────────────────────────
    task = asyncio.create_task(_ercot_price_loop())
    log.info("[STARTUP] Background ERCOT price poller scheduled")

    # ── Multi-location grid signal poller ─────────────────────────
    grid_task = asyncio.create_task(_grid_signal_loop())
    log.info("[STARTUP] Multi-location grid poller scheduled (%d cities, every %ds)",
             len(GRID_LOCATIONS), GRID_POLL_INTERVAL_SECS)

    # ── Morning digest scheduler (7am CT = 12:00 UTC) ────────────
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
    for t in (task, grid_task):
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass
    log.info("[SHUTDOWN] Price poller + grid poller + digest scheduler stopped")


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

# ── CORS ──────────────────────────────────────────────────────
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
    allow_origins=["*"],   # open for now — tighten after admin is working
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
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
for _opt in _optional_routers:
    app.include_router(_opt.router)


# ── Health check ──────────────────────────────────────────────
@app.get("/health")
async def health():
    from services.external_apis import get_cache_status
    cache = get_cache_status("HB_HOUSTON")
    return {
        "status":        "ok",
        "service":       "texas-energy-risk-api",
        "version":       "1.0.0",
        "ercot_cache":  