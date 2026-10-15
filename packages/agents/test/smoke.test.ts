import { describe, expect, it } from "vitest";

describe("@ghost/agents", () => {
  it("imports its public entry point", async () => {
    const mod = await import("../src/index");
    expect(mod).toBeTypeOf("object");
  });
});
