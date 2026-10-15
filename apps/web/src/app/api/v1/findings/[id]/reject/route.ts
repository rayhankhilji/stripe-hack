import { getFinding, recordApproval, setFindingStatus } from "@ghost/core";
import { RejectBody } from "@ghost/shared";
import { withHandler } from "../../../../../../server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withHandler(
  async ({ params, body }) => {
    const id = params.id ?? "";
    await recordApproval(id, "rejected", "operator", body.reason);
    await setFindingStatus(id, "rejected", body.reason, { type: "operator", name: "operator" });
    return getFinding(id);
  },
  { body: RejectBody },
);
