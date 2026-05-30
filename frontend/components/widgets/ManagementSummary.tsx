"use client";
import { FileText } from "lucide-react";

interface Props {
  riskScore: string;
  riskDirection: string;
  primaryDriver?: string;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  computedAt?: string;
}

function getSummary(
  risk: string,
  direction: string,
  primaryDriver: string,
  demand: string,
  supply: string,
): string {
  if (risk === "high") {
    return "Multiple monitored indicators have exceeded escalation thresholds. Immediate operational review is recommended. Procurement, dispatch, and fuel-supply teams should be notified.";
  }

  if (risk === "medium") {
    const driver =
      primaryDriver.includes("weather") ? "Demand-driven grid pressure is increasing" :
      primaryDriver.includes("price")   ? "ERCOT pricing sensitivity is elevated" :
      primaryDriver.includes("gas")     ? "Natural gas supply tightness is emerging" :
                                          "Operational conditions are moderately elevated";
    return `${driver}. Enhanced monitoring and procurement review are recommended during peak demand periods.`;
  }

  // Low risk
  if (direction === "increasing") {
    return "Texas operations remain within normal parameters, though conditions are trending toward elevated monitoring. No immediate action is required — reassess at the next scheduled review window.";
  }

  return "Texas operations remain within normal parameters. No procurement, dispatch, or fuel-supply actions are recommended at this time.";
}

export default function ManagementSummary({
  riskScore, riskDirection, primaryDriver = "", demandPressure, supplyPressure, computedAt,
}: Props) {
  const demand  = demandPressure?.level ?? "low";
  const supply  = supplyPressure?.level ?? "low";
  const summary = getSummary(riskScore, riskDirection, primaryDriver, demand, supply);

  const borderColor =
    riskScore === "high"   ? "border-red-500/20" :
    riskScore === "medium" ? "border-amber-500/20" :
                             "border-white/8";

  const timeStr = computedAt
    ? new Date(computedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Chicago" }) + " CDT"
    : "";

  return (
    <div className={`card-glass border ${borderColor} rounded-2xl p-5 lg:col-span-2`}>
      <div className="flex items-start gap-3">
        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Management Summary
            </p>
            {timeStr && (
              <span className="text-[10px] text-gray-600">{timeStr}</span>
            )}
          </div>
          <p className="text-sm text-gray-200 leading-relaxed">{summary}</p>
          <p className="text-[10px] text-gray-600 mt-2">
            Suitable for internal distribution. Not financial, investment, or procurement advice.
          </p>
        </div>
      </div>
    </div>
  );
}
