"use client";
import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Minus, RefreshCw, GitBranch } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

interface Spread {
  hub:        string;
  label:      string;
  price:      number;
  spread:     number;
  spread_pct: number;
  direction:  string;
  alert:      boolean;
  color:      string;
}

interface GridData {
  computed_at: string;
  hub_prices:  Record<string, number | null>;
  spreads:     Spread[];
  base_hub:    string;
  base_price:  number | null;
}

export default function MultiHubSpread() {
  const [data, setData]       = useState<GridData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/ercot/grid`);
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const hasAlert = data?.spreads.some(s => s.alert) ?? false;

  return (
    <div className={`card-glass rounded-2xl border overflow-hidden ${hasAlert ? "border-orange-500/25" : "border-white/8"}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className={`w-4 h-4 ${hasAlert ? "text-orange-400" : "text-blue-400"}`} />
          <div>
            <h3 className="text-sm font-bold text-white">ERCOT Hub Price Spreads</h3>
            <p className="text-[10px] text-gray-500">vs HB_HOUSTON · Real-time settlement</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasAlert && (
            <span className="px-2 py-0.5 rounded-lg bg-orange-500/15 border border-orange-500/25 text-[10px] text-orange-400 font-bold">
              SPREAD ALERT
            </span>
          )}
          <button onClick={load} disabled={loading}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
            <RefreshCw className={`w-3 h-3 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="px-4 pb-4 space-y-2 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="h-10 bg-white/5 rounded-xl" />)}
        </div>
      )}

      {data && (
        <div className="px-4 pb-4 space-y-2">
          {/* Base hub */}
          <div className="rounded-xl bg-orange-500/8 border border-orange-500/15 p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500">HB_HOUSTON (Base)</p>
              <p className="text-xs text-gray-400">Houston Hub — benchmark</p>
            </div>
            <p className="text-xl font-black text-orange-400">
              {data.base_price ? `$${data.base_price.toFixed(2)}` : "—"}
              <span className="text-[10px] text-gray-500 font-normal ml-1">/MWh</span>
            </p>
          </div>

          {/* Spread rows */}
          {data.spreads.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-4">Hub prices unavailable</p>
          )}
          {data.spreads.map(s => (
            <div key={s.hub}
              className={`rounded-xl border p-3 flex items-center justify-between transition-all
                ${s.alert ? "bg-orange-500/8 border-orange-500/20" : "bg-white/3 border-white/8"}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-xs font-bold text-white">{s.label}</p>
                  <p className="text-[10px] text-gray-600">{s.hub}</p>
                  {s.alert && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold">WIDE</span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500">
                  {s.spread > 0 ? `$${s.spread.toFixed(2)} above` : `$${Math.abs(s.spread).toFixed(2)} below`} Houston
                  {" · "}{s.spread_pct > 0 ? "+" : ""}{s.spread_pct.toFixed(1)}%
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <p className="text-sm font-black" style={{ color: s.color }}>
                  ${s.price.toFixed(2)}
                </p>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center`}
                  style={{ backgroundColor: s.color + "20" }}>
                  {s.spread > 1  ? <ArrowUp   className="w-3 h-3" style={{ color: s.color }} /> :
                   s.spread < -1 ? <ArrowDown  className="w-3 h-3" style={{ color: s.color }} /> :
                                   <Minus      className="w-3 h-3 text-gray-500" />}
                </div>
              </div>
            </div>
          ))}

          {/* West hub insight */}
          {data.hub_prices?.["HB_WEST"] !== null && data.hub_prices?.["HB_HOUSTON"] !== null && (() => {
            const westSpread = (data.hub_prices["HB_WEST"] ?? 0) - (data.base_price ?? 0);
            if (Math.abs(westSpread) > 10) return (
              <div className="rounded-xl bg-blue-500/5 border border-blue-500/15 p-2.5">
                <p className="text-[10px] text-blue-300 font-semibold mb-0.5">West Hub Insight</p>
                <p className="text-[10px] text-gray-400">
                  {westSpread > 10
                    ? "HB_WEST trading above Houston — wind curtailment or transmission constraint likely in West Texas"
                    : "HB_WEST trading below Houston — excess West Texas wind generation, low congestion cost"}
                </p>
              </div>
            );
            return null;
          })()}

          <p className="text-[10px] text-gray-600 italic">
            Spreads vs HB_HOUSTON · 5-min cache · ERCOT real-time settlement prices
          </p>
        </div>
      )}
    </div>
  );
}
