import { describe, expect, it } from "vitest";
import { allowedAmounts, amountProblems, validateDraft } from "../src/explain/validate";
import { loadPrompt } from "../src/prompts";

const calc = {
  version: "won-not-billed@1",
  formula: "Σ closed-won line items without activated order or invoice",
  inputs: [],
  steps: [{ label: "deal-127", amountCents: 5_150_000 }, { label: "deal-23", amountCents: 1_100_000 }, { label: "deal-24", amountCents: 970_000 }],
  totalCents: 7_220_000,
  calcHash: "h",
};
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];

describe("explanation validator", () => {
  const allowed = allowedAmounts(calc, []);
  it("accepts calculation amounts and renumbers citations by first use", () => {
    const v = validateDraft({ summary: "Owed $72,200.00.", bodyMd: "Deal $51,500 [E2], contract [E1].", citedEvidenceIds: [ids[1]!, ids[0]!] }, ids, allowed);
    expect(v.ok && v.value).toEqual({ summary: "Owed $72,200.00.", bodyMd: "Deal $51,500 [E1], contract [E2].", citedEvidenceIds: [ids[1], ids[0]] });
  });
  it("rejects invented, abbreviated amounts and unknown citations", () => {
    expect(amountProblems("about $72k", allowed)).toHaveLength(1);
    expect(amountProblems("$72,201", allowed)).toHaveLength(1);
    const v = validateDraft({ summary: "x", bodyMd: "see [E3]", citedEvidenceIds: ["33333333-3333-4333-8333-333333333333"] }, ids, allowed);
    expect(v.ok).toBe(false);
  });
  it("loads versioned prompts", () => {
    expect(loadPrompt("explain-finding").version).toBe("explain-finding@1");
  });
});
