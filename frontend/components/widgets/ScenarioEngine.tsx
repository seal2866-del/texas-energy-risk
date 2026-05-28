"use client";
import { GitBranch, TrendingUp, AlertTriangle, ShieldCheck, ChevronRight,
         Minus, Radio } from "lucide-react";
import type { Scenario, OperationalExposure, MarketTransition } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  scenarios?:           Scenario[];
  operationalExposure?: OperationalExposure;
  marketTransition?:    MarketTransition;
}

const PROB_CFG = {
  high:     { cls: "text-red-400",    bg: "bg-red-500/8    border-red-500/20"    },
  elevated: { cls: "text-amber-400",  bg: "bg-amber-500/8  border-amber-500/20"  },
  moderate: { cls: "text-blue-400",   bg: "bg-blue-500/8   border-blue-500/20"   },
  low:      { cls: "text-gray-500",   bg: "bg-white/4      border-white/8"       },
} as const;

const EXPOSURE_CFG = {
  high:     { cls: "text-red-400",    bg: "bg-red-500/8    border-red-500/20"    },
  elevated: { cls: "text-amber-400",  bg: "bg-amber-500/8  border-amber-500/20"  },
  moderate: { cls: "text-blue-400",   bg: "bg-blue-500/8   border-blue-500/20"   },
  low:      { cls: "text-green-400",  bg: "bg-green-500/8  border-green-500/20"  },
} as const;

const TRANSITION_URGENCY_CFG = {
  high:   { cls: "text-red-400",   bg: "bg-red-500/8    border-red-500/20"   },
  medium: { cls: "text-amber-400", bg: "bg-amber-500/8  border-amber-500/20" },
  low:    { cls: "text-gray-500",  bg: "bg-white/4      border-white/8"      },
} as const;

export default function ScenarioEngine({ scenarios, operationalExposure, marketTransition }: Props) {
  if (!scenarios?.length && !operationalExposure && !marketTransition) return null;

  const hasScenarios = (scenarios?.length ?? 0) > 0;
  const expCfg  = EXPOSURE_CFG[(operationalExposure?.cls ?? "low")] ?? EXPOSURE_CFG.low;
  const transCfg = TRANSITION_URGENCY_CFG[(marketTransition?.urgency ?? "low")] ?? TRANSITION_URGENCY_CFG.low;

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
            <GitBranch className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">Scenario & Exposure Engine</h2>
            <p className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-wide font-medium">
              Conditional Modeling · Operational Exposure · State Transitions
            </p>
          </div>
        </div>
        {marketTransition && marketTransition.transition !== "stable" && (
          <span className={cn(
            "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border flex-shrink-0",
            transCfg.bg, transCfg.cls,
          )}>
            <TrendingUp className="w-3 h-3" />
            {marketTransition.label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Left: Operational Exposure */}
        {operationalExposure && (
          <div className={cn("p-4 rounded-xl border", expCfg.bg)}>
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1.5">
              Operational Exposure
            </p>
            <p className={cn("text-base font-black mb-1", expCfg.cls)}>
              {operationalExposure.level}
            </p>
            <p className="text-xs text-gray-400 leading-relaxed mb-3 max-w-[36ch]">
              {operationalExposure.short_desc}
            </p>
            {operationalExposure.drivers.length > 0 && (
              <div className="space-y-1">
                {operationalExposure.drivers.map((d, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <ChevronRight className="w-3 h-3 text-gray-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-gray-500">{d}</p>
                  </div>
                ))}
              </div>
            )}
            {operationalExposure.drivers.length === 0 && (
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-green-500/50" />
                <p className="text-[10px] text-gray-600">No active exposure contributors</p>
              </div>
            )}
          </div>
        )}

        {/* Right: Market Transition */}
        {marketTransition && (
          <div className={cn(
            "p-4 rounded-xl border",
            marketTransition.transition === "stable"
              ? "bg-white/3 border-white/6"
              : transCfg.bg,
          )}>
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1.5">
              State Transition
            </p>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-gray-600 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                {marketTransition.from_state}
              </span>
              <ChevronRight className="w-3 h-3 text-gray-600" />
              <span className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                marketTransition.transition === "stable"
                  ? "text-gray-500 bg-white/4 border-white/8"
                  : transCfg.cls + " " + transCfg.bg,
              )}>
                {marketTransition.to_state}
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-2 max-w-[36ch]">
              {marketTransition.description}
            </p>
            <div className="flex items-start gap-1.5">
              <ChevronRight className="w-3 h-3 text-teal-500/50 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-500">{marketTransition.action}</p>
            </div>
          </div>
        )}
      </div>

      {/* Conditional Scenarios */}
      {hasScenarios && (
        <div className="mt-4">
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2.5">
            Conditional Scenarios
          </p>
          <div className="space-y-2">
            {scenarios!.map((s) => {
              const pCfg = PROB_CFG[s.probability] ?? PROB_CFG.low;
              return (
                <div key={s.id} className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
                  <span className={cn(
                    "text-[9px] font-black px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 uppercase tracking-wide whitespace-nowrap",
                    pCfg.bg, pCfg.cls,
                  )}>
                    {s.probability}
                  </span>
                  <p className="text-xs text-gray-300 leading-relaxed max-w-[68ch]">
                    {s.full}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-gray-700">
        <Radio className="w-3 h-3 text-teal-500/40" />
        <span className="uppercase tracking-wide font-semibold">
          Conditional modeling · Probabilistic only · Not a market forecast or financial advice
        </span>
      </div>
    </div>
  );
}
