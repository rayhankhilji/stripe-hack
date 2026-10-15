// Small deterministic helpers over CustomerFacts, shared by the detector and the eligibility rules.
import type { CustomerFacts, FactDeal } from "./types";

/** Code-unit order, never locale order, so results do not depend on the host's ICU data. */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sameStatus(status: string, expected: string): boolean {
  return status.trim().toLowerCase() === expected.toLowerCase();
}

export function isClosedWon(deal: FactDeal): boolean {
  return deal.isWon && deal.isClosed;
}

export function activatedOrderIds(f: CustomerFacts, dealExternalId: string): string[] {
  return f.orders
    .filter((o) => o.dealExternalId === dealExternalId && sameStatus(o.status, "Activated"))
    .map((o) => o.externalId)
    .sort(compareIds);
}
