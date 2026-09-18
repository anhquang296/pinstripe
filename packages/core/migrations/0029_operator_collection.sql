CREATE TABLE "collection_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"collection_method" text NOT NULL,
	"requested_amount" bigint NOT NULL,
	"applied_amount" bigint DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"external_reference" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "vexere_operator_id" text;--> statement-breakpoint
ALTER TABLE "collection_attempts" ADD CONSTRAINT "collection_attempts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_attempts_invoice_id_status_idx" ON "collection_attempts" USING btree ("invoice_id","status");