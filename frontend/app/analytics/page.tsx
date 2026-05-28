"use client";
/**
 * /app/analytics/page.tsx
 * Phase 8 + 9 — Historical & Predictive Analytics
 */
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BarChart2, RefreshCw, MapPin, AlertTriangle, Brain, TrendingUp } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import HistoricalAnalyticsWidget from "@/components/widgets/HistoricalAnalytics";
import PredictiveOutlook from "@/components/widgets/PredictiveOutlook";
import RiskMomentumChart from "@/components/widgets/RiskMomentumChart";
import { getHistoricalAnalytics, getSignals, getSignalHistory, type HistoricalAnalytics, type SignalSnapshot } from "@/lib/api";
import { analyseStateTransitions } from "@/lib/stateTransitionEngine";
import { matchPatterns, predictedDirectionLabel, similarityColor } from "@/lib/patternMemory";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const LOCATIONS = [
  "Houston", "Dallas", "Austin", "San Antonio",
  "Midland", "Odessa", "Corpus Christi", "Lubbock",
];

const TAB_LABELS = [
  { id: "predictive",   label: "Predictive",  icon: Brain },
  { id: "historical",   label: "Historical",  icon: BarChart2 },
  { id: "transitions",  label: "Transitions", icon: TrendingUp },
  { id: "patterns",     label: "Patterns",    icon: RefreshCw },
] as const;
type TabId = typeof TAB_LABELS[number]["id"];

