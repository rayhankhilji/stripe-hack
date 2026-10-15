import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@ghost/db";
import {
  AppError,
  FindingStatus,
  RULE_IDS,
  type AuditEventDTO,
  type FindingDetailDTO,
  type FindingSummaryDTO,
  type InvoiceDTO,
  type RuleId,
} from "@ghost/shared";
import { listAudit, recordAudit } from "./audit";
import { loadEvidence } from "./detect";
import type { ActorType, ExplanationInput } from "./facts";

type FindingRow = typeof schema.finding.$inferSelect;
type InvoiceRow = typeof schema.invoice.$inferSelect;

const PAGE_SIZE = 50;
const TIMELINE_LIMIT = 200;

/** FAST_PLAN §6. `failed` is reachable from every non-terminal state and re-analysis restarts from it. */
const TRANSITIONS: Record<FindingStatus, readonly FindingStatus[]> = {
  detected: ["analyzing", "failed"],
  analyzing: ["ready_for_approval", "needs_review", "escalated", "failed"],
  needs_review: ["analyzing", "failed"],
  escalated: ["failed"],
  ready_for_approval: ["approved", "rejected", "analyzing", "failed"],
  approved: ["invoiced", "failed"],
  invoiced: ["recovered", "failed"],
  failed: ["analyzing"],
  recovered: [],
  rejected: [],
};

export function canTransition(from: FindingStatus, to: FindingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function toInvoiceDTOFromRow(row: InvoiceRow, customerName: string): InvoiceDTO {
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
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    lines: row.lines,
    customerName,
    findingId: row.findingId,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
  };
}

async function failingRulesByFinding(ids: string[]): Promise<Map<string, RuleId[]>> {
  const out = new Map<string, RuleId[]>();
  if (!ids.length) return out;
  const rows = await getDb()
    .select({ findingId: schema.eligibilityCheck.findingId, ruleId: schema.eligibilityCheck.ruleId })
    .from(schema.eligibilityCheck)
    .where(and(inArray(schema.eligibilityCheck.findingId, ids), eq(schema.eligibilityCheck.outcome, "fail")))
    .orderBy(asc(schema.eligibilityCheck.ruleId));
  for (const r of rows) {
    const id = RULE_IDS.find((x) => x === r.ruleId);
    if (!id) continue;
    out.set(r.findingId, [...(out.get(r.findingId) ?? []), id]);
  }
  return out;
}

async function evidenceCounts(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await getDb()
    .select({ findingId: schema.evidence.findingId, n: count() })
    .from(schema.evidence)
    .where(inArray(schema.evidence.findingId, ids))
    .groupBy(schema.evidence.findingId);
  return new Map(rows.flatMap((r) => (r.findingId ? [[r.findingId, r.n] as const] : [])));
}

/** Summaries for already-selected finding rows, with the customer name joined in. */
export async function summarizeFindings(rows: { f: FindingRow; customerName: string }[]): Promise<FindingSummaryDTO[]> {
  const ids = rows.map((r) => r.f.id);
  const [failing, counts] = await Promise.all([failingRulesByFinding(ids), evidenceCounts(ids)]);
  return rows.map(({ f, customerName }) => ({
    id: f.id,
    customerId: f.customerId,
    customerName,
    kind: f.kind,
    status: f.status,
    title: f.title,
    amountCents: f.amountCents,
    evidenceScore: f.evidenceScore,
    evidenceCount: counts.get(f.id) ?? 0,
    failingRules: failing.get(f.id) ?? [],
    isFixture: f.isFixture,
    updatedAt: f.updatedAt.toISOString(),
  }));
}

function decodeOffset(cursor: string | undefined): number {
  if (!cursor) return 0;
  const n = Number(Buffer.from(cursor, "base64url").toString("utf8"));
  if (!Number.isSafeInteger(n) || n < 0) throw new AppError("VALIDATION", "Invalid cursor");
  return n;
}

