"use client";
import { TrendingUp, TrendingDown, Minus, Flame } from "lucide-react";

interface HenryHubData {
  price:             number;
  daily_change_pct:  number;
  weekly_change_pct: number;
  market_state:      "normal" | "watch" | "elevated" | "critical";
  watch_threshold:   number;
  unit:              string;
  report_date:       string;
  source:            string;
}

interface Props {
  data?: HenryHubData | null;
  compact?: boolean;
}

const STATE_CONFIG = {
  normal:   { label: "Normal",   color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20",  dot: "bg-green-500"  },
  watch:    { label: "Watch",    color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20",  dot: "bg-amber-500"  },
  elevated: { label: "Elevated", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", dot: "bg-orange-500" },
  critical: { label: "Critical", color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",    dot: "bg-red-500"    },
};

const THRESHOLDS = [
  { label: "Normal",   value: "$3.00", state: "normal"   },
  { label: "Watch",    value: "$4.00", state: "watch"    },
  { label: "Elevated", value: "$6.00", state: "elevated" },
  { label: "Critical", value: ">$6.00",state: "critical" },
];

function ChangeChip({ value, label }: { value: number; label: string }) {
  const positive = value > 0;
  const neutral  = Math.abs(value) < 0.01;
  const color    = neutral ? "text-gray-400" : positive ? "text-red-400" : "text-green-400";
  const Icon     = neutral ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <div className="flex flex-col items-center">
      <div className={`flex items-center gap-1 text-xs font-bold ${color}`}>
        <Icon className="w-3 h-3" />
        {neutral ? "0.0%" : `${positive ? "+" : ""}${value.toFixed(1)}%`}
      </div>
      <span className="text-[9px] text-gray-600 uppercase tracking-wide">{label}</span>
    </div>
  );
}

export default function HenryHubWidget({ data, compact = false }: Props) {
  if (!data) {
    return (
      <div className="card-glass border border-white/8 rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-white/5 rounded w-32 mb-3" />
        <div className="h-8 bg-white/5 rounded w-24 mb-2" />
        <div className="h-3 bg-white/5 rounded w-48" />
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
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Henry Hub</p>
            <p className={`text-sm font-black ${cfg.color}`}>${data.price.toFixed(3)}<span className="text-[10px] font-normal text-gray-500 ml-0.5">/MMBtu</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ChangeChip value={data.daily_change_pct}  label="1D" />
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
            {cfg.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-glass border ${cfg.border} rounded-2xl p-5`}>
      {/* Header */}
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
        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
          {cfg.label}
        </span>
      </div>

      {/* Price */}
      <div className="mb-4">
        <p className={`text-3xl font-black ${cfg.color}`}>
          ${data.price.toFixed(3)}
          <span className="text-sm font-normal text-gray-500 ml-1">/MMBtu</span>
        </p>
        <p className="text-[10px] text-gray-600 mt-0.5">As of {data.report_date} · EIA</p>
      </div>

      {/* Change row */}
      <div className="flex gap-4 mb-4 pb-4 border-b border-white/5">
        <ChangeChip value={data.daily_change_pct}  label="Daily" />
        <ChangeChip value={data.weekly_change_pct} label="Weekly" />
        <div className="flex flex-col items-center">
          <div className="text-xs font-bold text-gray-400">${data.watch_threshold.toFixed(2)}</div>
          <span className="text-[9px] text-gray-600 uppercase tracking-wide">Next Threshold</span>
        </div>
      </div>

      {/* Threshold ladder */}
      <div className="space-y-1.5">
        <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Market States</p>
        {THRESHOLDS.map((t) => {
          const tcfg    = STATE_CONFIG[t.state as keyof typeof STATE_CONFIG];
          const active  = t.state === data.market_state;
          return (
            <div
              key={t.state}
              className={`flex items-center justify-between px-2 py-1 rounded-lg transition-all ${
                active ? `${tcfg.bg} border ${tcfg.border}` : "opacity-40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${tcfg.dot}`} />
                <span className={`text-xs font-semibold ${active ? tcfg.color : "text-gray-500"}`}>{t.label}</span>
              </div>
              <span className={`text-[10px] font-mono ${active ? tcfg.color : "text-gray-600"}`}>{t.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
