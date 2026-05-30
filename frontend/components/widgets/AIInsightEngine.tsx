"use client";
import { Sparkles } from "lucide-react";

interface Props {
  riskScore:    string;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  gasToPower?:     { level: string };
  ercotPrice?:     number;
  temperature?:    number;
  henryHub?:       number;
  riskDirection:   string;
  activeSignals?:  number;
  computedAt?:     string;
}

interface Insight {
  text: string;
  type: "positive" | "neutral" | "warning";
}

function driverContribution(demand: string, supply: string, market: string, g2p: string): string {
  const scores = {
    weather: demand === "high" ? 3 : demand === "medium" ? 2 : 1,
    ercot:   market === "high" ? 3 : market === "medium" ? 2 : 1,
    gas:     supply === "high" ? 3 : supply === "medium" ? 2 : 1,
    g2p:     g2p    === "high" ? 3 : g2p    === "medium" ? 2 : 1,
  };
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const weatherPct = Math.round((scores.weather / total) * 100);
  const ercotPct   = Math.round((scores.ercot / total) * 100);
  const gasPct     = Math.round((scores.gas / total) * 100);
  return `Weather is contributing ~${weatherPct}% of current risk score. ERCOT accounts for ~${ercotPct}%. Gas supply contributes ~${gasPct}%.`;
}

export default function AIInsightEngine({
  riskScore, demandPressure, supplyPressure, marketReaction, gasToPower,
  ercotPrice, temperature, henryHub, riskDirection, activeSignals = 0, computedAt,
}: Props) {
  const risk   = riskScore || "low";
  const demand = demandPressure?.level  || "low";
  const supply = supplyPressure?.level  || "low";
  const market = marketReaction?.level  || "low";
  const g2p    = gasToPower?.level      || "low";
  const price  = ercotPrice  ?? 0;
  const temp   = temperature ?? 0;
  const hh     = henryHub    ?? 0;
  const rising = riskDirection === "increasing";
  const falling = riskDirection === "decreasing";

  const insights: Insight[] = [];

  // Driver contribution
  insights.push({ text: driverContribution(demand, supply, market, g2p), type: "neutral" });

  // ERCOT observation
  if (market === "low") {
    insights.push({ text: `ERCOT remains stable at $${price > 0 ? price.toFixed(2) : "N/A"}/MWh — no market-driven pressure detected.`, type: "positive" });
  } else {
    insights.push({ text: `ERCOT pricing at $${price.toFixed(2)}/MWh is showing sensitivity — watch for further movement during peak hours.`, type: "warning" });
  }

  // Gas observation
  if (supply === "low") {
    insights.push({ text: "Gas storage conditions are reducing overall risk — adequate supply buffer supports current generation demand.", type: "positive" });
  } else {
    insights.push({ text: `Gas storage is ${supply === "high" ? "critically" : "moderately"} below seasonal average — generation cost sensitivity is elevated.`, type: "warning" });
  }

  // Escalation signals
  if (activeSignals === 0) {
    insights.push({ text: "No escalation signals currently detected. All monitored thresholds remain below watch levels.", type: "positive" });
  } else {
    insights.push({ text: `${activeSignals} escalation signal${activeSignals > 1 ? "s" : ""} active — review risk drivers for operational impact.`, type: "warning" });
  }

  // Trend observation
  if (rising) {
    insights.push({ text: "Risk is trending higher — conditions may deteriorate if current drivers persist into the peak demand window.", type: "warning" });
  } else if (falling) {
    insights.push({ text: "Risk is trending lower — current trajectory suggests easing conditions over the next 6–12 hours.", type: "positive" });
  }

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          AI Observation
        </p>
        <span className="ml-auto text-[10px] text-gray-600 uppercase tracking-wide">
          Rule-based synthesis
        </span>
      </div>

      <div className="space-y-2.5">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
              insight.type === "positive" ? "bg-green-400" :
              insight.type === "warning"  ? "bg-amber-400" :
                                            "bg-blue-400"
            }`} />
            <p className="text-xs text-gray-300 leading-relaxed">{insight.text}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mt-3 border-t border-white/5 pt-2">
        Rule-based synthesis from live signal data. Not AI-generated. Not financial advice.
      </p>
    </div>
  );
}
