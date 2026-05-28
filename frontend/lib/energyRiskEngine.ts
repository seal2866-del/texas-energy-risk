/**
 * energyRiskEngine.ts
 * Phase 1 — Central Risk Engine for TX Energy Risk Platform.
 *
 * Single source of truth for:
 *  - risk score & level
 *  - escalation probability  (Phase 3)
 *  - market state            (Phase 4)
 *  - early warning signals   (Phase 5)
 *  - operational exposure    (Phase 6)
 *  - signal alignment
 *  - confidence score
 *  - operational exposure
 *
 * All dashboard panels MUST consume this module.
 * Do NOT calculate risk separately in UI components.
 *
 * Design: when a full SignalsResponse is provided (from backend),
 * that is used as the authoritative source. Frontend computation
 * serves as enrichment and fallback only.
 */

import type { SignalsResponse, ERCOTPrice, DataSources } from './api';
import { validateInputs }                                 from './dataValidation';

// ── Input contract ────────────────────────────────────────────────────────────

export interface EnergyRiskInputs {
  // ERCOT
  ercotPrice:         number | null;
  previousErcotPrice: number | null;
  ercotPriceHistory:  ERCOTPrice[];
  // Weather
  weatherTemp:        number | null;
  forecastHigh:       number | null;
  forecastTrend:      'rising' | 'stable' | 'falling';
  // Gas
  gasStorage:         number | null;
  gasStorageVsFiveYear: number | null;  // % vs 5yr avg; negative = below avg
  henryHubPrice:      number | null;
  // Meta
  sourceHealth:       DataSources;
  timestamp:          string;
  // Optional: full backend response (preferred source when available)
  signalsResponse?:   SignalsResponse;
}

// ── Output types ──────────────────────────────────────────────────────────────

export type RiskLevel       = 'low' | 'medium' | 'high';
export type EscalationTier  = 'Low' | 'Moderate' | 'Elevated' | 'Critical';
export type WeatherDemand   = 'normal' | 'elevated' | 'extreme';
export type PriceBehavior   = 'falling' | 'stable' | 'rising' | 'volatile';
export type GasSupplyLevel  = 'adequate' | 'below_average' | 'tight';

export type MarketStateLabel =
  | 'Stable'
  | 'Watch'
  | 'Tightening'
  | 'Volatile'
  | 'Elevated Risk'
  | 'Critical'
  | 'Unavailable';

export interface MarketState {
  state:       MarketStateLabel;
  label:       string;
  explanation: string;
  urgency:     'low' | 'medium' | 'high';
  color:       string;   // CSS variable name
}

export interface EscalationResult {
  tier:      EscalationTier;
  pct:       number;
  rationale: string;
  label:     string;     // e.g. "Low — 18%"
}

export interface SignalAlignmentResult {
  label:       string;   // None | Weak | Moderate | Strong
  score:       number;   // 0–100
  description: string;
}

export interface MarketSensitivityResult {
  level:       string;
  score:       number;
  description: string;
}

export interface OperationalExposureResult {
  exposureLevel:        'Low' | 'Moderate' | 'High';
  exposureExplanation:  string;
  costSensitivityRange: string;
  peakWindow:           string;
}

export interface EarlyWarning {
  id:       string;
  severity: 'caution' | 'advisory' | 'elevated';
  message:  string;
  driver:   string;
}

export interface CostExposureResult {
  level:       'Low' | 'Moderate' | 'High';
  label:       string;
  description: string;
}

export interface RiskModel {
  // ── Core risk ──
  riskLevel:    RiskLevel;
  riskScore:    number;          // 0–10 numeric
  riskHeadline: string;
  marketState:  MarketState;

  // ── Probability & confidence ──
  escalationProbability: EscalationResult;
  confidence:            number;
  confidenceNote:        string;

  // ── Drivers ──
  primaryDriver:     string;
  primaryDriverType: string;
  secondaryDrivers:  string[];
  signalAlignment:   SignalAlignmentResult;

  // ── Signal levels (normalised) ──
  weatherDemandLevel: WeatherDemand;
  priceBehavior:      PriceBehavior;
  gasSupplyLevel:     GasSupplyLevel;

