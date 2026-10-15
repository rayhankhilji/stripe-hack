import type { AuditEventDTO, EraSystem, FindingStatus, FindingSummaryDTO, OverviewDTO } from "@ghost/shared";

// Pure view-model helpers for the workspace. Everything here is derived from API data; nothing is invented.

/** An audit event younger than this counts as "Ghost is working right now". */
export const LIVE_WINDOW_MS = 20_000;

/** Statuses from which the analyze workflow may (re)start (FAST_PLAN §6). */
const ANALYZABLE: readonly FindingStatus[] = ["detected", "needs_review", "failed"];

export type Phase =
  | { kind: "first_run" } // nothing ingested yet
  | { kind: "no_findings" } // data synced, detector has not found anything (or not run)
  | { kind: "investigate"; finding: FindingSummaryDTO }
  | { kind: "analyzing"; finding: FindingSummaryDTO }
  | { kind: "approve"; finding: FindingSummaryDTO }
  | { kind: "awaiting_payment"; finding: FindingSummaryDTO }
  | { kind: "recovered"; finding: FindingSummaryDTO }
  | { kind: "review"; finding: FindingSummaryDTO };

export function totalRecords(overview: OverviewDTO): number {
  return overview.systemsConnected.reduce((sum, s) => sum + s.records, 0);
}

export function hasData(overview: OverviewDTO): boolean {
  return totalRecords(overview) > 0 || overview.topFindings.length > 0;
}

/** The finding the agent panel focuses on: an in-flight case first, then the highest-value actionable one. */
export function focusFinding(findings: FindingSummaryDTO[]): FindingSummaryDTO | null {
  const order: FindingStatus[] = [
    "analyzing",
    "approved",
    "ready_for_approval",
    "detected",
    "needs_review",
    "failed",
    "invoiced",
    "escalated",
    "recovered",
  ];
  for (const status of order) {
    const match = findings.find((f) => f.status === status);
    if (match) return match;
  }
  return findings[0] ?? null;
}

export function isAnalyzable(f: FindingSummaryDTO): boolean {
  return ANALYZABLE.includes(f.status);
}

/** What Ghost recommends next, given what the overview says. */
export function derivePhase(overview: OverviewDTO): Phase {
  if (!hasData(overview)) return { kind: "first_run" };
  const finding = focusFinding(overview.topFindings);
  if (!finding) return { kind: "no_findings" };
  switch (finding.status) {
    case "analyzing":
      return { kind: "analyzing", finding };
    case "ready_for_approval":
      return { kind: "approve", finding };
    case "approved":
    case "invoiced":
      return { kind: "awaiting_payment", finding };
    case "recovered":
      return { kind: "recovered", finding };
    case "detected":
    case "needs_review":
    case "failed":
      return { kind: "investigate", finding };
    case "escalated":
    case "rejected":
      return { kind: "review", finding };
  }
}

/** True while the newest audit event is fresh, i.e. a workflow is visibly producing activity. */
export function isLive(events: AuditEventDTO[], now: number): boolean {
  const newest = newestEvent(events);
  if (!newest) return false;
  return now - Date.parse(newest.occurredAt) < LIVE_WINDOW_MS;
}

export function newestEvent(events: AuditEventDTO[]): AuditEventDTO | null {
  let newest: AuditEventDTO | null = null;
  for (const e of events) {
    if (!newest || Date.parse(e.occurredAt) > Date.parse(newest.occurredAt)) newest = e;
  }
  return newest;
}

/**
 * The events of the current (or most recent) investigation: the focus case's events when it has any, else the newest event's subject and every event
 * about the same subject, newest first. Falls back to the latest events when the subject is not a finding.
 */
export function currentInvestigation(events: AuditEventDTO[], limit: number, focusId: string | null = null): AuditEventDTO[] {
  const sorted = [...events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const focused = focusId ? sorted.filter((e) => e.subjectType === "finding" && e.subjectId === focusId) : [];
  if (focused.length > 0) return focused.slice(0, limit);
  const anchor = sorted.find((e) => e.subjectType === "finding" && e.subjectId !== null);
  if (!anchor) return sorted.slice(0, limit);
  const sameCase = sorted.filter((e) => e.subjectType === anchor.subjectType && e.subjectId === anchor.subjectId);
  return sameCase.slice(0, limit);
}

/** Subject id of the newest finding-scoped event, used to title the stream ("Investigating Tidewater Capital"). */
export function investigatedFindingId(events: AuditEventDTO[]): string | null {
  const sorted = [...events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  return sorted.find((e) => e.subjectType === "finding")?.subjectId ?? null;
}

/** Finding titles may lead with the customer name, which the UI already shows beside them. */
export function caseTitle(title: string, customerName: string): string {
  let t = title;
  while (t.startsWith(`${customerName}: `)) t = t.slice(customerName.length + 2);
  return t;
}

/** Collapses a doubled leading label ("Acme: Acme: 2 deals") into one. */
export function dedupeLead(title: string): string {
  const i = title.indexOf(": ");
  if (i <= 0) return title;
  const lead = title.slice(0, i + 2);
  let t = title;
  while (t.startsWith(lead + lead)) t = t.slice(lead.length);
  return t;
}

export function systemRecords(overview: OverviewDTO, system: EraSystem): { records: number; lastSyncedAt: string | null } {
  const hit = overview.systemsConnected.find((s) => s.system === system);
  return { records: hit?.records ?? 0, lastSyncedAt: hit?.lastSyncedAt ?? null };
}
