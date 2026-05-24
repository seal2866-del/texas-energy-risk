"use client";
import { Sparkles, AlertCircle } from "lucide-react";

interface Props {
  summary:     string;
  riskScore:   string;
  disclaimer:  string;
  computedAt:  string;
}

export default function AISummary({ summary, riskScore, disclaimer, computedAt }: Props) {
  const time = new Date(computedAt).toLocaleTimeString("en-US", {
    hour:         "numeric",
    minute:       "2-digit",
    timeZone:     "America/Chicago",
    timeZoneName: "short",
  });

  return (
    <div className="card-glass p-6 border border-white/5 col-span-full">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-white">
              AI-Generated Energy Risk Summary
            </p>
            <span className="text-xs text-gray-500">{time}</span>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed">{summary}</p>

          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/70 leading-relaxed">{disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
