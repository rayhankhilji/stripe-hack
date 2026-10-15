import { assertCents, formatCents, sumCents, type CalculationDTO } from "@ghost/shared";
import { activatedOrderIds, compareIds, isClosedWon } from "../facts";
import { calcHash } from "../hash";
import type { CustomerFacts, DetectedFinding, DetectedFindingLine, FactDeal } from "../types";

export const WON_NOT_BILLED_VERSION = "won-not-billed@1";
const FORMULA = "Σ closed-won line items without activated order or invoice";

/** Closed Won deals that have no Activated order and are not already on an invoice. */
export function unbilledWonDeals(f: CustomerFacts): FactDeal[] {
  const invoiced = new Set(f.invoicedDealExternalIds);
  return f.deals
    .filter((d) => isClosedWon(d) && !invoiced.has(d.externalId) && activatedOrderIds(f, d.externalId).length === 0)
    .sort((a, b) => compareIds(a.externalId, b.externalId));
}

/**
 * Bill the deal's own line items. A won deal with no line items is billed as one line at the deal amount, keyed by
 * the deal id, so the amount still traces to a source record; R-03 flags it for review because Σ lines ≠ amount.
 */
function billableLines(deal: FactDeal): DetectedFindingLine[] {
  if (deal.lines.length === 0) {
    if (deal.amountCents === null || deal.amountCents <= 0) return [];
    const amount = assertCents(deal.amountCents);
    return [{ dealExternalId: deal.externalId, lineExternalId: deal.externalId, description: deal.name, quantity: 1, unitAmountCents: amount, amountCents: amount }];
  }
  return [...deal.lines]
    .sort((a, b) => compareIds(a.externalId, b.externalId))
    .map((l) => ({
      dealExternalId: deal.externalId,
      lineExternalId: l.externalId,
      description: `${l.productName} — ${deal.name}`,
      quantity: l.quantity,
      unitAmountCents: assertCents(l.unitPriceCents),
      amountCents: assertCents(l.totalCents),
    }));
}

function buildCalculation(f: CustomerFacts, deals: FactDeal[], lines: DetectedFindingLine[], totalCents: number): CalculationDTO {
  const inputs: CalculationDTO["inputs"] = [];
  for (const deal of deals) {
    const amount = deal.amountCents === null ? "unknown" : formatCents(deal.amountCents);
    inputs.push({ label: `Deal "${deal.name}" (Closed Won${deal.closeDate ? `, closed ${deal.closeDate}` : ""})`, value: amount, sourceExternalId: deal.externalId });
    for (const order of f.orders.filter((o) => o.dealExternalId === deal.externalId).sort((a, b) => compareIds(a.externalId, b.externalId))) {
      inputs.push({ label: `Order status for ${deal.externalId}`, value: order.status, sourceExternalId: order.externalId });
    }
  }
  const steps = lines.map((l) => ({ label: `${l.lineExternalId} · ${l.description}`, amountCents: l.amountCents }));
  const hash = calcHash({
    version: WON_NOT_BILLED_VERSION,
    eraAccountId: f.eraAccountId,
    lines: lines.map((l) => ({ deal: l.dealExternalId, line: l.lineExternalId, quantity: l.quantity, unit: l.unitAmountCents, amount: l.amountCents })),
    totalCents,
  });
  return { version: WON_NOT_BILLED_VERSION, formula: FORMULA, inputs, steps, totalCents, calcHash: hash };
}

export function detectWonNotBilled(f: CustomerFacts): DetectedFinding | null {
  const deals = unbilledWonDeals(f).filter((d) => billableLines(d).length > 0);
  if (deals.length === 0) return null;
  const lines = deals.flatMap(billableLines);
  const amountCents = sumCents(lines.map((l) => l.amountCents));
  if (amountCents <= 0) return null;
  const noun = deals.length === 1 ? "deal" : "deals";
  return {
    kind: "won_not_billed",
    title: `${f.name}: ${deals.length} closed-won ${noun} never billed`,
    amountCents,
    calculation: buildCalculation(f, deals, lines, amountCents),
    lines,
  };
}
