import { NextResponse } from "next/server";
import { AppError, LoginBody } from "@ghost/shared";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/server/env";
import { withHandler } from "@/server/handler";
import { createSessionToken, passwordMatches } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withHandler(
  async ({ body, requestId }) => {
    if (!(await passwordMatches(body.password))) throw new AppError("UNAUTHORIZED", "That password is not right");
    const res = new NextResponse(null, { status: 204, headers: { "x-request-id": requestId } });
    res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  },
  { body: LoginBody, requireSession: false },
);
