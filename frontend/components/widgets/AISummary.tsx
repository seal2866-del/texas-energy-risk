"use client";
import { Brain, Clock, Info } from "lucide-react";
import type { RiskScore, TimeHorizons, SignalsResponse } from "@/lib/api";
import { cn, riskColor } from "@/lib/utils";

interface Props {
  signals:    SignalsResponse;
  computedAt: string;
}

const HORIZON_COLORS = {
  short_term: "text-gray-200",
  near_term:  "text-amber-400/80",
  outlook:    "text-gray-400",
};

function Section({
  label,
  children,
  labelCls,
}: {
  label:    string;
  children: React.ReactNode;
  labelCls?: string;
}) {
  return (
    <div>
      <p className={cn("text-xs font-bold uppercase tracking-widest mb-1", labelCls ?? "text-gray-500")}>
        {label}
      </p>
      {children}
    </div>
  );
}

export default function AISummary({ signals, computedAt }: Props) {
  const {
    risk_score,
    risk_headline,
    explanation,
    impact,
    confidence,
    confidence_note,
    time_horizons,
    disclaimer,
    demand_pressure,
    supply_pressure,
    market_reaction,
  } = signals;

  const time = new Date(computedAt).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    timeZoneName: "short",
  });

  // Build driver explanation sentence
  const driverParts: string[] = [];
  if (demand_pressure?.level !== "low")
    driverParts.push(`demand pressure is ${demand_pressure?.level}`);
  if (supply_pressure?.level !== "low")
    driverParts.push(`supply pressure is ${supply_pressure?.level}`);
  if (market_reaction?.level !== "low")
    driverParts.push(`market reaction is ${market_reaction?.level}`);

  const driverExplanation =
    driverParts.length > 0
      ? `${driverParts.map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join(", and ")}.`
      : explanation ?? "All monitored risk drivers are within normal operating ranges.";

  return (
    <div className="card-glass border border-white/5 p-6 lg:col-span-2">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Brain className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Risk Intelligence Summary</p>
            <p className="text-xs text-gray-600">Synthesized across all three energy risk drivers</p>
          </div>
        </div>
        <span className="text-xs text-gray-600 font-mono">{time}</span>
      </div>

      <div className="space-y-4">
        {/* 1. Headline */}
        <Section label="Current Conditions" labelCls={riskColor(risk_score)}>
          <p className={cn("text-sm font-bold leading-relaxed", riskColor(risk_score))}>
            {risk_headline ?? `Texas energy risk is currently ${risk_score.toUpperCase()}.`}
          </p>
        </Section>

        {/* 2. Driver explanation */}
        <Section label="What Is Driving Risk">
          <p className="text-sm text-gray-300 leading-relaxed">{driverExplanation}</p>
        </Section>

        {/* 3. Why this matters */}
        {impact && (
          <Section label="Why This Matters">
            <div
              className={cn(
                "px-3 py-2.5 rounded-lg border text-xs leading-relaxed",
                risk_score === "high"
                  ? "bg-red-500/10 border-red-500/20 text-red-300"
                  : risk_score === "medium"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                  : "bg-white/5 border-white/8 text-gray-400",
              )}
            >
              {impact}
            </div>
          </Section>
        )}

        {/* 4. Forward outlook */}
        {time_horizons && (
          <Section label="Forward Outlook">
            <div className="border-t border-white/5 pt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest">
                  Time Horizon
                </p>
              </div>
              <div className="space-y-1.5">
                {(
                  [
                    ["short_term", time_horizons.short_term],
                    ["near_term",  time_horizons.near_term],
                    ["outlook",    time_horizons.outlook],
                  ] as [keyof typeof HORIZON_COLORS, string][]
                ).map(([key, line]) => (
                  <p
                    key={key}
                    className={cn("text-xs font-mono leading-relaxed", HORIZON_COLORS[key])}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* 5. Confidence note */}
        {confidence != null && confidence_note && (
          <Section label="Data Confidence">
            <div className="flex items-start gap-1.5">
              <Info className="w-3 h-3 text-gray-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-600 leading-relaxed">{confidence_note}</p>
            </div>
          </Section>
        )}
      </div>

      {/* Disclaimer */}
      {disclaimer && (
        <div className="mt-5 px-3 py-2.5 rounded-lg bg-white/3 border border-white/6">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-500 font-medium">ⓘ </span>
            {disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
