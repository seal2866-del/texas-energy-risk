"use client";
import { TrendingUp, TrendingDown, Minus, Flame } from "lucide-react";

import { type HenryHubData } from "@/lib/api";
type PricePoint = { date: string; price: number };

interface Props {
  data?: HenryHubData | null;
  compact?: boolean;
}

const STATE_CONFIG = {
  normal:   { label: "Normal",   color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20",  dot: "bg-green-500",  line: "#4ade80" },
  watch:    { label: "Watch",    color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20",  dot: "bg-amber-500",  line: "#fbbf24" },
  elevated: { label: "Elevated", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", dot: "bg-orange-500", line: "#f97316" },
  critical: { label: "Critical", color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",    dot: "bg-red-500",    line: "#f87171" },
};

const THRESHOLDS = [
  { label: "Normal",   max: 3.00, color: "rgba(74,222,128,0.08)"  },
  { label: "Watch",    max: 4.00, color: "rgba(251,191,36,0.08)"  },
  { label: "Elevated", max: 6.00, color: "rgba(249,115,22,0.08)"  },
  { label: "Critical", max: 9.00, color: "rgba(248,113,113,0.08)" },
];

function ChangeChip({ value, label }: { value: number; label: string }) {
  const positive = value > 0;
  const neutral  = Math.abs(value) < 0.01;
  const color    = neutral ? "text-gray-400" : positive ? "text-red-400" : "text-green-400";
  const Icon     = neutral ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`flex items-center gap-1 text-sm font-bold ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        {neutral ? "0.0%" : `${positive ? "+" : ""}${value.toFixed(1)}%`}
      </div>
      <span className="text-[9px] text-gray-600 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function PriceChart({ history, marketState }: { history: PricePoint[]; marketState: string }) {
  if (!history || history.length < 2) return null;

  const W = 400;
  const H = 120;
  const PAD = { top: 12, right: 16, bottom: 24, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top  - PAD.bottom;

  const prices  = history.map(p => p.price);
  const minP    = Math.min(...prices, 2.0);
  const maxP    = Math.max(...prices, 3.5);
  const range   = maxP - minP || 1;
  const padded  = range * 0.15;
  const yMin    = Math.max(0, minP - padded);
  const yMax    = maxP + padded;
  const yRange  = yMax - yMin;

  const toX = (i: number) => PAD.left + (i / (history.length - 1)) * chartW;
  const toY = (p: number) => PAD.top + chartH - ((p - yMin) / yRange) * chartH;

  // SVG path
  const linePath = history.map((pt, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(pt.price).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${toX(history.length - 1).toFixed(1)} ${(PAD.top + chartH).toFixed(1)} L ${PAD.left.toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`;

  const cfg = STATE_CONFIG[marketState as keyof typeof STATE_CONFIG] || STATE_CONFIG.normal;

  // Threshold band lines (only those visible in range)
  const thresholdLines = [
    { price: 3.00, label: "$3", color: "#4ade80" },
    { price: 4.00, label: "$4", color: "#fbbf24" },
    { price: 6.00, label: "$6", color: "#f97316" },
  ].filter(t => t.price >= yMin && t.price <= yMax);

  // Y-axis labels
  const yTicks = [yMin, (yMin + yMax) / 2, yMax].map(v => ({ val: v, y: toY(v) }));

  // X-axis date labels (first, mid, last)
  const xLabels = [0, Math.floor(history.length / 2), history.length - 1].map(i => ({
    label: history[i]?.date?.slice(5) ?? "",
    x: toX(i),
  }));

  // Current price dot
  const lastX = toX(history.length - 1);
  const lastY = toY(history[history.length - 1].price);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="hh-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={cfg.line} stopOpacity="0.25" />
          <stop offset="100%" stopColor={cfg.line} stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="hh-clip">
          <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
        </clipPath>
      </defs>

      {/* Threshold bands */}
      {thresholdLines.map(t => (
        <g key={t.price}>
          <line
            x1={PAD.left} y1={toY(t.price)}
            x2={PAD.left + chartW} y2={toY(t.price)}
            stroke={t.color} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.4"
          />
          <text x={PAD.left - 4} y={toY(t.price) + 3.5} textAnchor="end"
            fill={t.color} fontSize="8" opacity="0.7">{t.label}</text>
        </g>
      ))}

      {/* Y-axis ticks */}
      {yTicks.map(({ val, y }) => (
        <text key={val} x={PAD.left - 4} y={y + 3.5} textAnchor="end"
          fill="#4b5563" fontSize="8">${val.toFixed(2)}</text>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#hh-area)" clipPath="url(#hh-clip)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke={cfg.line} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" clipPath="url(#hh-clip)" />

      {/* Data dots */}
      {history.map((pt, i) => (
        <circle key={i} cx={toX(i)} cy={toY(pt.price)} r="2"
          fill={cfg.line} opacity="0.5" clipPath="url(#hh-clip)" />
      ))}

      {/* Current price dot (larger) */}
      <circle cx={lastX} cy={lastY} r="4" fill={cfg.line} opacity="0.9" />
      <circle cx={lastX} cy={lastY} r="7" fill={cfg.line} opacity="0.15" />

      {/* X-axis labels */}
      {xLabels.map(({ label, x }, i) => (
        <text key={i} x={x} y={H - 4} textAnchor="middle" fill="#4b5563" fontSize="8">{label}</text>
      ))}
    </svg>
  );
}

export default function HenryHubWidget({ data, compact = false }: Props) {
  if (!data) {
    return (
      <div className="card-glass border border-white/8 rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-white/5 rounded w-32 mb-3" />
        <div className="h-10 bg-white/5 rounded w-28 mb-2" />
        <div className="h-3 bg-white/5 rounded w-48 mb-4" />
        <div className="h-24 bg-white/5 rounded" />
      </div>
    );
  }

  const cfg = STATE_CONFIG[data.market_state] || STATE_CONFIG.normal;

  if (compact) {
    return (
      <div className={`card-glass border ${cfg.border} rounded-xl p-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Flame className={`w-4 h-4 ${cfg.color}`} />
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Henry Hub <span className="text-gray-600 normal-case">· Daily EIA</span></p>
            <p className={`text-sm font-black ${cfg.color}`}>
              ${data.price.toFixed(3)}
              <span className="text-[10px] font-normal text-gray-500 ml-0.5">/MMBtu</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ChangeChip value={data.daily_change_pct} label="1D" />
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
            {cfg.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-glass border ${cfg.border} rounded-2xl overflow-hidden`}>
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
              <Flame className={`w-4 h-4 ${cfg.color}`} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Henry Hub</p>
              <p className="text-[10px] text-gray-600">Natural Gas Spot Price</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-gray-800 border border-white/10 text-gray-500 uppercase tracking-wide">
              Daily EIA · Not Live
            </span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* BIG price number */}
        <div className="mb-1">
          <p className={`text-5xl font-black tracking-tight ${cfg.color}`}>
            ${data.price.toFixed(3)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500">per MMBtu</p>
            <span className="text-[10px] text-gray-600">·</span>
            <p className="text-[11px] text-gray-500">EIA published {data.report_date}</p>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-600 border border-white/8">
              End-of-day · Updated daily
            </span>
          </div>
        </div>

        {/* Change row */}
        <div className="flex items-center gap-6 mt-4 pb-4 border-b border-white/5">
          <ChangeChip value={data.daily_change_pct}  label="Daily Change" />
          <ChangeChip value={data.weekly_change_pct} label="Weekly Change" />
          <div className="flex flex-col items-center gap-0.5">
            <div className="text-sm font-bold text-gray-300">${data.watch_threshold.toFixed(2)}</div>
            <span className="text-[9px] text-gray-600 uppercase tracking-wide">Next Threshold</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 ml-auto">
            <div className="flex gap-1">
              {(["normal","watch","elevated","critical"] as const).map(s => (
                <div key={s}
                  className={`w-2 h-2 rounded-full ${STATE_CONFIG[s].dot} ${s === data.market_state ? "opacity-100 scale-125" : "opacity-25"} transition-all`}
                />
              ))}
            </div>
            <span className="text-[9px] text-gray-600 uppercase tracking-wide">State</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-3 pb-4">
        <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-2 px-2">10-Day Price History</p>
        {data.history && data.history.length >= 2 ? (
          <PriceChart history={data.history} marketState={data.market_state} />
        ) : (
          <div className="h-24 flex items-center justify-center text-[10px] text-gray-600">
            Insufficient history data
          </div>
        )}
      </div>

      {/* Threshold ladder */}
      <div className="px-5 pb-5">
        <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Market Thresholds</p>
        <div className="grid grid-cols-4 gap-1.5">
          {(["normal","watch","elevated","critical"] as const).map(s => {
            const tc     = STATE_CONFIG[s];
            const active = s === data.market_state;
            const labels = { normal: "< $3.00", watch: "$3–$4", elevated: "$4–$6", critical: "> $6" };
            return (
              <div key={s}
                className={`rounded-lg px-2 py-1.5 text-center border transition-all ${
                  active ? `${tc.bg} ${tc.border}` : "border-white/5 opacity-40"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${tc.dot} mx-auto mb-1`} />
                <p className={`text-[9px] font-bold uppercase ${active ? tc.color : "text-gray-500"}`}>{s}</p>
                <p className={`text-[8px] font-mono mt-0.5 ${active ? tc.color : "text-gray-600"}`}>{labels[s]}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
