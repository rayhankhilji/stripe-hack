import { createHash } from "node:crypto";
import { AppError } from "@ghost/shared";

/**
 * Canonical JSON: object keys sorted by code unit, undefined object members dropped (as JSON.stringify does),
 * array order preserved. Anything without a single unambiguous encoding is rejected rather than coerced,
 * because a silently different encoding would change the hash and break finding dedupe.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new AppError("VALIDATION", `calcHash: non-finite number ${value}`);
      return JSON.stringify(value);
    case "bigint":
      // DB money columns may surface as bigint; 5n and 5 are the same amount of cents and hash the same.
      return value.toString();
    case "object":
      return Array.isArray(value) ? canonicalArray(value) : canonicalObject(value);
    default:
      throw new AppError("VALIDATION", `calcHash: unsupported value of type ${typeof value}`);
  }
}

function canonicalArray(items: readonly unknown[]): string {
  return `[${items.map((item) => (item === undefined ? "null" : canonicalJson(item))).join(",")}]`;
}

function canonicalObject(obj: object): string {
  if (obj instanceof Date) return JSON.stringify(obj.toISOString());
  const proto: unknown = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) {
    throw new AppError("VALIDATION", "calcHash: only plain objects, arrays and primitives are hashable");
  }
  const entries = Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** sha256 (hex) of the canonical JSON of `parts`; stable across key order. */
export function calcHash(parts: unknown): string {
  return createHash("sha256").update(canonicalJson(parts), "utf8").digest("hex");
}

/** Stripe idempotency key for a finding's invoice: same finding + same calculation → same key. */
export function invoiceIdempotencyKey(findingId: string, hash: string): string {
  if (!findingId) throw new AppError("VALIDATION", "invoiceIdempotencyKey: findingId is required");
  if (!/^[0-9a-f]{16,}$/.test(hash)) throw new AppError("VALIDATION", "invoiceIdempotencyKey: hash must be ≥16 lowercase hex chars");
  return `ghost-inv-${findingId}-${hash.slice(0, 16)}`;
}
