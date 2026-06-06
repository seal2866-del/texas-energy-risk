"use client";
import { CheckCircle, AlertTriangle, XCircle, Clock, Shield } from "lucide-react";

interface Props {
  riskScore:       string;
  riskDirection:   string;
  confidence?:     number | null;
  ercotPrice?:     number;
  temperature?:    number;
  henryHub?:       number;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  activeSignals?:  number;
  computedAt?:     string;
}

function getNextReview(): string {
  const h = new Date().getHours();
  if (h < 6)  return "06:00 CDT";
  if (h < 14) return "14:00 CDT";
  if (h < 16) return "16:00 CDT";
  if (h < 19) return "19:00 CDT";
  return "06:00 CDT tomorrow";
}

function confidenceLabel(c: number | null | undefined): string {
  if (!c) return "Moderate";
  if (c >= 80) return "High";
  if (c >= 50) return "Moderate";
  return "Limited";
}

function costImpact(risk: string, market: string): string {
  if (risk === "high")   return "Elevated — review internally";
  if (risk === "medium") return "Moderate sensitivity possible";
  return "Minimal";
}

export default function CurrentRecommendation({
  riskScore, riskDirection, confidence, ercotPrice, temperature, henryHub,
  demandPressure, supplyPressure, marketReaction, activeSignals = 0, computedAt,
}: Props) {
  const risk   = riskScore || "low";
  const market = marketReaction?.level || "low";
  const price  = ercotPrice  ?? 0;
  const temp   = temperature ?? 0;
  const hh     = henryHub    ?? 0;

  type State = { label: string; desc: string; icon: React.ReactNode; labelColor: string; bg: string; border: string };

  const state: State =
    risk === "high" || activeSignals >= 2
      ? {
          label:      "ELEVATED CONDITIONS DETECTED",
          desc:       "Multiple monitored signals indicate elevated operational significance. Internal escalation procedures may be warranted per organizational protocols.",
          icon:       <XCircle className="w-7 h-7 text-red-400 flex-shrink-0" />,
          labelColor: "text-red-300",
          bg:         "bg-red-500/8",
          border:     "border-red-500/25",
        }
      : risk === "medium"
      ? {
          label:      "INCREASED MONITORING PRIORITY",
          desc:       "Moderate operational conditions detected. Increased monitoring frequency during peak demand windows may be appropriate.",
          icon:       <AlertTriangle className="w-7 h-7 text-amber-400 flex-shrink-0" />,
          labelColor: "text-amber-300",
          bg:         "bg-amber-500/8",
          border:     "border-amber-500/25",
        }
      : {
          label:      "NO OPERATIONAL REVIEW REQUIRED",
          desc:       "Current Texas energy conditions remain within normal operating parameters. Standard monitoring procedures apply.",
          icon:       <CheckCircle className="w-7 h-7 text-green-400 flex-shrink-0" />,
          labelColor: "text-green-300",
          bg:         "bg-green-500/5",
          border:     "border-green-500/20",
        };

  const watchItems = [
    price > 0 ? `ERCOT > $75/MWh (now $${price.toFixed(2)})` : "ERCOT > $75/MWh",
    temp  > 0 ? `Temperature > 95°F (now ${temp.toFixed(0)}°F)` : "Temperature > 95°F",
    hh    > 0 ? `Henry Hub > $3.00/MMBtu (now $${hh.toFixed(2)})` : "Henry Hub > $3.00/MMBtu",
  ];

  return (
    <div className={`rounded-2xl border p-5 lg:col-span-2 ${state.bg} ${state.border}`}>
      {/* Label */}
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
        Current Recommendation
      </p>

      <div className="flex flex-col lg:flex-row lg:items-start gap-5">
        {/* Left — main state */}
        <div className="flex items-start gap-3 flex-1">
          {state.icon}
          <div>
            <p className={`text-xl font-black tracking-tight mb-1.5 ${state.labelColor}`}>
              {state.label}
            </p>
            <p className="text-sm text-gray-300 leading-relaxed mb-3">{state.desc}</p>

            {/* Watch items */}
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Monitor:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {watchItems.map((w) => (
                  <span key={w} className="text-xs text-gray-400">• {w}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right — meta */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 flex-shrink-0 lg:min-w-[160px]">
          <div className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Clock className="w-3 h-3 text-gray-500" />
              <p className="text-[9px] text-gray-500 uppercase tracking-wide">Next Review</p>
            </div>
            <p className="text-sm font-black text-white">{getNextReview()}</p>
          </div>
          <div className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Shield className="w-3 h-3 text-gray-500" />
              <p className="text-[9px] text-gray-500 uppercase tracking-wide">Confidence</p>
            </div>
            <p className="text-sm font-black text-white">{confidenceLabel(confidence)}</p>
          </div>
          <div className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-center lg:col-span-1 col-span-2">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Est. Cost Impact</p>
            <p className="text-xs font-bold text-gray-300">{costImpact(risk, market)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
