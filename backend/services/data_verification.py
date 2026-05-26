"""
data_verification.py — ERCOT Price Data Verification Layer
Validates freshness, range, and movement before data is used in
risk scoring, alerts, charts, or AI summaries.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger(__name__)

# ── Price range thresholds ($/MWh) ───────────────────────────────────────────
PRICE_MIN_VALID   = -50.0    # below this is almost certainly bad data
PRICE_MAX_EXTREME = 10_000.0 # hard ceiling — scraper/feed error above this
PRICE_ELEVATED    = 250.0    # normal → elevated boundary
PRICE_EXTREME     = 1_000.0  # elevated → extreme boundary

# ── Freshness thresholds (minutes) ───────────────────────────────────────────
FRESH_REALTIME_MIN = 5    # ≤5 min → real-time
FRESH_DELAYED_MIN  = 15   # 5-15 min → delayed, >15 → stale

# ── Spike confirmation ────────────────────────────────────────────────────────
SPIKE_PCT_THRESHOLD    = 50.0   # % change that triggers confirmation hold
SPIKE_CONFIRM_INTERVALS = 2     # consecutive intervals required to confirm


@dataclass
class ErcotVerification:
    is_valid:              bool
    status:                str   # real-time | delayed | stale | unavailable | pending_confirmation
    confidence_adjustment: float # 0 = no penalty; negative = reduce confidence
    reason:                str
    last_known_price:      Optional[float] = None
    last_known_ts:         Optional[str]   = None
    price_range:           str             = "normal"  # normal | elevated | extreme


# ── Module-level last-known-good cache ───────────────────────────────────────
_last_known_price: Optional[float] = None
_last_known_ts:    Optional[str]   = None

# Spike confirmation state
_pending_spike_price: Optional[float] = None
_pending_spike_count: int             = 0


def _classify_price_range(price: float) -> str:
    if price >= PRICE_EXTREME:
        return "extreme"
    if price >= PRICE_ELEVATED:
        return "elevated"
    return "normal"


def _age_minutes(timestamp: str) -> Optional[float]:
    """Return age of timestamp in minutes, or None if unparseable."""
    try:
        ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        return (now - ts).total_seconds() / 60.0
    except Exception:
        return None


def get_last_known_good() -> tuple[Optional[float], Optional[str]]:
    """Return (price, iso_timestamp) of the last verified valid reading."""
    return _last_known_price, _last_known_ts


def _update_last_known(price: float, timestamp: str) -> None:
    global _last_known_price, _last_known_ts
    _last_known_price = price
    _last_known_ts    = timestamp


def verify_ercot_price(
    current_price:  Optional[float],
    prev_price:     Optional[float],
    timestamp:      Optional[str],
    location:       str = "HB_HOUSTON",
    market:         str = "ERCOT Real-Time Market",
) -> ErcotVerification:
    """
    Validate an ERCOT price reading before it enters risk scoring / alerts / charts.

    Returns ErcotVerification dataclass.
    Side-effect: updates module-level last-known-good cache on valid readings.
    """
    global _pending_spike_price, _pending_spike_count

    lkp, lk_ts = get_last_known_good()

    # ── 1. Null / zero / out-of-range check ──────────────────────────────────
    if current_price is None:
        log.warning("[VERIFY] ERCOT price is None")
        return ErcotVerification(
            is_valid=False, status="unavailable",
            confidence_adjustment=-20,
            reason="ERCOT price missing or invalid.",
            last_known_price=lkp, last_known_ts=lk_ts,
        )

    if current_price == 0:
        log.warning("[VERIFY] ERCOT price is exactly 0 — treating as invalid")
        return ErcotVerification(
            is_valid=False, status="unavailable",
            confidence_adjustment=-20,
            reason="ERCOT price is zero — data feed may be offline.",
            last_known_price=lkp, last_known_ts=lk_ts,
        )

    if current_price < PRICE_MIN_VALID or current_price > PRICE_MAX_EXTREME:
        log.warning("[VERIFY] ERCOT price %.2f outside valid range", current_price)
        return ErcotVerification(
            is_valid=False, status="unavailable",
            confidence_adjustment=-20,
            reason=f"ERCOT price ${current_price:,.2f}/MWh is outside valid range.",
            last_known_price=lkp, last_known_ts=lk_ts,
        )

    # ── 2. Location / market sanity ───────────────────────────────────────────
    if location != "HB_HOUSTON" or "ERCOT" not in market:
        log.warning("[VERIFY] Unexpected location/market: %s / %s", location, market)
        return ErcotVerification(
            is_valid=False, status="unavailable",
            confidence_adjustment=-20,
            reason=f"Unexpected source: {location} / {market}.",
            last_known_price=lkp, last_known_ts=lk_ts,
        )

    price_range = _classify_price_range(current_price)

    # ── 3. Timestamp / freshness check ───────────────────────────────────────
    if not timestamp:
        log.warning("[VERIFY] ERCOT timestamp missing")
        return ErcotVerification(
            is_valid=False, status="unavailable",
            confidence_adjustment=-20,
            reason="ERCOT timestamp missing.",
            last_known_price=lkp, last_known_ts=lk_ts,
            price_range=price_range,
        )

    age = _age_minutes(timestamp)
    if age is None:
        return ErcotVerification(
            is_valid=False, status="unavailable",
            confidence_adjustment=-20,
            reason="ERCOT timestamp could not be parsed.",
            last_known_price=lkp, last_known_ts=lk_ts,
            price_range=price_range,
        )

    if age > FRESH_DELAYED_MIN:
        log.info("[VERIFY] ERCOT data stale: %.1f min old", age)
        return ErcotVerification(
            is_valid=False, status="stale",
            confidence_adjustment=-10,
            reason=f"ERCOT data is older than {FRESH_DELAYED_MIN} minutes ({age:.0f} min ago).",
            last_known_price=lkp, last_known_ts=lk_ts,
            price_range=price_range,
        )

    freshness_status = "real-time" if age <= FRESH_REALTIME_MIN else "delayed"
    confidence_adj   = 0.0 if freshness_status == "real-time" else -5.0

    # ── 4. Spike confirmation ─────────────────────────────────────────────────
    if prev_price and prev_price > 0:
        pct_change = abs((current_price - prev_price) / prev_price) * 100
        if pct_change > SPIKE_PCT_THRESHOLD:
            if _pending_spike_price is None or abs(current_price - _pending_spike_price) / max(abs(_pending_spike_price), 1) > 0.1:
                # New spike — start confirmation window
                _pending_spike_price = current_price
                _pending_spike_count = 1
                log.info("[VERIFY] Spike detected (%.1f%%), pending confirmation", pct_change)
                return ErcotVerification(
                    is_valid=False, status="pending_confirmation",
                    confidence_adjustment=-10,
                    reason=f"Large price movement detected ({pct_change:.0f}% change) — confirming with next update.",
                    last_known_price=lkp, last_known_ts=lk_ts,
                    price_range=price_range,
                )
            else:
                # Same spike continuing
                _pending_spike_count += 1
                if _pending_spike_count < SPIKE_CONFIRM_INTERVALS:
                    log.info("[VERIFY] Spike still pending (%d/%d intervals)", _pending_spike_count, SPIKE_CONFIRM_INTERVALS)
                    return ErcotVerification(
                        is_valid=False, status="pending_confirmation",
                        confidence_adjustment=-10,
                        reason=f"Large movement confirming ({_pending_spike_count}/{SPIKE_CONFIRM_INTERVALS} intervals).",
                        last_known_price=lkp, last_known_ts=lk_ts,
                        price_range=price_range,
                    )
                else:
                    # Confirmed spike — treat as valid
                    log.info("[VERIFY] Spike confirmed after %d intervals", _pending_spike_count)
                    _pending_spike_price = None
                    _pending_spike_count = 0
        else:
            # No spike — clear any pending state
            _pending_spike_price = None
            _pending_spike_count = 0

    # ── 5. All checks passed — update last-known-good ────────────────────────
    _update_last_known(current_price, timestamp)

    delay_note = " (data slightly delayed)" if freshness_status == "delayed" else ""
    log.debug("[VERIFY] ERCOT price %.2f verified — %s%s", current_price, freshness_status, delay_note)

    return ErcotVerification(
        is_valid=True,
        status=freshness_status,
        confidence_adjustment=confidence_adj,
        reason=f"ERCOT HB_HOUSTON price verified and fresh{delay_note}.",
        last_known_price=current_price,
        last_known_ts=timestamp,
        price_range=price_range,
    )
