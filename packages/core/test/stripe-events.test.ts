import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb, migrate, resetDatabase, schema } from "@ghost/db";
import { signTestPayload } from "@ghost/stripe";
import { canTransition, handleStripeEvent, invoiceEffectFor, verifyWebhook } from "../src/stripe-events";

// Real in-memory Postgres (PGlite) with the generated migrations; only Stripe's signature is synthesized.
const SECRET = "whsec_core_test";
const STRIPE_INVOICE_ID = "in_test_core_1";

function signedEvent(id: string, type: string, invoice: Record<string, unknown>) {
  const payload = JSON.stringify({
    id,
    object: "event",
    type,
    livemode: false,
    created: 1_760_000_000,
    data: { object: { id: STRIPE_INVOICE_ID, object: "invoice", ...invoice } },
  });
  return verifyWebhook(payload, signTestPayload(payload, SECRET));
}

const paidInvoice = {
  status: "paid",
  amount_due: 7_220_000,
  amount_paid: 7_220_000,
  number: "GHOST-0001",
  hosted_invoice_url: "https://invoice.stripe.com/i/test",
  invoice_pdf: null,
  due_date: 1_762_000_000,
  attempt_count: 1,
  status_transitions: { finalized_at: 1_760_000_000, paid_at: 1_760_100_000, voided_at: null, marked_uncollectible_at: null },
  lines: { object: "list", has_more: false, data: [{ amount: 7_220_000, description: "Tidewater", quantity: 1 }] },
};

let findingId = "";
let invoiceId = "";

async function seed(): Promise<void> {
  const db = getDb();
  const [cust] = await db.insert(schema.customer).values({ eraAccountId: "acct-6", name: "Tidewater Capital" }).returning();
  if (!cust) throw new Error("seed customer");
  const calc = { version: "t", formula: "t", inputs: [], steps: [], totalCents: 7_220_000, calcHash: "h" };
  const [f] = await db
    .insert(schema.finding)
    .values({ customerId: cust.id, kind: "won_not_billed", status: "invoiced", title: "Won, not billed", amountCents: 7_220_000, calculation: calc, calcHash: "h" })
    .returning();
  if (!f) throw new Error("seed finding");
  const [inv] = await db
    .insert(schema.invoice)
    .values({ findingId: f.id, customerId: cust.id, stripeInvoiceId: STRIPE_INVOICE_ID, stripeCustomerId: "cus_test", idempotencyKey: "k", status: "open", amountDueCents: 7_220_000 })
    .returning();
  if (!inv) throw new Error("seed invoice");
  await db.insert(schema.collectionReminder).values([1, 2, 3].map((step) => ({ invoiceId: inv.id, step, scheduledFor: new Date(1_762_000_000_000) })));
  findingId = f.id;
  invoiceId = inv.id;
}

describe("handleStripeEvent", () => {
  beforeAll(async () => {
    process.env.PGLITE_DIR = "memory://";
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    await migrate();
  });
  beforeEach(async () => {
    await resetDatabase();
    await seed();
  });
  afterAll(async () => {
    await closeDb();
  });

  it("invoice.paid marks the invoice paid, the finding recovered and suppresses reminders, exactly once", async () => {
    const evt = signedEvent("evt_paid_1", "invoice.paid", paidInvoice);
    expect(await handleStripeEvent(evt)).toBe("processed");
    expect(await handleStripeEvent(evt)).toBe("duplicate");

    const db = getDb();
    const [inv] = await db.select().from(schema.invoice).where(eq(schema.invoice.id, invoiceId));
    expect(inv).toMatchObject({ status: "paid", amountPaidCents: 7_220_000 });
    expect(inv?.paidAt?.getTime()).toBe(1_760_100_000_000);
    const [f] = await db.select().from(schema.finding).where(eq(schema.finding.id, findingId));
    expect(f?.status).toBe("recovered");
    const reminders = await db.select().from(schema.collectionReminder).where(eq(schema.collectionReminder.invoiceId, invoiceId));
    expect(reminders.map((r) => r.status)).toEqual(["suppressed", "suppressed", "suppressed"]);
    const [stored] = await db.select().from(schema.stripeEvent).where(eq(schema.stripeEvent.id, "evt_paid_1"));
    expect(stored?.status).toBe("processed");
    const verified = await db.select().from(schema.auditEvent).where(eq(schema.auditEvent.action, "webhook.invoice.paid"));
    expect(verified).toHaveLength(1);
    expect(verified[0]).toMatchObject({ kind: "outcome_verified", externalRef: "evt_paid_1" });
  });

  it("a second distinct paid event does not repeat side effects", async () => {
    await handleStripeEvent(signedEvent("evt_paid_a", "invoice.paid", paidInvoice));
    expect(await handleStripeEvent(signedEvent("evt_paid_b", "invoice.paid", paidInvoice))).toBe("processed");
    const audits = await getDb().select().from(schema.auditEvent).where(eq(schema.auditEvent.kind, "outcome_verified"));
    expect(audits.filter((a) => a.action === "webhook.invoice.paid")).toHaveLength(1);
  });

  it("a late invoice.finalized never regresses a paid invoice", async () => {
    await handleStripeEvent(signedEvent("evt_paid_2", "invoice.paid", paidInvoice));
    await handleStripeEvent(signedEvent("evt_fin_late", "invoice.finalized", { ...paidInvoice, status: "open", amount_paid: 0 }));
    const [inv] = await getDb().select().from(schema.invoice).where(eq(schema.invoice.id, invoiceId));
    expect(inv?.status).toBe("paid");
  });

  it("invoice.payment_failed records the error without changing status", async () => {
    const evt = signedEvent("evt_fail_1", "invoice.payment_failed", { ...paidInvoice, status: "open", amount_paid: 0, attempt_count: 2 });
    expect(await handleStripeEvent(evt)).toBe("processed");
    const [inv] = await getDb().select().from(schema.invoice).where(eq(schema.invoice.id, invoiceId));
    expect(inv).toMatchObject({ status: "open", lastPaymentError: "Payment attempt 2 failed" });
  });

  it("ignores unmapped events and invoices Ghost did not create", async () => {
    expect(await handleStripeEvent(signedEvent("evt_cus", "customer.created", {}))).toBe("ignored");
    const foreign = verifyWebhook(
      JSON.stringify({ id: "evt_foreign", object: "event", type: "invoice.paid", livemode: false, data: { object: { ...paidInvoice, id: "in_other" } } }),
      signTestPayload(JSON.stringify({ id: "evt_foreign", object: "event", type: "invoice.paid", livemode: false, data: { object: { ...paidInvoice, id: "in_other" } } }), SECRET),
    );
    expect(await handleStripeEvent(foreign)).toBe("ignored");
  });
});

describe("event mapping (§6)", () => {
  it.each([
    ["invoice.finalized", { to: "open" }],
    ["invoice.paid", { to: "paid" }],
    ["invoice.payment_failed", { paymentFailed: true }],
    ["invoice.voided", { to: "void" }],
    ["invoice.marked_uncollectible", { to: "uncollectible" }],
    ["invoice.payment_succeeded", null],
    ["charge.succeeded", null],
  ])("%s", (type, effect) => {
    expect(invoiceEffectFor(type)).toEqual(effect);
  });

  it("is monotonic", () => {
    expect(canTransition("open", "paid")).toBe(true);
    expect(canTransition("uncollectible", "paid")).toBe(true);
    expect(canTransition("paid", "open")).toBe(false);
    expect(canTransition("void", "paid")).toBe(false);
  });
});
