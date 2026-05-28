"use client";
import { Activity, TrendingUp, Eye, ArrowRight } from "lucide-react";
import type { RiskModel, PriceBehavior, MarketStateLabel } from "@/lib/energyRiskEngine";
import { cn } from "@/lib/utils";

interface Props {
  riskModel: RiskModel | null;
}

// ── Market state display config ────────────────────────────────

const STATE_CONFIG: Record<MarketStateLabel, {
  color: string; bg: string; border: string; dot: string;
}> = {
  "Stable":       { color: "text-green-400",  bg: "bg-green-500/8",   border: "border-green-500/20",  dot: "bg-green-400"  },
  "Watch":        { color: "text-blue-400",   bg: "bg-blue-500/8",    border: "border-blue-500/20",   dot: "bg-blue-400"   },
  "Tightening":   { color: "text-amber-400",  bg: "bg-amber-500/8",   border: "border-amber-500/20",  dot: "bg-amber-400"  },
  "Volatile":     { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/25", dot: "bg-orange-400" },
  "Elevated Risk":{ color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/25",    dot: "bg-red-400"    },
  "Critical":     { color: "text-red-300",    bg: "bg-red-500/15",    border: "border-red-400/40",    dot: "bg-red-300"    },
  "Unavailable":  { color: "text-gray-400",   bg: "bg-white/5",       border: "border-white/10",      dot: "bg-gray-500"   },
};

const PRICE_BEHAVIOR_CONFIG: Record<PriceBehavior, { label: string; color: string; icon: string }> = {
  falling:  { label: "Price Falling",  color: "text-green-400",  icon: "↘" },
  stable:   { label: "Price Stable",   color: "text-gray-400",   icon: "→" },
  rising:   { label: "Price Rising",   color: "text-amber-400",  icon: "↗" },
  volatile: { label: "Price Volatile", color: "text-orange-400", icon: "↕" },
};

const URGENCY_CONFIG = {
  low:    "text-green-400",
  medium: "text-amber-400",
  high:   "text-red-400",
};

export default function MarketStatePanel({ riskModel }: Props) {
  if (!riskModel) return null;

  const ms     = riskModel.marketState;
  const pb     = riskModel.priceBehavior;
  const cfg    = STATE_CONFIG[ms.state] ?? STATE_CONFIG["Stable"];
  const pbCfg  = PRICE_BEHAVIOR_CONFIG[pb];

  return (
    <div className="lg:col-span-2 card-glass border border-white/5 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">
            Market State Intelligence
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Price behavior badge */}
          <span className={cn("text-xs font-mono font-medium", pbCfg.color)}>
            {pbCfg.icon} {pbCfg.label}
          </span>
          {/* Market state badge */}
          <span className={cn(
            "text-xs font-bold px-2.5 py-1 rounded-full border",
            cfg.color, cfg.border, cfg.bg,
          )}>
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5 mb-px", cfg.dot)} />
            {ms.label}
          </span>
        </div>
      </div>

      {/* Market state explanation */}
      <p className="text-sm text-gray-200 leading-relaxed mb-4 font-medium">
        {ms.explanation}
      </p>

      {/* Three-column intelligence strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Why It Matters */}
        <div className="rounded-xl bg-white/3 border border-white/5 p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3 h-3 text-orange-400" />
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">
              Why It Matters
            </span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            {riskModel.whyItMatters}
          </p>
        </div>

        {/* Monitoring Focus */}
        <div className="rounded-xl bg-white/3 border border-white/5 p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Eye className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">
              Monitor Now
            </span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            {riskModel.monitoringFocus}
          </p>
        </div>

        {/* Outlook */}
        <div className="rounded-xl bg-white/3 border border-white/5 p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowRight className="w-3 h-3 text-green-400" />
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">
              Outlook
            </span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            {riskModel.outlook}
          </p>
        </div>
      </div>

      {/* Urgency + driver strip */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-gray-600">
          Primary driver: <span className="text-gray-400">{riskModel.primaryDriver || "None active"}</span>
        </span>
        <span className={cn("font-medium", URGENCY_CONFIG[ms.urgency])}>
          Urgency: {ms.urgency.charAt(0).toUpperCase() + ms.urgency.slice(1)}
        </span>
      </div>
    </div>
  );
}
