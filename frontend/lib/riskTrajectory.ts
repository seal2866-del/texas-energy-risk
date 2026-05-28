/**
 * riskTrajectory.ts
 * Phase 9 — Predictive Intelligence Engine
 * Analyzes directional movement of risk over time from signal snapshots.
 * Pure computation — no API calls.
 */
import type { SignalSnapshot } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrajectoryLabel =
  | "Stable"
  | "Improving"
  | "Tightening"
  | "Escalating"
  | "Volatile"
  | "Recovering";

export type MomentumLabel = "Low" | "Moderate" | "High";

export type ProjectedDirection =
  | "likely_stable"
  | "likely_elevating"
  | "likely_reversing"
  | "uncertain";

export interface RiskTrajectory {
  trajectory:         TrajectoryLabel;
  momentum:           MomentumLabel;
  acceleration:       number;        // −1 (decelerating) to +1 (accelerating)
  persistence:        number;        // hours in current trajectory
  projectedDirection: ProjectedDirection;
  recentSlope:        number;        // avg numeric change per snapshot interval
  volatilityIndex:    number;        // 0–100, stddev of recent risk numerics
  confidenceScore:    number;        // 0–100
  explanation:        string;
  dataPoints:         number;        // how many snapshots used
}

// ── Numeric helpers ───────────────────────────────────────────────────────────

const RISK_NUM: Record<string, number> = { low: 2.0, medium: 5.0, high: 8.5, unknown: 2.0 };

function toNum(snap: SignalSnapshot): number {
  return snap.risk_score_numeric ?? RISK_NUM[snap.risk_score] ?? 2.0;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length);
}

/** Ordinary least-squares slope over an array of y values (x = index). */
function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Compute risk trajectory from a sorted (ascending) array of snapshots.
 * Uses the most recent `windowSize` snapshots for computation.
 * Minimum 4 snapshots required; returns null if insufficient data.
 */
export function computeRiskTrajectory(
  snapshots: SignalSnapshot[],
  windowSize = 24,
): RiskTrajectory | null {
  if (!snapshots || snapshots.length < 4) return null;

  // Take the most recent window
  const window = snapshots.slice(-Math.min(windowSize, snapshots.length));
  const values = window.map(toNum);

  // ── Slope + acceleration ───────────────────────────────────────────────────
  const recentSlope   = slope(values);
  const firstHalf     = slope(values.slice(0, Math.floor(values.length / 2)));
  const secondHalf    = slope(values.slice(Math.floor(values.length / 2)));
  const acceleration  = Math.max(-1, Math.min(1, (secondHalf - firstHalf) / 3));

  // ── Volatility index ───────────────────────────────────────────────────────
  const sd              = stddev(values);
  const volatilityIndex = Math.min(100, Math.round(sd * 12));  // scale 0–100

  // ── Current risk level ────────────────────────────────────────────────────
  const latest   = values[values.length - 1];
  const earliest = values[0];
  const delta    = latest - earliest;

  // ── Persistence: count how many recent snapshots share current risk label ──
  const latestLabel = window[window.length - 1].risk_score;
  let persistenceCount = 0;
  for (let i = window.length - 1; i >= 0; i--) {
    if (window[i].risk_score === latestLabel) persistenceCount++;
    else break;
  }
  // Approximate hours: assume ~2h per snapshot cadence
  const persistence = persistenceCount * 2;

  // ── Trajectory classification ──────────────────────────────────────────────
  let trajectory: TrajectoryLabel;
  if (volatilityIndex > 45) {
    trajectory = "Volatile";
  } else if (recentSlope > 0.4 && latest >= 5) {
    trajectory = "Escalating";
  } else if (recentSlope > 0.15) {
    trajectory = "Tightening";
  } else if (recentSlope < -0.3 && latest <= 5) {
    trajectory = "Recovering";
  } else if (recentSlope < -0.1) {
    trajectory = "Improving";
  } else {
    trajectory = "Stable";
  }

  // ── Momentum ───────────────────────────────────────────────────────────────
  const absMomentum = Math.abs(recentSlope);
  const momentum: MomentumLabel =
    absMomentum > 0.5  ? "High" :
    absMomentum > 0.15 ? "Moderate" :
                         "Low";

  // ── Projected direction ────────────────────────────────────────────────────
  let projectedDirection: ProjectedDirection;
  if (volatilityIndex > 40) {
    projectedDirection = "uncertain";
  } else if (recentSlope > 0.2 && acceleration >= 0) {
    projectedDirection = "likely_elevating";
  } else if (recentSlope < -0.2 && acceleration <= 0) {
    projectedDirection = "likely_reversing";
  } else if (Math.abs(recentSlope) < 0.15 && volatilityIndex < 20) {
    projectedDirection = "likely_stable";
  } else {
    projectedDirection = "uncertain";
  }

  // ── Confidence ─────────────────────────────────────────────────────────────
  const sampleBonus   = Math.min(20, window.length);
  const stabilityBonus = volatilityIndex < 20 ? 15 : 0;
  const consistencyBonus = Math.abs(delta) > 1 ? 15 : 0;
  const confidenceScore = Math.min(95, 45 + sampleBonus + stabilityBonus + consistencyBonus);

  // ── Human explanation ──────────────────────────────────────────────────────
  const dirMap: Record<ProjectedDirection, string> = {
    likely_stable:    "conditions are expected to hold near current levels",
    likely_elevating: "risk is trending toward higher levels",
    likely_reversing: "conditions show early signs of easing",
    uncertain:        "near-term direction is unclear given current volatility",
  };
  const explanation =
    `Risk has been ${trajectory.toLowerCase()} over the past ${window.length} readings ` +
    `(${persistence}h in current state). ` +
    `Momentum is ${momentum.toLowerCase()} and ${dirMap[projectedDirection]}.` +
    (volatilityIndex > 35 ? ` Market volatility is elevated (index: ${volatilityIndex}).` : "");

  return {
    trajectory,
    momentum,
    acceleration: Math.round(acceleration * 100) / 100,
    persistence,
    projectedDirection,
    recentSlope:    Math.round(recentSlope * 1000) / 1000,
    volatilityIndex,
    confidenceScore,
    explanation,
    dataPoints: window.length,
  };
}

// ── Utility: trajectory color + label ─────────────────────────────────────────

export function trajectoryColor(t: TrajectoryLabel): string {
  const map: Record<TrajectoryLabel, string> = {
    Stable:     "#22c55e",
    Improving:  "#4ade80",
    Tightening: "#f59e0b",
    Escalating: "#ef4444",
    Volatile:   "#f97316",
    Recovering: "#60a5fa",
  };
  return map[t] ?? "#6b7280";
}

export function projectedDirectionLabel(d: ProjectedDirection): string {
  const map: Record<ProjectedDirection, string> = {
    likely_stable:    "Likely Stable",
    likely_elevating: "Likely Elevating",
    likely_reversing: "Likely Easing",
    uncertain:        "Uncertain",
  };
  return map[d];
}
