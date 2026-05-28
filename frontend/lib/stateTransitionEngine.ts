/**
 * stateTransitionEngine.ts
 * Phase 9 — Predictive Intelligence Engine
 * Tracks how risk conditions evolve over time.
 * Detects transition frequency, state durations, escalation loops,
 * and failed recovery patterns. Pure computation — no API calls.
 */
import type { SignalSnapshot } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskState = "low" | "medium" | "high" | "unknown";

export interface StateTransition {
  from:       RiskState;
  to:         RiskState;
  at:         string;   // ISO timestamp
  direction:  "escalation" | "recovery" | "lateral" | "unknown";
}

export interface StateDuration {
  state:        RiskState;
  durationHours: number;
  enteredAt:    string;
  exitedAt:     string | null;   // null = still active
}

export interface TransitionPattern {
  escalationCount:    number;   // low→med or med→high
  recoveryCount:      number;   // high→med or med→low
  lateralCount:       number;   // same-tier shifts
  loopCount:          number;   // escalation followed by recovery within 6h
  failedRecoveries:   number;   // recovery that reversed back within 4h
}

export interface StateTransitionAnalysis {
  currentState:        RiskState;
  currentDurationHours: number;
  recentTransitions:   StateTransition[];      // last 10
  stateDurations:      StateDuration[];        // all durations
  pattern:             TransitionPattern;
  instabilityScore:    number;                 // 0–100
  transitionStrength:  "weak" | "moderate" | "strong";
  dominantState:       RiskState;              // most time spent in
  avgEscalationHours:  number | null;          // avg hours before escalation
  explanation:         string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toState(snap: SignalSnapshot): RiskState {
  const s = snap.risk_score?.toLowerCase();
  if (s === "low" || s === "medium" || s === "high") return s as RiskState;
  return "unknown";
}

function hoursBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

function transitionDirection(from: RiskState, to: RiskState): StateTransition["direction"] {
  const rank: Record<RiskState, number> = { low: 0, medium: 1, high: 2, unknown: -1 };
  const df = rank[from], dt = rank[to];
  if (df < 0 || dt < 0) return "unknown";
  if (dt > df) return "escalation";
  if (dt < df) return "recovery";
  return "lateral";
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Analyse state transitions from a sorted (ascending) array of snapshots.
 * Returns null if fewer than 3 snapshots.
 */
export function analyseStateTransitions(
  snapshots: SignalSnapshot[],
): StateTransitionAnalysis | null {
  if (!snapshots || snapshots.length < 3) return null;

  // ── Build transition list ──────────────────────────────────────────────────
  const transitions: StateTransition[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = toState(snapshots[i - 1]);
    const curr = toState(snapshots[i]);
    if (prev !== curr) {
      transitions.push({
        from:      prev,
        to:        curr,
        at:        snapshots[i].computed_at,
        direction: transitionDirection(prev, curr),
      });
    }
  }

  // ── Build state duration segments ──────────────────────────────────────────
  const durations: StateDuration[] = [];
  if (snapshots.length > 0) {
    let segState   = toState(snapshots[0]);
    let segStart   = snapshots[0].computed_at;
    for (let i = 1; i < snapshots.length; i++) {
      const s = toState(snapshots[i]);
      if (s !== segState) {
        durations.push({
          state:         segState,
          durationHours: hoursBetween(segStart, snapshots[i].computed_at),
          enteredAt:     segStart,
          exitedAt:      snapshots[i].computed_at,
        });
        segState = s;
        segStart = snapshots[i].computed_at;
      }
    }
    // Still-active segment
    durations.push({
      state:         segState,
      durationHours: hoursBetween(segStart, snapshots[snapshots.length - 1].computed_at),
      enteredAt:     segStart,
      exitedAt:      null,
    });
  }

  // ── Pattern detection ──────────────────────────────────────────────────────
  let escalationCount  = 0;
  let recoveryCount    = 0;
  let lateralCount     = 0;
  let loopCount        = 0;
  let failedRecoveries = 0;

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    if (t.direction === "escalation") escalationCount++;
    if (t.direction === "recovery")   recoveryCount++;
    if (t.direction === "lateral")    lateralCount++;

    // Loop: escalation followed by recovery within 6 hours
    if (t.direction === "escalation" && i + 1 < transitions.length) {
      const next = transitions[i + 1];
      if (next.direction === "recovery" && hoursBetween(t.at, next.at) <= 6) {
        loopCount++;
      }
    }

    // Failed recovery: recovery followed by escalation within 4 hours
    if (t.direction === "recovery" && i + 1 < transitions.length) {
      const next = transitions[i + 1];
      if (next.direction === "escalation" && hoursBetween(t.at, next.at) <= 4) {
        failedRecoveries++;
      }
    }
  }

  // ── Current state ──────────────────────────────────────────────────────────
  const currentState        = toState(snapshots[snapshots.length - 1]);
  const currentDurationHours = durations.length > 0
    ? durations[durations.length - 1].durationHours
    : 0;

  // ── Dominant state (most total time) ──────────────────────────────────────
  const stateTotals: Record<RiskState, number> = { low: 0, medium: 0, high: 0, unknown: 0 };
  for (const d of durations) stateTotals[d.state] += d.durationHours;
  const dominantState = (Object.keys(stateTotals) as RiskState[])
    .reduce((a, b) => stateTotals[a] >= stateTotals[b] ? a : b);

  // ── Average hours before first escalation ─────────────────────────────────
  const escTimes = transitions
    .filter(t => t.direction === "escalation")
    .map(t => {
      // time since previous transition (or start)
      const tIdx = transitions.indexOf(t);
      if (tIdx === 0) return hoursBetween(snapshots[0].computed_at, t.at);
      return hoursBetween(transitions[tIdx - 1].at, t.at);
    });
  const avgEscalationHours = escTimes.length
    ? escTimes.reduce((a, b) => a + b, 0) / escTimes.length
    : null;

  // ── Instability score (0–100) ──────────────────────────────────────────────
  const transitionRate   = transitions.length / Math.max(snapshots.length / 12, 1); // per 12 snaps
  const loopPenalty      = loopCount * 15;
  const failedPenalty    = failedRecoveries * 10;
  const freqScore        = Math.min(50, transitionRate * 15);
  const instabilityScore = Math.min(100, Math.round(freqScore + loopPenalty + failedPenalty));

  // ── Transition strength ────────────────────────────────────────────────────
  // Based on delta between from/to risk numeric
  const RISK_NUM: Record<RiskState, number> = { low: 2, medium: 5, high: 8.5, unknown: 2 };
  const recentTs   = transitions.slice(-3);
  const avgDelta   = recentTs.length
    ? recentTs.reduce((s, t) => s + Math.abs(RISK_NUM[t.to] - RISK_NUM[t.from]), 0) / recentTs.length
    : 0;
  const transitionStrength: StateTransitionAnalysis["transitionStrength"] =
    avgDelta >= 4.5 ? "strong" :
    avgDelta >= 2   ? "moderate" :
                      "weak";

  // ── Explanation ───────────────────────────────────────────────────────────
  const lines: string[] = [];
  lines.push(
    `Currently ${currentState} risk for ~${Math.round(currentDurationHours)}h. ` +
    `${transitions.length} state change${transitions.length !== 1 ? "s" : ""} observed.`
  );
  if (loopCount > 0) {
    lines.push(`${loopCount} escalation-recovery loop${loopCount > 1 ? "s" : ""} detected — conditions are cycling.`);
  }
  if (failedRecoveries > 0) {
    lines.push(`${failedRecoveries} failed recovery pattern${failedRecoveries > 1 ? "s" : ""}: risk re-escalated shortly after easing.`);
  }
  if (instabilityScore >= 60) {
    lines.push("High instability — frequent state changes indicate an unsettled market.");
  } else if (instabilityScore >= 30) {
    lines.push("Moderate instability — some oscillation in risk state.");
  } else {
    lines.push("Low instability — conditions have been relatively consistent.");
  }

  return {
    currentState,
    currentDurationHours: Math.round(currentDurationHours * 10) / 10,
    recentTransitions:    transitions.slice(-10),
    stateDurations:       durations,
    pattern: { escalationCount, recoveryCount, lateralCount, loopCount, failedRecoveries },
    instabilityScore,
    transitionStrength,
    dominantState,
    avgEscalationHours: avgEscalationHours !== null ? Math.round(avgEscalationHours * 10) / 10 : null,
    explanation: lines.join(" "),
  };
}

// ── Utility: instability colour ───────────────────────────────────────────────

export function instabilityColor(score: number): string {
  if (score >= 60) return "#ef4444";   // red
  if (score >= 30) return "#f59e0b";   // amber
  return "#22c55e";                    // green
}

export function transitionDirectionIcon(dir: StateTransition["direction"]): string {
  return dir === "escalation" ? "↑" : dir === "recovery" ? "↓" : dir === "lateral" ? "→" : "?";
}
