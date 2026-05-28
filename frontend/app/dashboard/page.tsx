"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, MapPin, AlertTriangle, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import RiskScore from "@/components/widgets/RiskScore";
import ERCOTPriceMonitor from "@/components/widgets/ERCOTPriceMonitor";
import VolatilityAlert from "@/components/widgets/VolatilityAlert";
import WeatherRisk from "@/components/widgets/WeatherRisk";
import GasSupply from "@/components/widgets/GasSupply";
import AISummary from "@/components/widgets/AISummary";
import AIMarketReasoning from "@/components/widgets/AIMarketReasoning";
import DataSources from "@/components/widgets/DataSources";
import RecentAlerts from "@/components/widgets/RecentAlerts";
import EnergyRiskDrivers from "@/components/widgets/EnergyRiskDrivers";
import MarketInterpretation from "@/components/widgets/MarketInterpretation";
import WhatChanged from "@/components/widgets/WhatChanged";
import AIExecutiveBrief from "@/components/widgets/AIExecutiveBrief";
import GridPulseBackground from "@/components/ui/GridPulseBackground";
import { supabase } from "@/lib/supabase";
import {
  getSignals, getERCOTPrices, getWeatherForecast, getGasData, getAIReasoning,
  type SignalsResponse, type ERCOTPrice, type WeatherForecast, type GasRecord, type AIReasoningResponse, type EscalationProbability, type MarketSensitivity,
} from "@/lib/api";

const LOCATIONS = ["Houston", "Dallas", "Austin", "San Antonio"] as const;
type Location = typeof LOCATIONS[number];

const EMPTY_SIGNAL = {
  type: "", signal_type: "", title: "Loading...", triggered: false,
  severity: "low" as const, value: null, threshold: null,
  message: "Fetching real-time data...", impact: "", time_horizon: "",
  confidence: null, computed_at: "",
};

const PLACEHOLDER_SIGNALS: SignalsResponse = {
  computed_at:          "",
  risk_score:           "low",
  risk_headline:        "Loading risk data...",
  active_signals:       0,
  confidence:           null,
  confidence_note:      "",
  explanation:          "",
  impact:               "",
  primary_driver:       "",
  primary_driver_type:  "",
  risk_direction:       "stable",
  risk_direction_context: "",
  market_context:       "",
  secondary_factors:    [],
  signal_drivers:       [],
  data_valid:           false,
  data_status:          "loading",
  time_horizons:        { short_term: "", near_term: "", outlook: "" },
  data_sources: {
    ercot: { status: "unavailable", last_updated: null, age_minutes: null },
    noaa:  { status: "unavailable", last_updated: null, age_minutes: null },
    eia:   { status: "unavailable", last_updated: null, age_minutes: null },
  },
  demand_pressure:   { level: "low", explanation: "Loading..." },
  supply_pressure:   { level: "low", explanation: "Loading..." },
  market_reaction:   { level: "low", explanation: "Loading..." },
  gas_to_power_impact: { level: "low", explanation: "Loading..." },
  events:            [],
  risk_narrative:    { headline: "Loading...", body: "", temporal_context: "", next_period_note: "" },
  cost_impact:       { level: "low", label: "Loading", description: "" },
  market_condition:  { label: "Loading...", description: "" },
  alert_severity:    { level: "informational", label: "Loading", description: "" },
  signals: {
    price_volatility: EMPTY_SIGNAL,
    weather_demand:   EMPTY_SIGNAL,
    gas_supply:       EMPTY_SIGNAL,
  },
  signal_alignment: { label: "None", score: 0, description: "" },
  what_changed:          [],
  escalation_probability:       { level: "Low", pct: 0, rationale: "" },
  market_sensitivity:           { level: "Low Sensitivity", score: 0, description: "" },
  potential_escalation_drivers: [],
  summary:    "",
  disclaimer: "",
};

// Task 8 — rotating system activity messages
const ACTIVITY_MESSAGES = [
  "Monitoring live feeds",
  "Analyzing demand pressure",
  "Checking market response",
  "Updating confidence score",
  "Processing ERCOT data stream",
  "Evaluating risk indicators",
  "Scanning weather patterns",
  "Cross-referencing gas supply",
];

