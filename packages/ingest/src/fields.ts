import { dollarsToCents, formatCents } from "@ghost/shared";

export type Raw = Record<string, unknown>;

export function str(r: Raw, key: string): string | null {
  const v = r[key];
  if (typeof v === "string") return v === "" ? null : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

export function num(r: Raw, key: string): number | null {
  const v = r[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Salesforce currency field (dollars) → integer cents, exactly. */
export function cents(r: Raw, key: string): number | null {
  const v = r[key];
  if (typeof v !== "number" && typeof v !== "string") return null;
  return dollarsToCents(typeof v === "number" ? v.toFixed(2) : v);
}

/** "$51,500.00" — the money format used in every body_text quote line (§5). */
export function money(c: number | null): string {
  return c === null ? "$—" : formatCents(c);
}

export function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isRecord(v: unknown): v is Raw {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
