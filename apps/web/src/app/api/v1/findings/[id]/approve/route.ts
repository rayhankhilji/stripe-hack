import { approveAndInvoice } from "@ghost/agents";
import { ApproveBody } from "@ghost/shared";
import { withHandler } from "../../../../../../server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withHandler(({ params, body }) => approveAndInvoice(params.id ?? "", "operator", body.note), { body: ApproveBody });