  // ── Intelligence outputs ──
  marketSensitivity:   MarketSensitivityResult;
  operationalExposure: OperationalExposureResult;
  earlyWarningSignals: EarlyWarning[];
  costExposure:        CostExposureResult;

  // ── Narrative ──
  whyItMatters:    string;
  monitoringFocus: string;
  outlook:         string;

  // ── Data quality ──
  dataValid:   boolean;
  dataStatus:  string;
  lastUpdated: string;
  computedAt:  string;

  // ── Pass-through from backend (for detailed widgets) ──
  raw?: SignalsResponse;
}

// ── Internal helper types ─────────────────────────────────────────────────────

interface SignalLevels {
  weather:       WeatherDemand;
  price:         PriceBehavior;
  gas:           GasSupplyLevel;
  activeDrivers: number;
}

// ── Phase 3: Escalation Probability Engine ────────────────────────────────────

function calculateEscalationProbability(
  levels:      SignalLevels,
  alignment:   SignalAlignmentResult,
  confidence:  number,
  raw?:        SignalsResponse
): EscalationResult {
  // Prefer backend value when available
  if (raw?.escalation_probability) {
    const be  = raw.escalation_probability;
    const pct = typeof be.pct === 'number' ? be.pct : 0;
    return {
      tier:      pctToTier(pct),
      pct,
      rationale: be.rationale ?? '',
      label:     `${pctToTier(pct)} — ${pct}%`,
    };
  }

  // Frontend computation
  let score = 0;
  const factors: string[] = [];

  // Weather demand component
  if (levels.weather === 'extreme')        { score += 35; factors.push('extreme heat demand'); }
  else if (levels.weather === 'elevated')  { score += 20; factors.push('elevated heat demand'); }

  // ERCOT price behavior component
  if (levels.price === 'volatile')         { score += 30; factors.push('price volatility'); }
  else if (levels.price === 'rising')      { score += 15; factors.push('rising prices'); }

  // Gas supply component
  if (levels.gas === 'tight')              { score += 20; factors.push('tight gas supply'); }
  else if (levels.gas === 'below_average') { score += 10; factors.push('below-average gas storage'); }

  // Signal alignment bonus
  if (alignment.label === 'Strong')        { score += 20; factors.push('strong signal alignment'); }
  else if (alignment.label === 'Moderate') { score += 10; }

  // Confidence penalty
  if (confidence < 60)       { score -= 15; }
  else if (confidence < 75)  { score -= 5; }

  const pct  = Math.max(0, Math.min(100, score));
  const tier = pctToTier(pct);

  const rationale = factors.length > 0
    ? `Driven by ${factors.slice(0, 3).join(', ')}.`
    : 'No significant escalation drivers detected.';

  return { tier, pct, rationale, label: `${tier} — ${pct}%` };
}

function pctToTier(pct: number): EscalationTier {
  if (pct >= 86) return 'Critical';
  if (pct >= 66) return 'Elevated';
  if (pct >= 36) return 'Moderate';
  return 'Low';
}

// ── Phase 4: Market State Engine ─────────────────────────────────────────────

