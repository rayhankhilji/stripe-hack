import { closeDb, resetDatabase } from "./client";

await resetDatabase();
await closeDb();
process.stdout.write("all Ghost tables truncated\n");
