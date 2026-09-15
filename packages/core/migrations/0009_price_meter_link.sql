ALTER TABLE "prices" ADD COLUMN "meter_id" text;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prices_meter_id_idx" ON "prices" USING btree ("meter_id");--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_metered_shape" CHECK (coalesce(usage_type = 'metered', false) = (meter_id is not null));