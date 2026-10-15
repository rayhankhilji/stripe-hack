import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { AppError } from "@ghost/shared";
import { createFindingInvoice, getStripe, toInvoiceRow } from "../src/index";

// Unit tests stub the Stripe HTTP surface; the live sequence is exercised by scripts/smoke (test mode).
const TEST_KEY = "sk_test_unit";

function invoiceFixture(over: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  return {
    id: "in_test_1",
    object: "invoice",
    status: "open",
    amount_due: 5_150_000,
    amount_paid: 0,
    hosted_invoice_url: "https://invoice.stripe.com/i/test",
    invoice_pdf: "https://pay.stripe.com/invoice/test/pdf",
    number: "GHOST-0001",
    due_date: 1_760_000_000,
    status_transitions: { finalized_at: 1_759_000_000, paid_at: null, voided_at: null, marked_uncollectible_at: null },
    lines: {
      object: "list",
      data: [
        { amount: 1_640_000, description: "Platform", quantity: 1 },
        { amount: 3_510_000, description: "Seats", quantity: null },
      ],
      has_more: false,
      url: "/v1/invoices/in_test_1/lines",
    },
    ...over,
  } as unknown as Stripe.Invoice;
}

describe("assertTestMode via getStripe", () => {
  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });
  it("blocks live keys", () => {
    process.env.STRIPE_SECRET_KEY = ["sk", "live", "abc"].join("_");
    expect(() => getStripe()).toThrowError(expect.objectContaining({ code: "POLICY_BLOCKED" }) as AppError);
  });
  it("blocks a missing key", () => {
    expect(() => getStripe()).toThrowError(expect.objectContaining({ code: "POLICY_BLOCKED" }) as AppError);
  });
  it("pins the API version", () => {
    process.env.STRIPE_SECRET_KEY = TEST_KEY;
    expect(getStripe().getApiField("version")).toBe("2026-09-30.endive");
  });
});

describe("createFindingInvoice", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = TEST_KEY;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
  });

  const input = {
    findingId: "f-1",
    stripeCustomerId: "cus_1",
    idempotencyKey: "ghost-inv-f-1-abcdef0123456789",
    daysUntilDue: 30,
    lines: [
      { description: "Platform", amountCents: 1_640_000, dealExternalId: "deal-127" },
      { description: "Seats", amountCents: 3_510_000, dealExternalId: "deal-127" },
    ],
  };

  it("drafts, attaches each line by invoice id, finalizes, with per-step idempotency keys", async () => {
    const stripe = getStripe();
    const create = vi.spyOn(stripe.invoices, "create").mockResolvedValue(invoiceFixture({ status: "draft" }) as never);
    const item = vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue({ id: "ii_1" } as never);
    const fin = vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(invoiceFixture() as never);

    const out = await createFindingInvoice(input);

    expect(out.id).toBe("in_test_1");
    const [createParams, createOpts] = create.mock.calls[0] ?? [];
    expect(createParams).toMatchObject({
      customer: "cus_1",
      collection_method: "send_invoice",
      days_until_due: 30,
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      metadata: { ghost_finding_id: "f-1", ghost_deal_ids: "deal-127" },
    });
    expect(createOpts).toEqual({ idempotencyKey: `${input.idempotencyKey}:inv` });
    expect(item.mock.calls.map((c) => [c[0]?.invoice, c[0]?.amount, c[1]?.idempotencyKey])).toEqual([
      ["in_test_1", 1_640_000, `${input.idempotencyKey}:item:0`],
      ["in_test_1", 3_510_000, `${input.idempotencyKey}:item:1`],
    ]);
    expect(fin.mock.calls[0]?.[2]).toEqual({ idempotencyKey: `${input.idempotencyKey}:fin` });
  });

  it("refuses a finalized total that differs from the approved lines", async () => {
    const stripe = getStripe();
    vi.spyOn(stripe.invoices, "create").mockResolvedValue(invoiceFixture({ status: "draft" }) as never);
    vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue({ id: "ii_1" } as never);
    vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(invoiceFixture({ amount_due: 1 }) as never);
    await expect(createFindingInvoice(input)).rejects.toMatchObject({ code: "UPSTREAM_STRIPE" });
  });

  it("rejects non-positive or fractional amounts before calling Stripe", async () => {
    const create = vi.spyOn(getStripe().invoices, "create");
    await expect(
      createFindingInvoice({ ...input, lines: [{ description: "x", amountCents: 10.5, dealExternalId: "d" }] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createFindingInvoice({ ...input, lines: [] })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("toInvoiceRow", () => {
  it("maps an open invoice", () => {
    const row = toInvoiceRow(invoiceFixture());
    expect(row).toMatchObject({ status: "open", amountDueCents: 5_150_000, amountPaidCents: 0, paidAt: null, number: "GHOST-0001" });
    expect(row.dueDate?.toISOString()).toBe(new Date(1_760_000_000_000).toISOString());
    expect(row.lines).toEqual([
      { description: "Platform", amountCents: 1_640_000, quantity: 1 },
      { description: "Seats", amountCents: 3_510_000, quantity: 1 },
    ]);
  });

  it("uses status and status_transitions.paid_at as the paid signal", () => {
    const paid = invoiceFixture({
      status: "paid",
      amount_paid: 5_150_000,
      status_transitions: { finalized_at: 1, paid_at: 1_760_100_000, voided_at: null, marked_uncollectible_at: null },
    });
    const row = toInvoiceRow(paid);
    expect(row.status).toBe("paid");
    expect(row.amountPaidCents).toBe(5_150_000);
    expect(row.paidAt?.getTime()).toBe(1_760_100_000_000);
  });

  it("rejects an unknown status rather than guessing", () => {
    expect(() => toInvoiceRow(invoiceFixture({ status: null }))).toThrowError(
      expect.objectContaining({ code: "UPSTREAM_STRIPE" }) as AppError,
    );
  });
});
