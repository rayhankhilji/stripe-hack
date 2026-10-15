// Collections: reminder sweep, dispute escalation and paid-invoice suppression.
// Reminders only ever become sandbox outbox drafts that a human approves; paying an invoice cancels the sequence.
import { and, asc, eq, inArray, lte, type SQL } from "drizzle-orm";
import { getDb, schema } from "@ghost/db";
import { formatCents, type CollectionItemDTO, type EvidenceDTO, type InvoiceDTO } from "@ghost/shared";
import { recordAudit } from "./audit";
import { sandboxAddress } from "./outbox";

const DAY_MS = 86_400_000;

type InvoiceRow = typeof schema.invoice.$inferSelect;
type ReminderRow = typeof schema.collectionReminder.$inferSelect;
type CustomerRow = typeof schema.customer.$inferSelect;
type Reminder = CollectionItemDTO["reminders"][number];

export type EvidenceEntry = { findingId: string | null; expansionId: string | null; dto: EvidenceDTO };

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** Evidence rows with their source records, as the public DTO. Shared with the expansion scan. */
export async function loadEvidenceEntries(where: SQL | undefined): Promise<EvidenceEntry[]> {
  const rows = await getDb()
    .select({ e: schema.evidence, s: schema.sourceRecord })
    .from(schema.evidence)
    .innerJoin(schema.sourceRecord, eq(schema.evidence.sourceRecordId, schema.sourceRecord.id))
    .where(where)
    .orderBy(asc(schema.evidence.createdAt), asc(schema.evidence.id));
  return rows.map(({ e, s }) => ({
    findingId: e.findingId,
    expansionId: e.expansionId,
    dto: {
      id: e.id,
      role: e.role,
      quote: e.quote,
      verified: e.verified,
      source: {
        system: s.system,
        recordType: s.recordType,
        externalId: s.externalId,
        title: s.title,
        url: s.url,
        occurredAt: iso(s.occurredAt),
        isFixture: s.isFixture,
      },
    },
  }));
}

function toInvoiceDTO(row: InvoiceRow, customerName: string): InvoiceDTO {
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
    dueDate: iso(row.dueDate),
    paidAt: iso(row.paidAt),
    lines: row.lines,
    customerName,
    findingId: row.findingId,
    lastSyncedAt: iso(row.lastSyncedAt),
  };
}

/** Whole days past due; negative means days remaining. A missing due date is treated as due now. */
function daysOverdue(due: Date | null, now: Date): number {
  return due ? Math.floor((now.getTime() - due.getTime()) / DAY_MS) : 0;
}

function toReminderDTO(r: ReminderRow): Reminder {
  return { id: r.id, step: r.step, status: r.status, scheduledFor: r.scheduledFor.toISOString(), suppressedReason: r.suppressedReason };
}

function nextActionFor(
  invoice: InvoiceRow,
  reminders: ReminderRow[],
  hasDispute: boolean,
  now: Date,
): CollectionItemDTO["nextAction"] {
  if (invoice.status === "paid") return "suppressed_paid";
  if (invoice.status !== "open") return "none";
  if (hasDispute) return "escalate_dispute";
  const due = reminders.some((r) => (r.status === "scheduled" && r.scheduledFor <= now) || r.status === "drafted");
  return due ? "send_reminder" : "await_payment";
}

export async function listCollections(): Promise<CollectionItemDTO[]> {
  const db = getDb();
  const now = new Date();
  const invoices = await db
    .select({ inv: schema.invoice, customerName: schema.customer.name })
    .from(schema.invoice)
    .innerJoin(schema.customer, eq(schema.invoice.customerId, schema.customer.id));
  if (invoices.length === 0) return [];

  const invoiceIds = invoices.map((r) => r.inv.id);
  const findingIds = invoices.flatMap((r) => (r.inv.findingId ? [r.inv.findingId] : []));
  const [reminderRows, disputes] = await Promise.all([
    db.select().from(schema.collectionReminder).where(inArray(schema.collectionReminder.invoiceId, invoiceIds)).orderBy(asc(schema.collectionReminder.step)),
    findingIds.length > 0
      ? loadEvidenceEntries(and(inArray(schema.evidence.findingId, findingIds), eq(schema.evidence.role, "dispute_signal")))
      : Promise.resolve([] as EvidenceEntry[]),
  ]);

  const items = invoices.map(({ inv, customerName }): CollectionItemDTO => {
    const reminders = reminderRows.filter((r) => r.invoiceId === inv.id);
    const disputeSignals = disputes.filter((d) => d.findingId !== null && d.findingId === inv.findingId).map((d) => d.dto);
    return {
      invoice: toInvoiceDTO(inv, customerName),
      daysOverdue: daysOverdue(inv.dueDate, now),
      nextAction: nextActionFor(inv, reminders, disputeSignals.length > 0, now),
      disputeSignals,
      reminders: reminders.map(toReminderDTO),
    };
  });
  // Open invoices first, most overdue on top; settled ones after, newest first.
  return items.sort((a, b) => {
    const aOpen = a.invoice.status === "open";
    const bOpen = b.invoice.status === "open";
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return aOpen ? b.daysOverdue - a.daysOverdue : (b.invoice.lastSyncedAt ?? "").localeCompare(a.invoice.lastSyncedAt ?? "");
  });
}

