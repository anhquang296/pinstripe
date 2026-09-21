CREATE SCHEMA "billing";
--> statement-breakpoint
CREATE TABLE "billing"."balance_transactions" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "billing"."billing_portal_configurations" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "billing"."billing_portal_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"configuration_id" text NOT NULL,
	"portal_session_id" text NOT NULL,
	"url" text NOT NULL,
	"return_url" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."checkout_session_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"checkout_session_id" text NOT NULL,
	"price_id" text NOT NULL,
	"quantity" bigint NOT NULL,
	"amount_subtotal" bigint NOT NULL,
	"amount_total" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."checkout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "billing"."collection_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"collection_method" text NOT NULL,
	"requested_amount" bigint NOT NULL,
	"applied_amount" bigint DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"external_reference" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."customer_balance_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"invoice_id" text,
	"credit_note_id" text,
	"type" text NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"ending_balance" bigint NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."customers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"tax_id" text,
	"tax_exempt" text DEFAULT 'none' NOT NULL,
	"address" jsonb,
	"currency" text NOT NULL,
	"default_payment_method_id" text,
	"test_clock_id" text,
	"partner_platform" text,
	"partner_account_id" text,
	"balance" bigint DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "customers_partner_pair" CHECK ((partner_platform is null) = (partner_account_id is null))
);
--> statement-breakpoint
CREATE TABLE "billing"."coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"percent_off" double precision,
	"amount_off" bigint,
	"currency" text,
	"duration" text NOT NULL,
	"duration_in_months" integer,
	"max_redemptions" integer,
	"times_redeemed" integer DEFAULT 0 NOT NULL,
	"redeem_by" timestamp with time zone,
	"applies_to_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"valid" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "coupons_exactly_one_discount_kind" CHECK ((percent_off is null) <> (amount_off is null)),
	CONSTRAINT "coupons_amount_off_needs_currency" CHECK (amount_off is null or currency is not null)
);
--> statement-breakpoint
CREATE TABLE "billing"."discounts" (
	"id" text PRIMARY KEY NOT NULL,
	"coupon_id" text NOT NULL,
	"promotion_code_id" text,
	"customer_id" text NOT NULL,
	"level" text NOT NULL,
	"subscription_id" text,
	"subscription_item_id" text,
	"invoice_id" text,
	"invoice_item_id" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing"."promotion_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"coupon_id" text NOT NULL,
	"customer_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"max_redemptions" integer,
	"times_redeemed" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"first_time_transaction" boolean DEFAULT false NOT NULL,
	"minimum_amount" bigint,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."disputes" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "billing"."entitlements" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"product_id" text NOT NULL,
	"status" text NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."credit_note_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"credit_note_id" text NOT NULL,
	"invoice_line_item_id" text,
	"description" text DEFAULT '' NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"unit_amount" bigint,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."credit_note_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"credit_note_id" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."credit_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"invoice_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"currency" text NOT NULL,
	"type" text NOT NULL,
	"amount" bigint NOT NULL,
	"refund_amount" bigint DEFAULT 0 NOT NULL,
	"out_of_band_amount" bigint DEFAULT 0 NOT NULL,
	"credit_amount" bigint DEFAULT 0 NOT NULL,
	"refund_id" text,
	"ledger_transaction_id" text,
	"reason" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."invoice_items" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"invoice_id" text,
	"subscription_id" text,
	"price_id" text,
	"currency" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"unit_amount" bigint,
	"amount" bigint NOT NULL,
	"discountable" boolean DEFAULT true NOT NULL,
	"tax_rates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing"."invoice_line_item_tax_amounts" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"invoice_line_item_id" text NOT NULL,
	"tax_rate_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"taxable_amount" bigint NOT NULL,
	"is_inclusive" boolean NOT NULL,
	"percentage" double precision NOT NULL,
	"tax_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."invoice_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"subscription_item_id" text,
	"subscription_item_change_id" text,
	"invoice_item_id" text,
	"price_id" text,
	"type" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"quantity" double precision NOT NULL,
	"unit_amount" bigint,
	"amount" bigint NOT NULL,
	"amount_excluding_tax" bigint DEFAULT 0 NOT NULL,
	"discountable" boolean DEFAULT true NOT NULL,
	"discount_amounts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"proration_factor" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."invoice_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"payment_intent_id" text,
	"charge_id" text,
	"amount" bigint NOT NULL,
	"settlement_reference" text,
	"paid_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."invoice_reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text,
	"customer_id" text NOT NULL,
	"subscription_id" text,
	"status" text NOT NULL,
	"billing_reason" text NOT NULL,
	"currency" text NOT NULL,
	"collection_method" text NOT NULL,
	"auto_advance" boolean DEFAULT true NOT NULL,
	"days_until_due" integer,
	"attempted" boolean DEFAULT false NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"subtotal_excluding_tax" bigint DEFAULT 0 NOT NULL,
	"total_discount_amount" bigint DEFAULT 0 NOT NULL,
	"total_tax_amount" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"starting_balance" bigint DEFAULT 0 NOT NULL,
	"ending_balance" bigint DEFAULT 0 NOT NULL,
	"amount_due" bigint DEFAULT 0 NOT NULL,
	"amount_paid" bigint DEFAULT 0 NOT NULL,
	"default_tax_rates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"automatic_tax_enabled" boolean DEFAULT false NOT NULL,
	"automatic_tax_status" text DEFAULT 'not_collecting' NOT NULL,
	"authority_invoice_number" text,
	"authority_status" text DEFAULT 'not_submitted' NOT NULL,
	"hosted_invoice_url" text,
	"invoice_pdf" text,
	"sent_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."number_sequences" (
	"name" text NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "number_sequences_name_pk" PRIMARY KEY("name")
);
--> statement-breakpoint
CREATE TABLE "billing"."ledger_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"normal_balance" text NOT NULL,
	"currency" text NOT NULL,
	"customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."ledger_postings" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"account_id" text NOT NULL,
	"direction" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_postings_amount_positive" CHECK ("billing"."ledger_postings"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "billing"."ledger_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"currency" text NOT NULL,
	"external_id" text,
	"effective_at" timestamp with time zone NOT NULL,
	"reverses_transaction_id" text,
	"reversed_by_transaction_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."meter_events" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"meter_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"event_name" text NOT NULL,
	"value" double precision NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."meters" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"event_name" text NOT NULL,
	"aggregation" text NOT NULL,
	"value_key" text NOT NULL,
	"status" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing"."payment_link_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_link_id" text NOT NULL,
	"price_id" text NOT NULL,
	"quantity" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."payment_links" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "billing"."payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "billing"."charges" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "billing"."payment_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text,
	"customer_id" text NOT NULL,
	"status" text NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"amount_capturable" bigint DEFAULT 0 NOT NULL,
	"amount_received" bigint DEFAULT 0 NOT NULL,
	"capture_method" text DEFAULT 'automatic' NOT NULL,
	"payment_method_id" text,
	"latest_charge_id" text,
	"next_action" jsonb,
	"cancellation_reason" text,
	"psp_reference" text,
	"failure_code" text,
	"decline_code" text,
	"failure_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."psp_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."refund_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"refund_id" text NOT NULL,
	"status" text NOT NULL,
	"failure_reason" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_intent_id" text NOT NULL,
	"charge_id" text NOT NULL,
	"invoice_id" text,
	"credit_note_id" text,
	"customer_id" text NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"reason" text NOT NULL,
	"psp_reference" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."setup_intents" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "billing"."payouts" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "billing"."portal_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"portal_user_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."portal_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"portal_user_id" text,
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
CREATE TABLE "billing"."portal_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."prices" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"lookup_key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"nickname" text DEFAULT '' NOT NULL,
	"currency" text NOT NULL,
	"type" text NOT NULL,
	"billing_scheme" text NOT NULL,
	"unit_amount" bigint,
	"tax_behavior" text NOT NULL,
	"recurring_interval" text,
	"recurring_interval_count" integer,
	"usage_type" text,
	"meter_id" text,
	"tiers_mode" text,
	"tiers" jsonb,
	"transform_quantity" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prices_per_unit_shape" CHECK (billing_scheme <> 'per_unit' or (unit_amount is not null and tiers is null and tiers_mode is null)),
	CONSTRAINT "prices_tiered_shape" CHECK (billing_scheme <> 'tiered' or (tiers is not null and tiers_mode is not null and unit_amount is null)),
	CONSTRAINT "prices_recurring_shape" CHECK (type <> 'recurring' or (recurring_interval is not null and recurring_interval_count is not null and usage_type is not null)),
	CONSTRAINT "prices_one_time_shape" CHECK (type <> 'one_time' or (recurring_interval is null and recurring_interval_count is null and usage_type is null)),
	CONSTRAINT "prices_metered_shape" CHECK (coalesce(usage_type = 'metered', false) = (meter_id is not null))
);
--> statement-breakpoint
CREATE TABLE "billing"."products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"unit_label" text DEFAULT '' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing"."subscription_item_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"subscription_item_id" text NOT NULL,
	"price_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"billed_from" timestamp with time zone NOT NULL,
	"billed_through" timestamp with time zone,
	"invoiced_through" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."subscription_items" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"price_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"tax_rates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing"."subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"status" text NOT NULL,
	"currency" text NOT NULL,
	"collection_method" text NOT NULL,
	"billing_mode" text DEFAULT 'advance' NOT NULL,
	"billing_cycle_anchor" timestamp with time zone NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"charged_through_date" timestamp with time zone,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"trial_end_behavior_missing_payment_method" text DEFAULT 'create_invoice' NOT NULL,
	"default_tax_rates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_payment_method_id" text,
	"pause_collection_behavior" text,
	"pause_collection_resumes_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancel_at" timestamp with time zone,
	"cancellation_reason" text,
	"cancellation_comment" text,
	"cancellation_feedback" text,
	"canceled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"test_clock_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."tax_ids" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"country" text,
	"verification_status" text NOT NULL,
	"verified_name" text,
	"verified_address" text,
	"verification_attempted_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing"."tax_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"percentage" double precision NOT NULL,
	"inclusive" boolean NOT NULL,
	"jurisdiction" text DEFAULT '' NOT NULL,
	"country" text,
	"state" text,
	"tax_type" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing"."test_clocks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"frozen_time" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing"."billing_portal_sessions" ADD CONSTRAINT "billing_portal_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."billing_portal_sessions" ADD CONSTRAINT "billing_portal_sessions_configuration_id_billing_portal_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "billing"."billing_portal_configurations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."billing_portal_sessions" ADD CONSTRAINT "billing_portal_sessions_portal_session_id_portal_sessions_id_fk" FOREIGN KEY ("portal_session_id") REFERENCES "billing"."portal_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."checkout_session_line_items" ADD CONSTRAINT "checkout_session_line_items_checkout_session_id_checkout_sessions_id_fk" FOREIGN KEY ("checkout_session_id") REFERENCES "billing"."checkout_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."checkout_session_line_items" ADD CONSTRAINT "checkout_session_line_items_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "billing"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."checkout_sessions" ADD CONSTRAINT "checkout_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."checkout_sessions" ADD CONSTRAINT "checkout_sessions_payment_link_id_payment_links_id_fk" FOREIGN KEY ("payment_link_id") REFERENCES "billing"."payment_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."checkout_sessions" ADD CONSTRAINT "checkout_sessions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "billing"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."checkout_sessions" ADD CONSTRAINT "checkout_sessions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."checkout_sessions" ADD CONSTRAINT "checkout_sessions_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "billing"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."checkout_sessions" ADD CONSTRAINT "checkout_sessions_setup_intent_id_setup_intents_id_fk" FOREIGN KEY ("setup_intent_id") REFERENCES "billing"."setup_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."collection_attempts" ADD CONSTRAINT "collection_attempts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."customer_balance_transactions" ADD CONSTRAINT "customer_balance_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."customers" ADD CONSTRAINT "customers_default_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("default_payment_method_id") REFERENCES "billing"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."discounts" ADD CONSTRAINT "discounts_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "billing"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."discounts" ADD CONSTRAINT "discounts_promotion_code_id_promotion_codes_id_fk" FOREIGN KEY ("promotion_code_id") REFERENCES "billing"."promotion_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."discounts" ADD CONSTRAINT "discounts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."promotion_codes" ADD CONSTRAINT "promotion_codes_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "billing"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."promotion_codes" ADD CONSTRAINT "promotion_codes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."disputes" ADD CONSTRAINT "disputes_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "billing"."charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."disputes" ADD CONSTRAINT "disputes_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "billing"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."disputes" ADD CONSTRAINT "disputes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."disputes" ADD CONSTRAINT "disputes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."entitlements" ADD CONSTRAINT "entitlements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."entitlements" ADD CONSTRAINT "entitlements_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "billing"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."entitlements" ADD CONSTRAINT "entitlements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "billing"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."credit_note_line_items" ADD CONSTRAINT "credit_note_line_items_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "billing"."credit_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."credit_note_line_items" ADD CONSTRAINT "credit_note_line_items_invoice_line_item_id_invoice_line_items_id_fk" FOREIGN KEY ("invoice_line_item_id") REFERENCES "billing"."invoice_line_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."credit_note_transitions" ADD CONSTRAINT "credit_note_transitions_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "billing"."credit_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."credit_notes" ADD CONSTRAINT "credit_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoice_items" ADD CONSTRAINT "invoice_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoice_items" ADD CONSTRAINT "invoice_items_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "billing"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoice_items" ADD CONSTRAINT "invoice_items_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "billing"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoice_line_item_tax_amounts" ADD CONSTRAINT "invoice_line_item_tax_amounts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoice_line_item_tax_amounts" ADD CONSTRAINT "invoice_line_item_tax_amounts_invoice_line_item_id_invoice_line_items_id_fk" FOREIGN KEY ("invoice_line_item_id") REFERENCES "billing"."invoice_line_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoice_line_item_tax_amounts" ADD CONSTRAINT "invoice_line_item_tax_amounts_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "billing"."tax_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoice_line_items" ADD CONSTRAINT "invoice_line_items_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "billing"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoice_reminders" ADD CONSTRAINT "invoice_reminders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "billing"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."ledger_postings" ADD CONSTRAINT "ledger_postings_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "billing"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."ledger_postings" ADD CONSTRAINT "ledger_postings_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "billing"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."meter_events" ADD CONSTRAINT "meter_events_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "billing"."meters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."meter_events" ADD CONSTRAINT "meter_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."payment_link_line_items" ADD CONSTRAINT "payment_link_line_items_payment_link_id_payment_links_id_fk" FOREIGN KEY ("payment_link_id") REFERENCES "billing"."payment_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."payment_link_line_items" ADD CONSTRAINT "payment_link_line_items_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "billing"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."payment_methods" ADD CONSTRAINT "payment_methods_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."charges" ADD CONSTRAINT "charges_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "billing"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."charges" ADD CONSTRAINT "charges_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."charges" ADD CONSTRAINT "charges_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "billing"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."payment_intents" ADD CONSTRAINT "payment_intents_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."payment_intents" ADD CONSTRAINT "payment_intents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."payment_intents" ADD CONSTRAINT "payment_intents_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "billing"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."refund_transitions" ADD CONSTRAINT "refund_transitions_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "billing"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."refunds" ADD CONSTRAINT "refunds_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "billing"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."refunds" ADD CONSTRAINT "refunds_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "billing"."charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."refunds" ADD CONSTRAINT "refunds_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."refunds" ADD CONSTRAINT "refunds_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."setup_intents" ADD CONSTRAINT "setup_intents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."setup_intents" ADD CONSTRAINT "setup_intents_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "billing"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."portal_memberships" ADD CONSTRAINT "portal_memberships_portal_user_id_portal_users_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "billing"."portal_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."portal_memberships" ADD CONSTRAINT "portal_memberships_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."portal_sessions" ADD CONSTRAINT "portal_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."portal_sessions" ADD CONSTRAINT "portal_sessions_portal_user_id_portal_users_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "billing"."portal_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."prices" ADD CONSTRAINT "prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "billing"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."prices" ADD CONSTRAINT "prices_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "billing"."meters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscription_item_changes" ADD CONSTRAINT "subscription_item_changes_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "billing"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscription_item_changes" ADD CONSTRAINT "subscription_item_changes_subscription_item_id_subscription_items_id_fk" FOREIGN KEY ("subscription_item_id") REFERENCES "billing"."subscription_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscription_item_changes" ADD CONSTRAINT "subscription_item_changes_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "billing"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "billing"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscription_items" ADD CONSTRAINT "subscription_items_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "billing"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscriptions" ADD CONSTRAINT "subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscriptions" ADD CONSTRAINT "subscriptions_default_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("default_payment_method_id") REFERENCES "billing"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."subscriptions" ADD CONSTRAINT "subscriptions_test_clock_id_test_clocks_id_fk" FOREIGN KEY ("test_clock_id") REFERENCES "billing"."test_clocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."tax_ids" ADD CONSTRAINT "tax_ids_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balance_transactions_source_idx" ON "billing"."balance_transactions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "balance_transactions_payout_id_idx" ON "billing"."balance_transactions" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "balance_transactions_available_on_idx" ON "billing"."balance_transactions" USING btree ("available_on");--> statement-breakpoint
