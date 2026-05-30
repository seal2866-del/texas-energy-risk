"use client";
import { Eye, Clock } from "lucide-react";

interface Props {
  riskScore:      string;
  riskDirection:  string;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  activeSignals?:  number;
  computedAt?:     string;
}

interface Consideration {
  text: string;
}

function getConsiderations(
  risk: string,
  direction: string,
  demand: string,
  supply: string,
  market: string,
  activeSignals: number,
): { considerations: Consideration[]; label: string; labelColor: string; bg: string; border: string } {

  if (risk === "high" || activeSignals >= 2) {
    return {
      label:      "Elevated Operational Awareness",
      labelColor: "text-red-300",
      bg:         "bg-red-500/5",
      border:     "border-red-500/20",
      considerations: [
        { text: "Consider internal escalation procedures according to your operational protocols." },
        { text: "Review contingency plans and current exposure assumptions." },
        { text: "Increase management visibility into current conditions." },
        { text: "Monitor ERCOT pricing and weather conditions continuously." },
      ],
    };
  }

  if (risk === "medium") {
    const items: Consideration[] = [
      { text: "Increase monitoring frequency during the peak demand window." },
      { text: "Review current exposure assumptions according to internal procedures." },
      { text: "Verify operational readiness for potential condition changes." },
    ];
    if (demand === "medium" || demand === "high") {
      items.push({ text: "Monitor afternoon temperature forecasts and ERCOT pricing closely." });
    }
    if (supply === "medium" || supply === "high") {
      items.push({ text: "Monitor natural gas supply conditions and Henry Hub pricing." });
    }
    return {
      label:      "Standard Operational Awareness",
      labelColor: "text-amber-300",
      bg:         "bg-amber-500/5",
      border:     "border-amber-500/20",
      considerations: items,
    };
  }

  // Low risk
  const items: Consideration[] = [
    { text: "No operational review required under current conditions." },
    { text: "Continue standard monitoring procedures." },
    { text: "Reassess conditions during the afternoon demand window (14:00–19:00 CDT)." },
  ];
  if (direction === "increasing") {
    items.push({ text: "Note: conditions are trending toward elevated monitoring — reassess at next scheduled review." });
  }
  return {
    label:      "Routine Monitoring",
    labelColor: "text-green-300",
    bg:         "bg-green-500/5",
    border:     "border-green-500/20",
    considerations: items,
  };
}

function getNextReviewTime(): string {
  const h = new Date().getHours();
  if (h < 6)  return "06:00 CDT";
  if (h < 14) return "14:00 CDT";
  if (h < 16) return "16:00 CDT";
  if (h < 19) return "19:00 CDT";
  return "06:00 CDT tomorrow";
}

export default function OperationalConsiderations({
  riskScore, riskDirection, demandPressure, supplyPressure,
  marketReaction, activeSignals = 0, computedAt,
}: Props) {
  const risk    = riskScore || "low";
  const demand  = demandPressure?.level  || "low";
  const supply  = supplyPressure?.level  || "low";
  const market  = marketReaction?.level  || "low";

  const { considerations, label, labelColor, bg, border } =
    getConsiderations(risk, riskDirection, demand, supply, market, activeSignals);

  return (
    <div className={`rounded-2xl border p-5 lg:col-span-2 ${bg} ${border}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Operational Considerations
            </p>
            <p className={`text-xs font-semibold ${labelColor}`}>{label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <Clock className="w-3 h-3" />
          Next review: {getNextReviewTime()}
        </div>
      </div>

      {/* Considerations */}
      <div className="space-y-2">
        {considerations.map((c, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500 flex-shrink-0 mt-1.5" />
            <span className="text-sm text-gray-300 leading-relaxed">{c.text}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mt-4 border-t border-white/5 pt-3">
        Operational awareness only. Not financial, procurement, trading, or operational advice.
        Users are responsible for their own decisions.
      </p>
    </div>
  );
}
