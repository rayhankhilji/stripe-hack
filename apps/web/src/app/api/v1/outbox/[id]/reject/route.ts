import { decideOutbox } from "@ghost/core";
import { withHandler } from "../../../../../../server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A single operator signs in with the password gate (U0), so that is the actor recorded in the audit trail.
export const POST = withHandler(({ params }) => decideOutbox(params.id ?? "", "reject", "operator"));
