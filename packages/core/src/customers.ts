import { and, asc, desc, eq, ilike, inArray, notInArray } from "drizzle-orm";
import { getDb, schema } from "@ghost/db";
import { AppError, EraSystem, type CustomerDetailDTO, type CustomerSummaryDTO } from "@ghost/shared";
import { toSourceRef } from "./facts";
import { summarizeFindings, toInvoiceDTOFromRow } from "./findings";
import { OPEN_FINDING_EXCLUDED } from "./overview";

type CustomerRow = typeof schema.customer.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECENT_SOURCES = 20;

async function summaries(rows: CustomerRow[]): Promise<CustomerSummaryDTO[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const db = getDb();
  const [identities, findings] = await Promise.all([
    db.select({ customerId: schema.customerIdentity.customerId, system: schema.customerIdentity.system }).from(schema.customerIdentity).where(inArray(schema.customerIdentity.customerId, ids)),
    db
      .select({ customerId: schema.finding.customerId, amountCents: schema.finding.amountCents })
      .from(schema.finding)
      .where(and(inArray(schema.finding.customerId, ids), notInArray(schema.finding.status, OPEN_FINDING_EXCLUDED))),
  ]);
  return rows.map((c) => {
    // Customers originate from a Salesforce Account, so that system is always resolved.
    const systems = new Set<EraSystem>(["salesforce", ...identities.filter((i) => i.customerId === c.id).map((i) => i.system)]);
    return {
      id: c.id,
      eraAccountId: c.eraAccountId,
      name: c.name,
      domain: c.domain,
      status: c.status,
      tier: c.tier,
      arrCents: c.arrCents,
      openFindingsCents: findings.filter((f) => f.customerId === c.id).reduce((sum, f) => sum + f.amountCents, 0),
      systems: EraSystem.options.filter((s) => systems.has(s)),
    };
  });
}

export async function listCustomers(q?: string): Promise<CustomerSummaryDTO[]> {
  const term = q?.trim();
  const escaped = term?.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await getDb()
    .select()
    .from(schema.customer)
    .where(escaped ? ilike(schema.customer.name, `%${escaped}%`) : undefined)
    .orderBy(asc(schema.customer.name));
  return summaries(rows);
}

export async function getCustomer(id: string): Promise<CustomerDetailDTO> {
  const db = getDb();
  const [c] = await db
    .select()
    .from(schema.customer)
    .where(UUID.test(id) ? eq(schema.customer.id, id) : eq(schema.customer.eraAccountId, id))
    .limit(1);
  if (!c) throw new AppError("NOT_FOUND", `Customer ${id} not found`);

  const [summary] = await summaries([c]);
  if (!summary) throw new AppError("INTERNAL", "Customer summary missing");
  const [identities, deals, contracts, orders, invoices, findingRows, sources, dealRefs] = await Promise.all([
    db.select().from(schema.customerIdentity).where(eq(schema.customerIdentity.customerId, c.id)).orderBy(asc(schema.customerIdentity.system)),
    db.select().from(schema.deal).where(eq(schema.deal.customerId, c.id)).orderBy(desc(schema.deal.closeDate), asc(schema.deal.externalId)),
    db.select().from(schema.contract).where(eq(schema.contract.customerId, c.id)).orderBy(asc(schema.contract.externalId)),
    db.select().from(schema.salesOrder).where(eq(schema.salesOrder.customerId, c.id)).orderBy(asc(schema.salesOrder.externalId)),
    db.select().from(schema.invoice).where(eq(schema.invoice.customerId, c.id)).orderBy(desc(schema.invoice.createdAt)),
    db.select().from(schema.finding).where(eq(schema.finding.customerId, c.id)).orderBy(desc(schema.finding.amountCents)),
    db.select().from(schema.sourceRecord).where(eq(schema.sourceRecord.customerId, c.id)).orderBy(desc(schema.sourceRecord.occurredAt), asc(schema.sourceRecord.externalId)).limit(RECENT_SOURCES),
    db.select({ id: schema.deal.id, externalId: schema.deal.externalId }).from(schema.deal).where(eq(schema.deal.customerId, c.id)),
  ]);
  const dealExternal = new Map(dealRefs.map((d) => [d.id, d.externalId]));

  return {
    ...summary,
    licensedSeats: c.licensedSeats,
    renewalDate: c.renewalDate,
    identities: identities.map((i) => ({ system: i.system, externalId: i.externalId, matchMethod: i.matchMethod })),
    deals: deals.map((d) => ({ externalId: d.externalId, name: d.name, stage: d.stage, isWon: d.isWon, amountCents: d.amountCents, closeDate: d.closeDate })),
    contracts: contracts.map((k) => ({ externalId: k.externalId, status: k.status, startDate: k.startDate, endDate: k.endDate, description: k.description, specialTerms: k.specialTerms })),
    orders: orders.map((o) => ({ externalId: o.externalId, status: o.status, dealExternalId: o.dealId ? (dealExternal.get(o.dealId) ?? null) : null, totalCents: o.totalCents, effectiveDate: o.effectiveDate })),
    invoices: invoices.map((i) => toInvoiceDTOFromRow(i, c.name)),
    findings: await summarizeFindings(findingRows.map((f) => ({ f, customerName: c.name }))),
    recentSources: sources.map(toSourceRef),
  };
}
