import { AppError, ErrorEnvelope } from "@ghost/shared";

type ApiInit = Omit<RequestInit, "body"> & { body?: unknown; timeoutMs?: number };

/** Typed fetch for `/api/v1/**`. Throws AppError built from the error envelope. */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { body, timeoutMs = 60_000, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
      credentials: "same-origin",
    });
  } catch (err) {
    throw new AppError("INTERNAL", err instanceof Error && err.name === "TimeoutError" ? "The request timed out" : "Could not reach Ghost");
  }

  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;

  const parsed = ErrorEnvelope.safeParse(await res.json().catch(() => null));
  if (parsed.success) throw new AppError(parsed.data.error.code, parsed.data.error.message, parsed.data.error.details);
  throw new AppError(res.status === 401 ? "UNAUTHORIZED" : "INTERNAL", `Request failed (${res.status})`);
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
