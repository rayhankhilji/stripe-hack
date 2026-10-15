const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatNumber(n: number): string {
  return integer.format(n);
}

export function formatPercent(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

/** "1 record" / "12 records". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
