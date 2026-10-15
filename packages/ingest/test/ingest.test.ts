import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";
import { closeDb, getDb, schema } from "@ghost/db";
import { runIngest, redact } from "../src/index";

beforeAll(() => {
  process.env.PGLITE_DIR = "memory://";
  delete process.env.DATABASE_URL;
});
afterAll(async () => closeDb());

describe("redact", () => {
  it("masks Luhn-valid card numbers and keeps other digit runs", () => {
    expect(redact("card 4242 4242 4242 4242 ok")).toBe("card [REDACTED-PAN] ok");
    expect(redact("req 1234567890123")).toBe("req 1234567890123");
  });
});

describe("runIngest (fixtures)", () => {
  it("ingests Era fixtures and is idempotent", async () => {
    const first = await runIngest({ source: "fixtures" });
    expect(first.error).toBeNull();
    expect(first.status).toBe("succeeded");
    expect(first.stats.customersCreated).toBeGreaterThan(50);
    expect(first.stats.sourceRecordsCreated).toBeGreaterThan(1000);

    const second = await runIngest({ source: "fixtures" });
    expect(second.status).toBe("succeeded");
    for (const [k, v] of Object.entries(second.stats)) {
      if (/(Created|Updated)$/.test(k)) expect([k, v]).toEqual([k, 0]);
    }
  }, 120_000);

  it("loads the Tidewater hero case", async () => {
    const db = getDb();
    const [tw] = await db.select().from(schema.customer).where(eq(schema.customer.eraAccountId, "acct-6"));
    expect(tw?.name).toBe("Tidewater Capital");
    expect(tw?.status).toBe("active");
    if (!tw) return;
    const won = await db
      .select()
      .from(schema.deal)
      .where(and(eq(schema.deal.customerId, tw.id), eq(schema.deal.isWon, true)));
    expect(won.map((d) => d.externalId).sort()).toEqual(["deal-127", "deal-23", "deal-24"]);
    expect(won.map((d) => d.amountCents).sort()).toEqual([1100000, 5150000, 970000].sort());
    const orders = await db.select().from(schema.salesOrder).where(eq(schema.salesOrder.customerId, tw.id));
    expect(
      orders
        .filter((o) => o.status === "Draft")
        .map((o) => o.externalId)
        .sort(),
    ).toEqual(["order-127", "order-23", "order-24"]);
    const [deal127] = won.filter((d) => d.externalId === "deal-127");
    const lines = await db
      .select()
      .from(schema.dealLineItem)
      .where(eq(schema.dealLineItem.dealId, deal127?.id ?? ""));
    expect(lines.map((l) => l.totalCents).sort()).toEqual([1640000, 3510000]);

    const [opp] = await db.select().from(schema.sourceRecord).where(eq(schema.sourceRecord.externalId, "deal-127"));
    expect(opp?.bodyText.startsWith('"')).toBe(true);
    expect(opp?.bodyText).toContain("$51,500.00, closed");
    const [contract] = await db
      .select()
      .from(schema.sourceRecord)
      .where(eq(schema.sourceRecord.externalId, "contract-4"));
    expect(contract?.bodyText).toContain("Business plan for Tidewater Capital: 20 seats at 9,700 per year.");
    expect(contract?.bodyText).toContain("Status: In Approval Process");

    const ids = await db.select().from(schema.customerIdentity).where(eq(schema.customerIdentity.customerId, tw.id));
    expect(new Set(ids.map((i) => i.system)).size).toBeGreaterThanOrEqual(5);
    const pans = await db
      .select()
      .from(schema.sourceRecord)
      .where(like(schema.sourceRecord.bodyText, "%4242424242424242%"));
    expect(pans).toHaveLength(0);
    const audits = await db.select().from(schema.auditEvent).where(eq(schema.auditEvent.action, "ingest.completed"));
    expect(audits).toHaveLength(2);
  });
});
