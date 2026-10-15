import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@ghost/db";
import type { CustomerFacts } from "@ghost/billing";
import { AppError, type EraSystem, type EvidenceRole, type SourceRef } from "@ghost/shared";

type SourceRow = typeof schema.sourceRecord.$inferSelect;

/** Invoice states that mean a deal is already on a Ghost/Stripe invoice. */
const INVOICED_STATES = ["draft", "open", "paid"] as const;

/** FAST_PLAN §5 role mapping. Returns null for records that are not evidence (accounts, products, order items…). */
export function roleOfSource(system: EraSystem, recordType: string, title: string): EvidenceRole | null {
  if (system === "salesforce") {
    if (recordType === "Opportunity" || recordType === "OpportunityLineItem") return "commitment";
    if (recordType === "Contract") return "contract_term";
    if (recordType === "Order") return "billing_state";
    return null;
  }
  if (system === "aws") return recordType === "fact_payments" ? "usage_signal" : null;
  if (system === "zendesk") return recordType === "ticket" ? "usage_signal" : null;
  if (system === "gong") return recordType === "call" ? "usage_signal" : null;
  if (system === "google-drive") {
    if (recordType !== "file") return null;
    return /dispute/i.test(title) ? "dispute_signal" : "context";
  }
  if (system === "slack") return recordType === "message" ? "context" : null;
  return null;
}

export function toSourceRef(row: Pick<SourceRow, "system" | "recordType" | "externalId" | "title" | "url" | "occurredAt" | "isFixture">): SourceRef {
  return {
    system: row.system,
    recordType: row.recordType,
    externalId: row.externalId,
    title: row.title,
    url: row.url,
    occurredAt: row.occurredAt ? row.occurredAt.toISOString() : null,
    isFixture: row.isFixture,
  };
}

/** Builds the pure-billing input from the database. Everything here is read from ingested source records, never inferred. */
export async function loadCustomerFacts(customerId: string): Promise<CustomerFacts> {
  const db = getDb();
  const [cust] = await db.select().from(schema.customer).where(eq(schema.customer.id, customerId)).limit(1);
  if (!cust) throw new AppError("NOT_FOUND", `Customer ${customerId} not found`);

  const [deals, contracts, orders, identities, sources] = await Promise.all([
    db.select().from(schema.deal).where(eq(schema.deal.customerId, customerId)).orderBy(asc(schema.deal.externalId)),
    db.select().from(schema.contract).where(eq(schema.contract.customerId, customerId)).orderBy(asc(schema.contract.externalId)),
    db.select().from(schema.salesOrder).where(eq(schema.salesOrder.customerId, customerId)).orderBy(asc(schema.salesOrder.externalId)),
    db.select().from(schema.customerIdentity).where(eq(schema.customerIdentity.customerId, customerId)),
    db
      .select({ system: schema.sourceRecord.system, recordType: schema.sourceRecord.recordType, title: schema.sourceRecord.title })
      .from(schema.sourceRecord)
      .where(eq(schema.sourceRecord.customerId, customerId)),
  ]);

  const dealIds = deals.map((d) => d.id);
  const lines = dealIds.length
    ? await db.select().from(schema.dealLineItem).where(inArray(schema.dealLineItem.dealId, dealIds)).orderBy(asc(schema.dealLineItem.externalId))
    : [];

  // A deal counts as invoiced when any finding line for it sits on a draft/open/paid invoice.
  const invoicedRows = await db
    .select({ externalId: schema.deal.externalId })
    .from(schema.invoice)
    .innerJoin(schema.findingLine, eq(schema.findingLine.findingId, schema.invoice.findingId))
    .innerJoin(schema.deal, eq(schema.deal.id, schema.findingLine.dealId))
    .where(and(eq(schema.invoice.customerId, customerId), inArray(schema.invoice.status, [...INVOICED_STATES])));

  const dealExternalById = new Map(deals.map((d) => [d.id, d.externalId]));
  const signals = { usage: 0, dispute: 0 };
  for (const s of sources) {
    const role = roleOfSource(s.system, s.recordType, s.title);
    if (role === "usage_signal") signals.usage += 1;
    if (role === "dispute_signal") signals.dispute += 1;
  }

  // The customer itself is resolved from its Salesforce account, so that system always counts.
  const identitySystems = [...new Set<EraSystem>(["salesforce", ...identities.map((i) => i.system)])];

  return {
    customerId: cust.id,
    eraAccountId: cust.eraAccountId,
    name: cust.name,
    status: cust.status,
    deals: deals.map((d) => ({
      externalId: d.externalId,
      name: d.name,
      isWon: d.isWon,
      isClosed: d.isClosed,
      amountCents: d.amountCents,
      closeDate: d.closeDate,
      lines: lines
        .filter((l) => l.dealId === d.id)
        .map((l) => ({ externalId: l.externalId, productName: l.productName, quantity: l.quantity, unitPriceCents: l.unitPriceCents, totalCents: l.totalCents })),
    })),
    orders: orders.map((o) => ({ externalId: o.externalId, dealExternalId: o.dealId ? (dealExternalById.get(o.dealId) ?? null) : null, status: o.status })),
    contracts: contracts.map((c) => ({ externalId: c.externalId, status: c.status, description: c.description, specialTerms: c.specialTerms })),
    invoicedDealExternalIds: [...new Set(invoicedRows.map((r) => r.externalId))],
    identitySystems,
    signals,
  };
}
