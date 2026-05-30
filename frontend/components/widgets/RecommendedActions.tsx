"use client";
import { CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";

interface Props {
  riskScore: string;
  riskDirection: string;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  computedAt?: string;
}

interface Action {
  icon: "check" | "warn" | "alert";
  text: string;
}

function getActions(
  risk: string,
  direction: string,
  demand: string,
  supply: string,
  market: string,
): { actions: Action[]; nextReview: string } {
  if (risk === "critical") {
    return {
      actions: [
        { icon: "alert", text: "Immediate operational review recommended" },
        { icon: "alert", text: "Review procurement and demand exposure now" },
        { icon: "alert", text: "Confirm contingency plans are activated" },
        { icon: "alert", text: "Escalate to operations leadership immediately" },
        { icon: "alert", text: "Monitor ERCOT pricing continuously" },
      ],
      nextReview: "Continuous — do not leave unmonitored",
    };
  }

  if (risk === "high") {
    return {
      actions: [
        { icon: "alert", text: "Operational readiness review recommended" },
        { icon: "alert", text: "Review procurement exposure" },
        { icon: "alert", text: "Confirm fuel supply and generation availability" },
        { icon: "alert", text: "Increase monitoring frequency" },
        { icon: "alert", text: "Notify operations leadership if escalation persists" },
      ],
      nextReview: "Immediate — continuous monitoring required",
    };
  }

  if (risk === "medium") {
    const actions: Action[] = [
      { icon: "warn", text: "Review procurement positions" },
      { icon: "warn", text: "Monitor ERCOT pricing every 30 minutes" },
      { icon: "warn", text: "Validate generation availability" },
    ];
    if (demand === "medium" || demand === "high") {
      actions.push({ icon: "warn", text: "Watch 14:00–19:00 CDT demand window closely" });
    }
    if (supply === "medium" || supply === "high") {
      actions.push({ icon: "warn", text: "Monitor Henry Hub for further movement" });
    }
    return { actions, nextReview: "30 minutes" };
  }

  // Low risk
  const actions: Action[] = [
    { icon: "check", text: "No procurement adjustments required" },
    { icon: "check", text: "No dispatch review required" },
    { icon: "check", text: "No fuel hedging action required" },
    { icon: "check", text: "Continue standard monitoring cadence" },
  ];

  if (direction === "increasing") {
    actions.push({ icon: "warn", text: "Note: risk is trending higher — reassess at next refresh" });
  }

  return { actions, nextReview: "14:00 CDT or next scheduled refresh" };
}

function getNextReviewTime(): string {
  const now = new Date();
  const hour = now.getHours();
  // Suggest next review at next hour boundary or 14:00 if before that
  if (hour < 14) return "14:00 CDT";
  if (hour < 16) return "16:00 CDT";
  if (hour < 19) return "19:00 CDT";
  return "Next scheduled refresh";
}

export default function RecommendedActions({
  riskScore,
  riskDirection,
  demandPressure,
  supplyPressure,
  marketReaction,
}: Props) {
  const risk    = riskScore || "low";
  const demand  = demandPressure?.level || "low";
  const supply  = supplyPressure?.level || "low";
  const market  = marketReaction?.level || "low";

  const { actions, nextReview } = getActions(risk, riskDirection, demand, supply, market);

  const headerColor =
    risk === "high"   ? "text-red-400 border-red-500/30 bg-red-500/5" :
    risk === "medium" ? "text-amber-400 border-amber-500/30 bg-amber-500/5" :
                        "text-green-400 border-green-500/30 bg-green-500/5";

  const iconColor =
    risk === "high"   ? "text-red-400" :
    risk === "medium" ? "text-amber-400" :
                        "text-green-400";

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-0.5">
            Recommended Actions
          </p>
          <p className="text-xs text-gray-400">
            {risk === "high"   ? "Immediate operational response required" :
             risk === "medium" ? "Enhanced monitoring and exposure review" :
                                 "No operational action required at this time"}
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide ${headerColor}`}>
          {risk === "high" ? "Action Required" : risk === "medium" ? "Enhanced Monitoring" : "Standard Operations"}
        </div>
      </div>

      {/* Actions list */}
      <div className="space-y-2 mb-4">
        {actions.map((action, i) => (
          <div key={i} className="flex items-start gap-3">
            {action.icon === "check" && (
              <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconColor}`} />
            )}
            {action.icon === "warn" && (
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconColor}`} />
            )}
            {action.icon === "alert" && (
              <XCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconColor}`} />
            )}
            <span className="text-sm text-gray-200">{action.text}</span>
          </div>
        ))}
      </div>

      {/* Next review */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/5">
        <Clock className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs text-gray-500">
          Next review: <span className="text-gray-300 font-medium">{getNextReviewTime()}</span>
        </span>
      </div>
    </div>
  );
}
