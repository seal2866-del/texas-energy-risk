"use client";
/**
 * HistoricalAnalytics.tsx
 * Phase 8 — Historical pattern detection, anomaly scoring, spike precursor analysis.
 * Renders a three-panel widget: 30-day summary, anomaly z-score, and spike precursors.
 */
import { TrendingUp, Activity, AlertTriangle, BarChart2, Zap, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoricalAnalytics as HistoricalData } from "@/lib/api";

interface Props {
  data:      HistoricalData;
  loading?:  boolean;
}

function RiskBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function ZScoreGauge({ z }: { z: number | null }) {
  if (z === null) return <p className="text-xs text-gray-600">Insufficient data</p>;

  // Map z from -3..+3 to 0..100%
  const pct  = Math.min(100, Math.max(0, ((z + 3) / 6) * 100));
  const abs  = Math.abs(z);
  const color = abs >= 2 ? "#ef4444" : abs >= 1 ? "#f59e0b" : "#22c55e";

  return (
    <div className="space-y-1.5">
      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 w-px h-full bg-white/20" />
        {/* Danger zones */}
        <div className="absolute left-0 w-[16.7%] h-full bg-red-500/10" />
        <div className="absolute right-0 w-[16.7%] h-full bg-red-500/10" />
        {/* Marker */}
        <div
          className="absolute top-0 w-2 h-2 rounded-full -translate-x-1/2 transition-all duration-700"
          style={{ left: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-700">
        <span>−3σ</span><span>0</span><span>+3σ</span>
      </div>
    </div>
  );
}

export default function HistoricalAnalytics({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="card-glass border border-white/8 rounded-2xl p-6 flex items-center justify-center h-48">
        <Activity className="w-6 h-6 text-gray-500 animate-pulse" />
      </div>
    );
  }

  const { summary, anomaly, precursors } = data;

  const riskDist = summary.risk_distribution ?? { low: { count: 0, pct: 0 }, medium: { count: 0, pct: 0 }, high: { count: 0, pct: 0 } };

  const anomalyDir = anomaly.direction;
  const anomalyClass =
    anomalyDir === "significantly_elevated" ? "text-red-400 bg-red-500/10 border-red-500/25" :
    anomalyDir === "slightly_elevated"      ? "text-amber-400 bg-amber-500/10 border-amber-500/25" :
    anomalyDir === "below_normal"           ? "text-blue-400 bg-blue-500/10 border-blue-500/25" :
                                              "text-green-400 bg-green-500/10 border-green-500/25";

  return (
    <div className="space-y-4">

      {/* ── Row 1: 30-Day Summary + Anomaly ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 30-Day Risk Distribution */}
        <div className="card-glass border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-bold text-white">30-Day Risk Profile</span>
            {summary.data_available && (
              <span className="ml-auto text-xs text-gray-600">{summary.snapshot_count} readings</span>
            )}
          </div>

          {!summary.data_available ? (
            <p className="text-xs text-gray-600 py-4 text-center">No historical data available yet.</p>
          ) : (
            <div className="space-y-3">
              {/* Risk distribution bars */}
              {[
                { level: "High",   pct: riskDist.high.pct,   count: riskDist.high.count,   color: "#ef4444" },
                { level: "Medium", pct: riskDist.medium.pct, count: riskDist.medium.count, color: "#f59e0b" },
                { level: "Low",    pct: riskDist.low.pct,    count: riskDist.low.count,    color: "#22c55e" },
              ].map(({ level, pct, count, color }) => (
                <div key={level} className="flex items-center gap-3">
                  <span className="text-xs font-semibold w-12" style={{ color }}>{level}</span>
                  <RiskBar pct={pct} color={color} />
                  <span className="text-xs text-gray-500 w-16 text-right">{pct.toFixed(0)}% ({count})</span>
                </div>
              ))}

              {/* Key stats */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-t border-white/5 pt-3 mt-1">
                {summary.avg_price_mwh != null && (
                  <>
                    <span className="text-gray-500">Avg price</span>
                    <span className="text-gray-300 text-right font-mono">${summary.avg_price_mwh.toFixed(2)}/MWh</span>
                  </>
                )}
                {summary.peak_price_mwh != null && (
                  <>
                    <span className="text-gray-500">Peak price</span>
                    <span className="text-gray-300 text-right font-mono">${summary.peak_price_mwh.toFixed(2)}/MWh</span>
                  </>
                )}
                {summary.avg_confidence != null && (
                  <>
                    <span className="text-gray-500">Avg confidence</span>
                    <span className="text-gray-300 text-right">{summary.avg_confidence.toFixed(0)}%</span>
                  </>
                )}
                {summary.top_primary_driver && (
                  <>
                    <span className="text-gray-500">Top driver</span>
                    <span className="text-gray-300 text-right capitalize leading-snug">{summary.top_primary_driver}</span>
                  </>
                )}
              </div>

              {summary.first_snapshot && (
                <p className="text-xs text-gray-700">
                  Window: {new Date(summary.first_snapshot).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" – "}{summary.last_snapshot ? new Date(summary.last_snapshot).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "now"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Anomaly Score */}
        <div className="card-glass border border-white/8 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-bold text-white">Anomaly Detection</span>
            {anomaly.is_anomalous && (
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold border bg-red-500/15 border-red-500/30 text-red-400">
                ANOMALOUS
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Direction badge */}
            <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold", anomalyClass)}>
              <Activity className="w-3.5 h-3.5" />
              {anomalyDir.replace(/_/g, " ").toUpperCase()}
            </div>

            {/* Z-score gauge */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Z-score vs 30-day baseline</p>
              <ZScoreGauge z={anomaly.anomaly_score} />
              {anomaly.anomaly_score != null && (
                <p className="text-xs text-gray-400 mt-1.5 font-mono">
                  z = {anomaly.anomaly_score > 0 ? "+" : ""}{anomaly.anomaly_score.toFixed(2)}
                </p>
              )}
            </div>

            {/* Baseline stats */}
            {anomaly.baseline_avg != null && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t border-white/5 pt-3">
                <span className="text-gray-500">Baseline avg</span>
                <span className="text-gray-300 text-right font-mono">{anomaly.baseline_avg.toFixed(2)}</span>
                {anomaly.baseline_std != null && (
                  <>
                    <span className="text-gray-500">Baseline std</span>
                    <span className="text-gray-300 text-right font-mono">±{anomaly.baseline_std.toFixed(2)}</span>
                  </>
                )}
                {anomaly.sample_size != null && (
                  <>
                    <span className="text-gray-500">Sample size</span>
                    <span className="text-gray-300 text-right">{anomaly.sample_size} readings</span>
                  </>
                )}
              </div>
            )}

            <p className="text-xs text-gray-600 leading-relaxed">{anomaly.note}</p>
          </div>
        </div>
      </div>

      {/* ── Row 2: Spike Precursor Analysis ───────────────────────────────── */}
      <div className="card-glass border border-white/8 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">Spike Precursor Analysis</span>
          {precursors.data_available && precursors.spike_count > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold border bg-amber-500/10 border-amber-500/25 text-amber-400">
              {precursors.spike_count} {precursors.spike_count === 1 ? "event" : "events"}
            </span>
          )}
        </div>

        {!precursors.data_available || precursors.spike_count === 0 ? (
          <div className="py-4 text-center space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
              <Zap className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-sm font-semibold text-green-400">No spike events detected</p>
            <p className="text-xs text-gray-600">No high-risk escalation events in the 30-day window.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {precursors.note && (
              <p className="text-sm text-gray-300 leading-relaxed border-l-2 border-amber-500/40 pl-3">{precursors.note}</p>
            )}

            {precursors.precursor_pattern && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* Precursor fingerprint */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Pre-Spike Fingerprint</p>
                  <div className="space-y-1.5 text-xs">
                    {precursors.precursor_pattern.avg_pre_spike_risk_numeric != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Avg risk score</span>
                        <span className="text-gray-300 font-mono">{precursors.precursor_pattern.avg_pre_spike_risk_numeric.toFixed(1)}/10</span>
                      </div>
                    )}
                    {precursors.precursor_pattern.avg_pre_spike_price_mwh != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Avg price</span>
                        <span className="text-gray-300 font-mono">${precursors.precursor_pattern.avg_pre_spike_price_mwh.toFixed(2)}</span>
                      </div>
                    )}
                    {precursors.precursor_pattern.most_common_demand_level && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Demand level</span>
                        <span className="text-gray-300 capitalize">{precursors.precursor_pattern.most_common_demand_level}</span>
                      </div>
                    )}
                    {precursors.precursor_pattern.top_risk_direction && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Risk trend</span>
                        <span className="text-amber-300 capitalize">{precursors.precursor_pattern.top_risk_direction.replace(/_/g, " ")}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Top preceding driver */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Primary Precursor</p>
                  {precursors.precursor_pattern.top_preceding_driver ? (
                    <div className="px-3 py-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
                      <p className="text-sm font-semibold text-amber-300 capitalize leading-snug">
                        {precursors.precursor_pattern.top_preceding_driver.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Most common driver in 3h pre-spike window</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">Multiple drivers</p>
                  )}
                </div>

                {/* Driver frequency */}
                {Object.keys(precursors.precursor_pattern.driver_frequency).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Driver Frequency</p>
                    <div className="space-y-1.5">
                      {Object.entries(precursors.precursor_pattern.driver_frequency).map(([driver, count]) => (
                        <div key={driver} className="flex items-center gap-2 text-xs">
                          <span className="text-gray-400 capitalize flex-1 leading-snug">{driver.replace(/_/g, " ")}</span>
                          <span className="text-gray-500 font-mono flex-shrink-0">{count}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Spike timestamps */}
            {precursors.spike_timestamps.length > 0 && (
              <div className="border-t border-white/5 pt-3">
                <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Spike Events (UTC)
                </p>
                <div className="flex flex-wrap gap-2">
                  {precursors.spike_timestamps.map((ts, i) => (
                    <span key={i} className="px-2 py-1 rounded-lg bg-red-500/8 border border-red-500/15 text-xs text-red-400 font-mono">
                      {new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" "}
                      {new Date(ts).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit" })} CDT
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-700 leading-relaxed px-1">
        Historical analytics are based on 30-day rolling signal_snapshots data. Patterns are statistical and informational only —
        not predictive guarantees. Not investment, trading, or procurement advice.
      </p>
    </div>
  );
}
