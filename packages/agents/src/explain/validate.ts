import { dollarsToCents, type CalculationDTO, type FindingDetailDTO } from "@ghost/shared";

const MONEY = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?![\d,]*\d)([kKmMbB])?/g;
const LABEL = /\[E(\d+)\]/g;

/** Every cent value the deterministic calculation (and its lines) produced. Nothing else may appear as `$`. */
export function allowedAmounts(calc: CalculationDTO, lines: FindingDetailDTO["lines"]): Set<number> {
  const set = new Set<number>([calc.totalCents, ...calc.steps.map((s) => s.amountCents)]);
  for (const l of lines) set.add(l.amountCents).add(l.unitAmountCents);
  for (const i of calc.inputs) {
    for (const m of i.value.matchAll(MONEY)) set.add(dollarsToCents(`${m[1] ?? ""}${m[2] ? `.${m[2]}` : ""}`));
  }
  return set;
}

/** Problems with the `$` amounts in a text; empty when every amount is one the calculation produced. */
export function amountProblems(text: string, allowed: Set<number>): string[] {
  const problems: string[] = [];
  for (const m of text.matchAll(MONEY)) {
    if (m[3]) {
      problems.push(`abbreviated amount "${m[0]}" is not allowed; copy the exact amount`);
      continue;
    }
    const cents = dollarsToCents(`${m[1] ?? ""}${m[2] ? `.${m[2]}` : ""}`);
    if (!allowed.has(cents)) problems.push(`amount "${m[0]}" does not appear in the calculation`);
  }
  return problems;
}

export type Draft = { summary: string; bodyMd: string; citedEvidenceIds: string[] };

/**
 * Validates a draft whose bodyMd cites evidence by list label ([E3] = third evidence item),
 * then renumbers labels by first appearance so [E1]..[En] map to citedEvidenceIds order (ExplanationDTO contract).
 */
export function validateDraft(draft: Draft, evidenceIds: string[], allowed: Set<number>): { ok: true; value: Draft } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const known = new Set(evidenceIds);
  for (const id of draft.citedEvidenceIds) if (!known.has(id)) problems.push(`cited id ${id} is not an evidence id`);
  const order: number[] = [];
  for (const m of draft.bodyMd.matchAll(LABEL)) {
    const n = Number(m[1]);
    if (n < 1 || n > evidenceIds.length) problems.push(`citation [E${n}] is not in the evidence list`);
    else if (!order.includes(n)) order.push(n);
  }
  if (order.length === 0) problems.push("bodyMd cites no evidence");
  const usedIds = order.map((n) => evidenceIds[n - 1] as string);
  for (const id of draft.citedEvidenceIds) if (known.has(id) && !usedIds.includes(id)) problems.push(`id ${id} is listed but never cited in bodyMd`);
  problems.push(...amountProblems(draft.summary, allowed), ...amountProblems(draft.bodyMd, allowed));
  if (!draft.summary.trim()) problems.push("summary is empty");
  if (problems.length) return { ok: false, problems };
  const bodyMd = draft.bodyMd.replace(LABEL, (_, d: string) => `[E${order.indexOf(Number(d)) + 1}]`);
  return { ok: true, value: { summary: draft.summary.trim(), bodyMd, citedEvidenceIds: usedIds } };
}
