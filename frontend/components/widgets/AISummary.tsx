"use client";
import { Brain, Clock } from "lucide-react";
import type { RiskScore, TimeHorizons } from "@/lib/api";
import { cn, riskColor } from "@/lib/utils";

interface Props {
  summary:       string;
  riskScore:     RiskScore;
  disclaimer:    string;
  computedAt:    string;
  timeHorizons?: TimeHorizons;
}

function parseSummary(text: string): { text: string; type: "headline" | "horizon" | "disclaimer" | "body" }[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return sentences.map((s) => {
    const t = s.trim();
    if (!t) return null;
    if (/(short-term energy risk|risk is (low|medium|high))/i.test(t))
      return { text: t, type: "headline" as const };
    if (/(situational awareness|not a trading|not.*advice|informational)/i.test(t))
      return { text: t, type: "disclaimer" as const };
    return { text: t, type: "body" as const };
  }).filter(Boolean) as any[];
}

const HORIZON_COLORS = {
  short_term: "text-gray-200",
  near_term:  "text-amber-400/80",
  outlook:    "text-gray-400",
};

export default function AISummary({ summary, riskScore, disclaimer, computedAt, timeHorizons }: Props) {
  const parts = parseSummary(summary);
  const time  = new Date(computedAt).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago", timeZoneName: "short",
  });

  return (
    <div className="card-glass border border-white/5 p-6 lg:col-span-2">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Brain className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-sm font-semibold text-white">Energy Risk Intelligence Summary</p>
        </div>
        <span className="text-xs text-gray-600 font-mono">{time}</span>
      </div>

      {/* Prose summary */}
      <div className="space-y-1.5 mb-5">
        {parts.map((p, i) => (
          <p
            key={i}
            className={cn(
              "text-sm leading-relaxed",
              p.type === "headline"   ? cn("font-bold", riskColor(riskScore)) :
              p.type === "disclaimer" ? "text-gray-600 text-xs" :
                                        "text-gray-300"
            )}
          >
            {p.text}
          </p>
        ))}
      </div>

      {/* Phase 1 — Structured time horizons block */}
      {timeHorizons && (
        <div className="border-t border-white/5 pt-4 mb-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Time Horizon Outlook</p>
          </div>
          <div className="space-y-2">
            {([
              ["short_term", timeHorizons.short_term],
              ["near_term",  timeHorizons.near_term],
              ["outlook",    timeHorizons.outlook],
            ] as [keyof typeof HORIZON_COLORS, string][]).map(([key, line]) => (
              <div key={key} className="flex gap-2">
                <span className={cn("text-xs font-mono leading-relaxed", HORIZON_COLORS[key])}>
                  {line}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      {disclaimer && (
        <div className="px-3 py-2.5 rounded-lg bg-white/3 border border-white/6">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="text-gray-500 font-medium">ⓘ </span>{disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
