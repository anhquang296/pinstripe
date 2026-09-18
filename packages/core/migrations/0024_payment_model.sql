CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"customer_id" text,
	"type" text NOT NULL,
	"card" jsonb,
	"billing_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"psp_token" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"detached_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "charges" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"payment_intent_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"payment_method_id" text,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"amount_captured" bigint DEFAULT 0 NOT NULL,
	"amount_refunded" bigint DEFAULT 0 NOT NULL,
	"captured" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"outcome" text NOT NULL,
	"balance_transaction_id" text,
	"payment_method_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"failure_code" text,
	"decline_code" text,
	"failure_message" text,
	"psp_reference" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psp_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setup_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"customer_id" text NOT NULL,
	"status" text NOT NULL,
	"usage" text DEFAULT 'off_session' NOT NULL,
	"payment_method_id" text,
	"next_action" jsonb,
	"cancellation_reason" text,
	"psp_reference" text,
	"failure_code" text,
	"failure_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "payment_attempts" CASCADE;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "default_payment_method_id" text;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD COLUMN "charge_id" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "amount_capturable" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "amount_received" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "capture_method" text DEFAULT 'automatic' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "payment_method_id" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "latest_charge_id" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "next_action" jsonb;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "decline_code" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "charge_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "default_payment_method_id" text;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup_intents" ADD CONSTRAINT "setup_intents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup_intents" ADD CONSTRAINT "setup_intents_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_methods_customer_id_idx" ON "payment_methods" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payment_methods_created_at_id_idx" ON "payment_methods" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "charges_payment_intent_id_idx" ON "charges" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "charges_customer_id_idx" ON "charges" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "charges_created_at_id_idx" ON "charges" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "psp_events_provider_event_id_idx" ON "psp_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "psp_events_received_at_id_idx" ON "psp_events" USING btree ("received_at","id");--> statement-breakpoint
CREATE INDEX "setup_intents_customer_id_idx" ON "setup_intents" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "setup_intents_created_at_id_idx" ON "setup_intents" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "setup_intents_psp_reference_idx" ON "setup_intents" USING btree ("psp_reference");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_default_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("default_payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_default_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("default_payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_payments_settlement_reference_idx" ON "invoice_payments" USING btree ("livemode","settlement_reference") WHERE settlement_reference is not null;--> statement-breakpoint
CREATE INDEX "refunds_charge_id_idx" ON "refunds" USING btree ("charge_id");--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN "default_payment_method";--> statement-breakpoint
ALTER TABLE "payment_intents" DROP COLUMN "payment_method";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "default_payment_method";