function deriveMarketState(
  levels:      SignalLevels,
  escalation:  EscalationResult,
  confidence:  number,
  raw?:        SignalsResponse
): MarketState {
  // Prefer backend market_condition when available
  if (raw?.market_condition?.label && raw.market_condition.label !== 'Unavailable') {
    return backendStateToMarketState(raw.market_condition.label, raw.market_condition.description);
  }

  const { weather, price, gas, activeDrivers } = levels;

  // Critical: multiple drivers + volatility + low confidence or high escalation
  if (activeDrivers >= 2 && price === 'volatile' && (confidence < 70 || escalation.pct >= 70)) {
    return {
      state:       'Critical',
      label:       'Critical',
      explanation: 'Multiple risk drivers are active with significant price movement.',
      urgency:     'high',
      color:       'var(--risk-critical, #ef4444)',
    };
  }

  // Elevated Risk: multiple active drivers
  if (activeDrivers >= 2) {
    return {
      state:       'Elevated Risk',
      label:       'Elevated Risk',
      explanation: 'Multiple drivers are simultaneously elevated.',
      urgency:     'high',
      color:       'var(--risk-high, #f97316)',
    };
  }

  // Volatile: significant price movement
  if (price === 'volatile') {
    return {
      state:       'Volatile',
      label:       'Volatile',
      explanation: 'ERCOT pricing shows significant movement.',
      urgency:     'high',
      color:       'var(--risk-high, #f97316)',
    };
  }

  // Tightening: demand or gas pressure building
  if ((weather === 'elevated' || weather === 'extreme') && price === 'stable') {
    return {
      state:       'Tightening',
      label:       'Tightening',
      explanation: 'Demand pressure is building while pricing remains stable.',
      urgency:     'medium',
      color:       'var(--risk-medium, #f59e0b)',
    };
  }
  if (gas === 'tight' || gas === 'below_average') {
    return {
      state:       'Tightening',
      label:       'Tightening',
      explanation: 'Gas supply conditions are tightening.',
      urgency:     'medium',
      color:       'var(--risk-medium, #f59e0b)',
    };
  }

  // Watch: one driver elevated
  if (activeDrivers === 1) {
    return {
      state:       'Watch',
      label:       'Watch',
      explanation: 'One risk driver is elevated. Monitoring for escalation.',
      urgency:     'medium',
      color:       'var(--risk-medium, #f59e0b)',
    };
  }

  // Rising prices — watch state
  if (price === 'rising') {
    return {
      state:       'Watch',
      label:       'Watch',
      explanation: 'ERCOT prices are trending higher. Monitoring conditions.',
      urgency:     'medium',
      color:       'var(--risk-medium, #f59e0b)',
    };
  }

  // Stable: low risk, no major drivers
  return {
    state:       'Stable',
    label:       'Stable',
    explanation: 'All indicators within normal operational ranges.',
    urgency:     'low',
    color:       'var(--risk-low, #22c55e)',
  };
}

function backendStateToMarketState(label: string, description: string): MarketState {
  const lower = label.toLowerCase();
  if (lower.includes('critical') || lower.includes('volatile')) {
    return { state: 'Volatile', label, explanation: description, urgency: 'high', color: 'var(--risk-high, #f97316)' };
  }
  if (lower.includes('elevated') || lower.includes('elevated risk')) {
    return { state: 'Elevated Risk', label, explanation: description, urgency: 'high', color: 'var(--risk-high, #f97316)' };
  }
  if (lower.includes('tighten')) {
    return { state: 'Tightening', label, explanation: description, urgency: 'medium', color: 'var(--risk-medium, #f59e0b)' };
  }
  if (lower.includes('watch')) {
    return { state: 'Watch', label, explanation: description, urgency: 'medium', color: 'var(--risk-medium, #f59e0b)' };
  }
  return { state: 'Stable', label, explanation: description, urgency: 'low', color: 'var(--risk-low, #22c55e)' };
}

// ── Phase 5: Early Warning Engine ────────────────────────────────────────────

function detectEarlyWarnings(
  levels:      SignalLevels,
  escalation:  EscalationResult,
  raw?:        SignalsResponse
): EarlyWarning[] {
  const warnings: EarlyWarning[] = [];

  // Prefer backend early_warnings when available
  if (raw?.early_warnings?.warnings?.length) {
    return raw.early_warnings.warnings.map((w: any, i: number) => ({
      id:       `be-${i}`,
      severity: w.severity ?? 'caution',
      message:  w.message ?? w,
      driver:   w.driver ?? 'market',
    }));
  }

  // Frontend detection: demand building while price is stable
  if ((levels.weather === 'elevated' || levels.weather === 'extreme') && levels.price === 'stable') {
    warnings.push({
      id:       'ew-demand-build',
      severity: levels.weather === 'extreme' ? 'elevated' : 'advisory',
      message:  'Demand pressure is building while ERCOT pricing remains stable. Watch for delayed price response.',
      driver:   'weather_demand',
    });
  }

  // Heat persistence + gas below average
  if (levels.weather !== 'normal' && levels.gas === 'below_average') {
    warnings.push({
      id:       'ew-gas-demand',
      severity: 'advisory',
      message:  'Gas-to-power sensitivity may increase if heat demand continues alongside below-average storage.',
      driver:   'gas_supply',
    });
  }

  // Tight gas + any demand pressure
  if (levels.gas === 'tight') {
    warnings.push({
      id:       'ew-tight-gas',
      severity: 'elevated',
      message:  'Gas supply conditions are tight. Operational sensitivity elevated across demand intervals.',
      driver:   'gas_supply',
    });
  }

  // High escalation but price still stable
  if (escalation.pct >= 50 && levels.price === 'stable') {
    warnings.push({
      id:       'ew-pre-escalation',
      severity: 'advisory',
      message:  'Escalation indicators are elevated before price has reacted. Pre-escalation conditions detected.',
      driver:   'signal_alignment',
    });
  }

  return warnings;
}

