// `pnpm demo:reset`: wipe the database and rebuild the demo from recorded fixtures.
import { existsSync } from "node:fs";
import { resetDemo } from "../packages/core/src/demo";

async function main(): Promise<void> {
  if (existsSync(".env")) process.loadEnvFile(".env");
  await resetDemo();
  process.stdout.write("Demo reset complete: database rebuilt from fixtures, detection and expansion scan run.\n");
}

main().catch((err: unknown) => {
  process.stderr.write(`demo reset failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
