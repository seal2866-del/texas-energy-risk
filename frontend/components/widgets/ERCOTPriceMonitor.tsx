"use client";
import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Clock, WifiOff, AlertTriangle } from "lucide-react";
import type { ERCOTPrice } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface Props {
  prices:   ERCOTPrice[];
  loading?: boolean;
}

const PRICE_LOW_FLOOR    = 10;
const PRICE_HIGH_WARNING = 150;
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
  if (age < 1)  return "realtime";
  if (age < 15) return "delayed";
  return "stale";
}

const F = {
  realtime: { label: "Real-time", bg: "bg-green-500/10", border: "border-green-500/25", text: "text-green-400", dot: "bg-green-400" },
  delayed:  { label: "Delayed",   bg: "bg-yellow-500/10", border: "border-yellow-500/25", text: "text-yellow-400", dot: "bg-yellow-400" },
  stale:    { label: "Stale",     bg: "bg-red-500/10",    border: "border-red-500/25",    text: "text-red-400",   dot: "bg-red-400" },
};

export default function ERCOTPriceMonitor({ prices, loading }: Props) {
  const [hours, setHours] = useState<12 | 24>(12);

  const latest  = prices[prices.length - 1];
  const prev    = prices[prices.length - 2];
  const current = latest?.price_mwh ?? 0;
  const prevVal = prev?.price_mwh ?? current;

  const isRealSource  = latest?.source === "ercot_cdr";
  const cacheSize     = prices.length;
  const outsideNormal = current >= PRICE_HIGH_WARNING;
  const ageMinutes    = latest?.timestamp ? getAgeMinutes(latest.timestamp) : 999;
  const freshness     = cacheSize > 0 ? getFreshness(ageMinutes) : "stale";
  const fc            = F[freshness];
  const lastUpdate    = latest?.timestamp ? formatTimestamp(latest.timestamp) : null;
  const ageLabel      = ageMinutes < 1 ? "< 1 min ago" : `${Math.floor(ageMinutes)} min ago`;

  const { pct, display, reliable } = safePctChange(current, prevVal);
  const up = pct !== null ? pct >= 0 : current > prevVal;

  const strokeColor = outsideNormal ? "#ef4444" : "#f97316";
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

  // Visual-only micro-variation: makes flat lines look natural, real tooltip values unchanged
  const displayChartData = chartData.map((d, i) => ({
    ...d,
    visualPrice: isLowVolatility && d.price > 0
      ? d.price + Math.sin(i * 1.73 + 0.5) * 0.35 + Math.sin(i * 0.91 + 1.2) * 0.18
      : d.price,
  }));

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
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">ERCOT Price Monitor</p>
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
          {outsideNormal && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-semibold">
              <AlertTriangle className="w-3 h-3" />
              Outside normal range
            </span>
          )}
        </div>

        <div className="text-right">
          {loading ? (
            <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
          ) : cacheSize === 0 ? (
            <p className="text-xl font-black text-gray-500">
              &mdash;<span className="text-sm font-normal text-gray-600">/MWh</span>
            </p>
          ) : (
            <>
              <p className={`text-xl font-black ${outsideNormal ? "text-red-400" : "text-white"}`}>
                {formatPrice(current)}<span className="text-sm font-normal text-gray-400">/MWh</span>
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
              {current >= PRICE_HIGH_WARNING * 0.6 && (
                <ReferenceLine y={PRICE_HIGH_WARNING} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.4} />
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
