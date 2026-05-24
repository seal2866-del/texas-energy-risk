"use client";
import { Activity, ShieldAlert } from "lucide-react";
import type { RiskScore as RiskScoreType } from "@/lib/api";
import { cn, riskColor, riskBg } from "@/lib/utils";

interface Props {
  score:          RiskScoreType;
  activeSignals:  number;
  computedAt:     string;
  summary:        string;
  confidence?:    number;
  explanation?:   string;
  impact?:        string;
}

const SCORE_CONFIG = {
  low:    { label: "LOW RISK",    icon: "🟢", ring: "ring-green-500/40",  bar: "bg-green-500" },
  medium: { label: "MEDIUM RISK", icon: "🟡", ring: "ring-amber-500/40",  bar: "bg-amber-500" },
  high:   { label: "HIGH RISK",   icon: "🔴", ring: "ring-red-500/40",    bar: "bg-red-500"   },
};

const CONFIDENCE_COLOR = (c: number) =>
  c >= 75 ? "text-green-400" : c >= 55 ? "text-amber-400" : "text-gray-500";

export default function RiskScore({
  score, activeSignals, computedAt, summary,
  confidence, explanation, impact,
}: Props) {
  const cfg = SCORE_CONFIG[score];

  return (
    <div className={cn("card-glass p-6 border", riskBg(score))}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
            Texas Energy Risk Score
          </p>
          <div className="flex items-center gap-3 mt-2">
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center ring-4",
              cfg.ring,
              score === "high" ? "alert-pulse" : ""
            )}>
              <span className="text-2xl">{cfg.icon}</span>
            </div>
            <div>
              {/* Task 5 — Confidence score next to risk label */}
              <p className={cn("text-3xl font-black tracking-tight", riskColor(score))}>
                {cfg.label}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {/* Task 7 — "active risk drivers" language */}
                <p className="text-xs text-gray-500">
                  {activeSignals} active risk driver{activeSignals !== 1 ? "s" : ""}
                </p>
                {confidence !== undefined && (
                  <>
                    <span className="text-gray-700">·</span>
                    <p className={cn("text-xs font-semibold", CONFIDENCE_COLOR(confidence))}>
                      Confidence: {confidence}%
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <Activity className="w-5 h-5 text-gray-600" />
      </div>

      {/* Signal intensity bar */}
      <div className="mt-5">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Signal intensity</span>
          <span>{activeSignals}/3</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", cfg.bar)}
            style={{ width: `${(activeSignals / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Task 3 — Dynamic risk explanation by driver */}
      {explanation && (
        <p className="mt-4 text-sm text-gray-200 leading-relaxed font-medium">
          {explanation}
        </p>
      )}

      {/* Task 4 — "Why it matters" */}
      {impact && (
        <div className={cn(
          "mt-3 px-3 py-2 rounded-lg border text-xs leading-relaxed",
          score === "high"
            ? "bg-red-500/10 border-red-500/20 text-red-300"
            : score === "medium"
            ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
            : "bg-white/3 border-white/8 text-gray-400"
        )}>
          <span className="font-semibold uppercase tracking-wide mr-1.5">
            {score === "high" ? "⚠ Why this matters:" : score === "medium" ? "ℹ Why this matters:" : "✓ Status:"}
          </span>
          {impact}
        </div>
      )}

      {/* Fallback summary if no structured fields */}
      {!explanation && (
        <p className="mt-4 text-sm text-gray-300 leading-relaxed line-clamp-3">
          {summary}
        </p>
      )}

      <p className="mt-3 text-xs text-gray-600">
        Updated {new Date(computedAt).toLocaleTimeString("en-US", {
          timeZone: "America/Chicago", timeZoneName: "short"
        })}
      </p>
    </div>
  );
}
