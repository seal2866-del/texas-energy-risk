"use client";
import { TrendingUp } from "lucide-react";

interface Props {
  riskScore:       string;
  riskDirection:   string;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  ercotPrice?:     number;
  temperature?:    number;
}

type ImpactLevel = "Minimal" | "Moderate" | "Elevated" | "Significant";

interface ImpactScenario {
  condition:   string;
  impact:      string;
}

function impactColor(level: ImpactLevel) {
  if (level === "Significant") return "text-red-400";
  if (level === "Elevated")    return "text-amber-400";
  if (level === "Moderate")    return "text-amber-300";
  return "text-green-400";
}

export default function PotentialImpact({
  riskScore, riskDirection, demandPressure, supplyPressure,
  marketReaction, ercotPrice, temperature,
}: Props) {
  const risk   = riskScore || "low";
  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";
  const market = marketReaction?.level || "low";
  const price  = ercotPrice  ?? 0;
  const temp   = temperature ?? 0;

  const impactLevel: ImpactLevel =
    risk === "high"   ? "Elevated" :
    risk === "medium" ? "Moderate" :
    riskDirection === "increasing" ? "Moderate" :
    "Minimal";

  const currentImpact =
    risk === "high"
      ? "Current conditions indicate elevated potential for operational sensitivity. Multiple signals are aligned — conditions may affect operational parameters if they persist or intensify."
      : risk === "medium"
      ? "Current conditions indicate moderate potential for operational sensitivity. Conditions may increase awareness requirements during peak demand periods."
      : riskDirection === "increasing"
      ? "Current conditions are stable but trending toward moderate sensitivity. Potential impact remains low at this time — monitor for further development."
      : "Current conditions indicate minimal likelihood of near-term operational disruption. Standard operating parameters are expected to continue.";

  const scenarios: ImpactScenario[] = [];

  if (temp > 0 && temp < 95) {
    scenarios.push({
      condition: `If temperatures exceed ${Math.max(95, Math.ceil(temp / 5) * 5)}°F`,
      impact:    "Demand-related operational sensitivity may increase during afternoon peak hours.",
    });
  }

  if (price > 0 && price < 35) {
    scenarios.push({
      condition: `If ERCOT exceeds $35/MWh`,
      impact:    "Pricing conditions may reflect increased grid stress — monitoring frequency may warrant review.",
    });
  }

  if (supply === "low") {
    scenarios.push({
      condition: "If gas storage declines further below seasonal average",
      impact:    "Supply-side sensitivity may increase, particularly during elevated demand periods.",
    });
  }

  scenarios.push({
    condition: "If multiple signals align simultaneously",
    impact:    "Convergence of demand, supply, and pricing pressure may increase overall operational significance.",
  });

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Potential Impact
        </p>
      </div>

      {/* Current impact */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">Current Impact Level</p>
          <span className={`text-xs font-bold ${impactColor(impactLevel)}`}>{impactLevel}</span>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">{currentImpact}</p>
      </div>

      {/* Conditional scenarios */}
      <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-2">If Conditions Change</p>
      <div className="space-y-2">
        {scenarios.map((s, i) => (
          <div key={i} className="bg-white/3 border border-white/5 rounded-lg p-3">
            <p className="text-[11px] font-semibold text-gray-300 mb-0.5">{s.condition}</p>
            <p className="text-[10px] text-gray-500 leading-relaxed">{s.impact}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mt-3 border-t border-white/5 pt-2">
        Potential impact descriptions are probabilistic and informational only.
        Not financial, procurement, or operational advice.
      </p>
    </div>
  );
}
