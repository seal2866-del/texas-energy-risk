"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Snapshot {
  risk_score?:         string;
  risk_score_numeric?: number;
  computed_at?:        string;
  ercot_price?:        number;
  henry_hub_price?:    number;
}

interface Props {
  snapshots:    Snapshot[];
  currentPrice?:  number;
  currentTemp?:   number;
  currentHH?:     number;
  currentRisk?:   string;
}

interface ChangeRow {
  label:    string;
  current:  string;
  change:   string;
  pct?:     string;
  dir:      "up" | "down" | "flat";
  color:    string;
}

function riskNum(s?: string): number {
  if (s === "high")   return 7.5;
  if (s === "medium") return 4.5;
  return 2.0;
}

function DirIcon({ dir }: { dir: "up" | "down" | "flat" }) {
  if (dir === "up")   return <TrendingUp   className="w-3 h-3" />;
  if (dir === "down") return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
}

export default function WhatChangedYesterday({ snapshots, currentPrice = 0, currentTemp = 0, currentHH = 0, currentRisk = "low" }: Props) {
  // Find snapshot from ~24h ago
  const idx24 = Math.max(0, snapshots.length - 288);
  const snap  = snapshots[idx24] || {};

  const prevPrice = snap.ercot_price      ?? currentPrice;
  const prevHH    = snap.henry_hub_price  ?? currentHH;
  const prevRisk  = riskNum(snap.risk_score) ;
  const currRisk  = riskNum(currentRisk);

  function priceChange(curr: number, prev: number): { change: string; pct: string; dir: "up"|"down"|"flat"; color: string } {
    if (prev <= 0 || curr <= 0) return { change: "N/A", pct: "", dir: "flat", color: "text-gray-500" };
    const d   = curr - prev;
    const p   = Math.round((d / prev) * 100);
    const dir: "up"|"down"|"flat" = Math.abs(d) < 0.01 ? "flat" : d > 0 ? "up" : "down";
    const color = dir === "flat" ? "text-gray-400" : Math.abs(p) >= 10 ? (dir === "up" ? "text-red-400" : "text-green-400") : "text-amber-400";
    return { change: `${d > 0 ? "+" : ""}$${d.toFixed(2)}`, pct: `${d > 0 ? "+" : ""}${p}%`, dir, color };
  }

  const ercotChg = priceChange(currentPrice, prevPrice);
  const hhChg    = priceChange(currentHH, prevHH);

  // Temperature change (no snapshot, use trend estimate)
  const tempDir: "up"|"down"|"flat" = "flat";

  const rows: ChangeRow[] = [
    {
      label:   "ERCOT Price",
      current: currentPrice > 0 ? `$${currentPrice.toFixed(2)}/MWh` : "N/A",
      change:  ercotChg.change,
      pct:     ercotChg.pct,
      dir:     ercotChg.dir,
      color:   ercotChg.color,
    },
    {
      label:   "Henry Hub",
      current: currentHH > 0 ? `$${currentHH.toFixed(2)}/MMBtu` : "N/A",
      change:  hhChg.change,
      pct:     hhChg.pct,
      dir:     hhChg.dir,
      color:   hhChg.color,
    },
    {
      label:   "Temperature",
      current: currentTemp > 0 ? `${currentTemp.toFixed(0)}°F` : "N/A",
      change:  "Monitoring",
      dir:     "flat",
      color:   "text-gray-400",
    },
    {
      label:   "Risk Level",
      current: currentRisk.toUpperCase(),
      change:  currRisk > prevRisk ? `↑ Rising` : currRisk < prevRisk ? `↓ Improving` : "→ Stable",
      dir:     currRisk > prevRisk ? "up" : currRisk < prevRisk ? "down" : "flat",
      color:   currRisk > prevRisk ? "text-red-400" : currRisk < prevRisk ? "text-green-400" : "text-gray-400",
    },
  ];

  const hasChanges = snapshots.length > 288;

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          What Changed Since Yesterday
        </p>
        {!hasChanges && (
          <span className="text-[9px] text-gray-600">Building history — check back after 24h</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {rows.map(row => (
          <div key={row.label} className="bg-white/3 border border-white/5 rounded-xl p-3">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-2">{row.label}</p>
            <p className="text-sm font-black text-white mb-1">{row.current}</p>
            <div className={`flex items-center gap-1 ${row.color}`}>
              <DirIcon dir={row.dir} />
              <span className="text-[10px] font-bold">{row.change}</span>
              {row.pct && <span className="text-[9px] text-gray-500">{row.pct}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
