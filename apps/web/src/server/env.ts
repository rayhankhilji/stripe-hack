import { AppError } from "@ghost/shared";

export const SESSION_COOKIE = "ghost_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

/** Reads a required server env var; missing config is an INTERNAL error, never a silent default. */
export function requireEnv(name: "SESSION_SECRET" | "OPERATOR_PASSWORD"): string {
  const value = process.env[name];
  if (!value) throw new AppError("INTERNAL", `${name} is not configured`);
  return value;
}
