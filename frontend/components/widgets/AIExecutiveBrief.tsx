"use client";
import { Brain, FileText, Clock, Zap, Thermometer, Flame, TrendingUp, TrendingDown,
         ShieldCheck, AlertTriangle, Activity, Radio, ChevronRight, Minus } from "lucide-react";
import type { SignalsResponse, AIReasoningResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  signals:    SignalsResponse;
  reasoning:  AIReasoningResponse | null;
  aiLoading:  boolean;
  computedAt: string;
  location?:  string;
}

// ── Risk colour helpers ───────────────────────────────────────────────────────
const RISK_CLS: Record<string, string> = {
  low:    "text-green-400",
  medium: "text-amber-400",
  high:   "text-red-400",
};
const RISK_BG: Record<string, string> = {
  low:    "bg-green-500/8  border-green-500/20",
  medium: "bg-amber-500/8  border-amber-500/20",
  high:   "bg-red-500/8    border-red-500/20",
};
const ESC_CLS: Record<string, string> = {
  "Low":          "text-gray-400  bg-white/5       border-white/10",
  "Low-Moderate": "text-blue-400  bg-blue-500/8    border-blue-500/20",
  "Moderate":     "text-amber-400 bg-amber-500/8   border-amber-500/20",
  "Elevated":     "text-red-400   bg-red-500/8     border-red-500/20",
};
const DIR_ICON: Record<string, React.ReactNode> = {
  increasing: <TrendingUp   className="w-3 h-3 text-red-400"   />,
  stable:     <Minus        className="w-3 h-3 text-gray-500"  />,
  decreasing: <TrendingDown className="w-3 h-3 text-green-400" />,
};

// ── Brief section row ─────────────────────────────────────────────────────────
function BriefRow({
  icon, label, value, sub, accent = "teal",
}: {
  icon:    React.ReactNode;
  label:   string;
  value:   string;
  sub?:    string;
  accent?: string;
}) {
  const accentCls =
    accent === "red"    ? "text-red-400/70"
    : accent === "amber" ? "text-amber-400/70"
    : accent === "green" ? "text-green-400/70"
    : accent === "orange"? "text-orange-400/70"
    : "text-teal-400/70";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <span className={cn("mt-0.5 flex-shrink-0", accentCls)}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-sm text-gray-200 leading-snug max-w-[70ch]">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5 max-w-[60ch]">{sub}</p>}
      </div>
    </div>
  );
}

