import type { AuditEventDTO } from "@ghost/shared";

export type AuditKindValue = AuditEventDTO["kind"];

export const KIND_META: Record<AuditKindValue, { label: string; pillClass: string }> = {
  info: { label: "Info", pillClass: "bg-porcelain text-ink/70 border border-line" },
  recommendation: { label: "Recommendation", pillClass: "bg-petal text-forest" },
  approval_pending: { label: "Pending approval", pillClass: "bg-lemon text-forest" },
  approval_decision: { label: "Decision", pillClass: "bg-navy text-white" },
  action_executed: { label: "Executed", pillClass: "bg-signal text-forest" },
  outcome_verified: { label: "Verified", pillClass: "bg-lime text-forest" },
  error: { label: "Error", pillClass: "bg-punch text-white" },
};

export const KIND_ORDER = Object.keys(KIND_META) as AuditKindValue[];

export function filterByKinds(items: AuditEventDTO[], kinds: ReadonlySet<AuditKindValue>): AuditEventDTO[] {
  return kinds.size === 0 ? items : items.filter((e) => kinds.has(e.kind));
}

export function countByKind(items: AuditEventDTO[]): Record<AuditKindValue, number> {
  const counts = Object.fromEntries(KIND_ORDER.map((k) => [k, 0])) as Record<AuditKindValue, number>;
  for (const e of items) counts[e.kind] += 1;
  return counts;
}
