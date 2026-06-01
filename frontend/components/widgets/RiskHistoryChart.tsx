"use client";
import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from "recharts";
import { TrendingUp, Clock, Radio } from "lucide-react";
import { getSignalHistory, type SignalSnapshot } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  location: string;
}

// ── Colour helpers ────────────────────────────────────────────────────────────
function riskColor(score: number): string {
  if (score >= 7) return "#f87171"; // red-400
  if (score >= 4) return "#fbbf24"; // amber-400
  return "#34d399";                  // green-400
}

function riskLabel(score: number): string {
  if (score >= 7) return "High";
  if (score >= 4) return "Moderate";
  return "Low";
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as SignalSnapshot & { displayTime: string };
  const color = riskColor(d.risk_score_numeric);
  return (
    <div className="bg-[#0d1428] border border-white/10 rounded-xl px-3 py-2.5 text-xs shadow-xl">
      <p className="text-gray-500 mb-1 font-mono">{d.displayTime}</p>
      <p className="font-bold" style={{ color }}>
        {riskLabel(d.risk_score_numeric)} · {d.risk_score_numeric.toFixed(1)}/10
      </p>
      {d.escalation_pct != null && (
        <p className="text-gray-400 mt-0.5">Esc. prob: {d.escalation_pct.toFixed(0)}%</p>
      )}
      {d.ercot_price != null && (
        <p className="text-gray-400">${d.ercot_price.toFixed(2)}/MWh</p>
      )}
      {d.primary_driver && (
        <p className="text-gray-600 mt-0.5 capitalize">{d.primary_driver.replace(/_/g, " ")}</p>
      )}
    </div>
  );
}

// ── Range selector ────────────────────────────────────────────────────────────
const RANGES = [
  { label: "24h",  hours: 24  },
  { label: "48h",  hours: 48  },
  { label: "7d",   hours: 168 },
] as const;

// ── Main component ────────────────────────────────────────────────────────────
export default function RiskHistoryChart({ location }: Props) {
  const [hours,   setHours]   = useState<number>(168);
  const [data,    setData]    = useState<(SignalSnapshot & { displayTime: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty,   setEmpty]   = useState(false);

  useEffect(() => {
    setLoading(true);
    setEmpty(false);
    getSignalHistory(location, hours)
      .then((res) => {
        if (!res.snapshots?.length) { setEmpty(true); setData([]); return; }
        // Sort chronologically — Supabase orders by computed_at but enforce client-side too
        const sorted = [...res.snapshots].sort(
          (a, b) => new Date(a.computed_at).getTime() - new Date(b.computed_at).getTime()
        );
        const mapped = sorted.map((s) => ({
          ...s,
          displayTime: new Date(s.computed_at).toLocaleString("en-US", {
            timeZone:  "America/Chicago",
            month:     "short",
            day:       "numeric",
            hour:      "2-digit",
            minute:    "2-digit",
            timeZoneName: "short",
          }),
        }));
        setData(mapped);
      })
      .catch(() => setEmpty(true))
      .finally(() => setLoading(false));
  }, [location, hours]);

  // Summary stats
  const latest    = data[data.length - 1];
  const avgScore  = data.length
    ? data.reduce((s, d) => s + d.risk_score_numeric, 0) / data.length
    : 0;
  const peakScore = data.length ? Math.max(...data.map(d => d.risk_score_numeric)) : 0;
  const highCount = data.filter(d => d.risk_score_numeric >= 7).length;

  // Dynamic gradient id
  const gradId = "riskGrad";

  return (
    <div className="card-glass border border-white/5 rounded-2xl p-5 lg:col-span-2">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">Risk History</h2>
            <p className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-wide font-medium">
              {location} · Risk Score Over Time
            </p>
          </div>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 bg-white/4 border border-white/8 rounded-lg p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.hours}
              onClick={() => setHours(r.hours)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all",
                hours === r.hours
                  ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                  : "text-gray-600 hover:text-gray-400",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats strip */}
      {!loading && !empty && data.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Current",  value: latest ? `${riskLabel(latest.risk_score_numeric)}` : "—",   sub: latest ? `${latest.risk_score_numeric.toFixed(1)}/10` : "",      color: latest ? riskColor(latest.risk_score_numeric) : "#6b7280" },
            { label: "Avg Score", value: `${avgScore.toFixed(1)}/10`,    sub: `over ${data.length} readings`, color: riskColor(avgScore)  },
            { label: "Peak",      value: `${peakScore.toFixed(1)}/10`,   sub: highCount > 0 ? `${highCount} high-risk interval${highCount > 1 ? "s" : ""}` : "No high-risk periods", color: riskColor(peakScore) },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="px-3 py-2 rounded-lg bg-white/3 border border-white/6">
              <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-sm font-bold" style={{ color }}>{value}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="h-40">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-gray-700 animate-pulse">Loading history...</p>
          </div>
        ) : empty || data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <Clock className="w-5 h-5 text-gray-700" />
            <p className="text-xs text-gray-600">
              No history yet — data accumulates automatically on each dashboard refresh.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#14b8a6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              {/* Reference lines at thresholds */}
              <ReferenceLine y={7} stroke="rgba(248,113,113,0.25)" strokeDasharray="4 3" />
              <ReferenceLine y={4} stroke="rgba(251,191,36,0.2)"   strokeDasharray="4 3" />
              <XAxis
                dataKey="computed_at"
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Chicago" });
                }}
                tick={{ fill: "#374151", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 10]}
                ticks={[0, 4, 7, 10]}
                tick={{ fill: "#374151", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="risk_score_numeric"
                stroke="#14b8a6"
                strokeWidth={1.5}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 3, fill: "#14b8a6", stroke: "#0d1428", strokeWidth: 1.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-gray-700">
        <Radio className="w-3 h-3 text-teal-500/40" />
        <span className="uppercase tracking-wide font-semibold">
          Historical signal analysis · Snapshots every 5 min · Informational only
        </span>
      </div>
    </div>
  );
}
