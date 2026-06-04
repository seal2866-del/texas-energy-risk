"use client";
import { FileText, RefreshCw, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface Props {
  riskScore:      string;
  riskDirection:  string;
  primaryDriver?: string;
  ercotPrice?:    number;
  temperature?:   number;
  henryHub?:      number;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  computedAt?:    string;
}

function generateBrief(props: Props): {
  currentRisk: string; primaryDriver: string; keyObservation: string;
  recommendedFocus: string; outlook: string; priorityLevel: string; priorityColor: string;
} {
  const { riskScore, riskDirection, primaryDriver, ercotPrice, temperature, henryHub, demandPressure, supplyPressure } = props;
  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";
  const price  = ercotPrice ?? 0;
  const temp   = temperature ?? 0;
  const hh     = henryHub   ?? 0;
  const rising = riskDirection === "increasing";

  const riskLabel = riskScore === "high" ? "High" : riskScore === "medium" ? "Moderate" : "Low";

  const driverMap: Record<string, string> = {
    weather_demand:   "weather-driven demand pressure",
    price_volatility: "ERCOT pricing volatility",
    gas_supply:       "natural gas supply conditions",
  };
  const driverStr = driverMap[primaryDriver || ""] || "market conditions";

  const priorityLevel = riskScore === "high" ? "High" : riskScore === "medium" || rising ? "Elevated" : "Normal";
  const priorityColor = priorityLevel === "High" ? "text-red-400" : priorityLevel === "Elevated" ? "text-amber-400" : "text-green-400";

  let keyObservation = "";
  if (demand === "high" || demand === "medium") {
    keyObservation = `Temperatures of ${temp > 0 ? temp.toFixed(0) + "°F" : "above normal"} are driving elevated cooling demand across the Texas grid.`;
  } else if (supply === "high" || supply === "medium") {
    keyObservation = `Natural gas supply conditions${hh > 0 ? ` (Henry Hub $${hh.toFixed(2)}/MMBtu)` : ""} indicate reduced supply buffer — monitoring warranted.`;
  } else if (price >= 35) {
    keyObservation = `ERCOT pricing at $${price.toFixed(2)}/MWh has exceeded watch thresholds — conditions may warrant increased operational awareness.`;
  } else {
    keyObservation = `All monitored signals remain within normal operating ranges. Reserve margins are stable and no escalation conditions are active.`;
  }

  let recommendedFocus = "";
  if (riskScore === "high") {
    recommendedFocus = "Review operational exposure and confirm contingency protocols. Increase monitoring frequency.";
  } else if (riskScore === "medium") {
    recommendedFocus = `Monitor ERCOT pricing during the 14:00–19:00 CDT afternoon peak window.${demand !== "low" ? " Track temperature forecasts." : ""}`;
  } else {
    recommendedFocus = "Continue standard monitoring cadence. Reassess during the afternoon peak window (14:00–19:00 CDT).";
  }

  const outlook = riskScore === "high"
    ? "Elevated conditions expected to persist through the next 24 hours. Conditions may warrant continued management attention."
    : riskScore === "medium"
    ? `Risk expected to remain ${rising ? "elevated or increase" : "moderate"} for the next 24 hours based on current signal trajectory.`
    : rising
    ? "Risk is trending upward — conditions may become elevated within the next 6–24 hours if current drivers persist."
    : "Risk expected to remain low for the next 24 hours. Standard monitoring applies.";

  return { currentRisk: riskLabel, primaryDriver: driverStr, keyObservation, recommendedFocus, outlook, priorityLevel, priorityColor };
}

export default function DailyExecutiveBrief(props: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [brief, setBrief]           = useState(() => generateBrief(props));

  useEffect(() => { setBrief(generateBrief(props)); }, [props.riskScore, props.computedAt]);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => { setBrief(generateBrief(props)); setRefreshing(false); }, 600);
  };

  const timeStr = props.computedAt
    ? new Date(props.computedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Chicago" }) + " CDT"
    : "Just now";

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Daily Executive Brief</p>
            <p className="text-[10px] text-gray-600">AI-generated · {timeStr} · Informational only</p>
          </div>
        </div>
        <button onClick={refresh} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-gray-400" />}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {[
          { label: "Current Risk",        value: brief.currentRisk,    color: brief.currentRisk === "High" ? "text-red-400" : brief.currentRisk === "Moderate" ? "text-amber-400" : "text-green-400" },
          { label: "Primary Driver",      value: brief.primaryDriver,  color: "text-gray-200" },
          { label: "Priority Level",      value: brief.priorityLevel,  color: brief.priorityColor },
          { label: "Assessment Window",   value: "Next 24 Hours",      color: "text-gray-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-3">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-xs font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {[
          { label: "Key Observation",     text: brief.keyObservation },
          { label: "Recommended Focus",   text: brief.recommendedFocus },
          { label: "24-Hour Outlook",     text: brief.outlook },
        ].map(({ label, text }) => (
          <div key={label} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-xs text-gray-300 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-700 mt-3 border-t border-white/5 pt-2">
        Operational intelligence only. Not financial, trading, or procurement advice.
      </p>
    </div>
  );
}
