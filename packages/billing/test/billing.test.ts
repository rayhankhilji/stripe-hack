import { describe, expect, it } from "vitest";
import { RULE_IDS, type EligibilityCheckDTO } from "@ghost/shared";
import {
  calcHash,
  decide,
  detectWonNotBilled,
  evaluateEligibility,
  evidenceScore,
  invoiceIdempotencyKey,
  type CustomerFacts,
  type DetectedFinding,
} from "../src";
import { factsFromFixtures } from "./fixture-facts";

const POLICY = { amountCapCents: 25_000_000 }; // $250,000

function outcome(checks: EligibilityCheckDTO[], id: string) {
  return checks.find((c) => c.ruleId === id)?.outcome;
}

function mustDetect(f: CustomerFacts): DetectedFinding {
  const d = detectWonNotBilled(f);
  if (!d) throw new Error("expected a finding");
  return d;
}

describe("Tidewater Capital (acct-6, recorded fixtures)", () => {
  const facts = factsFromFixtures("acct-6");
  const finding = mustDetect(facts);
  const checks = evaluateEligibility(facts, finding, POLICY);

  it("detects $72,200 across the 4 closed-won lines with draft orders", () => {
    expect(finding.kind).toBe("won_not_billed");
    expect(finding.amountCents).toBe(7_220_000);
    expect(finding.calculation.totalCents).toBe(7_220_000);
    expect(finding.lines.map((l) => [l.dealExternalId, l.lineExternalId, l.amountCents])).toEqual([
      ["deal-127", "oli-deal-127-0", 1_640_000],
      ["deal-127", "oli-deal-127-1", 3_510_000],
      ["deal-23", "oli-deal-23-0", 1_100_000],
      ["deal-24", "oli-deal-24-0", 970_000],
    ]);
    expect(finding.calculation.steps.reduce((n, s) => n + s.amountCents, 0)).toBe(7_220_000);
    expect(finding.calculation.calcHash).toMatch(/^[0-9a-f]{64}$/);
    // The open renewal deal-22 is not closed-won and must not be billed.
    expect(finding.lines.some((l) => l.dealExternalId === "deal-22")).toBe(false);
  });

  it("evaluates all ten rules; only R-10 warns (contract In Approval Process)", () => {
    expect(checks.map((c) => c.ruleId)).toEqual([...RULE_IDS]);
    expect(checks.filter((c) => c.outcome !== "pass").map((c) => [c.ruleId, c.outcome])).toEqual([["R-10", "warn"]]);
    expect(checks.find((c) => c.ruleId === "R-10")?.detail).toContain("contract-4 In Approval Process");
  });

  it("is ready for human approval and names the warning", () => {
    const decision = decide(checks);
    expect(decision.status).toBe("ready_for_approval");
    expect(decision.reason).toContain("R-10 Contract activated");
  });

  it("is deterministic: same facts in a different order give the same finding and hash", () => {
    const shuffled: CustomerFacts = { ...facts, deals: [...facts.deals].reverse().map((d) => ({ ...d, lines: [...d.lines].reverse() })) };
    expect(detectWonNotBilled(shuffled)).toEqual(finding);
  });
});

describe("eligibility outcomes", () => {
  const base = factsFromFixtures("acct-6");

  it("churned customer → R-07 fail → needs_review", () => {
    const f: CustomerFacts = { ...base, status: "churned" };
    const checks = evaluateEligibility(f, mustDetect(f), POLICY);
    expect(outcome(checks, "R-07")).toBe("fail");
    const decision = decide(checks);
    expect(decision.status).toBe("needs_review");
    expect(decision.reason).toContain("R-07 Customer is active");
  });

  it("dispute on record → R-06 fail → escalated, even with other failures", () => {
    const f: CustomerFacts = { ...base, status: "churned", signals: { ...base.signals, dispute: 1 } };
    const checks = evaluateEligibility(f, mustDetect(f), POLICY);
    expect(outcome(checks, "R-06")).toBe("fail");
    expect(decide(checks).status).toBe("escalated");
  });

  it("line items that do not sum to the deal amount → R-03 fail", () => {
    const f: CustomerFacts = { ...base, deals: base.deals.map((d) => (d.externalId === "deal-127" ? { ...d, amountCents: 5_150_001 } : d)) };
    const checks = evaluateEligibility(f, mustDetect(f), POLICY);
    expect(outcome(checks, "R-03")).toBe("fail");
    expect(checks.find((c) => c.ruleId === "R-03")?.detail).toContain("deal-127");
    expect(decide(checks).status).toBe("needs_review");
  });

  it("amount above the policy cap → R-09 fail", () => {
    const checks = evaluateEligibility(base, mustDetect(base), { amountCapCents: 7_219_999 });
    expect(outcome(checks, "R-09")).toBe("fail");
    expect(outcome(evaluateEligibility(base, mustDetect(base), { amountCapCents: 7_220_000 }), "R-09")).toBe("pass");
  });

  it("R-10: Activated contract passes, only Expired fails, none warns", () => {
    const withStatus = (status: string): CustomerFacts => ({ ...base, contracts: base.contracts.map((c) => ({ ...c, status })) });
    expect(outcome(evaluateEligibility(withStatus("Activated"), mustDetect(base), POLICY), "R-10")).toBe("pass");
    expect(outcome(evaluateEligibility(withStatus("Expired"), mustDetect(base), POLICY), "R-10")).toBe("fail");
    expect(outcome(evaluateEligibility({ ...base, contracts: [] }, mustDetect(base), POLICY), "R-10")).toBe("warn");
  });

  it("R-01 warns with a single system and R-08 warns with no usage", () => {
    const f: CustomerFacts = { ...base, identitySystems: ["salesforce"], signals: { usage: 0, dispute: 0 } };
    const checks = evaluateEligibility(f, mustDetect(f), POLICY);
    expect(outcome(checks, "R-01")).toBe("warn");
    expect(outcome(checks, "R-08")).toBe("warn");
    expect(decide(checks).status).toBe("ready_for_approval");
  });

  it("an incomplete rule set never reaches approval", () => {
    const checks = evaluateEligibility(base, mustDetect(base), POLICY).filter((c) => c.ruleId !== "R-05");
    expect(decide(checks).status).toBe("needs_review");
  });
});

