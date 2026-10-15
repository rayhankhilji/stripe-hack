CREATE TYPE "public"."actor_type" AS ENUM('agent', 'operator', 'system', 'stripe');--> statement-breakpoint
CREATE TYPE "public"."audit_kind" AS ENUM('info', 'recommendation', 'approval_pending', 'approval_decision', 'action_executed', 'outcome_verified', 'error');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('active', 'churned', 'prospect');--> statement-breakpoint
CREATE TYPE "public"."era_system" AS ENUM('salesforce', 'google-drive', 'slack', 'gong', 'jira-confluence', 'zendesk', 'aws');--> statement-breakpoint
CREATE TYPE "public"."evidence_role" AS ENUM('commitment', 'contract_term', 'billing_state', 'usage_signal', 'dispute_signal', 'context');--> statement-breakpoint
CREATE TYPE "public"."expansion_status" AS ENUM('detected', 'drafted', 'pending_approval', 'approved', 'rejected', 'sent_simulated');--> statement-breakpoint
CREATE TYPE "public"."finding_kind" AS ENUM('won_not_billed', 'seat_true_up');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('detected', 'analyzing', 'needs_review', 'escalated', 'ready_for_approval', 'approved', 'invoiced', 'recovered', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible');--> statement-breakpoint
CREATE TYPE "public"."outbox_kind" AS ENUM('collection_reminder', 'expansion_email');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending_approval', 'approved', 'rejected', 'sent_simulated', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('scheduled', 'drafted', 'sent_simulated', 'suppressed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rule_outcome" AS ENUM('pass', 'warn', 'fail');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'succeeded', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."stripe_event_status" AS ENUM('received', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TABLE "approval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"actor" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor" text NOT NULL,
	"kind" "audit_kind" NOT NULL,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text,
	"external_ref" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"status" "reminder_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"suppressed_reason" text,
	"outbox_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"status" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"term_months" integer,
	"description" text,
	"special_terms" text,
	"source_record_id" uuid NOT NULL,
	CONSTRAINT "contract_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"era_account_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"status" "customer_status" DEFAULT 'active' NOT NULL,
	"tier" text,
	"segment" text,
	"arr_cents" bigint,
	"licensed_seats" integer,
	"renewal_date" date,
	"billing_email" text,
	"stripe_customer_id" text,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_era_account_id_unique" UNIQUE("era_account_id"),
	CONSTRAINT "customer_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "customer_identity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"system" "era_system" NOT NULL,
	"external_id" text NOT NULL,
	"match_method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"stage" text NOT NULL,
	"is_closed" boolean NOT NULL,
	"is_won" boolean NOT NULL,
	"amount_cents" bigint,
	"close_date" date,
	"source_record_id" uuid NOT NULL,
	CONSTRAINT "deal_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "deal_line_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity" numeric NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"total_cents" bigint NOT NULL,
	"source_record_id" uuid NOT NULL,
	CONSTRAINT "deal_line_item_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "eligibility_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"name" text NOT NULL,
	"outcome" "rule_outcome" NOT NULL,
	"detail" text NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid,
	"expansion_id" uuid,
	"source_record_id" uuid NOT NULL,
	"role" "evidence_role" NOT NULL,
	"quote" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_one_subject" CHECK (("evidence"."finding_id" is null) <> ("evidence"."expansion_id" is null))
);
--> statement-breakpoint
CREATE TABLE "expansion_opportunity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "expansion_status" DEFAULT 'detected' NOT NULL,
	"title" text NOT NULL,
	"rationale" text NOT NULL,
	"signal_score" integer NOT NULL,
	"existing_open_deals" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "explanation" (
	"finding_id" uuid PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"body_md" text NOT NULL,
	"cited_evidence_ids" jsonb NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"validated" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"kind" "finding_kind" NOT NULL,
	"status" "finding_status" DEFAULT 'detected' NOT NULL,
	"title" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"calculation" jsonb NOT NULL,
	"calc_hash" text NOT NULL,
	"evidence_score" integer DEFAULT 0 NOT NULL,
	"decision_reason" text,
	"workflow_run_id" text,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finding_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"deal_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric NOT NULL,
	"unit_amount_cents" bigint NOT NULL,
	"amount_cents" bigint NOT NULL,
	"source_record_id" uuid
);
--> statement-breakpoint
CREATE TABLE "ingest_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid,
	"customer_id" uuid NOT NULL,
	"stripe_invoice_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"number" text,
	"status" "invoice_status" NOT NULL,
	"amount_due_cents" bigint NOT NULL,
	"amount_paid_cents" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"hosted_invoice_url" text,
	"invoice_pdf" text,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"last_payment_error" text,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_finding_id_unique" UNIQUE("finding_id"),
	CONSTRAINT "invoice_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id"),
	CONSTRAINT "invoice_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "outbox_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "outbox_kind" NOT NULL,
	"status" "outbox_status" DEFAULT 'pending_approval' NOT NULL,
	"to_address" text NOT NULL,
	"original_recipient" text,
	"subject" text NOT NULL,
	"body_md" text NOT NULL,
	"invoice_id" uuid,
	"expansion_id" uuid,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"deal_id" uuid,
	"contract_id" uuid,
	"status" text NOT NULL,
	"effective_date" date,
	"total_cents" bigint,
	"source_record_id" uuid NOT NULL,
	CONSTRAINT "sales_order_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "source_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system" "era_system" NOT NULL,
	"record_type" text NOT NULL,
	"external_id" text NOT NULL,
	"customer_id" uuid,
	"title" text NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"url" text,
	"occurred_at" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"fixture_label" text,
	"ingest_run_id" uuid,
	"cognee_synced_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_event" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"livemode" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "stripe_event_status" DEFAULT 'received' NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "approval" ADD CONSTRAINT "approval_finding_id_finding_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."finding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_reminder" ADD CONSTRAINT "collection_reminder_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_reminder" ADD CONSTRAINT "collection_reminder_outbox_message_id_outbox_message_id_fk" FOREIGN KEY ("outbox_message_id") REFERENCES "public"."outbox_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_source_record_id_source_record_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_identity" ADD CONSTRAINT "customer_identity_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_source_record_id_source_record_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_line_item" ADD CONSTRAINT "deal_line_item_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_line_item" ADD CONSTRAINT "deal_line_item_source_record_id_source_record_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_check" ADD CONSTRAINT "eligibility_check_finding_id_finding_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."finding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_finding_id_finding_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."finding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_expansion_id_expansion_opportunity_id_fk" FOREIGN KEY ("expansion_id") REFERENCES "public"."expansion_opportunity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_source_record_id_source_record_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expansion_opportunity" ADD CONSTRAINT "expansion_opportunity_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanation" ADD CONSTRAINT "explanation_finding_id_finding_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."finding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding" ADD CONSTRAINT "finding_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_line" ADD CONSTRAINT "finding_line_finding_id_finding_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."finding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_line" ADD CONSTRAINT "finding_line_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_line" ADD CONSTRAINT "finding_line_source_record_id_source_record_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_finding_id_finding_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."finding"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_message" ADD CONSTRAINT "outbox_message_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_message" ADD CONSTRAINT "outbox_message_expansion_id_expansion_opportunity_id_fk" FOREIGN KEY ("expansion_id") REFERENCES "public"."expansion_opportunity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_contract_id_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contract"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_source_record_id_source_record_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_record" ADD CONSTRAINT "source_record_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_record" ADD CONSTRAINT "source_record_ingest_run_id_ingest_run_id_fk" FOREIGN KEY ("ingest_run_id") REFERENCES "public"."ingest_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "approval_one_per_finding" ON "approval" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "audit_subject_idx" ON "audit_event" USING btree ("subject_type","subject_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_time_idx" ON "audit_event" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_invoice_step" ON "collection_reminder" USING btree ("invoice_id","step");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_identity_system_ext" ON "customer_identity" USING btree ("system","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "eligibility_finding_rule" ON "eligibility_check" USING btree ("finding_id","rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_dedupe" ON "evidence" USING btree ("finding_id","expansion_id","source_record_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "expansion_dedupe" ON "expansion_opportunity" USING btree ("customer_id","title");--> statement-breakpoint
CREATE UNIQUE INDEX "finding_dedupe" ON "finding" USING btree ("customer_id","kind","calc_hash");--> statement-breakpoint
CREATE INDEX "finding_status_idx" ON "finding" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "source_record_natural_key" ON "source_record" USING btree ("system","record_type","external_id");--> statement-breakpoint
CREATE INDEX "source_record_customer_idx" ON "source_record" USING btree ("customer_id");