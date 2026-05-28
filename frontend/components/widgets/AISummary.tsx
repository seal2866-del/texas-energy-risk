"use client";
import { Brain, Clock, DollarSign, Activity, AlertTriangle, TrendingUp, ShieldCheck } from "lucide-react";
import type { RiskScore, SignalsResponse } from "@/lib/api";
import { cn, riskColor } from "@/lib/utils";

interface Props {
  signals:    SignalsResponse;
  computedAt: string;
}

const MARKET_CLS: Record<string, string> = {
  "Stable":           "text-green-400  bg-green-500/10  border-green-500/25",
  "Watch":            "text-blue-400   bg-blue-500/10   border-blue-500/25",
  "Tightening":       "text-amber-400  bg-amber-500/10  border-amber-500/25",
  "Elevated Risk":    "text-orange-400 bg-orange-500/10 border-orange-500/25",
  "Elevated Conditions": "text-orange-400 bg-orange-500/10 border-orange-500/25",
  "Stress Building":  "text-red-400    bg-red-500/10    border-red-500/25",
  "Volatile":         "text-orange-400 bg-orange-500/10 border-orange-500/25",
  "Critical":         "text-red-400    bg-red-500/10    border-red-500/25",
  "Unavailable":      "text-gray-500   bg-white/5       border-white/10",
};

const SEVERITY_CLS: Record<string, string> = {
  informational: "text-gray-400   bg-white/5       border-white/10",
  monitoring:    "text-amber-400  bg-amber-500/10  border-amber-500/20",
  elevated:      "text-orange-400 bg-orange-500/10 border-orange-500/25",
  critical:      "text-red-400    bg-red-500/10    border-red-500/25",
};

const COST_CLS: Record<RiskScore, string> = {
  low:    "text-green-400 bg-green-500/8  border-green-500/20",
  medium: "text-amber-400 bg-amber-500/8  border-amber-500/20",
  high:   "text-red-400   bg-red-500/8    border-red-500/20",
};

const ESC_CLS: Record<string, string> = {
  "Low":          "text-gray-500  bg-white/4       border-white/8",
  "Low-Moderate": "text-blue-400  bg-blue-500/8    border-blue-500/20",
  "Moderate":     "text-amber-400 bg-amber-500/8   border-amber-500/20",
  "Elevated":     "text-red-400   bg-red-500/8     border-red-500/20",
};

const HORIZON_LABEL: Record<string, string> = {
  short_term: "0–6h",
  near_term:  "6–24h",
  outlook:    "24–48h",
};