CREATE INDEX "balance_transactions_created_at_id_idx" ON "billing"."balance_transactions" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_portal_configurations_default_idx" ON "billing"."billing_portal_configurations" USING btree ("is_default") WHERE is_default;--> statement-breakpoint
CREATE INDEX "billing_portal_configurations_created_at_id_idx" ON "billing"."billing_portal_configurations" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "billing_portal_sessions_customer_id_idx" ON "billing"."billing_portal_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "billing_portal_sessions_created_at_id_idx" ON "billing"."billing_portal_sessions" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "checkout_session_line_items_session_id_idx" ON "billing"."checkout_session_line_items" USING btree ("checkout_session_id");--> statement-breakpoint
CREATE INDEX "checkout_sessions_customer_id_idx" ON "billing"."checkout_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "checkout_sessions_status_expires_at_idx" ON "billing"."checkout_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "checkout_sessions_created_at_id_idx" ON "billing"."checkout_sessions" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "collection_attempts_invoice_id_status_idx" ON "billing"."collection_attempts" USING btree ("invoice_id","status");--> statement-breakpoint
CREATE INDEX "customer_balance_transactions_customer_id_idx" ON "billing"."customer_balance_transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_balance_transactions_created_at_id_idx" ON "billing"."customer_balance_transactions" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_balance_transactions_invoice_idx" ON "billing"."customer_balance_transactions" USING btree ("invoice_id","type") WHERE invoice_id is not null;--> statement-breakpoint
CREATE INDEX "customers_created_at_id_idx" ON "billing"."customers" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_idx" ON "billing"."customers" USING btree ("email") WHERE deleted_at is null and email is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_partner_platform_partner_account_id_idx" ON "billing"."customers" USING btree ("partner_platform","partner_account_id") WHERE partner_account_id is not null;--> statement-breakpoint
CREATE INDEX "coupons_created_at_id_idx" ON "billing"."coupons" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "discounts_customer_id_idx" ON "billing"."discounts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "discounts_subscription_id_idx" ON "billing"."discounts" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "discounts_invoice_id_idx" ON "billing"."discounts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "discounts_created_at_id_idx" ON "billing"."discounts" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "promotion_codes_coupon_id_idx" ON "billing"."promotion_codes" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "promotion_codes_created_at_id_idx" ON "billing"."promotion_codes" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_codes_code_idx" ON "billing"."promotion_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "disputes_charge_id_idx" ON "billing"."disputes" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "disputes_customer_id_idx" ON "billing"."disputes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "billing"."disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disputes_created_at_id_idx" ON "billing"."disputes" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_psp_reference_idx" ON "billing"."disputes" USING btree ("psp_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_subscription_id_product_id_idx" ON "billing"."entitlements" USING btree ("subscription_id","product_id");--> statement-breakpoint
CREATE INDEX "entitlements_customer_id_idx" ON "billing"."entitlements" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "entitlements_created_at_id_idx" ON "billing"."entitlements" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "credit_note_line_items_credit_note_id_idx" ON "billing"."credit_note_line_items" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "credit_note_transitions_credit_note_id_idx" ON "billing"."credit_note_transitions" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "credit_note_transitions_occurred_at_id_idx" ON "billing"."credit_note_transitions" USING btree ("occurred_at","id");--> statement-breakpoint
CREATE INDEX "credit_notes_invoice_id_idx" ON "billing"."credit_notes" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "credit_notes_created_at_id_idx" ON "billing"."credit_notes" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_notes_number_idx" ON "billing"."credit_notes" USING btree ("number");--> statement-breakpoint
CREATE INDEX "invoice_items_customer_id_idx" ON "billing"."invoice_items" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_id_idx" ON "billing"."invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_items_created_at_id_idx" ON "billing"."invoice_items" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "invoice_line_item_tax_amounts_invoice_id_idx" ON "billing"."invoice_line_item_tax_amounts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_line_item_tax_amounts_line_item_id_idx" ON "billing"."invoice_line_item_tax_amounts" USING btree ("invoice_line_item_id");--> statement-breakpoint
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "billing"."invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_invoice_id_idx" ON "billing"."invoice_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_payment_intent_id_idx" ON "billing"."invoice_payments" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_payments_settlement_reference_idx" ON "billing"."invoice_payments" USING btree ("settlement_reference") WHERE settlement_reference is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_reminders_invoice_id_kind_idx" ON "billing"."invoice_reminders" USING btree ("invoice_id","kind");--> statement-breakpoint
CREATE INDEX "invoices_customer_id_idx" ON "billing"."invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "billing"."invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_created_at_id_idx" ON "billing"."invoices" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_idx" ON "billing"."invoices" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_subscription_cycle_period_idx" ON "billing"."invoices" USING btree ("subscription_id","period_start") WHERE "billing"."invoices"."billing_reason" = 'subscription_cycle';--> statement-breakpoint
CREATE INDEX "invoices_status_next_attempt_at_idx" ON "billing"."invoices" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_code_currency_customer_id_idx" ON "billing"."ledger_accounts" USING btree ("code","currency","customer_id") WHERE customer_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_code_currency_idx" ON "billing"."ledger_accounts" USING btree ("code","currency") WHERE customer_id is null;--> statement-breakpoint
CREATE INDEX "ledger_accounts_customer_id_idx" ON "billing"."ledger_accounts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "ledger_postings_transaction_id_idx" ON "billing"."ledger_postings" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_postings_account_id_idx" ON "billing"."ledger_postings" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_transactions_external_id_idx" ON "billing"."ledger_transactions" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "ledger_transactions_created_at_id_idx" ON "billing"."ledger_transactions" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "ledger_transactions_effective_at_idx" ON "billing"."ledger_transactions" USING btree ("effective_at");--> statement-breakpoint
CREATE UNIQUE INDEX "meter_events_meter_id_identifier_idx" ON "billing"."meter_events" USING btree ("meter_id","identifier");--> statement-breakpoint
CREATE INDEX "meter_events_meter_id_customer_id_timestamp_idx" ON "billing"."meter_events" USING btree ("meter_id","customer_id","timestamp");--> statement-breakpoint
CREATE INDEX "meter_events_received_at_idx" ON "billing"."meter_events" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "meters_event_name_idx" ON "billing"."meters" USING btree ("event_name") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "meters_created_at_id_idx" ON "billing"."meters" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "payment_link_line_items_payment_link_id_idx" ON "billing"."payment_link_line_items" USING btree ("payment_link_id");--> statement-breakpoint
CREATE INDEX "payment_links_created_at_id_idx" ON "billing"."payment_links" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "payment_methods_customer_id_idx" ON "billing"."payment_methods" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payment_methods_created_at_id_idx" ON "billing"."payment_methods" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "charges_payment_intent_id_idx" ON "billing"."charges" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "charges_customer_id_idx" ON "billing"."charges" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "charges_created_at_id_idx" ON "billing"."charges" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "payment_intents_invoice_id_idx" ON "billing"."payment_intents" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payment_intents_customer_id_idx" ON "billing"."payment_intents" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payment_intents_created_at_id_idx" ON "billing"."payment_intents" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_intents_psp_reference_idx" ON "billing"."payment_intents" USING btree ("psp_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "psp_events_provider_event_id_idx" ON "billing"."psp_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "psp_events_received_at_id_idx" ON "billing"."psp_events" USING btree ("received_at","id");--> statement-breakpoint
CREATE INDEX "refund_transitions_refund_id_idx" ON "billing"."refund_transitions" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "refund_transitions_occurred_at_id_idx" ON "billing"."refund_transitions" USING btree ("occurred_at","id");--> statement-breakpoint
CREATE INDEX "refunds_invoice_id_idx" ON "billing"."refunds" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "refunds_payment_intent_id_idx" ON "billing"."refunds" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "refunds_charge_id_idx" ON "billing"."refunds" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "refunds_created_at_id_idx" ON "billing"."refunds" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_psp_reference_idx" ON "billing"."refunds" USING btree ("psp_reference");--> statement-breakpoint
CREATE INDEX "setup_intents_customer_id_idx" ON "billing"."setup_intents" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "setup_intents_created_at_id_idx" ON "billing"."setup_intents" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "setup_intents_psp_reference_idx" ON "billing"."setup_intents" USING btree ("psp_reference");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "billing"."payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payouts_created_at_id_idx" ON "billing"."payouts" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_psp_reference_idx" ON "billing"."payouts" USING btree ("psp_reference") WHERE psp_reference is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_memberships_portal_user_id_customer_id_idx" ON "billing"."portal_memberships" USING btree ("portal_user_id","customer_id");--> statement-breakpoint
CREATE INDEX "portal_memberships_customer_id_idx" ON "billing"."portal_memberships" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_sessions_link_token_hash_idx" ON "billing"."portal_sessions" USING btree ("link_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_sessions_session_token_hash_idx" ON "billing"."portal_sessions" USING btree ("session_token_hash") WHERE session_token_hash is not null;--> statement-breakpoint
CREATE INDEX "portal_sessions_customer_id_idx" ON "billing"."portal_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "portal_sessions_created_at_id_idx" ON "billing"."portal_sessions" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_users_email_idx" ON "billing"."portal_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "prices_product_id_idx" ON "billing"."prices" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "prices_created_at_id_idx" ON "billing"."prices" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "prices_lookup_key_version_idx" ON "billing"."prices" USING btree ("lookup_key","version");--> statement-breakpoint
CREATE INDEX "prices_meter_id_idx" ON "billing"."prices" USING btree ("meter_id");--> statement-breakpoint
CREATE INDEX "products_created_at_id_idx" ON "billing"."products" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "subscription_item_changes_subscription_id_idx" ON "billing"."subscription_item_changes" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_item_changes_subscription_item_id_idx" ON "billing"."subscription_item_changes" USING btree ("subscription_item_id");--> statement-breakpoint
CREATE INDEX "subscription_item_changes_billed_from_idx" ON "billing"."subscription_item_changes" USING btree ("subscription_id","billed_from");--> statement-breakpoint
CREATE INDEX "subscription_items_subscription_id_idx" ON "billing"."subscription_items" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_customer_id_idx" ON "billing"."subscriptions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "subscriptions_created_at_id_idx" ON "billing"."subscriptions" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "billing"."subscriptions" USING btree ("status","current_period_end");--> statement-breakpoint
CREATE INDEX "subscriptions_status_updated_at_idx" ON "billing"."subscriptions" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "subscriptions_cancel_at_idx" ON "billing"."subscriptions" USING btree ("cancel_at");--> statement-breakpoint
CREATE INDEX "subscriptions_pause_collection_resumes_at_idx" ON "billing"."subscriptions" USING btree ("pause_collection_resumes_at");--> statement-breakpoint
CREATE INDEX "subscriptions_test_clock_id_idx" ON "billing"."subscriptions" USING btree ("test_clock_id");--> statement-breakpoint
CREATE INDEX "tax_ids_customer_id_idx" ON "billing"."tax_ids" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "tax_ids_created_at_id_idx" ON "billing"."tax_ids" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_ids_customer_value_idx" ON "billing"."tax_ids" USING btree ("customer_id","type","value") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "tax_rates_created_at_id_idx" ON "billing"."tax_rates" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "tax_rates_country_state_idx" ON "billing"."tax_rates" USING btree ("country","state");--> statement-breakpoint
CREATE INDEX "test_clocks_created_at_id_idx" ON "billing"."test_clocks" USING btree ("created_at","id");