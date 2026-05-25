"use client";
import { Database, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import type { DataSources as DataSourcesType } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  sources:    DataSourcesType;
  computedAt: string;
}

const SOURCE_META = {
  ercot: { label: "ERCOT Real-Time Market", detail: "Power prices (HB_HOUSTON)" },
  noaa:  { label: "NOAA / NWS Weather",     detail: "Forecast demand risk" },
  eia:   { label: "EIA Natural Gas",         detail: "Weekly storage report" },
};

function StatusBadge({ status }: { status: "active" | "stale" | "unavailable" }) {
  if (status === "active") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 border border-green-500/20 text-green-400">
      <CheckCircle2 className="w-3 h-3" />Active
    </span>
  );
  if (status === "stale") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
      <AlertTriangle className="w-3 h-3" />Stale
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400">
      <XCircle className="w-3 h-3" />Unavailable
    </span>
  );
}

function formatAge(minutes: number | null): string {
  if (minutes === null) return "unknown";
  if (minutes < 1)      return "< 1 min ago";
  if (minutes < 60)     return `${Math.round(minutes)}m ago`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

export default function DataSources({ sources, computedAt }: Props) {
  const anyIssue = Object.values(sources).some(s => s.status !== "active");

  return (
    <div className={cn(
      "card-glass p-6 border",
      anyIssue ? "border-amber-500/20" : "border-white/5"
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className={cn("w-4 h-4", anyIssue ? "text-amber-400" : "text-gray-500")} />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Data Sources</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Clock className="w-3 h-3" />
          {new Date(computedAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <div className="space-y-3">
        {(Object.entries(SOURCE_META) as [keyof typeof SOURCE_META, typeof SOURCE_META[keyof typeof SOURCE_META]][]).map(([key, meta]) => {
          const src = sources[key];
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-300 truncate">{meta.label}</p>
                <p className="text-xs text-gray-600">{meta.detail}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <StatusBadge status={src.status} />
                {src.age_minutes !== null && (
                  <span className="text-xs text-gray-600 font-mono">{formatAge(src.age_minutes)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {anyIssue && (
        <div className="mt-4 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200/70 leading-relaxed">
          One or more data sources are delayed. Confidence scores are adjusted accordingly.
        </div>
      )}

      <p className="mt-3 text-xs text-gray-700 leading-relaxed">
        Data source health affects signal confidence. Unavailable sources reduce confidence by 15%.
      </p>
    </div>
  );
}
