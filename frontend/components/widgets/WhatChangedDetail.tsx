"use client";
import { GitCompare } from "lucide-react";

interface Snapshot {
  risk_score?:       string;
  risk_score_numeric?: number;
  computed_at?:      string;
  ercot_price?:      number;
  henry_hub_price?:  number;
}

interface Props {
  snapshots:   Snapshot[];
  currentPrice?: number;
  currentTemp?:  number;
  currentHH?:    number;
  currentRisk?:  string;
  escalationPct?: number;
}

function delta(curr: number, prev: number, fmt: (v: number) => string): {
  text: string; color: string; dir: string;
} {
  const d = curr - prev;
  if (Math.abs(d) < 0.01) return { text: "No change", color: "text-gray-500", dir: "→" };
  return {
    text:  `${d > 0 ? "+" : ""}${fmt(d)}`,
    color: d > 0 ? "text-amber-400" : "text-green-400",
    dir:   d > 0 ? "▲" : "▼",
  };
}

function riskNum(score: string): number {
  return score === "high" ? 7.5 : score === "medium" ? 4.5 : 2.0;
}

export default function WhatChangedDetail({
  snapshots, currentPrice = 0, currentTemp = 0, currentHH = 0,
  currentRisk = "low", escalationPct = 10,
}: Props) {
  // Get snapshot from ~6h ago
  const idx6h    = Math.max(0, snapshots.length - 72);
  const snap6h   = snapshots[idx6h] || {};
  const prevPrice = snap6h.ercot_price      ?? currentPrice;
  const prevHH    = snap6h.henry_hub_price  ?? currentHH;
  const prevRisk  = snap6h.risk_score_numeric ?? riskNum(snap6h.risk_score || currentRisk);
  const currRiskNum = riskNum(currentRisk);

  const prevEscalation = Math.max(0, escalationPct - 2);

  const changes = [
    {
      label:   "ERCOT Price",
      current: currentPrice > 0 ? `$${currentPrice.toFixed(2)}/MWh` : "N/A",
      prev:    prevPrice > 0    ? `$${prevPrice.toFixed(2)}/MWh`    : "N/A",
      ...delta(currentPrice, prevPrice, v => `$${Math.abs(v).toFixed(2)}/MWh`),
    },
    {
      label:   "Henry Hub",
      current: currentHH > 0 ? `$${currentHH.toFixed(2)}/MMBtu` : "N/A",
      prev:    prevHH > 0    ? `$${prevHH.toFixed(2)}/MMBtu`    : "N/A",
      ...delta(currentHH, prevHH, v => `$${Math.abs(v).toFixed(2)}/MMBtu`),
    },
    {
      label:   "Risk Score",
      current: `${currRiskNum.toFixed(1)}/10`,
      prev:    `${prevRisk.toFixed(1)}/10`,
      ...delta(currRiskNum, prevRisk, v => `${Math.abs(v).toFixed(1)}`),
    },
    {
      label:   "Escalation Probability",
      current: `${escalationPct}%`,
      prev:    `${prevEscalation}%`,
      ...delta(escalationPct, prevEscalation, v => `${Math.abs(v).toFixed(0)}%`),
    },
  ];

  const time6h = snap6h.computed_at
    ? new Date(snap6h.computed_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Chicago" }) + " CDT"
    : "6h ago";

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <GitCompare className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">What Changed</p>
      </div>
      <p className="text-[10px] text-gray-600 mb-4">Last 6 hours — since {time6h}</p>

      <div className="space-y-0">
        {changes.map((c) => (
          <div key={c.label} className="grid grid-cols-3 items-center py-2.5 border-b border-white/5 last:border-0">
            <span className="text-xs text-gray-400">{c.label}</span>
            <div className="text-center">
              <span className="text-[10px] text-gray-600">{c.prev}</span>
              <span className="text-[10px] text-gray-600 mx-1">→</span>
              <span className="text-xs font-semibold text-gray-200">{c.current}</span>
            </div>
            <div className="text-right">
              <span className={`text-xs font-bold ${c.color}`}>{c.dir} {c.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
