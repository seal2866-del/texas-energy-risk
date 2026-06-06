"use client";

interface Props {
  riskScore: string;
  riskDirection: string;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  activeSignals?: number;
  confidence?: number | null;
}

interface KPI {
  label: string;
  value: string;
  color: string;
}

function levelToExposure(level: string): string {
  if (level === "high")   return "ELEVATED";
  if (level === "medium") return "MODERATE";
  return "MINIMAL";
}

function levelColor(level: string): string {
  if (level === "high" || level === "ELEVATED")  return "text-red-400";
  if (level === "medium" || level === "MODERATE") return "text-amber-400";
  return "text-green-400";
}

function confidenceLabel(c: number | null | undefined): string {
  if (!c) return "MODERATE";
  if (c >= 80) return "HIGH";
  if (c >= 50) return "MODERATE";
  if (c >= 75) return "ACCEPTABLE";
  return "LIMITED";
}

export default function ExecutiveKPIRow({
  riskScore, riskDirection, demandPressure, supplyPressure,
  marketReaction, activeSignals = 0, confidence,
}: Props) {
  const risk   = riskScore || "low";
  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";
  const market = marketReaction?.level || "low";

  const opsStatus =
    risk === "high"   ? { value: "REVIEW", color: "text-red-400" } :
    risk === "medium" ? { value: "ELEVATED", color: "text-amber-400" } :
                        { value: "NORMAL", color: "text-green-400" };

  const requiredActions =
    risk === "high"   ? { value: "IMMEDIATE", color: "text-red-400" } :
    risk === "medium" ? { value: "REVIEW", color: "text-amber-400" } :
                        { value: "NONE", color: "text-green-400" };

  const kpis: KPI[] = [
    { label: "Operational Status", value: opsStatus.value,               color: opsStatus.color },
    { label: "Cost Exposure",      value: levelToExposure(market),        color: levelColor(market) },
    { label: "Supply Risk",        value: levelToExposure(supply),        color: levelColor(supply) },
    { label: "Required Actions",   value: requiredActions.value,          color: requiredActions.color },
    { label: "Confidence",         value: confidenceLabel(confidence),    color: "text-blue-300" },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-4 lg:col-span-2">
      <div className="grid grid-cols-5 gap-0 divide-x divide-white/8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex flex-col items-center justify-center px-3 py-1 first:pl-0 last:pr-0">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500 text-center mb-1">
              {kpi.label}
            </p>
            <p className={`text-sm font-black tracking-wide text-center ${kpi.color}`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