// ── Phase 6: Operational Exposure Engine ─────────────────────────────────────

function calculateOperationalExposure(
  escalation:   EscalationResult,
  sensitivity:  MarketSensitivityResult,
  levels:       SignalLevels,
  raw?:         SignalsResponse
): OperationalExposureResult {
  // Prefer backend value
  if (raw?.operational_exposure) {
    const oe = raw.operational_exposure;
    const lvlRaw = (oe.level ?? 'low').toLowerCase();
    const exposureLevel: 'Low' | 'Moderate' | 'High' =
      lvlRaw === 'high'     ? 'High'
      : lvlRaw === 'moderate' || lvlRaw === 'elevated' ? 'Moderate'
      : 'Low';
    return {
      exposureLevel,
      exposureExplanation:  oe.detail     ?? oe.short_desc ?? '',
      costSensitivityRange: oe.short_desc ?? 'Normal range',
      peakWindow:           'Afternoon peak (2–8 PM CDT)',
    };
  }

  const pct     = escalation.pct;
  const weather = levels.weather;
  const gas     = levels.gas;

  // High exposure
  if (pct >= 60 || (weather === 'extreme' && gas !== 'adequate')) {
    return {
      exposureLevel:        'High',
      exposureExplanation:  'Elevated operational exposure detected across multiple risk drivers. Conditions may increase afternoon energy cost sensitivity during peak demand intervals.',
      costSensitivityRange: 'Elevated sensitivity — conditions suggest above-normal cost exposure during peak windows.',
      peakWindow:           'Afternoon peak (2–8 PM CDT)',
    };
  }

  // Moderate exposure
  if (pct >= 30 || weather === 'elevated' || gas === 'below_average') {
    return {
      exposureLevel:        'Moderate',
      exposureExplanation:  'Conditions may increase afternoon energy cost sensitivity during peak demand intervals.',
      costSensitivityRange: 'Moderate sensitivity — cost exposure could elevate during peak periods.',
      peakWindow:           'Afternoon hours (3–7 PM CDT)',
    };
  }

  return {
    exposureLevel:        'Low',
    exposureExplanation:  'Minimal operational exposure under current conditions.',
    costSensitivityRange: 'Normal operational range.',
    peakWindow:           'No elevated window identified.',
  };
}

// ── Signal level derivation ───────────────────────────────────────────────────

function deriveWeatherDemand(forecastHigh: number | null, weatherTemp: number | null): WeatherDemand {
  const temp = forecastHigh ?? weatherTemp ?? null;
  if (temp === null) return 'normal';
  if (temp >= 103) return 'extreme';
  if (temp >= 95)  return 'elevated';
  return 'normal';
}

function derivePriceBehavior(
  current:  number | null,
  previous: number | null,
  history:  ERCOTPrice[]
): PriceBehavior {
  if (current === null || previous === null || previous === 0) return 'stable';

  const pctChange = ((current - previous) / previous) * 100;

  // Check for high volatility using recent history
  if (history.length >= 3) {
    const recent = history.slice(-6).map(p => p.price_mwh).filter(p => p > 0);
    if (recent.length >= 3) {
      const max    = Math.max(...recent);
      const min    = Math.min(...recent);
      const spread = min > 0 ? ((max - min) / min) * 100 : 0;
      if (spread > 30) return 'volatile';
    }
  }

  if (Math.abs(pctChange) > 25) return 'volatile';
  if (pctChange > 10)           return 'rising';
  if (pctChange < -10)          return 'falling';
  return 'stable';
}

function deriveGasSupply(pctVsFiveYear: number | null): GasSupplyLevel {
  if (pctVsFiveYear === null) return 'adequate';
  if (pctVsFiveYear <= -15)  return 'tight';
  if (pctVsFiveYear <= -5)   return 'below_average';
  return 'adequate';
}

