import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { AppError, EligibilityCheckDTO, EvidenceDTO, InvoiceDTO } from "@ghost/shared";
import { decide, detectWonNotBilled, evaluateEligibility, type CustomerFacts } from "@ghost/billing";
import { gatherEvidence, invoiceFinding, loadCustomerFacts } from "@ghost/core";
import { searchContext, type KnowledgeHit } from "@ghost/knowledge";

// Narrow tools: each wraps exactly one deterministic service. None of them lets a model produce a number.

const Facts = z.custom<CustomerFacts>((v) => typeof v === "object" && v !== null);
const Hit = z.custom<KnowledgeHit>((v) => typeof v === "object" && v !== null);

export const getFactsTool = createTool({
  id: "get-facts",
  description: "Load the customer's commercial facts (deals, lines, orders, contracts, invoices, identities) from Ghost's database.",
  inputSchema: z.object({ customerId: z.string().uuid() }),
  outputSchema: z.object({ facts: Facts }),
  execute: async (input) => ({ facts: await loadCustomerFacts(input.customerId) }),
});

export const getEvidenceTool = createTool({
  id: "get-evidence",
  description: "Gather the finding's evidence records with verbatim quotes.",
  inputSchema: z.object({ findingId: z.string().uuid() }),
  outputSchema: z.object({ evidence: z.array(EvidenceDTO) }),
  execute: async (input) => ({ evidence: await gatherEvidence(input.findingId) }),
});

export const searchContextTool = createTool({
  id: "search-context",
  description: "Search the knowledge graph (Cognee, full-text fallback) for background on a customer.",
  inputSchema: z.object({ customerName: z.string(), question: z.string() }),
  outputSchema: z.object({ hits: z.array(Hit) }),
  execute: async (input) => ({ hits: await searchContext(input.customerName, input.question) }),
});

export const evaluateEligibilityTool = createTool({
  id: "evaluate-eligibility",
  description: "Re-run the deterministic detector and eligibility rules R-01..R-10 on current facts.",
  inputSchema: z.object({ facts: Facts, amountCapCents: z.number().int() }),
  outputSchema: z.object({
    detected: z.object({ amountCents: z.number().int(), calcHash: z.string() }).nullable(),
    checks: z.array(EligibilityCheckDTO),
    decision: z.object({ status: z.enum(["ready_for_approval", "needs_review", "escalated"]), reason: z.string() }),
  }),
  execute: async (input) => {
    const d = detectWonNotBilled(input.facts);
    if (!d) return { detected: null, checks: [], decision: { status: "needs_review" as const, reason: "Detector no longer finds unbilled revenue on current records." } };
    const checks = evaluateEligibility(input.facts, d, { amountCapCents: input.amountCapCents });
    return { detected: { amountCents: d.amountCents, calcHash: d.calculation.calcHash }, checks, decision: decide(checks) };
  },
});

export const invoiceFindingTool = createTool({
  id: "invoice-finding",
  description: "Create the Stripe test-mode invoice for an approved finding.",
  inputSchema: z.object({ findingId: z.string().uuid(), actor: z.string() }),
  outputSchema: z.object({ invoice: InvoiceDTO }),
  execute: async (input) => ({ invoice: await invoiceFinding(input.findingId, input.actor) }),
});

/** Calls a tool directly from a workflow step and surfaces Mastra validation errors as AppError. */
export async function callTool<I, O>(tool: { id: string; execute?: (input: I, ctx: never) => Promise<unknown> }, input: I): Promise<O> {
  if (!tool.execute) throw new AppError("INTERNAL", `tool ${tool.id} has no execute`);
  const out = await tool.execute(input, {} as never);
  if (out && typeof out === "object" && "error" in out && (out as { error: unknown }).error === true) {
    throw new AppError("VALIDATION", `tool ${tool.id} rejected its input`, { tool: tool.id, result: out as Record<string, unknown> });
  }
  return out as O;
}
