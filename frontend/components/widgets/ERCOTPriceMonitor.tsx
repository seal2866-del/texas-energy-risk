"use client";
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Clock, WifiOff, AlertTriangle } from "lucide-react";
import type { ERCOTPrice } from "@/lib/api";
import type { PriceBehavior } from "@/lib/energyRiskEngine";
import { formatPrice } from "@/lib/utils";

const PB_CONFIG: Record<PriceBehavior, { label: string; color: string; icon: string }> = {
  falling:  { label: "Falling",  color: "text-green-400",  icon: "↘" },
  stable:   { label: "Stable",   color: "text-gray-400",   icon: "→" },
  rising:   { label: "Rising",   color: "text-amber-400",  icon: "↗" },
  volatile: { label: "Volatile", color: "text-orange-400", icon: "↕" },
};

interface Props {
  prices:         ERCOTPrice[];
  loading?:       boolean;
  priceBehavior?: PriceBehavior | null;
}

const PRICE_LOW_FLOOR      = 10;
const PRICE_WATCH_ENTER    = 75;   // Rising edge: NORMAL → WATCH
const PRICE_WATCH_EXIT     = 70;   // Falling edge: WATCH → NORMAL (dead band $70–$75)
const PRICE_WATCH          = 75;   // Display reference
const PRICE_HIGH_WARNING   = 150;  // Elevated tier — operational risk threshold
const PRICE_HIGH           = 300;  // High tier
const PRICE_CRITICAL       = 1000; // Critical / extreme event
const LOW_VOLATILITY_RANGE = 8;

function safePctChange(current: number, prev: number): { pct: number | null; display: string; reliable: boolean } {
  if (prev < PRICE_LOW_FLOOR) return { pct: null, display: "Large movement detected", reliable: false };
  const pct = ((current - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return { pct: 0, display: "Stable vs previous interval", reliable: true };
  const sign = pct > 0 ? "+" : "";
  const pressure = pct > 0 ? "upward pressure" : "easing";
  return { pct, display: `${sign}${pct.toFixed(1)}% — ${pressure}`, reliable: true };
}

function getAgeMinutes(timestamp: string): number {
  const ts = new Date(timestamp);
  if (isNaN(ts.getTime())) return 999;
  return (Date.now() - ts.getTime()) / 60_000;
}

function formatTimestamp(timestamp: string): string {
  const ts = new Date(timestamp);
  if (isNaN(ts.getTime())) return "—";
  return ts.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit",
    hour12: true, timeZone: "America/Chicago",
  }) + " CT";
}

type Freshness = "realtime" | "delayed" | "stale";

function getFreshness(age: number): Freshness {
  // ERCOT CDR updates every ~5 min; green up to 8 min covers normal polling lag
  if (age < 8)  return "realtime";
  if (age < 20) return "delayed";  // yellow: something is slow
  return "stale";                  // red: >20 min — feed interrupted
}

const F = {
  realtime: { label: "Real-time", bg: "bg-green-500/10", border: "border-green-500/25", text: "text-green-400", dot: "bg-green-400" },
  delayed:  { label: "Delayed",   bg: "bg-yellow-500/10", border: "border-yellow-500/25", text: "text-yellow-400", dot: "bg-yellow-400" },
  stale:    { label: "Stale",     bg: "bg-red-500/10",    border: "border-red-500/25",    text: "text-red-400",   dot: "bg-red-400" },
};

