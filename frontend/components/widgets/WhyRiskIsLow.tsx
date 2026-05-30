"use client";
import { CheckCircle, XCircle } from "lucide-react";

interface Props {
  riskScore: string;
  demandPressure?: { level: string; explanation?: string };
  supplyPressure?: { level: string; explanation?: string };
  marketReaction?: { level: string; explanation?: string };
  gasToPower?: { level: string; explanation?: string };
  dataSources?: {
    ercot?: { status: string };
    noaa?:  { status: string };
    eia?:   { status: string };
  };
}

interface Factor {
  text: string;
  positive: boolean;
}

export default function WhyRiskIsLow({
  riskScore, demandPressure, supplyPressure, marketReaction, gasToPower, dataSources,
}: Props) {
  const risk   = riskScore || "low";
  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";
  const market = marketReaction?.level || "low";
  const g2p    = gasToPower?.level || "low";

  const ercotOk = dataSources?.ercot?.status === "active";
  const noaaOk  = dataSources?.noaa?.status  === "active";

  const title =
    risk === "high"   ? "WHY RISK IS HIGH" :
    risk === "medium" ? "WHY RISK IS ELEVATED" :
                        "WHY RISK IS LOW";

  const factors: Factor[] = [
    { text: market === "low"  ? "ERCOT pricing stable — within normal operating range" : "ERCOT pricing elevated — above normal range", positive: market === "low" },
    { text: demand === "low"  ? "Seasonal weather — no extreme temperature pressure" : "Temperature-driven demand pressure active", positive: demand === "low" },
    { text: supply === "low"  ? "Adequate gas storage — supply buffer intact" : "Gas storage below seasonal average", positive: supply === "low" },
    { text: ercotOk           ? "No grid alerts — ERCOT operating normally" : "ERCOT data feed delayed", positive: ercotOk },
    { text: demand === "low"  ? "Normal demand profile — load within forecast range" : "Demand above forecast range", positive: demand === "low" },
    { text: g2p === "low"     ? "Gas-to-power impact minimal — no fuel cost pressure" : "Gas-to-power cost sensitivity elevated", positive: g2p === "low" },
  ];

  const positive = factors.filter(f => f.positive);
  const negative = factors.filter(f => !f.positive);

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">{title}</p>

      <div className="space-y-2">
        {positive.map((f, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-gray-300">{f.text}</span>
          </div>
        ))}
        {negative.map((f, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <XCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-amber-200">{f.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
