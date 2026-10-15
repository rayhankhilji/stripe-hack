import { formatMoneyShort as formatCents } from "../../lib/format/money";
import type { Phase } from "./derive";

export type Brief = {
  eyebrow: string;
  headline: string;
  detail: string;
  /** Where the recommended next step lives, when it is a link rather than an agent action. */
  href: string | null;
  cta: string | null;
};

/** The sentence Ghost leads with: what it found, and what should happen next. Built only from real fields. */
export function briefFor(phase: Phase): Brief {
  switch (phase.kind) {
    case "first_run":
      return {
        eyebrow: "Not connected",
        headline: "Connect your systems and Ghost starts looking.",
        detail: "Ghost reads every system of record, then reconciles what was sold against what was billed.",
        href: null,
        cta: null,
      };
    case "no_findings":
      return {
        eyebrow: "Synced",
        headline: "Every record is in. Time to hunt for leaks.",
        detail: "The detector checks each closed-won deal for an activated order or an existing invoice.",
        href: null,
        cta: null,
      };
    case "investigate": {
      const f = phase.finding;
      return {
        eyebrow: "Opportunity found",
        headline: `${formatCents(f.amountCents)} at ${f.customerName} was earned but never billed.`,
        detail: `${f.evidenceCount} ${f.evidenceCount === 1 ? "piece" : "pieces"} of evidence so far. Investigate to verify the evidence and check all ten eligibility rules.`,
        href: null,
        cta: null,
      };
    }
    case "analyzing":
      return {
        eyebrow: "Investigating",
        headline: `Reading the evidence for ${phase.finding.customerName}.`,
        detail: "Each step below is written to the audit trail as it happens.",
        href: `/recovery/${phase.finding.id}`,
        cta: "Open case",
      };
    case "approve": {
      const f = phase.finding;
      return {
        eyebrow: "Ready for you",
        headline: `${formatCents(f.amountCents)} for ${f.customerName} is verified and waiting on your approval.`,
        detail: "Nothing is invoiced until you approve. Approval creates a Stripe test-mode invoice.",
        href: `/recovery/${f.id}`,
        cta: "Review & approve",
      };
    }
    case "awaiting_payment": {
      const f = phase.finding;
      return {
        eyebrow: f.status === "approved" ? "Invoicing" : "Awaiting payment",
        headline:
          f.status === "approved"
            ? `Creating the Stripe invoice for ${f.customerName}.`
            : `${formatCents(f.amountCents)} invoiced to ${f.customerName}.`,
        detail: "Ghost marks the case recovered only when Stripe's signed webhook confirms payment.",
        href: `/recovery/${f.id}`,
        cta: "Open invoice",
      };
    }
    case "recovered": {
      const f = phase.finding;
      return {
        eyebrow: "Recovered",
        headline: `${formatCents(f.amountCents)} recovered from ${f.customerName}.`,
        detail: "Payment verified by Stripe webhook. Collection reminders were suppressed.",
        href: `/recovery/${f.id}`,
        cta: "View case",
      };
    }
    case "review": {
      const f = phase.finding;
      return {
        eyebrow: f.status === "escalated" ? "Escalated" : "Closed",
        headline:
          f.status === "escalated"
            ? `${f.customerName} has a dispute on record, so Ghost will not invoice it.`
            : `The ${f.customerName} case was rejected.`,
        detail: "See the case for the rules and evidence behind this decision.",
        href: `/recovery/${f.id}`,
        cta: "Open case",
      };
    }
  }
}
