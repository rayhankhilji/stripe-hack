import { NextResponse } from "next/server";
import { AppError, type ErrorCode } from "@ghost/shared";
import { assertSession } from "./session";

export type HandlerContext<B = undefined> = {
  request: Request;
  params: Record<string, string>;
  searchParams: URLSearchParams;
  body: B;
  requestId: string;
};

/** Structural slice of a zod schema, so this file needs no direct zod import. */
type BodySchema = { safeParse(v: unknown): { success: true; data: unknown } | { success: false; error: { issues: unknown[] } } };
type Infer<S> = S extends { safeParse(v: unknown): infer R } ? (R extends { success: true; data: infer D } ? D : never) : undefined;

type RouteContext = { params?: Promise<Record<string, string>> | Record<string, string> };

type Options<S extends BodySchema | undefined> = {
  /** zod schema for the JSON body; omitted for routes without one. */
  body?: S;
  /** Set false only for routes that authenticate themselves (login). */
  requireSession?: boolean;
  /** Success status when the handler returns undefined. */
  emptyStatus?: 200 | 204;
};

type Body<S> = S extends BodySchema ? Infer<S> : undefined;

/** Session check, zod parse, request id and AppError → `{error}` envelope for every JSON route. */
export function withHandler<S extends BodySchema | undefined = undefined>(
  fn: (ctx: HandlerContext<Body<S>>) => Promise<unknown> | unknown,
  options: Options<S> = {},
) {
  return async (request: Request, route: RouteContext = {}): Promise<Response> => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const headers = { "x-request-id": requestId };
    try {
      if (options.requireSession !== false) await assertSession(request);
      const params = (await route.params) ?? {};
      const searchParams = new URL(request.url).searchParams;
      let body: unknown;
      if (options.body) {
        const raw: unknown = await request.json().catch(() => {
          throw new AppError("VALIDATION", "Request body must be valid JSON");
        });
        const parsed = options.body.safeParse(raw);
        if (!parsed.success) throw new AppError("VALIDATION", "Invalid request body", { issues: parsed.error.issues });
        body = parsed.data;
      }
      const result = await fn({ request, params, searchParams, body: body as Body<S>, requestId });
      if (result instanceof Response) return result;
      if (result === undefined) return new NextResponse(null, { status: options.emptyStatus ?? 204, headers });
      return NextResponse.json(result, { headers });
    } catch (err) {
      return errorResponse(err, requestId);
    }
  };
}

export function errorResponse(err: unknown, requestId: string): Response {
  const headers = { "x-request-id": requestId };
  if (err instanceof AppError) return NextResponse.json(err.toEnvelope(), { status: err.status, headers });
  const code: ErrorCode = "INTERNAL";
  // Internals are logged by request id; the client never sees stack traces or raw upstream payloads.
  process.stderr.write(`[${requestId}] unhandled: ${err instanceof Error ? err.message : String(err)}\n`);
  return NextResponse.json(new AppError(code, "Unexpected server error", { requestId }).toEnvelope(), { status: 500, headers });
}
