CREATE TABLE "customer_balance_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"customer_id" text NOT NULL,
	"invoice_id" text,
	"credit_note_id" text,
	"type" text NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"ending_balance" bigint NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"customer_id" text NOT NULL,
	"invoice_id" text,
	"subscription_id" text,
	"price_id" text,
	"currency" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"unit_amount" bigint,
	"amount" bigint NOT NULL,
	"discountable" boolean DEFAULT true NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"invoice_id" text NOT NULL,
	"payment_intent_id" text,
	"amount" bigint NOT NULL,
	"settlement_reference" text,
	"paid_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_line_items" ALTER COLUMN "price_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ALTER COLUMN "invoice_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ALTER COLUMN "invoice_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "invoice_item_id" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "unit_amount" bigint;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "amount_excluding_tax" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "discountable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "discount_amounts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "tax_amounts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "collection_method" text DEFAULT 'charge_automatically' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "auto_advance" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "days_until_due" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "attempted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "subtotal_excluding_tax" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "total_discount_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "total_tax_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "starting_balance" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "ending_balance" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "amount_due" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint

ALTER TABLE "invoice_line_items" DISABLE TRIGGER "invoice_line_items_append_only";--> statement-breakpoint
UPDATE "invoice_line_items" SET "amount_excluding_tax" = "amount";--> statement-breakpoint
ALTER TABLE "invoice_line_items" ENABLE TRIGGER "invoice_line_items_append_only";--> statement-breakpoint

UPDATE "invoices"
SET "subtotal_excluding_tax" = "subtotal",
    "amount_due" = "total",
    "attempted" = "attempt_count" > 0;--> statement-breakpoint

ALTER TABLE "invoices" ALTER COLUMN "collection_method" DROP DEFAULT;--> statement-breakpoint

CREATE OR REPLACE FUNCTION invoices_reject_issued_rewrite() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.number IS DISTINCT FROM OLD.number
     OR NEW.total IS DISTINCT FROM OLD.total
     OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.subtotal_excluding_tax IS DISTINCT FROM OLD.subtotal_excluding_tax
     OR NEW.total_discount_amount IS DISTINCT FROM OLD.total_discount_amount
     OR NEW.total_tax_amount IS DISTINCT FROM OLD.total_tax_amount
     OR NEW.starting_balance IS DISTINCT FROM OLD.starting_balance
     OR NEW.ending_balance IS DISTINCT FROM OLD.ending_balance
     OR NEW.amount_due IS DISTINCT FROM OLD.amount_due
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.period_start IS DISTINCT FROM OLD.period_start
     OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at THEN
    RAISE EXCEPTION 'invoice % has been issued and its billed content is immutable', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

ALTER TABLE "customer_balance_transactions" ADD CONSTRAINT "customer_balance_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_balance_transactions_customer_id_idx" ON "customer_balance_transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_balance_transactions_created_at_id_idx" ON "customer_balance_transactions" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_balance_transactions_invoice_idx" ON "customer_balance_transactions" USING btree ("invoice_id","type") WHERE invoice_id is not null;--> statement-breakpoint
CREATE INDEX "invoice_items_customer_id_idx" ON "invoice_items" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_items_created_at_id_idx" ON "invoice_items" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "invoice_payments_invoice_id_idx" ON "invoice_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_payment_intent_id_idx" ON "invoice_payments" USING btree ("payment_intent_id");
