"use client";
import { GitCompare } from "lucide-react";

interface Props {
  signals: {
    risk_score?: string;
    primary_driver?: string;
    primary_driver_type?: string;
    secondary_factors?: string[];
    risk_direction?: string;
    what_changed?: { driver: string; change: string; direction: string }[];
  };
  snapshots?: { risk_numeric?: number; computed_at?: string }[];
}

function riskToNumeric(score: string): number {
  if (score === "high")   return 7.5;
  if (score === "medium") return 4.5;
  return 2.0;
}

function driverLabel(type: string): string {
  if (type?.includes("weather")) return "Weather Demand Forecast";
  if (type?.includes("price"))   return "ERCOT Price Movement";
  if (type?.includes("gas"))     return "Natural Gas Supply";
  return type || "Market Conditions";
}

export default function RootCauseEngine({ signals, snapshots = [] }: Props) {
  const currentScore   = riskToNumeric(signals.risk_score || "low");
  const primaryDriver  = driverLabel(signals.primary_driver_type || signals.primary_driver || "");
  const secondary      = signals.secondary_factors?.slice(0, 2) ?? [];
  const whatChanged    = signals.what_changed ?? [];
  const direction      = signals.risk_direction || "stable";

  // Get previous score from snapshots
  const prevScore = snapshots.length >= 2
    ? (snapshots[snapshots.length - 2]?.risk_numeric ?? currentScore)
    : currentScore;

  const delta     = currentScore - prevScore;
  const deltaStr  = delta > 0 ? `+${delta.toFixed(1)}` : delta < 0 ? delta.toFixed(1) : "0.0";
  const deltaColor = delta > 0 ? "text-red-400" : delta < 0 ? "text-green-400" : "text-gray-400";

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <GitCompare className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Why Did the Score Change?
        </p>
      </div>

      {/* Score comparison */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Previous</p>
          <p className="text-lg font-black text-gray-300">{prevScore.toFixed(1)}</p>
          <p className="text-[9px] text-gray-600">/ 10</p>
        </div>
        <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Current</p>
          <p className="text-lg font-black text-white">{currentScore.toFixed(1)}</p>
          <p className="text-[9px] text-gray-600">/ 10</p>
        </div>
        <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Change</p>
          <p className={`text-lg font-black ${deltaColor}`}>{deltaStr}</p>
          <p className={`text-[9px] uppercase tracking-wide ${direction === "increasing" ? "text-red-400" : direction === "decreasing" ? "text-green-400" : "text-gray-600"}`}>
            {direction}
          </p>
        </div>
      </div>

      {/* Driver attribution */}
      <div className="space-y-2">
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Primary Driver</p>
            <p className="text-xs font-semibold text-gray-200">{primaryDriver}</p>
          </div>
          <span className="text-[10px] text-blue-400 font-semibold uppercase">Primary</span>
        </div>
        {secondary.length > 0 && secondary.map((s, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <p className="text-xs text-gray-400">{s}</p>
            <span className="text-[10px] text-gray-500 uppercase">Secondary</span>
          </div>
        ))}
        {whatChanged.length > 0 && whatChanged[0].driver !== "All Drivers" && (
          <div className="pt-2">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">What changed:</p>
            {whatChanged.slice(0, 2).map((w, i) => (
              <p key={i} className="text-[11px] text-gray-400">
                {w.driver}: <span className="text-gray-300">{w.change}</span>
              </p>
            ))}
          </div>
        )}
        {(whatChanged.length === 0 || whatChanged[0]?.driver === "All Drivers") && (
          <p className="text-xs text-gray-500 pt-2">No material changes since previous interval.</p>
        )}
      </div>
    </div>
  );
}
