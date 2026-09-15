CREATE TABLE "ledger_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"normal_balance" text NOT NULL,
	"currency" text NOT NULL,
	"customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_postings" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"account_id" text NOT NULL,
	"direction" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_postings_amount_positive" CHECK ("ledger_postings"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
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
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_code_currency_customer_id_idx" ON "ledger_accounts" USING btree ("code","currency","customer_id");--> statement-breakpoint
CREATE INDEX "ledger_accounts_customer_id_idx" ON "ledger_accounts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "ledger_postings_transaction_id_idx" ON "ledger_postings" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_postings_account_id_idx" ON "ledger_postings" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_transactions_external_id_idx" ON "ledger_transactions" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "ledger_transactions_created_at_id_idx" ON "ledger_transactions" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "ledger_transactions_effective_at_idx" ON "ledger_transactions" USING btree ("effective_at");