import { and, desc, eq, inArray, isNotNull, max, count, sql, notInArray } from "drizzle-orm";
import { getDb, schema } from "@ghost/db";
import { EraSystem, type FindingStatus, type OverviewDTO } from "@ghost/shared";
import { summarizeFindings, toInvoiceDTOFromRow } from "./findings";

const TOP_FINDINGS = 5;
const RECENT_RECOVERIES = 5;

/** Open recoverable revenue: not yet invoiced (that moves to "awaiting payment"), recovered or rejected. */
export const OPEN_FINDING_EXCLUDED: FindingStatus[] = ["rejected", "recovered", "invoiced"];

export async function getOverview(): Promise<OverviewDTO> {
  const db = getDb();
  const f = schema.finding;
  const inv = schema.invoice;

  const [statusRows, recoverableRows, awaitingRows, recoveredRows, systemRows, topRows, recoveryRows, attentionFindings, attentionInvoices] = await Promise.all([
    db.select({ status: f.status, n: count() }).from(f).groupBy(f.status),
    db.select({ total: sql<number>`coalesce(sum(${f.amountCents}), 0)::float8` }).from(f).where(notInArray(f.status, OPEN_FINDING_EXCLUDED)),
    db.select({ total: sql<number>`coalesce(sum(${inv.amountDueCents}), 0)::float8` }).from(inv).where(eq(inv.status, "open")),
    db.select({ total: sql<number>`coalesce(sum(${inv.amountPaidCents}), 0)::float8` }).from(inv).where(and(eq(inv.status, "paid"), isNotNull(inv.findingId))),
    db.select({ system: schema.sourceRecord.system, n: count(), last: max(schema.sourceRecord.fetchedAt) }).from(schema.sourceRecord).groupBy(schema.sourceRecord.system),
    db
      .select({ f, customerName: schema.customer.name })
      .from(f)
      .innerJoin(schema.customer, eq(schema.customer.id, f.customerId))
      .where(notInArray(f.status, OPEN_FINDING_EXCLUDED))
      .orderBy(desc(sql`${f.amountCents} * (${f.evidenceScore} + 1)`), f.id)
      .limit(TOP_FINDINGS),
    db
      .select({ i: inv, customerName: schema.customer.name })
      .from(inv)
      .innerJoin(schema.customer, eq(schema.customer.id, inv.customerId))
      .where(and(eq(inv.status, "paid"), isNotNull(inv.findingId)))
      .orderBy(desc(inv.paidAt))
      .limit(RECENT_RECOVERIES),
    db
      .select({ id: f.id, title: f.title, status: f.status, customerName: schema.customer.name })
      .from(f)
      .innerJoin(schema.customer, eq(schema.customer.id, f.customerId))
      .where(inArray(f.status, ["needs_review", "escalated"]))
      .orderBy(desc(f.amountCents), f.id),
    db
      .select({ i: inv, customerName: schema.customer.name })
      .from(inv)
      .innerJoin(schema.customer, eq(schema.customer.id, inv.customerId))
      .where(inArray(inv.status, ["open", "draft"])),
  ]);

  const syncedBySystem = new Map(systemRows.map((r) => [r.system, r]));
  const now = Date.now();
  const needsAttention: OverviewDTO["needsAttention"] = [
    ...attentionFindings.map((r) => ({
      kind: r.status === "escalated" ? ("escalated" as const) : ("needs_review" as const),
      title: `${r.customerName}: ${r.title}`,
      href: `/recovery/${r.id}`,
    })),
    ...attentionInvoices.flatMap(({ i, customerName }) => {
      const href = i.findingId ? `/recovery/${i.findingId}` : "/collections";
      const items: OverviewDTO["needsAttention"] = [];
      if (i.lastPaymentError) items.push({ kind: "payment_failed", title: `${customerName}: payment failed on ${i.number ?? i.stripeInvoiceId}`, href });
      if (i.status === "open" && i.dueDate && i.dueDate.getTime() < now) items.push({ kind: "overdue", title: `${customerName}: ${i.number ?? i.stripeInvoiceId} is overdue`, href: "/collections" });
      return items;
    }),
  ];

  const topFindings = await summarizeFindings(topRows);
  return {
    recoverableCents: Number(recoverableRows[0]?.total ?? 0),
    awaitingPaymentCents: Number(awaitingRows[0]?.total ?? 0),
    recoveredCents: Number(recoveredRows[0]?.total ?? 0),
    findingsByStatus: Object.fromEntries(statusRows.map((r) => [r.status, r.n])),
    systemsConnected: EraSystem.options.map((system) => {
      const r = syncedBySystem.get(system);
      return { system, records: r?.n ?? 0, lastSyncedAt: r?.last ? new Date(r.last).toISOString() : null };
    }),
    topFindings,
    recentRecoveries: recoveryRows.map((r) => toInvoiceDTOFromRow(r.i, r.customerName)),
    needsAttention,
  };
}
