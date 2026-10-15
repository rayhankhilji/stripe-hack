import type { FindingStatus, FindingSummaryDTO } from "@ghost/shared";

/** Queue filter tabs. Each groups the finding statuses an operator handles the same way. */
export const QUEUE_GROUPS = [
  { key: "all", label: "All", statuses: null },
  { key: "ready", label: "Ready", statuses: ["ready_for_approval"] },
  { key: "review", label: "Needs review", statuses: ["detected", "analyzing", "needs_review", "failed"] },
  { key: "escalated", label: "Escalated", statuses: ["escalated"] },
  { key: "invoiced", label: "Invoiced", statuses: ["approved", "invoiced"] },
  { key: "recovered", label: "Recovered", statuses: ["recovered"] },
] as const satisfies readonly { key: string; label: string; statuses: readonly FindingStatus[] | null }[];

export type QueueGroupKey = (typeof QUEUE_GROUPS)[number]["key"];

export function isQueueGroupKey(v: string | null): v is QueueGroupKey {
  return QUEUE_GROUPS.some((g) => g.key === v);
}

export function inGroup(status: FindingStatus, key: QueueGroupKey): boolean {
  const group = QUEUE_GROUPS.find((g) => g.key === key);
  if (!group || group.statuses === null) return true;
  return (group.statuses as readonly FindingStatus[]).includes(status);
}

/**
 * Priority = amount × evidence score. Both are integers from the server, and the product stays a
 * safe integer for any realistic amount, so the ordering is exact. Ties fall back to the larger
 * amount, then the most recently updated, so the order never depends on API order.
 */
export function rankFindings(items: readonly FindingSummaryDTO[]): FindingSummaryDTO[] {
  return [...items].sort(
    (a, b) =>
      b.amountCents * b.evidenceScore - a.amountCents * a.evidenceScore ||
      b.amountCents - a.amountCents ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function countByGroup(items: readonly FindingSummaryDTO[]): Record<QueueGroupKey, number> {
  const counts = Object.fromEntries(QUEUE_GROUPS.map((g) => [g.key, 0])) as Record<QueueGroupKey, number>;
  for (const item of items) {
    for (const g of QUEUE_GROUPS) if (inGroup(item.status, g.key)) counts[g.key] += 1;
  }
  return counts;
}