// ── State Transition Frequency Panel ─────────────────────────────────────────
function TransitionsPanel({ snapshots }: { snapshots: SignalSnapshot[] }) {
  const analysis = analyseStateTransitions(snapshots);
  if (!analysis) {
    return <div className="text-xs text-gray-600 text-center py-10">Need ≥3 snapshots.</div>;
  }
  const { pattern, currentState, currentDurationHours, transitionStrength, instabilityScore, dominantState, avgEscalationHours, explanation, recentTransitions } = analysis;

  const scoreColor = instabilityScore >= 60 ? "#ef4444" : instabilityScore >= 30 ? "#f59e0b" : "#22c55e";
  const stateColors: Record<string, string> = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444", unknown: "#6b7280" };

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Instability",   value: `${instabilityScore}/100`,     color: scoreColor },
          { label: "Current State", value: currentState.toUpperCase(),     color: stateColors[currentState] ?? "#6b7280" },
          { label: "In State",      value: `${currentDurationHours}h`,     color: "#60a5fa" },
          { label: "Dominant",      value: dominantState.toUpperCase(),    color: stateColors[dominantState] ?? "#6b7280" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card-glass border border-white/5 rounded-xl px-4 py-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{label}</div>
            <div className="text-sm font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Pattern counts */}
      <div className="card-glass border border-white/5 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-3">Transition Pattern</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {[
            { label: "Escalations",  value: pattern.escalationCount,  color: "#ef4444" },
            { label: "Recoveries",   value: pattern.recoveryCount,    color: "#22c55e" },
            { label: "Lateral",      value: pattern.lateralCount,     color: "#6b7280" },
            { label: "Loops",        value: pattern.loopCount,        color: "#f97316" },
            { label: "Failed Recov", value: pattern.failedRecoveries, color: "#a78bfa" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className="text-lg font-black" style={{ color }}>{value}</div>
              <div className="text-[10px] text-gray-600 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        {avgEscalationHours !== null && (
          <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-500">
            Avg hours before escalation: <span className="text-white font-semibold">{avgEscalationHours}h</span>
            &ensp;·&ensp;Transition strength: <span className="text-white font-semibold">{transitionStrength}</span>
          </div>
        )}
      </div>

      {/* Recent transitions */}
      {recentTransitions.length > 0 && (
        <div className="card-glass border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-3">Recent Transitions</h3>
          <div className="space-y-1.5">
            {recentTransitions.slice().reverse().map((t, i) => {
              const dirColor = t.direction === "escalation" ? "#ef4444" : t.direction === "recovery" ? "#22c55e" : "#6b7280";
              const dirIcon  = t.direction === "escalation" ? "↑" : t.direction === "recovery" ? "↓" : "→";
              return (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="text-[10px] text-gray-600 w-32 flex-shrink-0">
                    {new Date(t.at).toLocaleString("en-US", { timeZone: "America/Chicago", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} CDT
                  </span>
                  <span className="font-semibold" style={{ color: stateColors[t.from] ?? "#6b7280" }}>{t.from}</span>
                  <span style={{ color: dirColor }}>{dirIcon}</span>
                  <span className="font-semibold" style={{ color: stateColors[t.to] ?? "#6b7280" }}>{t.to}</span>
                  <span className="text-[10px] text-gray-600 ml-auto capitalize">{t.direction}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-4 py-3 rounded-xl bg-white/3 border border-white/5">
        <p className="text-xs text-gray-500 leading-relaxed">{explanation}</p>
      </div>
    </div>
  );
}

// ── Pattern Match Explorer ────────────────────────────────────────────────────
function PatternsPanel({ snapshots }: { snapshots: SignalSnapshot[] }) {
  const result = matchPatterns(snapshots, 6, 5);
  if (!result) {
    return <div className="text-xs text-gray-600 text-center py-10">Need ≥10 snapshots for pattern matching.</div>;
  }
  const { matches, predictedDirection, patternConfidence, explanation, currentFingerprint } = result;
  const dirLabel = predictedDirectionLabel(predictedDirection);
  const dirColors: Record<string, string> = {
    "Likely Higher": "#ef4444", "Likely Lower": "#22c55e",
    "Likely Stable": "#60a5fa", "Insufficient Data": "#6b7280",
  };
  const dirColor = dirColors[dirLabel] ?? "#6b7280";

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-glass border border-white/5 rounded-xl px-4 py-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Predicted Direction</div>
          <div className="text-sm font-bold" style={{ color: dirColor }}>{dirLabel}</div>
        </div>
        <div className="card-glass border border-white/5 rounded-xl px-4 py-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Pattern Confidence</div>
          <div className="text-sm font-bold text-white">{patternConfidence}%</div>
        </div>
        <div className="card-glass border border-white/5 rounded-xl px-4 py-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Current Risk</div>
          <div className="text-sm font-bold text-white">{currentFingerprint.riskNumeric.toFixed(1)}/10</div>
        </div>
      </div>

      {/* Matches */}
      {matches.length > 0 && (
        <div className="card-glass border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-3">Top Historical Matches</h3>
          <div className="space-y-2">
            {matches.map((m, i) => {
              const simColor = similarityColor(m.similarity);
              const outcomeColor = m.outcome === "high" ? "#ef4444" : m.outcome === "medium" ? "#f59e0b" : "#22c55e";
              return (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className="text-[10px] text-gray-600 w-28 flex-shrink-0">
                    {new Date(m.matchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="h-1 bg-white/10 rounded-full flex-1 max-w-24 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${m.similarity}%`, backgroundColor: simColor }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: simColor }}>{m.similarity}%</span>
                      <span className="text-[10px] text-gray-500">match</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 flex-shrink-0">
                    → <span className="font-semibold" style={{ color: outcomeColor }}>{m.outcome}</span> after {m.hoursLater}h
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-4 py-3 rounded-xl bg-white/3 border border-white/5">
        <p className="text-xs text-gray-500 leading-relaxed">{explanation}</p>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const router   = useRouter();
  const [user,      setUser]      = useState<any>(null);
  const [location,  setLocation]  = useState("Houston");
  const [data,      setData]      = useState<HistoricalAnalytics | null>(null);
  const [snapshots, setSnapshots] = useState<SignalSnapshot[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const [riskNum,   setRiskNum]   = useState(2.0);
  const [tab,       setTab]       = useState<TabId>("predictive");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      setUser(data.user);
    });
  }, [router]);

  const fetchAll = useCallback(async (loc: string) => {
    setLoading(true);
    setError(false);
    try {
      const [signals, history, analytics] = await Promise.all([
        getSignals(loc),
        getSignalHistory(loc, 168),
        getHistoricalAnalytics(loc, riskNum),
      ]);
      const numeric = (signals as any).risk_score_numeric ?? (
        signals.risk_score === "high" ? 8.5 : signals.risk_score === "medium" ? 5.0 : 2.0
      );
      setRiskNum(numeric);
      setSnapshots(history.snapshots ?? []);
      setData(analytics);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [riskNum]);

  useEffect(() => { if (user) fetchAll(location); }, [user, location]); // eslint-disable-line

  if (!user) return null;

  return (
    <>
      <Navbar />
      <main className="pt-24 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Header */}
          <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="w-5 h-5 text-orange-400" />
                <h1 className="text-2xl font-black text-white">Analytics</h1>
              </div>
              <p className="text-sm text-gray-500">Predictive intelligence · historical patterns · state transitions</p>
            </div>
            <button
              onClick={() => fetchAll(location)} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-sm text-gray-300 transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Refresh
            </button>
          </div>

          {/* Location selector */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-3.5 h-3.5 text-gray-500" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Location</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {LOCATIONS.map(loc => (
                <button key={loc} onClick={() => setLocation(loc)}
                  className={cn("px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all",
                    location === loc ? "bg-white/12 border-white/25 text-white" : "border-white/8 text-gray-400 hover:border-white/15 hover:text-gray-300"
                  )}
                >{loc}</button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-white/3 rounded-xl p-1 border border-white/5 w-fit">
            {TAB_LABELS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                  tab === id ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                )}
              >
                <Icon className="w-3 h-3" />{label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-center gap-3 p-4 rounded-xl bg-red-500/8 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">Unable to load analytics. Backend may be starting up.</p>
              <button onClick={() => fetchAll(location)} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">Retry</button>
            </div>
          )}

          {loading ? (
            <div className="card-glass border border-white/8 rounded-2xl p-12 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
                <p className="text-xs text-gray-600">Loading analytics…</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Momentum chart — always shown */}
              <RiskMomentumChart snapshots={snapshots} windowSize={48} />

              {tab === "predictive" && <PredictiveOutlook snapshots={snapshots} />}
              {tab === "historical" && data && <HistoricalAnalyticsWidget data={data} />}
              {tab === "transitions" && <TransitionsPanel snapshots={snapshots} />}
              {tab === "patterns"    && <PatternsPanel    snapshots={snapshots} />}
            </div>
          )}

          {/* About */}
          <div className="mt-10 card-glass border border-white/5 rounded-2xl p-5 space-y-2">
            <h2 className="text-sm font-bold text-white">About these analytics</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="text-gray-300 font-semibold">Predictive Outlook</span> — OLS-slope trajectory, state-transition instability, and historical pattern matching combine to produce 0–6h, 6–24h, and 24–48h risk forecasts.
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="text-gray-300 font-semibold">Transitions</span> — Tracks every risk-state change (Low↔Medium↔High), detects escalation loops, failed recoveries, and computes an instability score.
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="text-gray-300 font-semibold">Pattern Memory</span> — Fingerprints current conditions (risk level, ERCOT price, demand, driver) against all historical snapshots to find close matches and surface what happened next.
            </p>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