// ── Metric chip ───────────────────────────────────────────────────────────────
function MetricChip({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className={cn("px-3 py-2 rounded-lg border text-center", cls ?? "bg-white/4 border-white/8")}>
      <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm font-bold text-gray-200 tabular-nums leading-tight">{value}</p>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function BriefSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-11 bg-white/4 rounded-lg" />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AIExecutiveBrief({ signals, reasoning, aiLoading, computedAt, location = "Texas" }: Props) {
  const {
    risk_score,
    risk_direction,
    risk_headline,
    demand_pressure,
    supply_pressure,
    market_reaction,
    gas_to_power_impact,
    escalation_probability,
    market_sensitivity,
    market_condition,
    confidence,
    data_sources,
    primary_driver,
  } = signals;

  const briefTime = computedAt
    ? new Date(computedAt).toLocaleString("en-US", {
        timeZone:   "America/Chicago",
        month:      "short",
        day:        "numeric",
        hour:       "2-digit",
        minute:     "2-digit",
        timeZoneName: "short",
      })
    : "—";

  const riskCls = RISK_CLS[risk_score] ?? "text-gray-400";
  const riskBg  = RISK_BG[risk_score]  ?? "bg-white/4 border-white/8";
  const escLvl  = escalation_probability?.level ?? "Low";
  const escCls  = ESC_CLS[escLvl]      ?? ESC_CLS["Low"];
  const dirIcon = DIR_ICON[risk_direction] ?? DIR_ICON.stable;

  // ── Derive brief sentences from available data ────────────────────────────
  const ercotLine = (() => {
    const mc  = market_condition?.label ?? "Stable";
    const rxn = market_reaction?.level  ?? "low";
    if (rxn === "high")   return `ERCOT market in ${mc} state. Price reaction elevated — volatility indicators active.`;
    if (rxn === "medium") return `ERCOT market in ${mc} state. Moderate price movement detected; conditions warrant monitoring.`;
    return `ERCOT market in ${mc} state. Pricing stable within normal operating band.`;
  })();

  const demandLine = (() => {
    const lvl  = demand_pressure?.level ?? "low";
    const expl = demand_pressure?.explanation ?? "";
    if (lvl === "high")   return `Weather-driven demand pressure is elevated. ${expl}`;
    if (lvl === "medium") return `Moderate demand pressure from weather conditions. ${expl}`;
    return `Demand pressure nominal. Weather-driven load within expected range.`;
  })();

  const gasLine = (() => {
    const lvl  = supply_pressure?.level ?? "low";
    const gtp  = gas_to_power_impact;
    if (lvl === "high")   return `Gas supply under stress. ${gtp?.explanation ?? "Elevated gas-to-power sensitivity detected."}`;
    if (lvl === "medium") return `Gas supply tightening. ${gtp?.explanation ?? "Moderate gas-to-power exposure."}`;
    return `Gas supply adequate. Henry Hub pricing and storage levels within normal range.`;
  })();

  const escLine = (() => {
    const pct = escalation_probability?.pct ?? 0;
    const rat = escalation_probability?.rationale ?? "";
    if (escLvl === "Elevated")     return `Escalation probability ${pct}%. ${rat}`;
    if (escLvl === "Moderate")     return `Escalation probability ${pct}%. ${rat}`;
    if (escLvl === "Low-Moderate") return `Escalation probability ${pct}%. ${rat}`;
    return `Escalation probability low (${pct}%). No material convergence of risk catalysts identified.`;
  })();

  const outlookLine = reasoning?.escalation_watch
    ?? signals.time_horizons?.outlook
    ?? "Forward operational outlook requires active monitoring given current signal state.";

  const infraLine = (() => {
    const ercotOk = data_sources?.ercot?.status === "active";
    const noaaOk  = data_sources?.noaa?.status  === "active";
    const eiaOk   = data_sources?.eia?.status   === "active";
    const allOk   = ercotOk && noaaOk && eiaOk;
    const cnt     = [ercotOk, noaaOk, eiaOk].filter(Boolean).length;
    if (allOk) return "All telemetry feeds confirmed active. ERCOT, NOAA, and EIA data streams nominal.";
    if (cnt >= 2) return `${cnt}/3 data feeds live. One source degraded — analysis confidence adjusted accordingly.`;
    return "Multiple data feeds degraded. Operating on partial telemetry — confidence reduced. Manual verification advised.";
  })();

  const infraAccent = (() => {
    const cnt = [
      data_sources?.ercot?.status === "active",
      data_sources?.noaa?.status  === "active",
      data_sources?.eia?.status   === "active",
    ].filter(Boolean).length;
    return cnt === 3 ? "green" : cnt >= 2 ? "amber" : "red";
  })();

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">AI Executive Brief</h2>
            <p className="text-[10px] text-gray-600 mt-0.5 font-medium uppercase tracking-wide">
              Daily Operational Intelligence · {location}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="flex items-center gap-1 text-[10px] text-gray-600 uppercase tracking-wide">
            <Clock className="w-3 h-3" />
            {briefTime}
          </span>
          <span className={cn("flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border", riskBg, riskCls)}>
            {dirIcon}
            {risk_score.toUpperCase()} RISK
          </span>
        </div>
      </div>

      {/* ── Top metrics strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <MetricChip
          label="Risk Level"
          value={risk_score.charAt(0).toUpperCase() + risk_score.slice(1)}
          cls={cn("border", riskBg, riskCls)}
        />
        <MetricChip
          label="Escalation"
          value={`${escLvl} · ${escalation_probability?.pct ?? 0}%`}
          cls={cn("border", escCls)}
        />
        <MetricChip
          label="Market State"
          value={market_condition?.label ?? "Stable"}
          cls="bg-white/4 border-white/8 text-gray-200"
        />
        <MetricChip
          label="Confidence"
          value={confidence != null ? `${confidence}%` : "—"}
          cls={cn(
            "border",
            confidence != null && confidence >= 75 ? "bg-green-500/8 border-green-500/20 text-green-400"
            : confidence != null && confidence >= 60 ? "bg-amber-500/8 border-amber-500/20 text-amber-400"
            : "bg-white/4 border-white/8 text-gray-400"
          )}
        />
      </div>

      {/* ── Executive summary from AI ─────────────────────────────────────── */}
      {(reasoning?.executive_summary || risk_headline) && (
        <div className="relative mb-4 px-4 py-3 rounded-xl bg-teal-500/5 border border-teal-500/15 overflow-hidden">
          <div className="absolute left-0 inset-y-0 w-0.5 bg-gradient-to-b from-teal-400/60 via-teal-500/40 to-transparent rounded-l-xl" />
          <p className="text-[10px] font-black text-teal-500/70 uppercase tracking-widest mb-1.5">Executive Summary</p>
          <p className="text-sm text-gray-200 leading-relaxed max-w-[72ch]">
            {reasoning?.executive_summary ?? risk_headline}
          </p>
        </div>
      )}

      {/* ── Brief rows ───────────────────────────────────────────────────── */}
      {aiLoading && !reasoning ? (
        <BriefSkeleton />
      ) : (
        <div>
          <BriefRow
            icon={<Zap className="w-4 h-4" />}
            label="ERCOT Conditions"
            value={ercotLine}
            sub={reasoning?.current_market_interpretation?.slice(0, 120).concat("…") ?? undefined}
            accent={market_reaction?.level === "high" ? "red" : market_reaction?.level === "medium" ? "amber" : "teal"}
          />
          <BriefRow
            icon={<Thermometer className="w-4 h-4" />}
            label="Weather · Demand Pressure"
            value={demandLine}
            accent={demand_pressure?.level === "high" ? "red" : demand_pressure?.level === "medium" ? "amber" : "green"}
          />
          <BriefRow
            icon={<Flame className="w-4 h-4" />}
            label="Natural Gas Supply"
            value={gasLine}
            sub={gas_to_power_impact?.explanation}
            accent={supply_pressure?.level === "high" ? "red" : supply_pressure?.level === "medium" ? "amber" : "green"}
          />
          <BriefRow
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Escalation Risk Assessment"
            value={escLine}
            accent={escLvl === "Elevated" ? "red" : escLvl === "Moderate" ? "amber" : escLvl === "Low-Moderate" ? "orange" : "teal"}
          />
          <BriefRow
            icon={<TrendingUp className="w-4 h-4" />}
            label="Operational Outlook"
            value={typeof outlookLine === "string" ? outlookLine : "Monitor conditions over the next 6–48h interval."}
            sub={reasoning?.recommended_monitoring_focus ?? undefined}
            accent="teal"
          />
          <BriefRow
            icon={<ShieldCheck className="w-4 h-4" />}
            label="Infrastructure · Data Integrity"
            value={infraLine}
            accent={infraAccent}
          />
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
          <Radio className="w-3 h-3 text-teal-500/50" />
          <span className="uppercase tracking-wide font-semibold">
            AI-synthesized · {reasoning?.model ?? "claude-haiku"} · Live feed
          </span>
        </div>
        <p className="text-[10px] text-gray-700 max-w-[50ch]">
          Operational intelligence only. Not investment, trading, or procurement advice.
        </p>
      </div>
    </div>
  );
}
