"use client";
import { TrendingUp } from "lucide-react";

interface Props {
  riskScore: string;
  ercotPrice?: number;
  temperature?: number;
  henryHub?: number;
}

interface Scenario {
  condition: string;
  detail: string;
  result: string;
  resultColor: string;
  probability: string;
}

export default function ScenarioAnalysis({ riskScore, ercotPrice, temperature, henryHub }: Props) {
  const price = ercotPrice ?? 0;
  const temp  = temperature ?? 0;
  const hh    = henryHub ?? 0;

  const scenarios: Scenario[] = [
    {
      condition:   "Temperature exceeds 98°F",
      detail:      `Current: ${temp > 0 ? temp.toFixed(0) + "°F" : "N/A"} — needs +${Math.max(0, 98 - temp).toFixed(0)}°F`,
      result:      "MEDIUM RISK",
      resultColor: "text-amber-400",
      probability: temp >= 90 ? "Elevated" : "Low",
    },
    {
      condition:   "ERCOT exceeds $50/MWh",
      detail:      `Current: ${price > 0 ? "$" + price.toFixed(2) : "N/A"} — needs +$${Math.max(0, 50 - price).toFixed(2)}`,
      result:      "HIGH RISK",
      resultColor: "text-red-400",
      probability: price >= 35 ? "Elevated" : "Low",
    },
    {
      condition:   "Henry Hub exceeds $4.00/MMBtu",
      detail:      `Current: ${hh > 0 ? "$" + hh.toFixed(2) : "N/A"} — needs +$${Math.max(0, 4.0 - hh).toFixed(2)}`,
      result:      "MEDIUM RISK",
      resultColor: "text-amber-400",
      probability: hh >= 3.0 ? "Elevated" : "Low",
    },
    {
      condition:   "Temperature + ERCOT both elevated",
      detail:      "Heat-driven demand compounds pricing pressure simultaneously",
      result:      "HIGH RISK",
      resultColor: "text-red-400",
      probability: temp >= 90 && price >= 30 ? "Moderate" : "Low",
    },
    {
      condition:   "Gas storage drops 10%+ below avg",
      detail:      "Supply buffer reduction during peak demand period",
      result:      "MEDIUM RISK",
      resultColor: "text-amber-400",
      probability: "Low",
    },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          What Could Change This?
        </p>
        <span className="ml-auto text-[10px] text-gray-600 uppercase tracking-wide">Scenario Analysis</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {scenarios.map((s, i) => (
          <div key={i} className="bg-white/3 border border-white/5 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-200 mb-1">{s.condition}</p>
            <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">{s.detail}</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-gray-600 uppercase tracking-wide">Expected Result</p>
                <p className={`text-xs font-black ${s.resultColor}`}>{s.result}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-gray-600 uppercase tracking-wide">Probability</p>
                <p className={`text-xs font-semibold ${
                  s.probability === "Elevated" ? "text-amber-400" :
                  s.probability === "Moderate" ? "text-amber-300" :
                  "text-gray-400"
                }`}>{s.probability}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mt-3">
        Probabilistic scenarios only. Not a market forecast or financial projection.
      </p>
    </div>
  );
}
