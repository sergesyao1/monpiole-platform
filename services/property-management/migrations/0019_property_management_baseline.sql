CREATE TABLE "property_management"."property_inquiries" (
	"inquiry_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"contact_name" text NOT NULL,
	"email" text,
	"phone_number" text,
	"message" text,
	"consent_version" text NOT NULL,
	"consent_given_at" timestamp with time zone NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "property_inquiries_contact_check" CHECK (char_length(btrim("property_management"."property_inquiries"."contact_name")) BETWEEN 1 AND 200 AND ("property_management"."property_inquiries"."email" IS NOT NULL OR "property_management"."property_inquiries"."phone_number" IS NOT NULL) AND ("property_management"."property_inquiries"."email" IS NULL OR (char_length("property_management"."property_inquiries"."email") BETWEEN 3 AND 320 AND "property_management"."property_inquiries"."email" = lower("property_management"."property_inquiries"."email") AND "property_management"."property_inquiries"."email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) AND ("property_management"."property_inquiries"."phone_number" IS NULL OR char_length(btrim("property_management"."property_inquiries"."phone_number")) BETWEEN 1 AND 100) AND ("property_management"."property_inquiries"."message" IS NULL OR char_length(btrim("property_management"."property_inquiries"."message")) BETWEEN 1 AND 2000)),
	CONSTRAINT "property_inquiries_consent_check" CHECK (char_length(btrim("property_management"."property_inquiries"."consent_version")) BETWEEN 1 AND 50 AND char_length(btrim("property_management"."property_inquiries"."idempotency_key")) BETWEEN 1 AND 100),
	CONSTRAINT "property_inquiries_lifecycle_check" CHECK (("property_management"."property_inquiries"."status"='NEW' AND "property_management"."property_inquiries"."acknowledged_at" IS NULL AND "property_management"."property_inquiries"."closed_at" IS NULL) OR ("property_management"."property_inquiries"."status"='ACKNOWLEDGED' AND "property_management"."property_inquiries"."acknowledged_at" IS NOT NULL AND "property_management"."property_inquiries"."closed_at" IS NULL) OR ("property_management"."property_inquiries"."status"='CLOSED' AND "property_management"."property_inquiries"."closed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiries" ADD CONSTRAINT "property_inquiries_property_tenant_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "property_management"."properties"("tenant_id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_inquiries_tenant_inquiry_unique" ON "property_management"."property_inquiries" USING btree ("tenant_id","inquiry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_inquiries_tenant_property_idempotency_unique" ON "property_management"."property_inquiries" USING btree ("tenant_id","property_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "property_inquiries_tenant_property_created_idx" ON "property_management"."property_inquiries" USING btree ("tenant_id","property_id","created_at" DESC NULLS LAST,"inquiry_id" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "property_inquiries_tenant_isolation" ON "property_management"."property_inquiries" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_inquiries"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("property_management"."property_inquiries"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "property_management"."property_inquiries" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "property_management"."property_inquiries" TO "monpiole_runtime";
