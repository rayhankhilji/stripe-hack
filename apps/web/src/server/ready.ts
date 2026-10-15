import { getDb, migrate, schema } from "@ghost/db";
import { runIngest } from "@ghost/ingest";
import { runDetection } from "@ghost/core";

// Each serverless instance may start with an empty database: migrate once, and seed from the
// recorded Era fixtures if nothing has been ingested yet. Memoized per instance.
const g = globalThis as { __ghostReady?: Promise<void> };

export function ensureReady(): Promise<void> {
  g.__ghostReady ??= (async () => {
    await migrate();
    const rows = await getDb().select({ id: schema.customer.id }).from(schema.customer).limit(1);
    if (rows.length === 0) {
      await runIngest({ source: "fixtures" });
      await runDetection();
    }
  })().catch((err: unknown) => {
    g.__ghostReady = undefined;
    throw err;
  });
  return g.__ghostReady;
}
