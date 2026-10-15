import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@ghost/era",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
