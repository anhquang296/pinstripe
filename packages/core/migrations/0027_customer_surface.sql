CREATE TABLE "billing_portal_configurations" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"business_name" text NOT NULL,
	"default_return_url" text,
	"features" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_portal_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"customer_id" text NOT NULL,
	"configuration_id" text NOT NULL,
	"portal_session_id" text NOT NULL,
	"url" text NOT NULL,
	"return_url" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkout_session_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"checkout_session_id" text NOT NULL,
	"price_id" text NOT NULL,
	"quantity" bigint NOT NULL,
	"amount_subtotal" bigint NOT NULL,
	"amount_total" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"payment_status" text NOT NULL,
	"customer_id" text NOT NULL,
	"currency" text NOT NULL,
	"amount_subtotal" bigint DEFAULT 0 NOT NULL,
	"amount_total" bigint DEFAULT 0 NOT NULL,
	"success_url" text NOT NULL,
	"cancel_url" text,
	"url" text,
	"client_reference_id" text,
	"payment_link_id" text,
	"subscription_id" text,
	"invoice_id" text,
	"payment_intent_id" text,
	"setup_intent_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_link_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"payment_link_id" text NOT NULL,
	"price_id" text NOT NULL,
	"quantity" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_links" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"mode" text NOT NULL,
	"currency" text NOT NULL,
	"url" text NOT NULL,
	"success_url" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"customer_id" text NOT NULL,
	"status" text NOT NULL,
	"link_token_hash" text NOT NULL,
	"session_token_hash" text,
	"link_expires_at" timestamp with time zone NOT NULL,
	"session_expires_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "hosted_invoice_url" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "invoice_pdf" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_portal_sessions" ADD CONSTRAINT "billing_portal_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_portal_sessions" ADD CONSTRAINT "billing_portal_sessions_configuration_id_billing_portal_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."billing_portal_configurations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_portal_sessions" ADD CONSTRAINT "billing_portal_sessions_portal_session_id_portal_sessions_id_fk" FOREIGN KEY ("portal_session_id") REFERENCES "public"."portal_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_session_line_items" ADD CONSTRAINT "checkout_session_line_items_checkout_session_id_checkout_sessions_id_fk" FOREIGN KEY ("checkout_session_id") REFERENCES "public"."checkout_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_session_line_items" ADD CONSTRAINT "checkout_session_line_items_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_payment_link_id_payment_links_id_fk" FOREIGN KEY ("payment_link_id") REFERENCES "public"."payment_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_setup_intent_id_setup_intents_id_fk" FOREIGN KEY ("setup_intent_id") REFERENCES "public"."setup_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_link_line_items" ADD CONSTRAINT "payment_link_line_items_payment_link_id_payment_links_id_fk" FOREIGN KEY ("payment_link_id") REFERENCES "public"."payment_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_link_line_items" ADD CONSTRAINT "payment_link_line_items_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_portal_configurations_default_idx" ON "billing_portal_configurations" USING btree ("livemode") WHERE is_default;--> statement-breakpoint
CREATE INDEX "billing_portal_configurations_created_at_id_idx" ON "billing_portal_configurations" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "billing_portal_sessions_customer_id_idx" ON "billing_portal_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "billing_portal_sessions_created_at_id_idx" ON "billing_portal_sessions" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "checkout_session_line_items_session_id_idx" ON "checkout_session_line_items" USING btree ("checkout_session_id");--> statement-breakpoint
CREATE INDEX "checkout_sessions_customer_id_idx" ON "checkout_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "checkout_sessions_status_expires_at_idx" ON "checkout_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "checkout_sessions_created_at_id_idx" ON "checkout_sessions" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "payment_link_line_items_payment_link_id_idx" ON "payment_link_line_items" USING btree ("payment_link_id");--> statement-breakpoint
CREATE INDEX "payment_links_created_at_id_idx" ON "payment_links" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_sessions_link_token_hash_idx" ON "portal_sessions" USING btree ("link_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_sessions_session_token_hash_idx" ON "portal_sessions" USING btree ("session_token_hash") WHERE session_token_hash is not null;--> statement-breakpoint
CREATE INDEX "portal_sessions_customer_id_idx" ON "portal_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "portal_sessions_created_at_id_idx" ON "portal_sessions" USING btree ("created_at","id");