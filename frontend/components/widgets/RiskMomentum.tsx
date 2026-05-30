"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Snapshot {
  risk_numeric?: number;
  computed_at?:  string;
}

interface Props {
  snapshots: Snapshot[];
  currentScore?: string;
}

function riskToNum(score: string): number {
  if (score === "high")   return 7.5;
  if (score === "medium") return 4.5;
  return 2.0;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

export default function RiskMomentum({ snapshots, currentScore }: Props) {
  const current = snapshots.length > 0
    ? (snapshots[snapshots.length - 1]?.risk_numeric ?? riskToNum(currentScore || "low"))
    : riskToNum(currentScore || "low");

  // Get score from ~6h ago (snapshots every 5 min = ~72 snapshots per 6h)
  const idx6h   = Math.max(0, snapshots.length - 72);
  const score6h = snapshots[idx6h]?.risk_numeric ?? current;
  const time6h  = snapshots[idx6h]?.computed_at ?? "";

  const delta     = current - score6h;
  const absDelta  = Math.abs(delta);
  const direction = absDelta < 0.1 ? "STABLE" : delta > 0 ? "RISING" : "FALLING";

  const directionConfig = {
    RISING:  { color: "text-red-400",   bg: "bg-red-500/10 border-red-500/20",    Icon: TrendingUp },
    FALLING: { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", Icon: TrendingDown },
    STABLE:  { color: "text-blue-400",  bg: "bg-blue-500/10 border-blue-500/20",  Icon: Minus },
  }[direction];

  const { Icon } = directionConfig;

  // Mini sparkline — last 12 snapshots
  const spark = snapshots.slice(-12).map(s => s.risk_numeric ?? current);
  const sparkMax = Math.max(...spark, 3);
  const sparkMin = Math.min(...spark, 0);
  const sparkRange = sparkMax - sparkMin || 1;

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">
        Risk Momentum
      </p>

      {/* Score comparison */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">
            {time6h ? timeAgo(time6h) : "6h ago"}
          </p>
          <p className="text-lg font-black text-gray-400">{score6h.toFixed(1)}</p>
        </div>
        <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Current</p>
          <p className="text-lg font-black text-white">{current.toFixed(1)}</p>
        </div>
        <div className={`rounded-xl p-3 text-center border ${directionConfig.bg}`}>
          <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Direction</p>
          <div className="flex items-center justify-center gap-1">
            <Icon className={`w-4 h-4 ${directionConfig.color}`} />
            <p className={`text-xs font-black ${directionConfig.color}`}>{direction}</p>
          </div>
        </div>
      </div>

      {/* Sparkline */}
      {spark.length > 1 && (
        <div className="flex items-end gap-0.5 h-10">
          {spark.map((v, i) => {
            const heightPct = ((v - sparkMin) / sparkRange) * 100;
            const isLast    = i === spark.length - 1;
            return (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-all ${isLast ? "bg-blue-400" : "bg-white/20"}`}
                style={{ height: `${Math.max(heightPct, 5)}%` }}
              />
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] text-gray-600">6h ago</span>
        <span className={`text-[10px] font-semibold ${delta > 0.1 ? "text-red-400" : delta < -0.1 ? "text-green-400" : "text-gray-500"}`}>
          {delta > 0.1 ? `↑ +${delta.toFixed(1)}` : delta < -0.1 ? `↓ ${delta.toFixed(1)}` : "→ Stable"}
        </span>
        <span className="text-[9px] text-gray-600">Now</span>
      </div>
    </div>
  );
}