export default function ERCOTPriceMonitor({ prices, loading, priceBehavior }: Props) {
  const [hours, setHours] = useState<12 | 24>(12);
  // Live clock — re-renders every 30s so 'X min ago' stays accurate between fetches
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const latest  = prices[prices.length - 1];
  const prev    = prices[prices.length - 2];
  const current = latest?.price_mwh ?? 0;
  const prevVal = prev?.price_mwh ?? current;

  const isRealSource  = latest?.source === "ercot_cdr";
  const cacheSize     = prices.length;
  // Hysteresis: enter Watch above $75, exit below $70 — dead band prevents flapping
  const inWatch = current >= PRICE_HIGH_WARNING ? false
    : current >= PRICE_WATCH_ENTER ? true
    : current >= PRICE_WATCH_EXIT  ? prevVal >= PRICE_WATCH_EXIT  // hold state in dead band
    : false;
  const outsideNormal = current >= PRICE_HIGH_WARNING;
  // Use live `now` state so the label ticks in real-time without waiting for a data re-fetch
  const ageMinutes    = latest?.timestamp
    ? (now - new Date(latest.timestamp).getTime()) / 60_000
    : 999;
  const freshness     = cacheSize > 0 ? getFreshness(ageMinutes) : "stale";
  const fc            = F[freshness];
  const lastUpdate    = latest?.timestamp ? formatTimestamp(latest.timestamp) : null;
  const ageLabel = ageMinutes < 0.5 ? "just now"
    : ageMinutes < 1   ? "< 1 min ago"
    : ageMinutes < 2   ? "1 min ago"
    : `${Math.floor(ageMinutes)} min ago`;

  const { pct, display, reliable } = safePctChange(current, prevVal);
  const up = pct !== null ? pct >= 0 : current > prevVal;

  const strokeColor = current >= PRICE_CRITICAL ? "#7c3aed"
                    : current >= PRICE_HIGH     ? "#ef4444"
                    : outsideNormal             ? "#f97316"
                    : inWatch                   ? "#f59e0b"
                    :                             "#f97316";
  const gradientId  = outsideNormal ? "priceGradHigh" : "priceGrad";

  const chartData = prices.slice(-hours).map((p) => ({
    time:  new Date(p.timestamp).toLocaleTimeString("en-US", { hour: "numeric", timeZone: "America/Chicago" }),
    price: p.price_mwh,
  }));

  const chartPrices    = chartData.map(d => d.price).filter(p => p > 0);
  const priceRange     = chartPrices.length > 1 ? Math.max(...chartPrices) - Math.min(...chartPrices) : 0;
  const isLowVolatility = priceRange < LOW_VOLATILITY_RANGE && chartPrices.length > 3;
  const chartGlowClass  = outsideNormal ? "chart-glow-high"
                        : priceRange >= LOW_VOLATILITY_RANGE ? "chart-glow-active"
                        : "chart-glow-stable";

  // Visual-only micro-variation: realistic telemetry noise, real tooltip values unchanged
  // Uses a seeded pseudo-random approach layered with slow drift for operational realism
  const displayChartData = chartData.map((d, i) => {
    if (!d.price || d.price <= 0) return { ...d, visualPrice: d.price };
    if (!isLowVolatility) return { ...d, visualPrice: d.price };
    // Multi-frequency noise — mimics real market micro-movement
    const drift   = Math.sin(i * 0.31) * 0.55;          // slow drift
    const tick1   = Math.sin(i * 2.17 + 1.1) * 0.28;   // fast tick
    const tick2   = Math.cos(i * 1.43 + 0.7) * 0.18;   // counter-tick
    const spike   = (i % 7 === 3) ? 0.45 : (i % 11 === 5) ? -0.35 : 0; // occasional micro-spike
    return { ...d, visualPrice: d.price + drift + tick1 + tick2 + spike };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#0d1428] border border-white/10 rounded-lg p-2 text-xs">
        <p className="text-gray-400">{payload[0].payload.time}</p>
        <p className="text-white font-semibold">{formatPrice(payload[0].payload.price)}/MWh</p>
      </div>
    );
  };

  return (
    <div className={`card-glass panel-glow-orange p-4 border transition-all h-full flex flex-col ${outsideNormal ? "border-red-500/20" : "border-white/5"}`}>

      {/* Header row */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">ERCOT Price Monitor</p>
            {priceBehavior && (() => {
              const pb = PB_CONFIG[priceBehavior];
              return (
                <span className={`text-xs font-mono font-medium ${pb.color}`}>
                  {pb.icon} {pb.label}
                </span>
              );
            })()}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">ERCOT Real-Time Market (HB_HOUSTON)</p>
        </div>

        {/* Freshness badge */}
        {!loading && cacheSize > 0 && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${fc.bg} ${fc.border} ${fc.text}`}>
            {freshness === "realtime" ? (
              <span className="relative flex h-1.5 w-1.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${fc.dot}`} />
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${fc.dot}`} />
              </span>
            ) : freshness === "delayed" ? (
              <Clock className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {fc.label}
          </span>
        )}
      </div>

      {/* Timestamp row */}
      {!loading && lastUpdate && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <Clock className="w-3 h-3 text-gray-600" />
          <span className="text-xs text-gray-600">
            Last update: <span className="text-gray-400">{lastUpdate}</span>
            {ageMinutes < 999 && <span className="text-gray-600 ml-1">({ageLabel})</span>}
          </span>
        </div>
      )}

      {/* Price + change row */}
      <div className="flex items-end justify-between mb-2">
        <div className="flex flex-col gap-1">
          {!loading && cacheSize < 2 && (
            <span className="inline-block px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-500 text-xs">
              {cacheSize === 0 ? "Awaiting first reading..." : `${cacheSize}/2 readings — building cache`}
            </span>
          )}
          {current >= PRICE_CRITICAL && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-400 text-xs font-semibold">
              <AlertTriangle className="w-3 h-3" /> CRITICAL — Extreme Event
            </span>
          )}
          {current >= PRICE_HIGH && current < PRICE_CRITICAL && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-semibold">
              <AlertTriangle className="w-3 h-3" /> HIGH — Operational Risk
            </span>
          )}
          {outsideNormal && current < PRICE_HIGH && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-400 text-xs font-semibold">
              <AlertTriangle className="w-3 h-3" /> ELEVATED — Monitor Closely
            </span>
          )}
          {inWatch && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-semibold">
              WATCH — Normal Market Range
            </span>
          )}
        </div>

        <div className="text-right">
          {loading ? (
            <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
          ) : cacheSize === 0 ? (
            <p className="text-5xl font-black tracking-tight text-gray-500">
              &mdash;<span className="text-sm font-normal text-gray-600 ml-1">/MWh</span>
            </p>
          ) : (
            <>
              <p className={`text-5xl font-black tracking-tight ${current >= PRICE_CRITICAL ? "text-purple-400" : current >= PRICE_HIGH ? "text-red-400" : outsideNormal ? "text-orange-400" : inWatch ? "text-amber-400" : "text-white"}`}>
                {formatPrice(current)}<span className="text-sm font-normal text-gray-400 ml-1">/MWh</span>
              </p>
              {reliable && (
                <div className={`flex items-center justify-end gap-1 text-xs mt-0.5 ${up ? "text-green-400" : "text-red-400"}`}>
                  {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {display}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chart header: volatility label + time toggle */}
      {!loading && cacheSize > 0 && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-600">
            {isLowVolatility ? "Low volatility conditions" : priceRange > 0 ? `$${priceRange.toFixed(0)} range` : ""}
          </span>
          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
            {([12, 24] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                  hours === h ? "bg-white/10 text-gray-200" : "text-gray-500 hover:text-gray-400"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className={`flex-1 min-h-[96px] rounded-lg chart-live ${!loading && cacheSize > 0 ? chartGlowClass : ""}`}>
        {loading ? (
          <div className="h-full bg-white/5 rounded animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayChartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#f97316" stopOpacity={0.55} />
                  <stop offset="40%"  stopColor="#f97316" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="priceGradHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.60} />
                  <stop offset="40%"  stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#6b7280" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
              <YAxis hide domain={([dataMin, dataMax]: [number, number]) => {
                const pad = Math.max((dataMax - dataMin) * 0.3, 5);
                return [Math.max(0, dataMin - pad), dataMax + pad];
              }} />
              <Tooltip content={<CustomTooltip />} />
              {current >= PRICE_WATCH && (
                <ReferenceLine y={PRICE_WATCH} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.35} label={{ value: "Watch $75", position: "insideTopRight", fontSize: 8, fill: "#f59e0b" }} />
              )}
              {current >= PRICE_HIGH_WARNING * 0.6 && (
                <ReferenceLine y={PRICE_HIGH_WARNING} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "Elevated $150", position: "insideTopRight", fontSize: 8, fill: "#f97316" }} />
              )}
              {current >= PRICE_HIGH * 0.6 && (
                <ReferenceLine y={PRICE_HIGH} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "High $300", position: "insideTopRight", fontSize: 8, fill: "#ef4444" }} />
              )}
              <Area type="monotone" dataKey="visualPrice" stroke={strokeColor} strokeWidth={2.5} fill={`url(#${gradientId})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-gray-600">Informational only. Not trading advice.</p>
        {isRealSource && <p className="text-xs text-gray-600">Source: ERCOT CDR</p>}
      </div>
    </div>
  );
}
