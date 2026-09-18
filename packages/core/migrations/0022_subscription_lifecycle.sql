CREATE TABLE "subscription_item_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
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
ALTER TABLE "customers" ADD COLUMN "default_payment_method" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "subscription_item_change_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_end_behavior_missing_payment_method" text DEFAULT 'create_invoice' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "default_payment_method" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pause_collection_behavior" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pause_collection_resumes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancellation_comment" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancellation_feedback" text;--> statement-breakpoint
ALTER TABLE "subscription_item_changes" ADD CONSTRAINT "subscription_item_changes_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_item_changes" ADD CONSTRAINT "subscription_item_changes_subscription_item_id_subscription_items_id_fk" FOREIGN KEY ("subscription_item_id") REFERENCES "public"."subscription_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_item_changes" ADD CONSTRAINT "subscription_item_changes_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_item_changes_subscription_id_idx" ON "subscription_item_changes" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_item_changes_subscription_item_id_idx" ON "subscription_item_changes" USING btree ("subscription_item_id");--> statement-breakpoint
CREATE INDEX "subscription_item_changes_billed_from_idx" ON "subscription_item_changes" USING btree ("subscription_id","billed_from");--> statement-breakpoint
CREATE INDEX "subscriptions_status_updated_at_idx" ON "subscriptions" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "subscriptions_cancel_at_idx" ON "subscriptions" USING btree ("cancel_at");--> statement-breakpoint
CREATE INDEX "subscriptions_pause_collection_resumes_at_idx" ON "subscriptions" USING btree ("pause_collection_resumes_at");--> statement-breakpoint
INSERT INTO "subscription_item_changes" ("id", "livemode", "subscription_id", "subscription_item_id", "price_id", "quantity", "billed_from", "billed_through", "invoiced_through", "created_at")
SELECT 'sic_' || replace(gen_random_uuid()::text, '-', ''), "livemode", "subscription_id", "id", "price_id", "quantity", "billed_from", "billed_through", "invoiced_through", "created_at"
FROM "subscription_items";--> statement-breakpoint
ALTER TABLE "subscription_items" DROP COLUMN "billed_from";--> statement-breakpoint
ALTER TABLE "subscription_items" DROP COLUMN "billed_through";--> statement-breakpoint
ALTER TABLE "subscription_items" DROP COLUMN "invoiced_through";