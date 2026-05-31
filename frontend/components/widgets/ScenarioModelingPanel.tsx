"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, TrendingUp, Zap, Flame, Thermometer, AlertTriangle } from "lucide-react";

// ── Facility profiles (same as OperationalCostImpact) ─────────────────────────
const FACILITIES = [
  { id: "small",     label: "Small Facility", load_mw: 0.5, gas_factor: 0.08 },
  { id: "midstream", label: "Midstream Site",  load_mw: 3.0, gas_factor: 0.35 },
  { id: "large",     label: "Large Plant",     load_mw: 9.5, gas_factor: 0.25 },
];

// ── Scenario definitions ──────────────────────────────────────────────────────
interface ScenarioDef {
  id:          string;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  color:       string;
  border:      string;
  bg:          string;
  mutate:      (base: BaseInputs) => BaseInputs;
}

interface BaseInputs {
  ercotPrice:  number;
  henryHub:    number;
  tempHigh:    number;
  demandLevel: "low" | "medium" | "high";
}

function buildScenarios(base: BaseInputs): ScenarioDef[] {
  return [
    {
      id:          "current",
      label:       "Current Conditions",
      description: "Live market state — no scenario applied",
      icon:        <Zap className="w-3.5 h-3.5" />,
      color:       "text-gray-300",
      border:      "border-white/10",
      bg:          "bg-white/3",
      mutate:      b => b,
    },
    {
      id:          "hh_plus25",
      label:       "Henry Hub +25%",
      description: `Henry Hub rises to $${(base.henryHub * 1.25).toFixed(2)}/MMBtu`,
      icon:        <Flame className="w-3.5 h-3.5" />,
      color:       "text-amber-400",
      border:      "border-amber-500/20",
      bg:          "bg-amber-500/5",
      mutate:      b => ({ ...b, henryHub: b.henryHub * 1.25 }),
    },
    {
      id:          "hh_plus50",
      label:       "Henry Hub +50%",
      description: `Henry Hub rises to $${(base.henryHub * 1.50).toFixed(2)}/MMBtu`,
      icon:        <Flame className="w-3.5 h-3.5" />,
      color:       "text-orange-400",
      border:      "border-orange-500/20",
      bg:          "bg-orange-500/5",
      mutate:      b => ({ ...b, henryHub: b.henryHub * 1.50 }),
    },
    {
      id:          "ercot_50",
      label:       "ERCOT $50/MWh",
      description:  "ERCOT Houston Hub spikes to $50/MWh",
      icon:        <Zap className="w-3.5 h-3.5" />,
      color:       "text-amber-400",
      border:      "border-amber-500/20",
      bg:          "bg-amber-500/5",
      mutate:      b => ({ ...b, ercotPrice: 50 }),
    },
    {
      id:          "ercot_100",
      label:       "ERCOT $100/MWh",
      description:  "ERCOT Houston Hub spikes to $100/MWh",
      icon:        <Zap className="w-3.5 h-3.5" />,
      color:       "text-red-400",
      border:      "border-red-500/20",
      bg:          "bg-red-500/5",
      mutate:      b => ({ ...b, ercotPrice: 100 }),
    },
    {
      id:          "heat_100f",
      label:       "Temperature >100°F",
      description:  "Extreme heat — demand pressure elevated",
      icon:        <Thermometer className="w-3.5 h-3.5" />,
      color:       "text-red-400",
      border:      "border-red-500/20",
      bg:          "bg-red-500/5",
      mutate:      b => ({ ...b, tempHigh: 103, demandLevel: "high" as const }),
    },
  ];
}

// ── Calculation engine ────────────────────────────────────────────────────────

interface ScenarioResult {
  scenario:           ScenarioDef;
  inputs:             BaseInputs;
  facility_costs:     { id: string; label: string; daily: number; delta_pct: number }[];
  risk_level:         "low" | "medium" | "high";
  escalation_pct:     number;
  operational_exposure: "Minimal" | "Moderate" | "Elevated" | "High";
  exposure_cls:       string;
}

