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
import DataSources from "@/components/widgets/DataSources";
import RecentAlerts from "@/components/widgets/RecentAlerts";
import EnergyRiskDrivers from "@/components/widgets/EnergyRiskDrivers";
import { supabase } from "@/lib/supabase";
import {
  getSignals, getERCOTPrices, getWeatherForecast, getGasData,
  type SignalsResponse, type ERCOTPrice, type WeatherForecast, type GasRecord,
} from "@/lib/api";

const LOCATIONS = ["Houston", "Dallas", "Austin", "San Antonio"] as const;
type Location = typeof LOCATIONS[number];

const EMPTY_SIGNAL = {
  type: "", signal_type: "", title: "Loading...", triggered: false,
  severity: "low" as const, value: null, threshold: null,
  message: "Fetching real-time data...", impact: "", time_horizon: "",
  confidence: null, computed_at: "",
};

// Full placeholder — every field the widgets touch, so nothing crashes before real data arrives
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
  summary:    "",
  disclaimer: "",
};

function UrgencyBanner({ signals }: { signals: SignalsResponse }) {
  if (!signals.data_valid) return null;
  const score   = signals.risk_score;
  const driver  = signals.primary_driver;
  const drivers = (signals.signal_drivers ?? []).filter(d => d.active).map(d => d.name);
  if (score === "high") {
    const driverList = drivers.length > 0 ? drivers.join(", ") : driver;
    return (
      <div className="mb-4 flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-sm text-red-300">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
        <span><span className="font-bold">Elevated Risk:</span> Multiple signals detected including {driverList}. Short-term volatility risk is elevated.</span>
      </div>
    );
  }
  if (score === "medium") {
    return (
      <div className="mb-4 flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-sm text-amber-300">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
        <span><span className="font-bold">Monitoring Recommended:</span> {driver} is elevating near-term conditions in Texas.</span>
      </div>
    );
  }
  return (
    <div className="mb-4 flex items-start gap-3 p-3.5 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-400">
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

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
      setLastUpdated(new Date());
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

  return (
    <>
      <Navbar />
      <main className="pt-24 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-black text-white">Texas Energy Intelligence Platform</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString("en-US", { timeZone: "America/Chicago", timeZoneName: "short" })}`
                  : "Loading market data..."}
              </p>
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

          {signalsReady && <UrgencyBanner signals={signals} />}

          {signalsError && !loading && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
              Risk signals are loading — retrying automatically. ERCOT prices are live.
            </div>
          )}

          <div className="mb-6 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200/60 text-center">
            TX Energy Risk provides informational analytics and market intelligence only. This does not constitute investment, trading, financial, legal, or procurement advice. Users are responsible for their own decisions.
          </div>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`card-glass border border-white/5 p-6 h-48 animate-pulse ${i >= 6 ? "lg:col-span-2" : ""}`} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

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
              />

              <ERCOTPriceMonitor prices={prices} loading={!signalsReady} />

              <VolatilityAlert signal={signals.signals?.price_volatility ?? EMPTY_SIGNAL} />

              <WeatherRisk
                forecasts={forecasts}
                signal={signals.signals?.weather_demand ?? EMPTY_SIGNAL}
              />

              <GasSupply
                records={gasRecs}
                latest={gasLatest}
                signal={signals.signals?.gas_supply ?? EMPTY_SIGNAL}
                gasToPower={signals.gas_to_power_impact}
              />

              <EnergyRiskDrivers signals={signals} />

              <DataSources
                sources={signals.data_sources}
                computedAt={signals.computed_at}
              />

              <RecentAlerts />

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
