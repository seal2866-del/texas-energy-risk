"use client";
import { BarChart2 } from "lucide-react";

interface Props {
  demandPressure?:  { level: string };
  supplyPressure?:  { level: string };
  marketReaction?:  { level: string };
  gasToPower?:      { level: string };
  activeSignals?:   number;
}

interface Contributor {
  label:  string;
  pct:    number;
  color:  string;
}

function levelWeight(level: string): number {
  if (level === "high")   return 3;
  if (level === "medium") return 2;
  return 1;
}

export default function SignalContributors({
  demandPressure, supplyPressure, marketReaction, gasToPower,
}: Props) {
  const weights = {
    weather: levelWeight(demandPressure?.level || "low"),
    ercot:   levelWeight(marketReaction?.level  || "low"),
    gas:     levelWeight(supplyPressure?.level  || "low"),
    g2p:     levelWeight(gasToPower?.level      || "low"),
    other:   1,
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  const contributors: Contributor[] = [
    { label: "Weather Demand",     pct: Math.round((weights.weather / total) * 100), color: "bg-amber-500" },
    { label: "ERCOT Pricing",      pct: Math.round((weights.ercot   / total) * 100), color: "bg-orange-500" },
    { label: "Gas Supply",         pct: Math.round((weights.gas     / total) * 100), color: "bg-blue-500" },
    { label: "Gas-to-Power Cost",  pct: Math.round((weights.g2p     / total) * 100), color: "bg-purple-500" },
    { label: "Other Signals",      pct: Math.round((weights.other   / total) * 100), color: "bg-gray-500" },
  ].sort((a, b) => b.pct - a.pct);

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Risk Contributors</p>
      </div>

      <div className="space-y-3">
        {contributors.map((c) => (
          <div key={c.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-300">{c.label}</span>
              <span className="text-xs font-bold text-gray-400">+{c.pct}%</span>
            </div>
            <div className="h-2 bg-white/8 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-600 mt-3">Signal weight distribution across monitored drivers.</p>
    </div>
  );
}
