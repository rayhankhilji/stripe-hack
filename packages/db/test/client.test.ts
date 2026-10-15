import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, getDb, migrate, queryRows, resetDatabase, schema, tableNames } from "../src/index";

beforeAll(() => {
  process.env.PGLITE_DIR = "memory://";
  delete process.env.DATABASE_URL;
});
afterAll(async () => closeDb());

describe("@ghost/db runtime", () => {
  it("migrates every schema table and is idempotent", async () => {
    await migrate();
    await migrate();
    const rows = await queryRows<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const present = new Set(rows.map((r) => r.table_name));
    for (const t of tableNames()) expect(present.has(t)).toBe(true);
    expect(tableNames().length).toBeGreaterThanOrEqual(19);
  });

  it("resetDatabase truncates data", async () => {
    const db = getDb();
    await db.insert(schema.customer).values({ eraAccountId: "acct-test", name: "Test Co" });
    expect(await db.$count(schema.customer)).toBe(1);
    await resetDatabase();
    expect(await db.$count(schema.customer)).toBe(0);
  });
});
