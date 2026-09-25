CREATE TABLE "property_management"."property_owners" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_type" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"legal_name" text,
	"registration_number" text,
	"phone_number" text,
	"email" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "property_owners_tenant_owner_unique" ON "property_management"."property_owners" USING btree ("tenant_id","owner_id");
--> statement-breakpoint
ALTER TABLE "property_management"."property_owners" ADD CONSTRAINT "property_owners_identity_check" CHECK (
	("owner_type" = 'INDIVIDUAL'
		AND char_length(btrim("first_name")) BETWEEN 1 AND 200
		AND char_length(btrim("last_name")) BETWEEN 1 AND 200
		AND "legal_name" IS NULL AND "registration_number" IS NULL)
	OR
	("owner_type" = 'LEGAL_ENTITY'
		AND char_length(btrim("legal_name")) BETWEEN 1 AND 300
		AND "first_name" IS NULL AND "last_name" IS NULL
		AND ("registration_number" IS NULL OR char_length(btrim("registration_number")) BETWEEN 1 AND 200))
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_owners" ADD CONSTRAINT "property_owners_contact_check" CHECK (
	("phone_number" IS NULL OR char_length(btrim("phone_number")) BETWEEN 1 AND 100)
	AND ("email" IS NULL OR (char_length("email") BETWEEN 3 AND 320 AND "email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_owners" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "property_management"."property_owners" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "property_owners_tenant_isolation" ON "property_management"."property_owners"
USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
