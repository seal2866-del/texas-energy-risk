"use client";
import { useEffect, useState } from "react";
import { Clock, Zap, TrendingDown, RefreshCw, CheckCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

interface Window6h { start_label: string; end_label: string; avg_price: number; peak_price: number; day: string; }
interface LoadData {
  current_price:   number;
  current_risk:    string;
  temp_tomorrow:   number;
  recommendation:  string;
  best_6h_windows: Window6h[];
  best_4h_windows: Window6h[];
  disclaimer:      string;
}

const RISK_COLORS: Record<string, string> = {
  LOW: "text-green-400", WATCH: "text-amber-400", HIGH: "text-red-400"
};

export default function LoadOptimizer({ location = "Houston" }: { location?: string }) {
  const [data, setData]       = useState<LoadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"6h"|"4h">("6h");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/signals/load-optimizer?location=${encodeURIComponent(location)}`);
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [location]);
  useEffect(() => { const t = setInterval(load, 30*60*1000); return () => clearInterval(t); }, [location]);

  const windows = tab === "6h" ? data?.best_6h_windows ?? [] : data?.best_4h_windows ?? [];

  return (
    <div className="card-glass border border-white/8 rounded-2xl overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Optimal Load Window</h3>
            <p className="text-[10px] text-gray-500">Cheapest hours to run heavy loads · {location}</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
          <RefreshCw className={`w-3 h-3 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {data && (
        <div className="px-4 pb-4 space-y-3">
          {/* Recommendation */}
          <div className="rounded-xl bg-blue-500/8 border border-blue-500/15 p-3 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-blue-300 mb-0.5">Scheduling Recommendation</p>
              <p className="text-xs text-gray-300">{data.recommendation}</p>
            </div>
          </div>

          {/* Context strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/3 border border-white/8 p-2.5 text-center">
              <p className="text-[10px] text-gray-500 mb-1">Current RT</p>
              <p className={`text-sm font-black ${RISK_COLORS[data.current_risk] ?? "text-white"}`}>
                ${data.current_price?.toFixed(0)}<span className="text-[9px] text-gray-500 font-normal">/MWh</span>
              </p>
            </div>
            <div className="rounded-xl bg-white/3 border border-white/8 p-2.5 text-center">
              <p className="text-[10px] text-gray-500 mb-1">Best Avg</p>
              <p className="text-sm font-black text-green-400">
                ${windows[0]?.avg_price?.toFixed(0) ?? "—"}<span className="text-[9px] text-gray-500 font-normal">/MWh</span>
              </p>
            </div>
            <div className="rounded-xl bg-white/3 border border-white/8 p-2.5 text-center">
              <p className="text-[10px] text-gray-500 mb-1">Tmw High</p>
              <p className="text-sm font-black text-white">
                {data.temp_tomorrow?.toFixed(0)}<span className="text-[9px] text-gray-500 font-normal">°F</span>
              </p>
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
            {(["6h","4h"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${tab === t ? "bg-white/12 text-white" : "text-gray-500"}`}>
                {t} Windows
              </button>
            ))}
          </div>

          {/* Windows list */}
          <div className="space-y-1.5">
            {windows.slice(0, 4).map((w, i) => {
              const savings = data.current_price ? Math.round((1 - w.avg_price / data.current_price) * 100) : 0;
              return (
                <div key={i} className={`rounded-xl border p-3 flex items-center justify-between
                  ${i === 0 ? "bg-green-500/8 border-green-500/20" : "bg-white/3 border-white/8"}`}>
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {i === 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-bold">BEST</span>}
                      <p className="text-xs font-bold text-white">{w.start_label} — {w.end_label}</p>
                    </div>
                    <p className="text-[10px] text-gray-500">Peak up to ${w.peak_price?.toFixed(0)}/MWh · {w.day}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${i === 0 ? "text-green-400" : "text-white"}`}>
                      ${w.avg_price?.toFixed(0)}<span className="text-[9px] text-gray-500 font-normal">/MWh</span>
                    </p>
                    {savings > 0 && (
                      <p className="text-[10px] text-green-400 flex items-center gap-0.5 justify-end">
                        <TrendingDown className="w-2.5 h-2.5" />{savings}% vs now
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-gray-600 italic">{data.disclaimer}</p>
        </div>
      )}

      {loading && !data && (
        <div className="px-4 pb-4 space-y-2 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-white/5 rounded-xl" />)}
        </div>
      )}
    </div>
  );
}
