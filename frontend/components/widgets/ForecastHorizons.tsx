"use client";
import { useState } from "react";
import { Clock } from "lucide-react";

interface Props {
  riskScore:    string;
  riskDirection: string;
  snapshots?:   { risk_score?: string; risk_score_numeric?: number; computed_at?: string }[];
  timeHorizons?: Record<string, string>;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  ercotPrice?:  number;
  temperature?: number;
}

type Tab = "24h" | "72h" | "7d" | "14d";

interface HorizonForecast {
  riskLevel:       string;
  confidence:      number;
  primaryDriver:   string;
  marketState:     string;
  operationalImpact: string;
  riskColor:       string;
}

function project(risk: string, direction: string, hoursAhead: number): string {
  if (risk === "high") return "high";
  if (risk === "medium") {
    if (direction === "increasing" && hoursAhead >= 72) return "high";
    if (direction === "decreasing" && hoursAhead >= 48) return "low";
    return "medium";
  }
  if (direction === "increasing") {
    if (hoursAhead >= 168) return "medium";
    if (hoursAhead >= 72)  return hoursAhead >= 120 ? "medium" : "low";
  }
  return "low";
}

function riskColor(level: string): string {
  if (level === "high")   return "text-red-400";
  if (level === "medium") return "text-amber-400";
  return "text-green-400";
}

function buildHorizon(risk: string, direction: string, hoursAhead: number, demandLevel: string, supplyLevel: string, temp: number): HorizonForecast {
  const projRisk = project(risk, direction, hoursAhead);
  const rising   = direction === "increasing";

  const confidence = Math.max(40, 90 - Math.floor(hoursAhead / 24) * 8);

  let primaryDriver = "Market conditions";
  if (demandLevel === "high" || demandLevel === "medium") primaryDriver = "Weather-driven demand pressure";
  else if (supplyLevel === "high" || supplyLevel === "medium") primaryDriver = "Natural gas supply tightness";
  else if (rising) primaryDriver = "Rising risk trajectory";

  const marketState = projRisk === "high" ? "Stressed" : projRisk === "medium" ? "Elevated" : "Stable";

  const impact = projRisk === "high"
    ? "Elevated operational exposure expected. Contingency review may be warranted."
    : projRisk === "medium"
    ? "Moderate cost sensitivity likely. Enhanced monitoring recommended during peak hours."
    : "Minimal operational impact expected. Standard monitoring applies.";

  return { riskLevel: projRisk, confidence, primaryDriver, marketState, operationalImpact: impact, riskColor: riskColor(projRisk) };
}

const TABS: { id: Tab; label: string; hours: number }[] = [
  { id: "24h",  label: "24 Hours",  hours: 24 },
  { id: "72h",  label: "72 Hours",  hours: 72 },
  { id: "7d",   label: "7 Days",    hours: 168 },
  { id: "14d",  label: "14 Days",   hours: 336 },
];

export default function ForecastHorizons({ riskScore, riskDirection, demandPressure, supplyPressure, temperature }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("24h");
  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";
  const temp   = temperature ?? 0;

  const tab     = TABS.find(t => t.id === activeTab)!;
  const horizon = buildHorizon(riskScore, riskDirection, tab.hours, demand, supply, temp);

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Forecast Horizons</p>
        <span className="ml-auto text-[10px] text-gray-600">Probabilistic — not a market forecast</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-white/5 border border-white/8 rounded-xl mb-4 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === t.id ? "bg-white/12 text-white border border-white/15" : "text-gray-400 hover:text-gray-200"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Horizon card */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {[
          { label: "Risk Level",      value: horizon.riskLevel.charAt(0).toUpperCase() + horizon.riskLevel.slice(1), color: horizon.riskColor },
          { label: "Confidence",      value: `${horizon.confidence}%`,    color: horizon.confidence >= 75 ? "text-green-400" : horizon.confidence >= 55 ? "text-amber-400" : "text-gray-400" },
          { label: "Primary Driver",  value: horizon.primaryDriver,        color: "text-gray-200" },
          { label: "Market State",    value: horizon.marketState,          color: horizon.riskColor },
          { label: "Time Horizon",    value: tab.label,                    color: "text-blue-400" },
          { label: "Trend",           value: riskDirection === "increasing" ? "Rising" : riskDirection === "decreasing" ? "Falling" : "Stable", color: riskDirection === "increasing" ? "text-amber-400" : riskDirection === "decreasing" ? "text-green-400" : "text-gray-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-3">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-xs font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className={`p-3 rounded-xl border ${horizon.riskColor === "text-red-400" ? "bg-red-500/5 border-red-500/15" : horizon.riskColor === "text-amber-400" ? "bg-amber-500/5 border-amber-500/15" : "bg-green-500/3 border-green-500/10"}`}>
        <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Operational Impact — {tab.label} Outlook</p>
        <p className="text-xs text-gray-300 leading-relaxed">{horizon.operationalImpact}</p>
      </div>

      <p className="text-[10px] text-gray-700 mt-3 border-t border-white/5 pt-2">
        Confidence decreases with forecast distance. 14-day forecasts are directional only.
      </p>
    </div>
  );
}
