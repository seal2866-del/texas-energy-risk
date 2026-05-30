"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, MapPin, AlertTriangle, AlertCircle, CheckCircle, Loader2, FileDown, ChevronDown, ChevronUp } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import RiskScore from "@/components/widgets/RiskScore";
import ERCOTPriceMonitor from "@/components/widgets/ERCOTPriceMonitor";
import VolatilityAlert from "@/components/widgets/VolatilityAlert";
import WeatherRisk from "@/components/widgets/WeatherRisk";
import GasSupply from "@/components/widgets/GasSupply";
import AIMarketReasoning from "@/components/widgets/AIMarketReasoning";
import DataSources from "@/components/widgets/DataSources";
import RecentAlerts from "@/components/widgets/RecentAlerts";
import EnergyRiskDrivers from "@/components/widgets/EnergyRiskDrivers";
import WhatChanged from "@/components/widgets/WhatChanged";
import AIExecutiveBrief from "@/components/widgets/AIExecutiveBrief";
import RecommendedActions from "@/components/widgets/RecommendedActions";
import OperationalConsiderations from "@/components/widgets/OperationalConsiderations";
import MonitoringPriorities from "@/components/widgets/MonitoringPriorities";
import OperationalSignificance from "@/components/widgets/OperationalSignificance";
import PotentialImpact from "@/components/widgets/PotentialImpact";
import ImpactAssessment from "@/components/widgets/ImpactAssessment";
import EscalationTriggers from "@/components/widgets/EscalationTriggers";
import OperationalWatchList from "@/components/widgets/OperationalWatchList";
import CostExposure from "@/components/widgets/CostExposure";
import OperationalStatusBanner from "@/components/widgets/OperationalStatusBanner";
import ManagementSummary from "@/components/widgets/ManagementSummary";
import ExecutiveDecisionCard from "@/components/widgets/ExecutiveDecisionCard";
import ExecutiveKPIRow from "@/components/widgets/ExecutiveKPIRow";
import WatchToday from "@/components/widgets/WatchToday";
import NextReview from "@/components/widgets/NextReview";
import CostImpact from "@/components/widgets/CostImpact";
import WhyRiskIsLow from "@/components/widgets/WhyRiskIsLow";
import ScenarioAnalysis from "@/components/widgets/ScenarioAnalysis";
import RootCauseEngine from "@/components/widgets/RootCauseEngine";
import TopRisks from "@/components/widgets/TopRisks";
import TimeToThreshold from "@/components/widgets/TimeToThreshold";
import RiskMomentum from "@/components/widgets/RiskMomentum";
import AlertPreview from "@/components/widgets/AlertPreview";
import RiskTimeline from "@/components/widgets/RiskTimeline";
import AIInsightEngine from "@/components/widgets/AIInsightEngine";
import EscalationPath from "@/components/widgets/EscalationPath";
import EarlyWarningEngine from "@/components/widgets/EarlyWarningEngine";
import IntervalIntelligenceWidget from "@/components/widgets/IntervalIntelligence";
import SystemHealthCenter from "@/components/widgets/SystemHealthCenter";
import RiskHistoryChart from "@/components/widgets/RiskHistoryChart";
import PredictiveOutlook from "@/components/widgets/PredictiveOutlook";
import OperationalExposure from "@/components/widgets/OperationalExposure";
import RiskModelDebug from "@/components/widgets/RiskModelDebug";
import GridPulseBackground from "@/components/ui/GridPulseBackground";
import { energyRiskEngine, buildEngineInputs, type RiskModel } from "@/lib/energyRiskEngine";
import { validateInputs, type ValidationResult } from "@/lib/dataValidation";
import { supabase } from "@/lib/supabase";
import {
  getSignals, getERCOTPrices, getWeatherForecast, getGasData, getAIReasoning, getSignalHistory,
  type SignalsResponse, type ERCOTPrice, type WeatherForecast, type GasRecord, type AIReasoningResponse, type EscalationProbability, type MarketSensitivity, type SignalSnapshot,
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
  weather_persistence:   { consecutive_high_days: 0, overnight_cooling_weak: false, persistence_risk: "low", description: "" },
  early_warnings:        { warnings: [], warning_count: 0, highest_severity: "none" },
  risk_trend:            { trajectory: "stable", label: "Stable", description: "", momentum: "neutral" },
  gas_power_correlation: { correlation_level: "low", sensitivity: "", description: "", henry_hub_price: 0, storage_pct_vs_avg: 0 },
  interval_intelligence: undefined,
  market_transition:    undefined,
  scenarios:            [],
  operational_exposure: undefined,
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

function CollapsibleAI({ reasoning, aiLoading, aiError, computedAt, confidence }: {
  reasoning: AIReasoningResponse | null;
  aiLoading: boolean;
  aiError: string;
  computedAt: string;
  confidence: number | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card-glass border border-white/8 rounded-2xl overflow-hidden lg:col-span-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 text-left">AI Deep Analysis</p>
          <p className="text-xs text-gray-400 text-left">Expand for full AI market reasoning</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && (
        <div className="px-1 pb-1">
          <AIMarketReasoning
            reasoning={reasoning}
            loading={aiLoading}
            error={aiError}
            computedAt={computedAt}
            confidence={confidence}
          />
        </div>
      )}
    </div>
  );
}