function SystemActivity({ signalsReady }: { signalsReady: boolean }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!signalsReady) return;
    const id = setInterval(() => setIdx(i => (i + 1) % ACTIVITY_MESSAGES.length), 12000);
    return () => clearInterval(id);
  }, [signalsReady]);
  return (
    <div className="flex items-center gap-1.5">
      <span className="activity-dot" />
      <span className="text-xs text-gray-600 transition-opacity duration-500">
        {signalsReady ? ACTIVITY_MESSAGES[idx] : "Initializing data feeds..."}
      </span>
    </div>
  );
}

function UrgencyBanner({ signals }: { signals: SignalsResponse }) {
  if (!signals.data_valid) return null;
  const score   = signals.risk_score;
  const driver  = signals.primary_driver;
  const drivers = (signals.signal_drivers ?? []).filter(d => d.active).map(d => d.name);
  if (score === "high") {
    const driverList = drivers.length > 0 ? drivers.join(", ") : driver;
    return (
      <div className="banner-scan mb-4 flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-sm text-red-300 leading-relaxed">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
        <span><span className="font-bold">Elevated Risk:</span> Multiple signals detected including {driverList}. Short-term volatility risk is elevated.</span>
      </div>
    );
  }
  if (score === "medium") {
    return (
      <div className="banner-scan mb-4 flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-sm text-amber-300 leading-relaxed">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
        <span><span className="font-bold">Monitoring Recommended:</span> {driver} is elevating near-term conditions in Texas.</span>
      </div>
    );
  }
  if (signals.active_signals > 0) {
    return (
      <div className="banner-scan mb-4 flex items-start gap-3 p-3.5 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-400 leading-relaxed">
        <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span><span className="font-bold">Conditions Stable</span> — Minor risk signals detected. Monitoring recommended.</span>
      </div>
    );
  }
  return (
    <div className="banner-scan mb-4 flex items-start gap-3 p-3.5 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-400 leading-relaxed">
      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span><span className="font-bold">Conditions Stable:</span> No significant risk signals detected.</span>
    </div>
  );
}

