import { formatCents, type EligibilityCheckDTO, type FindingDetailDTO } from "@ghost/shared";
import { amountProblems, type Draft } from "./validate";

type Decision = { status: string; reason: string };

const ROLE_HEADINGS: [FindingDetailDTO["evidence"][number]["role"], string][] = [
  ["commitment", "Committed revenue"],
  ["billing_state", "Billing state"],
  ["contract_term", "Contract"],
  ["usage_signal", "Service delivery"],
  ["dispute_signal", "Dispute signals"],
];

/** Deterministic explainer: built only from stored records, cites evidence by list label. Never invents prose. */
export function templateDraft(f: FindingDetailDTO, checks: EligibilityCheckDTO[], decision: Decision, allowed: Set<number>): Draft {
  const label = new Map(f.evidence.map((e, i) => [e.id, `[E${i + 1}]`]));
  const total = formatCents(f.calculation.totalCents);
  const flagged = checks.filter((c) => c.outcome !== "pass");
  const verdict =
    decision.status === "ready_for_approval" ? "ready for human approval" : decision.status === "escalated" ? "escalated" : "needs review";
  const summary = `${f.customerName} has ${total} of earned revenue that was never invoiced; ${verdict}${
    flagged.length ? ` (${flagged.map((c) => `${c.ruleId} ${c.outcome}`).join(", ")})` : ""
  }.`;

  const out: string[] = [`**${f.title}.** ${f.calculation.formula}: **${total}**.`, ""];
  out.push("### Calculation");
  for (const s of f.calculation.steps) out.push(`- ${s.label}: ${formatCents(s.amountCents)}`);
  out.push("");
  for (const [role, heading] of ROLE_HEADINGS) {
    const items = f.evidence.filter((e) => e.role === role).slice(0, 6);
    if (!items.length) continue;
    out.push(`### ${heading}`);
    for (const e of items) {
      // Quote verbatim only when its amounts are calculation amounts; otherwise name the source.
      const text = amountProblems(e.quote, allowed).length ? e.source.title : e.quote;
      out.push(`- ${text} ${label.get(e.id) ?? ""}`.trimEnd());
    }
    out.push("");
  }
  out.push("### Checks");
  if (!flagged.length) out.push("- All eligibility rules pass.");
  for (const c of flagged) out.push(`- ${c.ruleId} ${c.name} — ${c.outcome}: ${c.detail}`);
  out.push("", `**Decision:** ${decision.reason}`);

  const citedEvidenceIds = f.evidence.filter((e) => out.some((l) => l.includes(label.get(e.id) ?? "\u0000"))).map((e) => e.id);
  return { summary, bodyMd: out.join("\n"), citedEvidenceIds };
}
