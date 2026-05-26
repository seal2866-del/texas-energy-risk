"""
data_verification.py
Enterprise-grade ERCOT price verification layer.

Validates every price reading before it enters risk scoring, alerts,
charts, or AI summaries. Bad data must never appear as real data.

DISCLAIMER: Informational only. Not investment or trading advice.
"""
import logging
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ── Price range constants ──────────────────────────────────────────────────────
PRICE_MIN_VALID   = -50.0    # floor: prices can go negative in ERCOT
PRICE_MAX_NORMAL  = 250.0    # normal operating ceiling
PRICE_MAX_ELEVATED = 1000.0  # elevated but plausible
PRICE_SPIKE_PCT   = 50.0     # % change that triggers pending-confirmation

# ── Freshness windows (minutes) ───────────────────────────────────────────────
FRESHNESS_REALTIME = 5
FRESHNESS_DELAYED  = 15      # >5 and <=15 → delayed; >15 → stale

# ── Confidence penalties (percentage points) ──────────────────────────────────
PENALTY_DELAYED   = 5
PENALTY_STALE     = 10
PENALTY_UNAVAIL   = 20
PENALTY_PENDING   = 10


@dataclass
class ErcotVerification:
    is_valid:              bool
    status:                str       # real-time | delayed | stale | unavailable | pending_confirmation
    confidence_adjustment: int       # 0, -5, -10, -20
    reason:                str
    last_known_price:      Optional[float] = None
    last_known_ts:         Optional[str]   = None
    price_range:           str             = "normal"   # normal | elevated | extreme


# ── Module-level last-known-good state ────────────────────────────────────────
_last_known_price: Optional[float] = None
_last_known_ts:    Optional[str]   = None

# ── Movement-confirmation state ───────────────────────────────────────────────
# A spike needs to persist for 2 consecutive intervals before being confirmed.
_pending_spike_price:    Optional[float] = None
_pending_spike_count:    int             = 0
SPIKE_CONFIRM_INTERVALS: int             = 2


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _age_minutes(ts_str: Optional[str]) -> Optional[float]:
    if not ts_str:
        return None
    try:
        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return (_utcnow() - ts).total_seconds() / 60
    except Exception:
        return None


def _freshness_status(age: Optional[float]) -> tuple[str, int]:
    """Return (status_label, confidence_penalty) from age in minutes."""
    if age is None:
        return "unavailable", PENALTY_UNAVAIL
    if age <= FRESHNESS_REALTIME:
        return "real-time", 0
    if age <= FRESHNESS_DELAYED:
        return "delayed", PENALTY_DELAYED
    return "stale", PENALTY_STALE


def _price_range_label(price: float) -> str:
    if price > PRICE_MAX_ELEVATED:
        return "extreme"
    if price > PRICE_MAX_NORMAL:
        return "elevated"
    return "normal"


def _is_price_valid(price: Optional[float]) -> bool:
    """A price is valid if it's a real number and within possible ERCOT bounds."""
    if price is None:
        return False
    try:
        f = float(price)
    except (TypeError, ValueError):
        return False
    if f == 0.0:
        return False                  # treat 0 as missing unless source-confirmed
    return PRICE_MIN_VALID <= f <= PRICE_MAX_ELEVATED + 1000  # allow extreme but finite


def get_last_known_good() -> tuple[Optional[float], Optional[str]]:
    """Return the last known good (price, timestamp) tuple."""
    return _last_known_price, _last_known_ts


def _update_last_known(price: float, ts: str) -> None:
    global _last_known_price, _last_known_ts
    _last_known_price = price
    _last_known_ts    = ts


