CREATE TABLE "portal_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"portal_user_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portal_sessions" ADD COLUMN "portal_user_id" text;--> statement-breakpoint
ALTER TABLE "portal_memberships" ADD CONSTRAINT "portal_memberships_portal_user_id_portal_users_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "public"."portal_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_memberships" ADD CONSTRAINT "portal_memberships_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_memberships_portal_user_id_customer_id_idx" ON "portal_memberships" USING btree ("portal_user_id","customer_id");--> statement-breakpoint
CREATE INDEX "portal_memberships_customer_id_idx" ON "portal_memberships" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_users_email_idx" ON "portal_users" USING btree ("email");--> statement-breakpoint
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_portal_user_id_portal_users_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "public"."portal_users"("id") ON DELETE no action ON UPDATE no action;