"use client";
import { CheckCircle, AlertTriangle, XCircle, Clock, Shield } from "lucide-react";

interface Props {
  riskScore:      string;
  riskDirection:  string;
  confidence?:    number | null;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  activeSignals?:  number;
  computedAt?:     string;
  ercotPrice?:     number;
  temperature?:    number;
}

function getNextReview(): string {
  const h = new Date().getHours();
  if (h < 6)  return "06:00 CDT";
  if (h < 14) return "14:00 CDT";
  if (h < 16) return "16:00 CDT";
  if (h < 19) return "19:00 CDT";
  return "06:00 CDT tomorrow";
}

function minutesToNextReview(): string {
  const now     = new Date();
  const h       = now.getHours();
  const m       = now.getMinutes();
  const targets = [6, 14, 16, 19];
  for (const t of targets) {
    if (h < t) {
      const mins = (t - h) * 60 - m;
      if (mins < 60) return `${mins} min`;
      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }
  }
  // After 19:00 — next is 06:00 tomorrow
  const minsToMidnight = (24 - h) * 60 - m;
  const total = minsToMidnight + 6 * 60;
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

function confidenceLabel(c: number | null | undefined): string {
  if (!c) return "Moderate";
  if (c >= 80) return "High";
  if (c >= 50) return "Moderate";
  if (c >= 35) return "Acceptable";
  return "Limited";
}

type Config = {
  icon:       React.ReactNode;
  label:      string;
  detail:     string;
  sub:        string[];
  bg:         string;
  border:     string;
  labelColor: string;
  dotColor:   string;
};

export default function ExecutiveDecisionCard({
  riskScore, riskDirection, confidence, demandPressure,
  supplyPressure, marketReaction, activeSignals = 0, computedAt,
  ercotPrice, temperature,
}: Props) {
  const risk   = riskScore || "low";
  const market = marketReaction?.level || "low";

  const config: Config =
    risk === "high" || activeSignals >= 2
      ? {
          icon:       <XCircle className="w-8 h-8 text-red-400" />,
          label:      "ELEVATED OPERATIONAL CONDITIONS",
          detail:     "Multiple signals indicate elevated operational significance.",
          sub:        [
            "Internal escalation procedures may be warranted per organizational protocols.",
            "Increased monitoring frequency and management visibility may apply.",
            "Review contingency plans according to internal procedures.",
          ],
          bg:         "bg-red-500/8",
          border:     "border-red-500/25",
          labelColor: "text-red-300",
          dotColor:   "bg-red-500",
        }
      : risk === "medium"
      ? {
          icon:       <AlertTriangle className="w-8 h-8 text-amber-400" />,
          label:      "INCREASED MONITORING PRIORITY",
          detail:     "Moderate operational conditions detected.",
          sub:        [
            "Increased monitoring frequency may be appropriate during peak demand windows.",
            "Review current conditions according to internal operational procedures.",
            "Monitor ERCOT pricing and weather forecasts during 14:00–19:00 CDT.",
          ],
          bg:         "bg-amber-500/8",
          border:     "border-amber-500/25",
          labelColor: "text-amber-300",
          dotColor:   "bg-amber-500",
        }
      : {
          icon:       <CheckCircle className="w-8 h-8 text-green-400" />,
          label:      "STABLE CONDITIONS",
          detail:     "No elevated operational pressure detected.",
          sub:        [
            "Standard monitoring procedures apply.",
            "Reassess during the afternoon demand window (14:00–19:00 CDT).",
          ],
          bg:         "bg-green-500/5",
          border:     "border-green-500/20",
          labelColor: "text-green-300",
          dotColor:   "bg-green-500",
        };

  const nextReview = getNextReview();
  const countdown  = minutesToNextReview();
  const confLabel  = confidenceLabel(confidence);

  return (
    <div className={`rounded-2xl border p-6 lg:col-span-2 ${config.bg} ${config.border}`}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">

        {/* Left — main decision */}
        <div className="flex items-start gap-4 flex-1">
          {/* Icon */}
          <div className="flex-shrink-0 mt-1">{config.icon}</div>

          <div>
            {/* Primary label */}
            <p className={`text-2xl font-black tracking-tight mb-2 ${config.labelColor}`}>
              {config.label}
            </p>

            {/* Detail */}
            <p className="text-base text-gray-200 font-medium mb-3">{config.detail}</p>

            {/* Sub-bullets */}
            <div className="space-y-1.5">
              {config.sub.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${config.dotColor}`} />
                  <p className="text-sm text-gray-300">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — meta info */}
        <div className="flex flex-row lg:flex-col gap-3 flex-shrink-0">
          {/* Next review */}
          <div className="flex-1 lg:flex-none bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-center">
            <div className="flex items-center gap-1.5 justify-center mb-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Next Review</p>
            </div>
            <p className="text-lg font-black text-white">{nextReview}</p>
            <p className="text-[10px] text-gray-500">in {countdown}</p>
          </div>

          {/* Confidence */}
          <div className="flex-1 lg:flex-none bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-center">
            <div className="flex items-center gap-1.5 justify-center mb-1">
              <Shield className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Confidence</p>
            </div>
            <p className="text-lg font-black text-white">{confLabel}</p>
            {confidence && (
              <p className="text-[10px] text-gray-600">{confidence}% signal quality</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
