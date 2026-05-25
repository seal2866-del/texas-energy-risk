"use client";
import { Activity, WifiOff, TrendingUp, TrendingDown, Minus, Zap, Info } from "lucide-react";
import type { RiskScore as RiskScoreType, TimeHorizons, SignalDriver } from "@/lib/api";
import { cn, riskColor, riskBg } from "@/lib/utils";

interface Props {
  score:                   RiskScoreType;
  activeSignals:           number;
  computedAt:              string;
  summary:                 string;
  confidence?:             number | null;
  confidenceNote?:         string;
  explanation?:            string;
  impact?:                 string;
  primaryDriver?:          string;
  riskDirection?:          "increasing" | "stable" | "decreasing";
  riskDirectionContext?:   string;
  signalDrivers?:          SignalDriver[];
  secondaryFactors?:       string[];
  dataValid?:              boolean;
  dataStatus?:             string;
  riskHeadline?:           string;
  timeHorizons?:           TimeHorizons;
}

const SCORE_CONFIG = {
  low:    { label: "LOW RISK",    icon: "\u{1F7E2}", ring: "ring-green-500/40",  bar: "bg-green-500" },
  medium: { label: "MEDIUM RISK", icon: "\u{1F7E1}", ring: "ring-amber-500/40",  bar: "bg-amber-500" },
  high:   { label: "HIGH RISK",   icon: "\u{1F534}", ring: "ring-red-500/40",    bar: "bg-red-500"   },
};

const CONFIDENCE_COLOR = (c: number) =>
  c >= 75 ? "text-green-400" : c >= 55 ? "text-amber-400" : "text-gray-500";

function dataStatusLabel(status: string): string {
  if (status === "mock_only") return "Real-time feed initializing -- mock data excluded";
  if (status.startsWith("building_cache_")) {
    const parts = status.split("_");
    return `Building cache: ${parts[2] ?? "0"}/${parts[4] ?? "2"} verified readings received`;
  }
  if (status.startsWith("stale_")) return "Data feed interrupted -- waiting for fresh reading";
  if (status === "no_data")        return "No price data received yet";
  return "Live data unavailable";
}

function DirectionBadge({ direction, context }: { direction: "increasing" | "stable" | "decreasing"; context?: string }) {
  const configs = {
    increasing: { icon: <TrendingUp   className="w-3.5 h-3.5" />, label: "Increasing", cls: "text-red-400 bg-red-500/10 border-red-500/20" },
    stable:     { icon: <Minus        className="w-3.5 h-3.5" />, label: "Stable",     cls: "text-gray-400 bg-white/5 border-white/10" },
    decreasing: { icon: <TrendingDown className="w-3.5 h-3.5" />, label: "Decreasing", cls: "text-green-400 bg-green-500/10 border-green-500/20" },
  };
  const cfg = configs[direction];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border", cfg.cls)}>
      {cfg.icon}
      {cfg.label}
      {context && <span className="font-normal opacity-75">({context})</span>}
    </span>
  );
}

