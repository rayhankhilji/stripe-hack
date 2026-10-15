// Integer-cents money helpers. Never use floats for money.
import { AppError } from "./errors";

export function assertCents(n: number): number {
  if (!Number.isSafeInteger(n)) throw new AppError("VALIDATION", `not an integer cent amount: ${n}`);
  return n;
}

/** Parse a decimal dollar string/number from a source record ("9700", "9,700.00", 51500) into cents, exactly. */
export function dollarsToCents(v: string | number): number {
  const s = String(v).replace(/[$,\s]/g, "");
  const m = s.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) throw new AppError("VALIDATION", `unparseable amount: ${String(v)}`);
  const [, sign, whole, frac = ""] = m;
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return assertCents(sign === "-" ? -cents : cents);
}

export function sumCents(values: readonly number[]): number {
  return assertCents(values.reduce((a, b) => a + assertCents(b), 0));
}

export function formatCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
