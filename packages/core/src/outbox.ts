// Sandbox-only outbox. Nothing here talks to a mail provider: "sending" means flipping a row to
// `sent_simulated` after a human approves it, and every recipient is rewritten to the sandbox domain.
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@ghost/db";
import { AppError, type OutboxMessageDTO } from "@ghost/shared";
import { recordAudit } from "./audit";

type OutboxRow = typeof schema.outboxMessage.$inferSelect;
export type OutboxStatusValue = OutboxMessageDTO["status"];

const DEFAULT_SANDBOX_DOMAIN = "sandbox.ghost.test";

/** `.test` is reserved (RFC 2606) and can never route to a real mailbox, so it is the only family we accept. */
export function sandboxDomain(): string {
  const domain = (process.env.OUTBOX_SANDBOX_DOMAIN ?? DEFAULT_SANDBOX_DOMAIN).trim().toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.test$/.test(domain)) {
    throw new AppError("POLICY_BLOCKED", "OUTBOX_SANDBOX_DOMAIN must be a .test domain; real email is never sent", { domain });
  }
  return domain;
}

/** Same address convention as the Stripe customer email (`billing+<eraAccountId>@<sandbox domain>`). */
export function sandboxAddress(eraAccountId: string): string {
  const tag = eraAccountId.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  return `billing+${tag}@${sandboxDomain()}`;
}

export function assertSandboxRecipient(address: string): void {
  if (!address.toLowerCase().endsWith(`@${sandboxDomain()}`)) {
    throw new AppError("POLICY_BLOCKED", "Outbox messages may only be addressed to the sandbox domain", { toAddress: address });
  }
}

function relatedHref(row: OutboxRow): string | null {
  if (row.invoiceId) return "/collections";
  if (row.expansionId) return "/expansion";
  return null;
}

export function toOutboxDTO(row: OutboxRow): OutboxMessageDTO {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    toAddress: row.toAddress,
    originalRecipient: row.originalRecipient,
    subject: row.subject,
    bodyMd: row.bodyMd,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    relatedHref: relatedHref(row),
  };
}

export async function listOutbox(status?: OutboxStatusValue): Promise<OutboxMessageDTO[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.outboxMessage)
    .where(status ? eq(schema.outboxMessage.status, status) : undefined)
    .orderBy(desc(schema.outboxMessage.createdAt), desc(schema.outboxMessage.id));
  return rows.map(toOutboxDTO);
}

/** Approve → `sent_simulated` (never a real send); reject → `rejected`. Linked reminder / expansion rows follow. */
export async function decideOutbox(id: string, decision: "approve" | "reject", actor: string): Promise<OutboxMessageDTO> {
  const db = getDb();
  const [current] = await db.select().from(schema.outboxMessage).where(eq(schema.outboxMessage.id, id)).limit(1);
  if (!current) throw new AppError("NOT_FOUND", "Outbox message not found", { id });
  if (current.status !== "pending_approval") {
    throw new AppError("INVALID_STATE", `Outbox message is ${current.status}, not pending approval`, { id, status: current.status });
  }
  if (decision === "approve") {
    assertSandboxRecipient(current.toAddress);
    await assertInvoiceStillOpen(current);
  }

  const to: OutboxStatusValue = decision === "approve" ? "sent_simulated" : "rejected";
  const decidedAt = new Date();
  const updated = await db.transaction(async (tx) => {
    // The status guard makes a double click (or a concurrent suppression) a no-op instead of a second decision.
    const [row] = await tx
      .update(schema.outboxMessage)
      .set({ status: to, decidedBy: actor, decidedAt })
      .where(and(eq(schema.outboxMessage.id, id), eq(schema.outboxMessage.status, "pending_approval")))
      .returning();
    if (!row) return null;
    if (row.kind === "collection_reminder") {
      await tx
        .update(schema.collectionReminder)
        .set({ status: decision === "approve" ? "sent_simulated" : "cancelled" })
        .where(eq(schema.collectionReminder.outboxMessageId, id));
    }
    if (row.expansionId) {
      await tx
        .update(schema.expansionOpportunity)
        .set({ status: decision === "approve" ? "sent_simulated" : "rejected", updatedAt: decidedAt })
        .where(eq(schema.expansionOpportunity.id, row.expansionId));
    }
    return row;
  });
  if (!updated) throw new AppError("CONFLICT", "Outbox message was decided concurrently", { id });

  await recordAudit({
    actorType: "operator",
    actor,
    kind: "approval_decision",
    action: decision === "approve" ? "outbox.approved" : "outbox.rejected",
    summary: `${actor} ${decision === "approve" ? "approved" : "rejected"} "${updated.subject}"`,
    subjectType: "outbox",
    subjectId: updated.id,
    externalRef: null,
    data: { kind: updated.kind, toAddress: updated.toAddress, originalRecipient: updated.originalRecipient },
  });
  if (decision === "approve") {
    await recordAudit({
      actorType: "system",
      actor: "outbox",
      kind: "action_executed",
      action: "outbox.sent_simulated",
      summary: `Simulated delivery to ${updated.toAddress} (sandbox only, no real email sent)`,
      subjectType: "outbox",
      subjectId: updated.id,
      externalRef: null,
      data: { kind: updated.kind, simulated: true },
    });
  }
  return toOutboxDTO(updated);
}

/** A dunning email for an invoice that has since been paid or voided must never go out, even simulated. */
async function assertInvoiceStillOpen(row: OutboxRow): Promise<void> {
  if (!row.invoiceId) return;
  const [inv] = await getDb()
    .select({ status: schema.invoice.status })
    .from(schema.invoice)
    .where(eq(schema.invoice.id, row.invoiceId))
    .limit(1);
  if (inv && inv.status !== "open") {
    throw new AppError("INVALID_STATE", `Invoice is ${inv.status}; this reminder no longer applies`, { id: row.id, invoiceStatus: inv.status });
  }
}
