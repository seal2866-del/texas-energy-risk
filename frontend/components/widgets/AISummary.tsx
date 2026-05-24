"use client";
import { Sparkles, AlertCircle } from "lucide-react";

interface Props {
  summary:    string;
  riskScore:  string;
  disclaimer: string;
  computedAt: string;
}

function parseSummary(text: string): string[] {
  return text.split(/\.\s+(?=[A-Z])/).map((s) => s.trim().replace(/\.$/, "") + ".").filter(Boolean);
}

export default function AISummary({ summary, riskScore, disclaimer, computedAt }: Props) {
  const time = new Date(computedAt).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/Chicago", timeZoneName: "short",
  });
  const sentences = parseSummary(summary);

  return (
    <div className="card-glass p-6 border border-white/5 col-span-full">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Energy Risk Intelligence Summary</p>
            <span className="text-xs text-gray-500">{time}</span>
          </div>

          {sentences.length > 1 ? (
            <div className="space-y-2">
              {sentences.map((sentence, i) => {
                if (i === 0) return <p key={i} className="text-sm font-semibold text-white leading-relaxed">{sentence}</p>;
                if (sentence.includes("24") && sentence.toLowerCase().includes("outlook"))
                  return <p key={i} className="text-xs text-amber-300/80 leading-relaxed font-medium">{sentence}</p>;
                if (sentence.includes("situational awareness") || sentence.includes("not a trading"))
                  return <p key={i} className="text-xs text-gray-600 leading-relaxed">{sentence}</p>;
                return <p key={i} className="text-sm text-gray-300 leading-relaxed">{sentence}</p>;
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-200 leading-relaxed">{summary}</p>
          )}

          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/70 leading-relaxed">{disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
