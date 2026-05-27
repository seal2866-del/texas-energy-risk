"use client";
import { Database, CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck } from "lucide-react";
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

type DisplayStatus = "active" | "delayed" | "stale" | "unavailable" | "pending_confirmation";

// Age-based tiers: Active < 5 min, Delayed 5–60 min, Stale > 60 min
function ageStatus(age: number | null): "active" | "delayed" | "stale" {
  if (age === null || age > 1440) return "stale";
  if (age < 5)  return "active";
  if (age < 60) return "delayed";
  return "stale";
}

function StatusBadge({ status }: { status: DisplayStatus }) {
  if (status === "active") return (
    <span className="data-live inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 border border-green-500/20 text-green-400">
      <CheckCircle2 className="w-3 h-3" />Active
    </span>
  );
  if (status === "pending_confirmation") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400">
      <ShieldCheck className="w-3 h-3" />Confirming
    </span>
  );
  if (status === "delayed") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
      <Clock className="w-3 h-3" />Delayed
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

function formatPrice(p: number): string {
  return p < 0 ? `-$${Math.abs(p).toFixed(2)}` : `$${p.toFixed(2)}`;
}

export default function DataSources({ sources, computedAt }: Props) {
  const anyIssue = Object.values(sources).some(s => {
    const age = s.age_minutes;
    return age === null || age >= 5;
  });

  return (
    <div className={cn(
      "panel-scan card-glass p-6 border",
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

          // ERCOT: use verification_status for richer display
          // All others: derive from age_minutes using universal tiers
          const displayStatus: DisplayStatus =
            key === "ercot" && src.verification_status
              ? (src.verification_status === "real-time" ? "active" : src.verification_status as DisplayStatus)
              : src.status === "unavailable"
                ? "unavailable"
                : ageStatus(src.age_minutes);

          const hasVerifDetail = key === "ercot" && (src.last_valid_price != null || src.verification_reason);

          return (
            <div key={key}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-300 truncate">{meta.label}</p>
                  <p className="text-xs text-gray-500">{meta.detail}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <StatusBadge status={displayStatus} />
                  {src.age_minutes !== null && (
                    <span className="text-xs text-gray-500 font-mono">{formatAge(src.age_minutes)}</span>
                  )}
                </div>
              </div>

              {/* ERCOT verification detail panel */}
              {hasVerifDetail && (
                <div className="mt-1.5 ml-0 pl-2 border-l border-white/10 space-y-0.5">
                  {src.last_valid_price != null && (
                    <p className="text-xs text-gray-500">
                      Last valid price:{" "}
                      <span className={cn(
                        "font-semibold",
                        src.price_range === "extreme"  ? "text-red-400" :
                        src.price_range === "elevated" ? "text-amber-400" :
                        "text-gray-300"
                      )}>
                        {formatPrice(src.last_valid_price)}/MWh
                      </span>
                    </p>
                  )}
                  {src.verification_reason && (
                    <p className="text-xs text-gray-500 italic">{src.verification_reason}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {anyIssue && (
        <div className="mt-4 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200/70 leading-relaxed">
          One or more data sources are delayed. Confidence scores are adjusted accordingly.
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500 leading-relaxed">
        Data source health affects signal confidence. Unavailable sources reduce confidence by 15%.
      </p>
    </div>
  );
}
