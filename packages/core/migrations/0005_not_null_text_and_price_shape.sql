UPDATE "customers" SET "name" = '' WHERE "name" IS NULL;--> statement-breakpoint
UPDATE "customers" SET "description" = '' WHERE "description" IS NULL;--> statement-breakpoint
UPDATE "customers" SET "phone" = '' WHERE "phone" IS NULL;--> statement-breakpoint
UPDATE "prices" SET "nickname" = '' WHERE "nickname" IS NULL;--> statement-breakpoint
UPDATE "products" SET "description" = '' WHERE "description" IS NULL;--> statement-breakpoint
UPDATE "products" SET "unit_label" = '' WHERE "unit_label" IS NULL;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "description" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "phone" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "phone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "prices" ALTER COLUMN "nickname" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "prices" ALTER COLUMN "nickname" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "description" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "unit_label" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "unit_label" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_per_unit_shape" CHECK (billing_scheme <> 'per_unit' or (unit_amount is not null and tiers is null and tiers_mode is null));--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_tiered_shape" CHECK (billing_scheme <> 'tiered' or (tiers is not null and tiers_mode is not null and unit_amount is null));--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_recurring_shape" CHECK (type <> 'recurring' or (recurring_interval is not null and recurring_interval_count is not null and usage_type is not null));--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_one_time_shape" CHECK (type <> 'one_time' or (recurring_interval is null and recurring_interval_count is null and usage_type is null));