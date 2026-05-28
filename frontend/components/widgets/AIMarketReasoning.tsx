"use client";
import { Brain, Eye, TrendingUp, Target, ShieldCheck, Loader2, WifiOff,
         Zap, Clock, History, Activity, CheckCircle2 } from "lucide-react";
import type { AIReasoningResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  reasoning:   AIReasoningResponse | null;
  loading:     boolean;
  error:       boolean;
  computedAt?: string;
  confidence?: number | null;
}

// ── Confidence bar ────────────────────────────────────────────────────────────
function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 75 ? "bg-green-500" : value >= 60 ? "bg-amber-500" : "bg-gray-600";
  const label = value >= 75 ? "text-green-400" : value >= 60 ? "text-amber-400" : "text-gray-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${value}%` }} />
      </div>
      <span className={cn("text-xs font-semibold tabular-nums", label)}>{value}%</span>
    </div>
  );
}

// ── Analysis section ──────────────────────────────────────────────────────────
function Section({ icon, label, text }: {
  icon:  React.ReactNode;
  label: string;
  text:  string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-teal-500/70 flex-shrink-0">{icon}</span>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed max-w-[60ch]">{text}</p>
    </div>
  );
}

// ── Operational status pill ───────────────────────────────────────────────────
function StatusPill({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
      active ? "text-teal-500/70" : "text-gray-700"
    )}>
      <span className={cn(
        "w-1 h-1 rounded-full",
        active ? "bg-teal-400" : "bg-gray-700"
      )} />
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AIMarketReasoning({ reasoning, loading, error, computedAt, confidence }: Props) {
  const ts       = reasoning?.generated_at ?? computedAt;
  const timeStr  = ts ? new Date(ts).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", timeZoneName: "short"
  }) : null;
  const isStale      = reasoning?.from_cache && !loading;
  const isPowered    = reasoning?.ai_powered;
  const fallbackReason = reasoning?.fallback_reason;

  return (
    <div className="card-glass panel-scan lg:col-span-2 border border-teal-500/12 p-5 sm:p-6 relative overflow-hidden">

      {/* Ambient teal glow */}
      <div className="pointer-events-none absolute inset-0 rounded-xl"
           style={{ boxShadow: "inset 0 0 80px 0 rgba(20,184,166,0.03)" }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white tracking-tight">AI Market Reasoning</p>
            <p className="text-xs text-gray-600 mt-0.5">AI-assisted interpretation · informational only</p>
          </div>
        </div>

        {/* Right: confidence + badge */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {confidence != null && reasoning && (
            <div className="w-24 hidden sm:block">
              <ConfidenceBar value={confidence} />
            </div>
          )}
          {reasoning && (
            isPowered ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border bg-teal-500/10 border-teal-500/25 text-teal-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-400" />
                </span>
                Claude AI
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border ${
                fallbackReason === "no_api_key"
                  ? "bg-amber-500/8 border-amber-500/20 text-amber-500/80"
                  : fallbackReason === "api_error" || fallbackReason === "parse_error"
                  ? "bg-red-500/8 border-red-500/20 text-red-400/80"
                  : "bg-white/5 border-white/10 text-gray-500"
              }`}>
                <Zap className="w-3 h-3" />
                {fallbackReason === "no_api_key" ? "API Key Missing"
                 : fallbackReason === "api_error" ? "AI Unavailable"
                 : fallbackReason === "parse_error" ? "AI Parse Error"
                 : "Rule-based"}
              </span>
            )
          )}
          {loading && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border bg-white/5 border-white/10 text-gray-600">
              <Loader2 className="w-3 h-3 animate-spin" />Updating
            </span>
          )}
        </div>
      </div>

      {/* ── Operational status row ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-5 pb-4 border-b border-white/5">
        <StatusPill label="AI Synced"      active={!!reasoning && !error} />
        <StatusPill label="Analysis Ready" active={!!reasoning} />
        <StatusPill label="Live Feed"      active={!!reasoning?.ai_powered} />
        {fallbackReason === "no_api_key" && (
          <span className="text-[10px] text-amber-500/70 font-semibold uppercase tracking-wide">
            · Set ANTHROPIC_API_KEY in Railway
          </span>
        )}
        {timeStr && (
          <span className="ml-auto text-[10px] text-gray-700 font-mono flex-shrink-0">{timeStr}</span>
        )}
      </div>

      {/* ── Loading (first load, no cached data) ───────────────────────────── */}
      {loading && !reasoning && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-5 h-5 text-teal-400/60 animate-spin" />
          <p className="text-xs text-gray-600">Generating market interpretation...</p>
        </div>
      )}

      {/* ── Error state ─────────────────────────────────────────────────────── */}
      {!loading && error && !reasoning && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/4 border border-white/8">
          <WifiOff className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-500">AI interpretation module initializing</p>
            <p className="text-xs text-gray-700 mt-1">Rule-based risk assessment remains active. AI layer will resume automatically.</p>
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {reasoning && (
        <div className="space-y-5">

          {/* Stale cache notice */}
          {isStale && (
            <div className="flex items-center gap-2 text-xs text-gray-600 -mt-1">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>Showing last verified interpretation while reasoning refreshes.</span>
            </div>
          )}

          {/* ── Executive Summary — headline intelligence block ──────────── */}
          <div className="relative p-4 rounded-xl bg-teal-500/[0.06] border border-teal-500/15 overflow-hidden">
            {/* Subtle left accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-400/60 via-teal-500/40 to-transparent rounded-l-xl" />
            <div className="flex items-center gap-2 mb-2.5 pl-2">
              <Activity className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
              <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest">Executive Summary</p>
            </div>
            <p className="text-base font-semibold text-white leading-snug pl-2 max-w-[70ch]">{reasoning.executive_summary}</p>
          </div>

          {/* ── 2×2 analysis grid ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            <Section
              icon={<Eye className="w-3.5 h-3.5" />}
              label="Market Interpretation"
              text={reasoning.current_market_interpretation}
            />
            <Section
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              label="Key Driver Analysis"
              text={reasoning.key_driver_analysis}
            />
            <Section
              icon={<Brain className="w-3.5 h-3.5" />}
              label="Escalation Watch"
              text={reasoning.escalation_watch}
            />
            <Section
              icon={<Target className="w-3.5 h-3.5" />}
              label="Monitoring Focus"
              text={reasoning.recommended_monitoring_focus}
            />
          </div>

          {/* ── Historical context ────────────────────────────────────────── */}
          {reasoning.historical_context && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-white/3 border border-white/6">
              <History className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-500 leading-relaxed max-w-[72ch]">{reasoning.historical_context}</p>
            </div>
          )}

          {/* ── Confidence note ────────────────────────────────────────────── */}
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-700 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-600 leading-relaxed max-w-[72ch]">{reasoning.confidence_note}</p>
          </div>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div className="border-t border-white/5 pt-3">
            <p className="text-xs text-gray-700 leading-relaxed">{reasoning.disclaimer}</p>
          </div>

        </div>
      )}
    </div>
  );
}
