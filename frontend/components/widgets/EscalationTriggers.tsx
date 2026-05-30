"use client";
import { Shield, AlertTriangle, XCircle, Clock } from "lucide-react";

interface Props {
  ercotPrice?: number;
  temperature?: number;
  henryHub?: number;
  dataSources?: {
    ercot?: { status: string; age_minutes?: number | null };
    noaa?:  { status: string; age_minutes?: number | null };
    eia?:   { status: string; age_minutes?: number | null };
  };
  computedAt?: string;
}

type TriggerStatus = "Normal" | "Watching" | "Triggered" | "Escalated";

interface Trigger {
  label: string;
  current: string;
  threshold: string;
  status: TriggerStatus;
  detail?: string;
}

function getStatus(current: number, threshold: number, watchBuffer = 0.85): TriggerStatus {
  if (current >= threshold) return "Triggered";
  if (current >= threshold * watchBuffer) return "Watching";
  return "Normal";
}

function statusColor(s: TriggerStatus) {
  switch (s) {
    case "Normal":    return "text-green-400 bg-green-500/10 border-green-500/20";
    case "Watching":  return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    case "Triggered": return "text-red-400 bg-red-500/10 border-red-500/20";
    case "Escalated": return "text-red-300 bg-red-500/20 border-red-400/40";
  }
}

function StatusIcon({ status }: { status: TriggerStatus }) {
  if (status === "Normal")    return <Shield className="w-3.5 h-3.5 text-green-400" />;
  if (status === "Watching")  return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  return <XCircle className="w-3.5 h-3.5 text-red-400" />;
}

function dataSourceStatus(src?: { status: string; age_minutes?: number | null }): TriggerStatus {
  if (!src) return "Normal";
  if (src.status === "unavailable") return "Triggered";
  if (src.status === "stale" || (src.age_minutes != null && src.age_minutes > 30)) return "Watching";
  return "Normal";
}

export default function EscalationTriggers({ ercotPrice, temperature, henryHub, dataSources, computedAt }: Props) {
  const ercotVal  = ercotPrice  ?? 0;
  const tempVal   = temperature ?? 0;
  const hhVal     = henryHub    ?? 0;

  const ercotStatus = getStatus(ercotVal, 35, 0.85);
  const tempStatus  = getStatus(tempVal,  95, 0.90);
  const hhStatus    = getStatus(hhVal,    3.0, 0.90);

  const ercotDs  = dataSourceStatus(dataSources?.ercot);
  const noaaDs   = dataSourceStatus(dataSources?.noaa);
  const eiaDs    = dataSourceStatus(dataSources?.eia);
  const dsWorst  = [ercotDs, noaaDs, eiaDs].includes("Triggered") ? "Triggered"
                 : [ercotDs, noaaDs, eiaDs].includes("Watching")  ? "Watching"
                 : "Normal";

  const triggers: Trigger[] = [
    {
      label:     "ERCOT LMP",
      current:   ercotVal > 0 ? `$${ercotVal.toFixed(2)}/MWh` : "N/A",
      threshold: "> $35/MWh",
      status:    ercotStatus,
      detail:    ercotStatus === "Watching" ? "Approaching watch threshold — monitor closely" : undefined,
    },
    {
      label:     "Temperature",
      current:   tempVal > 0 ? `${tempVal.toFixed(0)}°F` : "N/A",
      threshold: "> 95°F",
      status:    tempStatus,
      detail:    tempStatus === "Watching" ? "Within 5°F of escalation threshold" : undefined,
    },
    {
      label:     "Henry Hub",
      current:   hhVal > 0 ? `$${hhVal.toFixed(2)}/MMBtu` : "N/A",
      threshold: "> $3.00/MMBtu",
      status:    hhStatus,
      detail:    hhStatus === "Watching" ? "Approaching fuel cost sensitivity threshold" : undefined,
    },
    {
      label:     "Data Source Health",
      current:   dsWorst === "Normal" ? "All feeds current" : dsWorst === "Watching" ? "One feed delayed" : "Feed unavailable",
      threshold: "Stale > 30 min",
      status:    dsWorst,
      detail:    dsWorst !== "Normal" ? "One or more data sources may be delayed — check System Health" : undefined,
    },
    {
      label:     "Generation Availability",
      current:   "No alerts",
      threshold: "ERCOT outage notice",
      status:    "Normal",
    },
  ];

  const worstStatus = triggers.reduce<TriggerStatus>((worst, t) => {
    const order: TriggerStatus[] = ["Normal", "Watching", "Triggered", "Escalated"];
    return order.indexOf(t.status) > order.indexOf(worst) ? t.status : worst;
  }, "Normal");

  const headerBadge =
    worstStatus === "Normal"   ? "text-green-400 border-green-500/30 bg-green-500/5" :
    worstStatus === "Watching" ? "text-amber-400 border-amber-500/30 bg-amber-500/5" :
                                 "text-red-400 border-red-500/30 bg-red-500/5";

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-0.5">
            Escalation Triggers
          </p>
          <p className="text-xs text-gray-400">
            Monitoring thresholds that would change the operational assessment
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide ${headerBadge}`}>
          {worstStatus === "Normal" ? "All Clear" : worstStatus === "Watching" ? "Watching" : "Triggered"}
        </span>
      </div>

      {/* Trigger rows */}
      <div className="space-y-2">
        {triggers.map((t) => (
          <div key={t.label} className="grid grid-cols-12 items-center gap-2 py-2.5 border-b border-white/5 last:border-0">
            {/* Label */}
            <div className="col-span-3">
              <span className="text-xs font-medium text-gray-300">{t.label}</span>
            </div>
            {/* Current */}
            <div className="col-span-3">
              <span className="text-xs text-gray-400">Current: </span>
              <span className="text-xs font-semibold text-white">{t.current}</span>
            </div>
            {/* Threshold */}
            <div className="col-span-3">
              <span className="text-xs text-gray-400">Trigger: </span>
              <span className="text-xs text-gray-300">{t.threshold}</span>
            </div>
            {/* Status badge */}
            <div className="col-span-2 flex justify-end">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${statusColor(t.status)}`}>
                <StatusIcon status={t.status} />
                {t.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Detail notes */}
      {triggers.some(t => t.detail) && (
        <div className="mt-3 space-y-1">
          {triggers.filter(t => t.detail).map(t => (
            <div key={t.label} className="flex items-start gap-2 text-[11px] text-amber-400/80">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span><span className="font-semibold">{t.label}:</span> {t.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
        <Clock className="w-3 h-3 text-gray-600" />
        <span className="text-[10px] text-gray-600">
          Last checked: {computedAt ? new Date(computedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Chicago" }) + " CDT" : "Just now"}
        </span>
      </div>
    </div>
  );
}
