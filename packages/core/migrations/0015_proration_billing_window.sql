-- A subscription item now carries its own billing window, separate from its lifecycle.
-- billed_from / billed_through say when it earns charges; created_at / deleted_at say when
-- it existed. A swap with no proration closes the window at the period start, which is a
-- real instant rather than a sentinel, so the item drops out of this period only.
-- invoiced_through records how much of a closed window an immediate proration invoice
-- already covered, so the period-end run never bills the same slice twice.
ALTER TABLE "subscription_items" ADD COLUMN "billed_from" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_items" ADD COLUMN "billed_through" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_items" ADD COLUMN "invoiced_through" timestamp with time zone;--> statement-breakpoint

-- Rating no longer filters on deleted_at, so a soft-deleted row left with an open window
-- would be billed for the full period forever. This backfill is what closes that hole.
UPDATE "subscription_items" SET "billed_from" = "created_at";--> statement-breakpoint
UPDATE "subscription_items" SET "billed_through" = "deleted_at" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_billing_window_closed" CHECK (("deleted_at" IS NULL) = ("billed_through" IS NULL));--> statement-breakpoint
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_invoiced_window_closed" CHECK ("invoiced_through" IS NULL OR "billed_through" IS NOT NULL);--> statement-breakpoint

-- Every invoice written before this migration was drafted by the billing run for a closed
-- period, so the blanket default is exact. The default is then dropped: from here on the
-- writer always states the reason.
ALTER TABLE "invoices" ADD COLUMN "billing_reason" text DEFAULT 'subscription_cycle' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "billing_reason" DROP DEFAULT;--> statement-breakpoint

-- One cycle invoice per subscription period still holds; a proration invoice shares that
-- period on purpose, so the uniqueness has to be scoped to the cycle reason.
DROP INDEX "invoices_subscription_period_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_subscription_cycle_period_idx" ON "invoices" USING btree ("subscription_id","period_start") WHERE "invoices"."billing_reason" = 'subscription_cycle';
