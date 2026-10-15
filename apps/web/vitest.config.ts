import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@ghost/web",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
  },
});