export default function AISummary({ signals, computedAt }: Props) {
  const {
    risk_score,
    risk_narrative,
    cost_impact,
    market_condition,
    alert_severity,
    confidence,
    confidence_note,
    time_horizons,
    disclaimer,
    primary_driver,
    secondary_factors,
    escalation_probability,
  } = signals;

  const time = new Date(computedAt).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  const mcCls  = MARKET_CLS[market_condition?.label ?? "Unavailable"] ?? MARKET_CLS["Unavailable"];
  const sevCls = SEVERITY_CLS[alert_severity?.level ?? "informational"] ?? SEVERITY_CLS.informational;
  const ccCls  = COST_CLS[cost_impact?.level ?? "low"];
  const escCls = ESC_CLS[escalation_probability?.level ?? "Low"] ?? ESC_CLS["Low"];

  return (
    <div className="panel-scan card-glass border border-white/5 p-5 sm:p-6 lg:col-span-2">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Risk Intelligence Summary</p>
            <p className="text-xs text-gray-600">Synthesized across demand, supply &amp; market signals</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600 flex-shrink-0">
          <Clock className="w-3 h-3" />
          <span className="font-mono">{time}</span>
        </div>
      </div>

      {/* ── Status badges row ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {market_condition && (
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border", mcCls)}>
            <Activity className="w-3 h-3" />
            {market_condition.label}
          </span>
        )}
        {escalation_probability && escalation_probability.level !== "Low" && (
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border", escCls)}>
            <TrendingUp className="w-3 h-3" />
            {escalation_probability.level} Escalation Probability
          </span>
        )}
        {alert_severity && alert_severity.level !== "informational" && (
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border", sevCls)}>
            <AlertTriangle className="w-3 h-3" />
            {alert_severity.label}
          </span>
        )}
      </div>

      <div className="space-y-4">

        {/* 1. Risk Narrative — headline */}
        {risk_narrative ? (
          <div>
            <p className={cn("text-base font-black leading-tight mb-1.5", riskColor(risk_score))}>
              {risk_narrative.headline}
            </p>
            <p className="text-sm text-gray-300 leading-relaxed max-w-[72ch]">
              {risk_narrative.body}
            </p>
            {risk_narrative.next_period_note && (
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed italic max-w-[72ch]">
                {risk_narrative.next_period_note}
              </p>
            )}
          </div>
        ) : (
          <p className={cn("text-base font-black leading-tight", riskColor(risk_score))}>
            Texas energy risk is {risk_score.toUpperCase()}
          </p>
        )}

        {/* 2. Escalation Probability rationale (when meaningful) */}
        {escalation_probability && escalation_probability.level !== "Low" && escalation_probability.rationale && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/6">
            <TrendingUp className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-500 leading-relaxed">{escalation_probability.rationale}</p>
          </div>
        )}

        {/* 3. Active drivers — compact row format */}
        {primary_driver && primary_driver !== "No active risk drivers" && (
          <div className="border-t border-white/5 pt-3">
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Active Drivers</p>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className={cn(
                  "mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-black border flex-shrink-0 uppercase tracking-wide",
                  risk_score === "high"   ? "text-red-400 bg-red-500/10 border-red-500/25" :
                  risk_score === "medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/25" :
                                            "text-gray-500 bg-white/5 border-white/10"
                )}>
                  Primary
                </span>
                <p className="text-xs text-gray-300 leading-relaxed">{primary_driver}</p>
              </div>
              {(secondary_factors ?? [])
                .filter(f => !f.toLowerCase().includes("stable") && !f.toLowerCase().includes("adequate") && !f.toLowerCase().includes("normal"))
                .map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border text-gray-600 bg-white/4 border-white/8 flex-shrink-0 uppercase tracking-wide">
                      Factor
                    </span>
                    <p className="text-xs text-gray-500 leading-relaxed">{f}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 4. Cost Impact */}
        {cost_impact && (
          <div className="border-t border-white/5 pt-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <DollarSign className="w-3 h-3 text-gray-600" />
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Cost Impact</p>
            </div>
            <div className={cn("px-3 py-2 rounded-lg border text-xs leading-relaxed", ccCls)}>
              <span className="font-bold">{cost_impact.label}. </span>
              {cost_impact.description}
            </div>
          </div>
        )}

        {/* 5. Forward Outlook — compact 3-line grid */}
        {time_horizons && (
          <div className="border-t border-white/5 pt-3">
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Forward Outlook</p>
            <div className="grid grid-cols-1 gap-1">
              {([
                ["short_term", time_horizons.short_term],
                ["near_term",  time_horizons.near_term],
                ["outlook",    time_horizons.outlook],
              ] as [string, string][]).map(([key, line]) => (
                <div key={key} className="flex items-baseline gap-2">
                  <span className="text-[10px] font-black text-gray-700 uppercase tracking-wide flex-shrink-0 w-10">
                    {HORIZON_LABEL[key]}
                  </span>
                  <p className="text-xs text-gray-400 leading-relaxed font-mono">{line}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Confidence */}
        {confidence != null && confidence_note && (
          <div className="border-t border-white/5 pt-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShieldCheck className="w-3 h-3 text-gray-600" />
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Signal Confidence</p>
              <span className={cn(
                "ml-auto text-xs font-black tabular-nums",
                confidence >= 75 ? "text-green-400" : confidence >= 60 ? "text-amber-400" : "text-gray-500"
              )}>{confidence}%</span>
            </div>
            {/* Mini bar */}
            <div className="h-0.5 bg-white/5 rounded-full overflow-hidden mb-1.5">
              <div
                className={cn("h-full rounded-full transition-all duration-700",
                  confidence >= 75 ? "bg-green-500" : confidence >= 60 ? "bg-amber-500" : "bg-gray-600")}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed max-w-[72ch]">{confidence_note}</p>
          </div>
        )}

      </div>

      {/* How it works — compact */}
      <div className="mt-4 pt-3 border-t border-white/5">
        <p className="text-xs text-gray-700 leading-relaxed">
          Weather &rarr; demand pressure &rarr; gas generation cost &rarr; ERCOT real-time balance.
          All three channels analyzed together to produce this summary.
        </p>
      </div>

      {disclaimer && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-white/3 border border-white/6">
          <p className="text-xs text-gray-700 leading-relaxed">&#9432; {disclaimer}</p>
        </div>
      )}
    </div>
  );
}
