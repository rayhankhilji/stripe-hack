import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@ghost/db";
import { AppError, type InvoiceDTO } from "@ghost/shared";
import { fetchInvoice, toInvoiceRow, type InvoiceRowPatch, type InvoiceStatusValue, type Stripe } from "@ghost/stripe";
import { recordAudit } from "./audit";
import { suppressRemindersForInvoice } from "./collections";
import { setFindingStatus } from "./findings";
import { customerNameFor, toInvoiceDTO } from "./invoicing";

export { verifyWebhook } from "@ghost/stripe";

type InvoiceRow = typeof schema.invoice.$inferSelect;
export type InvoiceEventEffect = { to: InvoiceStatusValue } | { paymentFailed: true };

/** §6 event map. Anything not listed is recorded and ignored. */
export const INVOICE_EVENT_MAP: Readonly<Record<string, InvoiceEventEffect>> = {
  "invoice.finalized": { to: "open" },
  "invoice.paid": { to: "paid" },
  "invoice.payment_failed": { paymentFailed: true },
  "invoice.voided": { to: "void" },
  "invoice.marked_uncollectible": { to: "uncollectible" },
};

export function invoiceEffectFor(type: string): InvoiceEventEffect | null {
  return INVOICE_EVENT_MAP[type] ?? null;
}

/** Monotonic invoice states: events can arrive out of order and must never regress a row. */
const ALLOWED: Record<InvoiceStatusValue, readonly InvoiceStatusValue[]> = {
  draft: ["open", "paid", "void", "uncollectible"],
  open: ["paid", "void", "uncollectible"],
  uncollectible: ["paid", "void"],
  paid: [],
  void: [],
};

export function canTransition(from: InvoiceStatusValue, to: InvoiceStatusValue): boolean {
  return ALLOWED[from].includes(to);
}

/**
 * Verified-event entry point. The stripe_event primary key dedupes deliveries; failed attempts are
 * re-claimable so Stripe's retry can finish the work.
 */
