"use client";
/**
 * RiskMomentumChart.tsx
 * Phase 9 — Predictive Intelligence Engine
 * Risk numeric over time with momentum slope line and trajectory zone shading.
 */
import { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import type { SignalSnapshot } from "@/lib/api";
import { computeRiskTrajectory, trajectoryColor } from "@/lib/riskTrajectory";

interface ChartPoint {
  time:     string;
  risk:     number;
  trend:    number;   // OLS trend line value
  label:    string;
}

function buildTrendLine(values: number[]): number[] {
  const n = values.length;
  if (n < 2) return values;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return values.map((_, i) => Math.max(0, Math.min(10, intercept + slope * i)));
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:00`;
  } catch { return iso; }
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const risk  = payload.find(p => p.name === "risk");
  const trend = payload.find(p => p.name === "trend");
  return (
    <div className="bg-[#0d1428] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="text-gray-400 mb-1">{label}</div>
      {risk  && <div className="text-white">Risk: <span className="font-bold text-orange-300">{risk.value.toFixed(1)}</span>/10</div>}
      {trend && <div className="text-gray-400">Trend: {trend.value.toFixed(1)}</div>}
    </div>
  );
}

interface Props {
  snapshots: SignalSnapshot[];
  windowSize?: number;
}

export default function RiskMomentumChart({ snapshots, windowSize = 48 }: Props) {
  const trajectory = useMemo(() => computeRiskTrajectory(snapshots, windowSize), [snapshots, windowSize]);

  const data: ChartPoint[] = useMemo(() => {
    if (!snapshots.length) return [];
    const window = snapshots.slice(-Math.min(windowSize, snapshots.length));
    const values = window.map(s => s.risk_score_numeric ?? (s.risk_score === "high" ? 8.5 : s.risk_score === "medium" ? 5 : 2));
    const trend  = buildTrendLine(values);
    return window.map((s, i) => ({
      time:  fmtTime(s.computed_at),
      risk:  Math.round(values[i] * 100) / 100,
      trend: Math.round(trend[i] * 100) / 100,
      label: s.risk_score ?? "unknown",
    }));
  }, [snapshots, windowSize]);

  const trajColor = trajectory ? trajectoryColor(trajectory.trajectory) : "#f59e0b";

  if (!data.length) {
    return (
      <div className="card-glass border border-white/5 rounded-2xl p-5">
        <div className="text-xs text-gray-600 text-center py-8">No snapshot data available.</div>
      </div>
    );
  }

  return (
    <div className="card-glass border border-white/5 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white">Risk Momentum</h2>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {data.length} readings · {windowSize}h window
          </div>
        </div>
        {trajectory && (
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: trajColor }} />
              <span className="font-semibold" style={{ color: trajColor }}>{trajectory.trajectory}</span>
            </div>
            <div className="text-gray-500">Momentum: {trajectory.momentum}</div>
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={trajColor} stopOpacity={0.22} />
              <stop offset="95%" stopColor={trajColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fill: "#4b5563" }}
            tickLine={false}
            axisLine={false}
            interval={Math.max(1, Math.floor(data.length / 8))}
          />
          <YAxis
            domain={[0, 10]}
            ticks={[0, 2, 5, 8.5, 10]}
            tick={{ fontSize: 9, fill: "#4b5563" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Risk zone bands */}
          <ReferenceLine y={7}   stroke="rgba(239,68,68,0.12)"  strokeDasharray="3 3" />
          <ReferenceLine y={4}   stroke="rgba(245,158,11,0.12)" strokeDasharray="3 3" />

          {/* Area */}
          <Area
            type="monotone"
            dataKey="risk"
            stroke={trajColor}
            strokeWidth={2}
            fill="url(#riskGrad)"
            dot={false}
            activeDot={{ r: 4, stroke: trajColor, strokeWidth: 2, fill: "#0d1428" }}
          />

          {/* Trend line */}
          <Line
            type="monotone"
            dataKey="trend"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1}
            strokeDasharray="5 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-3 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ backgroundColor: trajColor }} />
          <span className="text-[10px] text-gray-500">Risk score</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded bg-white/30" style={{ backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,0.3) 0,rgba(255,255,255,0.3) 5px,transparent 5px,transparent 8px)" }} />
          <span className="text-[10px] text-gray-500">OLS trend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded bg-amber-500/40" style={{ backgroundImage: "repeating-linear-gradient(90deg,rgba(245,158,11,0.4) 0,rgba(245,158,11,0.4) 3px,transparent 3px,transparent 6px)" }} />
          <span className="text-[10px] text-gray-500">Risk thresholds</span>
        </div>
        {trajectory && (
          <div className="ml-auto text-[10px] text-gray-600">
            Slope: {trajectory.recentSlope > 0 ? "+" : ""}{trajectory.recentSlope} · Vol: {trajectory.volatilityIndex}
          </div>
        )}
      </div>
    </div>
  );
}
