/**
 * predictiveOutlook.ts
 * Phase 9 — Predictive Intelligence Engine
 * Combines trajectory, state transitions, and pattern memory into
 * a unified 3-horizon predictive outlook with executive explanation.
 * Pure computation — no API calls.
 */
import type { SignalSnapshot } from "./api";
import { computeRiskTrajectory }     from "./riskTrajectory";
import { analyseStateTransitions }   from "./stateTransitionEngine";
import { matchPatterns }             from "./patternMemory";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OutlookRisk = "low" | "medium" | "high" | "uncertain";

export interface HorizonOutlook {
  label:           string;          // e.g. "0–6 Hours"
  riskLevel:       OutlookRisk;
  confidence:      number;          // 0–100
  escalationPct:   number;          // 0–100, probability of escalation
  summary:         string;
}

export interface ExecutiveLayer {
  why:         string;   // Why is risk at current level?
  what:        string;   // What is the dominant signal?
  watch:       string;   // What to monitor next
  next:        string;   // What is likely to happen
}

export interface PredictiveOutlook {
  shortTerm:    HorizonOutlook;    // 0–6h
  nearTerm:     HorizonOutlook;    // 6–24h
  outlookTerm:  HorizonOutlook;    // 24–48h
  executive:    ExecutiveLayer;
  overallRisk:  OutlookRisk;
  overallConfidence: number;
  dataPoints:   number;
  generatedAt:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function numToRisk(n: number): OutlookRisk {
  if (n >= 7)   return "high";
  if (n >= 4)   return "medium";
  if (n >= 0)   return "low";
  return "uncertain";
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Blend two values by weight
function blend(a: number, wa: number, b: number, wb: number): number {
  const total = wa + wb;
  return total > 0 ? (a * wa + b * wb) / total : a;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Build a full predictive outlook from a sorted (ascending) array of snapshots.
 * Returns null if fewer than 6 snapshots.
 */
export function buildPredictiveOutlook(
  snapshots: SignalSnapshot[],
): PredictiveOutlook | null {
  if (!snapshots || snapshots.length < 6) return null;

  const traj      = computeRiskTrajectory(snapshots);
  const trans     = analyseStateTransitions(snapshots);
  const pattern   = matchPatterns(snapshots, 6, 5);

  const latest    = snapshots[snapshots.length - 1];
  const baseRisk  = latest.risk_score_numeric ?? 2.0;
  const driver    = latest.primary_driver ?? "market conditions";

  // ── Short-term (0–6h) ────────────────────────────────────────────────────
  // Primarily driven by current trajectory + recent slope
  let stRisk       = baseRisk;
  let stConfidence = 60;
  let stEscPct     = 10;

  if (traj) {
    stRisk       = clamp(baseRisk + traj.recentSlope * 3, 0, 10);
    stConfidence = clamp(traj.confidenceScore, 30, 90);
    stEscPct     = traj.projectedDirection === "likely_elevating" ? 65
                 : traj.projectedDirection === "likely_stable"    ? 12
                 : traj.projectedDirection === "likely_reversing" ? 8
                 : 35;
    if (traj.trajectory === "Volatile") {
      stEscPct    = Math.max(stEscPct, 40);
      stConfidence = Math.min(stConfidence, 50);
    }
  }

  // Instability bonus
  if (trans && trans.instabilityScore >= 50) stEscPct = Math.min(85, stEscPct + 15);

  const shortTerm: HorizonOutlook = {
    label:         "0–6 Hours",
    riskLevel:     numToRisk(stRisk),
    confidence:    Math.round(stConfidence),
    escalationPct: Math.round(stEscPct),
    summary:       buildHorizonSummary("0–6h", numToRisk(stRisk), stEscPct, traj?.trajectory),
  };

  // ── Near-term (6–24h) ────────────────────────────────────────────────────
  // Blend trajectory + pattern memory
  let ntRisk       = stRisk;
  let ntConfidence = 50;
  let ntEscPct     = stEscPct;

  if (traj) {
    // Dampen slope impact over longer horizon
    ntRisk = clamp(baseRisk + traj.recentSlope * 5 * 0.6, 0, 10);
    ntConfidence = clamp(traj.confidenceScore - 10, 25, 80);
    ntEscPct = traj.projectedDirection === "likely_elevating" ? 55
             : traj.projectedDirection === "likely_stable"    ? 15
             : traj.projectedDirection === "likely_reversing" ? 12
             : 30;
  }

  if (pattern && pattern.predictedDirection !== "insufficient_data" && pattern.avgOutcomeNumeric !== null) {
    ntRisk       = blend(ntRisk, 0.55, pattern.avgOutcomeNumeric, 0.45);
    ntConfidence = blend(ntConfidence, 0.6, pattern.patternConfidence, 0.4);
    if (pattern.predictedDirection === "likely_higher") ntEscPct = Math.min(80, ntEscPct + 10);
    if (pattern.predictedDirection === "likely_lower")  ntEscPct = Math.max(5,  ntEscPct - 10);
  }

  if (trans && trans.pattern.loopCount > 0) {
    ntEscPct = Math.min(85, ntEscPct + trans.pattern.loopCount * 8);
  }

  const nearTerm: HorizonOutlook = {
    label:         "6–24 Hours",
    riskLevel:     numToRisk(ntRisk),
    confidence:    Math.round(ntConfidence),
    escalationPct: Math.round(ntEscPct),
    summary:       buildHorizonSummary("6–24h", numToRisk(ntRisk), ntEscPct, undefined),
  };

  // ── Outlook (24–48h) ─────────────────────────────────────────────────────
  // Mostly pattern memory + reversion to mean
  const MEAN_RISK = 3.5;
  let otRisk       = ntRisk * 0.5 + MEAN_RISK * 0.5;  // mean reversion
  let otConfidence = 35;
  let otEscPct     = 20;

  if (pattern && pattern.avgOutcomeNumeric !== null) {
    otRisk       = blend(otRisk, 0.5, pattern.avgOutcomeNumeric, 0.5);
    otConfidence = Math.min(60, pattern.patternConfidence * 0.6 + 10);
  }
  otEscPct = numToRisk(otRisk) === "high"   ? 60
           : numToRisk(otRisk) === "medium" ? 30
           : 12;

  const outlookTerm: HorizonOutlook = {
    label:         "24–48 Hours",
    riskLevel:     numToRisk(otRisk),
    confidence:    Math.round(otConfidence),
    escalationPct: Math.round(otEscPct),
    summary:       buildHorizonSummary("24–48h", numToRisk(otRisk), otEscPct, undefined),
  };

  // ── Executive layer ───────────────────────────────────────────────────────
  const currentLabel = latest.risk_score ?? "unknown";
  const why  = buildWhy(currentLabel, baseRisk, driver, traj?.trajectory);
  const what = buildWhat(driver, latest, traj);
  const watch = buildWatch(traj, trans, pattern);
  const next  = buildNext(shortTerm, nearTerm, traj, pattern);

  // ── Overall risk = worst of short + near ────────────────────────────────
  const rankMap: Record<OutlookRisk, number> = { low: 0, medium: 1, high: 2, uncertain: 1 };
  const overallRiskRaw = Math.max(rankMap[shortTerm.riskLevel], rankMap[nearTerm.riskLevel]);
  const overallRisk: OutlookRisk = overallRiskRaw >= 2 ? "high" : overallRiskRaw >= 1 ? "medium" : "low";
  const overallConfidence = Math.round((shortTerm.confidence + nearTerm.confidence) / 2);

  return {
    shortTerm,
    nearTerm,
    outlookTerm,
    executive:         { why, what, watch, next },
    overallRisk,
    overallConfidence,
    dataPoints:        snapshots.length,
    generatedAt:       new Date().toISOString(),
  };
}

// ── Explanation builders ──────────────────────────────────────────────────────

function buildHorizonSummary(
  label: string,
  risk: OutlookRisk,
  escPct: number,
  traj?: string,
): string {
  const trajNote = traj ? ` Trajectory: ${traj.toLowerCase()}.` : "";
  return `${label} outlook: ${risk} risk. ${escPct}% escalation probability.${trajNote}`;
}

function buildWhy(
  label: string,
  numeric: number,
  driver: string,
  traj?: string,
): string {
  const level = label === "high"   ? "High risk is being driven"
              : label === "medium" ? "Moderate risk conditions are sustained"
              : "Risk is currently low";
  return `${level} primarily by ${driver}. Current risk score: ${numeric.toFixed(1)}/10.${traj ? ` Trajectory is ${traj.toLowerCase()}.` : ""}`;
}

function buildWhat(
  driver: string,
  latest: SignalSnapshot,
  traj: ReturnType<typeof computeRiskTrajectory>,
): string {
  const price = latest.ercot_price ? ` ERCOT price: $${latest.ercot_price.toFixed(0)}/MWh.` : "";
  const mom   = traj ? ` Momentum: ${traj.momentum.toLowerCase()}.` : "";
  return `Dominant signal is ${driver}.${price}${mom}`;
}

function buildWatch(
  traj: ReturnType<typeof computeRiskTrajectory>,
  trans: ReturnType<typeof analyseStateTransitions>,
  pattern: ReturnType<typeof matchPatterns>,
): string {
  const parts: string[] = [];
  if (traj?.trajectory === "Tightening" || traj?.trajectory === "Escalating") {
    parts.push("monitor whether escalation momentum continues or reverses");
  }
  if (trans && trans.pattern.failedRecoveries > 0) {
    parts.push("watch for another failed recovery pattern");
  }
  if (trans && trans.pattern.loopCount >= 2) {
    parts.push("watch for repeated escalation-recovery cycling");
  }
  if (traj?.volatilityIndex && traj.volatilityIndex > 40) {
    parts.push("elevated market volatility — conditions can shift quickly");
  }
  if (pattern && pattern.predictedDirection === "likely_higher") {
    parts.push("historical patterns suggest upward risk pressure");
  }
  if (parts.length === 0) {
    parts.push("maintain normal monitoring cadence");
  }
  return parts.map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join("; ") + ".";
}

function buildNext(
  st: HorizonOutlook,
  nt: HorizonOutlook,
  traj: ReturnType<typeof computeRiskTrajectory>,
  pattern: ReturnType<typeof matchPatterns>,
): string {
  const stLabel = st.riskLevel;
  const ntLabel = nt.riskLevel;
  const rankMap: Record<OutlookRisk, number> = { low: 0, medium: 1, high: 2, uncertain: 1 };

  if (rankMap[ntLabel] > rankMap[stLabel]) {
    return `Conditions are likely to worsen in the 6–24h window. Escalation probability: ${nt.escalationPct}%.`;
  }
  if (rankMap[ntLabel] < rankMap[stLabel]) {
    return `Conditions are expected to ease within the next 24h. Risk likely to transition lower.`;
  }
  const patNote = pattern?.predictedDirection === "likely_same"
    ? " Historical patterns support continued stability."
    : "";
  return `Risk is expected to remain at ${stLabel} levels through the near term.${patNote}`;
}

// ── Utility exports ───────────────────────────────────────────────────────────

export function outlookRiskColor(r: OutlookRisk): string {
  const map: Record<OutlookRisk, string> = {
    low:      "#22c55e",
    medium:   "#f59e0b",
    high:     "#ef4444",
    uncertain: "#6b7280",
  };
  return map[r];
}

export function horizonConfidenceLabel(c: number): string {
  if (c >= 75) return "High Confidence";
  if (c >= 50) return "Moderate Confidence";
  return "Low Confidence";
}
