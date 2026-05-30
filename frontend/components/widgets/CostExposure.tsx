"use client";
import { useState } from "react";
import { DollarSign, ChevronDown, ChevronUp, Info } from "lucide-react";

interface Props {
  riskScore: string;
  ercotPrice?: number;
  marketReaction?: { level: string };
}

interface Scenario {
  threshold: string;
  label: string;
  exposure: string;
  action: string;
  color: string;
}

export default function CostExposure({ riskScore, ercotPrice, marketReaction }: Props) {
  const [showInput, setShowInput] = useState(false);
  const [facilityMW, setFacilityMW] = useState("");

  const price   = ercotPrice ?? 0;
  const market  = marketReaction?.level ?? "low";

  const currentExposure =
    riskScore === "high"   ? "Elevated" :
    riskScore === "medium" ? "Moderate" :
    market    === "medium" ? "Low-Moderate" :
                             "Minimal";

  const exposureColor =
    currentExposure === "Elevated"     ? "text-red-400" :
    currentExposure === "Moderate"     ? "text-amber-400" :
    currentExposure === "Low-Moderate" ? "text-amber-300" :
                                         "text-green-400";

  const scenarios: Scenario[] = [
    {
      threshold: `If ERCOT exceeds $35/MWh`,
      label:     "Watch",
      exposure:  "Potential cost sensitivity may increase modestly during peak hours.",
      action:    "Monitor",
      color:     "text-amber-400",
    },
    {
      threshold: `If ERCOT exceeds $50/MWh`,
      label:     "Elevated",
      exposure:  "Operational cost exposure may become elevated during peak demand periods.",
      action:    "Review",
      color:     "text-amber-500",
    },
    {
      threshold: `If ERCOT exceeds $100/MWh`,
      label:     "High",
      exposure:  "High volatility exposure may require immediate operational review.",
      action:    "Escalate",
      color:     "text-red-400",
    },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-gray-400" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            Estimated Cost Exposure
          </p>
          <p className="text-xs text-gray-400">Indicative only — not financial advice</p>
        </div>
      </div>

      {/* Current exposure */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-white/3 border border-white/5">
        <span className="text-xs text-gray-400">Current Exposure</span>
        <span className={`text-sm font-bold ${exposureColor}`}>{currentExposure}</span>
      </div>

      {/* Current price context */}
      {price > 0 && (
        <p className="text-xs text-gray-400 mb-4">
          ERCOT Houston Hub currently at <span className="text-white font-semibold">${price.toFixed(2)}/MWh</span>.
          {price < 35
            ? " Pricing is within normal operating range — no immediate cost sensitivity detected."
            : price < 50
            ? " Pricing is approaching elevated thresholds — monitor closely."
            : " Pricing is above watch threshold — operational cost review recommended."}
        </p>
      )}

      {/* Scenario table */}
      <div className="space-y-2 mb-4">
        {scenarios.map((s) => (
          <div key={s.threshold} className="p-3 rounded-lg bg-white/3 border border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-300">{s.threshold}</span>
              <span className={`text-[10px] font-bold uppercase ${s.color}`}>{s.label}</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">{s.exposure}</p>
            <p className={`text-[10px] font-semibold mt-1 ${s.color}`}>Action: {s.action}</p>
          </div>
        ))}
      </div>

      {/* Load profile input */}
      <div className="border-t border-white/5 pt-4">
        <button
          onClick={() => setShowInput(!showInput)}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors w-full"
        >
          {showInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Add facility load profile for precise exposure calculation
        </button>

        {showInput && (
          <div className="mt-3 space-y-3">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15">
              <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-300/80">
                Facility-specific cost impact requires customer load profile input. Enter your facility details below to enable precise exposure calculations.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Facility Load (MW)</label>
                <input
                  type="number"
                  value={facilityMW}
                  onChange={e => setFacilityMW(e.target.value)}
                  placeholder="e.g. 5.0"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Contract Type</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500/40">
                  <option value="" className="bg-gray-900">Select...</option>
                  <option value="spot" className="bg-gray-900">Spot / Index</option>
                  <option value="fixed" className="bg-gray-900">Fixed Price</option>
                  <option value="hybrid" className="bg-gray-900">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Peak Window</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500/40">
                  <option value="" className="bg-gray-900">Select...</option>
                  <option value="1400-1900" className="bg-gray-900">14:00–19:00 CDT</option>
                  <option value="0700-2200" className="bg-gray-900">07:00–22:00 CDT</option>
                  <option value="all" className="bg-gray-900">24/7</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Alert Threshold</label>
                <input
                  type="number"
                  placeholder="$/MWh e.g. 50"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40"
                />
              </div>
            </div>
            <button className="w-full py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs text-blue-300 font-semibold transition-all">
              Calculate Exposure — Coming Soon
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
