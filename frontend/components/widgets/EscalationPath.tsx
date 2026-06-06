"use client";
import { ArrowRight } from "lucide-react";

interface Props {
  ercotPrice?:  number;
  temperature?: number;
  henryHub?:    number;
  riskScore:    string;
}

interface Step {
  trigger:  string;
  action:   string;
  severity: "watch" | "elevated" | "critical";
  active:   boolean;
}

export default function EscalationPath({ ercotPrice, temperature, henryHub, riskScore }: Props) {
  const price = ercotPrice  ?? 0;
  const temp  = temperature ?? 0;
  const hh    = henryHub    ?? 0;

  const steps: Step[] = [
    {
      trigger:  "ERCOT > $75/MWh",
      action:   "Increased monitoring priority may apply",
      severity: "watch",
      active:   price >= 75,
    },
    {
      trigger:  "ERCOT > $50/MWh",
      action:   "Elevated operational awareness — review per internal procedures",
      severity: "elevated",
      active:   price >= 50,
    },
    {
      trigger:  "Temperature > 100°F",
      action:   "Demand conditions may warrant increased monitoring frequency",
      severity: "watch",
      active:   temp >= 100,
    },
    {
      trigger:  "Temperature > 100°F",
      action:   "Elevated operational significance — internal procedures may apply",
      severity: "critical",
      active:   temp >= 100,
    },
    {
      trigger:  "Henry Hub > $4.00/MMBtu",
      action:   "Gas supply conditions may warrant increased awareness",
      severity: "watch",
      active:   hh >= 3.0,
    },
    {
      trigger:  "ERCOT > $100/MWh",
      action:   "Significant conditions — internal escalation procedures may be warranted",
      severity: "critical",
      active:   price >= 100,
    },
  ];

  const severityStyle = {
    watch:    { dot: "bg-amber-400", trigger: "text-amber-300", action: "text-gray-300", bg: "bg-amber-500/5 border-amber-500/15" },
    elevated: { dot: "bg-orange-400", trigger: "text-orange-300", action: "text-gray-300", bg: "bg-orange-500/5 border-orange-500/15" },
    critical: { dot: "bg-red-400",   trigger: "text-red-300",   action: "text-gray-300", bg: "bg-red-500/5 border-red-500/15" },
  };

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
        Escalation Threshold Monitoring
      </p>
      <p className="text-xs text-gray-500 mb-4">Conditions being monitored — thresholds that may increase operational significance</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {steps.map((step) => {
          const style = severityStyle[step.severity];
          return (
            <div
              key={step.trigger}
              className={`rounded-xl border p-3 ${step.active ? style.bg : "bg-white/3 border-white/5"} ${step.active ? "ring-1 ring-white/10" : ""}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${step.active ? style.dot : "bg-gray-600"}`} />
                <p className={`text-[11px] font-bold ${step.active ? style.trigger : "text-gray-500"}`}>
                  {step.trigger}
                </p>
                {step.active && (
                  <span className="ml-auto text-[9px] font-black text-red-400 uppercase">ACTIVE</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 pl-4">
                <ArrowRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
                <p className={`text-xs ${step.active ? style.action : "text-gray-500"}`}>{step.action}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-600 mt-3">
        Operational guidance only. Not financial, procurement, or trading advice.
      </p>
    </div>
  );
}
