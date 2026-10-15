// FROZEN CONTRACT (contracts-v1). Shared enums + API DTOs used by db, core, agents and web.
// Change only via docs/ccr/*. Money is integer cents everywhere.
import { z } from "zod";

// ---------- enums ----------
export const EraSystem = z.enum(["salesforce", "google-drive", "slack", "gong", "jira-confluence", "zendesk", "aws"]);
export type EraSystem = z.infer<typeof EraSystem>;

export const CustomerStatus = z.enum(["active", "churned", "prospect"]);
export const FindingKind = z.enum(["won_not_billed", "seat_true_up"]);
export const FindingStatus = z.enum([
  "detected", // detector created it
  "analyzing", // analyze workflow running
  "needs_review", // a rule failed / evidence conflict
  "escalated", // dispute or sensitive
  "ready_for_approval", // all checks pass/warn, awaiting human
  "approved", // human approved, invoice pending
  "invoiced", // Stripe invoice finalized (open)
  "recovered", // verified paid via webhook / Stripe fetch
  "rejected", // human rejected
  "failed", // execution error (see audit)
]);
export type FindingStatus = z.infer<typeof FindingStatus>;

export const EvidenceRole = z.enum(["commitment", "contract_term", "billing_state", "usage_signal", "dispute_signal", "context"]);
export const RuleOutcome = z.enum(["pass", "warn", "fail"]);
export const InvoiceStatus = z.enum(["draft", "open", "paid", "void", "uncollectible"]);
export const ReminderStatus = z.enum(["scheduled", "drafted", "sent_simulated", "suppressed", "cancelled"]);
export const ExpansionStatus = z.enum(["detected", "drafted", "pending_approval", "approved", "rejected", "sent_simulated"]);
export const OutboxStatus = z.enum(["pending_approval", "approved", "rejected", "sent_simulated", "suppressed"]);
export const AuditKind = z.enum(["info", "recommendation", "approval_pending", "approval_decision", "action_executed", "outcome_verified", "error"]);
export const ActorType = z.enum(["agent", "operator", "system", "stripe"]);

export const RULE_IDS = ["R-01", "R-02", "R-03", "R-04", "R-05", "R-06", "R-07", "R-08", "R-09", "R-10"] as const;
export const RuleId = z.enum(RULE_IDS);
export type RuleId = z.infer<typeof RuleId>;

// ---------- building blocks ----------
export const Cents = z.number().int().safe();
export const SourceRef = z.object({
  system: EraSystem,
  recordType: z.string(), // e.g. "Opportunity", "Contract", "call", "ticket", "message", "file", "fact_payments"
  externalId: z.string(), // native id, e.g. "deal-24"
  title: z.string(),
  url: z.string().nullable(),
  occurredAt: z.string().nullable(), // ISO
  isFixture: z.boolean(),
});
export type SourceRef = z.infer<typeof SourceRef>;

export const EvidenceDTO = z.object({
  id: z.string().uuid(),
  role: EvidenceRole,
  quote: z.string(), // verbatim span from the source record (redacted)
  verified: z.boolean(), // span found verbatim in source body
  source: SourceRef,
});
export type EvidenceDTO = z.infer<typeof EvidenceDTO>;

export const FindingLineDTO = z.object({
  id: z.string().uuid(),
  description: z.string(),
  quantity: z.number(),
  unitAmountCents: Cents,
  amountCents: Cents,
  dealExternalId: z.string().nullable(),
});

export const CalculationDTO = z.object({
  version: z.string(), // detector version, e.g. "won-not-billed@1"
  formula: z.string(), // human readable, e.g. "Σ closed-won line items without activated order or invoice"
  inputs: z.array(z.object({ label: z.string(), value: z.string(), sourceExternalId: z.string().nullable() })),
  steps: z.array(z.object({ label: z.string(), amountCents: Cents })),
  totalCents: Cents,
  calcHash: z.string(),
});
export type CalculationDTO = z.infer<typeof CalculationDTO>;

