import { formatCents } from "@ghost/shared";

/** Full-precision currency string from integer cents, e.g. 7220000 → "$72,200.00". */
export function formatMoney(cents: number, currency = "usd"): string {
  return formatCents(cents, currency);
}

/** Drops ".00" for whole amounts so headline figures read cleanly: 7220000 → "$72,200". */
export function formatMoneyShort(cents: number, currency = "usd"): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Compact form for dense tiles: 7220000 → "$72.2K". Display only, never for arithmetic. */
export function formatMoneyCompact(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}
