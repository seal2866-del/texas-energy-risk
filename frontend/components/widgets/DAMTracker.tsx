"use client";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, Clock } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

interface DAMData {
  available:      boolean;
  message?:       string;
  avg_dam?:       number;
  avg_remaining?: number;
  rt_price?:      number;
  spread?:        number;
  spread_pct?:    number;
  signal?:        string;
  signal_color?:  string;
  rationale?:     string;
  peak_hours?:    number[];
  cheap_hours?:   number[];
  max_dam?:       number;
  min_dam?:       number;
}

function fmtHour(h: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}${ampm}`;
}

export default function DAMTracker() {
  const [data, setData]       = useState<DAMData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/signals/dam`);
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setInterval(load, 60*60*1000); return () => clearInterval(t); }, []);

  const signalIcon = data?.signal === "LOCK IN"
    ? <TrendingDown className="w-4 h-4 text-green-400" />
    : data?.signal === "STAY FLOATING"
    ? <TrendingUp   className="w-4 h-4 text-red-400" />
    : <Minus        className="w-4 h-4 text-amber-400" />;

  return (
    <div className="card-glass border border-white/8 rounded-2xl overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Day-Ahead vs Real-Time</h3>
            <p className="text-[10px] text-gray-500">DAM posts ~2PM CT · Lock-in signal</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
          <RefreshCw className={`w-3 h-3 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data && (
        <div className="px-4 pb-4 space-y-2 animate-pulse">
          {[1,2,3].map(i=><div key={i} className="h-10 bg-white/5 rounded-xl"/>)}
        </div>
      )}

      {data && !data.available && (
        <div className="px-4 pb-4 space-y-3">
          {/* Waiting state */}
          <div className="rounded-xl bg-amber-500/8 border border-amber-500/15 p-3 flex items-start gap-2">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300">Awaiting Today's DAM Results</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                ERCOT posts Day-Ahead Market prices daily around 1:30–2:00 PM CT.
                Check back this afternoon for the lock-in signal.
              </p>
            </div>
          </div>

          {/* RT context while waiting */}
          <div className="rounded-xl bg-white/3 border border-white/8 p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Current Real-Time Reference</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">RT Price Now</p>
                <p className="text-lg font-black text-orange-400">
                  ${data.rt_price?.toFixed(2) ?? "—"}
                  <span className="text-[10px] text-gray-500 font-normal ml-1">/MWh</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">DAM Posts At</p>
                <p className="text-lg font-black text-white">2:00 PM
                  <span className="text-[10px] text-gray-500 font-normal ml-1">CT</span>
                </p>
              </div>
            </div>
          </div>

          {/* What the signal means */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">How to use this signal</p>
            {[
              { signal: "LOCK IN", color: "text-green-400", bg: "bg-green-500/8 border-green-500/15", desc: "RT above DAM by $15+ — index buyers overpaying, lock in forward price" },
              { signal: "STAY FLOATING", color: "text-red-400", bg: "bg-red-500/8 border-red-500/15", desc: "DAM above RT by $15+ — real-time cheaper, stay on index" },
              { signal: "MONITOR", color: "text-amber-400", bg: "bg-amber-500/8 border-amber-500/15", desc: "Spread within $15 — no clear advantage either way" },
            ].map(s => (
              <div key={s.signal} className={`rounded-xl border p-2.5 flex items-center gap-2 ${s.bg}`}>
                <span className={`text-[10px] font-black w-24 flex-shrink-0 ${s.color}`}>{s.signal}</span>
                <p className="text-[10px] text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-gray-600 italic">
            DAM vs RT spread updates automatically once results post · Not financial advice
          </p>
        </div>
      )}

      {data?.available && (
        <div className="px-4 pb-4 space-y-3">
          {/* Signal banner */}
          <div className="rounded-xl border p-3 flex items-start gap-2"
            style={{ borderColor: (data.signal_color ?? "#f59e0b") + "30",
                     backgroundColor: (data.signal_color ?? "#f59e0b") + "10" }}>
            {signalIcon}
            <div>
              <p className="text-xs font-black mb-0.5" style={{ color: data.signal_color }}>
                {data.signal}
              </p>
              <p className="text-[10px] text-gray-300">{data.rationale}</p>
            </div>
          </div>

          {/* Price comparison */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/3 border border-white/8 p-2.5 text-center">
              <p className="text-[10px] text-gray-500 mb-1">RT Now</p>
              <p className="text-sm font-black text-orange-400">
                ${data.rt_price?.toFixed(0)}<span className="text-[9px] text-gray-500 font-normal">/MWh</span>
              </p>
            </div>
            <div className="rounded-xl bg-white/3 border border-white/8 p-2.5 text-center">
              <p className="text-[10px] text-gray-500 mb-1">DAM Avg</p>
              <p className="text-sm font-black text-purple-400">
                ${data.avg_remaining?.toFixed(0)}<span className="text-[9px] text-gray-500 font-normal">/MWh</span>
              </p>
            </div>
            <div className="rounded-xl bg-white/3 border border-white/8 p-2.5 text-center">
              <p className="text-[10px] text-gray-500 mb-1">Spread</p>
              <p className={`text-sm font-black ${(data.spread ?? 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                {(data.spread ?? 0) > 0 ? "+" : ""}${data.spread?.toFixed(0)}
                <span className="text-[9px] text-gray-500 font-normal">/MWh</span>
              </p>
            </div>
          </div>

          {/* DAM range */}
          <div className="rounded-xl bg-white/3 border border-white/8 p-3">
            <p className="text-[10px] text-gray-500 mb-2">DAM Price Range Today</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-400 font-bold">${data.min_dam?.toFixed(0)}</span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-red-500 rounded-full" />
              </div>
              <span className="text-xs text-red-400 font-bold">${data.max_dam?.toFixed(0)}</span>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">Min / Max settlement prices today</p>
          </div>

          {/* Peak + cheap hours */}
          {data.cheap_hours && data.cheap_hours.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-green-500/5 border border-green-500/15 p-2.5">
                <p className="text-[10px] text-green-400 font-semibold mb-1.5">Cheapest Hours</p>
                <div className="flex flex-wrap gap-1">
                  {data.cheap_hours.slice(0,4).map(h=>(
                    <span key={h} className="text-[10px] bg-green-500/15 text-green-300 px-1.5 py-0.5 rounded">
                      {fmtHour(h)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-2.5">
                <p className="text-[10px] text-red-400 font-semibold mb-1.5">Peak Hours</p>
                <div className="flex flex-wrap gap-1">
                  {data.peak_hours?.slice(0,4).map(h=>(
                    <span key={h} className="text-[10px] bg-red-500/15 text-red-300 px-1.5 py-0.5 rounded">
                      {fmtHour(h)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-600 italic">
            DAM prices from ERCOT CDR · Cached 1 hour · Not financial advice
          </p>
        </div>
      )}
    </div>
  );
}
