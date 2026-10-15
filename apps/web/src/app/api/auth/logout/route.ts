import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../../server/env";
import { withHandler } from "../../../../server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withHandler(
  ({ requestId }) => {
    const res = new NextResponse(null, { status: 204, headers: { "x-request-id": requestId } });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  },
  { requireSession: false },
);
