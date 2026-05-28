"use client";
/**
 * PredictiveOutlook.tsx
 * Phase 9 — Predictive Intelligence Engine
 * Three-horizon risk outlook + executive explanation layer.
 */
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Eye, Zap, ArrowRight, Clock, Brain } from "lucide-react";
import type { SignalSnapshot } from "@/lib/api";
import { buildPredictiveOutlook, outlookRiskColor, horizonConfidenceLabel, type OutlookRisk, type HorizonOutlook } from "@/lib/predictiveOutlook";
import { computeRiskTrajectory, trajectoryColor } from "@/lib/riskTrajectory";
import { analyseStateTransitions, instabilityColor } from "@/lib/stateTransitionEngine";

// ── Sub-components ────────────────────────────────────────────────────────────

function RiskPill({ level }: { level: OutlookRisk }) {
  const colors: Record<OutlookRisk, string> = {
    low:      "bg-green-500/15 text-green-400 border-green-500/20",
    medium:   "bg-amber-500/15 text-amber-400 border-amber-500/20",
    high:     "bg-red-500/15 text-red-400 border-red-500/20",
    uncertain:"bg-gray-500/15 text-gray-400 border-gray-500/20",
  };
  const labels: Record<OutlookRisk, string> = {
    low: "Low", medium: "Medium", high: "High", uncertain: "Uncertain",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${colors[level]}`}>
      {labels[level]}
    </span>
  );
}

function EscBar({ pct, level }: { pct: number; level: OutlookRisk }) {
  const color = outlookRiskColor(level);
  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">Escalation probability</span>
        <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function HorizonCard({ h, active }: { h: HorizonOutlook; active?: boolean }) {
  const borderColor = outlookRiskColor(h.riskLevel);
  return (
    <div
      className={`flex-1 rounded-xl p-4 border transition-all ${active ? "bg-white/5" : "bg-white/2"}`}
      style={{ borderColor: active ? borderColor : "rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          {h.label}
        </span>
        {active && <span className="text-[9px] text-orange-400 font-bold uppercase tracking-widest">Now</span>}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <RiskPill level={h.riskLevel} />
        <span className="text-xs text-gray-500">{horizonConfidenceLabel(h.confidence)}</span>
      </div>
      <div className="text-xs text-gray-500 mb-0.5">Confidence: {h.confidence}%</div>
      <EscBar pct={h.escalationPct} level={h.riskLevel} />
    </div>
  );
}

function ExecRow({ icon: Icon, label, text, color }: {
  icon: React.ElementType;
  label: string;
  text: string;
  color: string;
}) {
  return (
    <div className="flex gap-3 py-3 border-b border-white/5 last:border-0">
      <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-0.5`}
           style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color }}>{label}</div>
        <p className="text-xs text-gray-300 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

interface Props {
  snapshots: SignalSnapshot[];
}

export default function PredictiveOutlook({ snapshots }: Props) {
  const outlook    = useMemo(() => buildPredictiveOutlook(snapshots), [snapshots]);
  const trajectory = useMemo(() => computeRiskTrajectory(snapshots),  [snapshots]);
  const transitions = useMemo(() => analyseStateTransitions(snapshots), [snapshots]);

  if (!outlook) {
    return (
      <div className="card-glass border border-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-bold text-white">Predictive Outlook</h2>
        </div>
        <div className="text-center py-8">
          <div className="text-gray-600 text-xs mb-2">Insufficient historical data</div>
          <div className="text-gray-700 text-[11px]">At least 6 signal snapshots required to generate predictions.</div>
        </div>
      </div>
    );
  }

  const overallColor = outlookRiskColor(outlook.overallRisk);

  return (
    <div className="card-glass border border-white/5 rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <Brain className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">Predictive Outlook</h2>
            <div className="text-[10px] text-gray-500">Based on {outlook.dataPoints} signal snapshots</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RiskPill level={outlook.overallRisk} />
          <span className="text-xs text-gray-500">{outlook.overallConfidence}% confidence</span>
        </div>
      </div>

      {/* Three-horizon cards */}
      <div className="flex gap-3">
        <HorizonCard h={outlook.shortTerm}   active />
        <HorizonCard h={outlook.nearTerm} />
        <HorizonCard h={outlook.outlookTerm} />
      </div>

      {/* Trajectory + Instability row */}
      {(trajectory || transitions) && (
        <div className="flex gap-3">
          {trajectory && (
            <div className="flex-1 rounded-xl bg-white/3 border border-white/5 px-4 py-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Trajectory</div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: trajectoryColor(trajectory.trajectory) }}>
                  {trajectory.trajectory}
                </span>
                <span className="text-xs text-gray-500">— {trajectory.momentum} momentum</span>
              </div>
              <div className="text-[11px] text-gray-600 mt-1">
                Slope: {trajectory.recentSlope > 0 ? "+" : ""}{trajectory.recentSlope} · Vol: {trajectory.volatilityIndex}
              </div>
            </div>
          )}
          {transitions && (
            <div className="flex-1 rounded-xl bg-white/3 border border-white/5 px-4 py-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Instability</div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: instabilityColor(transitions.instabilityScore) }}>
                  {transitions.instabilityScore}/100
                </span>
                <span className="text-xs text-gray-500">— {transitions.transitionStrength}</span>
              </div>
              <div className="text-[11px] text-gray-600 mt-1">
                {transitions.pattern.escalationCount} escalations · {transitions.pattern.loopCount} loops
              </div>
            </div>
          )}
        </div>
      )}

      {/* Executive layer */}
      <div className="rounded-xl bg-white/2 border border-white/5 px-4 pt-3 pb-1">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-orange-400" />
          Intelligence Layer
        </div>
        <ExecRow icon={AlertTriangle} label="Why"   text={outlook.executive.why}   color="#f59e0b" />
        <ExecRow icon={TrendingUp}    label="What"  text={outlook.executive.what}  color="#60a5fa" />
        <ExecRow icon={Eye}           label="Watch" text={outlook.executive.watch} color="#a78bfa" />
        <ExecRow icon={ArrowRight}    label="Next"  text={outlook.executive.next}  color={overallColor} />
      </div>
    </div>
  );
}
