"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { Flame } from "lucide-react";
import type { GasRecord, Signal } from "@/lib/api";
import { cn, riskBg, riskColor } from "@/lib/utils";

interface Props {
  records: GasRecord[];
  latest:  GasRecord | null;
  signal:  Signal;
}

export default function GasSupply({ records, latest, signal }: Props) {
  const triggered = signal.triggered;
  const severity  = signal.severity;

  const chartData = records.map((r) => ({
    date:    r.report_date,
    storage: r.storage_bcf,
    avg:     r.storage_5yr_avg_bcf,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-[#0d1428] border border-white/10 rounded-lg p-2 text-xs">
          <p className="text-gray-400">{payload[0].payload.date}</p>
          <p className="text-white">{payload[0].value.toFixed(0)} Bcf</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={cn(
      "card-glass p-6 border",
      triggered ? riskBg(severity) : "border-white/5"
    )}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Natural Gas Supply Pressure
          </p>
          <p className="text-xs text-gray-600 mt-0.5">EIA working gas storage</p>
        </div>
        <Flame className={cn("w-5 h-5", triggered ? riskColor(severity) : "text-gray-600")} />
      </div>

      {/* Key metrics */}
      {latest && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Storage",     value: `${latest.storage_bcf.toFixed(0)} Bcf` },
            { label: "vs 5yr Avg",  value: `${latest.storage_pct_vs_avg > 0 ? "+" : ""}${latest.storage_pct_vs_avg.toFixed(1)}%`, colored: true },
            { label: "Henry Hub",   value: `$${latest.henry_hub_price?.toFixed(2) ?? "—"}/MMBtu` },
          ].map(({ label, value, colored }) => (
            <div key={label} className="bg-white/3 rounded-lg p-2.5 text-center">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={cn(
                "text-sm font-bold",
                colored
                  ? latest.storage_pct_vs_avg <= -10
                    ? "text-red-400"
                    : latest.storage_pct_vs_avg >= 5
                    ? "text-green-400"
                    : "text-amber-400"
                  : "text-white"
              )}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Bar chart */}
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#6b7280" }} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={latest?.storage_5yr_avg_bcf ?? 2310} stroke="#6b7280" strokeDasharray="3 3" />
            <Bar dataKey="storage" fill={triggered ? (severity === "high" ? "#ef4444" : "#f59e0b") : "#f97316"} radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {triggered && (
        <div className={cn("mt-3 p-3 rounded-lg border text-xs text-gray-300 leading-relaxed", riskBg(severity))}>
          {signal.message}
        </div>
      )}
    </div>
  );
}
