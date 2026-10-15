import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@ghost/ingest",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
