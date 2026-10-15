const PAN_CANDIDATE = /\b\d(?:[ -]?\d){12,18}\b/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Luhn-valid 13-19 digit card numbers → [REDACTED-PAN]. Postgres text cannot hold NUL, so it is dropped too. */
export function redact(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(PAN_CANDIDATE, (m) => (luhnValid(m.replace(/[ -]/g, "")) ? "[REDACTED-PAN]" : m));
}

/** Applies `redact` to every string inside a JSON value (used on `source_record.raw`). */
export function redactDeep<T>(value: T): T {
  if (typeof value === "string") return redact(value) as T;
  if (Array.isArray(value)) return value.map(redactDeep) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [redact(k), redactDeep(v)])) as T;
  }
  return value;
}