/** Ranked by amount × evidence score (the recovery-queue order), then id for a stable page boundary. */
export async function listFindings(q: { status?: FindingStatus; cursor?: string }): Promise<{ items: FindingSummaryDTO[]; nextCursor: string | null }> {
  const status = q.status === undefined ? undefined : FindingStatus.safeParse(q.status);
  if (status && !status.success) throw new AppError("VALIDATION", `Unknown finding status: ${String(q.status)}`);
  const offset = decodeOffset(q.cursor);
  const rows = await getDb()
    .select({ f: schema.finding, customerName: schema.customer.name })
    .from(schema.finding)
    .innerJoin(schema.customer, eq(schema.customer.id, schema.finding.customerId))
    .where(status ? eq(schema.finding.status, status.data) : undefined)
    .orderBy(desc(sql`${schema.finding.amountCents} * (${schema.finding.evidenceScore} + 1)`), asc(schema.finding.id))
    .limit(PAGE_SIZE + 1)
    .offset(offset);
  const items = await summarizeFindings(rows.slice(0, PAGE_SIZE));
  const nextCursor = rows.length > PAGE_SIZE ? Buffer.from(String(offset + PAGE_SIZE)).toString("base64url") : null;
  return { items, nextCursor };
}

export async function getFinding(id: string): Promise<FindingDetailDTO> {
  const db = getDb();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("NOT_FOUND", `Finding ${id} not found`);
  const [row] = await db
    .select({ f: schema.finding, customerName: schema.customer.name })
    .from(schema.finding)
    .innerJoin(schema.customer, eq(schema.customer.id, schema.finding.customerId))
    .where(eq(schema.finding.id, id))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", `Finding ${id} not found`);

  const [summary] = await summarizeFindings([row]);
  const [lines, evidence, checks, explanation, invoice, approval, audit] = await Promise.all([
    db.select().from(schema.findingLine).where(eq(schema.findingLine.findingId, id)).orderBy(asc(schema.findingLine.description)),
    loadEvidence(id),
    db.select().from(schema.eligibilityCheck).where(eq(schema.eligibilityCheck.findingId, id)).orderBy(asc(schema.eligibilityCheck.ruleId)),
    db.select().from(schema.explanation).where(eq(schema.explanation.findingId, id)).limit(1),
    db.select().from(schema.invoice).where(eq(schema.invoice.findingId, id)).limit(1),
    db.select().from(schema.approval).where(eq(schema.approval.findingId, id)).limit(1),
    listAudit({ subjectType: "finding", subjectId: id, limit: TIMELINE_LIMIT }),
  ]);
  if (!summary) throw new AppError("INTERNAL", "Finding summary missing");

  const [expl, inv, appr] = [explanation[0], invoice[0], approval[0]];
  const dealIds = [...new Set(lines.map((l) => l.dealId).filter((d): d is string => d !== null))];
  const deals = dealIds.length ? await db.select({ id: schema.deal.id, externalId: schema.deal.externalId }).from(schema.deal).where(inArray(schema.deal.id, dealIds)) : [];
  const dealExternal = new Map(deals.map((d) => [d.id, d.externalId]));
  const timeline: AuditEventDTO[] = [...audit.items].reverse();

  return {
    ...summary,
    decisionReason: row.f.decisionReason,
    calculation: row.f.calculation,
    lines: lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity,
      unitAmountCents: l.unitAmountCents,
      amountCents: l.amountCents,
      dealExternalId: l.dealId ? (dealExternal.get(l.dealId) ?? null) : null,
    })),
    evidence,
    eligibility: checks.flatMap((c) => {
      const ruleId = RULE_IDS.find((x) => x === c.ruleId);
      return ruleId ? [{ ruleId, name: c.name, outcome: c.outcome, detail: c.detail }] : [];
    }),
    explanation: expl
      ? { summary: expl.summary, bodyMd: expl.bodyMd, citedEvidenceIds: expl.citedEvidenceIds, model: expl.model, promptVersion: expl.promptVersion, validated: expl.validated }
      : null,
    invoice: inv ? toInvoiceDTOFromRow(inv, row.customerName) : null,
    approval: appr ? { decision: appr.decision, actor: appr.actor, note: appr.note, at: appr.createdAt.toISOString() } : null,
    timeline,
  };
}