/**
 * Called by the webhook (invoice.paid) and by the sweep: every reminder still in flight is suppressed and any
 * unsent outbox draft for it is withdrawn. Idempotent: a second call finds nothing open and writes nothing.
 */
export async function suppressRemindersForInvoice(invoiceId: string, reason: string): Promise<number> {
  const db = getDb();
  const suppressed = await db.transaction(async (tx) => {
    const rows = await tx
      .update(schema.collectionReminder)
      .set({ status: "suppressed", suppressedReason: reason })
      .where(and(eq(schema.collectionReminder.invoiceId, invoiceId), inArray(schema.collectionReminder.status, ["scheduled", "drafted"])))
      .returning({ outboxMessageId: schema.collectionReminder.outboxMessageId });
    const outboxIds = rows.flatMap((r) => (r.outboxMessageId ? [r.outboxMessageId] : []));
    if (outboxIds.length > 0) {
      await tx
        .update(schema.outboxMessage)
        .set({ status: "suppressed", decidedBy: "system", decidedAt: new Date() })
        .where(and(inArray(schema.outboxMessage.id, outboxIds), eq(schema.outboxMessage.status, "pending_approval")));
    }
    return rows.length;
  });
  if (suppressed === 0) return 0;

  await recordAudit({
    actorType: "system",
    actor: "collections",
    kind: "action_executed",
    action: "collections.reminders_suppressed",
    summary: `Suppressed ${suppressed} collection reminder${suppressed === 1 ? "" : "s"}: ${reason}`,
    subjectType: "invoice",
    subjectId: invoiceId,
    externalRef: null,
    data: { suppressed, reason },
  });
  return suppressed;
}

const STEP_LABEL: Record<number, string> = { 1: "due soon", 2: "due today", 3: "overdue" };

function renderReminder(
  step: number,
  customer: CustomerRow,
  invoice: InvoiceRow,
  now: Date,
): { subject: string; bodyMd: string } {
  const amount = formatCents(invoice.amountDueCents - invoice.amountPaidCents, invoice.currency);
  const ref = invoice.number ?? invoice.stripeInvoiceId;
  const overdue = daysOverdue(invoice.dueDate, now);
  const dueLine = invoice.dueDate ? `Due date: ${invoice.dueDate.toISOString().slice(0, 10)}` : "Due date: on receipt";
  const subject =
    step === 1
      ? `Invoice ${ref} for ${amount} is due soon`
      : step === 2
        ? `Invoice ${ref} for ${amount} is due today`
        : `Invoice ${ref} for ${amount} is ${Math.max(overdue, 0)} days past due`;
  const opening =
    step === 1
      ? "This is a friendly heads-up that the invoice below is coming due."
      : step === 2
        ? "The invoice below is due today."
        : "Our records show the invoice below is past due. If you have already paid it, please disregard this note.";
  const lines = [
    `Hi ${customer.name} team,`,
    "",
    opening,
    "",
    `- Invoice: ${ref}`,
    `- Amount due: ${amount}`,
    `- ${dueLine}`,
    ...(invoice.hostedInvoiceUrl ? [`- Pay online: ${invoice.hostedInvoiceUrl}`] : []),
    "",
    "Reply to this message if anything on the invoice looks wrong and we will sort it out.",
  ];
  return { subject, bodyMd: lines.join("\n") };
}

type SweepResult = { drafted: number; suppressed: number; escalated: number };

