// Vitest 4+ removed workspace files, so this file is a regular config that lists projects;
// the root `test` script passes it with --config.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // apps/web has no unit tests until feature cards add them.
    passWithNoTests: true,
    projects: ["packages/*/vitest.config.ts", "apps/web/vitest.config.ts"],
  },
});