describe("detector exclusions", () => {
  const base = factsFromFixtures("acct-6");

  it("activated orders on every won deal → no finding", () => {
    const f: CustomerFacts = { ...base, orders: base.orders.map((o) => ({ ...o, status: "Activated" })) };
    expect(detectWonNotBilled(f)).toBeNull();
  });

  it("an activated order on one deal removes only that deal", () => {
    const f: CustomerFacts = { ...base, orders: base.orders.map((o) => (o.dealExternalId === "deal-127" ? { ...o, status: "Activated" } : o)) };
    expect(mustDetect(f).amountCents).toBe(2_070_000);
  });

  it("deals already invoiced are excluded", () => {
    const f: CustomerFacts = { ...base, invoicedDealExternalIds: ["deal-23", "deal-24"] };
    const d = mustDetect(f);
    expect(d.amountCents).toBe(5_150_000);
    expect(detectWonNotBilled({ ...base, invoicedDealExternalIds: ["deal-127", "deal-23", "deal-24"] })).toBeNull();
  });
});

describe("evidenceScore", () => {
  const passAll: EligibilityCheckDTO[] = RULE_IDS.map((ruleId) => ({ ruleId, name: ruleId, outcome: "pass", detail: "" }));

  it("is a bounded integer that rewards corroboration and penalises disputes and failures", () => {
    const full = evidenceScore(["commitment", "contract_term", "billing_state", "usage_signal", "context"], passAll);
    expect(full).toBe(100);
    const thin = evidenceScore(["commitment"], passAll);
    expect(thin).toBeLessThan(full);
    const failed = passAll.map((c) => (c.ruleId === "R-07" ? { ...c, outcome: "fail" as const } : c));
    expect(evidenceScore(["commitment"], failed)).toBeLessThan(thin);
    expect(evidenceScore(["commitment", "dispute_signal"], passAll)).toBeLessThan(thin);
    expect(evidenceScore(["dispute_signal"], [])).toBe(0);
    expect(evidenceScore(["commitment", "commitment"], passAll)).toBe(thin);
  });
});

describe("calcHash and invoiceIdempotencyKey", () => {
  it("calcHash is stable across key order at every depth", () => {
    const a = calcHash({ total: 7_220_000, lines: [{ deal: "deal-23", amount: 1_100_000 }], meta: { v: 1, acct: "acct-6" } });
    const b = calcHash({ meta: { acct: "acct-6", v: 1 }, lines: [{ amount: 1_100_000, deal: "deal-23" }], total: 7_220_000 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("calcHash changes with values and array order, ignores undefined members", () => {
    const base = calcHash({ lines: [1, 2], total: 3 });
    expect(calcHash({ lines: [2, 1], total: 3 })).not.toBe(base);
    expect(calcHash({ lines: [1, 2], total: 4 })).not.toBe(base);
    expect(calcHash({ lines: [1, 2], total: 3, note: undefined })).toBe(base);
    expect(calcHash({ cents: 5n })).toBe(calcHash({ cents: 5 }));
  });

  it("calcHash rejects values with no canonical encoding", () => {
    expect(() => calcHash({ x: Number.NaN })).toThrow();
    expect(() => calcHash({ x: () => 1 })).toThrow();
    expect(() => calcHash(new Map())).toThrow();
  });

  it("idempotency key follows ghost-inv-<finding>-<hash16>", () => {
    const hash = calcHash({ a: 1 });
    expect(invoiceIdempotencyKey("f-1", hash)).toBe(`ghost-inv-f-1-${hash.slice(0, 16)}`);
    expect(() => invoiceIdempotencyKey("f-1", "short")).toThrow();
  });
});
