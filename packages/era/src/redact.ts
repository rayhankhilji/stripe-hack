const PAN_CANDIDATE = /\b\d(?:[ -]?\d){12,18}\b/g;

function luhn(digits: string): boolean {
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

/** Replaces Luhn-valid 13-19 digit runs with [REDACTED-PAN]. */
export function redactPanText(text: string): string {
  return text.replace(PAN_CANDIDATE, (m) => (luhn(m.replace(/[ -]/g, "")) ? "[REDACTED-PAN]" : m));
}

/** Deep-redacts every string in a JSON value. */
export function redactPans<T>(value: T): T {
  if (typeof value === "string") return redactPanText(value) as T;
  if (Array.isArray(value)) return value.map(redactPans) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactPans(v)])) as T;
  }
  return value;
}
