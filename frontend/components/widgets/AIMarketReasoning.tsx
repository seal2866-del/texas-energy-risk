"use client";
import { Brain, AlertCircle, TrendingUp, Eye, ShieldCheck, Target, Loader2, WifiOff, Zap } from "lucide-react";
import type { AIReasoningResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  reasoning:    AIReasoningResponse | null;
  loading:      boolean;
  error:        boolean;
  computedAt?:  string;
}

interface SectionProps {
  icon:      React.ReactNode;
  label:     string;
  text:      string;
  className?: string;
}

function ReasoningSection({ icon, label, text, className }: SectionProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <span className="text-teal-400/80">{icon}</span>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-sm text-gray-200 leading-relaxed pl-5">{text}</p>
    </div>
  );
}

function ModelBadge({ aiPowered }: { aiPowered: boolean }) {
  if (aiPowered) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-teal-500/10 border-teal-500/25 text-teal-300">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-400" />
        </span>
        AI-powered
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-white/5 border-white/10 text-gray-500">
      <Zap className="w-3 h-3" />
      Rule-based
    </span>
  );
}

export default function AIMarketReasoning({ reasoning, loading, error, computedAt }: Props) {
  const ts = reasoning?.generated_at ?? computedAt;
  const timeStr = ts
    ? new Date(ts).toLocaleTimeString("en-US", { timeZone: "America/Chicago", timeZoneName: "short" })
    : null;

  return (
    <div className="card-glass panel-scan lg:col-span-2 border border-teal-500/15 p-6 relative overflow-hidden">

      {/* Subtle teal accent glow */}
      <div className="pointer-events-none absolute inset-0 rounded-xl"
           style={{ boxShadow: "inset 0 0 60px 0 rgba(20,184,166,0.04)" }} />

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
            <Brain className="w-4.5 h-4.5 text-teal-400" style={{ width: "18px", height: "18px" }} />
          </div>
          <div>
            <p className="text-sm font-black text-white tracking-tight">AI Market Reasoning</p>
            <p className="text-xs text-gray-500 mt-0.5">AI-assisted interpretation · informational only</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {reasoning && <ModelBadge aiPowered={reasoning.ai_powered} />}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
          <p className="text-xs text-gray-500">Generating market interpretation...</p>
        </div>
      )}

      {/* Error / unavailable state */}
      {!loading && error && !reasoning && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/8">
          <WifiOff className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-400">AI reasoning temporarily unavailable</p>
            <p className="text-xs text-gray-600 mt-1">Rule-based risk summary remains active. Retrying automatically.</p>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && reasoning && (
        <div className="space-y-5">

          {/* Executive summary — full width, prominent */}
          <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/15">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-teal-400" />
              <p className="text-xs font-bold text-teal-400 uppercase tracking-widest">Executive Summary</p>
            </div>
            <p className="text-sm font-medium text-gray-100 leading-relaxed">
              {reasoning.executive_summary}
            </p>
          </div>

          {/* 2-column grid for the analysis sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <ReasoningSection
              icon={<AlertCircle className="w-4 h-4" />}
              label="Current Market Interpretation"
              text={reasoning.current_market_interpretation}
            />

            <ReasoningSection
              icon={<TrendingUp className="w-4 h-4" />}
              label="Key Driver Analysis"
              text={reasoning.key_driver_analysis}
            />

            <ReasoningSection
              icon={<Eye className="w-4 h-4" />}
              label="Escalation Watch"
              text={reasoning.escalation_watch}
            />

            <ReasoningSection
              icon={<Target className="w-4 h-4" />}
              label="Monitoring Focus"
              text={reasoning.recommended_monitoring_focus}
            />

          </div>

          {/* Confidence note — full width, subdued */}
          <div className="flex items-start gap-2 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-500 leading-relaxed">{reasoning.confidence_note}</p>
          </div>

          {/* Divider + disclaimer + timestamp */}
          <div className="border-t border-white/5 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs text-gray-700 leading-relaxed max-w-xl">
              {reasoning.disclaimer}
            </p>
            {timeStr && (
              <p className="text-xs text-gray-700 font-mono flex-shrink-0">
                {reasoning.from_cache ? "cached · " : ""}
                {timeStr}
              </p>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
