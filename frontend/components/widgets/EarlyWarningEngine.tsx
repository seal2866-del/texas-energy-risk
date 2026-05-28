"use client";
import { AlertTriangle, Eye, TrendingUp, TrendingDown, Minus,
         Thermometer, Flame, Zap, Wind, Radio } from "lucide-react";
import type { EarlyWarnings, RiskTrend, WeatherPersistence } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  earlyWarnings?:      EarlyWarnings;
  riskTrend?:          RiskTrend;
  weatherPersistence?: WeatherPersistence;
}

// ── Severity config ───────────────────────────────────────────────────────────
const SEV_CFG = {
  alert:   { cls: "text-red-400",    bg: "bg-red-500/8    border-red-500/20",    dot: "bg-red-400",    label: "Alert"   },
  caution: { cls: "text-amber-400",  bg: "bg-amber-500/8  border-amber-500/20",  dot: "bg-amber-400",  label: "Caution" },
  watch:   { cls: "text-blue-400",   bg: "bg-blue-500/8   border-blue-500/20",   dot: "bg-blue-400",   label: "Watch"   },
  none:    { cls: "text-green-400",  bg: "bg-green-500/8  border-green-500/20",  dot: "bg-green-500",  label: "Clear"   },
} as const;

// ── Trajectory config ─────────────────────────────────────────────────────────
const TRAJ_CFG = {
  accelerating:  { icon: TrendingUp,   cls: "text-red-400",    label: "Accelerating"  },
  deteriorating: { icon: TrendingUp,   cls: "text-red-400",    label: "Deteriorated"  },
  tightening:    { icon: TrendingUp,   cls: "text-amber-400",  label: "Tightening"    },
  stable:        { icon: Minus,        cls: "text-gray-500",   label: "Stable"        },
  improving:     { icon: TrendingDown, cls: "text-green-400",  label: "Improving"     },
} as const;

// ── Persistence risk config ───────────────────────────────────────────────────
const PERSIST_CFG = {
  high:     { cls: "text-red-400",    bg: "bg-red-500/8   border-red-500/20"    },
  elevated: { cls: "text-amber-400",  bg: "bg-amber-500/8 border-amber-500/20"  },
  moderate: { cls: "text-blue-400",   bg: "bg-blue-500/8  border-blue-500/20"   },
  low:      { cls: "text-gray-500",   bg: "bg-white/4     border-white/8"       },
} as const;

// ── Warning pill ──────────────────────────────────────────────────────────────
function WarningItem({ text, idx }: { text: string; idx: number }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-amber-400/60 text-xs font-black mt-0.5 flex-shrink-0 tabular-nums">
        {String(idx + 1).padStart(2, "0")}
      </span>
      <p className="text-sm text-gray-300 leading-relaxed max-w-[68ch]">{text}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EarlyWarningEngine({ earlyWarnings, riskTrend, weatherPersistence }: Props) {
  if (!earlyWarnings && !riskTrend && !weatherPersistence) return null;

  const sev     = earlyWarnings?.highest_severity ?? "none";
  const sevCfg  = SEV_CFG[sev] ?? SEV_CFG.none;
  const count   = earlyWarnings?.warning_count ?? 0;
  const warnings = earlyWarnings?.warnings ?? [];

  const traj    = riskTrend?.trajectory ?? "stable";
  const trajCfg = TRAJ_CFG[traj] ?? TRAJ_CFG.stable;
  const TrajIcon = trajCfg.icon;

  const persist    = weatherPersistence?.persistence_risk ?? "low";
  const persistCfg = PERSIST_CFG[persist] ?? PERSIST_CFG.low;
  const heatDays   = weatherPersistence?.consecutive_high_days ?? 0;
  const coolWeak   = weatherPersistence?.overnight_cooling_weak ?? false;

  // Don't render when everything is nominal and no warnings
  if (count === 0 && traj === "stable" && persist === "low") return null;

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border",
            sev === "none" ? "bg-white/5 border-white/10" : sevCfg.bg,
          )}>
            <Eye className={cn("w-4 h-4", sev === "none" ? "text-gray-500" : sevCfg.cls)} />
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">Early Warning Engine</h2>
            <p className="text-[10px] text-gray-600 mt-0.5 font-medium uppercase tracking-wide">
              Pre-Escalation Pattern Detection
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Trajectory badge */}
          <span className={cn(
            "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border",
            traj === "stable" ? "bg-white/5 border-white/10 text-gray-500"
            : traj === "improving" ? "bg-green-500/8 border-green-500/20 text-green-400"
            : traj === "tightening" ? "bg-amber-500/8 border-amber-500/20 text-amber-400"
            : "bg-red-500/8 border-red-500/20 text-red-400",
          )}>
            <TrajIcon className="w-3 h-3" />
            {trajCfg.label}
          </span>
          {/* Warning count badge */}
          {count > 0 && (
            <span className={cn(
              "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border",
              sevCfg.bg, sevCfg.cls,
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", sevCfg.dot)} />
              {count} {count === 1 ? "Signal" : "Signals"}
            </span>
          )}
        </div>
      </div>

      {/* ── Trend + persistence strip ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        {/* Risk trajectory */}
        <div className="px-3 py-2.5 rounded-lg bg-white/3 border border-white/6">
          <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Risk Trajectory</p>
          <div className="flex items-center gap-1.5">
            <TrajIcon className={cn("w-3.5 h-3.5", trajCfg.cls)} />
            <span className={cn("text-sm font-bold", trajCfg.cls)}>{riskTrend?.label ?? "Stable"}</span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1 leading-snug max-w-[28ch]">
            {riskTrend?.description?.slice(0, 80).concat("…") ?? "Holding at current levels."}
          </p>
        </div>

        {/* Weather persistence */}
        <div className={cn("px-3 py-2.5 rounded-lg border", persistCfg.bg)}>
          <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Heat Persistence</p>
          <div className="flex items-center gap-1.5">
            <Thermometer className={cn("w-3.5 h-3.5", persistCfg.cls)} />
            <span className={cn("text-sm font-bold capitalize", persistCfg.cls)}>
              {persist.charAt(0).toUpperCase() + persist.slice(1)}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            {heatDays > 0 ? `${heatDays} high-temp interval${heatDays > 1 ? "s" : ""}` : "No sustained heat"}
            {coolWeak ? " · weak overnight cooling" : ""}
          </p>
        </div>

        {/* Pattern severity */}
        <div className={cn("px-3 py-2.5 rounded-lg border", sev === "none" ? "bg-green-500/5 border-green-500/15" : sevCfg.bg)}>
          <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Pattern Severity</p>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className={cn("w-3.5 h-3.5", sevCfg.cls)} />
            <span className={cn("text-sm font-bold", sevCfg.cls)}>{sevCfg.label}</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            {count > 0 ? `${count} pre-escalation pattern${count > 1 ? "s" : ""} detected` : "No active patterns"}
          </p>
        </div>
      </div>

      {/* ── Warning list ──────────────────────────────────────────────────────── */}
      {warnings.length > 0 ? (
        <div>
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">
            Detected Patterns
          </p>
          {warnings.map((w, i) => (
            <WarningItem key={i} text={w} idx={i} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
          <p className="text-xs text-gray-600">
            No pre-escalation patterns detected in current monitoring interval.
          </p>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-gray-700">
        <Radio className="w-3 h-3 text-teal-500/40" />
        <span className="uppercase tracking-wide font-semibold">
          Predictive pattern analysis · Informational only · Not a market forecast
        </span>
      </div>
    </div>
  );
}
