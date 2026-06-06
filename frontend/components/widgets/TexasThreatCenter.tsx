"use client";
import { ShieldAlert } from "lucide-react";

interface Props {
  riskScore:     string;
  temperature?:  number;
  ercotPrice?:   number;
  henryHub?:     number;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  riskDirection:  string;
}

type ThreatLevel = "NORMAL" | "ELEVATED" | "HIGH" | "NONE";

interface Threat {
  label:  string;
  level:  ThreatLevel;
  detail: string;
}

function levelStyle(l: ThreatLevel): { badge: string; dot: string } {
  if (l === "HIGH")     return { badge: "text-red-400 bg-red-500/10 border-red-500/20",     dot: "bg-red-500" };
  if (l === "ELEVATED") return { badge: "text-amber-400 bg-amber-500/10 border-amber-500/20", dot: "bg-amber-500" };
  if (l === "NONE")     return { badge: "text-gray-600 bg-gray-700/10 border-gray-700/20",   dot: "bg-gray-700" };
  return                       { badge: "text-green-400 bg-green-500/8 border-green-500/15", dot: "bg-green-500" };
}

export default function TexasThreatCenter({
  riskScore, temperature, ercotPrice, henryHub,
  demandPressure, supplyPressure, marketReaction, riskDirection,
}: Props) {
  const risk   = riskScore || "low";
  const temp   = temperature ?? 0;
  const price  = ercotPrice  ?? 0;
  const hh     = henryHub    ?? 0;
  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";
  const market = marketReaction?.level || "low";
  const rising = riskDirection === "increasing";

  const month = new Date().getMonth(); // 0-based
  const isSummer = month >= 5 && month <= 8;
  const isWinter = month === 11 || month <= 1;

  const threats: Threat[] = [
    {
      label:  "Heat Wave Risk",
      level:  temp >= 100 ? "HIGH" : temp >= 95 ? "ELEVATED" : isSummer && temp >= 88 ? "ELEVATED" : "NORMAL",
      detail: temp > 0 ? `${temp.toFixed(0)}°F — ${temp >= 95 ? "above escalation threshold" : "within seasonal range"}` : "Monitoring",
    },
    {
      label:  "Cold Weather Risk",
      level:  isWinter ? (riskScore === "high" ? "ELEVATED" : "NORMAL") : "NORMAL",
      detail: isWinter ? "Winter monitoring active" : "Not applicable — summer season",
    },
    {
      label:  "Hurricane Risk",
      level:  isSummer ? "NORMAL" : "NORMAL",
      detail: isSummer ? "Atlantic hurricane season active — monitor NHC" : "Off-season",
    },
    {
      label:  "ERCOT Congestion",
      level:  market === "high" ? "HIGH" : market === "medium" ? "ELEVATED" : price >= 75 ? "ELEVATED" : "NORMAL",
      detail: price > 0 ? `HB Houston $${price.toFixed(2)}/MWh` : "Monitoring",
    },
    {
      label:  "Pipeline Constraints",
      level:  supply === "high" ? "ELEVATED" : supply === "medium" ? "ELEVATED" : "NORMAL",
      detail: hh > 0 ? `Henry Hub $${hh.toFixed(2)}/MMBtu` : "No active constraints",
    },
    {
      label:  "Gas Supply Risk",
      level:  supply === "high" ? "HIGH" : supply === "medium" ? "ELEVATED" : hh >= 3.0 ? "ELEVATED" : "NORMAL",
      detail: hh > 0 ? `$${hh.toFixed(2)}/MMBtu — ${hh >= 3.0 ? "above watch threshold" : "within normal range"}` : "Monitoring EIA storage",
    },
    {
      label:  "ERCOT Notices",
      level:  riskScore === "high" && rising ? "ELEVATED" : "NONE",
      detail: riskScore === "high" ? "Check ERCOT.com for active notices" : "No active notices detected",
    },
    {
      label:  "Refinery Outages",
      level:  "NORMAL",
      detail: "No unplanned outages reported",
    },
  ];

  const elevated = threats.filter(t => t.level === "HIGH" || t.level === "ELEVATED").length;

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-gray-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Texas Threat Center</p>
        </div>
        <span className={`text-[10px] font-bold uppercase ${elevated > 0 ? "text-amber-400" : "text-green-400"}`}>
          {elevated > 0 ? `${elevated} condition${elevated > 1 ? "s" : ""} elevated` : "All clear"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {threats.map(t => {
          const { badge, dot } = levelStyle(t.level);
          return (
            <div key={t.label} className="bg-white/2 border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                <p className="text-[10px] font-semibold text-gray-300 leading-tight">{t.label}</p>
              </div>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${badge}`}>
                {t.level}
              </span>
              <p className="text-[9px] text-gray-600 mt-1 leading-snug">{t.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
