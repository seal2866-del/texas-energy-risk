"use client";
import { Clock } from "lucide-react";

interface Props {
  riskScore:    string;
  riskDirection: string;
  snapshots?:   { risk_numeric?: number; computed_at?: string }[];
  timeHorizons?: { short_term?: string; near_term?: string; outlook?: string } | Record<string, string>;
}

type RiskLevel = "low" | "medium" | "high";

interface TimePoint {
  label:     string;
  sublabel:  string;
  risk:      RiskLevel;
  note:      string;
}

function projectRisk(current: RiskLevel, direction: string, hoursAhead: number): RiskLevel {
  if (current === "high") return "high";
  if (current === "medium") {
    if (direction === "increasing" && hoursAhead >= 24) return "high";
    if (direction === "decreasing" && hoursAhead >= 12) return "low";
    return "medium";
  }
  // low
  if (direction === "increasing") {
    if (hoursAhead >= 48) return "medium";
    if (hoursAhead >= 24) return "low";
  }
  return "low";
}

function riskColor(risk: RiskLevel): { bg: string; text: string; border: string } {
  if (risk === "high")   return { bg: "bg-red-500/15",   text: "text-red-400",   border: "border-red-500/30" };
  if (risk === "medium") return { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" };
  return                        { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" };
}

export default function RiskTimeline({ riskScore, riskDirection, timeHorizons }: Props) {
  const current = (riskScore || "low") as RiskLevel;
  const dir     = riskDirection || "stable";

  const points: TimePoint[] = [
    {
      label:    "Now",
      sublabel: "Current",
      risk:     current,
      note:     current === "low" ? "Normal operations" : current === "medium" ? "Enhanced monitoring" : "Review recommended",
    },
    {
      label:    "6 Hours",
      sublabel: "Short-term",
      risk:     projectRisk(current, dir, 6),
      note:     (timeHorizons as any)?.short_term?.split("·")[0]?.trim() || "Based on current trajectory",
    },
    {
      label:    "24 Hours",
      sublabel: "Near-term",
      risk:     projectRisk(current, dir, 24),
      note:     (timeHorizons as any)?.near_term?.split("·")[0]?.trim() || "Probabilistic projection",
    },
    {
      label:    "48 Hours",
      sublabel: "Outlook",
      risk:     projectRisk(current, dir, 48),
      note:     (timeHorizons as any)?.outlook?.split("·")[0]?.trim() || "Extended outlook",
    },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Risk Timeline
        </p>
        <span className="ml-auto text-[10px] text-gray-600">Probabilistic — not a forecast</span>
      </div>

      {/* Timeline grid */}
      <div className="grid grid-cols-4 gap-3">
        {points.map((p, i) => {
          const colors = riskColor(p.risk);
          const isNow  = i === 0;
          return (
            <div key={p.label} className="relative">
              {/* Connector line */}
              {i < points.length - 1 && (
                <div className="absolute top-6 left-[calc(50%+16px)] right-[-12px] h-px bg-white/10 z-0" />
              )}

              <div className={`relative z-10 rounded-xl border p-3 text-center ${colors.bg} ${colors.border} ${isNow ? "ring-1 ring-white/15" : ""}`}>
                <p className={`text-[9px] uppercase tracking-widest font-semibold mb-1 ${isNow ? "text-gray-300" : "text-gray-500"}`}>
                  {p.label}
                </p>
                <p className={`text-sm font-black capitalize mb-1 ${colors.text}`}>
                  {p.risk}
                </p>
                <p className="text-[9px] text-gray-500 leading-tight">{p.note}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-600 mt-3">
        Projections based on current risk trajectory. Actual conditions may vary.
      </p>
    </div>
  );
}
