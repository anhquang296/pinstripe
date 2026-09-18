CREATE TABLE "coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
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
CREATE TABLE "discounts" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
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
CREATE TABLE "promotion_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
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
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_promotion_code_id_promotion_codes_id_fk" FOREIGN KEY ("promotion_code_id") REFERENCES "public"."promotion_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_codes" ADD CONSTRAINT "promotion_codes_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_codes" ADD CONSTRAINT "promotion_codes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupons_created_at_id_idx" ON "coupons" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "discounts_customer_id_idx" ON "discounts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "discounts_subscription_id_idx" ON "discounts" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "discounts_invoice_id_idx" ON "discounts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "discounts_created_at_id_idx" ON "discounts" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "promotion_codes_coupon_id_idx" ON "promotion_codes" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "promotion_codes_created_at_id_idx" ON "promotion_codes" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_codes_code_idx" ON "promotion_codes" USING btree ("livemode","code");