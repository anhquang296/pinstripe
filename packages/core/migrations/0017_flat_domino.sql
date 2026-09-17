DROP INDEX "customers_email_idx";--> statement-breakpoint
DROP INDEX "credit_notes_number_idx";--> statement-breakpoint
DROP INDEX "invoices_number_idx";--> statement-breakpoint
DROP INDEX "ledger_accounts_code_currency_customer_id_idx";--> statement-breakpoint
DROP INDEX "ledger_accounts_code_currency_idx";--> statement-breakpoint
DROP INDEX "ledger_transactions_external_id_idx";--> statement-breakpoint
DROP INDEX "meters_event_name_idx";--> statement-breakpoint
DROP INDEX "prices_lookup_key_version_idx";--> statement-breakpoint

ALTER TABLE "customers" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "number_sequences" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_postings" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "meter_events" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "meters" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "prices" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_items" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "test_clocks" ADD COLUMN "livemode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD COLUMN "livemode" boolean DEFAULT true NOT NULL;--> statement-breakpoint

ALTER TABLE "credit_notes" DISABLE TRIGGER "credit_notes_append_only";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DISABLE TRIGGER "invoice_line_items_append_only";--> statement-breakpoint
ALTER TABLE "ledger_postings" DISABLE TRIGGER "ledger_postings_append_only";--> statement-breakpoint
ALTER TABLE "ledger_transactions" DISABLE TRIGGER "ledger_transactions_append_only";--> statement-breakpoint
ALTER TABLE "ledger_transactions" DISABLE TRIGGER "ledger_transactions_reversal_only";--> statement-breakpoint
ALTER TABLE "meter_events" DISABLE TRIGGER "meter_events_append_only";--> statement-breakpoint
ALTER TABLE "payment_attempts" DISABLE TRIGGER "payment_attempts_append_only";--> statement-breakpoint
ALTER TABLE "refunds" DISABLE TRIGGER "refunds_append_only";--> statement-breakpoint

UPDATE "customers" SET "livemode" = false WHERE "test_clock_id" IS NOT NULL;--> statement-breakpoint
UPDATE "subscriptions" SET "livemode" = false WHERE "test_clock_id" IS NOT NULL OR "customer_id" IN (SELECT "id" FROM "customers" WHERE "livemode" = false);--> statement-breakpoint
UPDATE "subscription_items" SET "livemode" = false WHERE "subscription_id" IN (SELECT "id" FROM "subscriptions" WHERE "livemode" = false);--> statement-breakpoint
UPDATE "invoices" SET "livemode" = false WHERE "customer_id" IN (SELECT "id" FROM "customers" WHERE "livemode" = false);--> statement-breakpoint
UPDATE "invoice_line_items" SET "livemode" = false WHERE "invoice_id" IN (SELECT "id" FROM "invoices" WHERE "livemode" = false);--> statement-breakpoint
UPDATE "credit_notes" SET "livemode" = false WHERE "invoice_id" IN (SELECT "id" FROM "invoices" WHERE "livemode" = false);--> statement-breakpoint
UPDATE "payment_intents" SET "livemode" = false WHERE "invoice_id" IN (SELECT "id" FROM "invoices" WHERE "livemode" = false);--> statement-breakpoint
UPDATE "payment_attempts" SET "livemode" = false WHERE "payment_intent_id" IN (SELECT "id" FROM "payment_intents" WHERE "livemode" = false);--> statement-breakpoint
UPDATE "refunds" SET "livemode" = false WHERE "payment_intent_id" IN (SELECT "id" FROM "payment_intents" WHERE "livemode" = false);--> statement-breakpoint
UPDATE "entitlements" SET "livemode" = false WHERE "customer_id" IN (SELECT "id" FROM "customers" WHERE "livemode" = false);--> statement-breakpoint
UPDATE "meter_events" SET "livemode" = false WHERE "customer_id" IN (SELECT "id" FROM "customers" WHERE "livemode" = false);--> statement-breakpoint
UPDATE "ledger_accounts" SET "livemode" = false WHERE "customer_id" IN (SELECT "id" FROM "customers" WHERE "livemode" = false);--> statement-breakpoint
UPDATE "ledger_postings" SET "livemode" = false WHERE "account_id" IN (SELECT "id" FROM "ledger_accounts" WHERE "livemode" = false);--> statement-breakpoint
UPDATE "ledger_transactions" SET "livemode" = false WHERE "id" IN (SELECT DISTINCT "transaction_id" FROM "ledger_postings" WHERE "livemode" = false);--> statement-breakpoint

ALTER TABLE "credit_notes" ENABLE TRIGGER "credit_notes_append_only";--> statement-breakpoint
ALTER TABLE "invoice_line_items" ENABLE TRIGGER "invoice_line_items_append_only";--> statement-breakpoint
ALTER TABLE "ledger_postings" ENABLE TRIGGER "ledger_postings_append_only";--> statement-breakpoint
ALTER TABLE "ledger_transactions" ENABLE TRIGGER "ledger_transactions_append_only";--> statement-breakpoint
ALTER TABLE "ledger_transactions" ENABLE TRIGGER "ledger_transactions_reversal_only";--> statement-breakpoint
ALTER TABLE "meter_events" ENABLE TRIGGER "meter_events_append_only";--> statement-breakpoint
ALTER TABLE "payment_attempts" ENABLE TRIGGER "payment_attempts_append_only";--> statement-breakpoint
ALTER TABLE "refunds" ENABLE TRIGGER "refunds_append_only";--> statement-breakpoint

ALTER TABLE "customers" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "entitlements" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "credit_notes" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "number_sequences" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ledger_postings" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "meter_events" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "meters" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "outbox_events" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "payment_attempts" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "payment_intents" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "refunds" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "prices" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "subscription_items" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ALTER COLUMN "livemode" DROP DEFAULT;--> statement-breakpoint

ALTER TABLE "number_sequences" DROP CONSTRAINT "number_sequences_pkey";--> statement-breakpoint
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_livemode_name_pk" PRIMARY KEY("livemode","name");--> statement-breakpoint
INSERT INTO "number_sequences" ("livemode", "name", "next_value") VALUES (false, 'invoice', 1), (false, 'credit_note', 1) ON CONFLICT DO NOTHING;--> statement-breakpoint

CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("livemode","email") WHERE deleted_at is null and email is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_notes_number_idx" ON "credit_notes" USING btree ("livemode","number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_idx" ON "invoices" USING btree ("livemode","number");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_code_currency_customer_id_idx" ON "ledger_accounts" USING btree ("livemode","code","currency","customer_id") WHERE customer_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_code_currency_idx" ON "ledger_accounts" USING btree ("livemode","code","currency") WHERE customer_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_transactions_external_id_idx" ON "ledger_transactions" USING btree ("livemode","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meters_event_name_idx" ON "meters" USING btree ("livemode","event_name") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "prices_lookup_key_version_idx" ON "prices" USING btree ("livemode","lookup_key","version");--> statement-breakpoint

ALTER TABLE "customers" ADD CONSTRAINT "customers_test_clock_is_test_mode" CHECK (test_clock_id is null or livemode = false);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_test_clock_is_test_mode" CHECK (test_clock_id is null or livemode = false);--> statement-breakpoint
ALTER TABLE "test_clocks" ADD CONSTRAINT "test_clocks_livemode_false" CHECK (livemode = false);
