import type { EvidenceRole } from "./facts";

type Raw = Record<string, unknown>;

export const QUOTE_MAX = 240;

function str(raw: Raw, key: string): string | null {
  const v = raw[key];
  if (typeof v === "string" && v.trim() !== "") return v;
  if (typeof v === "number") return String(v);
  return null;
}

function num(raw: Raw, key: string): number | null {
  const v = raw[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Plain, grouped and two-decimal renderings of one dollar amount; ingest may have used any of them in body_text. */
function dollarVariants(n: number): string[] {
  const grouped = n.toLocaleString("en-US");
  const fixed = n.toFixed(2);
  const groupedFixed = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return [...new Set([String(n), grouped, fixed, groupedFixed])];
}

/**
 * Candidate verbatim quotes for one source record, in preference order (FAST_PLAN §5).
 * The caller keeps the first candidate found verbatim in body_text, so `verified` is a measurement, not a claim.
 */
export function quoteCandidates(role: EvidenceRole, recordType: string, raw: Raw, title: string): string[] {
  const out: string[] = [];
  const push = (s: string | null) => {
    if (s && s.trim() !== "") out.push(s.length > QUOTE_MAX ? s.slice(0, QUOTE_MAX).trimEnd() : s);
  };

  if (recordType === "Opportunity") {
    const name = str(raw, "Name");
    const amount = num(raw, "Amount");
    if (name && amount !== null) for (const a of dollarVariants(amount)) push(`"${name}" — ${str(raw, "StageName") ?? ""}, $${a}, closed ${str(raw, "CloseDate") ?? ""}`);
  } else if (recordType === "OpportunityLineItem") {
    const description = str(raw, "Description");
    const total = num(raw, "TotalPrice");
    if (description && total !== null) for (const a of dollarVariants(total)) push(`${description} $${a}`);
  } else if (recordType === "Contract") {
    const description = str(raw, "Description");
    const status = str(raw, "Status");
    const terms = str(raw, "SpecialTerms");
    if (description && status) push([description, terms, `Status: ${status}`].filter(Boolean).join(" "));
  } else if (recordType === "Order") {
    const total = num(raw, "TotalAmount");
    if (total !== null) {
      for (const a of dollarVariants(total)) {
        push(`Order ${str(raw, "OrderNumber") ?? ""} status ${str(raw, "Status") ?? ""}, effective ${str(raw, "EffectiveDate") ?? ""}, $${a}`);
      }
    }
  } else if (recordType === "fact_payments") {
    const cents = num(raw, "amount_cents");
    const eventId = str(raw, "event_id");
    const status = str(raw, "status");
    if (eventId && status && cents !== null) {
      for (const a of [String(cents), ...dollarVariants(cents / 100)]) push(`payment ${eventId} ${a} ${status}`);
    }
  } else if (recordType === "ticket") {
    push(str(raw, "subject"));
  } else if (recordType === "call") {
    push(str(raw, "title"));
  } else if (recordType === "message") {
    push(str(raw, "text"));
  } else if (recordType === "file") {
    push(str(raw, "content") ?? str(raw, "contentSnippet"));
  }
  if (role === "dispute_signal" || role === "context") push(title);
  return out;
}

/** First candidate that appears verbatim in the record's stored text; otherwise the body's own opening span. */
export function pickQuote(candidates: string[], bodyText: string): { quote: string; verified: boolean } | null {
  for (const c of candidates) if (bodyText.includes(c)) return { quote: c, verified: true };
  const span = bodyText.trim().slice(0, QUOTE_MAX).trimEnd();
  if (span !== "") return { quote: span, verified: true };
  const first = candidates[0];
  return first ? { quote: first, verified: false } : null;
}
