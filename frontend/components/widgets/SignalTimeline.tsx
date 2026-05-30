"use client";
import { Clock } from "lucide-react";

interface Snapshot {
  risk_score?:         string;
  risk_score_numeric?: number;
  computed_at?:        string;
  ercot_price?:        number;
  henry_hub_price?:    number;
}

interface Props {
  snapshots:    Snapshot[];
  currentPrice?: number;
  currentHH?:    number;
  currentRisk?:  string;
}

function riskNum(score?: string): number {
  if (score === "high")   return 7.5;
  if (score === "medium") return 4.5;
  return 2.0;
}

function fmt(curr: number, prev: number, fmtFn: (v: number) => string): {
  text: string; color: string; prefix: string;
} {
  const d = curr - prev;
  if (Math.abs(d) < 0.01) return { text: "±0", color: "text-gray-500", prefix: "" };
  return {
    text:   fmtFn(Math.abs(d)),
    color:  d > 0 ? "text-amber-400" : "text-green-400",
    prefix: d > 0 ? "▲" : "▼",
  };
}

export default function SignalTimeline({
  snapshots, currentPrice = 0, currentHH = 0, currentRisk = "low",
}: Props) {
  const idx6h  = Math.max(0, snapshots.length - 72);
  const idx24h = Math.max(0, snapshots.length - 288);
  const snap6h  = snapshots[idx6h]  || {};
  const snap24h = snapshots[idx24h] || {};

  const currRiskN = riskNum(currentRisk);
  const prev6Risk  = snap6h.risk_score_numeric  ?? riskNum(snap6h.risk_score);
  const prev24Risk = snap24h.risk_score_numeric ?? riskNum(snap24h.risk_score);

  const rows = [
    {
      label:   "Risk Score",
      current: `${currRiskN.toFixed(1)}/10`,
      d6h:     fmt(currRiskN,   prev6Risk,  v => v.toFixed(1)),
      d24h:    fmt(currRiskN,   prev24Risk, v => v.toFixed(1)),
    },
    {
      label:   "ERCOT Price",
      current: currentPrice > 0 ? `$${currentPrice.toFixed(2)}/MWh` : "N/A",
      d6h:     fmt(currentPrice, snap6h.ercot_price  ?? currentPrice, v => `$${v.toFixed(2)}`),
      d24h:    fmt(currentPrice, snap24h.ercot_price ?? currentPrice, v => `$${v.toFixed(2)}`),
    },
    {
      label:   "Henry Hub",
      current: currentHH > 0 ? `$${currentHH.toFixed(2)}/MMBtu` : "N/A",
      d6h:     fmt(currentHH, snap6h.henry_hub_price  ?? currentHH, v => `$${v.toFixed(2)}`),
      d24h:    fmt(currentHH, snap24h.henry_hub_price ?? currentHH, v => `$${v.toFixed(2)}`),
    },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Signal Timeline</p>
        <span className="ml-auto text-[10px] text-gray-600">Last 24 Hours</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-4 mb-2">
        <span className="text-[9px] text-gray-600 uppercase tracking-wide">Signal</span>
        <span className="text-[9px] text-gray-600 uppercase tracking-wide text-center">Current</span>
        <span className="text-[9px] text-gray-600 uppercase tracking-wide text-center">vs 6h ago</span>
        <span className="text-[9px] text-gray-600 uppercase tracking-wide text-center">vs 24h ago</span>
      </div>

      <div className="space-y-0">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-4 items-center py-2.5 border-b border-white/5 last:border-0">
            <span className="text-xs font-medium text-gray-300">{r.label}</span>
            <span className="text-xs font-bold text-white text-center">{r.current}</span>
            <span className={`text-xs font-semibold text-center ${r.d6h.color}`}>
              {r.d6h.prefix} {r.d6h.text}
            </span>
            <span className={`text-xs font-semibold text-center ${r.d24h.color}`}>
              {r.d24h.prefix} {r.d24h.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
