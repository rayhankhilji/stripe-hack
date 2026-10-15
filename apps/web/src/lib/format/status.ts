// One vocabulary for every status enum in the contracts. Several enums share values
// ("approved", "rejected", "sent_simulated"); they share meaning too, so one map covers them.
export type StatusTone = "neutral" | "petal" | "punch" | "signal" | "lemon" | "lime" | "muted";

type StatusMeta = { label: string; tone: StatusTone; live?: boolean };

const STATUS: Record<string, StatusMeta> = {
  // finding
  detected: { label: "Detected", tone: "petal" },
  analyzing: { label: "Investigating", tone: "petal", live: true },
  needs_review: { label: "Needs review", tone: "neutral" },
  escalated: { label: "Escalated", tone: "punch" },
  ready_for_approval: { label: "Ready for approval", tone: "lemon" },
  approved: { label: "Approved", tone: "signal" },
  invoiced: { label: "Invoiced", tone: "signal", live: true },
  recovered: { label: "Recovered", tone: "lime" },
  rejected: { label: "Rejected", tone: "muted" },
  failed: { label: "Failed", tone: "punch" },
  // invoice
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Open", tone: "signal" },
  paid: { label: "Paid", tone: "lime" },
  void: { label: "Void", tone: "muted" },
  uncollectible: { label: "Uncollectible", tone: "punch" },
  // outbox / reminders / expansion
  pending_approval: { label: "Pending approval", tone: "lemon" },
  sent_simulated: { label: "Sent (sandbox)", tone: "lime" },
  suppressed: { label: "Suppressed", tone: "muted" },
  scheduled: { label: "Scheduled", tone: "neutral" },
  drafted: { label: "Drafted", tone: "petal" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS[status] ?? { label: status.replaceAll("_", " "), tone: "neutral" };
}
