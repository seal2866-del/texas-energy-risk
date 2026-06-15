"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, Minus, RefreshCw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

interface WahaData {
  henry_hub:    { price: number; unit: string; source: string };
  waha:         { price: number; unit: string; source: string; report_date?: string };
  spread:       number;
  spread_pct:   number;
  signal:       string;
  signal_color: string;
  signal_label: string;
  insight:      string;
  thresholds:   { normal_max: number; wide: number; blowout: number };
  computed_at:  string;
  error?:       string;
}

const SIGNAL_STYLES: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  BLOWOUT: { bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-400",    icon: <AlertTriangle className="w-4 h-4" /> },
  WIDE:    { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", icon: <TrendingDown className="w-4 h-4" /> },
  NORMAL:  { bg: "bg-green-500/10",  border: "border-green-500/30",  text: "text-green-400",  icon: <Minus className="w-4 h-4" /> },
  PREMIUM: { bg: "bg-blue-500/10",   border: "border-blue-500/30",   text: "text-blue-400",   icon: <TrendingUp className="w-4 h-4" /> },
};

export default function WahaBasisSpread() {
  const [data,     setData]     = useState<WahaData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [lastFetch, setLastFetch] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/signals/waha-basis`);
      setData(await r.json());
      setLastFetch(Date.now());
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 15 * 60 * 1000); return () => clearInterval(t); }, []);

  const sig   = data?.signal ?? "NORMAL";
  const style = SIGNAL_STYLES[sig] ?? SIGNAL_STYLES.NORMAL;

  // Spread bar: 0–$6 scale, capped
  const barPct = data ? Math.min(100, (Math.abs(data.spread) / 6) * 100) : 0;
  const barColor = sig === "BLOWOUT" ? "bg-red-500" : sig === "WIDE" ? "bg-orange-500" : sig === "PREMIUM" ? "bg-blue-500" : "bg-green-500";

  return (
    <div className="bg-[#0f1729] border border-white/8 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Waha / Henry Hub Basis</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Permian Basin pipeline constraint signal</p>
        </div>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data ? (
        <div className="space-y-2 animate-pulse">
          {[40, 60, 30].map(w => <div key={w} className="h-4 bg-white/5 rounded" style={{ width: `${w}%` }} />)}
        </div>
      ) : data?.error ? (
        <p className="text-xs text-red-400">{data.error}</p>
      ) : data ? (
        <>
          {/* Price row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/3 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Henry Hub</p>
              <p className="text-lg font-black text-white">${data.henry_hub.price.toFixed(2)}</p>
              <p className="text-[10px] text-gray-600">$/MMBtu</p>
            </div>
            <div className="bg-white/3 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Waha Hub</p>
              <p className="text-lg font-black text-white">${data.waha.price.toFixed(2)}</p>
              <p className="text-[10px] text-gray-600">$/MMBtu</p>
            </div>
            <div className={`${style.bg} border ${style.border} rounded-xl p-3 text-center`}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Spread</p>
              <p className={`text-lg font-black ${style.text}`}>
                {data.spread >= 0 ? "-" : "+"}{Math.abs(data.spread).toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-600">$/MMBtu</p>
            </div>
          </div>

          {/* Spread bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-gray-600 mb-1">
              <span>Normal (${data.thresholds.normal_max})</span>
              <span>Wide (${data.thresholds.wide})</span>
              <span>Blowout (${data.thresholds.blowout}+)</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${barPct}%` }} />
            </div>
          </div>

          {/* Signal badge */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${style.bg} border ${style.border} mb-3`}>
            <span className={style.text}>{style.icon}</span>
            <span className={`text-xs font-bold ${style.text}`}>{sig}</span>
            <span className="text-xs text-gray-400 ml-1">— {data.signal_label}</span>
          </div>

          {/* Insight */}
          <p className="text-[11px] text-gray-400 leading-relaxed">{data.insight}</p>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <span className="text-[10px] text-gray-600">
              Waha: {data.waha.source}{data.waha.report_date ? ` · ${data.waha.report_date}` : ""}
            </span>
            <span className="text-[10px] text-gray-600">
              {new Date(data.computed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
