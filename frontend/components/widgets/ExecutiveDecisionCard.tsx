"use client";
import { CheckCircle, AlertTriangle, XCircle, Clock, Shield } from "lucide-react";

interface Props {
  riskScore: string;
  riskDirection: string;
  confidence?: number | null;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  activeSignals?: number;
  computedAt?: string;
}

function getNextReview(): string {
  const now = new Date();
  const h = now.getHours();
  if (h < 14) return "14:00 CDT";
  if (h < 16) return "16:00 CDT";
  if (h < 19) return "19:00 CDT";
  return "Next scheduled refresh";
}

function confidenceLabel(c: number | null | undefined): string {
  if (!c) return "Moderate";
  if (c >= 80) return "High";
  if (c >= 60) return "Moderate";
  return "Limited";
}

export default function ExecutiveDecisionCard({
  riskScore, riskDirection, confidence, demandPressure,
  supplyPressure, marketReaction, activeSignals = 0, computedAt,
}: Props) {
  const risk   = riskScore || "low";
  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";
  const market = marketReaction?.level || "low";

  type Decision = { action: string; label: string; detail: string; sub: string; bg: string; border: string; iconColor: string; labelColor: string };

  const decision: Decision =
    risk === "high" || activeSignals >= 2
      ? {
          action:     "IMMEDIATE REVIEW REQUIRED",
          label:      "🔴 ACTION REQUIRED",
          detail:     "Multiple escalation thresholds exceeded.",
          sub:        "Procurement, dispatch, and fuel-supply teams should be notified immediately.",
          bg:         "bg-red-500/8",
          border:     "border-red-500/30",
          iconColor:  "text-red-400",
          labelColor: "text-red-300",
        }
      : risk === "medium"
      ? {
          action:     "ENHANCED MONITORING RECOMMENDED",
          label:      "⚠ ENHANCED MONITORING",
          detail:     "Demand pressure approaching threshold.",
          sub:        "Review procurement positions ahead of the peak demand window.",
          bg:         "bg-amber-500/8",
          border:     "border-amber-500/30",
          iconColor:  "text-amber-400",
          labelColor: "text-amber-300",
        }
      : {
          action:     "NO ACTION REQUIRED",
          label:      "✓ NO ACTION REQUIRED",
          detail:     "Operations remain stable.",
          sub:        "No procurement, dispatch, or fuel-supply actions recommended.",
          bg:         "bg-green-500/5",
          border:     "border-green-500/20",
          iconColor:  "text-green-400",
          labelColor: "text-green-300",
        };

  return (
    <div className={`rounded-2xl border p-5 lg:col-span-2 ${decision.bg} ${decision.border}`}>
      {/* Label row */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Executive Decision
        </p>
        <span className="text-[10px] text-gray-600 uppercase tracking-wide">Operational Intelligence</span>
      </div>

      {/* Main action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className={`text-xl font-black tracking-tight mb-1 ${decision.labelColor}`}>
            {decision.label}
          </p>
          <p className="text-sm text-gray-200 font-medium">{decision.detail}</p>
          <p className="text-xs text-gray-400 mt-1">{decision.sub}</p>
        </div>

        {/* Right: Next review + confidence */}
        <div className="flex-shrink-0 flex flex-col sm:items-end gap-2">
          <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Next Review</p>
              <p className="text-sm font-bold text-white">{getNextReview()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2">
            <Shield className="w-3.5 h-3.5 text-gray-400" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Confidence</p>
              <p className="text-sm font-bold text-white">{confidenceLabel(confidence)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
