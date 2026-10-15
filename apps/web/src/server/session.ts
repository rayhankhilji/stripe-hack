import { AppError } from "@ghost/shared";
import { requireEnv, SESSION_COOKIE } from "./env";

// Web Crypto only, so the same helpers run in the edge middleware and in Node route handlers.
const encoder = new TextEncoder();
const SESSION_SUBJECT = "operator";

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/** Cookie value: HMAC-SHA256 of "operator" keyed by SESSION_SECRET. */
export async function createSessionToken(secret: string = requireEnv("SESSION_SECRET")): Promise<string> {
  return hmacHex(SESSION_SUBJECT, secret);
}

export async function verifySessionToken(token: string | undefined | null, secret: string | undefined = process.env.SESSION_SECRET): Promise<boolean> {
  if (!token || !secret) return false;
  return timingSafeEqual(token, await hmacHex(SESSION_SUBJECT, secret));
}

export async function passwordMatches(candidate: string): Promise<boolean> {
  const expected = requireEnv("OPERATOR_PASSWORD");
  // Compare digests so length differences do not leak through timing.
  const [a, b] = await Promise.all([hmacHex(candidate, "ghost-pw"), hmacHex(expected, "ghost-pw")]);
  return timingSafeEqual(a, b);
}

export function readCookie(header: string | null, name: string = SESSION_COOKIE): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

export async function assertSession(request: Request): Promise<void> {
  if (!(await verifySessionToken(readCookie(request.headers.get("cookie"))))) {
    throw new AppError("UNAUTHORIZED", "Sign in to continue");
  }
}
