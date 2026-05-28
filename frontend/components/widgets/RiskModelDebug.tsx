"use client";
import { useState } from "react";
import { Bug, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import type { RiskModel } from "@/lib/energyRiskEngine";
import type { ValidationResult } from "@/lib/dataValidation";
import { cn } from "@/lib/utils";

interface Props {
  riskModel?:  RiskModel | null;
  validation?: ValidationResult | null;
}

function Field({
  label,
  value,
  cls,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  cls?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest w-36 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className={cn(mono ? "font-mono" : "", "text-xs break-all", cls ?? "text-gray-300")}>
        {value}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest mt-4 mb-1 border-t border-white/5 pt-3">
      {children}
    </p>
  );
}

export default function RiskModelDebug({ riskModel, validation }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:col-span-2 card-glass border border-white/5 rounded-2xl overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-5 py-3 hover:bg-white/3 transition-colors text-left"
      >
        <Bug className="w-3.5 h-3.5 text-gray-700" />
        <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest flex-1">
          Risk Engine Debug Output
        </span>
        <span className="text-[9px] text-gray-700 uppercase tracking-wide mr-2 font-semibold">
          {open ? "collapse" : "expand"}
        </span>
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-gray-700" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-700" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-white/5">
          {!riskModel ? (
            <p className="text-xs text-gray-600 italic pt-4">
              Engine output unavailable — data not yet valid or engine threw an error.
            </p>
          ) : (
            <div className="pt-2">

              {/* ── Risk Classification ────────────────────────────── */}
              <SectionLabel>Risk Classification</SectionLabel>
              <Field
                label="Risk Level"
                value={riskModel.riskLevel}
                cls={
                  riskModel.riskLevel === "high"   ? "text-red-400"
                  : riskModel.riskLevel === "medium" ? "text-amber-400"
                  : "text-green-400"
                }
              />
              <Field
                label="Primary Driver"
                value={riskModel.primaryDriver || "—"}
                cls="text-gray-200"
              />
              <Field
                label="Secondary Drivers"
                value={riskModel.secondaryDrivers.length > 0
                  ? riskModel.secondaryDrivers.join(", ")
                  : "None"}
              />

              {/* ── Market State ───────────────────────────────────── */}
              <SectionLabel>Market State</SectionLabel>
              <Field
                label="State"
                value={riskModel.marketState.state}
                cls="text-cyan-400"
              />
              <Field
                label="State Label"
                value={riskModel.marketState.label}
              />
              <Field
                label="Urgency"
                value={riskModel.marketState.urgency}
                cls={
                  riskModel.marketState.urgency === "high"   ? "text-red-400"
                  : riskModel.marketState.urgency === "medium" ? "text-amber-400"
                  : "text-gray-400"
                }
              />
              <Field
                label="Explanation"
                value={riskModel.marketState.explanation || "—"}
                mono={false}
                cls="text-gray-400"
              />
              <Field
                label="Price Behavior"
                value={riskModel.priceBehavior}
              />

              {/* ── Escalation Probability ────────────────────────── */}
              <SectionLabel>Escalation Probability</SectionLabel>
              <Field
                label="Tier"
                value={riskModel.escalationProbability.tier}
                cls={
                  riskModel.escalationProbability.tier === "Critical" ? "text-red-400"
                  : riskModel.escalationProbability.tier === "Elevated" ? "text-amber-400"
                  : riskModel.escalationProbability.tier === "Moderate" ? "text-blue-400"
                  : "text-gray-400"
                }
              />
              <Field
                label="Label"
                value={riskModel.escalationProbability.label}
              />
              <Field
                label="Pct"
                value={`${riskModel.escalationProbability.pct}%`}
              />
              <Field
                label="Rationale"
                value={riskModel.escalationProbability.rationale || "—"}
                mono={false}
                cls="text-gray-400"
              />

              {/* ── Confidence ────────────────────────────────────── */}
              <SectionLabel>Confidence</SectionLabel>
              <Field
                label="Score"
                value={`${riskModel.confidence}%`}
                cls={
                  riskModel.confidence >= 75 ? "text-green-400"
                  : riskModel.confidence >= 60 ? "text-amber-400"
                  : "text-red-400"
                }
              />
              <Field
                label="Note"
                value={riskModel.confidenceNote || "—"}
                mono={false}
                cls="text-gray-500"
              />
              <Field
                label="Data Valid"
                value={String(riskModel.dataValid)}
                cls={riskModel.dataValid ? "text-green-400" : "text-red-400"}
              />

              {/* ── Pressure Levels ───────────────────────────────── */}
              <SectionLabel>Pressure Levels</SectionLabel>
              <Field label="Gas Supply"     value={riskModel.gasSupplyLevel} />
              <Field label="Weather Demand" value={riskModel.weatherDemandLevel} />

              {/* ── Early Warning Signals ─────────────────────────── */}
              <SectionLabel>Early Warning Signals</SectionLabel>
              {riskModel.earlyWarningSignals.length === 0 ? (
                <p className="text-[10px] text-gray-700 italic py-1">No active early warnings.</p>
              ) : (
                <div className="space-y-1 mt-1">
                  {riskModel.earlyWarningSignals.map((w) => (
                    <div
                      key={w.id}
                      className={cn(
                        "flex items-start gap-2 px-2 py-1.5 rounded border text-[10px]",
                        w.severity === "elevated"
                          ? "text-orange-400 bg-orange-500/8 border-orange-500/20"
                          : w.severity === "advisory"
                          ? "text-amber-400 bg-amber-500/8 border-amber-500/20"
                          : "text-gray-500 bg-white/3 border-white/8",
                      )}
                    >
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span className="font-mono">
                        [{w.severity}] {w.id} — {w.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Data Validation ───────────────────────────────── */}
              {validation && (
                <>
                  <SectionLabel>Data Validation</SectionLabel>
                  <Field
                    label="Conf. Penalty"
                    value={`${validation.overallConfidencePenalty}%`}
                    cls={validation.overallConfidencePenalty > 0 ? "text-amber-400" : "text-gray-500"}
                  />
                  <Field
                    label="ERCOT"
                    value={`${validation.ercot.status} — penalty ${validation.ercot.penaltyPct}%`}
                    cls={validation.ercot.isUsable ? "text-green-400" : "text-red-400"}
                  />
                  <Field
                    label="Weather"
                    value={`${validation.weather.status} — penalty ${validation.weather.penaltyPct}%`}
                    cls={validation.weather.isUsable ? "text-green-400" : "text-amber-400"}
                  />
                  <Field
                    label="Gas / EIA"
                    value={`${validation.gas.status} — penalty ${validation.gas.penaltyPct}%`}
                    cls={validation.gas.isUsable ? "text-green-400" : "text-amber-400"}
                  />
                  {validation.warnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {validation.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-400">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
