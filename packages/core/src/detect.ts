import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@ghost/db";
import { decide, detectWonNotBilled, evaluateEligibility, evidenceScore, type DetectedFinding } from "@ghost/billing";
import { AppError, type EligibilityCheckDTO, type EvidenceDTO, type FindingStatus } from "@ghost/shared";
import { recordAudit } from "./audit";
import { pickQuote, quoteCandidates } from "./evidence-quotes";
import { loadCustomerFacts, roleOfSource, toSourceRef, type EvidenceRole } from "./facts";

type SourceRow = typeof schema.sourceRecord.$inferSelect;

const DEFAULT_CAP_CENTS = 10_000_000;
const MAX_USAGE_EVIDENCE = 3;
const MAX_DISPUTE_EVIDENCE = 3;
const MAX_CONTEXT_EVIDENCE = 2;
/** Statuses a re-detection may still recompute; anything later belongs to the human/Stripe flow. */
const RECOMPUTABLE: readonly FindingStatus[] = ["detected", "needs_review", "escalated", "ready_for_approval"];

const ROLE_ORDER: Record<EvidenceRole, number> = {
  commitment: 0,
  contract_term: 1,
  billing_state: 2,
  usage_signal: 3,
  dispute_signal: 4,
  context: 5,
};

function invoiceCapCents(): number {
  const raw = process.env.INVOICE_AMOUNT_CAP_CENTS;
  if (raw === undefined || raw === "") return DEFAULT_CAP_CENTS;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) throw new AppError("VALIDATION", "INVOICE_AMOUNT_CAP_CENTS must be a positive integer number of cents");
  return n;
}

const byRecency = (a: SourceRow, b: SourceRow) => (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0) || a.externalId.localeCompare(b.externalId);

type EvidenceCandidate = { source: SourceRow; role: EvidenceRole };

async function collectCandidates(findingId: string): Promise<EvidenceCandidate[]> {
  const db = getDb();
  const [f] = await db.select().from(schema.finding).where(eq(schema.finding.id, findingId)).limit(1);
  if (!f) throw new AppError("NOT_FOUND", `Finding ${findingId} not found`);

  const lines = await db.select().from(schema.findingLine).where(eq(schema.findingLine.findingId, findingId));
  const dealIds = [...new Set(lines.map((l) => l.dealId).filter((d): d is string => d !== null))];

  const [deals, orders, contracts, customerSources] = await Promise.all([
    dealIds.length ? db.select({ s: schema.deal.sourceRecordId }).from(schema.deal).where(inArray(schema.deal.id, dealIds)) : [],
    dealIds.length ? db.select({ s: schema.salesOrder.sourceRecordId }).from(schema.salesOrder).where(inArray(schema.salesOrder.dealId, dealIds)) : [],
    db.select({ s: schema.contract.sourceRecordId }).from(schema.contract).where(eq(schema.contract.customerId, f.customerId)),
    db.select().from(schema.sourceRecord).where(eq(schema.sourceRecord.customerId, f.customerId)),
  ]);

  const structuralIds = [
    ...deals.map((r) => r.s),
    ...lines.map((l) => l.sourceRecordId).filter((s): s is string => s !== null),
    ...orders.map((r) => r.s),
    ...contracts.map((r) => r.s),
  ];
  const structural = structuralIds.length ? await db.select().from(schema.sourceRecord).where(inArray(schema.sourceRecord.id, [...new Set(structuralIds)])) : [];

  const out: EvidenceCandidate[] = [];
  for (const source of structural.sort((a, b) => a.externalId.localeCompare(b.externalId))) {
    const role = roleOfSource(source.system, source.recordType, source.title);
    if (role) out.push({ source, role });
  }

  const signalCaps: Partial<Record<EvidenceRole, number>> = {
    usage_signal: MAX_USAGE_EVIDENCE,
    dispute_signal: MAX_DISPUTE_EVIDENCE,
    context: MAX_CONTEXT_EVIDENCE,
  };
  const taken: Partial<Record<EvidenceRole, number>> = {};
  for (const source of [...customerSources].sort(byRecency)) {
    const role = roleOfSource(source.system, source.recordType, source.title);
    const cap = role ? signalCaps[role] : undefined;
    if (!role || cap === undefined) continue;
    if ((taken[role] ?? 0) >= cap) continue;
    taken[role] = (taken[role] ?? 0) + 1;
    out.push({ source, role });
  }
  return out;
}

