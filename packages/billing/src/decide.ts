import { RULE_IDS, type EligibilityCheckDTO } from "@ghost/shared";
import type { Decision } from "./types";

const label = (c: EligibilityCheckDTO) => `${c.ruleId} ${c.name}`;

/**
 * R-06 fail → escalated; any other fail → needs_review; otherwise ready_for_approval.
 * Auto-invoicing is disabled, so "ready" still means a human approves. A missing rule is treated as a failure:
 * an incomplete evaluation must never reach the approval queue.
 */
export function decide(checks: EligibilityCheckDTO[]): Decision {
  const present = new Set(checks.map((c) => c.ruleId));
  const missing = RULE_IDS.filter((id) => !present.has(id));
  const fails = checks.filter((c) => c.outcome === "fail");
  const warns = checks.filter((c) => c.outcome === "warn");

  if (fails.some((c) => c.ruleId === "R-06")) {
    return { status: "escalated", reason: `Escalated: failed ${fails.map(label).join(", ")}.` };
  }
  if (fails.length > 0 || missing.length > 0) {
    const parts = [
      ...(fails.length > 0 ? [`failed ${fails.map(label).join(", ")}`] : []),
      ...(missing.length > 0 ? [`not evaluated ${missing.join(", ")}`] : []),
    ];
    return { status: "needs_review", reason: `Needs review: ${parts.join("; ")}.` };
  }
  if (warns.length > 0) {
    return { status: "ready_for_approval", reason: `Ready for human approval; warnings: ${warns.map(label).join(", ")}.` };
  }
  return { status: "ready_for_approval", reason: "Ready for human approval; all eligibility checks passed." };
}
