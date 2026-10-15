import { z } from "zod";
import { formatCents, type EligibilityCheckDTO, type FindingDetailDTO } from "@ghost/shared";
import type { KnowledgeHit } from "@ghost/knowledge";
import { generateStructured, llmEnabled, TEMPLATE_MODEL } from "../models";
import { loadPrompt } from "../prompts";
import { templateDraft } from "./template";
import { allowedAmounts, validateDraft, type Draft } from "./validate";

export type Explanation = Draft & { model: string; promptVersion: string; validated: boolean; attempts: number; problems: string[] };

const DraftSchema = z.object({ summary: z.string(), bodyMd: z.string(), citedEvidenceIds: z.array(z.string()) });

function caseJson(f: FindingDetailDTO, checks: EligibilityCheckDTO[], decision: { status: string; reason: string }, context: KnowledgeHit[]) {
  return JSON.stringify({
    customer: f.customerName,
    title: f.title,
    decision,
    calculation: {
      formula: f.calculation.formula,
      total: formatCents(f.calculation.totalCents),
      steps: f.calculation.steps.map((s) => ({ label: s.label, amount: formatCents(s.amountCents) })),
      inputs: f.calculation.inputs,
    },
    lines: f.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitAmount: formatCents(l.unitAmountCents), amount: formatCents(l.amountCents), deal: l.dealExternalId })),
    evidence: f.evidence.map((e, i) => ({ label: `E${i + 1}`, id: e.id, role: e.role, system: e.source.system, record: `${e.source.recordType} ${e.source.externalId}`, title: e.source.title, quote: e.quote, verified: e.verified })),
    eligibility: checks,
    backgroundContext: context.slice(0, 3).map((h) => h.text.slice(0, 400)),
  });
}

/** LLM explanation validated against evidence ids and calculation amounts; one repair retry, then the deterministic template. */
export async function explainFinding(f: FindingDetailDTO, checks: EligibilityCheckDTO[], decision: { status: string; reason: string }, context: KnowledgeHit[]): Promise<Explanation> {
  const ids = f.evidence.map((e) => e.id);
  const allowed = allowedAmounts(f.calculation, f.lines);
  const problems: string[] = [];
  let attempts = 0;
  if (llmEnabled()) {
    const prompt = loadPrompt("explain-finding");
    let userPrompt = caseJson(f, checks, decision, context);
    for (attempts = 1; attempts <= 2; attempts++) {
      try {
        const { output, model } = await generateStructured({ instructions: prompt.text, prompt: userPrompt, schema: DraftSchema });
        const v = validateDraft(output, ids, allowed);
        if (v.ok) return { ...v.value, model, promptVersion: prompt.version, validated: true, attempts, problems };
        problems.push(...v.problems);
        userPrompt = `${userPrompt}\n\nYour previous draft failed validation. Fix exactly these problems and return the full JSON again:\n- ${v.problems.join("\n- ")}`;
      } catch (err) {
        problems.push(`llm error: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
    }
  }
  const draft = templateDraft(f, checks, decision, allowed);
  const v = validateDraft(draft, ids, allowed);
  const value = v.ok ? v.value : draft;
  if (!v.ok) problems.push(...v.problems);
  return { ...value, model: TEMPLATE_MODEL, promptVersion: TEMPLATE_MODEL, validated: v.ok, attempts, problems };
}
