/**
 * api.ts -- typed fetch wrappers for the FastAPI backend.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, token?: string): Promise<T> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export type RiskScore = "low" | "medium" | "high";

export interface Signal {
  type:         string;
  title:        string;
  message:      string;
  impact:       string;
  time_horizon: string;
  confidence:   number | null;
  signal_type:  string;
  triggered:    boolean;
  severity:     RiskScore;
  value:        number | null;
  threshold:    number | null;
  computed_at:  string;
}

export interface DataSourceStatus {
  status:                "active" | "stale" | "unavailable";
  last_updated:          string | null;
  age_minutes:           number | null;
  source?:               string;
  // ERCOT verification fields (populated by signal_engine for ERCOT only)
  verification_status?:  "real-time" | "delayed" | "stale" | "unavailable" | "pending_confirmation";
  verification_reason?:  string;
  last_valid_price?:     number | null;
  price_range?:          "normal" | "elevated" | "extreme";
}

export interface ErcotVerification {
  is_valid:              boolean;
  status:                "real-time" | "delayed" | "stale" | "unavailable" | "pending_confirmation";
  confidence_adjustment: number;
  reason:                string;
  last_known_price:      number | null;
  last_known_ts:         string | null;
  price_range:           "normal" | "elevated" | "extreme";
}

export interface DataSources {
  ercot: DataSourceStatus;
  noaa:  DataSourceStatus;
  eia:   DataSourceStatus;
}

export interface TimeHorizons {
  short_term: string;
  near_term:  string;
  outlook:    string;
}

export interface SignalDriver {
  name:     string;
  type:     string;
  active:   boolean;
  severity: RiskScore;
  trend?:   "rising" | "stable" | "falling";
}

export interface SignalAlignment {
  label:       string;   // None | Weak | Moderate | Strong
  score:       number;
  description: string;
}

export interface WhatChangedItem {
  driver:    string;
  change:    string;
  direction: "rising" | "easing" | "stable" | "escalated" | "improved";
}

export interface EscalationProbability {
  level:     string;   // Low | Low-Moderate | Moderate | Elevated
  pct:       number;   // 0–95
  rationale: string;
}

export interface MarketSensitivity {
  level:       string;   // Low Sensitivity | Moderate Sensitivity | Elevated Sensitivity
  score:       number;   // 0–95
  description: string;
}

export interface DriverLevel {
  level:       RiskScore;
  explanation: string;
  score?:      number;
}

export interface GasToPowerImpact {
  level:       RiskScore;
  explanation: string;
}

export interface EnergyEvent {
  type:     string;
  severity: RiskScore;
  message:  string;
}

// Phase 11 -- Premium Intelligence Layer
export interface RiskNarrative {
  headline:         string;
  body:             string;
  temporal_context: string;
  next_period_note: string;
}

export interface CostImpact {
  level:       RiskScore;
  label:       string;
  description: string;
}

export interface MarketCondition {
  label:       string;  // Stable | Tightening | Volatile | Elevated Risk
  description: string;
}

export interface AlertSeverityInfo {
  level:       string;  // informational | monitoring | elevated | critical
  label:       string;
  description: string;
}

export interface SignalsResponse {
  computed_at:             string;
  risk_score:              RiskScore;
  risk_headline:           string;
  active_signals:          number;
  confidence:              number | null;
  confidence_note:         string;
  explanation:             string;
  impact:                  string;
  primary_driver:          string;
  primary_driver_type:     string;
  risk_direction:          "increasing" | "stable" | "decreasing";
  risk_direction_context?: string;
  market_context?:         string;
  signal_drivers?:         SignalDriver[];
  secondary_factors:       string[];
  data_valid:              boolean;
  data_status:             string;
  time_horizons:           TimeHorizons;
  data_sources:            DataSources;
  // Phase 1-2: Driver model
  demand_pressure?:     DriverLevel;
  supply_pressure?:     DriverLevel;
  market_reaction?:     DriverLevel;
  gas_to_power_impact?: GasToPowerImpact;
  // Phase 5: Events
  events?:              EnergyEvent[];
  // Data verification layer
  ercot_verification?:  ErcotVerification;
  // Phase 11: Premium Intelligence
  risk_narrative?:      RiskNarrative;
  cost_impact?:         CostImpact;
  market_condition?:    MarketCondition;
  alert_severity?:      AlertSeverityInfo;
  signals: {
    price_volatility: Signal;
    weather_demand:   Signal;
    gas_supply:       Signal;
  };
  signal_alignment?:       SignalAlignment;
  what_changed?:           WhatChangedItem[];
  escalation_probability?:       EscalationProbability;
  market_sensitivity?:           MarketSensitivity;
  potential_escalation_drivers?: string[];
  // Phase 12 — Enterprise Intelligence
  market_transition?:     MarketTransition;
  scenarios?:             Scenario[];
  operational_exposure?:  OperationalExposure;
  // Phase 10 — Predictive Intelligence
  weather_persistence?:   WeatherPersistence;
  early_warnings?:        EarlyWarnings;
  risk_trend?:            RiskTrend;
  gas_power_correlation?: GasPowerCorrelation;
  interval_intelligence?: IntervalIntelligence;
  // Henry Hub natural gas price signal
  henry_hub?:          HenryHubData;
  henry_hub_signal?:   Signal;
  henry_hub_exposure?: { level: string; price: number; daily_chg: number; weekly_chg: number; market_state: string; description: string; };
  summary:    string;
  disclaimer: string;
}

export interface HenryHubData {
  price:             number;
  daily_change_pct:  number;
  weekly_change_pct: number;
  market_state:      "normal" | "watch" | "elevated" | "critical";
  watch_threshold:   number;
  unit:              string;
  report_date:       string;
  history?:          { date: string; price: number }[];
  source:            string;
}

export interface ERCOTPrice {
  timestamp:        string;
  settlement_point: string;
  price_mwh:        number;
  price_type:       string;
  source:           string;
}

export interface WeatherForecast {
  forecast_time: string;
  location_name: string;
  temp_high_f:   number;
  temp_low_f:    number;
  condition:     string;
  demand_risk:   RiskScore;
  source:        string;
}

export interface GasRecord {
  report_date:         string;
  storage_bcf:         number;
  storage_5yr_avg_bcf: number;
  storage_pct_vs_avg:  number;
  henry_hub_price:     number;
  supply_pressure:     string;
  source:              string;
}

export interface AlertLog {
  id:                    string;
  channel:               string;
  severity:              RiskScore;
  message:               string;
  sent_at:               string;
  created_at?:           string;
  acknowledged:          boolean;
  risk_level?:           string;
  previous_risk_level?:  string;
  alert_type?:           string;
  primary_driver?:       string;
  risk_direction?:       string;
  city?:                 string;
  confidence?:           number | null;
  ercot_price?:          number | null;
  weather_temp?:         number | null;
  gas_storage?:          number | null;
  source_health_status?: string;
  delivery_status?:      string;
  delivered_email?:      boolean;
  delivered_sms?:        boolean;
  voice_sent?:           boolean;
}

export const getSignals = (location = "Houston") =>
  apiFetch<SignalsResponse>(`/api/signals/?location=${location}`);

export const getERCOTPrices = (hours = 24, point = "HB_HOUSTON") =>
  apiFetch<{ prices: ERCOTPrice[] }>(`/api/ercot/prices?hours=${hours}&settlement_point=${point}`);

export const getWeatherForecast = (location = "Houston", days = 7) =>
  apiFetch<{ forecasts: WeatherForecast[] }>(`/api/weather/forecast?location=${location}&days=${days}`);

export const getGasData = (weeks = 8) =>
  apiFetch<{ records: GasRecord[]; latest: GasRecord }>(`/api/gas/storage?weeks=${weeks}`);

export const getAlertLogs = (limit = 20) =>
  apiFetch<{ alerts: AlertLog[] }>(`/api/alerts/log/?limit=${limit}`);

export interface AlertPrefs {
  email_alerts?:              boolean;
  sms_alerts?:                boolean;
  sms_enabled?:               boolean;
  sms_phone?:                 string;
  slack_enabled?:             boolean;
  slack_webhook_url?:         string;
  teams_enabled?:             boolean;
  teams_webhook_url?:         string;
  escalation_enabled?:        boolean;
  escalation_minutes?:        number;
  voice_enabled?:             boolean;
  alert_frequency?:           string;
  risk_threshold?:            string;
  city?:                      string;
  price_volatility_alert?:    boolean;
  weather_demand_alert?:      boolean;
  gas_supply_alert?:          boolean;
  data_source_alert?:         boolean;
  quiet_hours_enabled?:       boolean;
  quiet_start_time?:          string;
  quiet_end_time?:            string;
  price_threshold_mwh?:       number;
  temp_high_threshold_f?:     number;
  temp_low_threshold_f?:      number;
  gas_storage_pct_threshold?: number;
  digest_enabled?:            boolean;
  digest_email?:              string;
}

export const updateAlertPrefs = async (prefs: AlertPrefs, token: string): Promise<{ status: string }> => {
  const headers: HeadersInit = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${token}`,
  };
  const res = await fetch(`${BASE}/api/alerts/preferences`, {
    method:  "PUT",
    headers,
    body:    JSON.stringify(prefs),
    cache:   "no-store",
  });
  if (!res.ok) throw new Error(`updateAlertPrefs error ${res.status}`);
  return res.json();
};

// ── Phase 12 — Enterprise Operational Intelligence Types ──────────────────────

export interface MarketTransition {
  transition:  "stable" | "tightening" | "elevated" | "convergence" | "escalating" | "stabilising";
  from_state:  string;
  to_state:    string;
  label:       string;
  urgency:     "low" | "medium" | "high";
  description: string;
  action:      string;
}

export interface Scenario {
  id:          string;
  trigger:     string;
  outcome:     string;
  probability: "low" | "moderate" | "elevated" | "high";
  full:        string;
}

export interface OperationalExposure {
  level:      string;
  cls:        "low" | "moderate" | "elevated" | "high";
  score:      number;
  short_desc: string;
  detail:     string;
  drivers:    string[];
}

// ── Phase 10 — Predictive Intelligence Types ──────────────────────────────────

export interface WeatherPersistence {
  consecutive_high_days:  number;
  overnight_cooling_weak: boolean;
  persistence_risk:       "low" | "moderate" | "elevated" | "high";
  description:            string;
}

export interface EarlyWarnings {
  warnings:         string[];
  warning_count:    number;
  highest_severity: "none" | "watch" | "caution" | "alert";
}

export interface RiskTrend {
  trajectory:  "improving" | "stable" | "tightening" | "deteriorating" | "accelerating";
  label:       string;
  description: string;
  momentum:    "positive" | "neutral" | "negative";
}

export interface GasPowerCorrelation {
  correlation_level:   "low" | "moderate" | "elevated" | "high";
  sensitivity:         string;
  description:         string;
  henry_hub_price:     number;
  storage_pct_vs_avg:  number;
}

export interface IntervalOutlook {
  label:            string;
  outlook:          string;
  confidence:       number;
  escalation_pct:   number;
  monitoring_focus: string;
}

export interface IntervalIntelligence {
  short_term: IntervalOutlook;
  near_term:  IntervalOutlook;
  outlook:    IntervalOutlook;
}

// ── AI Reasoning Layer ────────────────────────────────────────────────────────

export interface AIReasoningResponse {
  executive_summary:             string;
  current_market_interpretation: string;
  key_driver_analysis:           string;
  escalation_watch:              string;
  confidence_note:               string;
  recommended_monitoring_focus:  string;
  historical_context?:           string;
  generated_at:                  string;
  model:                         string;
  disclaimer:                    string;
  ai_powered:                    boolean;
  from_cache:                    boolean;
  fallback_reason?:              "no_api_key" | "api_error" | "parse_error" | null;
}

export const getAIReasoning = (location = "Houston") =>
  apiFetch<AIReasoningResponse>(`/api/ai-reasoning?location=${location}`);

// -- Historical signal snapshots

export interface SignalSnapshot {
  computed_at:          string;
  risk_score:           string;
  risk_score_numeric:   number;
  risk_direction?:      string;
  confidence?:          number;
  escalation_pct?:      number;
  demand_level?:        string;
  supply_level?:        string;
  market_level?:        string;
  ercot_price?:         number;
  primary_driver?:      string;
  active_signals?:      number;
}

export interface SignalHistory {
  location:   string;
  hours:      number;
  count:      number;
  snapshots:  SignalSnapshot[];
}

export const getSignalHistory = (location = "Houston", hours = 168) =>
  apiFetch<SignalHistory>(`/api/signals/history?location=${encodeURIComponent(location)}&hours=${hours}`);


// -- Phase 7: Multi-Location Grid Intelligence

export interface GridZoneEntry {
  location:        string;
  ercot_zone:      string;
  risk_score:      RiskScore | "unknown";
  risk_direction:  string;
  confidence:      number | null;
  ercot_price:     number | null;
  primary_driver:  string | null;
  computed_at:     string | null;
  is_stale:        boolean;
}

export interface GridSummary {
  total_locations:   number;
  reporting_count:   number;
  high_risk_count:   number;
  medium_risk_count: number;
  statewide_status:  "low" | "medium" | "high";
  worst_location:    string | null;
  computed_at:       string;
}

export interface GridOverviewResponse {
  zones:   GridZoneEntry[];
  summary: GridSummary;
}

export const getGridOverview = () =>
  apiFetch<GridOverviewResponse>(`/api/grid/overview`);

// -- Phase 8: Historical Analytics

export interface HistoricalRiskDistribution {
  count: number;
  pct:   number;
}

export interface HistoricalSummary {
  location:          string;
  days:              number;
  data_available:    boolean;
  snapshot_count:    number;
  risk_distribution: {
    low:    HistoricalRiskDistribution;
    medium: HistoricalRiskDistribution;
    high:   HistoricalRiskDistribution;
  };
  avg_risk_numeric:   number | null;
  avg_confidence:     number | null;
  peak_price_mwh:     number | null;
  avg_price_mwh:      number | null;
  top_primary_driver: string | null;
  driver_counts:      Record<string, number>;
  first_snapshot:     string | null;
  last_snapshot:      string | null;
}

export interface AnomalyScore {
  location:      string;
  anomaly_score: number | null;
  is_anomalous:  boolean;
  baseline_avg:  number | null;
  baseline_std:  number | null;
  direction:     string;
  sample_size?:  number;
  note:          string;
}

export interface SpikePrecursorPattern {
  avg_pre_spike_risk_numeric: number | null;
  avg_pre_spike_price_mwh:    number | null;
  most_common_demand_level:   string | null;
  top_preceding_driver:       string | null;
  top_risk_direction:         string | null;
  driver_frequency:           Record<string, number>;
}

export interface SpikePrecursors {
  location:           string;
  spike_count:        number;
  data_available:     boolean;
  spike_timestamps:   string[];
  precursor_pattern:  SpikePrecursorPattern | null;
  note?:              string;
}

export interface HistoricalAnalytics {
  location:    string;
  summary:     HistoricalSummary;
  anomaly:     AnomalyScore;
  precursors:  SpikePrecursors;
  computed_at: string;
}

export const getHistoricalAnalytics = (location = "Houston", riskNumeric = 2.0) =>
  apiFetch<HistoricalAnalytics>(
    `/api/history/analytics?location=${encodeURIComponent(location)}&risk_numeric=${riskNumeric}`
  );
