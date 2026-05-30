"use client";
import { ArrowRight, ArrowUp, ArrowDown } from "lucide-react";

interface Props {
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  gasToPower?:     { level: string };
  riskDirection:   string;
}

interface Relationship {
  from:      string;
  to:        string;
  direction: "up" | "down" | "neutral";
  active:    boolean;
  note:      string;
}

export default function CorrelationEngine({
  demandPressure, supplyPressure, marketReaction, gasToPower, riskDirection,
}: Props) {
  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";
  const market = marketReaction?.level || "low";
  const g2p    = gasToPower?.level     || "low";

  const relationships: Relationship[] = [
    {
      from:      "Temperature ↑",
      to:        "Grid Demand ↑",
      direction: "up",
      active:    demand !== "low",
      note:      "Heat drives cooling load across the Texas grid",
    },
    {
      from:      "Grid Demand ↑",
      to:        "ERCOT Price ↑",
      direction: "up",
      active:    demand !== "low" && market !== "low",
      note:      "Demand pressure reflects in real-time settlement prices",
    },
    {
      from:      "Gas Supply ↓",
      to:        "Generation Cost ↑",
      direction: "down",
      active:    supply !== "low",
      note:      "Storage shortfalls increase fuel cost for gas-fired generation",
    },
    {
      from:      "Generation Cost ↑",
      to:        "ERCOT Price ↑",
      direction: "up",
      active:    g2p !== "low",
      note:      "Higher generation costs flow through to market pricing",
    },
    {
      from:      "ERCOT Price ↑",
      to:        "Operational Exposure ↑",
      direction: "up",
      active:    market !== "low",
      note:      "Elevated pricing increases energy cost sensitivity for operations",
    },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
        Current Signal Relationships
      </p>
      <p className="text-[10px] text-gray-600 mb-4">
        How monitored conditions relate to each other right now
      </p>

      <div className="space-y-2">
        {relationships.map((r, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
              r.active
                ? "bg-amber-500/5 border-amber-500/15"
                : "bg-white/2 border-white/5"
            }`}
          >
            {/* Direction indicator */}
            <div className={`flex-shrink-0 mt-0.5 ${r.active ? "text-amber-400" : "text-gray-600"}`}>
              {r.direction === "up"   && <ArrowUp   className="w-3.5 h-3.5" />}
              {r.direction === "down" && <ArrowDown  className="w-3.5 h-3.5" />}
            </div>

            {/* Relationship */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-xs font-semibold ${r.active ? "text-gray-200" : "text-gray-500"}`}>
                  {r.from}
                </span>
                <ArrowRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
                <span className={`text-xs font-semibold ${r.active ? "text-amber-300" : "text-gray-500"}`}>
                  {r.to}
                </span>
              </div>
              <p className={`text-[10px] leading-snug ${r.active ? "text-gray-400" : "text-gray-600"}`}>
                {r.note}
              </p>
            </div>

            {/* Active indicator */}
            <div className={`flex-shrink-0 text-[9px] font-bold uppercase ${r.active ? "text-amber-400" : "text-gray-700"}`}>
              {r.active ? "ACTIVE" : "INACTIVE"}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mt-3">
        Active relationships reflect currently elevated signal conditions.
      </p>
    </div>
  );
}
