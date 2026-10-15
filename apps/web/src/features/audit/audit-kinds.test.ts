import { describe, expect, it } from "vitest";
import type { AuditEventDTO } from "@ghost/shared";
import { countByKind, filterByKinds } from "./audit-kinds";

const ev = (id: string, kind: AuditEventDTO["kind"]): AuditEventDTO => ({
  id,
  occurredAt: "2026-10-15T10:00:00.000Z",
  actorType: "agent",
  actor: "ghost",
  kind,
  action: "finding.detected",
  summary: "s",
  subjectType: "finding",
  subjectId: null,
  externalRef: null,
  data: {},
});

describe("audit kinds", () => {
  const items = [ev("1", "recommendation"), ev("2", "outcome_verified"), ev("3", "recommendation")];

  it("returns everything when no kind is selected", () => {
    expect(filterByKinds(items, new Set())).toHaveLength(3);
  });

  it("filters to the selected kinds", () => {
    expect(filterByKinds(items, new Set(["outcome_verified"])).map((e) => e.id)).toEqual(["2"]);
  });

  it("counts every kind, including zeros", () => {
    const counts = countByKind(items);
    expect(counts.recommendation).toBe(2);
    expect(counts.error).toBe(0);
  });
});
