"use client";

interface Props {
  riskScore: string;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  gasToPower?: { level: string };
  dataSources?: {
    ercot?: { status: string };
    noaa?:  { status: string };
    eia?:   { status: string };
  };
}

type Level = "none" | "minimal" | "low" | "moderate" | "elevated" | "high" | "normal" | "active" | "degraded";

function levelColor(level: string): string {
  switch (level?.toLowerCase()) {
    case "none":
    case "minimal":
    case "low":
    case "normal":
      return "text-green-400";
    case "moderate":
    case "medium":
      return "text-amber-400";
    case "elevated":
    case "high":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}

function levelLabel(level: string): string {
  switch (level?.toLowerCase()) {
    case "low":    return "Low";
    case "medium": return "Moderate";
    case "high":   return "Elevated";
    default:       return level ? level.charAt(0).toUpperCase() + level.slice(1) : "Normal";
  }
}

function sourceReliability(status: string): { pct: number; label: string } {
  switch (status?.toLowerCase()) {
    case "active":      return { pct: 98, label: "98%" };
    case "stale":       return { pct: 55, label: "55%" };
    case "degraded":    return { pct: 40, label: "40%" };
    case "unavailable": return { pct: 0,  label: "N/A" };
    default:            return { pct: 98, label: "98%" };
  }
}

function reliabilityColor(pct: number): string {
  if (pct >= 80) return "text-green-400";
  if (pct >= 50) return "text-amber-400";
  return "text-red-400";
}

function overallAssessment(pct: number): string {
  if (pct >= 80) return "Operationally usable";
  if (pct >= 50) return "Use with caution";
  return "Degraded — verify manually";
}

export default function ImpactAssessment({
  riskScore,
  demandPressure,
  supplyPressure,
  marketReaction,
  gasToPower,
  dataSources,
}: Props) {
  const risk   = riskScore || "low";
  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";
  const market = marketReaction?.level || "low";
  const g2p    = gasToPower?.level || "low";

  const opRisk       = risk === "high" ? "Elevated" : risk === "medium" ? "Moderate" : "Minimal";
  const costExposure = market === "high" ? "Elevated" : market === "medium" ? "Moderate" : "Minimal";
  const supplyExp    = supply === "high" ? "Elevated" : supply === "medium" ? "Moderate" : "Minimal";
  const procAction   = risk === "high" ? "Required" : risk === "medium" ? "Review recommended" : "None";
  const gridStability = demand === "high" ? "Under pressure" : demand === "medium" ? "Moderate load" : "Normal";

  const ercot = sourceReliability(dataSources?.ercot?.status || "active");
  const noaa  = sourceReliability(dataSources?.noaa?.status  || "active");
  const eia   = sourceReliability(dataSources?.eia?.status   || "active");
  const avgPct = Math.round((ercot.pct + noaa.pct + eia.pct) / 3);

  const rows = [
    { label: "Operational Risk",  value: opRisk,      level: opRisk.toLowerCase() },
    { label: "Cost Exposure",     value: costExposure, level: costExposure.toLowerCase() },
    { label: "Supply Exposure",   value: supplyExp,    level: supplyExp.toLowerCase() },
    { label: "Demand Pressure",   value: levelLabel(demand), level: demand },
    { label: "Grid Stability",    value: gridStability, level: demand === "high" ? "high" : demand === "medium" ? "medium" : "low" },
    { label: "Procurement Action",value: procAction,   level: risk === "high" ? "high" : risk === "medium" ? "medium" : "none" },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-4">
        Impact Assessment
      </p>

      {/* Current State table */}
      <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Current State</p>
      <div className="space-y-2 mb-5">
        {rows.map(({ label, value, level }) => (
          <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
            <span className="text-xs text-gray-400">{label}</span>
            <span className={`text-xs font-semibold ${levelColor(level)}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Data Reliability */}
      <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Data Reliability</p>
      <div className="space-y-2">
        {[
          { label: "ERCOT Feed",     ...ercot },
          { label: "NOAA Weather",   ...noaa  },
          { label: "Gas Storage",    ...eia   },
        ].map(({ label, pct, label: pctLabel }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{label}</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-xs font-semibold w-8 text-right ${reliabilityColor(pct)}`}>{pctLabel}</span>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-2">
          <span className="text-xs text-gray-400">Overall Assessment</span>
          <span className={`text-xs font-semibold ${reliabilityColor(avgPct)}`}>
            {overallAssessment(avgPct)}
          </span>
        </div>
      </div>
    </div>
  );
}
