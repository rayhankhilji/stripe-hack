import Stripe from "stripe";
import { AppError } from "@ghost/shared";

// Signature verification needs no API key, so it must not depend on getStripe().
const webhooks = Stripe.webhooks;

/**
 * Verifies the Stripe-Signature header against the exact raw body and returns the event.
 * Callers must pass the unparsed body; any re-serialisation breaks the HMAC.
 */
export function verifyWebhook(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new AppError("INTERNAL", "STRIPE_WEBHOOK_SECRET is not configured");
  if (!signature) throw new AppError("WEBHOOK_SIGNATURE", "missing Stripe-Signature header");
  try {
    return webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new AppError("WEBHOOK_SIGNATURE", "Stripe webhook signature verification failed", { reason });
  }
}

/** Signs a payload the way Stripe does; used by tests and local tooling. */
export function signTestPayload(payload: string, secret: string, timestamp?: number): string {
  return webhooks.generateTestHeaderString({ payload, secret, ...(timestamp ? { timestamp } : {}) });
}
