import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb, migrate, resetDatabase, schema } from "@ghost/db";
import { getStripe } from "@ghost/stripe";
import { invoiceFinding } from "../src/invoicing";

// Real PGlite + real core services; only Stripe's HTTP surface is stubbed (no network in CI).
let findingId = "";

async function seed(status: "approved" | "ready_for_approval"): Promise<void> {
  const db = getDb();
  const [cust] = await db.insert(schema.customer).values({ eraAccountId: "acct-6", name: "Tidewater Capital" }).returning();
  if (!cust) throw new Error("seed customer");
  const [src] = await db
    .insert(schema.sourceRecord)
    .values({ system: "salesforce", recordType: "Opportunity", externalId: "deal-127", title: "deal-127", raw: {}, contentHash: "x" })
    .returning();
  if (!src) throw new Error("seed source");
  const [deal] = await db
    .insert(schema.deal)
    .values({ customerId: cust.id, externalId: "deal-127", name: "Tidewater", stage: "Closed Won", isClosed: true, isWon: true, amountCents: 5_150_000, sourceRecordId: src.id })
    .returning();
  if (!deal) throw new Error("seed deal");
  const calc = { version: "t", formula: "t", inputs: [], steps: [], totalCents: 5_150_000, calcHash: "abcdef0123456789ff" };
  const [f] = await db
    .insert(schema.finding)
    .values({ customerId: cust.id, kind: "won_not_billed", status, title: "Won, not billed", amountCents: 5_150_000, calculation: calc, calcHash: calc.calcHash })
    .returning();
  if (!f) throw new Error("seed finding");
  await db.insert(schema.findingLine).values([
    { findingId: f.id, dealId: deal.id, description: "Platform", quantity: 1, unitAmountCents: 1_640_000, amountCents: 1_640_000 },
    { findingId: f.id, dealId: deal.id, description: "Seats", quantity: 1, unitAmountCents: 3_510_000, amountCents: 3_510_000 },
  ]);
  findingId = f.id;
}

function stubStripe() {
  const stripe = getStripe();
  const finalized = {
    id: "in_test_inv",
    object: "invoice",
    status: "open",
    currency: "usd",
    amount_due: 5_150_000,
    amount_paid: 0,
    number: "GHOST-0001",
    hosted_invoice_url: "https://invoice.stripe.com/i/test",
    invoice_pdf: null,
    due_date: 1_762_000_000,
    status_transitions: { finalized_at: 1, paid_at: null, voided_at: null, marked_uncollectible_at: null },
    lines: { object: "list", has_more: false, data: [{ amount: 1_640_000, description: "Platform", quantity: 1 }, { amount: 3_510_000, description: "Seats", quantity: 1 }] },
  };
  return {
    customer: vi.spyOn(stripe.customers, "create").mockResolvedValue({ id: "cus_test" } as never),
    create: vi.spyOn(stripe.invoices, "create").mockResolvedValue({ ...finalized, status: "draft" } as never),
    item: vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue({ id: "ii_1" } as never),
    finalize: vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(finalized as never),
  };
}

describe("invoiceFinding", () => {
  beforeAll(async () => {
    process.env.PGLITE_DIR = "memory://";
    process.env.STRIPE_SECRET_KEY = "sk_test_unit";
    await migrate();
  });
  beforeEach(async () => {
    await resetDatabase();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("creates the Stripe invoice, stores it, schedules reminders and moves the finding to invoiced; repeat is a no-op", async () => {
    await seed("approved");
    const s = stubStripe();
    const dto = await invoiceFinding(findingId, "operator");
    expect(dto).toMatchObject({ stripeInvoiceId: "in_test_inv", status: "open", amountDueCents: 5_150_000, customerName: "Tidewater Capital" });
    expect(s.item).toHaveBeenCalledTimes(2);
    expect(s.create.mock.calls[0]?.[1]?.idempotencyKey).toBe(`ghost-inv-${findingId}-abcdef0123456789:inv`);

    const db = getDb();
    const [f] = await db.select().from(schema.finding).where(eq(schema.finding.id, findingId));
    expect(f?.status).toBe("invoiced");
    const [c] = await db.select().from(schema.customer);
    expect(c?.stripeCustomerId).toBe("cus_test");
    const reminders = await db.select().from(schema.collectionReminder);
    expect(reminders.map((r) => r.step).sort()).toEqual([1, 2, 3]);
    const created = await db.select().from(schema.auditEvent).where(eq(schema.auditEvent.action, "invoice.created"));
    expect(created[0]?.externalRef).toBe("in_test_inv");

    const again = await invoiceFinding(findingId, "operator");
    expect(again.id).toBe(dto.id);
    expect(s.create).toHaveBeenCalledTimes(1);
  });

  it("refuses a finding that is not approved, without calling Stripe", async () => {
    await seed("ready_for_approval");
    const s = stubStripe();
    await expect(invoiceFinding(findingId, "operator")).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(s.create).not.toHaveBeenCalled();
  });
});
