import type { AuditEventDTO, EligibilityCheckDTO, EvidenceDTO, FindingDetailDTO } from "@ghost/shared";

export type EvidenceRole = EvidenceDTO["role"];

/** Display order for evidence groups: why it is owed first, then what proves it was never billed. */
export const EVIDENCE_ROLE_ORDER: readonly EvidenceRole[] = [
  "commitment",
  "contract_term",
  "billing_state",
  "usage_signal",
  "dispute_signal",
  "context",
];

export const EVIDENCE_ROLE_LABEL: Record<EvidenceRole, string> = {
  commitment: "Commitment",
  contract_term: "Contract terms",
  billing_state: "Billing state",
  usage_signal: "Service delivery",
  dispute_signal: "Dispute signals",
  context: "Context",
};

export function groupEvidence(evidence: readonly EvidenceDTO[]): { role: EvidenceRole; items: EvidenceDTO[] }[] {
  return EVIDENCE_ROLE_ORDER.map((role) => ({ role, items: evidence.filter((e) => e.role === role) })).filter(
    (g) => g.items.length > 0,
  );
}

/** DOM id of an evidence row, so citation chips can scroll to it. */
export function evidenceAnchor(evidenceId: string): string {
  return `evidence-${evidenceId}`;
}

/**
 * Explanation citations are written `[E1]..[En]` and map to `citedEvidenceIds` by position (contract).
 * Returns the evidence for a 1-based citation number, or null when the explainer cited something unknown.
 */
export function resolveCitation(
  n: number,
  citedEvidenceIds: readonly string[],
  evidence: readonly EvidenceDTO[],
): EvidenceDTO | null {
  const id = citedEvidenceIds[n - 1];
  if (id === undefined) return null;
  return evidence.find((e) => e.id === id) ?? null;
}

export type AgentStepView = { id: string; title: string; state: "done" | "error"; at: string; actor: string };

/** The analyze workflow audits each step as `agent.step.<id>`; these are the live steps for the action panel. */
export function agentSteps(timeline: readonly AuditEventDTO[]): AgentStepView[] {
  return [...timeline]
    .filter((e) => e.action.startsWith("agent.step."))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((e) => ({ id: e.id, title: e.summary, state: e.kind === "error" ? "error" : "done", at: e.occurredAt, actor: e.actor }));
}

/** Rules a human should look at before approving (warn) or that block the case (fail). */
export function flaggedChecks(checks: readonly EligibilityCheckDTO[]): EligibilityCheckDTO[] {
  return checks.filter((c) => c.outcome !== "pass");
}

export type Verification = { via: "webhook" | "stripe_api"; eventId: string | null; at: string; summary: string };

/**
 * Finds the audit entry that proved payment. Only a verified webhook or a Stripe API fetch can set
 * `paid`, and both write an `outcome_verified` event; the Stripe event id is its externalRef when it
 * came from a webhook. Nothing here is inferred from the UI side.
 */
export function paymentVerification(timeline: readonly AuditEventDTO[]): Verification | null {
  const verified = [...timeline]
    .filter((e) => e.kind === "outcome_verified")
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  if (!verified) return null;
  const via = verified.action.startsWith("webhook.") || verified.actorType === "stripe" ? "webhook" : "stripe_api";
  const eventId = verified.externalRef?.startsWith("evt_") ? verified.externalRef : stringField(verified.data, "eventId");
  return { via, eventId, at: verified.occurredAt, summary: verified.summary };
}

/** Latest error the workflow recorded for this case, shown when the case is `failed`. */
export function latestError(timeline: readonly AuditEventDTO[]): AuditEventDTO | null {
  return [...timeline].filter((e) => e.kind === "error").sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0] ?? null;
}

function stringField(data: Record<string, unknown>, key: string): string | null {
  const v = data[key];
  return typeof v === "string" && v.startsWith("evt_") ? v : null;
}

/** The verdict sentence under the header: the agent's summary when it exists, else the deterministic decision. */
export function verdict(f: Pick<FindingDetailDTO, "explanation" | "decisionReason">): string | null {
  return f.explanation?.summary ?? f.decisionReason;
}

export function shortHash(hash: string): string {
  return hash.slice(0, 12);
}
