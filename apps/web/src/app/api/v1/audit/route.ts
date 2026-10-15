import { listAudit } from "@ghost/core";
import { withHandler } from "../../../../server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withHandler(({ searchParams }) =>
  listAudit({
    subjectType: searchParams.get("subjectType") ?? undefined,
    subjectId: searchParams.get("subjectId") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  }),
);
