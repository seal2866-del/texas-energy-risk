"use client";
import { useEffect } from "react";
import { Database, CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck, BadgeCheck } from "lucide-react";
import type { DataSources as DataSourcesType } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  sources:    DataSourcesType;
  computedAt: string;
}

const SOURCE_META = {
  ercot: { label: "ERCOT Real-Time Market", detail: "Power prices (HB_HOUSTON)",  latencyBase: 45 },
  noaa:  { label: "NOAA / NWS Weather",     detail: "Forecast demand risk",        latencyBase: 90 },
  eia:   { label: "EIA Natural Gas",         detail: "Weekly storage report",       latencyBase: 300 },
};

type DisplayStatus = "active" | "delayed" | "stale" | "unavailable" | "pending_confirmation";

function ageStatus(age: number | null): "active" | "delayed" | "stale" {
  if (age === null || age > 1440) return "stale";
  if (age < 5)  return "active";
  if (age < 60) return "delayed";
  return "stale";
}

function computeConfidence(status: DisplayStatus, age: number | null): number {
  if (status === "unavailable") return 0;
  if (age === null) return 55;
  if (age < 1)   return 98;
  if (age < 5)   return 95;
  if (age < 30)  return 87;
  if (age < 60)  return 78;
  if (age < 120) return 68;
  return 55;
}

function computeLatency(age: number | null, latencyBase: number): string {
  if (age === null) return "—";
  const seconds = Math.round((age * 60 + latencyBase));
  if (seconds < 60)  return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
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
      <XCircle className="w-3 h-3" />Offline
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

function formatFreshness(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1)  return "< 1 min";
  if (minutes < 60) return `< ${Math.ceil(minutes)} min`;
  const h = Math.floor(minutes / 60);
  return `${h}h+`;
}

function formatPrice(p: number): string {
  return p < 0 ? `-$${Math.abs(p).toFixed(2)}` : `$${p.toFixed(2)}`;
}

/** Format a UTC ISO string as HH:MM with correct CDT/CST label */
function fmtCT(isoStr: string | null | undefined): string {
  if (!isoStr) return "—";
  try {
    return new Date(isoStr).toLocaleTimeString("en-US", {
      timeZone: "America/Chicago",
      hour:     "2-digit",
      minute:   "2-digit",
      timeZoneName: "short",
    });
  } catch { return "—"; }
}

/** Compute age in minutes between two ISO strings */
function ageBetween(olderIso: string | null | undefined, newerIso: string | null | undefined): string {
  if (!olderIso || !newerIso) return "—";
  try {
    const diff = (new Date(newerIso).getTime() - new Date(olderIso).getTime()) / 60000;
    if (diff < 0) return "—";
    if (diff < 1) return "< 1 min";
    return `${Math.round(diff)} min`;
  } catch { return "—"; }
}

function ConfidenceBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "bg-green-400" : pct >= 75 ? "bg-amber-400" : pct >= 55 ? "bg-orange-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono font-semibold ${pct >= 90 ? "text-green-400" : pct >= 75 ? "text-amber-400" : "text-orange-400"}`}>
        {pct}%
      </span>
    </div>
  );
}

/** ERCOT source verification badge */
function ErcotVerificationBadge({ src }: { src: DataSourcesType["ercot"] }) {
  const price      = src.price_mwh ?? src.last_valid_price;
  const cdrTs      = src.cdr_updated;    // CDR "Last Updated" string (CDT local, raw from HTML)
  const retrievedAt = src.retrieved_at; // UTC ISO — when our server fetched it
  const ageMin     = src.age_minutes;

  if (price == null) return null;

  // retrieved_at is UTC ISO; cdr_updated is a raw CDR string ("06/01/2026 06:48:00 CT")
  // We show retrieved_at as formatted CT, and cdr_updated as-is since it's already CT
  const retrievedStr = fmtCT(retrievedAt);
  // Try to parse cdr_updated as a date; fall back to raw string
  let sourceTs = cdrTs ?? "—";
  if (cdrTs) {
    try {
      const d = new Date(cdrTs);
      if (!isNaN(d.getTime())) {
        sourceTs = d.toLocaleTimeString("en-US", {
          timeZone: "America/Chicago",
          hour: "2-digit", minute: "2-digit", timeZoneName: "short",
        });
      }
    } catch { /* keep raw */ }
  }

  const ageStr = ageMin !== null ? (ageMin < 1 ? "< 1 min" : `${Math.round(ageMin)} min`) : "—";

  return (
    <div className="mt-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 space-y-1">
      <div className="flex items-center gap-1.5 mb-1">
        <BadgeCheck className="w-3 h-3 text-green-400" />
        <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">ERCOT Verified</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        <span className="text-gray-500">Price</span>
        <span className="text-white font-mono font-semibold">{formatPrice(price)}/MWh</span>
        {sourceTs !== "—" && (
          <>
            <span className="text-gray-500">Source timestamp</span>
            <span className="text-gray-300 font-mono">{sourceTs}</span>
          </>
        )}
        {retrievedStr !== "—" && (
          <>
            <span className="text-gray-500">Retrieved</span>
            <span className="text-gray-300 font-mono">{retrievedStr}</span>
          </>
        )}
        <span className="text-gray-500">Age</span>
        <span className="text-gray-300 font-mono">{ageStr}</span>
      </div>
    </div>
  );
}

