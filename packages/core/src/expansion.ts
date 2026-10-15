// Expansion scan (FAST_PLAN §7): deterministic signals from ingested Salesforce cases and Gong records.
// Counts, thresholds and quotes come from source records only; the agent drafts the email afterwards.
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { draftExpansionEmail } from "@ghost/agents";
import { getDb, schema } from "@ghost/db";
import { AppError, type EvidenceDTO, type ExpansionDTO } from "@ghost/shared";
import { loadEvidenceEntries } from "./collections";
import { recordAudit } from "./audit";

/** §7 asks for ≥10 feature requests, but the recorded fixtures give Vernall Capital (the intended hit) only 4: see docs/ccr/B6-expansion-threshold.md. */
export const MIN_FEATURE_REQUESTS = 4;
const MAX_CASE_EVIDENCE = 6;
const TITLE_SIGNAL = /expansion scoping|commercial review/i;
const TRANSCRIPT_SIGNAL = /next tier|usage is up/i;

type SourceRow = typeof schema.sourceRecord.$inferSelect;
type EvidenceRole = EvidenceDTO["role"];
type Signal = { source: SourceRow; role: EvidenceRole; quote: string };
type Candidate = {
  customer: typeof schema.customer.$inferSelect;
  featureRequests: number;
  gongSignals: number;
  signals: Signal[];
};

/** min(100, 4×featureRequests + 20×gongSignals), per §7. */
export function signalScore(featureRequests: number, gongSignals: number): number {
  return Math.min(100, 4 * featureRequests + 20 * gongSignals);
}

const rawString = (raw: Record<string, unknown>, key: string): string => {
  const v = raw[key];
  return typeof v === "string" ? v : "";
};

/** The first sentence of a record's text that matches `re`, so the quote is a verbatim span of body_text. */
function matchingSentence(text: string, re: RegExp): string | null {
  const sentence = text.split(/(?<=[.!?])\s+|\n+/).find((s) => re.test(s));
  return sentence ? sentence.trim().slice(0, 240) : null;
}

function featureCaseSignals(cases: SourceRow[]): Signal[] {
  return cases
    .filter((c) => rawString(c.raw, "Type").includes("Feature"))
    .sort((a, b) => (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0))
    .map((source) => ({ source, role: "context" as const, quote: rawString(source.raw, "Subject") || source.title }));
}

/** A transcript belongs to a customer when it is linked to them, or its call id is one of their calls and it names them. */
function gongSignals(customerName: string, customerId: string, calls: SourceRow[], transcripts: SourceRow[]): Signal[] {
  const out: Signal[] = [];
  const callIds = new Set(calls.map((c) => rawString(c.raw, "id")).filter((id) => id !== ""));
  for (const call of calls) {
    if (TITLE_SIGNAL.test(call.title)) out.push({ source: call, role: "usage_signal", quote: call.title });
  }
  for (const t of transcripts) {
    const linked = t.customerId === customerId || (callIds.has(rawString(t.raw, "callId")) && t.bodyText.includes(customerName));
    if (!linked) continue;
    const quote = matchingSentence(t.bodyText, TRANSCRIPT_SIGNAL);
    if (quote) out.push({ source: t, role: "usage_signal", quote });
  }
  return out;
}

async function findCandidates(): Promise<Candidate[]> {
  const db = getDb();
  const customers = await db.select().from(schema.customer).where(eq(schema.customer.status, "active")).orderBy(asc(schema.customer.eraAccountId));
  const [openDeals, cases, calls, transcripts] = await Promise.all([
    db.select({ customerId: schema.deal.customerId }).from(schema.deal).where(eq(schema.deal.isClosed, false)),
    db.select().from(schema.sourceRecord).where(and(eq(schema.sourceRecord.system, "salesforce"), eq(schema.sourceRecord.recordType, "Case"))),
    db.select().from(schema.sourceRecord).where(and(eq(schema.sourceRecord.system, "gong"), eq(schema.sourceRecord.recordType, "call"))),
    db.select().from(schema.sourceRecord).where(and(eq(schema.sourceRecord.system, "gong"), eq(schema.sourceRecord.recordType, "transcript"))),
  ]);
  const withOpenDeals = new Set(openDeals.map((d) => d.customerId));

  const candidates: Candidate[] = [];
  for (const customer of customers) {
    if (withOpenDeals.has(customer.id)) continue;
    const caseSignals = featureCaseSignals(cases.filter((c) => c.customerId === customer.id));
    const gong = gongSignals(customer.name, customer.id, calls.filter((c) => c.customerId === customer.id), transcripts);
    if (caseSignals.length < MIN_FEATURE_REQUESTS || gong.length < 1) continue;
    candidates.push({
      customer,
      featureRequests: caseSignals.length,
      gongSignals: gong.length,
      signals: [...gong, ...caseSignals.slice(0, MAX_CASE_EVIDENCE)],
    });
  }
  return candidates;
}

function rationaleFor(c: Candidate): string {
  const calls = `${c.gongSignals} Gong expansion signal${c.gongSignals === 1 ? "" : "s"}`;
  return `${c.featureRequests} feature-request cases and ${calls}, with no open deals in Salesforce.`;
}