function auditKindFor(to: FindingStatus, actor: ActorType): AuditEventDTO["kind"] {
  switch (to) {
    case "ready_for_approval":
      return "approval_pending";
    case "needs_review":
    case "escalated":
      return "recommendation";
    case "approved":
    case "rejected":
      return "approval_decision";
    case "invoiced":
      return "action_executed";
    case "recovered":
      return actor === "stripe" ? "outcome_verified" : "info";
    case "failed":
      return "error";
    default:
      return "info";
  }
}

/** Enforces the §6 state machine. The UPDATE is guarded on the current status so concurrent callers cannot both win. */
export async function setFindingStatus(id: string, to: FindingStatus, reason: string, actor: { type: ActorType; name: string }): Promise<void> {
  const db = getDb();
  const [row] = await db.select({ status: schema.finding.status, title: schema.finding.title }).from(schema.finding).where(eq(schema.finding.id, id)).limit(1);
  if (!row) throw new AppError("NOT_FOUND", `Finding ${id} not found`);
  if (!canTransition(row.status, to)) {
    throw new AppError("INVALID_STATE", `Finding cannot move from ${row.status} to ${to}`, { from: row.status, to });
  }
  await db
    .update(schema.finding)
    .set({ status: to, decisionReason: reason, updatedAt: new Date() })
    .where(and(eq(schema.finding.id, id), eq(schema.finding.status, row.status)));
  const [after] = await db.select({ status: schema.finding.status }).from(schema.finding).where(eq(schema.finding.id, id)).limit(1);
  if (after?.status !== to) throw new AppError("CONFLICT", "Finding changed while updating; retry", { from: row.status, to });

  await recordAudit({
    actorType: actor.type,
    actor: actor.name,
    kind: auditKindFor(to, actor.type),
    action: `finding.${to}`,
    summary: `${row.title}: ${row.status.replace(/_/g, " ")} → ${to.replace(/_/g, " ")}. ${reason}`,
    subjectType: "finding",
    subjectId: id,
    externalRef: null,
    data: { from: row.status, to, reason },
  });
}

/** Records the human decision. Idempotent for the same decision; the status change itself is a separate setFindingStatus call. */
export async function recordApproval(id: string, decision: "approved" | "rejected", actor: string, note?: string): Promise<void> {
  const db = getDb();
  const [row] = await db.select({ status: schema.finding.status, title: schema.finding.title }).from(schema.finding).where(eq(schema.finding.id, id)).limit(1);
  if (!row) throw new AppError("NOT_FOUND", `Finding ${id} not found`);
  if (row.status !== "ready_for_approval") {
    throw new AppError("INVALID_STATE", `Finding is ${row.status}; only ready_for_approval findings can be ${decision}`, { status: row.status });
  }
  await db
    .insert(schema.approval)
    .values({ findingId: id, decision, actor, note: note ?? null })
    .onConflictDoUpdate({ target: schema.approval.findingId, set: { decision, actor, note: note ?? null, createdAt: new Date() } });
  await recordAudit({
    actorType: "operator",
    actor,
    kind: "approval_decision",
    action: `approval.${decision}`,
    summary: `${actor} ${decision} "${row.title}"${note ? `: ${note}` : ""}`,
    subjectType: "finding",
    subjectId: id,
    externalRef: null,
    data: { decision, note: note ?? null },
  });
}

export async function saveExplanation(findingId: string, e: ExplanationInput): Promise<void> {
  const db = getDb();
  const [row] = await db.select({ id: schema.finding.id }).from(schema.finding).where(eq(schema.finding.id, findingId)).limit(1);
  if (!row) throw new AppError("NOT_FOUND", `Finding ${findingId} not found`);
  const values = { summary: e.summary, bodyMd: e.bodyMd, citedEvidenceIds: e.citedEvidenceIds, model: e.model, promptVersion: e.promptVersion, validated: e.validated };
  await db.insert(schema.explanation).values({ findingId, ...values }).onConflictDoUpdate({ target: schema.explanation.findingId, set: { ...values, createdAt: new Date() } });
  await recordAudit({
    actorType: "agent",
    actor: e.model,
    kind: "recommendation",
    action: "finding.explained",
    summary: e.summary,
    subjectType: "finding",
    subjectId: findingId,
    externalRef: null,
    data: { model: e.model, promptVersion: e.promptVersion, validated: e.validated, citations: e.citedEvidenceIds.length },
  });
}