export async function handleStripeEvent(evt: Stripe.Event): Promise<"processed" | "ignored" | "duplicate"> {
  const db = getDb();
  const inserted = await db
    .insert(schema.stripeEvent)
    .values({ id: evt.id, type: evt.type, livemode: evt.livemode, payload: evt as unknown as Record<string, unknown> })
    .onConflictDoNothing()
    .returning({ id: schema.stripeEvent.id });
  if (inserted.length === 0) {
    const reclaimed = await db
      .update(schema.stripeEvent)
      .set({ status: "received", error: null })
      .where(and(eq(schema.stripeEvent.id, evt.id), eq(schema.stripeEvent.status, "failed")))
      .returning({ id: schema.stripeEvent.id });
    if (reclaimed.length === 0) return "duplicate";
  }

  try {
    const result = await applyEvent(evt);
    await finishEvent(evt.id, result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(schema.stripeEvent).set({ status: "failed", error: message }).where(eq(schema.stripeEvent.id, evt.id));
    throw err;
  }
}

async function finishEvent(id: string, result: "processed" | "ignored"): Promise<void> {
  await getDb().update(schema.stripeEvent).set({ status: result, processedAt: new Date() }).where(eq(schema.stripeEvent.id, id));
}

async function applyEvent(evt: Stripe.Event): Promise<"processed" | "ignored"> {
  if (evt.livemode) return "ignored"; // test mode only, by policy
  const effect = invoiceEffectFor(evt.type);
  if (!effect) return "ignored";
  const inv = evt.data.object as Stripe.Invoice;
  const row = await findInvoiceRow(inv.id);
  if (!row) return "ignored"; // not a Ghost invoice

  if ("paymentFailed" in effect) {
    const msg = `Payment attempt ${inv.attempt_count} failed`;
    await getDb().update(schema.invoice).set({ lastPaymentError: msg, updatedAt: new Date() }).where(eq(schema.invoice.id, row.id));
    await recordAudit({
      actorType: "stripe",
      actor: "stripe",
      kind: "info",
      action: `webhook.${evt.type}`,
      summary: `Stripe reported a failed payment on ${row.number ?? inv.id}`,
      subjectType: "invoice",
      subjectId: row.id,
      externalRef: evt.id,
      data: { stripeInvoiceId: inv.id, findingId: row.findingId, attemptCount: inv.attempt_count },
    });
    return "processed";
  }

  await applySnapshot(row, toInvoiceRow(inv), { source: "webhook", eventId: evt.id, eventType: evt.type });
  return "processed";
}

async function findInvoiceRow(stripeInvoiceId: string | undefined): Promise<InvoiceRow | null> {
  if (!stripeInvoiceId) return null;
  const [row] = await getDb().select().from(schema.invoice).where(eq(schema.invoice.stripeInvoiceId, stripeInvoiceId));
  return row ?? null;
}

type SnapshotSource = { source: "webhook"; eventId: string; eventType: string } | { source: "refresh" };

/** Applies a Stripe invoice snapshot. Only one caller wins the transition to paid, so side effects run once. */
async function applySnapshot(row: InvoiceRow, patch: InvoiceRowPatch, src: SnapshotSource): Promise<InvoiceRow> {
  const db = getDb();
  const now = new Date();
  const moving = patch.status !== row.status && canTransition(row.status, patch.status);
  const fields = { ...patch, status: moving ? patch.status : row.status, lastSyncedAt: now, updatedAt: now };
  if (moving && patch.status === "paid") fields.paidAt = patch.paidAt ?? now;

  const fromStatuses = moving ? allowedFrom(patch.status) : [row.status];
  const [updated] = await db
    .update(schema.invoice)
    .set(moving && patch.status === "paid" ? { ...fields, lastPaymentError: null } : fields)
    .where(and(eq(schema.invoice.id, row.id), inArray(schema.invoice.status, fromStatuses)))
    .returning();
  if (!updated) return (await findInvoiceRow(row.stripeInvoiceId)) ?? row; // lost a race; the winner did the work
  if (!moving) return updated;

  const externalRef = src.source === "webhook" ? src.eventId : row.stripeInvoiceId;
  const action = src.source === "webhook" ? `webhook.${src.eventType}` : `invoice.refreshed.${patch.status}`;
  if (patch.status === "paid") {
    await markRecovered(updated, externalRef, action, src);
  } else {
    await recordAudit({
      actorType: "stripe",
      actor: "stripe",
      kind: "info",
      action,
      summary: `Invoice ${updated.number ?? updated.stripeInvoiceId} is now ${patch.status}`,
      subjectType: "invoice",
      subjectId: updated.id,
      externalRef,
      data: { from: row.status, to: patch.status, findingId: updated.findingId, source: src.source },
    });
  }
  return updated;
}

function allowedFrom(to: InvoiceStatusValue): InvoiceStatusValue[] {
  return (Object.keys(ALLOWED) as InvoiceStatusValue[]).filter((from) => ALLOWED[from].includes(to));
}

async function markRecovered(inv: InvoiceRow, externalRef: string, action: string, src: SnapshotSource): Promise<void> {
  const via = src.source === "webhook" ? `verified Stripe webhook ${externalRef}` : "Stripe API fetch";
  if (inv.findingId) {
    const [f] = await getDb().select({ status: schema.finding.status }).from(schema.finding).where(eq(schema.finding.id, inv.findingId));
    const actor = { type: "stripe" as const, name: "stripe" };
    if (f?.status === "approved") await setFindingStatus(inv.findingId, "invoiced", "Stripe invoice finalized", actor);
    if (f?.status === "approved" || f?.status === "invoiced") {
      await setFindingStatus(inv.findingId, "recovered", `Paid in full; confirmed by ${via}`, actor);
    }
  }
  const suppressed = await suppressRemindersForInvoice(inv.id, `Suppressed: paid via ${src.source === "webhook" ? "webhook" : "Stripe fetch"}`);
  await recordAudit({
    actorType: "stripe",
    actor: "stripe",
    kind: "outcome_verified",
    action,
    summary: `Invoice ${inv.number ?? inv.stripeInvoiceId} paid; recovery confirmed by ${via}`,
    subjectType: inv.findingId ? "finding" : "invoice",
    subjectId: inv.findingId ?? inv.id,
    externalRef,
    data: { invoiceId: inv.id, stripeInvoiceId: inv.stripeInvoiceId, amountPaidCents: inv.amountPaidCents, remindersSuppressed: suppressed },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Re-reads the invoice from Stripe (authoritative) and applies the same transitions as the webhook. */
export async function refreshInvoice(invoiceId: string): Promise<InvoiceDTO> {
  if (!UUID_RE.test(invoiceId)) throw new AppError("VALIDATION", "invoice id must be a uuid");
  const [row] = await getDb().select().from(schema.invoice).where(eq(schema.invoice.id, invoiceId));
  if (!row) throw new AppError("NOT_FOUND", `invoice ${invoiceId} not found`);
  const inv = await fetchInvoice(row.stripeInvoiceId);
  const updated = await applySnapshot(row, toInvoiceRow(inv), { source: "refresh" });
  return toInvoiceDTO(updated, await customerNameFor(updated.customerId));
}
