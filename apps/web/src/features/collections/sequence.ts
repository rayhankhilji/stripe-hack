import type { CollectionItemDTO } from "@ghost/shared";

export type StepState = "done" | "current" | "upcoming" | "drafted" | "suppressed" | "unscheduled";

export type SequenceStep = {
  key: "sent" | "reminder-1" | "due" | "reminder-2" | "escalate";
  label: string;
  state: StepState;
  detail: string;
};

type Reminder = CollectionItemDTO["reminders"][number];

const SUPPRESSED_DEFAULT = "Suppressed: paid via webhook";

function reminderStep(key: SequenceStep["key"], label: string, step: number, reminders: Reminder[]): SequenceStep {
  const r = reminders.find((x) => x.step === step);
  if (!r) return { key, label, state: "unscheduled", detail: "Not scheduled" };
  switch (r.status) {
    case "scheduled":
      return { key, label, state: "upcoming", detail: `Scheduled ${r.scheduledFor}` };
    case "drafted":
      return { key, label, state: "drafted", detail: "Draft awaiting approval in outbox" };
    case "sent_simulated":
      return { key, label, state: "done", detail: "Delivered to sandbox" };
    case "suppressed":
      return { key, label, state: "suppressed", detail: r.suppressedReason ?? SUPPRESSED_DEFAULT };
    case "cancelled":
      return { key, label, state: "suppressed", detail: r.suppressedReason ?? "Cancelled" };
  }
}

function dueDetail(item: CollectionItemDTO): string {
  const { invoice, daysOverdue } = item;
  if (invoice.status === "paid") return `Paid ${invoice.paidAt ?? ""}`.trim();
  if (daysOverdue > 0) return `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`;
  if (daysOverdue === 0) return "Due today";
  const left = -daysOverdue;
  return `Due in ${left} day${left === 1 ? "" : "s"}`;
}

/** Derives the five-step track from the collection item alone; nothing is invented. */
export function deriveSequence(item: CollectionItemDTO): SequenceStep[] {
  const { invoice, daysOverdue, reminders } = item;
  const sent: SequenceStep = {
    key: "sent",
    label: "Invoice sent",
    state: invoice.status === "draft" ? "upcoming" : "done",
    detail: invoice.number ? `Invoice ${invoice.number}` : "Finalized in Stripe",
  };
  const due: SequenceStep = {
    key: "due",
    label: "Due",
    state: invoice.status === "paid" || daysOverdue >= 0 ? "done" : "upcoming",
    detail: dueDetail(item),
  };
  const steps = [
    sent,
    reminderStep("reminder-1", "Reminder 1", 1, reminders),
    due,
    reminderStep("reminder-2", "Reminder 2", 2, reminders),
    reminderStep("escalate", "Escalate", 3, reminders),
  ];
  const current = steps.findIndex((s) => s.state === "upcoming" || s.state === "drafted");
  if (current === -1) return steps;
  return steps.map((s, i) => (i === current && s.state === "upcoming" ? { ...s, state: "current" as const } : s));
}

export const NEXT_ACTION_LABEL: Record<CollectionItemDTO["nextAction"], string> = {
  none: "No action needed",
  send_reminder: "Send reminder",
  escalate_dispute: "Escalate: dispute on record",
  await_payment: "Awaiting payment",
  suppressed_paid: "Reminders suppressed: paid",
};
