CREATE SCHEMA "property_management";
--> statement-breakpoint
CREATE TABLE "property_management"."properties" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"property_type" text NOT NULL,
	"transaction_type" text NOT NULL,
	"status" text NOT NULL,
	"country" text NOT NULL,
	"city" text NOT NULL,
	"district" text NOT NULL,
	"address_line" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "properties_tenant_property_unique" ON "property_management"."properties" USING btree ("tenant_id","property_id");
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_title_length_check"
CHECK (char_length("title") BETWEEN 1 AND 200);
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_description_length_check"
CHECK ("description" IS NULL OR char_length("description") <= 5000);
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_type_check"
CHECK ("property_type" IN ('APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL', 'OTHER'));
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_transaction_type_check"
CHECK ("transaction_type" IN ('LONG_TERM_RENTAL', 'SHORT_TERM_RENTAL', 'SALE'));
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_status_check" CHECK ("status" = 'DRAFT');
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ADD CONSTRAINT "properties_country_check" CHECK ("country" ~ '^[A-Z]{2}$');
--> statement-breakpoint
ALTER TABLE "property_management"."properties" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "property_management"."properties" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "properties_tenant_isolation" ON "property_management"."properties"
USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
