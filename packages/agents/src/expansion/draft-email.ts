import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { AppError, type OutboxMessageDTO } from "@ghost/shared";
import { recordAudit } from "@ghost/core";
import { getDb, schema } from "@ghost/db";
import { generateStructured, llmEnabled, TEMPLATE_MODEL } from "../models";
import { loadPrompt } from "../prompts";

type Signal = { id: string; system: string; recordType: string; externalId: string; title: string; quote: string };

const EmailSchema = z.object({ subject: z.string(), bodyMd: z.string(), citedEvidenceIds: z.array(z.string()) });
// The draft never discusses commercial terms: any money, percentage or pricing language rejects it.
const PRICING = /[$€£]|\d+(\.\d+)?\s?%|\b(discount\w*|pric\w*|cost\w*|credit\w*|rebate\w*|free|complimentary|\d+\s?(usd|dollars?))\b/i;

function toDto(m: typeof schema.outboxMessage.$inferSelect): OutboxMessageDTO {
  return {
    id: m.id, kind: m.kind, status: m.status, toAddress: m.toAddress, originalRecipient: m.originalRecipient, subject: m.subject, bodyMd: m.bodyMd,
    createdAt: m.createdAt.toISOString(), decidedAt: m.decidedAt ? m.decidedAt.toISOString() : null, relatedHref: "/expansion",
  };
}

function templateEmail(customer: string, signals: Signal[]) {
  const cases = signals.filter((s) => s.system === "salesforce");
  const calls = signals.filter((s) => s.system === "gong");
  const lines = [`Hi ${customer} team,`, ""];
  if (cases.length) lines.push(`Your team has shared ${cases.length} feature requests with us recently${cases[0] ? `, including "${cases[0].title}"` : ""}. Thank you — that kind of detail shapes what we build.`, "");
  if (calls[0]) lines.push(`Following our "${calls[0].title}" conversation, it sounds like the next tier could be a good fit for where your usage is heading.`, "");
  lines.push("Would you have 30 minutes next week to scope what that would look like for your team?", "", "Best,", "The Sapora Networks team");
  return { subject: `${customer}: scoping your next tier`, bodyMd: lines.join("\n"), citedEvidenceIds: [...cases.slice(0, 1), ...calls.slice(0, 1)].map((s) => s.id) };
}

function validEmail(e: z.infer<typeof EmailSchema>, ids: Set<string>): string[] {
  const p: string[] = [];
  if (PRICING.test(e.subject) || PRICING.test(e.bodyMd)) p.push("mentions pricing, money or discounts");
  if (!e.citedEvidenceIds.length) p.push("cites no signals");
  for (const id of e.citedEvidenceIds) if (!ids.has(id)) p.push(`unknown signal id ${id}`);
  return p;
}

/** Drafts an expansion email into the approval-gated outbox (sandbox recipient). Idempotent per expansion. */
export async function draftExpansionEmail(expansionId: string): Promise<OutboxMessageDTO> {
  const db = getDb();
  const existing = await db.select().from(schema.outboxMessage).where(and(eq(schema.outboxMessage.expansionId, expansionId), ne(schema.outboxMessage.status, "rejected"))).limit(1);
  if (existing[0]) return toDto(existing[0]);

  const [row] = await db
    .select({ exp: schema.expansionOpportunity, customer: schema.customer })
    .from(schema.expansionOpportunity)
    .innerJoin(schema.customer, eq(schema.customer.id, schema.expansionOpportunity.customerId))
    .where(eq(schema.expansionOpportunity.id, expansionId));
  if (!row) throw new AppError("NOT_FOUND", `expansion ${expansionId} not found`);

  const signals: Signal[] = await db
    .select({ id: schema.evidence.id, system: schema.sourceRecord.system, recordType: schema.sourceRecord.recordType, externalId: schema.sourceRecord.externalId, title: schema.sourceRecord.title, quote: schema.evidence.quote })
    .from(schema.evidence)
    .innerJoin(schema.sourceRecord, eq(schema.sourceRecord.id, schema.evidence.sourceRecordId))
    .where(eq(schema.evidence.expansionId, expansionId));
  const ids = new Set(signals.map((s) => s.id));

  let email = templateEmail(row.customer.name, signals);
  let model = TEMPLATE_MODEL;
  let problems: string[] = [];
  if (llmEnabled() && signals.length) {
    const prompt = loadPrompt("expansion-email");
    const input = JSON.stringify({ customer: row.customer.name, title: row.exp.title, rationale: row.exp.rationale, signals: signals.slice(0, 20).map((s) => ({ id: s.id, kind: `${s.system} ${s.recordType}`, title: s.title, quote: s.quote.slice(0, 240) })) });
    try {
      const { output, model: used } = await generateStructured({ instructions: prompt.text, prompt: input, schema: EmailSchema });
      const cleaned = { ...output, bodyMd: output.bodyMd.replace(/\s?\[E\d+\]/g, "") };
      problems = validEmail(cleaned, ids);
      if (!problems.length) {
        email = cleaned;
        model = `${used} · ${prompt.version}`;
      }
    } catch (err) {
      problems = [`llm error: ${err instanceof Error ? err.message : String(err)}`];
    }
  }

  const cited = signals.filter((s) => email.citedEvidenceIds.includes(s.id));
  const footer = cited.length ? `\n\n---\n_Reviewer note · signals cited: ${cited.map((s) => `${s.system} ${s.recordType} ${s.externalId} “${s.title}”`).join("; ")}_` : "";
  const domain = process.env.OUTBOX_SANDBOX_DOMAIN ?? "sandbox.ghost.test";
  const [msg] = await db
    .insert(schema.outboxMessage)
    .values({ kind: "expansion_email", status: "pending_approval", toAddress: `growth+${row.customer.eraAccountId}@${domain}`, originalRecipient: row.customer.billingEmail, subject: email.subject, bodyMd: email.bodyMd + footer, expansionId })
    .returning();
  if (!msg) throw new AppError("INTERNAL", "outbox insert returned no row");
  await db.update(schema.expansionOpportunity).set({ status: "pending_approval", updatedAt: new Date() }).where(eq(schema.expansionOpportunity.id, expansionId));
  await recordAudit({
    actorType: "agent", actor: "ghost-growth", kind: "approval_pending", action: "agent.expansion.drafted",
    summary: `Drafted expansion email for ${row.customer.name}; awaiting approval (sandbox delivery only)`,
    subjectType: "outbox", subjectId: msg.id, externalRef: null,
    data: { expansionId, model, citedEvidenceIds: email.citedEvidenceIds, problems },
  });
  return toDto(msg);
}
