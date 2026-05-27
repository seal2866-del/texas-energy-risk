"use client";
import { Brain, Clock, Info, DollarSign, Activity, AlertTriangle } from "lucide-react";
import type { RiskScore, SignalsResponse } from "@/lib/api";
import { cn, riskColor } from "@/lib/utils";

interface Props {
  signals:    SignalsResponse;
  computedAt: string;
}

const MARKET_CLS: Record<string, string> = {
  "Stable":        "text-green-400  bg-green-500/10  border-green-500/25",
  "Tightening":    "text-amber-400  bg-amber-500/10  border-amber-500/25",
  "Volatile":      "text-orange-400 bg-orange-500/10 border-orange-500/25",
  "Elevated Risk": "text-red-400    bg-red-500/10    border-red-500/25",
  "Unavailable":   "text-gray-500   bg-white/5       border-white/10",
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

const HORIZON_COLORS: Record<string, string> = {
  short_term: "text-gray-200",
  near_term:  "text-amber-400/80",
  outlook:    "text-gray-400",
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
    demand_pressure,
    supply_pressure,
    market_reaction,
  } = signals;

  const time = new Date(computedAt).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    timeZoneName: "short",
  });

  const mcCls  = MARKET_CLS[market_condition?.label ?? "Unavailable"] ?? MARKET_CLS["Unavailable"];
  const sevCls = SEVERITY_CLS[alert_severity?.level ?? "informational"] ?? SEVERITY_CLS.informational;
  const ccCls  = COST_CLS[cost_impact?.level ?? "low"];

  return (
    <div className="panel-scan card-glass border border-white/5 p-6 lg:col-span-2">

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Brain className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Risk Intelligence Summary</p>
            <p className="text-xs text-gray-500">Synthesized across demand, supply, and market signals</p>
          </div>
        </div>
        <span className="text-xs text-gray-400 font-mono">{time}</span>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 mb-5">
        {market_condition && (
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", mcCls)}>
            <Activity className="w-3 h-3" />
            {market_condition.label}
          </span>
        )}
        {alert_severity && alert_severity.level !== "informational" && (
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", sevCls)}>
            <AlertTriangle className="w-3 h-3" />
            {alert_severity.label} &mdash; {alert_severity.description}
          </span>
        )}
      </div>

      <div className="space-y-5">

        {/* 1. Risk Narrative */}
        {risk_narrative ? (
          <div>
            <p className={cn("text-base font-black leading-tight mb-2", riskColor(risk_score))}>
              {risk_narrative.headline}
            </p>
            <p className="text-sm text-gray-300 leading-relaxed">
              {risk_narrative.body}
            </p>
            {risk_narrative.next_period_note && (
              <p className="text-xs text-gray-400 mt-2 leading-relaxed italic">
                {risk_narrative.next_period_note}
              </p>
            )}
          </div>
        ) : (
          <p className={cn("text-base font-black leading-tight", riskColor(risk_score))}>
            Texas energy risk is {risk_score.toUpperCase()}
          </p>
        )}

        {/* 2. Driver Prioritization */}
        {(demand_pressure || supply_pressure || market_reaction) && (
          <div className="border-t border-white/5 pt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">
              Driver Prioritization
            </p>
            <div className="space-y-2">
              {primary_driver && primary_driver !== "No active risk drivers" && (
                <div className="flex items-start gap-2">
                  <span className={cn(
                    "mt-0.5 px-1.5 py-0.5 rounded text-xs font-black border flex-shrink-0",
                    risk_score === "high"   ? "text-red-400 bg-red-500/10 border-red-500/25" :
                    risk_score === "medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/25" :
                                              "text-gray-500 bg-white/5 border-white/10"
                  )}>
                    PRIMARY
                  </span>
                  <p className="text-xs text-gray-300">{primary_driver}</p>
                </div>
              )}
              {secondary_factors && secondary_factors
                .filter((f) => !f.toLowerCase().includes("stable")
                  && !f.toLowerCase().includes("adequate")
                  && !f.toLowerCase().includes("normal"))
                .map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 px-1.5 py-0.5 rounded text-xs font-semibold border text-gray-500 bg-white/5 border-white/8 flex-shrink-0">
                      SECONDARY
                    </span>
                    <p className="text-xs text-gray-400">{f}</p>
                  </div>
                ))}
              {(!primary_driver || primary_driver === "No active risk drivers") && (
                <p className="text-xs text-gray-500">
                  No active escalation signals detected. All monitored channels within normal operating range.
                </p>
              )}
            </div>
          </div>
        )}

        {/* 3. Cost Impact */}
        {cost_impact && (
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-gray-500" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Cost Impact Interpretation
              </p>
            </div>
            <div className={cn("px-3 py-2.5 rounded-lg border text-xs leading-relaxed", ccCls)}>
              <span className="font-bold">{cost_impact.label}. </span>
              {cost_impact.description}
            </div>
          </div>
        )}

        {/* 4. Forward Outlook */}
        {time_horizons && (
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Forward Outlook
              </p>
            </div>
            <div className="space-y-1.5">
              {(
                [
                  ["short_term", time_horizons.short_term],
                  ["near_term",  time_horizons.near_term],
                  ["outlook",    time_horizons.outlook],
                ] as [string, string][]
              ).map(([key, line]) => (
                <p key={key} className={cn("text-xs font-mono leading-relaxed", HORIZON_COLORS[key])}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* 5. Signal Confidence */}
        {confidence != null && confidence_note && (
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Info className="w-3.5 h-3.5 text-gray-500" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Signal Confidence
              </p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{confidence_note}</p>
          </div>
        )}

      </div>

      {/* System model explainer */}
      <div className="mt-5 pt-4 border-t border-white/5">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400 font-medium">How this works:</span>{" "}
          Weather drives demand &rarr; Natural gas drives generation cost &rarr; ERCOT reflects
          the real-time balance. All three are analyzed together to produce this summary.
        </p>
      </div>

      {/* Disclaimer */}
      {disclaimer && (
        <div className="mt-4 px-3 py-2.5 rounded-lg bg-white/3 border border-white/6">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-500 font-medium">&#9432; </span>
            {disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
