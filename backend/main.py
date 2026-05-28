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
from routers import digest

load_dotenv()

log = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENVIRONMENT  = os.getenv("ENVIRONMENT", "development")

# ── Background price poller ───────────────────────────────────
# Keeps the in-memory ERCOT price cache warm regardless of user traffic.
# Polls immediately on startup then every POLL_INTERVAL_SECONDS.
POLL_INTERVAL_SECONDS = int(os.getenv("ERCOT_POLL_INTERVAL", "300"))   # default 5 min


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
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    log.info("[SHUTDOWN] Price poller + digest scheduler stopped")


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
origins = [FRONTEND_URL]
if ENVIRONMENT == "development":
    origins += ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
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


# ── Health check ──────────────────────────────────────────────
@app.get("/health")
async def health():
    from services.external_apis import get_cache_status
    cache = get_cache_status("HB_HOUSTON")
    return {
        "status":        "ok",
        "service":       "texas-energy-risk-api",
        "version":       "1.0.0",
        "ercot_cache":   cache,
        "ercot_enabled": os.getenv("ERCOT_API_ENABLED", "false"),
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
