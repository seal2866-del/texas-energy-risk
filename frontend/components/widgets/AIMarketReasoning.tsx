"use client";
import { Brain, Eye, TrendingUp, Target, ShieldCheck, Loader2, WifiOff, Zap, Clock, History } from "lucide-react";
import type { AIReasoningResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  reasoning:   AIReasoningResponse | null;
  loading:     boolean;
  error:       boolean;
  computedAt?: string;
  confidence?: number | null;
}

function Section({ icon, label, text, accent = false }: {
  icon:     React.ReactNode;
  label:    string;
  text:     string;
  accent?:  boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={cn("flex-shrink-0", accent ? "text-teal-400" : "text-teal-500/70")}>{icon}</span>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-sm text-gray-200 leading-relaxed pl-5">{text}</p>
    </div>
  );
}

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

export default function AIMarketReasoning({ reasoning, loading, error, computedAt, confidence }: Props) {
  const ts       = reasoning?.generated_at ?? computedAt;
  const timeStr  = ts ? new Date(ts).toLocaleTimeString("en-US", { timeZone: "America/Chicago", timeZoneName: "short" }) : null;
  const isStale  = reasoning?.from_cache && !loading;
  const isPowered = reasoning?.ai_powered;

  return (
    <div className="card-glass panel-scan lg:col-span-2 border border-teal-500/12 p-6 relative overflow-hidden">

      {/* Ambient teal glow */}
      <div className="pointer-events-none absolute inset-0 rounded-xl"
           style={{ boxShadow: "inset 0 0 80px 0 rgba(20,184,166,0.03)" }} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
            <Brain style={{ width: "18px", height: "18px" }} className="text-teal-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white tracking-tight">AI Market Reasoning</p>
            <p className="text-xs text-gray-600 mt-0.5">AI-assisted interpretation · informational only</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {/* Confidence bar */}
          {confidence != null && reasoning && (
            <div className="w-28 hidden sm:block">
              <ConfidenceBar value={confidence} />
            </div>
          )}
          {/* AI / rule-based badge */}
          {reasoning && (
            isPowered ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-teal-500/10 border-teal-500/25 text-teal-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-400" />
                </span>
                Claude AI
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-white/5 border-white/10 text-gray-500">
                <Zap className="w-3 h-3" />Rule-based
              </span>
            )
          )}
          {loading && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-white/5 border-white/10 text-gray-600">
              <Loader2 className="w-3 h-3 animate-spin" />Updating
            </span>
          )}
        </div>
      </div>

      {/* ── Loading (first load, no cached data) ─────────────────────────── */}
      {loading && !reasoning && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-5 h-5 text-teal-400/60 animate-spin" />
          <p className="text-xs text-gray-600">Generating market interpretation...</p>
        </div>
      )}

      {/* ── Error state (no reasoning at all) ────────────────────────────── */}
      {!loading && error && !reasoning && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/4 border border-white/8">
          <WifiOff className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-500">AI interpretation module initializing</p>
            <p className="text-xs text-gray-700 mt-1">Rule-based risk assessment remains active. AI layer will resume automatically.</p>
          </div>
        </div>
      )}

      {/* ── Content (show even when loading if we have cached data) ──────── */}
      {reasoning && (
        <div className="space-y-6">

          {/* Stale cache notice */}
          {isStale && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Clock className="w-3 h-3" />
              <span>Showing latest verified interpretation while new market reasoning refreshes.</span>
            </div>
          )}

          {/* Executive summary — full-width featured block */}
          <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/12">
            <p className="text-xs font-black text-teal-400 uppercase tracking-widest mb-2">Executive Summary</p>
            <p className="text-sm font-semibold text-gray-100 leading-relaxed">{reasoning.executive_summary}</p>
          </div>

          {/* 2×2 analysis grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <Section
              icon={<Eye style={{ width: "14px", height: "14px" }} />}
              label="Current Market Interpretation"
              text={reasoning.current_market_interpretation}
            />
            <Section
              icon={<TrendingUp style={{ width: "14px", height: "14px" }} />}
              label="Key Driver Analysis"
              text={reasoning.key_driver_analysis}
            />
            <Section
              icon={<Brain style={{ width: "14px", height: "14px" }} />}
              label="Escalation Watch"
              text={reasoning.escalation_watch}
            />
            <Section
              icon={<Target style={{ width: "14px", height: "14px" }} />}
              label="Monitoring Focus"
              text={reasoning.recommended_monitoring_focus}
            />
          </div>

          {/* Historical context — if present */}
          {reasoning.historical_context && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-white/3 border border-white/6">
              <History className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-500 leading-relaxed">{reasoning.historical_context}</p>
            </div>
          )}

          {/* Confidence note */}
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-700 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-600 leading-relaxed">{reasoning.confidence_note}</p>
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs text-gray-700 leading-relaxed max-w-xl">{reasoning.disclaimer}</p>
            {timeStr && (
              <p className="text-xs text-gray-700 font-mono flex-shrink-0">{timeStr}</p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
