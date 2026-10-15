import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@ghost/agents",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
