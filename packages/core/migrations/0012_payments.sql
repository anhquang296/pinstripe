CREATE TABLE "payment_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_intent_id" text NOT NULL,
	"payment_method" text NOT NULL,
	"outcome" text NOT NULL,
	"psp_reference" text,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"status" text NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"payment_method" text,
	"psp_reference" text,
	"failure_code" text,
	"failure_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_intent_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"reason" text NOT NULL,
	"psp_reference" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_attempts_payment_intent_id_idx" ON "payment_attempts" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "payment_intents_invoice_id_idx" ON "payment_intents" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payment_intents_customer_id_idx" ON "payment_intents" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payment_intents_created_at_id_idx" ON "payment_intents" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_intents_psp_reference_idx" ON "payment_intents" USING btree ("psp_reference");--> statement-breakpoint
CREATE INDEX "refunds_invoice_id_idx" ON "refunds" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "refunds_payment_intent_id_idx" ON "refunds" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "refunds_created_at_id_idx" ON "refunds" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_psp_reference_idx" ON "refunds" USING btree ("psp_reference");