export default function RiskScore({
  score, activeSignals, computedAt, summary,
  confidence, confidenceNote, explanation, impact,
  primaryDriver, riskDirection, riskDirectionContext, signalDrivers,
  secondaryFactors, dataValid, dataStatus, riskHeadline, timeHorizons,
}: Props) {
  const cfg = SCORE_CONFIG[score];

  if (dataValid === false) {
    return (
      <div className="card-glass p-6 border border-white/5">
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Texas Energy Risk Score</p>
          <Activity className="w-5 h-5 text-gray-600" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center ring-4 ring-gray-700/40 bg-white/5">
            <WifiOff className="w-6 h-6 text-gray-500" />
          </div>
          <div>
            <p className="text-lg font-black text-gray-400 tracking-tight">MONITORING PAUSED</p>
            <p className="text-xs text-gray-600 mt-0.5">Live data unavailable</p>
          </div>
        </div>
        <div className="mt-4 px-3 py-2.5 rounded-lg bg-white/5 border border-white/8 text-xs text-gray-500 leading-relaxed">
          {dataStatus ? dataStatusLabel(dataStatus) : "Signals will resume automatically once real-time data is confirmed."}
        </div>
        <p className="mt-3 text-xs text-gray-600">
          Last checked {new Date(computedAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", timeZoneName: "short" })}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("card-glass p-6 border", riskBg(score))}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Texas Energy Risk Score</p>
          <div className="flex items-center gap-3 mt-2">
            <div className={cn("w-14 h-14 rounded-full flex items-center justify-center ring-4", cfg.ring, score === "high" ? "alert-pulse" : "")}>
              <span className="text-2xl">{cfg.icon}</span>
            </div>
            <div>
              <p className={cn("text-3xl font-black tracking-tight", riskColor(score))}>{cfg.label}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-xs text-gray-500">{activeSignals} active risk driver{activeSignals !== 1 ? "s" : ""}</p>
                {confidence != null && (
                  <>
                    <span className="text-gray-700">·</span>
                    <p className={cn("text-xs font-semibold", CONFIDENCE_COLOR(confidence))}>Confidence: {confidence}%</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <Activity className="w-5 h-5 text-gray-600" />
      </div>

      {/* Risk headline */}
      {riskHeadline && (
        <p className={cn("mt-3 text-sm font-bold", riskColor(score))}>{riskHeadline}</p>
      )}

      {/* Task 3 -- Signal intensity (human-readable) */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>
            {activeSignals === 0
              ? "No risk drivers active"
              : activeSignals === 1
                ? "1 of 3 risk drivers active"
                : `${activeSignals} of 3 risk drivers active`}
          </span>
          <span className={cn(
            "font-semibold",
            activeSignals === 3 ? "text-red-400"
            : activeSignals === 2 ? "text-amber-400"
            : activeSignals === 1 ? "text-amber-300"
            : "text-gray-500"
          )}>
            {activeSignals === 0 ? "Low" : activeSignals === 1 ? "Moderate" : activeSignals === 2 ? "Elevated" : "High"} signal strength
          </span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-700", cfg.bar)} style={{ width: `${(activeSignals / 3) * 100}%` }} />
        </div>
        {/* Named drivers */}
        {signalDrivers && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {signalDrivers.map((d) => {
              const activeCls =
                d.severity === "high"   ? "bg-red-500/10 border-red-500/25 text-red-300" :
                d.severity === "medium" ? "bg-amber-500/10 border-amber-500/25 text-amber-300" :
                                          "bg-green-500/10 border-green-500/25 text-green-300";
              const cls = d.active ? activeCls : "bg-white/5 border-white/8 text-gray-600";
              return (
                <span key={d.type} className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border", cls)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", d.active ? "bg-current" : "bg-gray-700")} />
                  {d.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {primaryDriver && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primary Driver</span>
          <span className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border",
            score === "high"   ? "bg-red-500/10 border-red-500/20 text-red-300" :
            score === "medium" ? "bg-amber-500/10 border-amber-500/20 text-amber-300" :
                                 "bg-white/5 border-white/10 text-gray-400"
          )}>
            <Zap className="w-3 h-3" />{primaryDriver}
          </span>
        </div>
      )}

      {/* Task 5 -- Risk direction with context */}
      {riskDirection && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Risk Direction</span>
          <DirectionBadge direction={riskDirection} context={riskDirectionContext} />
        </div>
      )}

      {explanation && (
        <p className="mt-4 text-sm text-gray-200 leading-relaxed font-medium">{explanation}</p>
      )}

      {impact && (
        <div className={cn(
          "mt-3 px-3 py-2 rounded-lg border text-xs leading-relaxed",
          score === "high"   ? "bg-red-500/10 border-red-500/20 text-red-300" :
          score === "medium" ? "bg-amber-500/10 border-amber-500/20 text-amber-300" :
                               "bg-white/5 border-white/8 text-gray-400"
        )}>
          <span className="font-semibold uppercase tracking-wide mr-1.5">
            {score === "high" ? "Why this matters:" : score === "medium" ? "Why this matters:" : "Status:"}
          </span>
          {impact}
        </div>
      )}

      {secondaryFactors && secondaryFactors.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Secondary Factors</p>
          <div className="flex flex-wrap gap-1.5">
            {secondaryFactors.map((f, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-xs text-gray-500">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Phase 3 -- Confidence note */}
      {confidenceNote && confidence != null && (
        <div className="mt-3 flex items-start gap-1.5">
          <Info className="w-3 h-3 text-gray-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-600 leading-relaxed">{confidenceNote}</p>
        </div>
      )}

      {/* Phase 1 -- Time horizons */}
      {timeHorizons && (
        <div className="mt-4 space-y-1 border-t border-white/5 pt-3">
          {[timeHorizons.short_term, timeHorizons.near_term, timeHorizons.outlook].map((line, i) => (
            <p key={i} className={cn(
              "text-xs font-mono leading-relaxed",
              i === 0 ? "text-gray-400" : i === 1 ? "text-gray-500" : "text-gray-600"
            )}>{line}</p>
          ))}
        </div>
      )}

      {!explanation && !riskHeadline && (
        <p className="mt-4 text-sm text-gray-300 leading-relaxed line-clamp-3">{summary}</p>
      )}

      <p className="mt-3 text-xs text-gray-600">
        Updated {new Date(computedAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", timeZoneName: "short" })}
      </p>
    </div>
  );
}
