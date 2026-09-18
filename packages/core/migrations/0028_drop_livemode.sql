ALTER TABLE "customers" DROP CONSTRAINT "customers_test_clock_is_test_mode";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_test_clock_is_test_mode";--> statement-breakpoint
ALTER TABLE "test_clocks" DROP CONSTRAINT "test_clocks_livemode_false";--> statement-breakpoint
DROP INDEX "billing_portal_configurations_default_idx";--> statement-breakpoint
DROP INDEX "customers_email_idx";--> statement-breakpoint
DROP INDEX "promotion_codes_code_idx";--> statement-breakpoint
DROP INDEX "credit_notes_number_idx";--> statement-breakpoint
DROP INDEX "invoice_payments_settlement_reference_idx";--> statement-breakpoint
DROP INDEX "invoices_number_idx";--> statement-breakpoint
DROP INDEX "ledger_accounts_code_currency_customer_id_idx";--> statement-breakpoint
DROP INDEX "ledger_accounts_code_currency_idx";--> statement-breakpoint
DROP INDEX "ledger_transactions_external_id_idx";--> statement-breakpoint
DROP INDEX "meters_event_name_idx";--> statement-breakpoint
DROP INDEX "prices_lookup_key_version_idx";--> statement-breakpoint
DROP INDEX "tax_ids_customer_value_idx";--> statement-breakpoint
DROP INDEX "tax_rates_country_state_idx";--> statement-breakpoint
DELETE FROM "number_sequences" WHERE "livemode" = false;--> statement-breakpoint
ALTER TABLE "number_sequences" DROP CONSTRAINT "number_sequences_livemode_name_pk";--> statement-breakpoint
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_name_pk" PRIMARY KEY("name");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_portal_configurations_default_idx" ON "billing_portal_configurations" USING btree ("is_default") WHERE is_default;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email") WHERE deleted_at is null and email is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_codes_code_idx" ON "promotion_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_notes_number_idx" ON "credit_notes" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_payments_settlement_reference_idx" ON "invoice_payments" USING btree ("settlement_reference") WHERE settlement_reference is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_idx" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_code_currency_customer_id_idx" ON "ledger_accounts" USING btree ("code","currency","customer_id") WHERE customer_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_code_currency_idx" ON "ledger_accounts" USING btree ("code","currency") WHERE customer_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_transactions_external_id_idx" ON "ledger_transactions" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meters_event_name_idx" ON "meters" USING btree ("event_name") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "prices_lookup_key_version_idx" ON "prices" USING btree ("lookup_key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_ids_customer_value_idx" ON "tax_ids" USING btree ("customer_id","type","value") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "tax_rates_country_state_idx" ON "tax_rates" USING btree ("country","state");--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "balance_transactions" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "billing_portal_configurations" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "billing_portal_sessions" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "checkout_session_line_items" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "checkout_sessions" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "customer_balance_transactions" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "discounts" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "promotion_codes" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "disputes" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "entitlements" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "credit_note_line_items" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "credit_note_transitions" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "credit_notes" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "invoice_items" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "invoice_line_item_tax_amounts" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "invoice_payments" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "number_sequences" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "ledger_accounts" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "ledger_postings" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "ledger_transactions" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "meter_events" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "meters" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "outbox_events" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "payment_link_line_items" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "payment_links" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "payment_methods" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "charges" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "payment_intents" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "refund_transitions" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "refunds" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "setup_intents" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "payouts" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "portal_sessions" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "prices" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "subscription_item_changes" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "subscription_items" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "tax_ids" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "tax_rates" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "test_clocks" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "webhook_deliveries" DROP COLUMN "livemode";--> statement-breakpoint
ALTER TABLE "webhook_endpoints" DROP COLUMN "livemode";