import Stripe from "stripe";
import { AppError } from "@ghost/shared";

export const STRIPE_API_VERSION = "2026-09-30.endive" as const;
const STRIPE_TIMEOUT_MS = 15_000;

let client: { key: string; stripe: Stripe } | null = null;

/** Throws POLICY_BLOCKED unless the key is a test-mode secret key. Ghost never touches live money. */
export function assertTestMode(key: string | undefined): asserts key is string {
  if (!key) throw new AppError("POLICY_BLOCKED", "STRIPE_SECRET_KEY is not set");
  if (!key.startsWith("sk_test_")) {
    throw new AppError("POLICY_BLOCKED", "Stripe key must be a test-mode secret key (sk_test_)");
  }
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  assertTestMode(key);
  // Rebuild if the key changed (tests and demo reset swap env at runtime).
  if (client?.key !== key) {
    client = {
      key,
      stripe: new Stripe(key, {
        apiVersion: STRIPE_API_VERSION,
        timeout: STRIPE_TIMEOUT_MS,
        maxNetworkRetries: 2,
        appInfo: { name: "ghost-revenue-operator" },
      }),
    };
  }
  return client.stripe;
}

/** Converts Stripe SDK errors into AppError(UPSTREAM_STRIPE) without leaking request internals. */
export function toStripeAppError(err: unknown, op: string): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Stripe.errors.StripeError) {
    return new AppError("UPSTREAM_STRIPE", `Stripe ${op} failed: ${err.message}`, {
      op,
      type: err.type,
      code: err.code ?? null,
      statusCode: err.statusCode ?? null,
      requestId: err.requestId ?? null,
    });
  }
  const message = err instanceof Error ? err.message : String(err);
  return new AppError("UPSTREAM_STRIPE", `Stripe ${op} failed: ${message}`, { op });
}

export async function callStripe<T>(op: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw toStripeAppError(err, op);
  }
}
