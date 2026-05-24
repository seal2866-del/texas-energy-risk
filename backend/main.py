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
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import ercot, weather, gas, signals, alerts, stripe_webhooks, stripe_checkout

load_dotenv()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENVIRONMENT  = os.getenv("ENVIRONMENT", "development")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🔋 Texas Energy Risk Platform API starting...")
    yield
    print("🔋 API shutting down.")


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


# ── Health check ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "texas-energy-risk-api", "version": "1.0.0"}


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