export default function DashboardPage() {
  const router    = useRouter();
  const [user,    setUser]    = useState<any>(null);
  const [location, setLocation] = useState<Location>("Houston");

  const [signals,      setSignals]      = useState<SignalsResponse>(PLACEHOLDER_SIGNALS);
  const [signalsReady, setSignalsReady] = useState(false);
  const [signalsError, setSignalsError] = useState(false);
  const [prices,       setPrices]       = useState<ERCOTPrice[]>([]);
  const [forecasts,    setForecasts]    = useState<WeatherForecast[]>([]);
  const [gasRecs,      setGasRecs]      = useState<GasRecord[]>([]);
  const [gasLatest,    setGasLatest]    = useState<GasRecord | null>(null);
  const [aiReasoning,  setAiReasoning]  = useState<AIReasoningResponse | null>(null);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiError,      setAiError]      = useState(false);

  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else setUser(data.user);
    });
  }, [router]);

  const fetchAll = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [sigData, priceData, wxData, gasData] = await Promise.allSettled([
        getSignals(location),
        getERCOTPrices(24),
        getWeatherForecast(location, 7),
        getGasData(8),
      ]);
      if (sigData.status === "fulfilled") {
        setSignals(sigData.value);
        setSignalsReady(true);
        setSignalsError(false);
      } else {
        setSignalsError(true);
        console.warn("[Dashboard] signals fetch failed:", sigData.reason);
      }
      if (priceData.status === "fulfilled") setPrices(priceData.value.prices);
      if (wxData.status    === "fulfilled") setForecasts(wxData.value.forecasts);
      if (gasData.status   === "fulfilled") {
        setGasRecs(gasData.value.records);
        setGasLatest(gasData.value.latest);
      }
      // AI reasoning — fire independently so it never blocks the dashboard
      setAiLoading(true);
      setAiError(false);
      getAIReasoning(location)
        .then((r) => { setAiReasoning(r); setAiLoading(false); })
        .catch(() => { setAiError(true); setAiLoading(false); });

      setLastUpdated(new Date());
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 900);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [location]);

  useEffect(() => { if (user) fetchAll(); }, [user, fetchAll]);
  useEffect(() => {
    const id = setInterval(() => fetchAll(true), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAll]);

  if (!user) return null;

  const atmClass = signals.risk_score === "high"   ? "atm-high"
                 : signals.risk_score === "medium" ? "atm-medium"
                 : "atm-low";

  // Panel glows — T4
  const riskGlow  = signals.risk_score === "high"   ? "panel-glow-red"
                  : signals.risk_score === "medium" ? "panel-glow-amber"
                  : "panel-glow-green";
  const demandLvl = signals.demand_pressure?.level ?? "low";
  const gasLvl    = signals.gas_to_power_impact?.level ?? "low";
  const weatherGlow = demandLvl === "high" ? "panel-glow-amber" : "";
  const gasGlow     = (gasLvl === "high" || gasLvl === "medium") ? "panel-glow-orange" : "";

  return (
    <>
      <div className={`atm-overlay ${atmClass}`} />
      <GridPulseBackground />
      <Navbar />
      <main className="pt-28 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* ── Page header ─────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Texas Energy Intelligence Platform
              </h1>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString("en-US", { timeZone: "America/Chicago", timeZoneName: "short" })}`
                  : "Loading market data..."}
              </p>
              <div className="mt-2">
                <SystemActivity signalsReady={signalsReady} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300">
                <MapPin className="w-4 h-4 text-gray-500" />
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value as Location)}
                  className="bg-transparent focus:outline-none cursor-pointer"
                >
                  {LOCATIONS.map((l) => <option key={l} value={l} className="bg-[#0d1428]">{l}</option>)}
                </select>
              </div>
              <button
                onClick={() => fetchAll(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* ── System status micro-indicators ──────────────────────── */}
          {signalsReady && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 -mt-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-500/70 uppercase tracking-wide">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                Monitoring Active
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-500/60 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                AI Synced
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-500/60 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Data Verified
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                Live Telemetry
              </span>
            </div>
          )}

          {signalsReady && <UrgencyBanner signals={signals} />}

          {signalsError && !loading && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
              Risk signals are loading — retrying automatically. ERCOT prices are live.
            </div>
          )}

          <div className="mb-4 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200/75 text-center leading-relaxed">
            TX Energy Risk provides informational analytics and market intelligence only. This does not constitute investment, trading, financial, legal, or procurement advice. Users are responsible for their own decisions.
          </div>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`card-glass border border-white/5 p-5 h-40 animate-pulse ${i >= 6 ? "lg:col-span-2" : ""}`} />
              ))}
            </div>
          ) : (
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4${justRefreshed ? " card-refreshing" : ""}`}>

              <RiskScore
                score={signals.risk_score}
                activeSignals={signals.active_signals}
                computedAt={signals.computed_at}
                summary={signals.summary}
                confidence={signals.confidence}
                confidenceNote={signals.confidence_note}
                explanation={signals.explanation}
                impact={signals.impact}
                primaryDriver={signals.primary_driver}
                riskDirection={signals.risk_direction}
                riskDirectionContext={signals.risk_direction_context}
                signalDrivers={signals.signal_drivers}
                secondaryFactors={signals.secondary_factors}
                dataValid={signals.data_valid}
                dataStatus={signals.data_status}
                riskHeadline={signals.risk_headline}
                timeHorizons={signals.time_horizons}
                marketCondition={signals.market_condition}
                alertSeverity={signals.alert_severity}
                signalAlignment={signals.signal_alignment}
                panelGlow={riskGlow}
              />

              <ERCOTPriceMonitor prices={prices} loading={!signalsReady} />

              {/* ── AI Executive Brief — full width below top row ─────── */}
              <AIExecutiveBrief
                signals={signals}
                reasoning={aiReasoning}
                aiLoading={aiLoading}
                computedAt={signals.computed_at}
                location={location}
              />

              <VolatilityAlert signal={signals.signals?.price_volatility ?? EMPTY_SIGNAL} />

              <WeatherRisk
                forecasts={forecasts}
                signal={signals.signals?.weather_demand ?? EMPTY_SIGNAL}
                panelGlow={weatherGlow}
              />

              <GasSupply
                records={gasRecs}
                latest={gasLatest}
                signal={signals.signals?.gas_supply ?? EMPTY_SIGNAL}
                gasToPower={signals.gas_to_power_impact}
                panelGlow={gasGlow}
              />

              <EnergyRiskDrivers signals={signals} />

              <DataSources
                sources={signals.data_sources}
                computedAt={signals.computed_at}
              />

              <RecentAlerts />

              <MarketInterpretation signals={signals} prices={prices} />

              {signals.what_changed && signals.what_changed.length > 0 && (
                <WhatChanged items={signals.what_changed} />
              )}


              <AIMarketReasoning
                reasoning={aiReasoning}
                loading={aiLoading}
                error={aiError}
                computedAt={signals.computed_at}
                confidence={signals.confidence}
              />

              <AISummary
                signals={signals}
                computedAt={signals.computed_at}
              />

            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
