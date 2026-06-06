"use client";
import { Eye, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface Props {
  riskScore: string;
  ercotPrice?: number;
  temperature?: number;
  henryHub?: number;
  gasStorageVsAvg?: number;
  demandPressure?: { level: string };
  dataSources?: {
    ercot?: { status: string };
    noaa?:  { status: string };
    eia?:   { status: string };
  };
}

type WatchStatus = "Normal" | "Watching" | "Triggered";

interface WatchItem {
  condition: string;
  value: string;
  status: WatchStatus;
}

function statusIcon(s: WatchStatus) {
  if (s === "Normal")    return <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />;
  if (s === "Watching")  return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
  return <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
}

function statusStyle(s: WatchStatus) {
  if (s === "Normal")    return "text-green-400";
  if (s === "Watching")  return "text-amber-400";
  return "text-red-400";
}

function sourceStatus(src?: { status: string }): WatchStatus {
  if (!src || src.status === "unavailable") return "Triggered";
  if (src.status === "stale" || src.status === "degraded") return "Watching";
  return "Normal";
}

export default function OperationalWatchList({
  riskScore, ercotPrice, temperature, henryHub,
  gasStorageVsAvg, demandPressure, dataSources,
}: Props) {

  const ercotVal = ercotPrice ?? 0;
  const tempVal  = temperature ?? 0;
  const hhVal    = henryHub ?? 0;
  const gasVsAvg = gasStorageVsAvg ?? 0;
  const demand   = demandPressure?.level ?? "low";

  const dsHealth: WatchStatus = [
    sourceStatus(dataSources?.ercot),
    sourceStatus(dataSources?.noaa),
    sourceStatus(dataSources?.eia),
  ].includes("Triggered") ? "Triggered"
  : [
    sourceStatus(dataSources?.ercot),
    sourceStatus(dataSources?.noaa),
    sourceStatus(dataSources?.eia),
  ].includes("Watching") ? "Watching"
  : "Normal";

  const items: WatchItem[] = [
    {
      condition: "Temperature > 95°F",
      value:     tempVal > 0 ? `${tempVal.toFixed(0)}°F current` : "N/A",
      status:    tempVal >= 95 ? "Triggered" : tempVal >= 88 ? "Watching" : "Normal",
    },
    {
      condition: "ERCOT LMP > $75/MWh",
      value:     ercotVal > 0 ? `$${ercotVal.toFixed(2)}/MWh current` : "N/A",
      status:    ercotVal >= 35 ? "Triggered" : ercotVal >= 28 ? "Watching" : "Normal",
    },
    {
      condition: "Henry Hub > $3.00/MMBtu",
      value:     hhVal > 0 ? `$${hhVal.toFixed(2)}/MMBtu current` : "N/A",
      status:    hhVal >= 3.0 ? "Triggered" : hhVal >= 2.7 ? "Watching" : "Normal",
    },
    {
      condition: "Gas Storage Below Seasonal Range",
      value:     gasVsAvg !== 0 ? `${gasVsAvg.toFixed(1)}% vs 5yr avg` : "Within range",
      status:    gasVsAvg <= -10 ? "Triggered" : gasVsAvg <= -5 ? "Watching" : "Normal",
    },
    {
      condition: "Demand Pressure Elevated",
      value:     demand === "high" ? "High demand pressure" : demand === "medium" ? "Moderate demand" : "Normal demand",
      status:    demand === "high" ? "Triggered" : demand === "medium" ? "Watching" : "Normal",
    },
    {
      condition: "Generation Availability Issue",
      value:     "No ERCOT outage notices",
      status:    riskScore === "high" ? "Watching" : "Normal",
    },
    {
      condition: "Data Source Health",
      value:     dsHealth === "Normal" ? "All feeds current" : dsHealth === "Watching" ? "Feed delay detected" : "Feed unavailable",
      status:    dsHealth,
    },
  ];

  const triggeredCount = items.filter(i => i.status === "Triggered").length;
  const watchingCount  = items.filter(i => i.status === "Watching").length;

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Operational Watch List
            </p>
            <p className="text-xs text-gray-400">
              {triggeredCount > 0
                ? `${triggeredCount} condition${triggeredCount > 1 ? "s" : ""} triggered`
                : watchingCount > 0
                ? `${watchingCount} condition${watchingCount > 1 ? "s" : ""} under watch`
                : "All conditions normal"}
            </p>
          </div>
        </div>
        <div className={`w-2 h-2 rounded-full ${triggeredCount > 0 ? "bg-red-400" : watchingCount > 0 ? "bg-amber-400" : "bg-green-400"}`} />
      </div>

      {/* Watch items */}
      <div className="space-y-0">
        {items.map((item) => (
          <div
            key={item.condition}
            className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              {statusIcon(item.status)}
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-300 truncate">{item.condition}</p>
                <p className="text-[11px] text-gray-500">{item.value}</p>
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ml-2 ${statusStyle(item.status)}`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
