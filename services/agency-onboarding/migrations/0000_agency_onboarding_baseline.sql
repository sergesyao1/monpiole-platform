CREATE SCHEMA "agency_onboarding";
--> statement-breakpoint
CREATE TABLE "agency_onboarding"."agency_registration_documents" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"registration_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"checksum_sha256" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "agency_registration_documents_type_check" CHECK (char_length(btrim("agency_onboarding"."agency_registration_documents"."document_type")) BETWEEN 1 AND 100),
	CONSTRAINT "agency_registration_documents_filename_check" CHECK (char_length(btrim("agency_onboarding"."agency_registration_documents"."original_filename")) BETWEEN 1 AND 255),
	CONSTRAINT "agency_registration_documents_storage_key_check" CHECK (char_length(btrim("agency_onboarding"."agency_registration_documents"."storage_key")) BETWEEN 1 AND 1000),
	CONSTRAINT "agency_registration_documents_size_check" CHECK ("agency_onboarding"."agency_registration_documents"."size_bytes" > 0 AND "agency_onboarding"."agency_registration_documents"."size_bytes" <= 52428800),
	CONSTRAINT "agency_registration_documents_checksum_check" CHECK ("agency_onboarding"."agency_registration_documents"."checksum_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "agency_onboarding"."agency_registration_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "agency_onboarding"."agency_registrations" (
	"registration_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"agency_legal_name" text NOT NULL,
	"agency_trade_name" text,
	"registration_number" text NOT NULL,
	"tax_identifier" text,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"website" text,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"country_code" text NOT NULL,
	"contact_first_name" text NOT NULL,
	"contact_last_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"review_started_at" timestamp with time zone,
	"reviewed_by_identity_id" uuid,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"approval_provisioning_started_at" timestamp with time zone,
	"provisioned_tenant_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	CONSTRAINT "agency_registrations_status_check" CHECK ("agency_onboarding"."agency_registrations"."status" IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
	CONSTRAINT "agency_registrations_country_check" CHECK ("agency_onboarding"."agency_registrations"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "agency_registrations_legal_name_check" CHECK (char_length(btrim("agency_onboarding"."agency_registrations"."agency_legal_name")) BETWEEN 1 AND 200),
	CONSTRAINT "agency_registrations_registration_number_check" CHECK (char_length(btrim("agency_onboarding"."agency_registrations"."registration_number")) BETWEEN 1 AND 100),
	CONSTRAINT "agency_registrations_rejection_reason_check" CHECK ("agency_onboarding"."agency_registrations"."rejection_reason" IS NULL
        OR char_length(btrim("agency_onboarding"."agency_registrations"."rejection_reason")) BETWEEN 1 AND 2000),
	CONSTRAINT "agency_registrations_lifecycle_check" CHECK (
        (
          "agency_onboarding"."agency_registrations"."status" = 'SUBMITTED'
          AND "agency_onboarding"."agency_registrations"."review_started_at" IS NULL
          AND "agency_onboarding"."agency_registrations"."reviewed_by_identity_id" IS NULL
          AND "agency_onboarding"."agency_registrations"."approved_at" IS NULL
          AND "agency_onboarding"."agency_registrations"."rejected_at" IS NULL
          AND "agency_onboarding"."agency_registrations"."rejection_reason" IS NULL
          AND "agency_onboarding"."agency_registrations"."approval_provisioning_started_at" IS NULL
          AND "agency_onboarding"."agency_registrations"."provisioned_tenant_id" IS NULL
        )
        OR
        (
          "agency_onboarding"."agency_registrations"."status" = 'UNDER_REVIEW'
          AND "agency_onboarding"."agency_registrations"."review_started_at" IS NOT NULL
          AND "agency_onboarding"."agency_registrations"."reviewed_by_identity_id" IS NOT NULL
          AND "agency_onboarding"."agency_registrations"."approved_at" IS NULL
          AND "agency_onboarding"."agency_registrations"."rejected_at" IS NULL
          AND "agency_onboarding"."agency_registrations"."rejection_reason" IS NULL
          AND "agency_onboarding"."agency_registrations"."provisioned_tenant_id" IS NULL
        )
        OR
        (
          "agency_onboarding"."agency_registrations"."status" = 'APPROVED'
          AND "agency_onboarding"."agency_registrations"."review_started_at" IS NOT NULL
          AND "agency_onboarding"."agency_registrations"."reviewed_by_identity_id" IS NOT NULL
          AND "agency_onboarding"."agency_registrations"."approved_at" IS NOT NULL
          AND "agency_onboarding"."agency_registrations"."rejected_at" IS NULL
          AND "agency_onboarding"."agency_registrations"."rejection_reason" IS NULL
          AND "agency_onboarding"."agency_registrations"."approval_provisioning_started_at" IS NOT NULL
          AND "agency_onboarding"."agency_registrations"."provisioned_tenant_id" IS NOT NULL
        )
        OR
        (
          "agency_onboarding"."agency_registrations"."status" = 'REJECTED'
          AND "agency_onboarding"."agency_registrations"."review_started_at" IS NOT NULL
          AND "agency_onboarding"."agency_registrations"."reviewed_by_identity_id" IS NOT NULL
          AND "agency_onboarding"."agency_registrations"."approved_at" IS NULL
          AND "agency_onboarding"."agency_registrations"."rejected_at" IS NOT NULL
          AND "agency_onboarding"."agency_registrations"."rejection_reason" IS NOT NULL
          AND "agency_onboarding"."agency_registrations"."approval_provisioning_started_at" IS NULL
          AND "agency_onboarding"."agency_registrations"."provisioned_tenant_id" IS NULL
        )
      )
);
--> statement-breakpoint
ALTER TABLE "agency_onboarding"."agency_registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agency_onboarding"."agency_registration_documents" ADD CONSTRAINT "agency_registration_documents_registration_fk" FOREIGN KEY ("registration_id") REFERENCES "agency_onboarding"."agency_registrations"("registration_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agency_registration_documents_registration_idx" ON "agency_onboarding"."agency_registration_documents" USING btree ("registration_id","created_at","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agency_registration_documents_storage_key_unique" ON "agency_onboarding"."agency_registration_documents" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "agency_registrations_registration_number_unique" ON "agency_onboarding"."agency_registrations" USING btree ("registration_number");--> statement-breakpoint
CREATE INDEX "agency_registrations_status_submitted_idx" ON "agency_onboarding"."agency_registrations" USING btree ("status","submitted_at" DESC NULLS LAST,"registration_id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "agency_registrations_provisioned_tenant_unique" ON "agency_onboarding"."agency_registrations" USING btree ("provisioned_tenant_id") WHERE "agency_onboarding"."agency_registrations"."provisioned_tenant_id" IS NOT NULL;--> statement-breakpoint
CREATE POLICY "agency_registration_documents_platform_select" ON "agency_onboarding"."agency_registration_documents" AS PERMISSIVE FOR SELECT TO public USING (
        current_setting('app.platform_capability', true)
          IN (
            'agency-registration:retrieve',
            'agency-registration:review',
            'agency-registration:decide'
          )
      );--> statement-breakpoint
CREATE POLICY "agency_registration_documents_public_submit" ON "agency_onboarding"."agency_registration_documents" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
        current_setting('app.platform_capability', true)
          = 'agency-registration:submit'
      );--> statement-breakpoint
CREATE POLICY "agency_registrations_platform_select" ON "agency_onboarding"."agency_registrations" AS PERMISSIVE FOR SELECT TO public USING (
        current_setting('app.platform_capability', true)
          IN (
            'agency-registration:retrieve',
            'agency-registration:review',
            'agency-registration:decide'
          )
      );--> statement-breakpoint
CREATE POLICY "agency_registrations_platform_update" ON "agency_onboarding"."agency_registrations" AS PERMISSIVE FOR UPDATE TO public USING (
        current_setting('app.platform_capability', true)
          IN ('agency-registration:review', 'agency-registration:decide')
      ) WITH CHECK (
        current_setting('app.platform_capability', true)
          IN ('agency-registration:review', 'agency-registration:decide')
      );--> statement-breakpoint
CREATE POLICY "agency_registrations_public_submit" ON "agency_onboarding"."agency_registrations" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
        current_setting('app.platform_capability', true)
          = 'agency-registration:submit'
        AND "agency_onboarding"."agency_registrations"."status" = 'SUBMITTED'
      );
--> statement-breakpoint
ALTER TABLE "agency_onboarding"."agency_registrations"
FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "agency_onboarding"."agency_registration_documents"
FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
REVOKE ALL PRIVILEGES
ON TABLE "agency_onboarding"."agency_registrations"
FROM PUBLIC;

--> statement-breakpoint
REVOKE ALL PRIVILEGES
ON TABLE "agency_onboarding"."agency_registration_documents"
FROM PUBLIC;

--> statement-breakpoint
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE "agency_onboarding"."agency_registrations"
FROM "monpiole_runtime";

--> statement-breakpoint
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE "agency_onboarding"."agency_registration_documents"
FROM "monpiole_runtime";

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE
ON TABLE "agency_onboarding"."agency_registrations"
TO "monpiole_runtime";

--> statement-breakpoint
GRANT SELECT, INSERT
ON TABLE "agency_onboarding"."agency_registration_documents"
TO "monpiole_runtime";