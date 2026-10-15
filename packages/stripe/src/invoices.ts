import type Stripe from "stripe";
import { AppError, assertCents, sumCents } from "@ghost/shared";
import { callStripe, getStripe } from "./client";

export type InvoiceStatusValue = "draft" | "open" | "paid" | "void" | "uncollectible";

/** The invoice-table columns that Stripe is authoritative for (mirrors @ghost/db schema.invoice). */
export type InvoiceRowPatch = {
  status: InvoiceStatusValue;
  amountDueCents: number;
  amountPaidCents: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  number: string | null;
  dueDate: Date | null;
  paidAt: Date | null;
  lines: { description: string; amountCents: number; quantity: number }[];
};

export type FindingInvoiceInput = {
  findingId: string;
  stripeCustomerId: string;
  idempotencyKey: string;
  daysUntilDue: number;
  lines: { description: string; amountCents: number; dealExternalId: string }[];
};

const CURRENCY = "usd";

/**
 * Creates a send_invoice invoice in three idempotent steps: draft → one invoice item per line
 * (attached via `invoice`) → finalize. Each call has its own key suffix so a retry after a partial
 * failure replays the completed steps and resumes at the failed one.
 */
export async function createFindingInvoice(input: FindingInvoiceInput): Promise<Stripe.Invoice> {
  if (input.lines.length === 0) throw new AppError("VALIDATION", "invoice needs at least one line");
  for (const l of input.lines) {
    if (assertCents(l.amountCents) <= 0) throw new AppError("VALIDATION", `line amount must be positive: ${l.description}`);
  }
  const expectedCents = sumCents(input.lines.map((l) => l.amountCents));
  const dealIds = [...new Set(input.lines.map((l) => l.dealExternalId))];
  const stripe = getStripe();
  const key = input.idempotencyKey;

  const draft = await callStripe("invoices.create", () =>
    stripe.invoices.create(
      {
        customer: input.stripeCustomerId,
        collection_method: "send_invoice",
        days_until_due: input.daysUntilDue,
        currency: CURRENCY,
        // Ghost finalizes explicitly; nothing advances or emails on Stripe's schedule.
        auto_advance: false,
        pending_invoice_items_behavior: "exclude",
        description: "Closed-won revenue not yet billed (recovered by Ghost)",
        metadata: { ghost_finding_id: input.findingId, ghost_deal_ids: dealIds.join(",") },
      },
      { idempotencyKey: `${key}:inv` },
    ),
  );

  for (const [i, line] of input.lines.entries()) {
    await callStripe("invoiceItems.create", () =>
      stripe.invoiceItems.create(
        {
          customer: input.stripeCustomerId,
          invoice: draft.id,
          amount: line.amountCents,
          currency: CURRENCY,
          description: line.description,
          metadata: { ghost_finding_id: input.findingId, ghost_deal_id: line.dealExternalId },
        },
        { idempotencyKey: `${key}:item:${i}` },
      ),
    );
  }

  const finalized = await callStripe("invoices.finalizeInvoice", () =>
    stripe.invoices.finalizeInvoice(draft.id, { auto_advance: false }, { idempotencyKey: `${key}:fin` }),
  );
  if (finalized.amount_due !== expectedCents) {
    throw new AppError("UPSTREAM_STRIPE", "Stripe invoice total does not match the approved amount", {
      stripeInvoiceId: finalized.id,
      expectedCents,
      amountDueCents: finalized.amount_due,
    });
  }
  return finalized;
}

export async function fetchInvoice(stripeInvoiceId: string): Promise<Stripe.Invoice> {
  const stripe = getStripe();
  return callStripe("invoices.retrieve", () => stripe.invoices.retrieve(stripeInvoiceId));
}

const KNOWN_STATUSES: readonly string[] = ["draft", "open", "paid", "void", "uncollectible"];

function toStatus(inv: Stripe.Invoice): InvoiceStatusValue {
  const s = inv.status;
  if (s && KNOWN_STATUSES.includes(s)) return s as InvoiceStatusValue;
  throw new AppError("UPSTREAM_STRIPE", `unexpected Stripe invoice status: ${String(s)}`, { stripeInvoiceId: inv.id });
}

const fromUnix = (s: number | null | undefined): Date | null => (s ? new Date(s * 1000) : null);

/** Maps a Stripe invoice onto Ghost's invoice row. Since API basil, `status` is the paid signal (no `paid` boolean). */
export function toInvoiceRow(inv: Stripe.Invoice): InvoiceRowPatch {
  return {
    status: toStatus(inv),
    amountDueCents: assertCents(inv.amount_due),
    amountPaidCents: assertCents(inv.amount_paid),
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    invoicePdf: inv.invoice_pdf ?? null,
    number: inv.number,
    dueDate: fromUnix(inv.due_date),
    paidAt: fromUnix(inv.status_transitions.paid_at),
    // Ghost invoices carry a handful of lines; the first page of the embedded list (10) covers them.
    lines: inv.lines.data.map((l) => ({
      description: l.description ?? "",
      amountCents: assertCents(l.amount),
      quantity: l.quantity ?? 1,
    })),
  };
}
