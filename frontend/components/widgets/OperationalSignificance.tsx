"use client";
import { Info } from "lucide-react";

interface Props {
  riskScore:       string;
  riskDirection:   string;
  ercotPrice?:     number;
  temperature?:    number;
  henryHub?:       number;
  demandPressure?: { level: string; explanation?: string };
  supplyPressure?: { level: string; explanation?: string };
  marketReaction?: { level: string; explanation?: string };
}

interface SignificanceItem {
  signal:      string;
  significance: string;
  priority:    "Normal" | "Watching" | "Elevated";
}

function priorityColor(p: string) {
  if (p === "Elevated") return "text-red-400";
  if (p === "Watching") return "text-amber-400";
  return "text-green-400";
}

export default function OperationalSignificance({
  riskScore, riskDirection, ercotPrice, temperature, henryHub,
  demandPressure, supplyPressure, marketReaction,
}: Props) {
  const price  = ercotPrice  ?? 0;
  const temp   = temperature ?? 0;
  const hh     = henryHub    ?? 0;
  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";
  const market = marketReaction?.level || "low";

  const items: SignificanceItem[] = [
    {
      signal: "Temperature Conditions",
      significance:
        temp >= 100
          ? `Forecast temperatures of ${temp.toFixed(0)}°F exceed the watch threshold. Afternoon cooling demand may increase above normal operating ranges.`
          : temp >= 88
          ? `Forecast temperatures of ${temp.toFixed(0)}°F may increase afternoon cooling demand but currently remain below escalation thresholds.`
          : "Temperature forecast remains within normal seasonal ranges and does not currently indicate elevated demand pressure.",
      priority: temp >= 100 ? "Elevated" : temp >= 92 ? "Watching" : "Normal",
    },
    {
      signal: "ERCOT Pricing",
      significance:
        price >= 75
          ? `ERCOT Houston Hub at $${price.toFixed(2)}/MWh is above the watch threshold. Pricing reflects elevated grid conditions.`
          : price >= 60
          ? `ERCOT at $${price.toFixed(2)}/MWh is approaching the watch threshold. Monitoring during peak demand hours is appropriate.`
          : `ERCOT at $${price.toFixed(2)}/MWh remains within normal operating range. No current indication of elevated market stress.`,
      priority: price >= 75 ? "Elevated" : price >= 60 ? "Watching" : "Normal",
    },
    {
      signal: "Natural Gas Supply",
      significance:
        supply === "high"
          ? "Gas supply conditions are below seasonal averages. Elevated supply-side sensitivity may be present during demand peaks."
          : supply === "medium"
          ? "Gas supply conditions are moderately below seasonal ranges and do not currently indicate material supply-side pressure."
          : "Gas supply conditions remain within expected operating ranges and do not currently indicate elevated supply-side pressure.",
      priority: supply === "high" ? "Elevated" : supply === "medium" ? "Watching" : "Normal",
    },
    {
      signal: "Demand Pressure",
      significance:
        demand === "high"
          ? "Weather-driven demand pressure is elevated. Grid load may approach peak capacity during afternoon hours."
          : demand === "medium"
          ? "Demand pressure is moderately elevated. Afternoon demand window (14:00–19:00 CDT) may warrant monitoring."
          : "Demand conditions are within normal seasonal operating parameters. No elevated grid load pressure detected.",
      priority: demand === "high" ? "Elevated" : demand === "medium" ? "Watching" : "Normal",
    },
  ];

  const overallSignificance =
    riskScore === "high"   ? "Elevated — multiple signals indicate heightened operational significance" :
    riskScore === "medium" ? "Moderate — conditions warrant increased monitoring awareness" :
    riskDirection === "increasing" ? "Low — trending toward elevated monitoring priority" :
                             "Low — conditions within normal operating parameters";

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-4 h-4 text-blue-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Operational Significance
        </p>
        <span className="ml-auto text-[10px] text-gray-600 uppercase tracking-wide">
          Context only — not advice
        </span>
      </div>

      {/* Overall significance */}
      <div className="bg-white/3 border border-white/5 rounded-xl p-3 mb-4">
        <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Overall Significance</p>
        <p className="text-xs font-semibold text-gray-200">{overallSignificance}</p>
      </div>

      {/* Signal breakdown */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.signal} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-gray-300">{item.signal}</p>
              <span className={`text-[10px] font-bold uppercase ${priorityColor(item.priority)}`}>
                {item.priority}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">{item.significance}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mt-3 border-t border-white/5 pt-3">
        Operational significance describes conditions only. Not financial, procurement, or operational advice.
      </p>
    </div>
  );
}
