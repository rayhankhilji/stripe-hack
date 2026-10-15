import { listFindings } from "@ghost/core";
import { FindingStatus } from "@ghost/shared";
import { withHandler } from "../../../../server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withHandler(({ searchParams }) => {
  const status = searchParams.get("status");
  return listFindings({ status: status ? FindingStatus.parse(status) : undefined, cursor: searchParams.get("cursor") ?? undefined });
});
