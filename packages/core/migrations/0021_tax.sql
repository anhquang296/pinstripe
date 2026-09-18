CREATE TABLE "invoice_line_item_tax_amounts" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
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
CREATE TABLE "tax_ids" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
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
CREATE TABLE "tax_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
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
ALTER TABLE "customers" ADD COLUMN "tax_exempt" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "tax_rates" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "default_tax_rates" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "automatic_tax_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "automatic_tax_status" text DEFAULT 'not_collecting' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "authority_invoice_number" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "authority_status" text DEFAULT 'not_submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_items" ADD COLUMN "tax_rates" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "default_tax_rates" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_item_tax_amounts" ADD CONSTRAINT "invoice_line_item_tax_amounts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_item_tax_amounts" ADD CONSTRAINT "invoice_line_item_tax_amounts_invoice_line_item_id_invoice_line_items_id_fk" FOREIGN KEY ("invoice_line_item_id") REFERENCES "public"."invoice_line_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_item_tax_amounts" ADD CONSTRAINT "invoice_line_item_tax_amounts_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_ids" ADD CONSTRAINT "tax_ids_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_line_item_tax_amounts_invoice_id_idx" ON "invoice_line_item_tax_amounts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_line_item_tax_amounts_line_item_id_idx" ON "invoice_line_item_tax_amounts" USING btree ("invoice_line_item_id");--> statement-breakpoint
CREATE INDEX "tax_ids_customer_id_idx" ON "tax_ids" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "tax_ids_created_at_id_idx" ON "tax_ids" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_ids_customer_value_idx" ON "tax_ids" USING btree ("livemode","customer_id","type","value") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "tax_rates_created_at_id_idx" ON "tax_rates" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "tax_rates_country_state_idx" ON "tax_rates" USING btree ("livemode","country","state");--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "tax_amounts";