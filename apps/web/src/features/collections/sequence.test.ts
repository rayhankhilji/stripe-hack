import { describe, expect, it } from "vitest";
import type { CollectionItemDTO } from "@ghost/shared";
import { deriveSequence } from "./sequence";

const ID = "00000000-0000-4000-8000-000000000001";

function item(over: Partial<CollectionItemDTO> & { status?: "open" | "paid" }): CollectionItemDTO {
  return {
    invoice: {
      id: ID,
      stripeInvoiceId: "in_test",
      number: "GHOST-0001",
      status: over.status ?? "open",
      amountDueCents: 7_220_000,
      amountPaidCents: 0,
      currency: "usd",
      hostedInvoiceUrl: null,
      invoicePdf: null,
      dueDate: null,
      paidAt: null,
      lines: [],
      customerName: "Tidewater Capital",
      findingId: null,
      lastSyncedAt: null,
    },
    daysOverdue: -5,
    nextAction: "await_payment",
    disputeSignals: [],
    reminders: [
      { id: ID, step: 1, status: "scheduled", scheduledFor: "2026-10-20", suppressedReason: null },
      { id: ID, step: 2, status: "scheduled", scheduledFor: "2026-10-30", suppressedReason: null },
      { id: ID, step: 3, status: "scheduled", scheduledFor: "2026-11-05", suppressedReason: null },
    ],
    ...over,
  };
}

describe("deriveSequence", () => {
  it("marks the first pending step current and leaves later steps upcoming", () => {
    const steps = deriveSequence(item({}));
    expect(steps.map((s) => s.state)).toEqual(["done", "current", "upcoming", "upcoming", "upcoming"]);
  });

  it("strikes every open reminder with the webhook reason after payment", () => {
    const reminders = [1, 2, 3].map((step) => ({
      id: ID,
      step,
      status: "suppressed" as const,
      scheduledFor: "2026-10-20",
      suppressedReason: "Suppressed: paid via webhook",
    }));
    const steps = deriveSequence(item({ status: "paid", reminders, nextAction: "suppressed_paid", daysOverdue: -2 }));
    expect(steps.filter((s) => s.state === "suppressed")).toHaveLength(3);
    expect(steps.find((s) => s.key === "due")?.state).toBe("done");
    expect(steps.find((s) => s.key === "reminder-1")?.detail).toBe("Suppressed: paid via webhook");
  });

  it("reports missing reminders as unscheduled rather than inventing them", () => {
    const steps = deriveSequence(item({ reminders: [] }));
    expect(steps.find((s) => s.key === "reminder-2")?.state).toBe("unscheduled");
  });

  it("shows overdue days on the due step", () => {
    const steps = deriveSequence(item({ daysOverdue: 3 }));
    expect(steps.find((s) => s.key === "due")).toMatchObject({ state: "done", detail: "3 days overdue" });
  });
});
