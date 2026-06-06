"use client";
import { DollarSign, Zap, Bell, Brain, TrendingUp } from "lucide-react";

interface Props {
  ercotPrice?:    number;
  activeSignals?: number;
  riskScore?:     string;
}

export default function CustomerROI({ ercotPrice = 75, activeSignals = 0, riskScore = "low" }: Props) {
  // Semi-dynamic: scale estimates based on live conditions
  const priceMultiplier = ercotPrice >= 150 ? 2.1 : ercotPrice >= 75 ? 1.4 : 1.0;
  const signalMultiplier = (activeSignals || 0) > 1 ? 1.3 : 1.0;

  const avoidedExposure  = Math.round(12500 * priceMultiplier / 500) * 500;
  const warningEvents    = Math.round(14 * signalMultiplier);
  const recommendations  = Math.round(22 * signalMultiplier);
  const costAvoidance    = Math.round(47000 * priceMultiplier / 1000) * 1000;

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n.toLocaleString()}`;

  const metrics = [
    {
      icon:   <Zap className="w-4 h-4 text-amber-400" />,
      label:  "Avoided Peak ERCOT Exposure",
      value:  fmt(avoidedExposure),
      sub:    "this month",
      text:   "text-amber-400",
      bg:     "bg-amber-500/8",
      border: "border-amber-500/15",
    },
    {
      icon:   <Bell className="w-4 h-4 text-orange-400" />,
      label:  "Early Warning Events Detected",
      value:  `${warningEvents}`,
      sub:    "actionable alerts",
      text:   "text-orange-400",
      bg:     "bg-orange-500/8",
      border: "border-orange-500/15",
    },
    {
      icon:   <Brain className="w-4 h-4 text-purple-400" />,
      label:  "AI Recommendations Generated",
      value:  `${recommendations}`,
      sub:    "operational actions",
      text:   "text-purple-400",
      bg:     "bg-purple-500/8",
      border: "border-purple-500/15",
    },
    {
      icon:   <DollarSign className="w-4 h-4 text-green-400" />,
      label:  "Potential Cost Avoidance",
      value:  fmt(costAvoidance),
      sub:    "estimated monthly",
      text:   "text-green-400",
      bg:     "bg-green-500/8",
      border: "border-green-500/15",
    },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Potential Monthly Value</h3>
            <p className="text-[10px] text-gray-500">Based on monitored conditions · Illustrative estimate</p>
          </div>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-xs font-black text-green-400">{fmt(costAvoidance)}</p>
          <p className="text-[9px] text-gray-500 text-center">est. savings</p>
        </div>
      </div>

      {/* Metric grid */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        {metrics.map((m, i) => (
          <div key={i} className={`rounded-xl border p-3 ${m.bg} ${m.border}`}>
            <div className="flex items-center gap-1.5 mb-2">
              {m.icon}
              <p className="text-[10px] text-gray-400 leading-tight">{m.label}</p>
            </div>
            <p className={`text-2xl font-black ${m.text}`}>{m.value}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-gray-600 leading-relaxed italic">
          Illustrative estimate based on monitored market conditions and risk signals.
          Actual savings vary by facility size, load profile, and procurement strategy.
          Not financial advice.
        </p>
      </div>
    </div>
  );
}
