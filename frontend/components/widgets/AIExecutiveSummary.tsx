"use client";
import { Sparkles } from "lucide-react";

interface Props {
  riskScore:      string;
  riskDirection:  string;
  primaryDriver?: string;
  confidence?:    number | null;
  ercotPrice?:    number;
  temperature?:   number;
  henryHub?:      number;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  activeSignals?:  number;
  computedAt?:     string;
}

function confLabel(c?: number | null): string {
  if (!c) return "Moderate";
  if (c >= 80) return `${c}%`;
  if (c >= 50) return `${c}%`;
  return `${c}%`;
}

function confColor(c?: number | null): string {
  if (!c) return "text-amber-400";
  if (c >= 80) return "text-green-400";
  if (c >= 50) return "text-amber-400";
  return "text-gray-400";
}

export default function AIExecutiveSummary({
  riskScore, riskDirection, primaryDriver, confidence,
  ercotPrice, temperature, henryHub, demandPressure, supplyPressure, marketReaction,
  activeSignals = 0, computedAt,
}: Props) {
  const risk   = riskScore || "low";
  const demand = demandPressure?.level  || "low";
  const supply = supplyPressure?.level  || "low";
  const market = marketReaction?.level  || "low";
  const price  = ercotPrice  ?? 0;
  const temp   = temperature ?? 0;
  const hh     = henryHub    ?? 0;
  const rising = riskDirection === "increasing";

  // Current conditions
  const currentConditions =
    risk === "high"   ? "Texas grid conditions are elevated with multiple active risk signals." :
    risk === "medium" ? "Texas grid conditions are moderately elevated — demand pressure is present." :
    rising            ? "Texas grid conditions are stable but trending toward elevated monitoring." :
                        "Texas grid conditions remain stable across all monitored signals.";

  // Primary driver
  const driverMap: Record<string, string> = {
    weather_demand:   `Weather-driven demand pressure${temp > 0 ? ` (${temp.toFixed(0)}°F)` : ""}`,
    price_volatility: `ERCOT pricing sensitivity${price > 0 ? ` ($${price.toFixed(2)}/MWh)` : ""}`,
    gas_supply:       `Natural gas supply tightness${hh > 0 ? ` (HH $${hh.toFixed(2)}/MMBtu)` : ""}`,
  };
  const primaryDriverStr = driverMap[primaryDriver || ""] ||
    (price > 0 ? `ERCOT at $${price.toFixed(2)}/MWh — within normal range` : "Normal market conditions across monitored signals");

  // Operational impact
  const operationalImpact =
    risk === "high"   ? "Elevated operational exposure. Contingency protocols may be warranted." :
    risk === "medium" ? "Moderate cost sensitivity possible during afternoon peak hours." :
    demand !== "low"  ? "Weather-driven demand may increase ERCOT pricing during 14:00-19:00 CDT." :
                        "No operational disruptions expected under current conditions.";

  // 24h outlook
  const outlook =
    risk === "high"   ? "Elevated conditions expected to persist for the next 24 hours." :
    risk === "medium" ? `Risk expected to remain ${rising ? "elevated or increase" : "moderate"} for the next 24 hours.` :
    rising            ? "Conditions trending upward — may become elevated within 6–24 hours if drivers persist." :
                        "Low risk conditions expected to continue through the next 24 hours.";

  // Recommended action
  const action =
    risk === "high"   ? "Review operational exposure. Confirm contingency protocols. Increase monitoring frequency." :
    risk === "medium" ? "Monitor ERCOT pricing during peak window (14:00–19:00 CDT). Review according to internal procedures." :
                        "Continue standard monitoring cadence. Reassess at next scheduled review window.";

  const riskColor = risk === "high" ? "text-red-400" : risk === "medium" ? "text-amber-400" : "text-green-400";
  const riskBg    = risk === "high" ? "border-red-500/20" : risk === "medium" ? "border-amber-500/20" : "border-white/8";

  const rows = [
    { label: "Current Conditions",   value: currentConditions },
    { label: "Primary Driver",        value: primaryDriverStr },
    { label: "Operational Impact",    value: operationalImpact },
    { label: "24-Hour Outlook",       value: outlook },
    { label: "Recommended Action",    value: action },
  ];

  return (
    <div className={`card-glass border ${riskBg} rounded-2xl p-5 lg:col-span-2`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">AI Executive Summary</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 uppercase tracking-wide">Confidence</span>
            <span className={`text-xs font-bold ${confColor(confidence)}`}>{confLabel(confidence)}</span>
          </div>
          <span className={`text-xs font-black uppercase ${riskColor}`}>{risk.toUpperCase()} RISK</span>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex gap-3">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide w-36 flex-shrink-0 pt-0.5">{label}</span>
            <span className="text-xs text-gray-200 leading-relaxed">{value}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-700 mt-3 border-t border-white/5 pt-2">
        Operational awareness only. Not financial, trading, or procurement advice.
      </p>
    </div>
  );
}
