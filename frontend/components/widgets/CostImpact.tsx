"use client";
import { DollarSign } from "lucide-react";

interface Props {
  riskScore: string;
  ercotPrice?: number;
  marketReaction?: { level: string };
}

export default function CostImpact({ riskScore, ercotPrice, marketReaction }: Props) {
  const risk   = riskScore || "low";
  const market = marketReaction?.level || "low";
  const price  = ercotPrice ?? 0;

  type Impact = { label: string; description: string; estimate: string; color: string; bg: string };

  const impact: Impact =
    risk === "high"
      ? {
          label:       "ELEVATED EXPOSURE",
          description: "Energy cost exposure may be materially elevated during peak demand intervals. Operational review recommended.",
          estimate:    "Facility-specific — load profile required",
          color:       "text-red-400",
          bg:          "bg-red-500/5 border-red-500/20",
        }
      : risk === "medium"
      ? {
          label:       "MODERATE EXPOSURE",
          description: "Cost sensitivity may increase during peak demand periods. Monitor ERCOT pricing closely.",
          estimate:    "Facility-specific — load profile required",
          color:       "text-amber-400",
          bg:          "bg-amber-500/5 border-amber-500/20",
        }
      : price > 0 && price < 30
      ? {
          label:       "MINIMAL EXPOSURE",
          description: "No material increase in energy costs expected during the next 24 hours.",
          estimate:    "< $5,000 indicative range for typical facilities",
          color:       "text-green-400",
          bg:          "bg-green-500/5 border-green-500/20",
        }
      : {
          label:       "MINIMAL EXPOSURE",
          description: "No material increase in energy costs expected during the next 24 hours.",
          estimate:    "Facility-specific — load profile required for precision",
          color:       "text-green-400",
          bg:          "bg-green-500/5 border-green-500/20",
        };

  const scenarios = [
    { threshold: "ERCOT > $75/MWh", impact: "Cost sensitivity may increase modestly", severity: "watch" },
    { threshold: "ERCOT > $50/MWh", impact: "Elevated cost exposure during peak hours",  severity: "elevated" },
    { threshold: "ERCOT > $100/MWh", impact: "High volatility — immediate review required", severity: "critical" },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Expected Cost Impact</p>
      </div>

      {/* Current state */}
      <div className={`rounded-xl border p-4 mb-4 ${impact.bg}`}>
        <p className={`text-sm font-black mb-1 ${impact.color}`}>{impact.label}</p>
        <p className="text-xs text-gray-300 leading-relaxed mb-2">{impact.description}</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide">Estimated Exposure:</span>
          <span className="text-[11px] font-semibold text-gray-300">{impact.estimate}</span>
        </div>
      </div>

      {/* Scenario thresholds */}
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">If conditions change:</p>
      <div className="grid grid-cols-3 gap-2">
        {scenarios.map((s) => (
          <div key={s.threshold} className="bg-white/3 border border-white/5 rounded-lg p-2.5">
            <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${
              s.severity === "critical" ? "text-red-400" : s.severity === "elevated" ? "text-amber-400" : "text-amber-300"
            }`}>{s.threshold}</p>
            <p className="text-[10px] text-gray-400 leading-relaxed">{s.impact}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mt-3">
        Indicative only. Facility-specific cost impact requires customer load profile. Not financial advice.
      </p>
    </div>
  );
}
