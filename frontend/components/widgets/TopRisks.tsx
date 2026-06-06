"use client";
import { Flame } from "lucide-react";

interface Props {
  demandPressure?:  { level: string; explanation?: string };
  supplyPressure?:  { level: string; explanation?: string };
  marketReaction?:  { level: string; explanation?: string };
  gasToPower?:      { level: string; explanation?: string };
  ercotPrice?:      number;
  temperature?:     number;
  henryHub?:        number;
}

interface RiskItem {
  name:    string;
  impact:  string;
  score:   number;
  detail:  string;
  color:   string;
}

function levelScore(level: string): number {
  if (level === "high")   return 3;
  if (level === "medium") return 2;
  return 1;
}

function impactLabel(score: number): { label: string; color: string } {
  if (score >= 3) return { label: "High",   color: "text-red-400" };
  if (score >= 2) return { label: "Medium", color: "text-amber-400" };
  return            { label: "Low",    color: "text-green-400" };
}

export default function TopRisks({
  demandPressure, supplyPressure, marketReaction, gasToPower,
  ercotPrice, temperature, henryHub,
}: Props) {
  const temp  = temperature ?? 0;
  const price = ercotPrice  ?? 0;
  const hh    = henryHub    ?? 0;

  // Score each risk source
  const items: RiskItem[] = [
    {
      name:   "Temperature Forecast",
      score:  levelScore(demandPressure?.level || "low") + (temp >= 90 ? 1 : 0),
      detail: temp > 0 ? `${temp.toFixed(0)}°F current — watch threshold 100°F` : "No temperature data",
      impact: "", color: "",
    },
    {
      name:   "ERCOT Price Volatility",
      score:  levelScore(marketReaction?.level || "low") + (price >= 30 ? 1 : 0),
      detail: price > 0 ? `$${price.toFixed(2)}/MWh — watch threshold $35` : "No price data",
      impact: "", color: "",
    },
    {
      name:   "Gas Supply Pressure",
      score:  levelScore(supplyPressure?.level || "low") + (hh >= 2.8 ? 1 : 0),
      detail: hh > 0 ? `Henry Hub $${hh.toFixed(2)}/MMBtu — watch $4.00` : "Storage near seasonal avg",
      impact: "", color: "",
    },
    {
      name:   "Gas-to-Power Cost",
      score:  levelScore(gasToPower?.level || "low"),
      detail: "Generation cost sensitivity from gas pricing",
      impact: "", color: "",
    },
    {
      name:   "Demand Pressure",
      score:  levelScore(demandPressure?.level || "low"),
      detail: demandPressure?.explanation || "Grid load within normal operating range",
      impact: "", color: "",
    },
  ].map(item => {
    const { label, color } = impactLabel(item.score);
    return { ...item, impact: label, color };
  }).sort((a, b) => b.score - a.score);

  const top3 = items.slice(0, 3);

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-orange-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Top Risks Right Now
        </p>
      </div>

      <div className="space-y-3">
        {top3.map((item, i) => (
          <div key={item.name} className="flex items-start gap-3">
            {/* Rank */}
            <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-black text-gray-400">#{i + 1}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-semibold text-gray-200">{item.name}</span>
                <span className={`text-[10px] font-bold uppercase ${item.color} flex-shrink-0 ml-2`}>
                  {item.impact}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
