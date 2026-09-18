ALTER TABLE "customers" RENAME COLUMN "vexere_operator_id" TO "partner_account_id";--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "partner_platform" text;--> statement-breakpoint
UPDATE "customers" SET "partner_platform" = 'vexere' WHERE "partner_account_id" IS NOT NULL;--> statement-breakpoint
UPDATE "ledger_accounts" SET "code" = 'partner_wallet_clearing' WHERE "code" = 'operator_wallet_clearing';--> statement-breakpoint
CREATE UNIQUE INDEX "customers_partner_platform_partner_account_id_idx" ON "customers" USING btree ("partner_platform","partner_account_id") WHERE partner_account_id is not null;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_partner_pair" CHECK ((partner_platform is null) = (partner_account_id is null));