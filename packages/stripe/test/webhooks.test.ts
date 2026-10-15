import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@ghost/shared";
import { signTestPayload, verifyWebhook } from "../src/index";

const SECRET = "whsec_unit_test_only";
const payload = JSON.stringify({
  id: "evt_test_1",
  object: "event",
  type: "invoice.paid",
  livemode: false,
  data: { object: { id: "in_test_1", object: "invoice", status: "paid" } },
});

describe("verifyWebhook", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("accepts a correctly signed raw body", () => {
    const evt = verifyWebhook(payload, signTestPayload(payload, SECRET));
    expect(evt.id).toBe("evt_test_1");
    expect(evt.type).toBe("invoice.paid");
  });

  it("rejects a body that was modified after signing", () => {
    const sig = signTestPayload(payload, SECRET);
    const tampered = payload.replace("in_test_1", "in_test_2");
    expect(() => verifyWebhook(tampered, sig)).toThrowError(
      expect.objectContaining({ code: "WEBHOOK_SIGNATURE" }) as AppError,
    );
  });

  it("rejects a signature made with another secret", () => {
    const sig = signTestPayload(payload, "whsec_other_secret");
    expect(() => verifyWebhook(payload, sig)).toThrowError(expect.objectContaining({ code: "WEBHOOK_SIGNATURE" }) as AppError);
  });

  it("rejects a stale timestamp (replay outside the 300s tolerance)", () => {
    const sig = signTestPayload(payload, SECRET, Math.floor(Date.now() / 1000) - 3600);
    expect(() => verifyWebhook(payload, sig)).toThrowError(expect.objectContaining({ code: "WEBHOOK_SIGNATURE" }) as AppError);
  });

  it("rejects a missing header with HTTP 400", () => {
    try {
      verifyWebhook(payload, null);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(400);
    }
  });

  it("fails closed when the secret is not configured", () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(() => verifyWebhook(payload, "t=1,v1=abc")).toThrowError(expect.objectContaining({ code: "INTERNAL" }) as AppError);
  });
});
