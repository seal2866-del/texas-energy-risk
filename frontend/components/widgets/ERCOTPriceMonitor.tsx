"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ERCOTPrice } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface Props {
  prices:   ERCOTPrice[];
  loading?: boolean;
}

const PRICE_LOW_FLOOR    = 10;   // Task 1: below this, % change is unreliable
const PRICE_HIGH_WARNING = 150;  // above this, show "outside normal range"

/** Task 1 — Safe % change that guards against tiny denominators. */
function safePctChange(current: number, prev: number): { pct: number | null; display: string; reliable: boolean } {
  if (prev < PRICE_LOW_FLOOR) {
    return { pct: null, display: "Large movement detected", reliable: false };
  }
  const pct = ((current - prev) / prev) * 100;
  const sign = pct >= 0 ? "+" : "";
  return { pct, display: `${sign}${Math.abs(pct).toFixed(1)}% vs prev`, reliable: true };
}

export default function ERCOTPriceMonitor({ prices, loading }: Props) {
  const latest   = prices[prices.length - 1];
  const previous = prices[prices.length - 2];
  const current  = latest?.price_mwh   ?? 0;
  const prev     = previous?.price_mwh ?? current;

  // Source label — show "verified" badge when reading is from live ERCOT CDR
  const isRealSource    = latest?.source === "ercot_cdr";
  const hasEnoughData   = prices.length >= 2;
  const cacheSize       = prices.length;

  const { pct, display, reliable } = safePctChange(current, prev);
  const up       = pct !== null ? pct >= 0 : current > prev;
  const outsideNormal = current >= PRICE_HIGH_WARNING;

  const chartData = prices.slice(-24).map((p) => ({
    time:  new Date(p.timestamp).toLocaleTimeString("en-US", {
             hour: "numeric", timeZone: "America/Chicago"
           }),
    price: p.price_mwh,
  }));

  // Dynamic stroke color based on price level
  const strokeColor = outsideNormal ? "#ef4444" : "#f97316";
  const gradientId  = outsideNormal ? "priceGradHigh" : "priceGrad";

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-[#0d1428] border border-white/10 rounded-lg p-2 text-xs">
          <p className="text-gray-400">{payload[0].payload.time}</p>
          <p className="text-white font-semibold">{formatPrice(payload[0].value)}/MWh</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`card-glass p-6 border transition-all ${outsideNormal ? "border-red-500/20" : "border-white/5"}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            ERCOT Price Monitor
          </p>
          {/* Source verification label */}
          <p className="text-xs text-gray-600 mt-0.5">
            {isRealSource
              ? "HB_HOUSTON — ERCOT Real-Time Market (verified)"
              : "HB_HOUSTON — Real-time"}
          </p>
          {/* Cache-building notice */}
          {!loading && cacheSize < 2 && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-500 text-xs">
              {cacheSize === 0 ? "Awaiting first reading…" : `${cacheSize}/2 readings — building cache`}
            </span>
          )}
          {/* Task 7 — Outside normal range badge */}
          {outsideNormal && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-semibold">
              Outside normal range
            </span>
          )}
        </div>
        <div className="text-right">
          {loading ? (
            <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
          ) : (
            <>
              <p className={`text-2xl font-black ${outsideNormal ? "text-red-400" : "text-white"}`}>
                {formatPrice(current)}
                <span className="text-sm font-normal text-gray-400">/MWh</span>
              </p>
              {/* Task 1 — Safe % change display */}
              <div className={`flex items-center justify-end gap-1 text-xs mt-0.5 ${
                !reliable ? "text-amber-400" : up ? "text-green-400" : "text-red-400"
              }`}>
                {!reliable
                  ? <Minus className="w-3 h-3" />
                  : up
                  ? <TrendingUp className="w-3 h-3" />
                  : <TrendingDown className="w-3 h-3" />
                }
                {display}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-32">
        {loading ? (
          <div className="h-full bg-white/5 rounded animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="priceGradHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: "#6b7280" }}
                interval="preserveStartEnd"
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip content={<CustomTooltip />} />
              {/* Reference line at $150 threshold */}
              <ReferenceLine
                y={PRICE_HIGH_WARNING}
                stroke="#f97316"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-600">
        Informational only. Not trading advice.
      </p>
    </div>
  );
}
