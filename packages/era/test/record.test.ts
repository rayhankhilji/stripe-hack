import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSnapshotFromFixtures, redactPanText } from "../src/index";
import { writeSnapshot } from "../src/record";

describe("era:record", () => {
  it("round-trips a snapshot through the fixture layout", () => {
    const dir = mkdtempSync(join(tmpdir(), "era-rec-"));
    try {
      const original = loadSnapshotFromFixtures();
      writeSnapshot(original, dir);
      expect(loadSnapshotFromFixtures(dir)).toEqual(original);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("PAN redaction", () => {
  it("redacts Luhn-valid card numbers and leaves other digit runs", () => {
    expect(redactPanText("card 4242 4242 4242 4242 ok")).toBe("card [REDACTED-PAN] ok");
    expect(redactPanText("call 7000000001514345028 id")).toBe("call 7000000001514345028 id");
  });
});
