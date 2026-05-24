"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, MapPin } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import RiskScore from "@/components/widgets/RiskScore";
import ERCOTPriceMonitor from "@/components/widgets/ERCOTPriceMonitor";
import VolatilityAlert from "@/components/widgets/VolatilityAlert";
import WeatherRisk from "@/components/widgets/WeatherRisk";
import GasSupply from "@/components/widgets/GasSupply";
import AISummary from "@/components/widgets/AISummary";
import { supabase } from "@/lib/supabase";
import {
  getSignals, getERCOTPrices, getWeatherForecast, getGasData,
  type SignalsResponse, type ERCOTPrice, type WeatherForecast, type GasRecord,
} from "@/lib/api";

const LOCATIONS = ["Houston", "Dallas", "Austin", "San Antonio"] as const;
type Location = typeof LOCATIONS[number];

export default function DashboardPage() {
  const router    = useRouter();
  const [user,    setUser]    = useState<any>(null);
  const [location, setLocation] = useState<Location>("Houston");

  const [signals,   setSignals]   = useState<SignalsResponse | null>(null);
  const [prices,    setPrices]    = useState<ERCOTPrice[]>([]);
  const [forecasts, setForecasts] = useState<WeatherForecast[]>([]);
  const [gasRecs,   setGasRecs]   = useState<GasRecord[]>([]);
  const [gasLatest, setGasLatest] = useState<GasRecord | null>(null);

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
      if (sigData.status   === "fulfilled") setSignals(sigData.value);
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

  const EMPTY_SIGNAL = {
    type: "", signal_type: "", title: "", triggered: false,
    severity: "low" as const, value: null, threshold: null,
    message: "Loading...", impact: "", time_horizon: "",
    confidence: null, computed_at: "",
  };

  return (
    <>
      <Navbar />
      <main className="pt-20 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-black text-white">Energy Risk Dashboard</h1>
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

          <div className="mb-6 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200/60 text-center">
            All data is for informational purposes only. Risk indicators are not investment, trading, or procurement advice.
          </div>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`card-glass border border-white/5 p-6 h-48 animate-pulse ${i === 5 ? "lg:col-span-2" : ""}`} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {signals && (
                <RiskScore
                  score={signals.risk_score}
                  activeSignals={signals.active_signals}
                  computedAt={signals.computed_at}
                  summary={signals.summary}
                  confidence={signals.confidence}
                  explanation={signals.explanation}
                  impact={signals.impact}
                  primaryDriver={signals.primary_driver}
                  riskDirection={signals.risk_direction}
                  secondaryFactors={signals.secondary_factors}
                  dataValid={signals.data_valid}
                  dataStatus={signals.data_status}
                />
              )}

              <ERCOTPriceMonitor prices={prices} />

              {signals && (
                <VolatilityAlert signal={signals.signals.price_volatility ?? EMPTY_SIGNAL} />
              )}

              {signals && (
                <WeatherRisk
                  forecasts={forecasts}
                  signal={signals.signals.weather_demand ?? EMPTY_SIGNAL}
                />
              )}

              {signals && (
                <GasSupply
                  records={gasRecs}
                  latest={gasLatest}
                  signal={signals.signals.gas_supply ?? EMPTY_SIGNAL}
                />
              )}

              <div className="card-glass border border-white/5 p-6 flex items-center justify-center text-center">
                <div>
                  <p className="text-sm font-semibold text-gray-400 mb-1">More signals coming soon</p>
                  <p className="text-xs text-gray-600">Grid frequency, renewable penetration, ancillary market data</p>
                </div>
              </div>

              {signals && (
                <AISummary
                  summary={signals.summary}
                  riskScore={signals.risk_score}
                  disclaimer={signals.disclaimer}
                  computedAt={signals.computed_at}
                />
              )}

            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
