import { closeDb } from "@ghost/db";
import { runIngest } from "./run";

const live = process.argv.includes("--live");
const run = await runIngest({ source: live ? "live" : "fixtures" });
process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
await closeDb();
process.exitCode = run.status === "succeeded" ? 0 : 1;