function UrgencyBanner({ signals, riskModel }: { signals: SignalsResponse; riskModel?: RiskModel | null }) {
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
  // Low risk: check engine early warnings and backend events before declaring "no signals"
  const earlyWarnings = riskModel?.earlyWarningSignals ?? [];
  const events        = signals.events ?? [];
  if (earlyWarnings.length > 0 || events.length > 0) {
    const context = earlyWarnings.length > 0
      ? earlyWarnings[0].message
      : (events[0] as any)?.description ?? (events[0] as any)?.type ?? "active monitoring event";
    return (
      <div className="banner-scan mb-4 flex items-start gap-3 p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-sm text-cyan-300 leading-relaxed">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-400" />
        <span><span className="font-bold">No price escalation detected</span> — {context}. Continuing to monitor.</span>
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
  const [snapshots,    setSnapshots]    = useState<SignalSnapshot[]>([]);
  const [aiReasoning,  setAiReasoning]  = useState<AIReasoningResponse | null>(null);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiError,      setAiError]      = useState(false);

  const [exportingPdf,  setExportingPdf]  = useState(false);

  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [execMode,      setExecMode]      = useState(true); // true = Executive, false = Analyst
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null);

  // ── Central Risk Engine (Phase 3) ─────────────────────────────
  const riskModel = useMemo<RiskModel | null>(() => {
    if (!signalsReady || !signals.data_valid) return null;
    try {
      const inputs = buildEngineInputs(signals, prices, forecasts, gasRecs);
      return energyRiskEngine(inputs);
    } catch { return null; }
  }, [signals, prices, forecasts, gasRecs, signalsReady]);

  const validation = useMemo<ValidationResult | null>(() => {
    if (!signalsReady) return null;
    try {
      return validateInputs({
        ercotPrice:         prices[prices.length - 1]?.price_mwh ?? null,
        ercotPriceHistory:  prices.map(p => ({ price_mwh: p.price_mwh, timestamp: p.timestamp, source: p.source })),
        sourceHealth:       signals.data_sources,
        weatherTemp:        forecasts[0]?.temp_high_f ?? null,
        gasStorage:         gasLatest?.storage_pct_vs_avg ?? null,
      });
    } catch { return null; }
  }, [prices, forecasts, gasLatest, signals.data_sources, signalsReady]);

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
      // Signal history for predictive outlook — fire independently
      getSignalHistory(location, 168)
        .then(r => setSnapshots(r.snapshots ?? []))
        .catch(() => { /* silent — predictive widget shows empty state */ });

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

  const handleExportBrief = async () => {
    setExportingPdf(true);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const payload = {
        risk_score:           signals.risk_score === "high" ? 8 : signals.risk_score === "medium" ? 5 : 2,
        risk_level:           signals.risk_score,
        risk_direction:       signals.risk_direction,
        signal_alignment:     signals.signal_alignment?.label,
        escalation_prob:      signals.escalation_probability?.pct ?? null,
        confidence:           signals.confidence,
        location,
        demand_condition:     signals.demand_pressure?.level,
        supply_condition:     signals.supply_pressure?.level,
        market_condition:     signals.market_reaction?.level,
        ai_summary:           aiReasoning?.executive_summary ?? signals.summary,
        operational_outlook:  aiReasoning?.recommended_monitoring_focus ?? signals.time_horizons?.outlook,
        weather_persistence:  signals.weather_persistence,
        early_warnings:       signals.early_warnings,
        risk_trend:           signals.risk_trend,
        interval_intelligence: signals.interval_intelligence,
        operational_exposure: signals.operational_exposure,
        market_transition:    signals.market_transition,
        scenarios:            signals.scenarios,
        cost_impact:          signals.cost_impact,
        what_changed:         signals.what_changed,
      };
      const res = await fetch(`${BASE}/api/export/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const now  = new Date();
      a.href     = url;
      a.download = `tx-energy-brief-${now.toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Export] PDF download failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

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
              {signalsReady && (
                <button
                  onClick={handleExportBrief}
                  disabled={exportingPdf}
                  title="Download executive PDF brief"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/30 text-sm text-blue-300 transition-all disabled:opacity-50"
                >
                  {exportingPdf
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <FileDown className="w-4 h-4" />}
                  {exportingPdf ? "Generating..." : "Export Brief"}
                </button>
              )}
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

          {signalsReady && <UrgencyBanner signals={signals} riskModel={riskModel} />}

          {/* ── Mode toggle ─────────────────────────────────────────── */}
          <div className="flex items-center gap-1 mb-3 p-1 rounded-xl bg-white/5 border border-white/8 w-fit">
            <button
              onClick={() => setExecMode(true)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                execMode
                  ? "bg-white/12 text-white border border-white/15"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Executive Mode
            </button>
            <button
              onClick={() => setExecMode(false)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !execMode
                  ? "bg-white/12 text-white border border-white/15"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Analyst Mode
            </button>
          </div>

          {/* ── Operational Status Banner ────────────────────────────── */}
          {signalsReady && (
            <OperationalStatusBanner
              riskScore={signals.risk_score}
              riskDirection={signals.risk_direction}
              demandPressure={signals.demand_pressure}
              supplyPressure={signals.supply_pressure}
              marketReaction={signals.market_reaction}
              activeSignals={signals.active_signals}
              computedAt={signals.computed_at}
            />
          )}

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

              {/* ═══════════════════════════════════════════════════════
                  SCREEN 1 — Decision-making information
                  Priority: Risk State → Actions → Brief → Assessment
              ═══════════════════════════════════════════════════════ */}

              {/* ── EXECUTIVE DECISION CARD — first thing seen ──────── */}
              <ExecutiveDecisionCard
                riskScore={signals.risk_score}
                riskDirection={signals.risk_direction}
                confidence={signals.confidence}
                demandPressure={signals.demand_pressure}
                supplyPressure={signals.supply_pressure}
                marketReaction={signals.market_reaction}
                activeSignals={signals.active_signals}
                computedAt={signals.computed_at}
                ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                temperature={forecasts[0]?.temp_high_f ?? undefined}
              />

              {/* ── EXECUTIVE KPI ROW — single glance summary ────────── */}
              <ExecutiveKPIRow
                riskScore={signals.risk_score}
                riskDirection={signals.risk_direction}
                demandPressure={signals.demand_pressure}
                supplyPressure={signals.supply_pressure}
                marketReaction={signals.market_reaction}
                activeSignals={signals.active_signals}
                confidence={signals.confidence}
              />

              {/* ── Risk Score + ERCOT Price ─────────────────────────── */}
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
                earlyWarnings={riskModel?.earlyWarningSignals}
              />
              <ERCOTPriceMonitor prices={prices} loading={!signalsReady} priceBehavior={riskModel?.priceBehavior ?? null} />

              {/* ── Operational Considerations ───────────────────────── */}
              <OperationalConsiderations
                riskScore={signals.risk_score}
                riskDirection={signals.risk_direction}
                demandPressure={signals.demand_pressure}
                supplyPressure={signals.supply_pressure}
                marketReaction={signals.market_reaction}
                activeSignals={signals.active_signals}
                computedAt={signals.computed_at}
              />

              {/* ── Monitoring Priorities ────────────────────────────── */}
              <MonitoringPriorities
                riskScore={signals.risk_score}
                ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                temperature={forecasts[0]?.temp_high_f ?? undefined}
                henryHub={gasLatest?.henry_hub_price ?? undefined}
                demandPressure={signals.demand_pressure}
                supplyPressure={signals.supply_pressure}
                dataSources={signals.data_sources}
              />

              {/* ── Management Summary ───────────────────────────────── */}
              <ManagementSummary
                riskScore={signals.risk_score}
                riskDirection={signals.risk_direction}
                primaryDriver={signals.primary_driver}
                demandPressure={signals.demand_pressure}
                supplyPressure={signals.supply_pressure}
                computedAt={signals.computed_at}
              />

              {/* ── Executive Brief ──────────────────────────────────── */}
              <AIExecutiveBrief
                signals={signals}
                reasoning={aiReasoning}
                aiLoading={aiLoading}
                computedAt={signals.computed_at}
                location={location}
                earlyWarnings={riskModel?.earlyWarningSignals}
              />

              {/* ── Impact Assessment + Cost Impact ──────────────────── */}
              <ImpactAssessment
                riskScore={signals.risk_score}
                demandPressure={signals.demand_pressure}
                supplyPressure={signals.supply_pressure}
                marketReaction={signals.market_reaction}
                gasToPower={signals.gas_to_power_impact}
                dataSources={signals.data_sources}
              />
              <CostExposure
                riskScore={signals.risk_score}
                ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                marketReaction={signals.market_reaction}
              />

              {/* ── Watch Today + Next Review ────────────────────────── */}
              <WatchToday
                ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                temperature={forecasts[0]?.temp_high_f ?? undefined}
                henryHub={gasLatest?.henry_hub_price ?? undefined}
              />
              <NextReview
                riskScore={signals.risk_score}
                ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                temperature={forecasts[0]?.temp_high_f ?? undefined}
                henryHub={gasLatest?.henry_hub_price ?? undefined}
              />

              {/* ── Cost Impact — full width ─────────────────────────── */}
              <CostImpact
                riskScore={signals.risk_score}
                ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                marketReaction={signals.market_reaction}
              />

              {/* ── Escalation Path — operational playbook ───────────── */}
              <EscalationPath
                riskScore={signals.risk_score}
                ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                temperature={forecasts[0]?.temp_high_f ?? undefined}
                henryHub={gasLatest?.henry_hub_price ?? undefined}
              />


              {/* ═══════════════════════════════════════════════════════
                  ANALYST MODE ONLY — Operational depth
              ═══════════════════════════════════════════════════════ */}
              {!execMode && (
                <>
                  {/* ── Intelligence: Top Risks + Momentum + Alert Preview ── */}
                  <TopRisks
                    demandPressure={signals.demand_pressure}
                    supplyPressure={signals.supply_pressure}
                    marketReaction={signals.market_reaction}
                    gasToPower={signals.gas_to_power_impact}
                    ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                    temperature={forecasts[0]?.temp_high_f ?? undefined}
                    henryHub={gasLatest?.henry_hub_price ?? undefined}
                  />
                  <RiskMomentum
                    snapshots={snapshots}
                    currentScore={signals.risk_score}
                  />
                  <AlertPreview
                    riskScore={signals.risk_score}
                    riskDirection={signals.risk_direction}
                    ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                    temperature={forecasts[0]?.temp_high_f ?? undefined}
                    henryHub={gasLatest?.henry_hub_price ?? undefined}
                    demandPressure={signals.demand_pressure}
                    supplyPressure={signals.supply_pressure}
                  />

                  {/* ── Time to Threshold + Risk Timeline ───────────────── */}
                  <TimeToThreshold
                    ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                    temperature={forecasts[0]?.temp_high_f ?? undefined}
                    henryHub={gasLatest?.henry_hub_price ?? undefined}
                  />
                  <RiskTimeline
                    riskScore={signals.risk_score}
                    riskDirection={signals.risk_direction}
                    snapshots={snapshots}
                    timeHorizons={signals.time_horizons}
                  />

                  {/* ── AI Insight Engine ────────────────────────────────── */}
                  <AIInsightEngine
                    riskScore={signals.risk_score}
                    demandPressure={signals.demand_pressure}
                    supplyPressure={signals.supply_pressure}
                    marketReaction={signals.market_reaction}
                    gasToPower={signals.gas_to_power_impact}
                    ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                    temperature={forecasts[0]?.temp_high_f ?? undefined}
                    henryHub={gasLatest?.henry_hub_price ?? undefined}
                    riskDirection={signals.risk_direction}
                    activeSignals={signals.active_signals}
                    computedAt={signals.computed_at}
                  />

                  {/* ── Operational Significance + Potential Impact ──────── */}
                  <OperationalSignificance
                    riskScore={signals.risk_score}
                    riskDirection={signals.risk_direction}
                    ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                    temperature={forecasts[0]?.temp_high_f ?? undefined}
                    henryHub={gasLatest?.henry_hub_price ?? undefined}
                    demandPressure={signals.demand_pressure}
                    supplyPressure={signals.supply_pressure}
                    marketReaction={signals.market_reaction}
                  />
                  <PotentialImpact
                    riskScore={signals.risk_score}
                    riskDirection={signals.risk_direction}
                    demandPressure={signals.demand_pressure}
                    supplyPressure={signals.supply_pressure}
                    marketReaction={signals.market_reaction}
                    ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                    temperature={forecasts[0]?.temp_high_f ?? undefined}
                  />

                  {/* ── Why + Root Cause + Scenarios ─────────────────────── */}
                  <WhyRiskIsLow
                    riskScore={signals.risk_score}
                    demandPressure={signals.demand_pressure}
                    supplyPressure={signals.supply_pressure}
                    marketReaction={signals.market_reaction}
                    gasToPower={signals.gas_to_power_impact}
                    dataSources={signals.data_sources}
                  />
                  <RootCauseEngine
                    signals={signals}
                    snapshots={snapshots}
                  />
                  <ScenarioAnalysis
                    riskScore={signals.risk_score}
                    ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                    temperature={forecasts[0]?.temp_high_f ?? undefined}
                    henryHub={gasLatest?.henry_hub_price ?? undefined}
                  />
                  <EscalationTriggers
                    ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                    temperature={forecasts[0]?.temp_high_f ?? undefined}
                    henryHub={gasLatest?.henry_hub_price ?? undefined}
                    dataSources={signals.data_sources}
                    computedAt={signals.computed_at}
                  />
                  <OperationalWatchList
                    riskScore={signals.risk_score}
                    ercotPrice={prices[prices.length - 1]?.price_mwh ?? undefined}
                    temperature={forecasts[0]?.temp_high_f ?? undefined}
                    henryHub={gasLatest?.henry_hub_price ?? undefined}
                    gasStorageVsAvg={gasLatest?.storage_pct_vs_avg ?? undefined}
                    demandPressure={signals.demand_pressure}
                    dataSources={signals.data_sources}
                  />
                  <EnergyRiskDrivers signals={signals} />

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

                  <IntervalIntelligenceWidget intelligence={signals.interval_intelligence} />
                  {signalsReady && snapshots.length >= 6 && (
                    <PredictiveOutlook snapshots={snapshots} />
                  )}

                  {signalsReady && <RiskHistoryChart location={location} />}

                  {riskModel && <OperationalExposure riskModel={riskModel} />}

                  <EarlyWarningEngine
                    earlyWarnings={signals.early_warnings}
                    riskTrend={signals.risk_trend}
                    weatherPersistence={signals.weather_persistence}
                  />

                  {signals.what_changed && signals.what_changed.length > 0 && (
                    <WhatChanged items={signals.what_changed} />
                  )}

                  <CollapsibleAI
                    reasoning={aiReasoning}
                    aiLoading={aiLoading}
                    aiError={aiError}
                    computedAt={signals.computed_at}
                    confidence={signals.confidence}
                  />

                  <DataSources sources={signals.data_sources} computedAt={signals.computed_at} />
                  <RecentAlerts />
                  <SystemHealthCenter
                    signals={signals}
                    aiLoading={aiLoading}
                    aiSynced={!!aiReasoning}
                    riskModel={riskModel ?? undefined}
                  />
                  <RiskModelDebug riskModel={riskModel} validation={validation} />
                </>
              )}

            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
