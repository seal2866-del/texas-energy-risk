"use client";
import { Shield, TrendingUp, Clock, DollarSign } from "lucide-react";
import type { RiskModel } from "@/lib/energyRiskEngine";
import { cn } from "@/lib/utils";

interface Props {
  riskModel: RiskModel | null;
}

const LEVEL_CONFIG = {
  Low:      { color: "text-green-400",  border: "border-green-500/20",  bg: "bg-green-500/8",   dot: "bg-green-400" },
  Moderate: { color: "text-amber-400",  border: "border-amber-500/25",  bg: "bg-amber-500/8",   dot: "bg-amber-400" },
  High:     { color: "text-red-400",    border: "border-red-500/25",    bg: "bg-red-500/8",     dot: "bg-red-400" },
};

export default function OperationalExposure({ riskModel }: Props) {
  if (!riskModel) return null;

  const oe    = riskModel.operationalExposure;
  const ce    = riskModel.costExposure;
  const level = oe.exposureLevel;
  const cfg   = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.Low;

  return (
    <div className="card-glass border border-white/5 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">
            Operational Exposure
          </span>
        </div>
        <span className={cn(
          "text-xs font-bold px-2.5 py-1 rounded-full border",
          cfg.color, cfg.border, cfg.bg,
        )}>
          {level}
        </span>
      </div>

      {/* Explanation */}
      <p className="text-sm text-gray-300 leading-relaxed mb-4">
        {oe.exposureExplanation}
      </p>

      {/* Detail row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Cost sensitivity */}
        <div className="rounded-xl bg-white/3 border border-white/5 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <DollarSign className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Cost Sensitivity</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            {oe.costSensitivityRange}
          </p>
        </div>

        {/* Peak window */}
        <div className="rounded-xl bg-white/3 border border-white/5 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Peak Window</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            {oe.peakWindow}
          </p>
        </div>
      </div>

      {/* Cost exposure band — only when meaningful */}
      {ce && ce.level !== 'Low' && ce.description && (
        <div className="mt-3 rounded-xl bg-white/3 border border-white/5 p-3 flex items-start gap-2.5">
          <TrendingUp className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-400 font-medium mb-0.5">Cost Exposure — {ce.label}</p>
            <p className="text-xs text-gray-300">{ce.description}</p>
          </div>
        </div>
      )}

      {/* Confidence indicator */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-600">Engine confidence</span>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1.5 h-3 rounded-sm",
                  i < Math.round((riskModel.confidence / 100) * 5)
                    ? "bg-orange-500"
                    : "bg-white/10",
                )}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">{riskModel.confidence}%</span>
        </div>
      </div>
    </div>
  );
}