function deriveSignalAlignment(
  levels: SignalLevels,
  raw?:   SignalsResponse
): SignalAlignmentResult {
  if (raw?.signal_alignment) {
    return {
      label:       raw.signal_alignment.label,
      score:       raw.signal_alignment.score,
      description: raw.signal_alignment.description,
    };
  }
  const { activeDrivers } = levels;
  if (activeDrivers === 3) return { label: 'Strong', score: 85,  description: 'All three risk drivers are simultaneously elevated.' };
  if (activeDrivers === 2) return { label: 'Moderate', score: 60, description: 'Two risk drivers are aligned.' };
  if (activeDrivers === 1) return { label: 'Weak', score: 30,    description: 'One risk driver is active.' };
  return                          { label: 'None', score: 0,     description: 'No active risk drivers.' };
}

function deriveMarketSensitivity(
  levels: SignalLevels,
  raw?:   SignalsResponse
): MarketSensitivityResult {
  if (raw?.market_sensitivity) {
    return {
      level:       raw.market_sensitivity.level,
      score:       raw.market_sensitivity.score,
      description: raw.market_sensitivity.description,
    };
  }
  const { activeDrivers, price } = levels;
  if (activeDrivers >= 2 || price === 'volatile') {
    return { level: 'Elevated Sensitivity', score: 75, description: 'Market conditions are sensitive to further demand or supply changes.' };
  }
  if (activeDrivers === 1 || price === 'rising') {
    return { level: 'Moderate Sensitivity', score: 45, description: 'Market may respond to additional demand or supply pressure.' };
  }
  return { level: 'Low Sensitivity', score: 15, description: 'Market conditions are resilient under current inputs.' };
}

function deriveCostExposure(escalation: EscalationResult, raw?: SignalsResponse): CostExposureResult {
  if (raw?.cost_impact) {
    return {
      level:       (raw.cost_impact.level === 'high' ? 'High' : raw.cost_impact.level === 'medium' ? 'Moderate' : 'Low') as 'Low' | 'Moderate' | 'High',
      label:       raw.cost_impact.label,
      description: raw.cost_impact.description,
    };
  }
  if (escalation.pct >= 60) return { level: 'High',     label: 'Elevated Cost Exposure',  description: 'Conditions suggest above-normal energy cost exposure during peak windows. Proactive monitoring recommended.' };
  if (escalation.pct >= 30) return { level: 'Moderate', label: 'Moderate Cost Exposure',  description: 'Cost exposure may increase during peak demand intervals. Conditions warrant monitoring.' };
  return                           { level: 'Low',      label: 'Normal Cost Environment', description: 'No significant cost exposure indicators under current conditions.' };
}

// ── Count active signal drivers ───────────────────────────────────────────────

function countActiveDrivers(weather: WeatherDemand, price: PriceBehavior, gas: GasSupplyLevel): number {
  let n = 0;
  if (weather !== 'normal')  n++;
  if (price !== 'stable')    n++;
  if (gas    !== 'adequate') n++;
  return n;
}

// ── Narrative helpers ─────────────────────────────────────────────────────────

function buildWhyItMatters(levels: SignalLevels, marketState: MarketState, raw?: SignalsResponse): string {
  if (raw?.risk_narrative?.body) return raw.risk_narrative.body;
  if (marketState.state === 'Stable') return 'All market indicators are within normal operating ranges. No significant risk drivers are active.';
  if (levels.weather === 'extreme')   return 'Extreme heat is driving elevated demand pressure. ERCOT pricing may respond during afternoon peak intervals.';
  if (levels.weather === 'elevated')  return 'Elevated temperatures are increasing cooling demand. Monitor for price response during afternoon peak.';
  if (levels.gas === 'tight')         return 'Tight gas supply conditions may limit generation flexibility and increase price sensitivity during high-demand periods.';
  if (levels.price === 'volatile')    return 'ERCOT prices are showing significant movement. Market conditions are sensitive to additional demand or supply changes.';
  return marketState.explanation;
}

