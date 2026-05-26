"use client";
import { Database, CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck, ShieldAlert } from "lucide-react";
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

type DisplayStatus = "active" | "stale" | "unavailable" | "pending_confirmation";

function StatusBadge({ status }: { status: DisplayStatus }) {
  if (status === "active") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 border border-green-500/20 text-green-400">
      <CheckCircle2 className="w-3 h-3" />Active
    </span>
  );
  if (status === "pending_confirmation") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400">
      <ShieldAlert className="w-3 h-3" />Confirming
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
  const ercot = sources.ercot as any;
  const anyIssue = Object.values(sources).some(s => s.status !== "active");

  // ERCOT-specific verification fields injected by signal_engine
  const verificationStatus: DisplayStatus = ercot?.verification_status ?? ercot?.status ?? "unavailable";
  const verificationReason: string | null  = ercot?.verification_reason ?? null;
  const lastValidPrice: number | null      = ercot?.last_valid_price ?? null;
  const priceRange: string                 = ercot?.price_range ?? "normal";

  const priceRangeColor =
    priceRange === "extreme"  ? "text-red-400" :
    priceRange === "elevated" ? "text-amber-400" : "text-gray-400";

  return (
    <div className={cn(
      "card-glass p-6 border",
      anyIssue ? "border-amber-500/20" : "border-white/5"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className={cn("w-4 h-4", anyIssue ? "text-amber-400" : "text-gray-500")} />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Data Sources</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Clock className="w-3 h-3" />
          {new Date(computedAt).toLocaleTimeString("en-US", {
            timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit"
          })}
        </div>
      </div>

      <div className="space-y-4">
        {/* ERCOT — enhanced with verification detail */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-300">ERCOT Real-Time Market</p>
              <p className="text-xs text-gray-600">Power prices (HB_HOUSTON)</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <StatusBadge status={verificationStatus} />
              {ercot?.age_minutes !== null && ercot?.age_minutes !== undefined && (
                <span className="text-xs text-gray-600 font-mono">{formatAge(ercot.age_minutes)}</span>
              )}
            </div>
          </div>

          {/* Verification detail panel */}
          {(lastValidPrice !== null || verificationReason) && (
            <div className="mt-2 pl-3 border-l border-white/5 space-y-0.5">
              {lastValidPrice !== null && (
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-gray-600 flex-shrink-0" />
                  <span className="text-xs text-gray-500">
                    Last valid price:{" "}
                    <span className={`font-semibold font-mono ${priceRangeColor}`}>
                      ${lastValidPrice.toFixed(2)}/MWh
                    </span>
                    {priceRange !== "normal" && (
                      <span className={`ml-1 ${priceRangeColor}`}>({priceRange})</span>
                    )}
                  </span>
                </div>
              )}
              {verificationReason && (
                <p className="text-xs text-gray-600 italic">{verificationReason}</p>
              )}
            </div>
          )}
        </div>

        {/* NOAA and EIA — standard rows */}
        {(["noaa", "eia"] as const).map((key) => {
          const src = sources[key];
          const meta = SOURCE_META[key];
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-300 truncate">{meta.label}</p>
                <p className="text-xs text-gray-600">{meta.detail}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <StatusBadge status={src.status as DisplayStatus} />
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
