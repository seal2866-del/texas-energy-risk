/**
 * dataValidation.ts
 * Phase 2 — Data validation layer for TX Energy Risk Platform.
 *
 * Validates all inputs before risk scoring. Returns validated data,
 * source statuses, confidence penalties, and last-known-good values.
 *
 * Rules:
 *  - ERCOT: null / 0 / negative / stale → invalid; show last valid
 *  - Weather: stale / missing → reduce confidence; no strong signal
 *  - EIA gas: older than update interval → delayed/stale; reduce confidence
 *
 * Never display fake values. Use "Awaiting verified data" language.
 */

import type { DataSources } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SourceStatus = 'active' | 'stale' | 'delayed' | 'unavailable';

export interface SourceValidation {
  status:       SourceStatus;
  isUsable:     boolean;           // safe to use in risk scoring
  penaltyPct:   number;            // confidence penalty 0–20
  label:        string;            // display label
  warning:      string | null;     // shown in UI when degraded
}

export interface ValidationResult {
  // Per-source validation
  ercot:   SourceValidation;
  weather: SourceValidation;
  gas:     SourceValidation;

  // Aggregated
  overallConfidencePenalty: number;   // sum of penalties, capped at 40
  hasAnyValidData:          boolean;
  warnings:                 string[];

  // Last-known-good values (show when live data is invalid)
  lastValidErcotPrice:      number | null;
  lastValidWeatherTemp:     number | null;
  lastValidGasStorage:      number | null;
}

