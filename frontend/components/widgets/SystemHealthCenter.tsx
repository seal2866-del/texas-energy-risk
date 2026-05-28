"use client";
import { Activity, Wifi, WifiOff, Clock, CheckCircle2, AlertTriangle,
         XCircle, Radio, Brain, Database, Zap } from "lucide-react";
import type { SignalsResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props { signals: SignalsResponse; aiLoading: boolean; aiSynced: boolean; }

type HealthStatus = "nominal" | "degraded" | "offline";

interface HealthRow {
  label:   string;
  status:  HealthStatus;
  detail:  string;
  icon:    React.ReactNode;
}

const STATUS_CFG = {
  nominal:  { cls: "text-green-400",  bg: "bg-green-500/10  border-green-500/20",  dot: "bg-green-400",  icon: CheckCircle2, label: "Nominal"  },
  degraded: { cls: "text-amber-400",  bg: "bg-amber-500/10  border-amber-500/20",  dot: "bg-amber-400",  icon: AlertTriangle, label: "Degraded" },
  offline:  { cls: "text-red-400",    bg: "bg-red-500/10    border-red-500/20",    dot: "bg-red-400",    icon: XCircle,       label: "Offline"  },
} as const;

function HealthItem({ row }: { row: HealthRow }) {
  const cfg = STATUS_CFG[row.status];
  const DotIcon = cfg.icon;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className={cn("flex-shrink-0", row.status === "nominal" ? "text-teal-500/50" : cfg.cls)}>
        {row.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{row.label}</p>
        <p className="text-xs text-gray-400 truncate">{row.detail}</p>
      </div>
      <span className={cn(
        "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border flex-shrink-0",
        cfg.bg, cfg.cls,
      )}>
        <span className={cn("w-1 h-1 rounded-full", cfg.dot,
          row.status === "nominal" ? "opacity-60" : "animate-pulse"
        )} />
        {cfg.label}
      </span>
    </div>
  );
}

export default function SystemHealthCenter({ signals, aiLoading, aiSynced }: Props) {
  const { data_sources, confidence, computed_at } = signals;

  const ercotStatus = data_sources?.ercot?.status;
  const noaaStatus  = data_sources?.noaa?.status;
  const eiaStatus   = data_sources?.eia?.status;

  const toHealth = (s?: string): HealthStatus =>
    s === "active" ? "nominal" : s === "stale" ? "degraded" : "offline";

  const ercotAge = data_sources?.ercot?.age_minutes;
  const noaaAge  = data_sources?.noaa?.age_minutes;
  const eiaAge   = data_sources?.eia?.age_minutes;

  const fmtAge = (m: number | null | undefined) =>
    m == null ? "age unknown" : m < 2 ? "< 2 min ago" : `${Math.round(m)} min ago`;

  const rows: HealthRow[] = [
    {
      label:  "ERCOT Price Feed",
      status: toHealth(ercotStatus),
      detail: ercotAge != null ? `Last reading ${fmtAge(ercotAge)}` : "Real-time settlement point data",
      icon:   <Zap className="w-3.5 h-3.5" />,
    },
    {
      label:  "NOAA Weather Forecast",
      status: toHealth(noaaStatus),
      detail: noaaAge != null ? `Updated ${fmtAge(noaaAge)}` : "7-day demand forecast",
      icon:   <Activity className="w-3.5 h-3.5" />,
    },
    {
      label:  "EIA Gas Storage",
      status: toHealth(eiaStatus),
      detail: eiaAge != null ? `Updated ${fmtAge(eiaAge)}` : "Weekly storage & Henry Hub",
      icon:   <Database className="w-3.5 h-3.5" />,
    },
    {
      label:  "AI Reasoning Engine",
      status: aiLoading ? "degraded" : aiSynced ? "nominal" : "degraded",
      detail: aiLoading ? "Generating analysis…" : aiSynced ? "Interpretation ready" : "Pending sync",
      icon:   <Brain className="w-3.5 h-3.5" />,
    },
    {
      label:  "Signal Analysis Engine",
      status: signals.data_valid ? "nominal" : "degraded",
      detail: computed_at
        ? `Last computed ${new Date(computed_at).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}`
        : "Awaiting data",
      icon:   <Radio className="w-3.5 h-3.5" />,
    },
  ];

  const allNominal  = rows.every(r => r.status === "nominal");
  const degradedCnt = rows.filter(r => r.status === "degraded").length;
  const offlineCnt  = rows.filter(r => r.status === "offline").length;
  const overallStatus: HealthStatus =
    offlineCnt >= 2 ? "offline" : (offlineCnt >= 1 || degradedCnt >= 2) ? "degraded" : "nominal";
  const overallCfg = STATUS_CFG[overallStatus];

  return (
    <div className="card-glass border border-white/5 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border",
            allNominal ? "bg-green-500/8 border-green-500/20" : overallCfg.bg,
          )}>
            <Wifi className={cn("w-4 h-4", allNominal ? "text-green-400" : overallCfg.cls)} />
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">System Health</h2>
            <p className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-wide font-medium">
              Telemetry · AI · Analysis Engines
            </p>
          </div>
        </div>
        <span className={cn(
          "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border whitespace-nowrap",
          allNominal ? "bg-green-500/8 border-green-500/20 text-green-400" : overallCfg.bg + " " + overallCfg.cls,
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full", overallCfg.dot, allNominal ? "opacity-60" : "animate-pulse")} />
          {allNominal ? "All Systems Nominal" : `${degradedCnt + offlineCnt} Issue${degradedCnt + offlineCnt > 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Confidence */}
      {confidence != null && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-white/3 border border-white/6 flex items-center justify-between gap-3">
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Analysis Confidence</p>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1 bg-white/8 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", confidence >= 75 ? "bg-green-500" : confidence >= 60 ? "bg-amber-500" : "bg-red-500")}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className={cn(
              "text-xs font-bold tabular-nums",
              confidence >= 75 ? "text-green-400" : confidence >= 60 ? "text-amber-400" : "text-red-400",
            )}>{confidence}%</span>
          </div>
        </div>
      )}

      {/* Health rows */}
      <div>
        {rows.map((r, i) => <HealthItem key={i} row={r} />)}
      </div>
    </div>
  );
}
