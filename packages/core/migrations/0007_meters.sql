CREATE TABLE "meter_events" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"meter_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"event_name" text NOT NULL,
	"value" double precision NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meters" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"event_name" text NOT NULL,
	"aggregation" text NOT NULL,
	"value_key" text NOT NULL,
	"status" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "meter_events" ADD CONSTRAINT "meter_events_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_events" ADD CONSTRAINT "meter_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meter_events_meter_id_identifier_idx" ON "meter_events" USING btree ("meter_id","identifier");--> statement-breakpoint
CREATE INDEX "meter_events_meter_id_customer_id_timestamp_idx" ON "meter_events" USING btree ("meter_id","customer_id","timestamp");--> statement-breakpoint
CREATE INDEX "meter_events_received_at_idx" ON "meter_events" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "meters_event_name_idx" ON "meters" USING btree ("event_name") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "meters_created_at_id_idx" ON "meters" USING btree ("created_at","id");