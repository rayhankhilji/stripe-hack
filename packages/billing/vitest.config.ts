import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@ghost/billing",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
