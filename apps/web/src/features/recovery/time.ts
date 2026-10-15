const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 30],
  ["month", 12],
];

/** "3 minutes ago". `now` is passed in so render output is stable within a frame. */
export function relativeTime(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  let delta = (t - now) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(delta) < size) return RELATIVE.format(Math.round(delta), unit);
    delta /= size;
  }
  return RELATIVE.format(Math.round(delta), "year");
}

const STAMP = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function timestamp(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : STAMP.format(t);
}

/** Calendar dates (due dates) are dates, not instants, so they render in UTC. */
export function calendarDate(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : DAY.format(t);
}
