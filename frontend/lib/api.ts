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
  signal_alignment?: SignalAlignment;
  what_changed?:     WhatChangedItem[];
  summary:    string;
  disclaimer: string;
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
  email_alerts?:           boolean;
  sms_alerts?:             boolean;
  voice_enabled?:          boolean;
  alert_frequency?:        string;
  risk_threshold?:         string;
  city?:                   string;
  price_volatility_alert?: boolean;
  weather_demand_alert?:   boolean;
  gas_supply_alert?:       boolean;
  data_source_alert?:      boolean;
  quiet_hours_enabled?:    boolean;
  quiet_hours_start?:      string;
  quiet_hours_end?:        string;
  phone_number?:           string;
}

export const updateAlertPrefs = (prefs: AlertPrefs, token: string) =>
  apiFetch<{ success: boolean }>(`/api/alerts/prefs/`, token);

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
}

export const getAIReasoning = (location = "Houston") =>
  apiFetch<AIReasoningResponse>(`/api/ai-reasoning?location=${location}`);
