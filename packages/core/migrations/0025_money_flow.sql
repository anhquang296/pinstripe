CREATE TABLE "balance_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"type" text NOT NULL,
	"currency" text NOT NULL,
	"gross" bigint NOT NULL,
	"fee" bigint DEFAULT 0 NOT NULL,
	"net" bigint NOT NULL,
	"available_on" timestamp with time zone NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"payout_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"charge_id" text NOT NULL,
	"payment_intent_id" text NOT NULL,
	"invoice_id" text,
	"customer_id" text NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence_submitted_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"psp_reference" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"credit_note_id" text NOT NULL,
	"invoice_line_item_id" text,
	"description" text DEFAULT '' NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"unit_amount" bigint,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"credit_note_id" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"refund_id" text NOT NULL,
	"status" text NOT NULL,
	"failure_reason" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"status" text NOT NULL,
	"statement_descriptor" text,
	"arrival_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"failure_code" text,
	"failure_message" text,
	"psp_reference" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refunds" ALTER COLUMN "charge_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "refund_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "out_of_band_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "credit_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "refund_id" text;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "ledger_transaction_id" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "credit_note_id" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_line_items" ADD CONSTRAINT "credit_note_line_items_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_line_items" ADD CONSTRAINT "credit_note_line_items_invoice_line_item_id_invoice_line_items_id_fk" FOREIGN KEY ("invoice_line_item_id") REFERENCES "public"."invoice_line_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_transitions" ADD CONSTRAINT "credit_note_transitions_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_transitions" ADD CONSTRAINT "refund_transitions_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balance_transactions_source_idx" ON "balance_transactions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "balance_transactions_payout_id_idx" ON "balance_transactions" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "balance_transactions_available_on_idx" ON "balance_transactions" USING btree ("available_on");--> statement-breakpoint
CREATE INDEX "balance_transactions_created_at_id_idx" ON "balance_transactions" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "disputes_charge_id_idx" ON "disputes" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "disputes_customer_id_idx" ON "disputes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disputes_created_at_id_idx" ON "disputes" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_psp_reference_idx" ON "disputes" USING btree ("psp_reference");--> statement-breakpoint
CREATE INDEX "credit_note_line_items_credit_note_id_idx" ON "credit_note_line_items" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "credit_note_transitions_credit_note_id_idx" ON "credit_note_transitions" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "credit_note_transitions_occurred_at_id_idx" ON "credit_note_transitions" USING btree ("occurred_at","id");--> statement-breakpoint
CREATE INDEX "refund_transitions_refund_id_idx" ON "refund_transitions" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "refund_transitions_occurred_at_id_idx" ON "refund_transitions" USING btree ("occurred_at","id");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payouts_created_at_id_idx" ON "payouts" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_psp_reference_idx" ON "payouts" USING btree ("psp_reference") WHERE psp_reference is not null;