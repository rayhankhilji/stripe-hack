// FROZEN CONTRACT (contracts-v1). Drizzle schema for Ghost's authoritative state.
// Works on Postgres (Supabase) and PGlite (local/dev/tests). Money = bigint cents (mode: "number").
import { sql } from "drizzle-orm";
import type { CalculationDTO } from "@ghost/shared";
import {
  pgTable, pgEnum, uuid, text, timestamp, boolean, integer, bigint, jsonb, date, numeric, uniqueIndex, index, check,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const cents = (name: string) => bigint(name, { mode: "number" });

export const eraSystem = pgEnum("era_system", ["salesforce", "google-drive", "slack", "gong", "jira-confluence", "zendesk", "aws"]);
export const customerStatus = pgEnum("customer_status", ["active", "churned", "prospect"]);
export const findingKind = pgEnum("finding_kind", ["won_not_billed", "seat_true_up"]);
export const findingStatus = pgEnum("finding_status", [
  "detected", "analyzing", "needs_review", "escalated", "ready_for_approval", "approved", "invoiced", "recovered", "rejected", "failed",
]);
export const evidenceRole = pgEnum("evidence_role", ["commitment", "contract_term", "billing_state", "usage_signal", "dispute_signal", "context"]);
export const ruleOutcome = pgEnum("rule_outcome", ["pass", "warn", "fail"]);
export const invoiceStatus = pgEnum("invoice_status", ["draft", "open", "paid", "void", "uncollectible"]);
export const reminderStatus = pgEnum("reminder_status", ["scheduled", "drafted", "sent_simulated", "suppressed", "cancelled"]);
export const expansionStatus = pgEnum("expansion_status", ["detected", "drafted", "pending_approval", "approved", "rejected", "sent_simulated"]);
export const outboxStatus = pgEnum("outbox_status", ["pending_approval", "approved", "rejected", "sent_simulated", "suppressed"]);
export const outboxKind = pgEnum("outbox_kind", ["collection_reminder", "expansion_email"]);
export const auditKind = pgEnum("audit_kind", ["info", "recommendation", "approval_pending", "approval_decision", "action_executed", "outcome_verified", "error"]);
export const actorType = pgEnum("actor_type", ["agent", "operator", "system", "stripe"]);
export const runStatus = pgEnum("run_status", ["running", "succeeded", "partial", "failed"]);
export const stripeEventStatus = pgEnum("stripe_event_status", ["received", "processed", "ignored", "failed"]);

// ---------- ingestion ----------
export const ingestRun = pgTable("ingest_run", {
  id: id(),
  source: text("source", { enum: ["live", "fixtures"] }).notNull(),
  status: runStatus("status").notNull().default("running"),
  stats: jsonb("stats").$type<Record<string, number>>().notNull().default({}),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const customer = pgTable("customer", {
  id: id(),
  eraAccountId: text("era_account_id").notNull().unique(), // "acct-6"
  name: text("name").notNull(),
  domain: text("domain"),
  status: customerStatus("status").notNull().default("active"),
  tier: text("tier"),
  segment: text("segment"),
  arrCents: cents("arr_cents"),
  licensedSeats: integer("licensed_seats"),
  renewalDate: date("renewal_date"),
  billingEmail: text("billing_email"), // original contact email (never emailed; outbox rewrites to sandbox)
  stripeCustomerId: text("stripe_customer_id").unique(),
  isFixture: boolean("is_fixture").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Every raw record pulled from Era (redacted). Provenance for every claim. */
export const sourceRecord = pgTable("source_record", {
  id: id(),
  system: eraSystem("system").notNull(),
  recordType: text("record_type").notNull(), // Opportunity | Contract | Order | OrderItem | OpportunityLineItem | Account | Case | ticket | call | transcript | message | file | fact_payments | fact_ledger_entries ...
  externalId: text("external_id").notNull(),
  customerId: uuid("customer_id").references(() => customer.id),
  title: text("title").notNull(),
  bodyText: text("body_text").notNull().default(""), // redacted plain text used for quotes/span verification + FTS
  url: text("url"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }),
  raw: jsonb("raw").$type<Record<string, unknown>>().notNull(),
  contentHash: text("content_hash").notNull(),
  isFixture: boolean("is_fixture").notNull().default(false),
  fixtureLabel: text("fixture_label"),
  ingestRunId: uuid("ingest_run_id").references(() => ingestRun.id),
  cogneeSyncedAt: timestamp("cognee_synced_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("source_record_natural_key").on(t.system, t.recordType, t.externalId),
  index("source_record_customer_idx").on(t.customerId),
]);

export const customerIdentity = pgTable("customer_identity", {
  id: id(),
  customerId: uuid("customer_id").notNull().references(() => customer.id),
  system: eraSystem("system").notNull(),
  externalId: text("external_id").notNull(), // e.g. zendesk "3000006", slack channel "acct-6"
  matchMethod: text("match_method", { enum: ["exact_id", "external_id", "domain", "name"] }).notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("customer_identity_system_ext").on(t.system, t.externalId)]);

// ---------- normalized commercial records (from Salesforce) ----------
export const deal = pgTable("deal", {
  id: id(),
  customerId: uuid("customer_id").notNull().references(() => customer.id),
  externalId: text("external_id").notNull().unique(), // "deal-24"
  name: text("name").notNull(),
  stage: text("stage").notNull(),
  isClosed: boolean("is_closed").notNull(),
  isWon: boolean("is_won").notNull(),
  amountCents: cents("amount_cents"),
  closeDate: date("close_date"),
  sourceRecordId: uuid("source_record_id").notNull().references(() => sourceRecord.id),
});

export const dealLineItem = pgTable("deal_line_item", {
  id: id(),
  dealId: uuid("deal_id").notNull().references(() => deal.id),
  externalId: text("external_id").notNull().unique(),
  productName: text("product_name").notNull(),
  quantity: numeric("quantity", { mode: "number" }).notNull(),
  unitPriceCents: cents("unit_price_cents").notNull(),
  totalCents: cents("total_cents").notNull(),
  sourceRecordId: uuid("source_record_id").notNull().references(() => sourceRecord.id),
});

export const contract = pgTable("contract", {
  id: id(),
  customerId: uuid("customer_id").notNull().references(() => customer.id),
  externalId: text("external_id").notNull().unique(), // "contract-4"
  status: text("status").notNull(), // "Activated" | "In Approval Process" | "Draft" | "Expired"
  startDate: date("start_date"),
  endDate: date("end_date"),
  termMonths: integer("term_months"),
  description: text("description"),
  specialTerms: text("special_terms"),
  sourceRecordId: uuid("source_record_id").notNull().references(() => sourceRecord.id),
});

export const salesOrder = pgTable("sales_order", {
  id: id(),
  customerId: uuid("customer_id").notNull().references(() => customer.id),
  externalId: text("external_id").notNull().unique(), // "order-24"
  dealId: uuid("deal_id").references(() => deal.id),
  contractId: uuid("contract_id").references(() => contract.id),
  status: text("status").notNull(), // "Draft" | "Activated"
  effectiveDate: date("effective_date"),
  totalCents: cents("total_cents"),
  sourceRecordId: uuid("source_record_id").notNull().references(() => sourceRecord.id),
});

// ---------- findings (recovery cases) ----------
export const finding = pgTable("finding", {
  id: id(),
  customerId: uuid("customer_id").notNull().references(() => customer.id),
  kind: findingKind("kind").notNull(),
  status: findingStatus("status").notNull().default("detected"),
  title: text("title").notNull(),
  amountCents: cents("amount_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  calculation: jsonb("calculation").$type<CalculationDTO>().notNull(),
  calcHash: text("calc_hash").notNull(),
  evidenceScore: integer("evidence_score").notNull().default(0),
  decisionReason: text("decision_reason"),
  workflowRunId: text("workflow_run_id"),
  isFixture: boolean("is_fixture").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("finding_dedupe").on(t.customerId, t.kind, t.calcHash),
  index("finding_status_idx").on(t.status),
]);

export const findingLine = pgTable("finding_line", {
  id: id(),
  findingId: uuid("finding_id").notNull().references(() => finding.id, { onDelete: "cascade" }),
  dealId: uuid("deal_id").references(() => deal.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { mode: "number" }).notNull(),
  unitAmountCents: cents("unit_amount_cents").notNull(),
  amountCents: cents("amount_cents").notNull(),
  sourceRecordId: uuid("source_record_id").references(() => sourceRecord.id),
});

export const expansionOpportunity = pgTable("expansion_opportunity", {
  id: id(),
  customerId: uuid("customer_id").notNull().references(() => customer.id),
  status: expansionStatus("status").notNull().default("detected"),
  title: text("title").notNull(),
  rationale: text("rationale").notNull(),
  signalScore: integer("signal_score").notNull(),
  existingOpenDeals: integer("existing_open_deals").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("expansion_dedupe").on(t.customerId, t.title)]);

/** Evidence links a finding OR an expansion to a source record with a verbatim quote. */
export const evidence = pgTable("evidence", {
  id: id(),
  findingId: uuid("finding_id").references(() => finding.id, { onDelete: "cascade" }),
  expansionId: uuid("expansion_id").references(() => expansionOpportunity.id, { onDelete: "cascade" }),
  sourceRecordId: uuid("source_record_id").notNull().references(() => sourceRecord.id),
  role: evidenceRole("role").notNull(),
  quote: text("quote").notNull(),
  verified: boolean("verified").notNull().default(false),
  createdAt: createdAt(),
}, (t) => [
  check("evidence_one_subject", sql`(${t.findingId} is null) <> (${t.expansionId} is null)`),
  uniqueIndex("evidence_dedupe").on(t.findingId, t.expansionId, t.sourceRecordId, t.role),
]);

export const eligibilityCheck = pgTable("eligibility_check", {
  id: id(),
  findingId: uuid("finding_id").notNull().references(() => finding.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull(), // R-01..R-10
  name: text("name").notNull(),
  outcome: ruleOutcome("outcome").notNull(),
  detail: text("detail").notNull(),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("eligibility_finding_rule").on(t.findingId, t.ruleId)]);

export const explanation = pgTable("explanation", {
  findingId: uuid("finding_id").primaryKey().references(() => finding.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  bodyMd: text("body_md").notNull(),
  citedEvidenceIds: jsonb("cited_evidence_ids").$type<string[]>().notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  validated: boolean("validated").notNull(),
  createdAt: createdAt(),
});

export const approval = pgTable("approval", {
  id: id(),
  findingId: uuid("finding_id").notNull().references(() => finding.id, { onDelete: "cascade" }),
  decision: text("decision", { enum: ["approved", "rejected"] }).notNull(),
  actor: text("actor").notNull(),
  note: text("note"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("approval_one_per_finding").on(t.findingId)]);

// ---------- Stripe ----------
export const invoice = pgTable("invoice", {
  id: id(),
  findingId: uuid("finding_id").references(() => finding.id).unique(),
  customerId: uuid("customer_id").notNull().references(() => customer.id),
  stripeInvoiceId: text("stripe_invoice_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  number: text("number"),
  status: invoiceStatus("status").notNull(),
  amountDueCents: cents("amount_due_cents").notNull(),
  amountPaidCents: cents("amount_paid_cents").notNull().default(0),
  currency: text("currency").notNull().default("usd"),
  hostedInvoiceUrl: text("hosted_invoice_url"),
  invoicePdf: text("invoice_pdf"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  lastPaymentError: text("last_payment_error"),
  lines: jsonb("lines").$type<{ description: string; amountCents: number; quantity: number }[]>().notNull().default([]),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const stripeEvent = pgTable("stripe_event", {
  id: text("id").primaryKey(), // evt_...
  type: text("type").notNull(),
  livemode: boolean("livemode").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: stripeEventStatus("status").notNull().default("received"),
  error: text("error"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

// ---------- collections / outbox ----------
export const outboxMessage = pgTable("outbox_message", {
  id: id(),
  kind: outboxKind("kind").notNull(),
  status: outboxStatus("status").notNull().default("pending_approval"),
  toAddress: text("to_address").notNull(), // always @OUTBOX_SANDBOX_DOMAIN
  originalRecipient: text("original_recipient"),
  subject: text("subject").notNull(),
  bodyMd: text("body_md").notNull(),
  invoiceId: uuid("invoice_id").references(() => invoice.id),
  expansionId: uuid("expansion_id").references(() => expansionOpportunity.id),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const collectionReminder = pgTable("collection_reminder", {
  id: id(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoice.id, { onDelete: "cascade" }),
  step: integer("step").notNull(), // 1 = due-soon, 2 = due-date, 3 = +7d overdue
  status: reminderStatus("status").notNull().default("scheduled"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  suppressedReason: text("suppressed_reason"),
  outboxMessageId: uuid("outbox_message_id").references(() => outboxMessage.id),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("reminder_invoice_step").on(t.invoiceId, t.step)]);

// ---------- audit ----------
export const auditEvent = pgTable("audit_event", {
  id: id(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  actorType: actorType("actor_type").notNull(),
  actor: text("actor").notNull(),
  kind: auditKind("kind").notNull(),
  action: text("action").notNull(),
  summary: text("summary").notNull(),
  subjectType: text("subject_type", { enum: ["finding", "invoice", "customer", "expansion", "outbox", "ingest", "system"] }).notNull(),
  subjectId: text("subject_id"),
  externalRef: text("external_ref"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [
  index("audit_subject_idx").on(t.subjectType, t.subjectId, t.occurredAt),
  index("audit_time_idx").on(t.occurredAt),
]);
