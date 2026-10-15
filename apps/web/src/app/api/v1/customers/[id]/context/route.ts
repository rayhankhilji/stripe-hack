import { getCustomer } from "@ghost/core";
import { searchContext } from "../../../../../../../../../packages/knowledge/src/index";
import { withHandler } from "../../../../../../server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withHandler(async ({ params, searchParams }) => {
  const customer = await getCustomer(params.id ?? "");
  const q = searchParams.get("q")?.trim() || "What commitments, contracts and billing state exist for this customer?";
  return searchContext(customer.name, q);
});
