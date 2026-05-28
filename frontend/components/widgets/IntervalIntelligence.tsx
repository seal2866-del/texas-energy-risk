"use client";
import { Clock, TrendingUp, Activity, Eye, ChevronRight } from "lucide-react";
import type { IntervalIntelligence } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  intelligence?: IntervalIntelligence;
}

// ── Escalation colour ─────────────────────────────────────────────────────────
function escCls(pct: number): string {
  if (pct >= 60) return "text-red-400";
  if (pct >= 35) return "text-amber-400";
  if (pct >= 15) return "text-blue-400";
  return "text-gray-500";
}
function confCls(conf: number): string {
  if (conf >= 75) return "bg-green-500";
  if (conf >= 60) return "bg-amber-500";
  return "bg-gray-600";
}

// ── Single interval card ──────────────────────────────────────────────────────
function IntervalCard({
  label, outlook, confidence, escalation_pct, monitoring_focus, dim = false,
}: {
  label:            string;
  outlook:          string;
  confidence:       number;
  escalation_pct:   number;
  monitoring_focus: string;
  dim?:             boolean;
}) {
  return (
    <div className={cn(
      "flex flex-col gap-2.5 p-3.5 rounded-xl border",
      dim ? "bg-white/2 border-white/5 opacity-80" : "bg-white/4 border-white/8",
    )}>
      {/* Label + escalation */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-teal-500/60 flex-shrink-0" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
        </div>
        <span className={cn("text-[11px] font-bold tabular-nums", escCls(escalation_pct))}>
          Esc. {escalation_pct}%
        </span>
      </div>

      {/* Outlook text */}
      <p className="text-xs text-gray-300 leading-relaxed max-w-[52ch]">{outlook}</p>

      {/* Confidence bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Confidence</p>
          <span className="text-[10px] font-semibold text-gray-500 tabular-nums">{confidence}%</span>
        </div>
        <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", confCls(confidence))}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* Monitoring focus */}
      <div className="flex items-start gap-1.5">
        <ChevronRight className="w-3 h-3 text-teal-500/50 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-gray-600 leading-snug max-w-[50ch]">{monitoring_focus}</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function IntervalIntelligenceWidget({ intelligence }: Props) {
  if (!intelligence) return null;
  const { short_term, near_term, outlook } = intelligence;

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
          <Activity className="w-4 h-4 text-teal-400" />
        </div>
        <div>
          <h2 className="text-sm font-black text-white tracking-tight">Multi-Interval Intelligence</h2>
          <p className="text-[10px] text-gray-600 mt-0.5 font-medium uppercase tracking-wide">
            Operational Outlook · 0–6h · 6–24h · 24–48h
          </p>
        </div>
      </div>

      {/* ── Three interval cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <IntervalCard
          label={short_term.label}
          outlook={short_term.outlook}
          confidence={short_term.confidence}
          escalation_pct={short_term.escalation_pct}
          monitoring_focus={short_term.monitoring_focus}
        />
        <IntervalCard
          label={near_term.label}
          outlook={near_term.outlook}
          confidence={near_term.confidence}
          escalation_pct={near_term.escalation_pct}
          monitoring_focus={near_term.monitoring_focus}
          dim
        />
        <IntervalCard
          label={outlook.label}
          outlook={outlook.outlook}
          confidence={outlook.confidence}
          escalation_pct={outlook.escalation_pct}
          monitoring_focus={outlook.monitoring_focus}
          dim
        />
      </div>

      {/* ── Footer disclaimer ────────────────────────────────────────────────── */}
      <p className="mt-3 text-[10px] text-gray-700">
        Interval confidence decreases with forecast distance. All outlooks are probabilistic and operational in nature.
      </p>
    </div>
  );
}
