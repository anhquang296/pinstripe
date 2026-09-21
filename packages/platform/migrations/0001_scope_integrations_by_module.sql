ALTER TABLE "platform"."api_keys" ADD COLUMN "module" text;--> statement-breakpoint
UPDATE "platform"."api_keys" SET "module" = 'billing' WHERE NOT ("permissions" ?| array['api_key.manage', 'user.manage', 'crm.read']);--> statement-breakpoint
ALTER TABLE "platform"."webhook_endpoints" ADD COLUMN "module" text NOT NULL DEFAULT 'billing';--> statement-breakpoint
ALTER TABLE "platform"."webhook_endpoints" ALTER COLUMN "module" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "api_keys_module_idx" ON "platform"."api_keys" USING btree ("module");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_module_idx" ON "platform"."webhook_endpoints" USING btree ("module");
