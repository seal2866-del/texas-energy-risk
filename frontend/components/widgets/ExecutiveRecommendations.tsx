"use client";
import { Target, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface Props {
  riskScore:           string;
  riskDirection:       string;
  escalationProbability?: number;
  ercotPrice?:         number;
  temperature?:        number;
  henryHub?:           number;
  demandPressure?:     { level: string };
  supplyPressure?:     { level: string };
  marketReaction?:     { level: string };
  activeSignals?:      number;
}

type Priority = "Normal" | "Elevated" | "High";

interface Recommendation { text: string; }

function buildRecommendations(props: Props): {
  assessment: string; actions: Recommendation[]; priority: Priority;
  priorityColor: string; priorityBg: string; reasoning: string;
} {
  const { riskScore, riskDirection, escalationProbability = 10, ercotPrice, temperature, henryHub,
          demandPressure, supplyPressure, marketReaction, activeSignals = 0 } = props;

  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";
  const market = marketReaction?.level || "low";
  const price  = ercotPrice  ?? 0;
  const temp   = temperature ?? 0;
  const hh     = henryHub    ?? 0;
  const rising = riskDirection === "increasing";

  let priority: Priority = "Normal";
  if (riskScore === "high" || activeSignals >= 2) priority = "High";
  else if (riskScore === "medium" || rising || escalationProbability > 30) priority = "Elevated";

  const priorityConfig = {
    High:     { color: "text-red-400",   bg: "bg-red-500/8 border-red-500/20" },
    Elevated: { color: "text-amber-400", bg: "bg-amber-500/8 border-amber-500/20" },
    Normal:   { color: "text-green-400", bg: "bg-green-500/5 border-green-500/15" },
  }[priority];

  let assessment = "";
  const actions: Recommendation[] = [];
  let reasoning = "";

  if (priority === "High") {
    assessment = "High operational risk conditions detected. Immediate attention may be warranted.";
    actions.push(
      { text: "Review operational exposure and confirm contingency protocols are in place." },
      { text: "Increase ERCOT monitoring frequency — check pricing every 15 minutes." },
      { text: "Notify operations leadership of elevated grid conditions." },
      { text: "Assess non-critical load deferral options during peak demand window (14:00–19:00 CDT)." },
      { text: "Confirm backup generation capacity and fuel supply availability." },
    );
    reasoning = `Multiple risk signals are active simultaneously. ${activeSignals} escalation signal${activeSignals !== 1 ? "s" : ""} detected. ${price >= 35 ? `ERCOT at $${price.toFixed(2)}/MWh exceeds watch threshold. ` : ""}${temp >= 95 ? `Temperature of ${temp.toFixed(0)}°F exceeds demand escalation threshold. ` : ""}Conditions warrant elevated operational awareness.`;
  } else if (priority === "Elevated") {
    assessment = "Moderate operational risk conditions detected. Enhanced monitoring is recommended.";
    actions.push(
      { text: `Monitor ERCOT pricing during 14:00–19:00 CDT peak window${price > 0 ? ` (currently $${price.toFixed(2)}/MWh)` : ""}.` },
      { text: "Review current operational schedules for energy-intensive activities during peak hours." },
      { text: `Track weather forecasts — escalation watch active above ${temp >= 88 ? "95" : "95"}°F.` },
    );
    if (supply === "medium" || supply === "high") {
      actions.push({ text: `Monitor Henry Hub conditions${hh > 0 ? ` ($${hh.toFixed(2)}/MMBtu)` : ""} — supply tightness may increase fuel cost sensitivity.` });
    }
    if (escalationProbability > 20) {
      actions.push({ text: `Prepare contingency review if escalation probability exceeds 70% (currently ${escalationProbability}%).` });
    }
    actions.push({ text: "Continue normal operations at this time — no immediate action required." });
    reasoning = `${rising ? "Risk is trending higher. " : ""}${demand === "medium" || demand === "high" ? `Weather-driven demand pressure is elevated${temp > 0 ? ` (${temp.toFixed(0)}°F)` : ""}. ` : ""}${market === "medium" || market === "high" ? `ERCOT pricing shows sensitivity at $${price.toFixed(2)}/MWh. ` : ""}Conditions warrant increased monitoring frequency but do not currently require operational changes.`;
  } else {
    assessment = "Stable operational conditions. Standard monitoring procedures apply.";
    actions.push(
      { text: "Continue standard monitoring cadence — no operational changes required." },
      { text: "Reassess conditions during afternoon peak window (14:00–19:00 CDT)." },
      { text: "Review tomorrow's weather forecast for early awareness of developing conditions." },
    );
    reasoning = `All monitored signals are within normal operating ranges. ERCOT pricing${price > 0 ? ` ($${price.toFixed(2)}/MWh)` : ""} is below watch thresholds. Weather conditions${temp > 0 ? ` (${temp.toFixed(0)}°F)` : ""} are within seasonal norms. Natural gas supply conditions appear adequate. No escalation signals are active.`;
  }

  return { assessment, actions, priority, priorityColor: priorityConfig.color, priorityBg: priorityConfig.bg, reasoning };
}

export default function ExecutiveRecommendations(props: Props) {
  const [showReasoning, setShowReasoning] = useState(false);
  const { assessment, actions, priority, priorityColor, priorityBg, reasoning } = buildRecommendations(props);

  return (
    <div className={`rounded-2xl border p-5 lg:col-span-2 ${priorityBg}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Executive Recommendations</p>
        </div>
        <span className={`text-xs font-black uppercase ${priorityColor}`}>{priority} Priority</span>
      </div>

      <p className="text-sm text-gray-200 font-medium mb-4">{assessment}</p>

      <div className="space-y-2 mb-4">
        {actions.map((a, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${priority === "High" ? "bg-red-400" : priority === "Elevated" ? "bg-amber-400" : "bg-green-400"}`} />
            <p className="text-xs text-gray-300 leading-relaxed">{a.text}</p>
          </div>
        ))}
      </div>

      <button onClick={() => setShowReasoning(s => !s)}
        className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
        {showReasoning ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showReasoning ? "Hide reasoning" : "View reasoning"}
      </button>

      {showReasoning && (
        <div className="mt-3 p-3 rounded-lg bg-white/3 border border-white/5">
          <p className="text-[11px] text-gray-400 leading-relaxed">{reasoning}</p>
        </div>
      )}

      <p className="text-[10px] text-gray-700 mt-3 pt-2 border-t border-white/5">
        Operational awareness only. Not financial, procurement, or operational advice.
      </p>
    </div>
  );
}
