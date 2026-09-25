CREATE TABLE "tenant_management"."organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_type" text NOT NULL,
	"legal_name" text NOT NULL,
	"trade_name" text,
	"registration_number" text NOT NULL,
	"tax_identifier" text,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"website" text,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"country_code" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_tenant_unique" ON "tenant_management"."organizations" USING btree ("tenant_id");
--> statement-breakpoint
ALTER TABLE "tenant_management"."organizations"
ADD CONSTRAINT "organizations_tenant_fk"
FOREIGN KEY ("tenant_id")
REFERENCES "tenant_management"."tenants"("id");

--> statement-breakpoint
ALTER TABLE "tenant_management"."organizations"
ADD CONSTRAINT "organizations_distinct_identity_check"
CHECK ("id" <> "tenant_id");

--> statement-breakpoint
ALTER TABLE "tenant_management"."organizations"
ADD CONSTRAINT "organizations_type_check"
CHECK (
    "organization_type" IN (
        'REAL_ESTATE_AGENCY',
        'PROPERTY_MANAGEMENT_COMPANY',
        'SCI',
        'DEVELOPER',
        'SYNDIC',
        'PROFESSIONAL_LANDLORD',
        'OTHER'
    )
);

--> statement-breakpoint
ALTER TABLE "tenant_management"."organizations"
ADD CONSTRAINT "organizations_country_code_check"
CHECK ("country_code" ~ '^[A-Z]{2}$');

--> statement-breakpoint
ALTER TABLE "tenant_management"."organizations"
ADD CONSTRAINT "organizations_required_text_check"
CHECK (
    btrim("legal_name") <> ''
    AND btrim("registration_number") <> ''
    AND btrim("phone") <> ''
    AND btrim("email") <> ''
    AND btrim("address") <> ''
    AND btrim("city") <> ''
);

--> statement-breakpoint
ALTER TABLE "tenant_management"."organizations"
ADD CONSTRAINT "organizations_timestamps_check"
CHECK ("updated_at" >= "created_at");

--> statement-breakpoint
ALTER TABLE "tenant_management"."organizations"
ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "tenant_management"."organizations"
FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "organizations_create_platform_authority"
ON "tenant_management"."organizations"
FOR INSERT
WITH CHECK (
    current_setting('app.platform_authority', true) = 'tenant:create'
);