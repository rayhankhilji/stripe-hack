import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@ghost/db";
import { invoiceIdempotencyKey } from "@ghost/billing";
import { AppError, type InvoiceDTO } from "@ghost/shared";
import { createFindingInvoice, ensureStripeCustomer, toInvoiceRow } from "@ghost/stripe";
import { recordAudit } from "./audit";
import { setFindingStatus } from "./findings";

type InvoiceRow = typeof schema.invoice.$inferSelect;

const DAY_MS = 86_400_000;
// Reminder steps per schema: 1 = due-soon (−3d), 2 = due date, 3 = +7d overdue.
const REMINDER_OFFSETS_DAYS: Record<number, number> = { 1: -3, 2: 0, 3: 7 };

export function daysUntilDue(): number {
  const n = Number(process.env.STRIPE_INVOICE_DAYS_UNTIL_DUE ?? "30");
  return Number.isInteger(n) && n > 0 ? n : 30;
}

export function toInvoiceDTO(row: InvoiceRow, customerName: string): InvoiceDTO {
  return {
    id: row.id,
    stripeInvoiceId: row.stripeInvoiceId,
    number: row.number,
    status: row.status,
    amountDueCents: row.amountDueCents,
    amountPaidCents: row.amountPaidCents,
    currency: row.currency,
    hostedInvoiceUrl: row.hostedInvoiceUrl,
    invoicePdf: row.invoicePdf,
    dueDate: row.dueDate?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    lines: row.lines,
    customerName,
    findingId: row.findingId,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  };
}

export async function customerNameFor(customerId: string): Promise<string> {
  const db = getDb();
  const [c] = await db.select({ name: schema.customer.name }).from(schema.customer).where(eq(schema.customer.id, customerId));
  return c?.name ?? "Unknown customer";
}

/**
 * Creates the Stripe test-mode invoice for an approved finding. Idempotent: a second call returns the
 * existing invoice, and the Stripe calls reuse the same idempotency keys (finding id + calc hash).
 */
export async function invoiceFinding(findingId: string, actor: string): Promise<InvoiceDTO> {
  const db = getDb();
  const [f] = await db.select().from(schema.finding).where(eq(schema.finding.id, findingId));
  if (!f) throw new AppError("NOT_FOUND", `finding ${findingId} not found`);
  const [cust] = await db.select().from(schema.customer).where(eq(schema.customer.id, f.customerId));
  if (!cust) throw new AppError("NOT_FOUND", `customer ${f.customerId} not found`);

  const [existing] = await db.select().from(schema.invoice).where(eq(schema.invoice.findingId, findingId));
  if (existing) {
    if (f.status === "approved") await markInvoiced(findingId, existing);
    return toInvoiceDTO(existing, cust.name);
  }
  if (f.status !== "approved") {
    throw new AppError("INVALID_STATE", `finding must be approved before invoicing (is ${f.status})`, { findingId });
  }

  const lines = await db.select().from(schema.findingLine).where(eq(schema.findingLine.findingId, findingId));
  if (lines.length === 0) throw new AppError("INVALID_STATE", "finding has no lines to invoice", { findingId });
  const dealIds = lines.map((l) => l.dealId).filter((d): d is string => d !== null);
  const deals = dealIds.length
    ? await db.select({ id: schema.deal.id, externalId: schema.deal.externalId }).from(schema.deal).where(inArray(schema.deal.id, dealIds))
    : [];
  const dealExt = new Map(deals.map((d) => [d.id, d.externalId]));

  const stripeCustomerId = await ensureStripeCustomer({
    id: cust.id,
    name: cust.name,
    eraAccountId: cust.eraAccountId,
    stripeCustomerId: cust.stripeCustomerId,
  });
  if (stripeCustomerId !== cust.stripeCustomerId) {
    await db.update(schema.customer).set({ stripeCustomerId, updatedAt: new Date() }).where(eq(schema.customer.id, cust.id));
  }

  const idempotencyKey = invoiceIdempotencyKey(findingId, f.calcHash);
  const inv = await createFindingInvoice({
    findingId,
    stripeCustomerId,
    idempotencyKey,
    daysUntilDue: daysUntilDue(),
    lines: lines.map((l) => ({
      description: l.description,
      amountCents: l.amountCents,
      dealExternalId: (l.dealId && dealExt.get(l.dealId)) ?? "unknown",
    })),
  });
  const patch = toInvoiceRow(inv);
  const now = new Date();
  await db
    .insert(schema.invoice)
    .values({ findingId, customerId: cust.id, stripeInvoiceId: inv.id, stripeCustomerId, idempotencyKey, currency: inv.currency, ...patch, lastSyncedAt: now })
    .onConflictDoNothing();
  const [row] = await db.select().from(schema.invoice).where(eq(schema.invoice.stripeInvoiceId, inv.id));
  if (!row) throw new AppError("INTERNAL", "invoice row missing after insert", { stripeInvoiceId: inv.id });

  await scheduleReminders(row);
  await recordAudit({
    actorType: "agent",
    actor: "ghost",
    kind: "action_executed",
    action: "invoice.created",
    summary: `Created Stripe invoice ${row.number ?? inv.id} for ${cust.name}`,
    subjectType: "finding",
    subjectId: findingId,
    externalRef: inv.id,
    data: { invoiceId: row.id, amountDueCents: row.amountDueCents, approvedBy: actor, hostedInvoiceUrl: row.hostedInvoiceUrl },
  });
  await markInvoiced(findingId, row);
  return toInvoiceDTO(row, cust.name);
}

async function markInvoiced(findingId: string, row: InvoiceRow): Promise<void> {
  await setFindingStatus(findingId, "invoiced", `Stripe invoice ${row.stripeInvoiceId} finalized`, { type: "agent", name: "ghost" });
}

async function scheduleReminders(row: InvoiceRow): Promise<void> {
  if (!row.dueDate) return;
  const due = row.dueDate.getTime();
  const db = getDb();
  await db
    .insert(schema.collectionReminder)
    .values(
      Object.entries(REMINDER_OFFSETS_DAYS).map(([step, days]) => ({
        invoiceId: row.id,
        step: Number(step),
        scheduledFor: new Date(due + days * DAY_MS),
      })),
    )
    .onConflictDoNothing();
}
