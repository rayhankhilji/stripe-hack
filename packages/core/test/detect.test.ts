import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory://";
process.env.INVOICE_AMOUNT_CAP_CENTS = "10000000";

describe("detection over ingested fixtures", () => {
  let core: typeof import("../src/index");
  beforeAll(async () => {
    const db = await import("@ghost/db");
    await db.migrate();
    const ingest = await import("@ghost/ingest");
    await ingest.runIngest({ source: "fixtures" });
    const detect = await import("../src/detect");
    const findings = await import("../src/findings");
    core = { ...detect, ...findings } as typeof core;
  }, 120_000);

  it("finds Tidewater's $72,200 and is idempotent", async () => {
    const first = await core.runDetection();
    expect(first.created).toBeGreaterThan(0);
    const second = await core.runDetection();
    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);

    const list = await core.listFindings({});
    const tide = list.items.find((f) => f.customerName.startsWith("Tidewater"));
    expect(tide?.amountCents).toBe(7_220_000);
    expect(tide?.status).toBe("ready_for_approval");

    const detail = await core.getFinding(tide?.id ?? "");
    expect(detail.lines).toHaveLength(4);
    expect(detail.eligibility.find((c) => c.ruleId === "R-10")?.outcome).toBe("warn");
    expect(detail.evidence.length).toBeGreaterThan(0);
    expect(detail.evidence.every((e) => e.verified)).toBe(true);
  });
});
