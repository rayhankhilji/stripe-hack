import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { AppError, type EligibilityCheckDTO, type EvidenceDTO, type FindingDetailDTO } from "@ghost/shared";
import type { CustomerFacts } from "@ghost/billing";
import { evidenceScore } from "@ghost/billing";
import { getFinding, saveExplanation, setFindingStatus } from "@ghost/core";
import { getDb, schema } from "@ghost/db";
import type { KnowledgeHit } from "@ghost/knowledge";
import { explainFinding, type Explanation } from "../explain/explain";
import { allowedAmounts, validateDraft } from "../explain/validate";
import { callTool, evaluateEligibilityTool, getEvidenceTool, getFactsTool, searchContextTool } from "../tools/finding-tools";
import { AGENT, auditStep } from "./run";

const REANALYZABLE = new Set(["detected", "needs_review", "ready_for_approval", "failed"]);
const DEFAULT_CAP_CENTS = 10_000_000;

type Decision = { status: "ready_for_approval" | "needs_review" | "escalated"; reason: string };
type Ctx = {
  findingId: string;
  finding: FindingDetailDTO;
  facts?: CustomerFacts;
  evidence?: EvidenceDTO[];
  context?: KnowledgeHit[];
  checks?: EligibilityCheckDTO[];
  decision?: Decision;
  explanation?: Explanation;
};
const CtxSchema = z.custom<Ctx>((v) => typeof v === "object" && v !== null);

function need<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new AppError("INTERNAL", `analyze-finding: ${what} missing`);
  return v;
}

const start = createStep({
  id: "start",
  inputSchema: z.object({ findingId: z.string().uuid() }),
  outputSchema: CtxSchema,
  execute: async ({ inputData, runId }) => {
    const finding = await getFinding(inputData.findingId);
    if (!REANALYZABLE.has(finding.status)) throw new AppError("INVALID_STATE", `cannot analyze a finding in status ${finding.status}`, { status: finding.status });
    await setFindingStatus(finding.id, "analyzing", "Agent investigation started", AGENT);
    await getDb().update(schema.finding).set({ workflowRunId: runId }).where(eq(schema.finding.id, finding.id));
    await auditStep(finding.id, "start", `Investigating ${finding.customerName}: ${finding.title}`, { runId });
    return { findingId: finding.id, finding };
  },
});

const loadFacts = createStep({
  id: "load-facts",
  inputSchema: CtxSchema,
  outputSchema: CtxSchema,
  execute: async ({ inputData }) => {
    const { facts } = await callTool<{ customerId: string }, { facts: CustomerFacts }>(getFactsTool, { customerId: inputData.finding.customerId });
    const won = facts.deals.filter((d) => d.isWon).length;
    await auditStep(inputData.findingId, "load-facts", `Loaded ${facts.deals.length} deals (${won} won), ${facts.orders.length} orders, ${facts.contracts.length} contracts across ${facts.identitySystems.length} systems`, {
      deals: facts.deals.map((d) => d.externalId),
      orders: facts.orders.map((o) => `${o.externalId}:${o.status}`),
      systems: facts.identitySystems,
    });
    return { ...inputData, facts };
  },
});

const collectEvidence = createStep({
  id: "gather-evidence",
  inputSchema: CtxSchema,
  outputSchema: CtxSchema,
  execute: async ({ inputData }) => {
    const { evidence } = await callTool<{ findingId: string }, { evidence: EvidenceDTO[] }>(getEvidenceTool, { findingId: inputData.findingId });
    const verified = evidence.filter((e) => e.verified).length;
    const systems = [...new Set(evidence.map((e) => e.source.system))];
    await auditStep(inputData.findingId, "gather-evidence", `Gathered ${evidence.length} evidence records (${verified} verified verbatim) from ${systems.join(", ") || "no systems"}`, { systems, verified });
    return { ...inputData, evidence };
  },
});

const searchKnowledge = createStep({
  id: "search-context",
  inputSchema: CtxSchema,
  outputSchema: CtxSchema,
  execute: async ({ inputData }) => {
    const question = `What was agreed with ${inputData.finding.customerName} and why was it never billed?`;
    try {
      const { hits } = await callTool<{ customerName: string; question: string }, { hits: KnowledgeHit[] }>(searchContextTool, { customerName: inputData.finding.customerName, question });
      const via = hits[0]?.via ?? "none";
      await auditStep(inputData.findingId, "search-context", `Searched company knowledge: ${hits.length} passages via ${via}`, { via, hits: hits.length });
      return { ...inputData, context: hits };
    } catch (err) {
      // Background context is optional; the case stands on cited evidence alone.
      await auditStep(inputData.findingId, "search-context", "Knowledge search unavailable; continuing on evidence only", { error: err instanceof Error ? err.message : String(err) });
      return { ...inputData, context: [] };
    }
  },
});

