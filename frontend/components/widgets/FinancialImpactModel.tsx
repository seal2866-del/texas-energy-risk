"use client";
import { DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface Props {
  riskScore:     string;
  ercotPrice?:   number;
  escalationProbability?: number;
  demandPressure?: { level: string };
  marketReaction?: { level: string };
}

interface Scenario {
  label:       string;
  ercotPrice:  number;
  pctIncrease: number;
  riskLevel:   string;
  color:       string;
  bg:          string;
  narrative:   string;
}

function buildScenarios(basePrice: number, risk: string, escalation: number): Scenario[] {
  const mod   = basePrice > 0 ? basePrice : 25;
  const modPct   = risk === "high" ? 80  : risk === "medium" ? 50  : 30;
  const highPct  = risk === "high" ? 200 : risk === "medium" ? 130 : 80;

  const moderate = Math.round(mod * (1 + modPct / 100));
  const high     = Math.round(mod * (1 + highPct / 100));

  return [
    {
      label:       "Current Conditions",
      ercotPrice:  Math.round(mod),
      pctIncrease: 0,
      riskLevel:   risk === "high" ? "High" : risk === "medium" ? "Moderate" : "Low",
      color:       risk === "high" ? "text-red-400" : risk === "medium" ? "text-amber-400" : "text-green-400",
      bg:          risk === "high" ? "bg-red-500/8 border-red-500/20" : risk === "medium" ? "bg-amber-500/8 border-amber-500/20" : "bg-green-500/5 border-green-500/15",
      narrative:   `ERCOT Houston Hub at $${mod.toFixed(2)}/MWh reflects current market conditions. ${risk === "low" ? "Cost environment is within normal operating parameters." : "Conditions indicate elevated cost sensitivity."}`,
    },
    {
      label:       "Moderate Escalation",
      ercotPrice:  moderate,
      pctIncrease: modPct,
      riskLevel:   "Elevated",
      color:       "text-amber-400",
      bg:          "bg-amber-500/8 border-amber-500/20",
      narrative:   `If demand pressure increases or reserve margins tighten, ERCOT pricing could reach ~$${moderate}/MWh (+${modPct}%). This scenario is ${escalation > 25 ? "moderately likely" : "possible"} based on current signal trajectory.`,
    },
    {
      label:       "High Escalation",
      ercotPrice:  high,
      pctIncrease: highPct,
      riskLevel:   "High",
      color:       "text-red-400",
      bg:          "bg-red-500/8 border-red-500/20",
      narrative:   `Under peak stress conditions (extreme heat + supply constraints), ERCOT pricing could reach ~$${high}/MWh (+${highPct}%). This scenario is ${escalation > 50 ? "elevated probability" : "lower probability"} under current conditions.`,
    },
  ];
}

function facilityImpact(pricePerMWh: number, loadMW: number, hours: number = 24): number {
  return Math.round(pricePerMWh * loadMW * hours);
}

export default function FinancialImpactModel({ riskScore, ercotPrice, escalationProbability = 10, demandPressure, marketReaction }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [facilityMW, setFacilityMW] = useState(5);

  const basePrice = ercotPrice && ercotPrice > 0 ? ercotPrice : 25;
  const scenarios  = buildScenarios(basePrice, riskScore, escalationProbability);

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Financial Impact Model</p>
        <span className="ml-auto text-[10px] text-gray-600">Indicative only — not financial advice</span>
      </div>

      {/* Scenario cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {scenarios.map((s) => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
            <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-2">{s.label}</p>
            <p className={`text-xl font-black mb-0.5 ${s.color}`}>${s.ercotPrice}/MWh</p>
            {s.pctIncrease > 0 && (
              <p className={`text-[10px] font-semibold ${s.color}`}>+{s.pctIncrease}% vs current</p>
            )}
            <p className={`text-[9px] font-bold uppercase mt-1 ${s.color}`}>{s.riskLevel}</p>
          </div>
        ))}
      </div>

      {/* Facility impact calculator */}
      <div className="bg-white/3 border border-white/5 rounded-xl p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-300">Estimated Daily Cost Impact</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">Facility load:</span>
            <select value={facilityMW} onChange={e => setFacilityMW(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-[10px] text-gray-300 focus:outline-none">
              {[0.5, 1, 2, 5, 10, 25, 50].map(mw => (
                <option key={mw} value={mw} className="bg-gray-900">{mw} MW</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {scenarios.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-[9px] text-gray-600 mb-1">{s.label.split(" ")[0]}</p>
              <p className={`text-sm font-black ${s.color}`}>
                ${facilityImpact(s.ercotPrice, facilityMW).toLocaleString()}
              </p>
              <p className="text-[9px] text-gray-600">per day</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-gray-700 mt-2">Based on {facilityMW}MW × $/MWh × 24h. Indicative only — actual costs depend on contract structure.</p>
      </div>

      {/* Expandable narrative */}
      <button onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors mb-2">
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? "Hide scenario details" : "View scenario analysis"}
      </button>

      {expanded && (
        <div className="space-y-2">
          {scenarios.map(s => (
            <div key={s.label} className={`rounded-lg border p-3 ${s.bg}`}>
              <p className={`text-[10px] font-bold mb-1 ${s.color}`}>{s.label}</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">{s.narrative}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