function computeScenario(
  scenario: ScenarioDef,
  base: BaseInputs,
  baseResults: { id: string; daily: number }[],
): ScenarioResult {
  const inputs = scenario.mutate(base);

  const demandMult  = inputs.demandLevel === "high" ? 1.25 : inputs.demandLevel === "medium" ? 1.10 : 1.0;
  const hhPremium   = Math.max(0, (inputs.henryHub - 3.00) / 3.00);

  const facility_costs = FACILITIES.map(f => {
    const powerCost = f.load_mw * 24 * inputs.ercotPrice;
    const gasCost   = powerCost * f.gas_factor * (1 + hhPremium);
    const daily     = Math.round((powerCost + gasCost) * demandMult);
    const baseDail  = baseResults.find(b => b.id === f.id)?.daily ?? daily;
    const delta_pct = baseDail > 0 ? Math.round(((daily - baseDail) / baseDail) * 100) : 0;
    return { id: f.id, label: f.label, daily, delta_pct };
  });

  // Risk level
  const ercotHigh  = inputs.ercotPrice >= 100;
  const ercotMed   = inputs.ercotPrice >= 50;
  const hhHigh     = inputs.henryHub >= 6;
  const hhMed      = inputs.henryHub >= 4;
  const demandHigh = inputs.demandLevel === "high";
  const demandMed  = inputs.demandLevel === "medium";

  const highCount = [ercotHigh, hhHigh, demandHigh].filter(Boolean).length;
  const medCount  = [ercotMed, hhMed, demandMed].filter(Boolean).length;

  const risk_level: "low" | "medium" | "high" =
    highCount >= 2 ? "high" :
    highCount >= 1 || medCount >= 2 ? "medium" : "low";

  // Escalation probability
  let esc = 10;
  if (ercotHigh)   esc += 35;
  else if (ercotMed) esc += 18;
  if (hhHigh)      esc += 25;
  else if (hhMed)  esc += 12;
  if (demandHigh)  esc += 20;
  else if (demandMed) esc += 10;
  esc = Math.min(95, esc);

  // Operational exposure
  const maxDelta = Math.max(...facility_costs.map(f => f.delta_pct));
  const operational_exposure: "Minimal" | "Moderate" | "Elevated" | "High" =
    maxDelta >= 100 || risk_level === "high" ? "High" :
    maxDelta >= 40  || risk_level === "medium" ? "Elevated" :
    maxDelta >= 15 ? "Moderate" : "Minimal";

  const exposure_cls =
    operational_exposure === "High"     ? "text-red-400"    :
    operational_exposure === "Elevated" ? "text-orange-400" :
    operational_exposure === "Moderate" ? "text-amber-400"  : "text-green-400";

  return { scenario, inputs, facility_costs, risk_level, escalation_pct: esc, operational_exposure, exposure_cls };
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

function RiskPill({ level }: { level: string }) {
  const cfg = {
    high:   "bg-red-500/15 text-red-400 border-red-500/20",
    medium: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    low:    "bg-green-500/15 text-green-400 border-green-500/20",
  }[level] ?? "bg-gray-500/15 text-gray-400";
  return (
    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${cfg}`}>
      {level}
    </span>
  );
}

function DeltaBadge({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-[10px] text-gray-500">—</span>;
  const color = pct > 0 ? "text-red-400" : "text-green-400";
  return <span className={`text-[10px] font-bold ${color}`}>{pct > 0 ? "+" : ""}{pct}%</span>;
}

interface Props {
  ercotPrice?:  number;
  henryHub?:    number;
  tempHigh?:    number;
  demandLevel?: string;
  riskScore?:   string;
}

export default function ScenarioModelingPanel({
  ercotPrice  = 20.83,
  henryHub    = 3.00,
  tempHigh    = 85,
  demandLevel = "low",
  riskScore   = "low",
}: Props) {
  const [expanded, setExpanded] = useState<string | null>("current");

  const base: BaseInputs = {
    ercotPrice,
    henryHub,
    tempHigh,
    demandLevel: (demandLevel as "low" | "medium" | "high") ?? "low",
  };

  const scenarios = buildScenarios(base);

  // Compute base first for delta calculations
  const baseResult = computeScenario(scenarios[0], base, []);
  const baseCosts  = baseResult.facility_costs.map(f => ({ id: f.id, daily: f.daily }));

  const results = scenarios.map(s => computeScenario(s, base, baseCosts));

  return (
    <div className="card-glass border border-white/8 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Scenario Modeling</p>
            <p className="text-[10px] text-gray-600">Stress-test market conditions · Informational only</p>
          </div>
        </div>
      </div>

      {/* Scenario cards */}
      <div className="divide-y divide-white/5">
        {results.map((result, i) => {
          const { scenario } = result;
          const isOpen       = expanded === scenario.id;
          const isCurrent    = scenario.id === "current";

          return (
            <div key={scenario.id} className={`${scenario.bg}`}>
              {/* Row header — always visible */}
              <button
                className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-white/3 transition-colors"
                onClick={() => setExpanded(isOpen ? null : scenario.id)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`${scenario.color} shrink-0`}>{scenario.icon}</span>
                  <div className="text-left min-w-0">
                    <p className={`text-sm font-bold ${scenario.color} truncate`}>{scenario.label}</p>
                    <p className="text-[10px] text-gray-600 truncate">{scenario.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RiskPill level={result.risk_level} />
                  <span className={`text-xs font-bold ${result.exposure_cls}`}>{result.operational_exposure}</span>
                  {isOpen
                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                    : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                  }
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-5 pb-5 space-y-4">

                  {/* Current → Forecast → Impact row */}
                  <div className={`grid grid-cols-3 gap-2 p-3 rounded-xl border ${scenario.border} bg-black/20`}>
                    <div>
                      <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-1">Current</p>
                      <p className="text-[10px] text-gray-400">${ercotPrice.toFixed(2)}/MWh</p>
                      <p className="text-[10px] text-gray-400">${henryHub.toFixed(3)} HH</p>
                      <p className="text-[10px] text-gray-400 capitalize">{demandLevel} demand</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-1">Forecast</p>
                      <p className={`text-[10px] font-semibold ${scenario.color}`}>${result.inputs.ercotPrice.toFixed(2)}/MWh</p>
                      <p className={`text-[10px] font-semibold ${scenario.color}`}>${result.inputs.henryHub.toFixed(3)} HH</p>
                      <p className={`text-[10px] font-semibold capitalize ${scenario.color}`}>{result.inputs.demandLevel} demand</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-1">Impact</p>
                      <RiskPill level={result.risk_level} />
                      <p className={`text-[10px] font-bold mt-1 ${result.exposure_cls}`}>{result.operational_exposure}</p>
                      <p className="text-[10px] text-gray-500">{result.escalation_pct}% esc. prob.</p>
                    </div>
                  </div>

                  {/* Escalation bar */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide">Escalation Probability</p>
                      <p className={`text-[10px] font-bold ${
                        result.escalation_pct >= 60 ? "text-red-400" :
                        result.escalation_pct >= 30 ? "text-amber-400" : "text-green-400"
                      }`}>{result.escalation_pct}%</p>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          result.escalation_pct >= 60 ? "bg-red-500" :
                          result.escalation_pct >= 30 ? "bg-amber-500" : "bg-green-500"
                        }`}
                        style={{ width: `${result.escalation_pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Facility cost table */}
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Estimated Daily Cost</p>
                    <div className="space-y-2">
                      {result.facility_costs.map(f => (
                        <div key={f.id} className="flex items-center justify-between">
                          <p className="text-[11px] text-gray-400">{f.label}</p>
                          <div className="flex items-center gap-2">
                            {!isCurrent && <DeltaBadge pct={f.delta_pct} />}
                            <p className="text-sm font-black text-white tracking-tight">
                              {fmt(f.daily)}<span className="text-[9px] font-normal text-gray-500 ml-0.5">/day</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Warning for high scenarios */}
                  {result.risk_level !== "low" && !isCurrent && (
                    <div className={`flex items-start gap-1.5 p-2.5 rounded-lg border ${scenario.border} bg-black/20`}>
                      <AlertTriangle className={`w-3 h-3 shrink-0 mt-0.5 ${scenario.color}`} />
                      <p className="text-[9px] text-gray-400 leading-relaxed">
                        {result.risk_level === "high"
                          ? "This scenario reflects elevated operational risk across multiple signal channels. Internal escalation procedures may be warranted."
                          : "This scenario reflects moderate operational conditions. Increased monitoring frequency may be appropriate."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/5">
        <p className="text-[9px] text-gray-600">
          Scenarios are illustrative estimates only. Actual costs depend on contracts, load profiles, and operational conditions. Not financial or procurement advice.
        </p>
      </div>
    </div>
  );
}
