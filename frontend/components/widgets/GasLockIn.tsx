"use client";
import { useEffect, useState } from "react";
import { Lock, Unlock, Eye, RefreshCw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

interface LockInData {
  spot_price:      number;
  futures_price:   number;
  futures_note:    string;
  unit:            string;
  avg_30d:         number | null;
  volatility_pct:  number;
  signal:          string;
  signal_color:    string;
  reason:          string;
  action:          string;
  contango:        number;
  contango_pct:    number;
  vs_30d_avg:      number | null;
  vs_30d_pct:      number | null;
  source:          string;
  computed_at:     string;
  error?:          string;
}

const SIGNAL_CFG: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; label: string }> = {
  "LOCK IN":       { bg: "bg-green-500/10",  border: "border-green-500/30",  text: "text-green-400",  icon: <Lock className="w-4 h-4" />,   label: "Lock In Fixed Price" },
  "MONITOR":       { bg: "bg-amber-500/10",  border: "border-amber-500/30",  text: "text-amber-400",  icon: <Eye className="w-4 h-4" />,    label: "Monitor — No Action Yet" },
  "STAY FLOATING": { bg: "bg-blue-500/10",   border: "border-blue-500/30",   text: "text-blue-400",   icon: <Unlock className="w-4 h-4" />, label: "Stay on Index Pricing" },
  "UNAVAILABLE":   { bg: "bg-white/5",       border: "border-white/10",      text: "text-gray-400",   icon: <Eye className="w-4 h-4" />,    label: "Data Unavailable" },
};

export default function GasLockIn() {
  const [data,    setData]    = useState<LockInData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/signals/gas-lock-in`);
      setData(await r.json());
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 30 * 60 * 1000); return () => clearInterval(t); }, []);

  const sig   = data?.signal ?? "MONITOR";
  const cfg   = SIGNAL_CFG[sig] ?? SIGNAL_CFG["MONITOR"];
  const contango = data?.contango ?? 0;

  return (
    <div className="bg-[#0f1729] border border-white/8 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Gas Contract Lock-In</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Spot vs near-month futures · volatility signal</p>
        </div>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data ? (
        <div className="space-y-2 animate-pulse">
          {[50, 70, 40].map(w => <div key={w} className="h-4 bg-white/5 rounded" style={{ width: `${w}%` }} />)}
        </div>
      ) : data?.error ? (
        <p className="text-xs text-red-400">{data.error}</p>
      ) : data ? (
        <>
          {/* Prices */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/3 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Spot (HH)</p>
              <p className="text-lg font-black text-white">${data.spot_price.toFixed(2)}</p>
              <p className="text-[10px] text-gray-600">$/MMBtu</p>
            </div>
            <div className="bg-white/3 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Near-Mo Fut</p>
              <p className="text-lg font-black text-white">${data.futures_price.toFixed(2)}</p>
              <p className="text-[10px] text-gray-600">$/MMBtu</p>
            </div>
            <div className="bg-white/3 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Vol (Ann)</p>
              <p className={`text-lg font-black ${data.volatility_pct >= 40 ? "text-orange-400" : "text-white"}`}>
                {data.volatility_pct > 0 ? `${data.volatility_pct.toFixed(0)}%` : "—"}
              </p>
              <p className="text-[10px] text-gray-600">annualised</p>
            </div>
          </div>

          {/* Contango/Backwardation bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>← Backwardation (float)</span>
              <span className="text-gray-600">Flat</span>
              <span>Contango (lock in) →</span>
            </div>
            <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="absolute left-1/2 top-0 w-px h-full bg-white/20" />
              {contango >= 0 ? (
                <div className="absolute left-1/2 h-full bg-green-500 rounded-r-full transition-all duration-700"
                  style={{ width: `${Math.min(50, (contango / 2) * 50)}%` }} />
              ) : (
                <div className="absolute h-full bg-blue-500 rounded-l-full transition-all duration-700"
                  style={{ right: "50%", width: `${Math.min(50, (Math.abs(contango) / 2) * 50)}%` }} />
              )}
            </div>
            <p className="text-[10px] text-gray-600 mt-1 text-center">
              {contango >= 0 ? `+$${contango.toFixed(2)}` : `-$${Math.abs(contango).toFixed(2)}`}/MMBtu
              {" "}({data.contango_pct > 0 ? "+" : ""}{data.contango_pct.toFixed(1)}%)
            </p>
          </div>

          {/* Signal badge */}
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${cfg.bg} border ${cfg.border} mb-3`}>
            <span className={cfg.text}>{cfg.icon}</span>
            <div>
              <span className={`text-xs font-black ${cfg.text}`}>{sig}</span>
              <span className="text-xs text-gray-400 ml-2">— {cfg.label}</span>
            </div>
          </div>

          {/* Reason + Action */}
          <p className="text-[11px] text-gray-400 leading-relaxed mb-2">{data.reason}</p>
          <div className="bg-white/3 rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Recommended Action</p>
            <p className="text-[11px] text-gray-200">{data.action}</p>
          </div>

          {/* Stats row */}
          {(data.avg_30d || data.vs_30d_pct !== null) && (
            <div className="flex gap-4 mt-3 pt-3 border-t border-white/5">
              {data.avg_30d && (
                <div>
                  <p className="text-[10px] text-gray-600">30d Avg</p>
                  <p className="text-xs text-gray-300 font-semibold">${data.avg_30d.toFixed(2)}</p>
                </div>
              )}
              {data.vs_30d_pct !== null && (
                <div>
                  <p className="text-[10px] text-gray-600">vs 30d Avg</p>
                  <p className={`text-xs font-semibold ${(data.vs_30d_pct ?? 0) > 0 ? "text-orange-400" : "text-green-400"}`}>
                    {(data.vs_30d_pct ?? 0) > 0 ? "+" : ""}{data.vs_30d_pct?.toFixed(1)}%
                  </p>
                </div>
              )}
              <div className="ml-auto text-right">
                <p className="text-[10px] text-gray-600">Source</p>
                <p className="text-[10px] text-gray-500">{data.source}</p>
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-600 mt-2 italic">{data.futures_note}</p>
        </>
      ) : null}
    </div>
  );
}
