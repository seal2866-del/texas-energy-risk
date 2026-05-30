"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Snapshot {
  risk_score?:         string;
  risk_score_numeric?: number;
  computed_at?:        string;
}

interface Props {
  snapshots:     Snapshot[];
  currentScore:  string;
  riskDirection: string;
}

function riskNum(score?: string): number {
  if (score === "high")   return 7.5;
  if (score === "medium") return 4.5;
  return 2.0;
}

function project(current: number, direction: string, hours: number): number {
  if (direction === "increasing") {
    if (hours <= 6)  return +(current + 0.2).toFixed(1);
    if (hours <= 24) return +(current + 0.4).toFixed(1);
    return +(current + 1.1).toFixed(1);
  }
  if (direction === "decreasing") {
    if (hours <= 6)  return +(Math.max(current - 0.1, 1.0)).toFixed(1);
    if (hours <= 24) return +(Math.max(current - 0.3, 1.0)).toFixed(1);
    return +(Math.max(current - 0.5, 1.0)).toFixed(1);
  }
  // Stable — very slight drift
  if (hours <= 6)  return +(current + 0.1).toFixed(1);
  if (hours <= 24) return +(current + 0.2).toFixed(1);
  return +(current + 0.4).toFixed(1);
}

function scoreColor(n: number): string {
  if (n >= 6) return "text-red-400";
  if (n >= 4) return "text-amber-400";
  return "text-green-400";
}

function scoreLabel(n: number): string {
  if (n >= 6) return "High";
  if (n >= 4) return "Medium";
  return "Low";
}

function trendLabel(direction: string): { text: string; Icon: React.ElementType; color: string } {
  if (direction === "increasing") return { text: "Gradual Increase",  Icon: TrendingUp,   color: "text-amber-400" };
  if (direction === "decreasing") return { text: "Gradual Decrease",  Icon: TrendingDown, color: "text-green-400" };
  return                                  { text: "Stable",           Icon: Minus,        color: "text-blue-400" };
}

export default function RiskTrajectory({ snapshots, currentScore, riskDirection }: Props) {
  const currNum = snapshots.length > 0
    ? (snapshots[snapshots.length - 1]?.risk_score_numeric ?? riskNum(currentScore))
    : riskNum(currentScore);

  const f6h  = project(currNum, riskDirection, 6);
  const f24h = project(currNum, riskDirection, 24);
  const f48h = project(currNum, riskDirection, 48);

  const { text: trendText, Icon: TrendIcon, color: trendColor } = trendLabel(riskDirection);

  const points = [
    { label: "Current",   value: currNum, sublabel: scoreLabel(currNum) },
    { label: "6 Hours",   value: f6h,     sublabel: scoreLabel(f6h) },
    { label: "24 Hours",  value: f24h,    sublabel: scoreLabel(f24h) },
    { label: "48 Hours",  value: f48h,    sublabel: scoreLabel(f48h) },
  ];

  // Mini sparkline
  const maxVal = Math.max(...points.map(p => p.value), 4);
  const heights = points.map(p => Math.round((p.value / maxVal) * 100));

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Risk Trajectory</p>
          <p className="text-xs text-gray-400">Projected score based on current signal direction</p>
        </div>
        <div className={`flex items-center gap-1.5 ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span className="text-xs font-bold">{trendText}</span>
        </div>
      </div>

      {/* Score points */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {points.map((p, i) => (
          <div key={p.label} className={`text-center rounded-xl p-3 border ${i === 0 ? "bg-white/5 border-white/12" : "bg-white/2 border-white/5"}`}>
            <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">{p.label}</p>
            <p className={`text-lg font-black ${scoreColor(p.value)}`}>{p.value.toFixed(1)}</p>
            <p className={`text-[9px] font-semibold ${scoreColor(p.value)}`}>{p.sublabel}</p>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      <div className="flex items-end gap-1 h-8 mb-1">
        {heights.map((h, i) => (
          <div key={i} className="flex-1 rounded-sm"
            style={{
              height:     `${Math.max(h, 8)}%`,
              background: i === 0 ? "#3b82f6" : i === heights.length - 1 && f48h > currNum + 0.5 ? "#f59e0b" : "#374151",
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {points.map(p => (
          <p key={p.label} className="text-[8px] text-gray-700 text-center">{p.label}</p>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mt-3 border-t border-white/5 pt-2">
        Probabilistic projection only. Not a forecast. Actual conditions may vary.
      </p>
    </div>
  );
}