export const EligibilityCheckDTO = z.object({ ruleId: RuleId, name: z.string(), outcome: RuleOutcome, detail: z.string() });
export type EligibilityCheckDTO = z.infer<typeof EligibilityCheckDTO>;

export const ExplanationDTO = z.object({
  summary: z.string(), // one sentence
  bodyMd: z.string(), // markdown; citations as [E1]..[En] mapping to citedEvidenceIds order
  citedEvidenceIds: z.array(z.string().uuid()),
  model: z.string(),
  promptVersion: z.string(),
  validated: z.boolean(),
});

export const InvoiceDTO = z.object({
  id: z.string().uuid(),
  stripeInvoiceId: z.string(),
  number: z.string().nullable(),
  status: InvoiceStatus,
  amountDueCents: Cents,
  amountPaidCents: Cents,
  currency: z.string(),
  hostedInvoiceUrl: z.string().nullable(),
  invoicePdf: z.string().nullable(),
  dueDate: z.string().nullable(),
  paidAt: z.string().nullable(),
  lines: z.array(z.object({ description: z.string(), amountCents: Cents, quantity: z.number() })),
  customerName: z.string(),
  findingId: z.string().uuid().nullable(),
  lastSyncedAt: z.string().nullable(),
});
export type InvoiceDTO = z.infer<typeof InvoiceDTO>;

export const AuditEventDTO = z.object({
  id: z.string().uuid(),
  occurredAt: z.string(),
  actorType: ActorType,
  actor: z.string(),
  kind: AuditKind,
  action: z.string(), // dotted, e.g. "finding.detected", "invoice.created", "webhook.invoice.paid"
  summary: z.string(),
  subjectType: z.enum(["finding", "invoice", "customer", "expansion", "outbox", "ingest", "system"]),
  subjectId: z.string().nullable(),
  externalRef: z.string().nullable(), // e.g. Stripe invoice id / event id
  data: z.record(z.string(), z.unknown()),
});
export type AuditEventDTO = z.infer<typeof AuditEventDTO>;

// ---------- API DTOs ----------
export const FindingSummaryDTO = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string(),
  kind: FindingKind,
  status: FindingStatus,
  title: z.string(),
  amountCents: Cents,
  evidenceScore: z.number().int().min(0).max(100),
  evidenceCount: z.number().int(),
  failingRules: z.array(RuleId),
  isFixture: z.boolean(),
  updatedAt: z.string(),
});
export type FindingSummaryDTO = z.infer<typeof FindingSummaryDTO>;

export const FindingDetailDTO = FindingSummaryDTO.extend({
  decisionReason: z.string().nullable(),
  calculation: CalculationDTO,
  lines: z.array(FindingLineDTO),
  evidence: z.array(EvidenceDTO),
  eligibility: z.array(EligibilityCheckDTO),
  explanation: ExplanationDTO.nullable(),
  invoice: InvoiceDTO.nullable(),
  approval: z.object({ decision: z.enum(["approved", "rejected"]), actor: z.string(), note: z.string().nullable(), at: z.string() }).nullable(),
  timeline: z.array(AuditEventDTO),
});
export type FindingDetailDTO = z.infer<typeof FindingDetailDTO>;

export const CustomerSummaryDTO = z.object({
  id: z.string().uuid(),
  eraAccountId: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  status: CustomerStatus,
  tier: z.string().nullable(),
  arrCents: Cents.nullable(),
  openFindingsCents: Cents,
  systems: z.array(EraSystem), // systems where this customer was resolved
});
export type CustomerSummaryDTO = z.infer<typeof CustomerSummaryDTO>;

export const CustomerDetailDTO = CustomerSummaryDTO.extend({
  licensedSeats: z.number().int().nullable(),
  renewalDate: z.string().nullable(),
  identities: z.array(z.object({ system: EraSystem, externalId: z.string(), matchMethod: z.string() })),
  deals: z.array(z.object({ externalId: z.string(), name: z.string(), stage: z.string(), isWon: z.boolean(), amountCents: Cents.nullable(), closeDate: z.string().nullable() })),
  contracts: z.array(z.object({ externalId: z.string(), status: z.string(), startDate: z.string().nullable(), endDate: z.string().nullable(), description: z.string().nullable(), specialTerms: z.string().nullable() })),
  orders: z.array(z.object({ externalId: z.string(), status: z.string(), dealExternalId: z.string().nullable(), totalCents: Cents.nullable(), effectiveDate: z.string().nullable() })),
  invoices: z.array(InvoiceDTO),
  findings: z.array(FindingSummaryDTO),
  recentSources: z.array(SourceRef),
});
export type CustomerDetailDTO = z.infer<typeof CustomerDetailDTO>;

