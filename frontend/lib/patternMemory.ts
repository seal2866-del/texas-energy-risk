/**
 * patternMemory.ts
 * Phase 9 — Predictive Intelligence Engine
 * Fingerprints current conditions and matches them against historical patterns.
 * Pure computation — no API calls.
 */
import type { SignalSnapshot } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConditionFingerprint {
  riskNumeric:    number;
  riskState:      string;
  ercotPrice:     number | null;
  demandLevel:    string | null;
  supplyLevel:    string | null;
  primaryDriver:  string | null;
  escalationPct:  number | null;
}

export interface PatternMatch {
  similarity:      number;       // 0–100
  matchedAt:       string;       // ISO timestamp of historical match
  outcome:         string;       // what happened next (risk label)
  outcomeNumeric:  number;       // numeric risk after n steps
  hoursLater:      number;       // how many hours after the match the outcome was observed
  fingerprint:     ConditionFingerprint;
}

export interface PatternMemoryResult {
  currentFingerprint:  ConditionFingerprint;
  matches:             PatternMatch[];   // top 5 closest matches
  avgOutcomeNumeric:   number | null;    // weighted average future risk
  predictedDirection:  "likely_higher" | "likely_lower" | "likely_same" | "insufficient_data";
  patternConfidence:   number;           // 0–100
  explanation:         string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fingerprint(snap: SignalSnapshot): ConditionFingerprint {
  return {
    riskNumeric:   snap.risk_score_numeric ?? riskToNum(snap.risk_score),
    riskState:     snap.risk_score ?? "unknown",
    ercotPrice:    snap.ercot_price ?? null,
    demandLevel:   snap.demand_level ?? null,
    supplyLevel:   snap.supply_level ?? null,
    primaryDriver: snap.primary_driver ?? null,
    escalationPct: snap.escalation_pct ?? null,
  };
}

function riskToNum(r?: string): number {
  if (r === "high")   return 8.5;
  if (r === "medium") return 5.0;
  return 2.0;
}

/**
 * Compute a similarity score (0–100) between two fingerprints.
 * Weighted: risk numeric (40%), ERCOT price (25%), demand/supply (20%), driver (15%)
 */
function computeSimilarity(a: ConditionFingerprint, b: ConditionFingerprint): number {
  let score = 0;
  let weight = 0;

  // Risk numeric — max diff ~8.5, normalise
  const numDiff = Math.abs(a.riskNumeric - b.riskNumeric);
  score  += (1 - Math.min(numDiff / 8.5, 1)) * 40;
  weight += 40;

  // ERCOT price — only when both available
  if (a.ercotPrice !== null && b.ercotPrice !== null) {
    const maxP   = Math.max(a.ercotPrice, b.ercotPrice, 1);
    const pDiff  = Math.abs(a.ercotPrice - b.ercotPrice) / maxP;
    score  += (1 - Math.min(pDiff, 1)) * 25;
    weight += 25;
  }

  // Demand + supply levels — string equality
  if (a.demandLevel && b.demandLevel) {
    score  += (a.demandLevel === b.demandLevel ? 1 : 0) * 10;
    weight += 10;
  }
  if (a.supplyLevel && b.supplyLevel) {
    score  += (a.supplyLevel === b.supplyLevel ? 1 : 0) * 10;
    weight += 10;
  }

  // Primary driver
  if (a.primaryDriver && b.primaryDriver) {
    score  += (a.primaryDriver === b.primaryDriver ? 1 : 0) * 15;
    weight += 15;
  }

  // Normalise to 0–100 based on available weight
  return weight > 0 ? Math.round((score / weight) * 100) : 0;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Match current conditions (last snapshot) against the rest of the history.
 * `lookaheadSteps`: how many snapshots forward to read the outcome.
 * Returns null if fewer than 10 snapshots.
 */
export function matchPatterns(
  snapshots: SignalSnapshot[],
  lookaheadSteps = 6,
  topN           = 5,
): PatternMemoryResult | null {
  if (!snapshots || snapshots.length < 10) return null;

  const current    = snapshots[snapshots.length - 1];
  const currentFp  = fingerprint(current);

  // Search historical snapshots (exclude the last `lookaheadSteps + 1` to have valid outcomes)
  const searchable = snapshots.slice(0, snapshots.length - 1);
  const candidates: PatternMatch[] = [];

  for (let i = 0; i < searchable.length - lookaheadSteps; i++) {
    const snap      = searchable[i];
    const outSnap   = snapshots[Math.min(i + lookaheadSteps, snapshots.length - 1)];
    const fp        = fingerprint(snap);
    const sim       = computeSimilarity(currentFp, fp);
    const hrs       = Math.abs(
      (new Date(outSnap.computed_at).getTime() - new Date(snap.computed_at).getTime()) / 3_600_000
    );

    candidates.push({
      similarity:      sim,
      matchedAt:       snap.computed_at,
      outcome:         outSnap.risk_score ?? "unknown",
      outcomeNumeric:  outSnap.risk_score_numeric ?? riskToNum(outSnap.risk_score),
      hoursLater:      Math.round(hrs * 10) / 10,
      fingerprint:     fp,
    });
  }

  // Sort by similarity descending, take top N
  candidates.sort((a, b) => b.similarity - a.similarity);
  const matches = candidates.slice(0, topN);

  if (matches.length === 0) {
    return {
      currentFingerprint: currentFp,
      matches:            [],
      avgOutcomeNumeric:  null,
      predictedDirection: "insufficient_data",
      patternConfidence:  0,
      explanation:        "No historical patterns available for comparison.",
    };
  }

  // Weighted average of outcome numerics (weight = similarity)
  const totalWeight = matches.reduce((s, m) => s + m.similarity, 0);
  const avgOutcome  = totalWeight > 0
    ? matches.reduce((s, m) => s + m.outcomeNumeric * m.similarity, 0) / totalWeight
    : null;

  // Predicted direction
  let predictedDirection: PatternMemoryResult["predictedDirection"] = "insufficient_data";
  if (avgOutcome !== null) {
    const diff = avgOutcome - currentFp.riskNumeric;
    if (diff > 0.75)       predictedDirection = "likely_higher";
    else if (diff < -0.75) predictedDirection = "likely_lower";
    else                   predictedDirection = "likely_same";
  }

  // Pattern confidence — based on top match similarity
  const topSim          = matches[0]?.similarity ?? 0;
  const consistencyBonus = matches.every(m => m.outcome === matches[0].outcome) ? 15 : 0;
  const patternConfidence = Math.min(95, Math.round(topSim * 0.7 + consistencyBonus + (matches.length / topN) * 10));

  // Explanation
  const topMatch  = matches[0];
  const dirLabel  = predictedDirection === "likely_higher" ? "higher"
                  : predictedDirection === "likely_lower"  ? "lower"
                  : predictedDirection === "likely_same"   ? "similar"
                  : "unclear";
  const explanation =
    `Best historical match: ${topMatch.similarity}% similar (from ${topMatch.matchedAt.slice(0,10)}). ` +
    `After comparable conditions, risk was typically ${dirLabel} ` +
    `(avg outcome: ${avgOutcome !== null ? avgOutcome.toFixed(1) : "n/a"}/10). ` +
    `Pattern confidence: ${patternConfidence}%.`;

  return {
    currentFingerprint: currentFp,
    matches,
    avgOutcomeNumeric:  avgOutcome !== null ? Math.round(avgOutcome * 100) / 100 : null,
    predictedDirection,
    patternConfidence,
    explanation,
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function similarityColor(sim: number): string {
  if (sim >= 75) return "#22c55e";
  if (sim >= 50) return "#f59e0b";
  return "#6b7280";
}

export function predictedDirectionLabel(d: PatternMemoryResult["predictedDirection"]): string {
  const map = {
    likely_higher:      "Likely Higher",
    likely_lower:       "Likely Lower",
    likely_same:        "Likely Stable",
    insufficient_data:  "Insufficient Data",
  };
  return map[d];
}