/** Evidence for a finding in stable citation order (role, then source id); this order defines [E1]..[En]. */
export async function loadEvidence(findingId: string): Promise<EvidenceDTO[]> {
  const rows = await getDb()
    .select({ e: schema.evidence, s: schema.sourceRecord })
    .from(schema.evidence)
    .innerJoin(schema.sourceRecord, eq(schema.sourceRecord.id, schema.evidence.sourceRecordId))
    .where(eq(schema.evidence.findingId, findingId))
    .orderBy(asc(schema.evidence.createdAt));
  return rows
    .map(({ e, s }) => ({ id: e.id, role: e.role, quote: e.quote, verified: e.verified, source: toSourceRef(s) }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.source.externalId.localeCompare(b.source.externalId) || a.id.localeCompare(b.id));
}


/**
 * Collects and persists the evidence rows for a finding (idempotent: existing rows keep their ids so citations stay valid),
 * then returns the full list. Quotes are deterministic per FAST_PLAN §5; `verified` means the quote appears verbatim in body_text.
 */
export async function gatherEvidence(findingId: string): Promise<EvidenceDTO[]> {
  const db = getDb();
  const candidates = await collectCandidates(findingId);
  const existing = await db.select().from(schema.evidence).where(eq(schema.evidence.findingId, findingId));
  const existingByKey = new Map(existing.map((e) => [`${e.sourceRecordId}|${e.role}`, e]));

  for (const { source, role } of candidates) {
    const picked = pickQuote(quoteCandidates(role, source.recordType, source.raw, source.title), source.bodyText);
    if (!picked) continue;
    const prior = existingByKey.get(`${source.id}|${role}`);
    if (!prior) {
      await db.insert(schema.evidence).values({ findingId, sourceRecordId: source.id, role, quote: picked.quote, verified: picked.verified });
    } else if (prior.quote !== picked.quote || prior.verified !== picked.verified) {
      await db.update(schema.evidence).set({ quote: picked.quote, verified: picked.verified }).where(eq(schema.evidence.id, prior.id));
    }
  }
  return loadEvidence(findingId);
}

async function upsertEligibility(findingId: string, checks: EligibilityCheckDTO[]): Promise<boolean> {
  const db = getDb();
  const prior = await db.select().from(schema.eligibilityCheck).where(eq(schema.eligibilityCheck.findingId, findingId));
  const priorByRule = new Map(prior.map((p) => [p.ruleId, p]));
  let changed = prior.length !== checks.length;
  for (const c of checks) {
    const p = priorByRule.get(c.ruleId);
    if (!p || p.outcome !== c.outcome || p.detail !== c.detail || p.name !== c.name) changed = true;
    await db
      .insert(schema.eligibilityCheck)
      .values({ findingId, ruleId: c.ruleId, name: c.name, outcome: c.outcome, detail: c.detail })
      .onConflictDoUpdate({
        target: [schema.eligibilityCheck.findingId, schema.eligibilityCheck.ruleId],
        set: { name: c.name, outcome: c.outcome, detail: c.detail, evaluatedAt: new Date() },
      });
  }
  return changed;
}

async function insertFinding(customerId: string, isFixture: boolean, d: DetectedFinding, status: FindingStatus, reason: string): Promise<string> {
  const db = getDb();
  const deals = await db.select().from(schema.deal).where(eq(schema.deal.customerId, customerId));
  const dealIdByExternal = new Map(deals.map((x) => [x.externalId, x.id]));
  const lineItems = await db.select().from(schema.dealLineItem).where(inArray(schema.dealLineItem.dealId, deals.map((x) => x.id)));
  const sourceByLine = new Map(lineItems.map((l) => [l.externalId, l.sourceRecordId]));

  const findingId = crypto.randomUUID();
  await db
    .insert(schema.finding)
    .values({
      id: findingId,
      customerId,
      kind: d.kind,
      status,
      title: d.title,
      amountCents: d.amountCents,
      calculation: d.calculation,
      calcHash: d.calculation.calcHash,
      decisionReason: reason,
      isFixture,
    });

  if (d.lines.length) {
    await db.insert(schema.findingLine).values(
      d.lines.map((l) => ({
        findingId,
        dealId: dealIdByExternal.get(l.dealExternalId) ?? null,
        description: l.description,
        quantity: l.quantity,
        unitAmountCents: l.unitAmountCents,
        amountCents: l.amountCents,
        sourceRecordId: sourceByLine.get(l.lineExternalId) ?? null,
      })),
    );
  }
  return findingId;
}

type Outcome = "created" | "updated" | "unchanged";

async function detectForCustomer(customerId: string): Promise<Outcome> {
  const db = getDb();
  const facts = await loadCustomerFacts(customerId);
  const detected = detectWonNotBilled(facts);
  if (!detected) return "unchanged";

  const [cust] = await db.select({ isFixture: schema.customer.isFixture }).from(schema.customer).where(eq(schema.customer.id, customerId)).limit(1);
  const checks = evaluateEligibility(facts, detected, { amountCapCents: invoiceCapCents() });
  const decision = decide(checks);

  const [existing] = await db
    .select()
    .from(schema.finding)
    .where(and(eq(schema.finding.customerId, customerId), eq(schema.finding.kind, detected.kind), eq(schema.finding.calcHash, detected.calculation.calcHash)))
    .limit(1);

  const findingId = existing?.id ?? (await insertFinding(customerId, cust?.isFixture ?? false, detected, decision.status, decision.reason));
  const evidenceRows = await gatherEvidence(findingId);
  const eligibilityChanged = await upsertEligibility(findingId, checks);
  const score = evidenceScore(evidenceRows.map((e) => e.role), checks);

  if (!existing) {
    await db.update(schema.finding).set({ evidenceScore: score }).where(eq(schema.finding.id, findingId));
    await recordAudit({
      actorType: "system",
      actor: "detector",
      kind: "recommendation",
      action: "finding.detected",
      summary: `${facts.name}: ${detected.title} (${decision.status.replace(/_/g, " ")})`,
      subjectType: "finding",
      subjectId: findingId,
      externalRef: null,
      data: { customerId, amountCents: detected.amountCents, calcHash: detected.calculation.calcHash, status: decision.status, reason: decision.reason, evidenceScore: score, evidenceCount: evidenceRows.length },
    });
    return "created";
  }

  const recompute = RECOMPUTABLE.includes(existing.status);
  const nextStatus = recompute ? decision.status : existing.status;
  const nextReason = recompute ? decision.reason : existing.decisionReason;
  const changed = eligibilityChanged || existing.evidenceScore !== score || existing.status !== nextStatus || existing.decisionReason !== nextReason;
  if (!changed) return "unchanged";

  await db.update(schema.finding).set({ evidenceScore: score, status: nextStatus, decisionReason: nextReason, updatedAt: new Date() }).where(eq(schema.finding.id, findingId));
  await recordAudit({
    actorType: "system",
    actor: "detector",
    kind: "info",
    action: "finding.redetected",
    summary: `${facts.name}: re-evaluated ${detected.title}`,
    subjectType: "finding",
    subjectId: findingId,
    externalRef: null,
    data: { previousStatus: existing.status, status: nextStatus, evidenceScore: score, reason: nextReason },
  });
  return "updated";
}

/** Runs the deterministic won-not-billed detector over every active and churned customer. Idempotent. */
export async function runDetection(): Promise<{ created: number; updated: number; unchanged: number }> {
  const db = getDb();
  const customers = await db
    .select({ id: schema.customer.id })
    .from(schema.customer)
    .where(inArray(schema.customer.status, ["active", "churned"]))
    .orderBy(asc(schema.customer.eraAccountId));

  const tally = { created: 0, updated: 0, unchanged: 0 };
  for (const c of customers) tally[await detectForCustomer(c.id)] += 1;

  await recordAudit({
    actorType: "system",
    actor: "detector",
    kind: "info",
    action: "detect.completed",
    summary: `Scanned ${customers.length} customers: ${tally.created} new, ${tally.updated} updated, ${tally.unchanged} unchanged`,
    subjectType: "system",
    subjectId: null,
    externalRef: null,
    data: { customers: customers.length, ...tally },
  });
  return tally;
}
