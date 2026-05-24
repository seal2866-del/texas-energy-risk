/**
 * api.ts — typed fetch wrappers for the FastAPI backend.
 * Falls back gracefully if API is unavailable (returns mock shapes).
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, token?: string): Promise<T> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────

export type RiskScore = "low" | "medium" | "high";

export interface Signal {
  // Standardized fields (Task 8)
  type:        string;
  title:       string;
  message:     string;
  impact:      string;
  confidence:  number | null;
  // Existing fields
  signal_type: string;
  triggered:   boolean;
  severity:    RiskScore;
  value:       number | null;
  threshold:   number | null;
  computed_at: string;
}

export interface SignalsResponse {
  computed_at:    string;
  risk_score:     RiskScore;
  active_signals: number;
  confidence:     number | null;
  explanation:    string;
  impact:         string;
  data_valid:     boolean;
  data_status:    string;
  signals: {
    price_volatility: Signal;
    weather_demand:   Signal;
    gas_supply:       Signal;
  };
  summary:     string;
  disclaimer:  string;
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
  report_date:          string;
  storage_bcf:          number;
  storage_5yr_avg_bcf:  number;
  storage_pct_vs_avg:   number;
  henry_hub_price:      number;
  supply_pressure:      string;
  source:               string;
}

export interface AlertLog {
  id:              string;
  channel:         string;
  severity:        RiskScore;
  message:         string;
  sent_at:         string;
  acknowledged:    boolean;
}

// ── API calls ─────────────────────────────────────────────────

export const getSignals    = (location = "Houston") =>
  apiFetch<SignalsResponse>(`/api/signals/?location=${location}`);

export const getERCOTPrices = (hours = 24, point = "HB_HOUSTON") =>
  apiFetch<{ prices: ERCOTPrice[] }>(`/api/ercot/prices?hours=${hours}&settlement_point=${point}`);

export const getWeatherForecast = (location = "Houston", days = 7) =>
  apiFetch<{ forecasts: WeatherForecast[] }>(`/api/weather/forecast?location=${location}&days=${days}`);

export const getGasData = (weeks = 8) =>
  apiFetch<{ records: GasRecord[]; latest: GasRecord }>(`/api/gas/storage?weeks=${weeks}`);

export const getAlertLogs = (token: string) =>
  apiFetch<{ logs: AlertLog[] }>("/api/alerts/logs", token);

export const updateAlertPrefs = async (prefs: object, token: string) => {
  const res = await fetch(`${BASE}/api/alerts/preferences`, {
    method:  "PUT",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${token}`,
    },
    body: JSON.stringify(prefs),
  });
  return res.json();
};
