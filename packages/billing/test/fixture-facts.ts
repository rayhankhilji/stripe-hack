// Builds CustomerFacts for one account straight from the recorded Era fixtures, so the money tests use real values.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dollarsToCents, type EraSystem } from "@ghost/shared";
import type { CustomerFacts } from "../src";

const ERA = fileURLToPath(new URL("../../../fixtures/era/", import.meta.url));

type Row = Record<string, unknown>;

function load(path: string): unknown {
  return JSON.parse(readFileSync(`${ERA}${path}`, "utf8"));
}
const rows = (path: string) => load(path) as Row[];
const str = (v: unknown) => (typeof v === "string" ? v : null);
const cents = (v: unknown) => (typeof v === "number" || typeof v === "string" ? dollarsToCents(v) : null);

function identitySystems(acct: string): EraSystem[] {
  const systems: EraSystem[] = ["salesforce"];
  const mentions = (path: string) => existsSync(`${ERA}${path}`) && readFileSync(`${ERA}${path}`, "utf8").includes(`"${acct}"`);
  if (mentions("zendesk/organizations.json")) systems.push("zendesk");
  if (mentions("slack/channels.json")) systems.push("slack");
  if (existsSync(`${ERA}gong/calls/${acct}.json`)) systems.push("gong");
  if (mentions("aws/dim_customer.json")) systems.push("aws");
  if (existsSync(`${ERA}google-drive/search/${acct}.json`)) systems.push("google-drive");
  return systems;
}

function usageSignals(acct: string): number {
  const payments = (load("aws/fact_payments.json") as { rows: Row[] }).rows.filter((r) => r.customer_id === acct).length;
  const gongPath = `gong/calls/${acct}.json`;
  const calls = existsSync(`${ERA}${gongPath}`) ? (load(gongPath) as { calls: unknown[] }).calls.length : 0;
  const ticketPath = `zendesk/tickets/${acct}.json`;
  const tickets = existsSync(`${ERA}${ticketPath}`) ? JSON.stringify(load(ticketPath)).split('"subject"').length - 1 : 0;
  return payments + calls + tickets;
}

function disputeSignals(acct: string): number {
  const path = `google-drive/search/${acct}.json`;
  if (!existsSync(`${ERA}${path}`)) return 0;
  return (load(path) as { files: { name: string }[] }).files.filter((file) => file.name.includes("Dispute")).length;
}

export function factsFromFixtures(acct: string): CustomerFacts {
  const account = rows("salesforce/accounts.json").find((a) => a.Id === acct);
  if (!account) throw new Error(`account ${acct} not in fixtures`);
  const products = new Map(rows("salesforce/products.json").map((p) => [p.Id, str(p.Name) ?? String(p.Id)]));
  const lineItems = rows("salesforce/opportunity_line_items.json");
  const deals = rows("salesforce/opportunities.json")
    .filter((o) => o.AccountId === acct)
    .map((o) => ({
      externalId: String(o.Id),
      name: String(o.Name),
      isWon: o.IsWon === true,
      isClosed: o.IsClosed === true,
      amountCents: cents(o.Amount),
      closeDate: str(o.CloseDate),
      lines: lineItems
        .filter((l) => l.OpportunityId === o.Id)
        .map((l) => ({
          externalId: String(l.Id),
          productName: products.get(l.Product2Id) ?? String(l.Product2Id),
          quantity: Number(l.Quantity),
          unitPriceCents: dollarsToCents(String(l.UnitPrice)),
          totalCents: dollarsToCents(String(l.TotalPrice)),
        })),
    }));
  return {
    customerId: "00000000-0000-4000-8000-000000000006",
    eraAccountId: acct,
    name: String(account.Name),
    status: "active",
    deals,
    orders: rows("salesforce/orders.json")
      .filter((o) => o.AccountId === acct)
      .map((o) => ({ externalId: String(o.Id), dealExternalId: str(o.OpportunityId), status: String(o.Status) })),
    contracts: rows("salesforce/contracts.json")
      .filter((c) => c.AccountId === acct)
      .map((c) => ({ externalId: String(c.Id), status: String(c.Status), description: str(c.Description), specialTerms: str(c.SpecialTerms) })),
    invoicedDealExternalIds: [],
    identitySystems: identitySystems(acct),
    signals: { usage: usageSignals(acct), dispute: disputeSignals(acct) },
  };
}
