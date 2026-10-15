import { handleStripeEvent, verifyWebhook } from "@ghost/core";
import { AppError } from "@ghost/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Not wrapped in withHandler: Stripe authenticates with its signature, not the operator session.
export async function POST(req: Request): Promise<Response> {
  // Raw text first: the HMAC covers the exact bytes, so nothing may parse the body before verification.
  const raw = await req.text();
  let evt;
  try {
    evt = verifyWebhook(raw, req.headers.get("stripe-signature"));
  } catch (err) {
    if (err instanceof AppError) return Response.json(err.toEnvelope(), { status: err.status });
    throw err;
  }
  try {
    const result = await handleStripeEvent(evt);
    return Response.json({ received: true, result });
  } catch (err) {
    // 5xx makes Stripe retry; the event row is marked failed and is re-claimable.
    const appErr = err instanceof AppError ? err : new AppError("INTERNAL", "webhook processing failed");
    console.error("stripe webhook processing failed", { eventId: evt.id, type: evt.type, code: appErr.code });
    return Response.json(appErr.toEnvelope(), { status: appErr.status >= 500 ? appErr.status : 500 });
  }
}
