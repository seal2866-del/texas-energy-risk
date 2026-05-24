"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { ERCOTPrice } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface Props {
  prices: ERCOTPrice[];
  loading?: boolean;
}

export default function ERCOTPriceMonitor({ prices, loading }: Props) {
  const latest   = prices[prices.length - 1];
  const previous = prices[prices.length - 2];
  const current  = latest?.price_mwh ?? 0;
  const prev     = previous?.price_mwh ?? current;
  const change   = prev > 0 ? ((current - prev) / prev) * 100 : 0;
  const up       = change >= 0;

  const chartData = prices.slice(-24).map((p) => ({
    time:  new Date(p.timestamp).toLocaleTimeString("en-US", {
             hour: "numeric", timeZone: "America/Chicago"
           }),
    price: p.price_mwh,
  }));

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
    <div className="card-glass p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            ERCOT Price Monitor
          </p>
          <p className="text-xs text-gray-600 mt-0.5">HB_HOUSTON — Real-time</p>
        </div>
        <div className="text-right">
          {loading ? (
            <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-2xl font-black text-white">
                {formatPrice(current)}
                <span className="text-sm font-normal text-gray-400">/MWh</span>
              </p>
              <div className={`flex items-center justify-end gap-1 text-xs mt-0.5 ${up ? "text-green-400" : "text-red-400"}`}>
                {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(change).toFixed(1)}% vs prev hour
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
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#6b7280" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="price" stroke="#f97316" strokeWidth={2} fill="url(#priceGrad)" dot={false} />
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
