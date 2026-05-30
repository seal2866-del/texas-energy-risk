"use client";
import { Clock, AlertTriangle } from "lucide-react";

interface Props {
  riskScore: string;
  ercotPrice?: number;
  temperature?: number;
  henryHub?: number;
}

function getNextReviewTime(risk: string): string {
  if (risk === "high")   return "Continuous monitoring";
  if (risk === "medium") return "Every 30 minutes";
  const h = new Date().getHours();
  if (h < 14) return "14:00 CDT";
  if (h < 16) return "16:00 CDT";
  if (h < 19) return "19:00 CDT";
  return "Next scheduled refresh";
}

export default function NextReview({ riskScore, ercotPrice, temperature, henryHub }: Props) {
  const nextReview = getNextReviewTime(riskScore);

  const triggers = [
    { condition: `ERCOT exceeds $35/MWh`, current: ercotPrice ?? 0, threshold: 35, met: (ercotPrice ?? 0) >= 35 },
    { condition: `Temperature exceeds 95°F`, current: temperature ?? 0, threshold: 95, met: (temperature ?? 0) >= 95 },
    { condition: `Henry Hub exceeds $3.00/MMBtu`, current: henryHub ?? 0, threshold: 3.0, met: (henryHub ?? 0) >= 3.0 },
    { condition: `ERCOT emergency notice issued`, current: 0, threshold: 1, met: false },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Next Review</p>
      </div>

      {/* Review time */}
      <div className="bg-white/5 border border-white/8 rounded-xl p-3 mb-4 text-center">
        <p className="text-xl font-black text-white">{nextReview}</p>
        <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">
          {riskScore === "high" ? "Do not leave unmonitored" : riskScore === "medium" ? "Enhanced monitoring cadence" : "Standard monitoring cadence"}
        </p>
      </div>

      {/* Early triggers */}
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Review sooner if:
      </p>
      <div className="space-y-1.5">
        {triggers.map((t) => (
          <div key={t.condition} className="flex items-center gap-2">
            <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${t.met ? "text-red-400" : "text-gray-600"}`} />
            <span className={`text-xs ${t.met ? "text-amber-300 font-semibold" : "text-gray-400"}`}>
              {t.condition}
            </span>
            {t.met && (
              <span className="text-[10px] font-bold text-red-400 uppercase ml-auto">NOW</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
