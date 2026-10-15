import { closeDb, migrate } from "./client";

await migrate();
await closeDb();
process.stdout.write(`migrations applied (${process.env.DATABASE_URL ? "postgres" : "pglite"})\n`);