const checkEligibility = createStep({
  id: "check-eligibility",
  inputSchema: CtxSchema,
  outputSchema: CtxSchema,
  execute: async ({ inputData }) => {
    const cap = Number(process.env.INVOICE_AMOUNT_CAP_CENTS ?? DEFAULT_CAP_CENTS);
    const r = await callTool<unknown, { detected: { amountCents: number; calcHash: string } | null; checks: EligibilityCheckDTO[]; decision: Decision }>(evaluateEligibilityTool, {
      facts: need(inputData.facts, "facts"),
      amountCapCents: Number.isSafeInteger(cap) ? cap : DEFAULT_CAP_CENTS,
    });
    let decision = r.decision;
    if (r.detected && r.detected.calcHash !== inputData.finding.calculation.calcHash) {
      decision = { status: "needs_review", reason: "Source records changed since detection; re-run detection before invoicing." };
    }
    const checks = r.checks.length ? r.checks : inputData.finding.eligibility;
    if (r.checks.length) await persistChecks(inputData.findingId, r.checks, need(inputData.evidence, "evidence"));
    const flagged = checks.filter((c) => c.outcome !== "pass");
    await auditStep(inputData.findingId, "check-eligibility", `Rules: ${checks.length - flagged.length}/${checks.length} pass${flagged.length ? `; ${flagged.map((c) => `${c.ruleId} ${c.outcome}`).join(", ")}` : ""} → ${decision.status}`, { checks: checks.map((c) => ({ ruleId: c.ruleId, outcome: c.outcome })), decision });
    return { ...inputData, checks, decision };
  },
});

async function persistChecks(findingId: string, checks: EligibilityCheckDTO[], evidence: EvidenceDTO[]): Promise<void> {
  const db = getDb();
  for (const c of checks) {
    await db
      .insert(schema.eligibilityCheck)
      .values({ findingId, ruleId: c.ruleId, name: c.name, outcome: c.outcome, detail: c.detail })
      .onConflictDoUpdate({ target: [schema.eligibilityCheck.findingId, schema.eligibilityCheck.ruleId], set: { name: c.name, outcome: c.outcome, detail: c.detail, evaluatedAt: new Date() } });
  }
  const score = evidenceScore(evidence.map((e) => e.role), checks);
  await db.update(schema.finding).set({ evidenceScore: score }).where(and(eq(schema.finding.id, findingId)));
}

const explain = createStep({
  id: "explain",
  inputSchema: CtxSchema,
  outputSchema: CtxSchema,
  execute: async ({ inputData }) => {
    const finding = { ...inputData.finding, evidence: need(inputData.evidence, "evidence") };
    const explanation = await explainFinding(finding, need(inputData.checks, "checks"), need(inputData.decision, "decision"), inputData.context ?? []);
    await auditStep(inputData.findingId, "explain", `Drafted explanation with ${explanation.citedEvidenceIds.length} citations (${explanation.model})`, { model: explanation.model, attempts: explanation.attempts, problems: explanation.problems });
    return { ...inputData, finding, explanation };
  },
});

const validateCitations = createStep({
  id: "validate-citations",
  inputSchema: CtxSchema,
  outputSchema: CtxSchema,
  execute: async ({ inputData }) => {
    const e = need(inputData.explanation, "explanation");
    const ids = inputData.finding.evidence.map((x) => x.id);
    // Re-check the final text: cited ids must be evidence ids and [En] must index citedEvidenceIds.
    const relabeled = e.bodyMd.replace(/\[E(\d+)\]/g, (_, d: string) => {
      const id = e.citedEvidenceIds[Number(d) - 1];
      return id ? `[E${ids.indexOf(id) + 1}]` : "[E0]";
    });
    const v = validateDraft({ ...e, bodyMd: relabeled }, ids, allowedAmounts(inputData.finding.calculation, inputData.finding.lines));
    const validated = e.validated && v.ok;
    await auditStep(inputData.findingId, "validate-citations", validated ? `Validated ${e.citedEvidenceIds.length} citations and every amount against the calculation` : `Explanation failed validation: ${v.ok ? "" : v.problems.join("; ")}`, { validated }, validated ? "info" : "error");
    return { ...inputData, explanation: { ...e, validated } };
  },
});

const save = createStep({
  id: "save",
  inputSchema: CtxSchema,
  outputSchema: z.object({ findingId: z.string(), status: z.string() }),
  execute: async ({ inputData }) => {
    const e = need(inputData.explanation, "explanation");
    const decision = need(inputData.decision, "decision");
    await saveExplanation(inputData.findingId, { summary: e.summary, bodyMd: e.bodyMd, citedEvidenceIds: e.citedEvidenceIds, model: e.model, promptVersion: e.promptVersion, validated: e.validated });
    await setFindingStatus(inputData.findingId, decision.status, decision.reason, AGENT);
    await auditStep(inputData.findingId, "decide", decision.status === "ready_for_approval" ? `Recommend invoicing — awaiting human approval. ${decision.reason}` : `${decision.status.replace("_", " ")}: ${decision.reason}`, { decision }, decision.status === "ready_for_approval" ? "approval_pending" : "recommendation");
    return { findingId: inputData.findingId, status: decision.status };
  },
});

export const analyzeFindingWorkflow = createWorkflow({
  id: "analyze-finding",
  inputSchema: z.object({ findingId: z.string().uuid() }),
  outputSchema: z.object({ findingId: z.string(), status: z.string() }),
})
  .then(start)
  .then(loadFacts)
  .then(collectEvidence)
  .then(searchKnowledge)
  .then(checkEligibility)
  .then(explain)
  .then(validateCitations)
  .then(save)
  .commit();
