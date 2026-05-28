"use client";
/**
 * /app/analytics/page.tsx
 * Phase 8 — Historical Analytics Page
 * 30-day pattern replay, anomaly detection, spike precursor analysis.
 */
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BarChart2, RefreshCw, MapPin, AlertTriangle } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import HistoricalAnalyticsWidget from "@/components/widgets/HistoricalAnalytics";
import { getHistoricalAnalytics, getSignals, type HistoricalAnalytics } from "@/lib/api";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const LOCATIONS = [
  "Houston", "Dallas", "Austin", "San Antonio",
  "Midland", "Odessa", "Corpus Christi", "Lubbock",
];

export default function AnalyticsPage() {
  const router   = useRouter();
  const [user,     setUser]     = useState<any>(null);
  const [location, setLocation] = useState("Houston");
  const [data,     setData]     = useState<HistoricalAnalytics | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [riskNum,  setRiskNum]  = useState(2.0);  // current risk numeric for anomaly z-score

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      setUser(data.user);
    });
  }, [router]);

  // Fetch current risk numeric for anomaly comparison
  const fetchRiskNumeric = useCallback(async (loc: string) => {
    try {
      const signals = await getSignals(loc);
      const numeric = (signals as any).risk_score_numeric ?? (
        signals.risk_score === "high" ? 8.5 :
        signals.risk_score === "medium" ? 5.0 : 2.0
      );
      setRiskNum(numeric);
    } catch { /* use default */ }
  }, []);

  const fetchData = useCallback(async (loc: string, rn: number) => {
    setLoading(true);
    setError(false);
    try {
      const result = await getHistoricalAnalytics(loc, rn);
      setData(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data when user or location changes
  useEffect(() => {
    if (user) {
      fetchRiskNumeric(location).then(() => fetchData(location, riskNum));
    }
  }, [user, location]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  return (
    <>
      <Navbar />
      <main className="pt-24 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Header */}
          <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="w-5 h-5 text-orange-400" />
                <h1 className="text-2xl font-black text-white">Historical Analytics</h1>
              </div>
              <p className="text-sm text-gray-500">
                30-day pattern replay · anomaly detection · spike precursor fingerprinting
              </p>
            </div>
            <button
              onClick={() => fetchData(location, riskNum)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-sm text-gray-300 transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Refresh
            </button>
          </div>

          {/* Location selector */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-3.5 h-3.5 text-gray-500" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Location</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {LOCATIONS.map(loc => (
                <button
                  key={loc}
                  onClick={() => setLocation(loc)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all",
                    location === loc
                      ? "bg-white/12 border-white/25 text-white"
                      : "border-white/8 text-gray-400 hover:border-white/15 hover:text-gray-300",
                  )}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-500/8 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">Unable to load analytics. The backend may be starting up.</p>
              <button
                onClick={() => fetchData(location, riskNum)}
                className="ml-auto text-xs text-red-400 hover:text-red-300 underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Analytics widget */}
          {(data || loading) && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-bold text-white">{location}</span>
                {data && (
                  <span className="text-xs text-gray-600">
                    · computed {new Date(data.computed_at).toLocaleTimeString("en-US", {
                      timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit",
                    })} CDT
                  </span>
                )}
              </div>

              {loading ? (
                <div className="card-glass border border-white/8 rounded-2xl p-12 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
                    <p className="text-xs text-gray-600">Loading 30-day analytics…</p>
                  </div>
                </div>
              ) : data ? (
                <HistoricalAnalyticsWidget data={data} />
              ) : null}
            </div>
          )}

          {/* About panel */}
          <div className="mt-10 card-glass border border-white/5 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-white">About these analytics</h2>
            <div className="space-y-2 text-xs text-gray-500 leading-relaxed">
              <p>
                <span className="text-gray-300 font-semibold">30-Day Risk Profile</span> — Distribution of Low / Medium / High risk readings, average ERCOT price, peak price, and the most-common primary driver over the rolling 30-day window.
              </p>
              <p>
                <span className="text-gray-300 font-semibold">Anomaly Detection</span> — Z-score of today&apos;s risk numeric vs the 30-day rolling baseline. A z-score above +2.0 or below −2.0 is statistically anomalous (needs ≥10 baseline readings).
              </p>
              <p>
                <span className="text-gray-300 font-semibold">Spike Precursor Analysis</span> — For every &quot;rising-edge&quot; high-risk event (Low/Medium → High) in the past 30 days, we examine the preceding 3 snapshots (~6h window) to extract a typical precursor fingerprint: dominant driver, demand level, and risk direction.
              </p>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
