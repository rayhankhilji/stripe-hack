import { callStripe, getStripe } from "./client";

export type GhostCustomerRef = { id: string; name: string; eraAccountId: string; stripeCustomerId: string | null };

export function sandboxBillingEmail(eraAccountId: string): string {
  const domain = process.env.OUTBOX_SANDBOX_DOMAIN ?? "sandbox.ghost.test";
  return `billing+${eraAccountId}@${domain}`;
}

/**
 * Returns the Stripe customer id for a Ghost customer, creating it once.
 * The email is always the sandbox address so Stripe can never reach a real inbox.
 */
export async function ensureStripeCustomer(c: GhostCustomerRef): Promise<string> {
  if (c.stripeCustomerId) return c.stripeCustomerId;
  const stripe = getStripe();
  const created = await callStripe("customers.create", () =>
    stripe.customers.create(
      {
        name: c.name,
        email: sandboxBillingEmail(c.eraAccountId),
        metadata: { ghost_customer_id: c.id, era_account_id: c.eraAccountId },
      },
      { idempotencyKey: `ghost-cus-${c.id}` },
    ),
  );
  return created.id;
}
