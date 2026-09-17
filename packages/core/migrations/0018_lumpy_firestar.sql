CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"livemode" boolean NOT NULL,
	"type" text NOT NULL,
	"api_version" text NOT NULL,
	"data" jsonb NOT NULL,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_created_at_id_idx" ON "events" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("type");