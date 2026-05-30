"use client";
import { Shield } from "lucide-react";

interface Props {
  confidence?: number | null;
  dataSources?: {
    ercot?: { status: string; age_minutes?: number | null };
    noaa?:  { status: string; age_minutes?: number | null };
    eia?:   { status: string; age_minutes?: number | null };
  };
}

function sourceReliability(src?: { status: string; age_minutes?: number | null }): number {
  if (!src) return 98;
  if (src.status === "unavailable") return 0;
  if (src.status === "stale" || (src.age_minutes != null && src.age_minutes > 60)) return 40;
  if (src.status === "degraded") return 55;
  return 98;
}

function reliabilityColor(pct: number): string {
  if (pct >= 80) return "text-green-400";
  if (pct >= 50) return "text-amber-400";
  return "text-red-400";
}

function barColor(pct: number): string {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function overallLabel(pct: number): string {
  if (pct >= 80) return "High — assessment is reliable";
  if (pct >= 60) return "Moderate — suitable for operational awareness";
  if (pct >= 40) return "Limited — interpret directionally";
  return "Degraded — verify with primary sources";
}

export default function ConfidenceBreakdown({ confidence, dataSources }: Props) {
  const ercotR = sourceReliability(dataSources?.ercot);
  const noaaR  = sourceReliability(dataSources?.noaa);
  const eiaR   = sourceReliability(dataSources?.eia);
  const modelR = confidence ?? 55;
  const overall = Math.round((ercotR + noaaR + eiaR + modelR) / 4);

  const items = [
    { label: "ERCOT Data Quality",    pct: ercotR, note: "Real-time price feed" },
    { label: "Weather Reliability",   pct: noaaR,  note: "NOAA/NWS forecast feed" },
    { label: "Gas Supply Reliability", pct: eiaR,  note: "EIA weekly storage (slower cadence)" },
    { label: "Model Confidence",      pct: modelR, note: "Signal alignment and data completeness" },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Confidence Breakdown</p>
      </div>
      <p className="text-[10px] text-gray-600 mb-4">Assessment reliability by data source</p>

      <div className="space-y-3 mb-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <div>
                <span className="text-xs font-medium text-gray-300">{item.label}</span>
                <p className="text-[10px] text-gray-600">{item.note}</p>
              </div>
              <span className={`text-xs font-bold ${reliabilityColor(item.pct)}`}>{item.pct}%</span>
            </div>
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor(item.pct)}`} style={{ width: `${item.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Overall Assessment</span>
          <span className={`text-xs font-bold ${reliabilityColor(overall)}`}>{overall}%</span>
        </div>
        <p className={`text-[11px] mt-0.5 ${reliabilityColor(overall)}`}>{overallLabel(overall)}</p>
      </div>
    </div>
  );
}
