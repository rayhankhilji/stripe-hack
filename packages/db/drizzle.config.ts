import { defineConfig } from "drizzle-kit";

// SQL migrations are generated from the frozen schema and applied at runtime by `migrate()`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
});