def verify_ercot_price(
    current_price:  Optional[float],
    previous_price: Optional[float],
    timestamp:      Optional[str],
    location:       str = "HB_HOUSTON",
    market:         str = "ERCOT Real-Time Market",
) -> ErcotVerification:
    """
    Validate a single ERCOT price reading.
    Updates last-known-good and spike-confirmation state as a side effect.
    Returns ErcotVerification with full status, reason, and confidence adjustment.
    """
    global _pending_spike_price, _pending_spike_count

    lk_price, lk_ts = get_last_known_good()

    # ── 1. Basic validity check ───────────────────────────────────────────────
    if not _is_price_valid(current_price):
        logger.warning("[VERIFY] Invalid ERCOT price: %s — using last known good", current_price)
        return ErcotVerification(
            is_valid=False,
            status="unavailable",
            confidence_adjustment=-PENALTY_UNAVAIL,
            reason="ERCOT price missing or invalid.",
            last_known_price=lk_price,
            last_known_ts=lk_ts,
        )

    price = float(current_price)

    # ── 2. Location / market sanity ───────────────────────────────────────────
    if location not in ("HB_HOUSTON", "") and location != "HB_HOUSTON":
        logger.warning("[VERIFY] Unexpected location: %s", location)

    # ── 3. Freshness ──────────────────────────────────────────────────────────
    age = _age_minutes(timestamp)
    freshness, penalty = _freshness_status(age)

    if freshness == "stale":
        logger.warning("[VERIFY] Stale ERCOT data: %.1f min old", age or 0)
        return ErcotVerification(
            is_valid=False,
            status="stale",
            confidence_adjustment=-PENALTY_STALE,
            reason="ERCOT data is older than 15 minutes.",
            last_known_price=lk_price,
            last_known_ts=lk_ts,
            price_range=_price_range_label(price),
        )

    # ── 4. Large-movement confirmation ────────────────────────────────────────
    if previous_price is not None and _is_price_valid(previous_price):
        prev = float(previous_price)
        if prev > 0:
            pct_change = abs((price - prev) / prev) * 100
            if pct_change > PRICE_SPIKE_PCT:
                if _pending_spike_price is not None and abs(price - _pending_spike_price) / max(abs(_pending_spike_price), 1) < 0.10:
                    _pending_spike_count += 1
                else:
                    _pending_spike_price = price
                    _pending_spike_count = 1

                if _pending_spike_count < SPIKE_CONFIRM_INTERVALS:
                    logger.warning("[VERIFY] Spike pending confirmation: %.2f→%.2f (%.1f%%)", prev, price, pct_change)
                    return ErcotVerification(
                        is_valid=False,
                        status="pending_confirmation",
                        confidence_adjustment=-PENALTY_PENDING,
                        reason="Large price movement detected — confirming with next update.",
                        last_known_price=lk_price,
                        last_known_ts=lk_ts,
                        price_range=_price_range_label(price),
                    )
                else:
                    # Confirmed — reset counter
                    _pending_spike_price = None
                    _pending_spike_count = 0
                    logger.warning("[VERIFY] Spike confirmed after %d intervals: %.2f/MWh", SPIKE_CONFIRM_INTERVALS, price)
            else:
                # Normal movement — reset spike counter
                _pending_spike_price = None
                _pending_spike_count = 0

    # ── 5. Valid — update last-known-good and return ──────────────────────────
    if timestamp:
        _update_last_known(price, timestamp)

    range_label = _price_range_label(price)

    if freshness == "delayed":
        reason = "ERCOT data delayed. Monitoring continues with reduced confidence."
    elif range_label == "extreme":
        reason = f"ERCOT HB_HOUSTON extreme price verified: ${price:,.2f}/MWh."
    elif range_label == "elevated":
        reason = f"ERCOT HB_HOUSTON elevated price verified: ${price:,.2f}/MWh."
    else:
        reason = "ERCOT HB_HOUSTON price verified and fresh."

    logger.info("[VERIFY] ERCOT OK — %.2f/MWh freshness=%s range=%s penalty=%d",
                price, freshness, range_label, penalty)

    return ErcotVerification(
        is_valid=True,
        status=freshness,
        confidence_adjustment=-penalty,
        reason=reason,
        last_known_price=price,
        last_known_ts=timestamp,
        price_range=range_label,
    )