export interface RawInputs {
  ercotPrice:           number | null | undefined;
  ercotPriceHistory?:   { price_mwh: number; timestamp: string; source?: string }[];
  sourceHealth:         DataSources;
  weatherTemp?:         number | null;
  weatherForecastAge?:  number | null;  // minutes since last forecast
  gasStorage?:          number | null;
  gasReportAge?:        number | null;  // minutes since last EIA report
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ERCOT_STALE_MINUTES  = 90;     // >90 min = stale
const WEATHER_STALE_HOURS  = 6;      // >6h = stale
const GAS_STALE_DAYS       = 10;     // >10 days = stale (weekly report)

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidPrice(price: number | null | undefined): price is number {
  return price !== null && price !== undefined && price > 0 && isFinite(price);
}

function extractLastValidErcot(
  history: { price_mwh: number; timestamp: string; source?: string }[] = []
): number | null {
  const real = history
    .filter(p => p.source !== 'mock' && p.source !== 'mock_data' && isValidPrice(p.price_mwh))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return real.length > 0 ? real[0].price_mwh : null;
}

// ── Main validation function ──────────────────────────────────────────────────

export function validateInputs(raw: RawInputs): ValidationResult {
  const warnings: string[] = [];

  // ── ERCOT validation ───────────────────────────────────────────────────────
  const ercotSourceStatus = raw.sourceHealth?.ercot?.status ?? 'unavailable';
  const ercotAgeMin       = raw.sourceHealth?.ercot?.age_minutes ?? null;
  const liveErcot         = raw.ercotPrice;
  const priceHistory      = raw.ercotPriceHistory ?? [];

  let ercotValidation: SourceValidation;
  const lastValidErcotPrice = extractLastValidErcot(priceHistory) ?? (isValidPrice(liveErcot) ? liveErcot : null);

  if (!isValidPrice(liveErcot)) {
    ercotValidation = {
      status:     'unavailable',
      isUsable:   false,
      penaltyPct: 20,
      label:      'Awaiting verified data',
      warning:    lastValidErcotPrice
        ? `Last verified: $${lastValidErcotPrice.toFixed(2)}/MWh`
        : 'ERCOT price data unavailable',
    };
    warnings.push('ERCOT price data is not available for risk scoring.');
  } else if (ercotSourceStatus === 'unavailable' || (ercotAgeMin !== null && ercotAgeMin > ERCOT_STALE_MINUTES)) {
    ercotValidation = {
      status:     'stale',
      isUsable:   true,   // still usable but with penalty
      penaltyPct: 12,
      label:      'Last verified value shown',
      warning:    `ERCOT data is ${ercotAgeMin ? Math.round(ercotAgeMin) + ' min' : ''} old — confidence reduced.`,
    };
    warnings.push('ERCOT price data is delayed. Risk confidence reduced.');
  } else if (ercotSourceStatus === 'stale') {
    ercotValidation = {
      status:     'stale',
      isUsable:   true,
      penaltyPct: 8,
      label:      'Delayed data',
      warning:    'ERCOT price data is delayed.',
    };
  } else {
    ercotValidation = {
      status:     'active',
      isUsable:   true,
      penaltyPct: 0,
      label:      'Live',
      warning:    null,
    };
  }

  // ── Weather validation ─────────────────────────────────────────────────────
  const noaaStatus  = raw.sourceHealth?.noaa?.status ?? 'unavailable';
  const weatherAge  = raw.sourceHealth?.noaa?.age_minutes ?? null;
  const hasWeather  = raw.weatherTemp !== null && raw.weatherTemp !== undefined;
  const weatherAgeH = weatherAge !== null ? weatherAge / 60 : null;

  let weatherValidation: SourceValidation;

  if (!hasWeather || noaaStatus === 'unavailable') {
    weatherValidation = {
      status:     'unavailable',
      isUsable:   false,
      penaltyPct: 10,
      label:      'Awaiting verified data',
      warning:    'Weather data unavailable — demand signal reduced.',
    };
    warnings.push('Weather forecast data is unavailable. Demand risk assessment is limited.');
  } else if (noaaStatus === 'stale' || (weatherAgeH !== null && weatherAgeH > WEATHER_STALE_HOURS)) {
    weatherValidation = {
      status:     'stale',
      isUsable:   true,
      penaltyPct: 5,
      label:      'Delayed data',
      warning:    'Weather forecast is delayed. Demand signal confidence reduced.',
    };
    warnings.push('Weather forecast is delayed. Demand confidence reduced.');
  } else {
    weatherValidation = {
      status:     'active',
      isUsable:   true,
      penaltyPct: 0,
      label:      'Live',
      warning:    null,
    };
  }

  // ── EIA / Gas validation ───────────────────────────────────────────────────
  const eiaStatus  = raw.sourceHealth?.eia?.status ?? 'unavailable';
  const gasAge     = raw.sourceHealth?.eia?.age_minutes ?? null;
  const hasGas     = raw.gasStorage !== null && raw.gasStorage !== undefined;
  const gasAgeDays = gasAge !== null ? gasAge / (60 * 24) : null;

  let gasValidation: SourceValidation;

  if (!hasGas || eiaStatus === 'unavailable') {
    gasValidation = {
      status:     'unavailable',
      isUsable:   false,
      penaltyPct: 8,
      label:      'Awaiting verified data',
      warning:    'EIA gas storage data unavailable.',
    };
    warnings.push('EIA gas storage data is unavailable. Gas supply signal limited.');
  } else if (gasAgeDays !== null && gasAgeDays > GAS_STALE_DAYS) {
    gasValidation = {
      status:     'delayed',
      isUsable:   true,
      penaltyPct: 5,
      label:      'Delayed — weekly report',
      warning:    `EIA gas data is ${Math.round(gasAgeDays)} days old (weekly report cadence).`,
    };
    // Not a warning — EIA is weekly, delay is expected
  } else if (eiaStatus === 'stale') {
    gasValidation = {
      status:     'stale',
      isUsable:   true,
      penaltyPct: 3,
      label:      'Delayed data',
      warning:    'EIA gas data is delayed.',
    };
  } else {
    gasValidation = {
      status:     'active',
      isUsable:   true,
      penaltyPct: 0,
      label:      'Current',
      warning:    null,
    };
  }

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const totalPenalty = Math.min(
    40,
    ercotValidation.penaltyPct + weatherValidation.penaltyPct + gasValidation.penaltyPct
  );

  const hasAnyValidData =
    ercotValidation.isUsable || weatherValidation.isUsable || gasValidation.isUsable;

  return {
    ercot:   ercotValidation,
    weather: weatherValidation,
    gas:     gasValidation,
    overallConfidencePenalty: totalPenalty,
    hasAnyValidData,
    warnings,
    lastValidErcotPrice,
    lastValidWeatherTemp: hasWeather ? (raw.weatherTemp ?? null) : null,
    lastValidGasStorage:  hasGas ? (raw.gasStorage ?? null) : null,
  };
}

// ── Display helpers ───────────────────────────────────────────────────────────

/**
 * Format a price for display. Never shows $0.00 or invalid values.
 */
export function formatErcotPrice(
  price:          number | null | undefined,
  validation:     SourceValidation,
  lastValidPrice: number | null
): { display: string; isLive: boolean; label: string } {
  if (isValidPrice(price) && validation.isUsable) {
    return {
      display: `$${price.toFixed(2)}`,
      isLive:  validation.status === 'active',
      label:   validation.status === 'active' ? 'Real-time' : 'Last verified value shown',
    };
  }
  if (isValidPrice(lastValidPrice)) {
    return {
      display: `$${lastValidPrice.toFixed(2)}`,
      isLive:  false,
      label:   'Last verified value shown',
    };
  }
  return {
    display: 'Awaiting verified data',
    isLive:  false,
    label:   '',
  };
}
