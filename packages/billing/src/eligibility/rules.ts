import { formatCents, sumCents, type EligibilityCheckDTO, type RuleId } from "@ghost/shared";
import { activatedOrderIds, compareIds, isClosedWon, sameStatus } from "../facts";
import type { CustomerFacts, DetectedFinding, FactDeal, InvoicePolicy, RuleOutcome } from "../types";

export const RULE_NAMES: Record<RuleId, string> = {
  "R-01": "Customer identity corroborated",
  "R-02": "Revenue is contractually committed",
  "R-03": "Line items reconcile to deal amount",
  "R-04": "No activated order exists",
  "R-05": "Not already invoiced",
  "R-06": "No dispute on record",
  "R-07": "Customer is active",
  "R-08": "Service delivery evidenced",
  "R-09": "Within invoice policy cap",
  "R-10": "Contract activated",
};

type Ctx = { f: CustomerFacts; d: DetectedFinding; policy: InvoicePolicy; dealIds: string[]; deals: Map<string, FactDeal> };
type Result = { outcome: RuleOutcome; detail: string };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function r01({ f }: Ctx): Result {
  const systems = [...new Set(f.identitySystems)].sort(compareIds);
  if (systems.length >= 2) return { outcome: "pass", detail: `Resolved in ${plural(systems.length, "system")}: ${systems.join(", ")}.` };
  return { outcome: "warn", detail: systems.length === 1 ? `Resolved only in ${systems[0]}.` : "Not resolved in any system." };
}

function r02({ dealIds, deals }: Ctx): Result {
  const bad = dealIds.filter((id) => {
    const deal = deals.get(id);
    return !deal || !isClosedWon(deal);
  });
  if (bad.length === 0) return { outcome: "pass", detail: `All lines come from Closed Won deals: ${dealIds.join(", ")}.` };
  return { outcome: "fail", detail: `Not Closed Won (or missing): ${bad.join(", ")}.` };
}

function r03({ dealIds, deals }: Ctx): Result {
  const mismatches: string[] = [];
  const matches: string[] = [];
  for (const id of dealIds) {
    const deal = deals.get(id);
    if (!deal) {
      mismatches.push(`${id} missing from customer facts`);
      continue;
    }
    const lineTotal = sumCents(deal.lines.map((l) => l.totalCents));
    if (deal.amountCents === null) mismatches.push(`${id} has no deal amount (lines ${formatCents(lineTotal)})`);
    else if (lineTotal !== deal.amountCents) mismatches.push(`${id} lines ${formatCents(lineTotal)} ≠ deal ${formatCents(deal.amountCents)}`);
    else matches.push(`${id} ${formatCents(lineTotal)}`);
  }
  if (mismatches.length === 0) return { outcome: "pass", detail: `Σ lines equals deal amount: ${matches.join("; ")}.` };
  return { outcome: "fail", detail: `Mismatch: ${mismatches.join("; ")}.` };
}

function r04(ctx: Ctx): Result {
  const activated = ctx.dealIds.flatMap((id) => activatedOrderIds(ctx.f, id).map((o) => `${o} (${id})`));
  if (activated.length === 0) return { outcome: "pass", detail: `No Activated order for ${ctx.dealIds.join(", ")}.` };
  return { outcome: "fail", detail: `Activated order exists: ${activated.join(", ")}.` };
}

function r05({ f, dealIds }: Ctx): Result {
  const invoiced = new Set(f.invoicedDealExternalIds);
  const hit = dealIds.filter((id) => invoiced.has(id));
  if (hit.length === 0) return { outcome: "pass", detail: "No deal is on an existing invoice." };
  return { outcome: "fail", detail: `Already invoiced: ${hit.join(", ")}.` };
}

function r06({ f }: Ctx): Result {
  if (f.signals.dispute === 0) return { outcome: "pass", detail: "No dispute records found." };
  return { outcome: "fail", detail: `${plural(f.signals.dispute, "dispute record")} on file; escalate before billing.` };
}

function r07({ f }: Ctx): Result {
  if (f.status === "active") return { outcome: "pass", detail: "Customer status is active." };
  return { outcome: "fail", detail: `Customer status is ${f.status}.` };
}

function r08({ f }: Ctx): Result {
  if (f.signals.usage >= 1) return { outcome: "pass", detail: `${plural(f.signals.usage, "usage signal")} (payments, tickets, calls).` };
  return { outcome: "warn", detail: "No usage signals found; service delivery not evidenced." };
}

function r09({ d, policy }: Ctx): Result {
  const detail = `${formatCents(d.amountCents)} vs cap ${formatCents(policy.amountCapCents)}.`;
  return d.amountCents <= policy.amountCapCents ? { outcome: "pass", detail } : { outcome: "fail", detail: `Above cap: ${detail}` };
}

function r10({ f }: Ctx): Result {
  const contracts = [...f.contracts].sort((a, b) => compareIds(a.externalId, b.externalId));
  const listed = contracts.map((c) => `${c.externalId} ${c.status}`).join(", ");
  const activated = contracts.filter((c) => sameStatus(c.status, "Activated"));
  if (activated.length > 0) return { outcome: "pass", detail: `Activated contract: ${activated.map((c) => c.externalId).join(", ")}.` };
  if (contracts.length > 0 && contracts.every((c) => sameStatus(c.status, "Expired"))) {
    return { outcome: "fail", detail: `Only expired contracts: ${listed}.` };
  }
  const state = contracts.length === 0 ? "No contract on file" : `No activated contract (${listed})`;
  return { outcome: "warn", detail: `${state}; human approval required.` };
}

const RULES: [RuleId, (ctx: Ctx) => Result][] = [
  ["R-01", r01], ["R-02", r02], ["R-03", r03], ["R-04", r04], ["R-05", r05],
  ["R-06", r06], ["R-07", r07], ["R-08", r08], ["R-09", r09], ["R-10", r10],
];

/** Evaluates R-01..R-10 (FAST_PLAN §4) for a detected finding. Always returns all ten checks, in rule order. */
export function evaluateEligibility(f: CustomerFacts, d: DetectedFinding, policy: InvoicePolicy): EligibilityCheckDTO[] {
  const dealIds = [...new Set(d.lines.map((l) => l.dealExternalId))].sort(compareIds);
  const ctx: Ctx = { f, d, policy, dealIds, deals: new Map(f.deals.map((deal) => [deal.externalId, deal])) };
  return RULES.map(([ruleId, rule]) => ({ ruleId, name: RULE_NAMES[ruleId], ...rule(ctx) }));
}