/** Draft (or escalate) the due reminders of one open invoice. Returns what happened, for the sweep totals. */
async function sweepOpenInvoice(inv: InvoiceRow, customer: CustomerRow, hasDispute: boolean, now: Date): Promise<"drafted" | "escalated" | "none"> {
  const db = getDb();
  const due = await db
    .select()
    .from(schema.collectionReminder)
    .where(and(eq(schema.collectionReminder.invoiceId, inv.id), eq(schema.collectionReminder.status, "scheduled"), lte(schema.collectionReminder.scheduledFor, now)))
    .orderBy(asc(schema.collectionReminder.step));
  const latest = due[due.length - 1];
  if (!latest) return "none";

  if (hasDispute) {
    const reason = "Dispute on record: escalated for human follow-up instead of dunning";
    await db
      .update(schema.collectionReminder)
      .set({ status: "suppressed", suppressedReason: reason })
      .where(inArray(schema.collectionReminder.id, due.map((r) => r.id)));
    await recordAudit({
      actorType: "agent",
      actor: "collections",
      kind: "recommendation",
      action: "collections.escalated",
      summary: `Held ${STEP_LABEL[latest.step] ?? "scheduled"} reminder for ${customer.name}: a dispute is on record, so a human should follow up`,
      subjectType: "invoice",
      subjectId: inv.id,
      externalRef: inv.stripeInvoiceId,
      data: { steps: due.map((r) => r.step), customer: customer.name },
    });
    return "escalated";
  }

  // If the sweep ran late and several steps are due, only the latest one is worth sending; older ones are superseded.
  const superseded = due.filter((r) => r.id !== latest.id);
  const { subject, bodyMd } = renderReminder(latest.step, customer, inv, now);
  const message = await db.transaction(async (tx) => {
    // Claim the reminder first so two concurrent sweeps cannot both draft it.
    const [claimed] = await tx
      .update(schema.collectionReminder)
      .set({ status: "drafted" })
      .where(and(eq(schema.collectionReminder.id, latest.id), eq(schema.collectionReminder.status, "scheduled")))
      .returning({ id: schema.collectionReminder.id });
    if (!claimed) return null;
    const [msg] = await tx
      .insert(schema.outboxMessage)
      .values({
        kind: "collection_reminder",
        status: "pending_approval",
        toAddress: sandboxAddress(customer.eraAccountId),
        originalRecipient: customer.billingEmail,
        subject,
        bodyMd,
        invoiceId: inv.id,
      })
      .returning({ id: schema.outboxMessage.id });
    if (!msg) return null;
    await tx.update(schema.collectionReminder).set({ outboxMessageId: msg.id }).where(eq(schema.collectionReminder.id, latest.id));
    if (superseded.length > 0) {
      await tx
        .update(schema.collectionReminder)
        .set({ status: "cancelled", suppressedReason: `Superseded by reminder step ${latest.step}` })
        .where(inArray(schema.collectionReminder.id, superseded.map((r) => r.id)));
    }
    return msg;
  });
  if (!message) return "none";

  await recordAudit({
    actorType: "agent",
    actor: "collections",
    kind: "approval_pending",
    action: "collections.reminder_drafted",
    summary: `Drafted ${STEP_LABEL[latest.step] ?? "scheduled"} reminder for ${customer.name}; waiting for approval in the outbox`,
    subjectType: "outbox",
    subjectId: message.id,
    externalRef: inv.stripeInvoiceId,
    data: { step: latest.step, invoiceId: inv.id, supersededSteps: superseded.map((r) => r.step) },
  });
  return "drafted";
}

export async function runCollectionsSweep(now: Date = new Date()): Promise<SweepResult> {
  const db = getDb();
  const result: SweepResult = { drafted: 0, suppressed: 0, escalated: 0 };

  const invoices = await db
    .select({ inv: schema.invoice, customer: schema.customer })
    .from(schema.invoice)
    .innerJoin(schema.customer, eq(schema.invoice.customerId, schema.customer.id));
  const findingIds = invoices.flatMap((r) => (r.inv.findingId && r.inv.status === "open" ? [r.inv.findingId] : []));
  const disputed = new Set(
    findingIds.length > 0
      ? (await loadEvidenceEntries(and(inArray(schema.evidence.findingId, findingIds), eq(schema.evidence.role, "dispute_signal")))).flatMap((e) => (e.findingId ? [e.findingId] : []))
      : [],
  );

  for (const { inv, customer } of invoices) {
    if (inv.status === "paid") {
      result.suppressed += await suppressRemindersForInvoice(inv.id, "Invoice paid: collection reminders no longer apply");
    } else if (inv.status === "void" || inv.status === "uncollectible") {
      result.suppressed += await suppressRemindersForInvoice(inv.id, `Invoice ${inv.status}: collection reminders no longer apply`);
    } else if (inv.status === "open") {
      const outcome = await sweepOpenInvoice(inv, customer, inv.findingId !== null && disputed.has(inv.findingId), now);
      if (outcome === "drafted") result.drafted += 1;
      if (outcome === "escalated") result.escalated += 1;
    }
  }

  await recordAudit({
    actorType: "agent",
    actor: "collections",
    kind: "info",
    action: "collections.sweep",
    summary: `Collections sweep: ${result.drafted} drafted, ${result.suppressed} suppressed, ${result.escalated} escalated`,
    subjectType: "system",
    subjectId: null,
    externalRef: null,
    data: { ...result, at: now.toISOString() },
  });
  return result;
}
