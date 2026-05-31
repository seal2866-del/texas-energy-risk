"use client";
import { DollarSign, Zap, Flame, Thermometer, AlertTriangle, Info } from "lucide-react";

// ── Facility profiles ─────────────────────────────────────────────────────────
// Each profile defines base power load (MW), gas intensity factor, and labels.
// Costs are estimates only — informational, not financial advice.

const FACILITIES = [
  {
    id:          "small",
    label:       "Small Facility",
    example:     "Office / Light Industrial",
    load_mw:     0.5,       // MW average load
    gas_factor:  0.08,      // fraction of cost from gas exposure
    icon:        "🏭",
  },
  {
    id:          "midstream",
    label:       "Midstream Site",
    example:     "Compressor / Pipeline Station",
    load_mw:     3.0,
    gas_factor:  0.35,      // higher gas dependency
    icon:        "⚙️",
  },
  {
    id:          "large",
    label:       "Large Plant",
    example:     "Refinery / Chemical / Data Center",
    load_mw:     9.5,
    gas_factor:  0.25,
    icon:        "🏗️",
  },
];

// ── Cost calculation engine ───────────────────────────────────────────────────

function computeCosts(
  ercotPrice:    number,   // $/MWh
  henryHub:      number,   // $/MMBtu
  demandLevel:   string,   // low | medium | high
  riskScore:     string,   // low | medium | high
) {
  // Weather/demand multiplier — elevated temps increase cooling load & cost
  const demandMult = demandLevel === "high" ? 1.25 : demandLevel === "medium" ? 1.10 : 1.0;

  // Risk premium — market stress adds to effective cost
  const riskPremium = riskScore === "high" ? 1.15 : riskScore === "medium" ? 1.07 : 1.0;

  // Henry Hub premium vs baseline ($3.00 is baseline)
  const hhBaseline  = 3.00;
  const hhPremium   = Math.max(0, (henryHub - hhBaseline) / hhBaseline); // fractional uplift

  return FACILITIES.map(f => {
    // Base power cost: load × 24h × ERCOT price
    const powerCost = f.load_mw * 24 * ercotPrice;

    // Gas exposure cost: proportional to Henry Hub premium and facility gas factor
    // Rough proxy: 1 MMBtu per MWh for gas-fired baseline, scaled by gas_factor
    const gasCost = powerCost * f.gas_factor * (1 + hhPremium);

    // Total with demand and risk multipliers
    const total = (powerCost + gasCost) * demandMult * riskPremium;

    return {
      ...f,
      power_cost: Math.round(powerCost),
      gas_cost:   Math.round(gasCost),
      total:      Math.round(total),
    };
  });
}

function formatDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

function RiskBadge({ score }: { score: string }) {
  const cfg = {
    high:   "bg-red-500/15 text-red-400 border-red-500/20",
    medium: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    low:    "bg-green-500/15 text-green-400 border-green-500/20",
  }[score] ?? "bg-gray-500/15 text-gray-400 border-gray-500/20";
  return (
    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${cfg}`}>
      {score} risk
    </span>
  );
}

interface Props {
  ercotPrice?:    number;
  henryHub?:      number;
  demandLevel?:   string;
  riskScore?:     string;
}

export default function OperationalCostImpact({
  ercotPrice  = 20.83,
  henryHub    = 3.00,
  demandLevel = "low",
  riskScore   = "low",
}: Props) {
  const facilities = computeCosts(ercotPrice, henryHub, demandLevel, riskScore);

  const demandMult = demandLevel === "high" ? 1.25 : demandLevel === "medium" ? 1.10 : 1.0;
  const riskPremium = riskScore === "high" ? 1.15 : riskScore === "medium" ? 1.07 : 1.0;
  const hhPremium = Math.max(0, ((henryHub - 3.00) / 3.00) * 100);

  const totalMultiplier = demandMult * riskPremium;
  const aboveBaseline   = Math.round((totalMultiplier - 1) * 100);

  const barColors = ["bg-blue-500", "bg-orange-500", "bg-red-500"];
  const maxTotal  = Math.max(...facilities.map(f => f.total));

  return (
    <div className="card-glass border border-white/8 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Operational Cost Impact</p>
              <p className="text-[10px] text-gray-600">Estimated daily energy exposure · Informational only</p>
            </div>
          </div>
          <RiskBadge score={riskScore} />
        </div>

        {aboveBaseline > 0 && (
          <div className="mt-3 flex items-center gap-1.5 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <p className="text-[10px] text-amber-300">
              Current conditions add ~{aboveBaseline}% above baseline cost exposure
              {demandMult > 1 ? ` — weather demand ×${demandMult.toFixed(2)}` : ""}
              {riskPremium > 1 ? ` · market risk ×${riskPremium.toFixed(2)}` : ""}
            </p>
          </div>
        )}
      </div>

      {/* Facility cards */}
      <div className="p-5 space-y-4">
        {facilities.map((f, i) => {
          const barPct = maxTotal > 0 ? (f.total / maxTotal) * 100 : 0;
          return (
            <div key={f.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{f.icon}</span>
                    <p className="text-sm font-bold text-white">{f.label}</p>
                  </div>
                  <p className="text-[10px] text-gray-600 ml-5">{f.example}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-white tracking-tight">
                    {formatDollars(f.total)}
                    <span className="text-xs font-normal text-gray-500 ml-1">/day</span>
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColors[i]} rounded-full transition-all duration-700`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
              {/* Cost breakdown */}
              <div className="flex gap-3 ml-5">
                <span className="text-[9px] text-gray-600 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" />
                  Power: {formatDollars(f.power_cost)}
                </span>
                <span className="text-[9px] text-gray-600 flex items-center gap-1">
                  <Flame className="w-2.5 h-2.5" />
                  Gas exposure: {formatDollars(f.gas_cost)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Based on row */}
      <div className="px-5 pb-4">
        <div className="rounded-xl bg-white/3 border border-white/6 p-3">
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Based on</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <Zap className="w-3 h-3 text-amber-400" />
              <p className="text-[10px] font-bold text-white">${ercotPrice.toFixed(2)}</p>
              <p className="text-[8px] text-gray-600 uppercase tracking-wide">ERCOT/MWh</p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Flame className="w-3 h-3 text-orange-400" />
              <p className="text-[10px] font-bold text-white">${henryHub.toFixed(3)}</p>
              <p className="text-[8px] text-gray-600 uppercase tracking-wide">Henry Hub</p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Thermometer className="w-3 h-3 text-blue-400" />
              <p className={`text-[10px] font-bold capitalize ${
                demandLevel === "high" ? "text-red-400" : demandLevel === "medium" ? "text-amber-400" : "text-green-400"
              }`}>{demandLevel}</p>
              <p className="text-[8px] text-gray-600 uppercase tracking-wide">Demand</p>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-5 pb-4">
        <div className="flex items-start gap-1.5">
          <Info className="w-3 h-3 text-gray-600 shrink-0 mt-0.5" />
          <p className="text-[9px] text-gray-600 leading-relaxed">
            Estimates based on facility load profiles and current market signals. Actual costs vary by contract, efficiency, and operations.
            Not financial or procurement advice.
          </p>
        </div>
      </div>
    </div>
  );
}
