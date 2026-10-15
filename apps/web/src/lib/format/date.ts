const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const relFmt = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

function toDate(value: string | Date): Date | null {
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Oct 15, 2026". Returns "—" for null or unparseable input. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = toDate(value);
  return d ? dateFmt.format(d) : "—";
}

/** "Oct 15, 2:04 PM". */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : "—";
}

/** "14:04:09", for log-style mono timestamps. */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = toDate(value);
  return d ? timeFmt.format(d) : "—";
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 minutes ago", "just now", "in 2 days". `now` is injectable for deterministic tests. */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return "—";
  const d = toDate(value);
  if (!d) return "—";
  const seconds = Math.round((d.getTime() - now.getTime()) / 1000);
  if (Math.abs(seconds) < 45) return "just now";
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relFmt.format(Math.round(seconds / size), unit);
  }
  return relFmt.format(Math.round(seconds / 60), "minute");
}
