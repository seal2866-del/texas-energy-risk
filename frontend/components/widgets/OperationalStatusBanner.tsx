"use client";
import { Shield, AlertTriangle, XCircle, Clock } from "lucide-react";

interface Props {
  riskScore: string;
  riskDirection: string;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  activeSignals?: number;
  computedAt?: string;
}

type OperationalState = "NORMAL OPERATIONS" | "ELEVATED MONITORING" | "OPERATIONAL REVIEW RECOMMENDED" | "CRITICAL CONDITIONS";

function getOperationalState(
  risk: string,
  direction: string,
  demand: string,
  supply: string,
  market: string,
  activeSignals: number,
): OperationalState {
  if (risk === "high" || activeSignals >= 2) return "OPERATIONAL REVIEW RECOMMENDED";
  if (risk === "medium") return "ELEVATED MONITORING";
  if (direction === "increasing" || demand === "medium" || supply === "medium" || market === "medium") return "ELEVATED MONITORING";
  return "NORMAL OPERATIONS";
}

function getNextReviewTime(): string {
  const h = new Date().getHours();
  if (h < 14) return "14:00 CDT";
  if (h < 16) return "16:00 CDT";
  if (h < 19) return "19:00 CDT";
  return "Next scheduled refresh";
}

export default function OperationalStatusBanner({
  riskScore, riskDirection, demandPressure, supplyPressure,
  marketReaction, activeSignals = 0, computedAt,
}: Props) {
  const demand = demandPressure?.level ?? "low";
  const supply = supplyPressure?.level ?? "low";
  const market = marketReaction?.level ?? "low";

  const state = getOperationalState(riskScore, riskDirection, demand, supply, market, activeSignals);

  const config = {
    "NORMAL OPERATIONS": {
      bg:          "bg-green-500/8 border-green-500/20",
      labelBg:     "bg-green-500/15 border-green-500/30",
      labelText:   "text-green-300",
      dot:         "bg-green-400",
      ping:        "bg-green-400",
      icon:        <Shield className="w-5 h-5 text-green-400" />,
      subtitle:    "No operational constraints detected. Monitoring active. No escalation required.",
      nextReview:  `Next review window: ${getNextReviewTime()}`,
    },
    "ELEVATED MONITORING": {
      bg:          "bg-amber-500/8 border-amber-500/20",
      labelBg:     "bg-amber-500/15 border-amber-500/30",
      labelText:   "text-amber-300",
      dot:         "bg-amber-400",
      ping:        "bg-amber-400",
      icon:        <AlertTriangle className="w-5 h-5 text-amber-400" />,
      subtitle:    "Demand pressure approaching threshold. Enhanced monitoring recommended.",
      nextReview:  "Monitor every 30 minutes through peak demand window",
    },
    "OPERATIONAL REVIEW RECOMMENDED": {
      bg:          "bg-red-500/8 border-red-500/20",
      labelBg:     "bg-red-500/15 border-red-500/30",
      labelText:   "text-red-300",
      dot:         "bg-red-500",
      ping:        "bg-red-400",
      icon:        <XCircle className="w-5 h-5 text-red-400" />,
      subtitle:    "Multiple escalation thresholds exceeded. Procurement and operations review recommended.",
      nextReview:  "Continuous monitoring required — do not leave unattended",
    },
    "CRITICAL CONDITIONS": {
      bg:          "bg-red-600/12 border-red-500/30",
      labelBg:     "bg-red-500/20 border-red-400/40",
      labelText:   "text-red-200",
      dot:         "bg-red-500",
      ping:        "bg-red-400",
      icon:        <XCircle className="w-5 h-5 text-red-300" />,
      subtitle:    "Critical grid conditions active. Immediate operational response required.",
      nextReview:  "Escalate to operations leadership immediately",
    },
  }[state];

  const timeStr = computedAt
    ? new Date(computedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Chicago" }) + " CDT"
    : "Just now";

  return (
    <div className={`rounded-2xl border p-4 lg:p-5 mb-4 ${config.bg}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Status */}
        <div className="flex items-center gap-3">
          {/* Animated dot */}
          <div className="relative flex-shrink-0">
            <span className={`relative flex h-3 w-3`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${config.ping}`} />
              <span className={`relative inline-flex rounded-full h-3 w-3 ${config.dot}`} />
            </span>
          </div>

          <div>
            {/* State label */}
            <div className="flex items-center gap-2 mb-0.5">
              {config.icon}
              <span className={`text-sm font-black tracking-wide ${config.labelText}`}>
                {state}
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{config.subtitle}</p>
          </div>
        </div>

        {/* Right: Next review + timestamp */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-[11px] text-gray-400">{config.nextReview}</span>
          </div>
          <span className="text-[10px] text-gray-600">Updated {timeStr}</span>
        </div>
      </div>
    </div>
  );
}
