import type { EligibilityCheckDTO } from "@ghost/shared";
import type { EvidenceRole } from "./types";

// Points for each distinct supporting role present (max 85). dispute_signal supports nothing; it is a penalty.
const ROLE_POINTS: Record<EvidenceRole, number> = {
  commitment: 30,
  contract_term: 20,
  billing_state: 15,
  usage_signal: 15,
  context: 5,
  dispute_signal: 0,
};
const CHECK_POINTS = 15; // scaled by pass (full) / warn (half) share of checks
const FAIL_PENALTY = 10;
const DISPUTE_PENALTY = 20;

/** Deterministic 0–100 integer: how well the evidence and rule outcomes support billing this finding. */
export function evidenceScore(roles: EvidenceRole[], checks: EligibilityCheckDTO[]): number {
  const distinct = new Set(roles);
  let score = 0;
  for (const role of distinct) score += ROLE_POINTS[role];

  if (checks.length > 0) {
    const halfPoints = checks.reduce((n, c) => n + (c.outcome === "pass" ? 2 : c.outcome === "warn" ? 1 : 0), 0);
    score += Math.floor((halfPoints * CHECK_POINTS) / (2 * checks.length));
  }
  score -= FAIL_PENALTY * checks.filter((c) => c.outcome === "fail").length;
  if (distinct.has("dispute_signal")) score -= DISPUTE_PENALTY;

  return Math.min(100, Math.max(0, score));
}