export const OverviewDTO = z.object({
  recoverableCents: Cents, // sum of open findings (not rejected/recovered)
  awaitingPaymentCents: Cents, // open invoices
  recoveredCents: Cents, // paid invoices from findings
  findingsByStatus: z.record(z.string(), z.number().int()),
  systemsConnected: z.array(z.object({ system: EraSystem, records: z.number().int(), lastSyncedAt: z.string().nullable() })),
  topFindings: z.array(FindingSummaryDTO),
  recentRecoveries: z.array(InvoiceDTO),
  needsAttention: z.array(z.object({ kind: z.enum(["needs_review", "escalated", "payment_failed", "overdue"]), title: z.string(), href: z.string() })),
});
export type OverviewDTO = z.infer<typeof OverviewDTO>;

export const ActivityItemDTO = AuditEventDTO; // the agent activity stream is the audit feed
export const PageDTO = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const CollectionItemDTO = z.object({
  invoice: InvoiceDTO,
  daysOverdue: z.number().int(), // negative = days until due
  nextAction: z.enum(["none", "send_reminder", "escalate_dispute", "await_payment", "suppressed_paid"]),
  disputeSignals: z.array(EvidenceDTO),
  reminders: z.array(z.object({ id: z.string().uuid(), step: z.number().int(), status: ReminderStatus, scheduledFor: z.string(), suppressedReason: z.string().nullable() })),
});
export type CollectionItemDTO = z.infer<typeof CollectionItemDTO>;

export const ExpansionDTO = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string(),
  status: ExpansionStatus,
  title: z.string(),
  rationale: z.string(),
  signalScore: z.number().int().min(0).max(100),
  existingOpenDeals: z.number().int(),
  evidence: z.array(EvidenceDTO),
  draftMessageId: z.string().uuid().nullable(),
});
export type ExpansionDTO = z.infer<typeof ExpansionDTO>;

export const OutboxMessageDTO = z.object({
  id: z.string().uuid(),
  kind: z.enum(["collection_reminder", "expansion_email"]),
  status: OutboxStatus,
  toAddress: z.string(), // always @OUTBOX_SANDBOX_DOMAIN
  originalRecipient: z.string().nullable(),
  subject: z.string(),
  bodyMd: z.string(),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  relatedHref: z.string().nullable(),
});
export type OutboxMessageDTO = z.infer<typeof OutboxMessageDTO>;

export const IngestRunDTO = z.object({
  id: z.string().uuid(),
  status: z.enum(["running", "succeeded", "partial", "failed"]),
  source: z.enum(["live", "fixtures"]),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  stats: z.record(z.string(), z.number()),
  error: z.string().nullable(),
});

// ---------- request bodies ----------
export const ApproveBody = z.object({ note: z.string().max(500).optional() });
export const RejectBody = z.object({ reason: z.string().min(3).max(500) });
export const LoginBody = z.object({ password: z.string().min(1) });
export const IngestBody = z.object({ source: z.enum(["live", "fixtures"]).default("fixtures") });

// ---------- error envelope ----------
export const ERROR_CODES = [
  "VALIDATION",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "INVALID_STATE",
  "CONFLICT",
  "POLICY_BLOCKED",
  "UPSTREAM_ERA",
  "UPSTREAM_STRIPE",
  "UPSTREAM_COGNEE",
  "UPSTREAM_LLM",
  "WEBHOOK_SIGNATURE",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export const ErrorEnvelope = z.object({ error: z.object({ code: z.enum(ERROR_CODES), message: z.string(), details: z.record(z.string(), z.unknown()).optional() }) });
