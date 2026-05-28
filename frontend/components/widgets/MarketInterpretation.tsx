"use client";
import { Brain, Info } from "lucide-react";
import type { SignalsResponse, ERCOTPrice } from "@/lib/api";
import type { RiskModel } from "@/lib/energyRiskEngine";
import { cn, formatPrice as fmtPrice } from "@/lib/utils";

interface Props {
  signals:    SignalsResponse;
  prices:     ERCOTPrice[];
  riskModel?: RiskModel;
}

function interpretMarket(signals: SignalsResponse, prices: ERCOTPrice[]) {
  const score      = signals.risk_score;
  const drivers    = (signals.signal_drivers ?? []).filter(d => d.active);
  const latest     = prices[prices.length - 1];
  const prev       = prices[prices.length - 2];
  const current    = latest?.price_mwh ?? 0;
  const prevVal    = prev?.price_mwh ?? current;
  const pricePct   = prevVal > 0 ? ((current - prevVal) / prevVal) * 100 : 0;
  const demandLvl  = signals.demand_pressure?.level ?? "low";
  const gasLvl     = signals.gas_to_power_impact?.level ?? "low";
  const priceLabel = current > 0 ? `${fmtPrice(current)}/MWh` : "current levels";

  // ── Part 1: Current Market State ────────────────────────────────────────
  let state: string;
  if (score === "high") {
    state = `Texas energy conditions indicate elevated risk at ${priceLabel}. Multiple active risk drivers are currently contributing to market stress.`;
  } else if (score === "medium") {
    state = `Texas energy conditions are under moderate monitoring at ${priceLabel}. Developing signals suggest ${signals.primary_driver ? signals.primary_driver.toLowerCase() + " is the dominant factor" : "market conditions warrant closer attention"}.`;
  } else if (drivers.length > 0) {
    state = `Texas energy conditions remain broadly stable at ${priceLabel}, though minor risk signals are active and under continuous monitoring.`;
  } else {
    state = `Texas energy conditions remain stable, with ERCOT Houston Hub pricing holding within normal operating range at ${priceLabel}.`;
  }

  // ── Part 2: Key Driver ───────────────────────────────────────────────────
  let driver: string;
  if (signals.primary_driver && score !== "low") {
    driver = signals.explanation || `The primary watch factor is ${signals.primary_driver.toLowerCase()}, which may influence pricing in the near term.`;
  } else if (demandLvl === "high") {
    driver = "The main watch factor is elevated demand pressure. Elevated cooling or heating load may increase grid stress during peak hours.";
  } else if (demandLvl === "medium") {
    driver = "Moderate demand pressure is building. Weather-driven consumption may begin to influence grid conditions if sustained.";
  } else if (gasLvl === "high" || gasLvl === "medium") {
    driver = "Natural gas supply conditions suggest upward cost pressure on power generation. This may transmit into ERCOT market pricing over the near term.";
  } else if (Math.abs(pricePct) > 2) {
    const dir = pricePct > 0 ? "upward" : "downward";
    driver = `ERCOT pricing indicates ${dir} movement of ${Math.abs(pricePct).toFixed(1)}% from the prior interval, suggesting ${pricePct > 0 ? "market tightening" : "easing"} conditions.`;
  } else {
    driver = "No dominant risk factor is currently active. All monitored channels indicate stable operating conditions across pricing, demand, and supply.";
  }

  // ── Part 3: What to Watch ────────────────────────────────────────────────
  let watch: string;
  const near = signals.time_horizons?.near_term;
  if (score === "high") {
    watch = `Monitor whether active risk factors persist or escalate. Confidence in current conditions is ${signals.confidence ?? 0}%. Conditions may shift if any additional signals are triggered.`;
  } else if (score === "medium") {
    watch = near || `Monitor whether ${signals.primary_driver ? signals.primary_driver.toLowerCase() : "current conditions"} persist into the near-term window. Any additional pressure may elevate the overall risk score.`;
  } else if (demandLvl !== "low" || gasLvl !== "low") {
    watch = "Monitor for price movement if demand pressure persists alongside any tightening in gas supply or a reduction in generation capacity.";
  } else {
    watch = "All monitored indicators suggest stable near-term conditions. Continue monitoring for any shifts in demand patterns, weather events, or supply disruptions.";
  }

  return { state, driver, watch };
}

const MARKET_STATE_CLS: Record<string, string> = {
  "Stable":        "text-green-400 bg-green-500/10 border-green-500/20",
  "Watch":         "text-cyan-400  bg-cyan-500/10  border-cyan-500/20",
  "Tightening":    "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "Volatile":      "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Elevated Risk": "text-red-400   bg-red-500/10   border-red-500/20",
};

export default function MarketInterpretation({ signals, prices, riskModel }: Props) {
  if (!signals.data_valid) return null;

  const { state, driver, watch } = interpretMarket(signals, prices);
  const score = signals.risk_score;

  // ── Use engine-derived values when available (authoritative) ────────────
  // Engine defers to backend, so this is consistent. Prevents mismatch if
  // backend label is "Loading..." or diverges from engine computation.
  const conf      = riskModel?.confidence ?? signals.confidence;
  const confNote  = riskModel?.confidenceNote ?? signals.confidence_note;
  const marketLbl = riskModel?.marketState?.state ?? signals.market_condition?.label ?? "Stable";
  const mktCls    = MARKET_STATE_CLS[marketLbl] ?? MARKET_STATE_CLS["Stable"];

  const pillColor =
    score === "high"   ? "bg-red-500/10 border-red-500/20 text-red-300"
    : score === "medium" ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
    : "bg-green-500/10 border-green-500/20 text-green-300";

  return (
    <div className="panel-scan card-glass border border-white/5 p-6 lg:col-span-2">

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">AI Market Interpretation</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Synthesized from ERCOT pricing, weather demand, and natural gas supply signals
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {marketLbl && (
            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border", mktCls)}>
              {marketLbl}
            </span>
          )}
          {conf != null && (
            <span className="text-xs text-gray-500 font-mono hidden sm:block">
              {conf}% confidence
            </span>
          )}
          <Brain className="w-4 h-4 text-gray-600" />
        </div>
      </div>

      {/* 3-column interpretation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-1 h-3 rounded-full bg-cyan-400/50" />
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Current Market State</p>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed">{state}</p>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <div className={cn("w-1 h-3 rounded-full",
              score === "high" ? "bg-red-400/60" : score === "medium" ? "bg-amber-400/60" : "bg-green-400/60"
            )} />
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Key Driver</p>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed">{driver}</p>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-1 h-3 rounded-full bg-blue-400/50" />
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">What to Watch</p>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed">{watch}</p>
        </div>

      </div>

      {/* Confidence note — shown when confidence is reduced */}
      {conf != null && conf < 75 && confNote && (
        <div className="mt-3 flex items-start gap-1.5 px-3 py-2 rounded-lg bg-white/3 border border-white/6">
          <Info className="w-3 h-3 text-gray-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 leading-relaxed">{confNote}</p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-4">
        <p className="text-xs text-gray-600 leading-relaxed">
          Informational analysis only. Not financial, trading, or procurement advice.
          Uses language such as <em>may</em>, <em>suggests</em>, <em>indicates</em>, and <em>monitor</em> to reflect uncertainty.
        </p>
        {conf != null && (
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold border flex-shrink-0",
            pillColor
          )}>
            {conf}%
          </span>
        )}
      </div>
    </div>
  );
}