function buildMonitoringFocus(levels: SignalLevels, warnings: EarlyWarning[], raw?: SignalsResponse): string {
  if (raw?.risk_narrative?.next_period_note) return raw.risk_narrative.next_period_note;
  if (warnings.length > 0)     return warnings[0].message;
  if (levels.weather !== 'normal') return 'Monitor afternoon peak demand intervals for ERCOT price response.';
  if (levels.gas !== 'adequate')   return 'Watch gas storage trends and gas-to-power generation capacity.';
  if (levels.price !== 'stable')   return 'Track ERCOT price direction across next 1–6 hour intervals.';
  return 'Continue standard monitoring. No elevated focus areas at this time.';
}

function buildOutlook(escalation: EscalationResult, marketState: MarketState, raw?: SignalsResponse): string {
  if (raw?.time_horizons?.near_term) return raw.time_horizons.near_term;
  if (escalation.tier === 'Critical') return 'Near-term outlook: conditions may deteriorate further. Critical monitoring warranted.';
  if (escalation.tier === 'Elevated') return 'Near-term outlook: elevated conditions may persist. Watch for escalation signals.';
  if (escalation.tier === 'Moderate') return 'Near-term outlook: conditions are building. Continued monitoring recommended.';
  return 'Near-term outlook: stable conditions expected to persist barring new demand or supply developments.';
}

// ── Phase 1: Main engine entry point ─────────────────────────────────────────

export function energyRiskEngine(inputs: EnergyRiskInputs): RiskModel {
  const raw = inputs.signalsResponse;

  // ── Step 1: Validate inputs ───────────────────────────────────────────────
  const validation = validateInputs({
    ercotPrice:         inputs.ercotPrice,
    ercotPriceHistory:  inputs.ercotPriceHistory,
    sourceHealth:       inputs.sourceHealth,
    weatherTemp:        inputs.weatherTemp,
    gasStorage:         inputs.gasStorage,
  });

  // If backend says invalid, respect that
  const dataValid  = raw ? raw.data_valid : validation.hasAnyValidData;
  const dataStatus = raw ? raw.data_status : (dataValid ? 'valid' : 'no_data');

  // ── Step 2: Derive signal levels ──────────────────────────────────────────
  const weatherLevel  = deriveWeatherDemand(inputs.forecastHigh, inputs.weatherTemp);
  const priceLevel    = derivePriceBehavior(inputs.ercotPrice, inputs.previousErcotPrice, inputs.ercotPriceHistory);
  const gasLevel      = deriveGasSupply(inputs.gasStorageVsFiveYear);
  const activeDrivers = countActiveDrivers(weatherLevel, priceLevel, gasLevel);

  const levels: SignalLevels = {
    weather:       weatherLevel,
    price:         priceLevel,
    gas:           gasLevel,
    activeDrivers,
  };

  // ── Step 3: Risk level & score ────────────────────────────────────────────
  const riskLevel: RiskLevel = raw?.risk_score ?? (
    activeDrivers >= 2 ? 'high' : activeDrivers === 1 ? 'medium' : 'low'
  );

  const riskScoreMap: Record<RiskLevel, number> = { low: 2, medium: 5, high: 8 };
  const riskScore = riskScoreMap[riskLevel];

  // ── Step 4: Confidence ────────────────────────────────────────────────────
  const baseConfidence = raw?.confidence ?? (
    riskLevel === 'high' ? 82 : riskLevel === 'medium' ? 72 : 65
  );
  const confidence     = Math.max(30, baseConfidence - validation.overallConfidencePenalty);
  const confidenceNote = raw?.confidence_note ?? (
    validation.warnings.length > 0
      ? `Confidence reduced — ${validation.warnings[0]}`
      : 'Confidence based on live data from all sources.'
  );

  // ── Step 5: Signal alignment ──────────────────────────────────────────────
  const signalAlignment = deriveSignalAlignment(levels, raw);

  // ── Step 6: Escalation probability ───────────────────────────────────────
  const escalation = calculateEscalationProbability(levels, signalAlignment, confidence, raw);

  // ── Step 7: Market state ──────────────────────────────────────────────────
  const marketState = deriveMarketState(levels, escalation, confidence, raw);

  // ── Step 8: Early warnings ────────────────────────────────────────────────
  const earlyWarnings = detectEarlyWarnings(levels, escalation, raw);

  // ── Step 9: Market sensitivity ────────────────────────────────────────────
  const marketSensitivity = deriveMarketSensitivity(levels, raw);

  // ── Step 10: Operational exposure ────────────────────────────────────────
  const operationalExposure = calculateOperationalExposure(escalation, marketSensitivity, levels, raw);

  // ── Step 11: Cost exposure ────────────────────────────────────────────────
  const costExposure = deriveCostExposure(escalation, raw);

  // ── Step 12: Drivers ──────────────────────────────────────────────────────
  const primaryDriver     = raw?.primary_driver     ?? (
    weatherLevel !== 'normal' ? 'Weather Demand'
    : priceLevel !== 'stable' ? 'ERCOT Price Volatility'
    : gasLevel   !== 'adequate' ? 'Gas Supply'
    : 'None'
  );
  const primaryDriverType = raw?.primary_driver_type ?? (
    primaryDriver === 'Weather Demand' ? 'weather_demand'
    : primaryDriver === 'ERCOT Price Volatility' ? 'price_volatility'
    : primaryDriver === 'Gas Supply' ? 'gas_supply'
    : 'none'
  );

  const secondaryDrivers: string[] = raw?.secondary_factors ?? (() => {
    const s: string[] = [];
    if (weatherLevel !== 'normal' && primaryDriverType !== 'weather_demand') s.push('Weather Demand');
    if (priceLevel   !== 'stable' && primaryDriverType !== 'price_volatility') s.push('ERCOT Pricing');
    if (gasLevel     !== 'adequate' && primaryDriverType !== 'gas_supply') s.push('Gas Supply');
    return s;
  })();

  // ── Step 13: Narrative ────────────────────────────────────────────────────
  const riskHeadline   = raw?.risk_headline ?? marketState.explanation;
  const whyItMatters   = buildWhyItMatters(levels, marketState, raw);
  const monitoringFocus = buildMonitoringFocus(levels, earlyWarnings, raw);
  const outlook        = buildOutlook(escalation, marketState, raw);

  // ── Step 14: Timestamps ───────────────────────────────────────────────────
  const computedAt  = raw?.computed_at ?? new Date().toISOString();
  const lastUpdated = inputs.timestamp ?? computedAt;

  return {
    riskLevel,
    riskScore,
    riskHeadline,
    marketState,
    escalationProbability: escalation,
    confidence,
    confidenceNote,
    primaryDriver,
    primaryDriverType,
    secondaryDrivers,
    signalAlignment,
    weatherDemandLevel: weatherLevel,
    priceBehavior:      priceLevel,
    gasSupplyLevel:     gasLevel,
    marketSensitivity,
    operationalExposure,
    earlyWarningSignals: earlyWarnings,
    costExposure,
    whyItMatters,
    monitoringFocus,
    outlook,
    dataValid,
    dataStatus,
    lastUpdated,
    computedAt,
    raw,
  };
}

