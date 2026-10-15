import { AppError } from "@ghost/shared";
import { z } from "zod";

const TOKEN_TIMEOUT_MS = 20_000;
const REFRESH_MARGIN_MS = 5 * 60_000;

const TokenResponse = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() });

let cached: { token: string; expiresAt: number } | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new AppError("UPSTREAM_ERA", `${name} is not set; cannot reach Era live`, { missing: name });
  return value;
}

/** Bearer token via OAuth client-credentials. Cached until 5 minutes before expiry. */
export async function getEraToken(now: number = Date.now()): Promise<string> {
  if (cached && now < cached.expiresAt - REFRESH_MARGIN_MS) return cached.token;

  const res = await fetch(requireEnv("ERA_TOKEN_URL"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: requireEnv("ERA_CLIENT_ID"),
      client_secret: requireEnv("ERA_CLIENT_SECRET"),
    }),
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  }).catch((err: unknown) => {
    throw new AppError("UPSTREAM_ERA", "Era token request failed", { cause: String(err) });
  });
  if (!res.ok) throw new AppError("UPSTREAM_ERA", `Era token endpoint returned ${res.status}`, { status: res.status });

  const parsed = TokenResponse.safeParse(await res.json());
  if (!parsed.success)
    throw new AppError("UPSTREAM_ERA", "Era token response was malformed", { issues: parsed.error.issues.length });

  cached = { token: parsed.data.access_token, expiresAt: now + parsed.data.expires_in * 1000 };
  return cached.token;
}

export function clearEraTokenCache(): void {
  cached = null;
}