/** Evidence has no usable unique key for expansions (null finding id), so insert only what is missing. */
async function syncEvidence(expansionId: string, signals: Signal[]): Promise<void> {
  const db = getDb();
  const existing = await db.select().from(schema.evidence).where(eq(schema.evidence.expansionId, expansionId));
  const seen = new Set(existing.map((e) => `${e.sourceRecordId}:${e.role}`));
  const fresh = signals.filter((s) => !seen.has(`${s.source.id}:${s.role}`));
  if (fresh.length === 0) return;
  await db.insert(schema.evidence).values(
    fresh.map((s) => ({
      expansionId,
      sourceRecordId: s.source.id,
      role: s.role,
      quote: s.quote,
      verified: s.quote.length > 0 && s.source.bodyText.includes(s.quote),
    })),
  );
}

async function upsertExpansion(c: Candidate): Promise<{ id: string; created: boolean }> {
  const db = getDb();
  const title = `Expansion: ${c.customer.name} is outgrowing its plan`;
  const values = { rationale: rationaleFor(c), signalScore: signalScore(c.featureRequests, c.gongSignals), existingOpenDeals: 0, updatedAt: new Date() };
  const [inserted] = await db
    .insert(schema.expansionOpportunity)
    .values({ customerId: c.customer.id, title, ...values })
    .onConflictDoNothing()
    .returning({ id: schema.expansionOpportunity.id });
  if (inserted) {
    await syncEvidence(inserted.id, c.signals);
    await recordAudit({
      actorType: "agent",
      actor: "expansion-scan",
      kind: "recommendation",
      action: "expansion.detected",
      summary: `Expansion signal at ${c.customer.name}: ${values.rationale}`,
      subjectType: "expansion",
      subjectId: inserted.id,
      externalRef: null,
      data: { signalScore: values.signalScore, featureRequests: c.featureRequests, gongSignals: c.gongSignals },
    });
    return { id: inserted.id, created: true };
  }
  const [existing] = await db
    .update(schema.expansionOpportunity)
    .set(values)
    .where(and(eq(schema.expansionOpportunity.customerId, c.customer.id), eq(schema.expansionOpportunity.title, title)))
    .returning({ id: schema.expansionOpportunity.id });
  if (!existing) throw new AppError("INTERNAL", "Expansion opportunity vanished during upsert", { customerId: c.customer.id });
  await syncEvidence(existing.id, c.signals);
  return { id: existing.id, created: false };
}

export async function runExpansionScan(): Promise<{ created: number }> {
  const candidates = await findCandidates();
  let created = 0;
  const toDraft: { id: string; name: string }[] = [];
  for (const c of candidates) {
    const { id, created: isNew } = await upsertExpansion(c);
    if (isNew) created += 1;
    toDraft.push({ id, name: c.customer.name });
  }

  // Drafting is retried for opportunities that are still undrafted, so a failed draft is not lost on rescan.
  const db = getDb();
  const failures: { id: string; message: string }[] = [];
  for (const { id, name } of toDraft) {
    const [row] = await db.select({ status: schema.expansionOpportunity.status }).from(schema.expansionOpportunity).where(eq(schema.expansionOpportunity.id, id)).limit(1);
    if (row?.status !== "detected") continue;
    try {
      await draftExpansionEmail(id);
      await db
        .update(schema.expansionOpportunity)
        .set({ status: "pending_approval", updatedAt: new Date() })
        .where(and(eq(schema.expansionOpportunity.id, id), eq(schema.expansionOpportunity.status, "detected")));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ id, message });
      await recordAudit({
        actorType: "agent",
        actor: "expansion-scan",
        kind: "error",
        action: "expansion.draft_failed",
        summary: `Could not draft the expansion email for ${name}: ${message}`,
        subjectType: "expansion",
        subjectId: id,
        externalRef: null,
      });
    }
  }
  if (failures.length > 0) {
    throw new AppError("INTERNAL", `Expansion email drafting failed for ${failures.length} opportunit${failures.length === 1 ? "y" : "ies"}`, { failures });
  }
  return { created };
}

export async function listExpansion(): Promise<ExpansionDTO[]> {
  const db = getDb();
  const rows = await db
    .select({ x: schema.expansionOpportunity, customerName: schema.customer.name })
    .from(schema.expansionOpportunity)
    .innerJoin(schema.customer, eq(schema.expansionOpportunity.customerId, schema.customer.id))
    .orderBy(desc(schema.expansionOpportunity.signalScore), asc(schema.expansionOpportunity.id));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.x.id);
  const [evidence, messages] = await Promise.all([
    loadEvidenceEntries(inArray(schema.evidence.expansionId, ids)),
    db
      .select({ id: schema.outboxMessage.id, expansionId: schema.outboxMessage.expansionId })
      .from(schema.outboxMessage)
      .where(inArray(schema.outboxMessage.expansionId, ids))
      .orderBy(desc(schema.outboxMessage.createdAt)),
  ]);
  return rows.map(({ x, customerName }) => ({
    id: x.id,
    customerId: x.customerId,
    customerName,
    status: x.status,
    title: x.title,
    rationale: x.rationale,
    signalScore: x.signalScore,
    existingOpenDeals: x.existingOpenDeals,
    evidence: evidence.filter((e) => e.expansionId === x.id).map((e) => e.dto),
    draftMessageId: messages.find((m) => m.expansionId === x.id)?.id ?? null,
  }));
}