// ── Convenience: build inputs from API responses ──────────────────────────────

export function buildEngineInputs(
  signals:   SignalsResponse,
  prices:    ERCOTPrice[],
  forecasts: { temp_high_f?: number; forecast_time?: string }[],
  gasData:   { storage_pct_vs_avg?: number; henry_hub_price?: number; storage_bcf?: number }[]
): EnergyRiskInputs {
  const latest     = prices[prices.length - 1]?.price_mwh ?? null;
  const previous   = prices[prices.length - 2]?.price_mwh ?? null;
  const forecastH  = forecasts[0]?.temp_high_f ?? null;
  const gasLatest  = gasData[gasData.length - 1];

  return {
    ercotPrice:           latest,
    previousErcotPrice:   previous,
    ercotPriceHistory:    prices,
    weatherTemp:          forecastH,
    forecastHigh:         forecastH,
    forecastTrend:        forecastH && forecastH > 95 ? 'rising' : 'stable',
    gasStorage:           gasLatest?.storage_bcf ?? null,
    gasStorageVsFiveYear: gasLatest?.storage_pct_vs_avg ?? null,
    henryHubPrice:        gasLatest?.henry_hub_price ?? null,
    sourceHealth:         signals.data_sources,
    timestamp:            signals.computed_at,
    signalsResponse:      signals,
  };
}
