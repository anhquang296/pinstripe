CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"description" text,
	"phone" text,
	"tax_id" text,
	"address" jsonb,
	"currency" text NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"lookup_key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"nickname" text,
	"currency" text NOT NULL,
	"type" text NOT NULL,
	"billing_scheme" text NOT NULL,
	"unit_amount" bigint,
	"tax_behavior" text NOT NULL,
	"recurring_interval" text,
	"recurring_interval_count" integer,
	"usage_type" text,
	"tiers_mode" text,
	"tiers" jsonb,
	"transform_quantity" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"unit_label" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_created_at_id_idx" ON "customers" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email") WHERE deleted_at is null and email is not null;--> statement-breakpoint
CREATE INDEX "prices_product_id_idx" ON "prices" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "prices_created_at_id_idx" ON "prices" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "prices_lookup_key_version_idx" ON "prices" USING btree ("lookup_key","version");--> statement-breakpoint
CREATE INDEX "products_created_at_id_idx" ON "products" USING btree ("created_at","id");