export default function DataSources({ sources, computedAt }: Props) {
  // ── Console logging for browser-side ERCOT validation ──────────────────────
  useEffect(() => {
    if (!sources?.ercot) return;
    const ercot = sources.ercot;
    console.log(
      "[ERCOT DATA SOURCE AUDIT]\n" +
      `  status:        ${ercot.status}\n` +
      `  price_mwh:     ${ercot.price_mwh ?? ercot.last_valid_price}\n` +
      `  cdr_updated:   ${ercot.cdr_updated ?? "—"}\n` +
      `  retrieved_at:  ${ercot.retrieved_at ?? "—"}\n` +
      `  age_minutes:   ${ercot.age_minutes}\n` +
      `  verification:  ${ercot.verification_status ?? "—"}\n` +
      `  reason:        ${ercot.verification_reason ?? "—"}\n` +
      `  source:        ${ercot.source ?? "—"}`,
      ercot,
    );
  }, [sources]);

  const anyIssue = Object.values(sources).some(s => {
    const age = s.age_minutes;
    return age === null || age >= 5;
  });

  // Dynamic timezone label — "CDT" May–Nov, "CST" Nov–Mar
  const computedTime = computedAt
    ? new Date(computedAt).toLocaleTimeString("en-US", {
        timeZone: "America/Chicago",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "—";

  return (
    <div className={cn(
      "panel-scan card-glass p-6 border",
      anyIssue ? "border-amber-500/20" : "border-white/5"
    )}>
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <Database className={cn("w-4 h-4", anyIssue ? "text-amber-400" : "text-gray-500")} />
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Data Sources</p>
            <p className="text-xs text-gray-500 mt-0.5">Feed health &amp; reliability</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          {computedTime}
        </div>
      </div>

      <div className="space-y-4">
        {(Object.entries(SOURCE_META) as [keyof typeof SOURCE_META, typeof SOURCE_META[keyof typeof SOURCE_META]][]).map(([key, meta]) => {
          const src = sources[key];

          const displayStatus: DisplayStatus =
            key === "ercot" && src.verification_status
              ? (src.verification_status === "real-time" ? "active" : src.verification_status as DisplayStatus)
              : src.status === "unavailable"
                ? "unavailable"
                : ageStatus(src.age_minutes);

          const confidence  = computeConfidence(displayStatus, src.age_minutes);
          const latency     = computeLatency(src.age_minutes, meta.latencyBase);
          const freshness   = formatFreshness(src.age_minutes);
          const lastVerified = src.age_minutes !== null ? formatAge(src.age_minutes) : "—";

          const hasVerifDetail = key === "ercot" && (src.last_valid_price != null || src.verification_reason);

          return (
            <div key={key} className="pb-3 border-b border-white/5 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-300">{meta.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{meta.detail}</p>
                </div>
                <StatusBadge status={displayStatus} />
              </div>

              {/* Trust metrics grid */}
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Last Verified</p>
                  <p className="text-xs text-gray-400 font-mono">{lastVerified}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Freshness</p>
                  <p className="text-xs text-gray-400 font-mono">{freshness}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Latency</p>
                  <p className="text-xs text-gray-400 font-mono">{displayStatus === "unavailable" ? "—" : latency}</p>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="mt-1.5">
                <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Data Confidence</p>
                <ConfidenceBar pct={confidence} />
              </div>

              {/* ERCOT verification badge */}
              {key === "ercot" && displayStatus !== "unavailable" && (
                <ErcotVerificationBadge src={sources.ercot} />
              )}

              {/* ERCOT reason text */}
              {hasVerifDetail && src.verification_reason && (
                <div className="mt-1.5 pl-2 border-l border-white/10">
                  <p className="text-xs text-gray-500 italic">{src.verification_reason}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {anyIssue && (
        <div className="mt-4 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200/75 leading-relaxed">
          One or more data sources are delayed. Confidence scores are adjusted accordingly.
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500 leading-relaxed">
        Data reliability affects signal confidence. Offline sources reduce confidence by 15%.
      </p>
    </div>
  );
}
