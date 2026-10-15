import { describe, expect, it } from "vitest";
import type { AuditEventDTO, FindingSummaryDTO } from "@ghost/shared";
import { countByGroup, inGroup, rankFindings } from "./queue-model";
import { agentSteps, paymentVerification, resolveCitation } from "./case-model";
import { parseInline, parseMarkdown } from "./markdown";

const summary = (over: Partial<FindingSummaryDTO>): FindingSummaryDTO => ({
  id: "00000000-0000-4000-8000-000000000001",
  customerId: "00000000-0000-4000-8000-0000000000c1",
  customerName: "Customer",
  kind: "won_not_billed",
  status: "ready_for_approval",
  title: "Closed-won, never billed",
  amountCents: 100,
  evidenceScore: 50,
  evidenceCount: 1,
  failingRules: [],
  isFixture: false,
  updatedAt: "2026-10-15T10:00:00.000Z",
  ...over,
});

const audit = (over: Partial<AuditEventDTO>): AuditEventDTO => ({
  id: "00000000-0000-4000-8000-0000000000a1",
  occurredAt: "2026-10-15T10:00:00.000Z",
  actorType: "agent",
  actor: "ghost",
  kind: "info",
  action: "finding.detected",
  summary: "",
  subjectType: "finding",
  subjectId: null,
  externalRef: null,
  data: {},
  ...over,
});

describe("rankFindings", () => {
  it("orders by amount × evidence score, then amount", () => {
    const a = summary({ id: "a", amountCents: 7_220_000, evidenceScore: 80 });
    const b = summary({ id: "b", amountCents: 10_000_000, evidenceScore: 40 });
    const c = summary({ id: "c", amountCents: 5_776_000, evidenceScore: 100 });
    expect(rankFindings([b, c, a]).map((f) => f.id)).toEqual(["a", "c", "b"]);
  });
});

describe("queue groups", () => {
  it("counts each finding in All plus exactly one status group", () => {
    const items = [summary({ status: "approved" }), summary({ status: "invoiced" }), summary({ status: "rejected" })];
    expect(countByGroup(items)).toMatchObject({ all: 3, invoiced: 2, ready: 0, recovered: 0 });
    expect(inGroup("failed", "review")).toBe(true);
  });
});

describe("case model", () => {
  it("maps [En] to citedEvidenceIds by position and rejects unknown citations", () => {
    const ev = { id: "e2", role: "commitment" as const, quote: "q", verified: true, source: {} as never };
    expect(resolveCitation(2, ["e1", "e2"], [ev])).toBe(ev);
    expect(resolveCitation(1, ["e1", "e2"], [ev])).toBeNull();
    expect(resolveCitation(3, ["e1", "e2"], [ev])).toBeNull();
  });

  it("lists agent steps in time order", () => {
    const steps = agentSteps([
      audit({ id: "2", action: "agent.step.explain", occurredAt: "2026-10-15T10:00:02.000Z", summary: "Explain" }),
      audit({ id: "x", action: "finding.detected" }),
      audit({ id: "1", action: "agent.step.loadFacts", occurredAt: "2026-10-15T10:00:01.000Z", summary: "Load", kind: "error" }),
    ]);
    expect(steps.map((s) => [s.id, s.state])).toEqual([
      ["1", "error"],
      ["2", "done"],
    ]);
  });

  it("reads the Stripe event id only from the verified outcome event", () => {
    expect(paymentVerification([audit({ kind: "info", externalRef: "evt_1" })])).toBeNull();
    const v = paymentVerification([
      audit({ kind: "outcome_verified", action: "webhook.invoice.paid", actorType: "stripe", externalRef: "evt_123" }),
    ]);
    expect(v).toMatchObject({ via: "webhook", eventId: "evt_123" });
    const api = paymentVerification([
      audit({ kind: "outcome_verified", action: "invoice.refreshed", actorType: "system", externalRef: "in_9" }),
    ]);
    expect(api).toMatchObject({ via: "stripe_api", eventId: null });
  });
});

describe("markdown", () => {
  it("parses citations and emphasis inline", () => {
    expect(parseInline("Won **$51,500** deal [E1].")).toEqual([
      { type: "text", text: "Won " },
      { type: "strong", text: "$51,500" },
      { type: "text", text: " deal " },
      { type: "cite", n: 1 },
      { type: "text", text: "." },
    ]);
  });

  it("splits headings, paragraphs and lists", () => {
    const blocks = parseMarkdown("## Why\nTwo deals\nclosed.\n\n- one [E1]\n- two\n\n1. first");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list"]);
    expect(blocks[2]).toMatchObject({ ordered: false });
    expect(blocks[3]).toMatchObject({ ordered: true });
  });
});
