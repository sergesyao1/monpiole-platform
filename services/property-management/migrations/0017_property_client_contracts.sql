CREATE TABLE "property_management"."property_clients" (
	"client_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"phone_number" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_clients_display_name_check" CHECK (char_length(btrim("property_management"."property_clients"."display_name")) BETWEEN 1 AND 200),
	CONSTRAINT "property_clients_contact_check" CHECK (
    ("property_management"."property_clients"."phone_number" IS NULL OR char_length(btrim("property_management"."property_clients"."phone_number")) BETWEEN 1 AND 100)
    AND ("property_management"."property_clients"."email" IS NULL OR (char_length("property_management"."property_clients"."email") BETWEEN 3 AND 320
      AND "property_management"."property_clients"."email" = lower("property_management"."property_clients"."email")
      AND "property_management"."property_clients"."email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
  ),
	CONSTRAINT "property_clients_timestamps_check" CHECK ("property_management"."property_clients"."updated_at" >= "property_management"."property_clients"."created_at")
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_clients" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "property_management"."property_contracts" (
	"contract_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"contract_type" text NOT NULL,
	"status" text NOT NULL,
	"reference" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"activated_at" timestamp with time zone,
	"activated_by_actor_id" text,
	"activation_correlation_id" uuid,
	"ended_at" timestamp with time zone,
	"ended_by_actor_id" text,
	"ending_correlation_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_actor_id" text,
	"cancellation_correlation_id" uuid,
	CONSTRAINT "property_contracts_type_check" CHECK ("property_management"."property_contracts"."contract_type" IN ('LEASE', 'MANAGEMENT', 'OTHER')),
	CONSTRAINT "property_contracts_status_check" CHECK ("property_management"."property_contracts"."status" IN ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED')),
	CONSTRAINT "property_contracts_reference_check" CHECK (
    "property_management"."property_contracts"."reference" = upper("property_management"."property_contracts"."reference")
    AND "property_management"."property_contracts"."reference" ~ '^[A-Z0-9][A-Z0-9._/ -]{0,99}$'
  ),
	CONSTRAINT "property_contracts_dates_check" CHECK (
    ("property_management"."property_contracts"."start_date" IS NULL OR "property_management"."property_contracts"."end_date" IS NULL OR "property_management"."property_contracts"."end_date" >= "property_management"."property_contracts"."start_date")
    AND ("property_management"."property_contracts"."notes" IS NULL OR char_length(btrim("property_management"."property_contracts"."notes")) BETWEEN 1 AND 5000)
    AND "property_management"."property_contracts"."updated_at" >= "property_management"."property_contracts"."created_at"
  ),
	CONSTRAINT "property_contracts_lifecycle_check" CHECK (
    ("property_management"."property_contracts"."status" = 'DRAFT'
      AND "property_management"."property_contracts"."activated_at" IS NULL AND "property_management"."property_contracts"."activated_by_actor_id" IS NULL AND "property_management"."property_contracts"."activation_correlation_id" IS NULL
      AND "property_management"."property_contracts"."ended_at" IS NULL AND "property_management"."property_contracts"."ended_by_actor_id" IS NULL AND "property_management"."property_contracts"."ending_correlation_id" IS NULL
      AND "property_management"."property_contracts"."cancelled_at" IS NULL AND "property_management"."property_contracts"."cancelled_by_actor_id" IS NULL AND "property_management"."property_contracts"."cancellation_correlation_id" IS NULL)
    OR ("property_management"."property_contracts"."status" = 'ACTIVE'
      AND "property_management"."property_contracts"."start_date" IS NOT NULL
      AND "property_management"."property_contracts"."activated_at" IS NOT NULL AND "property_management"."property_contracts"."activated_at" >= "property_management"."property_contracts"."created_at"
      AND "property_management"."property_contracts"."activated_by_actor_id" IS NOT NULL AND "property_management"."property_contracts"."activation_correlation_id" IS NOT NULL
      AND "property_management"."property_contracts"."ended_at" IS NULL AND "property_management"."property_contracts"."ended_by_actor_id" IS NULL AND "property_management"."property_contracts"."ending_correlation_id" IS NULL
      AND "property_management"."property_contracts"."cancelled_at" IS NULL AND "property_management"."property_contracts"."cancelled_by_actor_id" IS NULL AND "property_management"."property_contracts"."cancellation_correlation_id" IS NULL)
    OR ("property_management"."property_contracts"."status" = 'ENDED'
      AND "property_management"."property_contracts"."start_date" IS NOT NULL AND "property_management"."property_contracts"."end_date" IS NOT NULL
      AND "property_management"."property_contracts"."activated_at" IS NOT NULL AND "property_management"."property_contracts"."activated_at" >= "property_management"."property_contracts"."created_at"
      AND "property_management"."property_contracts"."activated_by_actor_id" IS NOT NULL AND "property_management"."property_contracts"."activation_correlation_id" IS NOT NULL
      AND "property_management"."property_contracts"."ended_at" IS NOT NULL AND "property_management"."property_contracts"."ended_at" >= "property_management"."property_contracts"."activated_at"
      AND "property_management"."property_contracts"."ended_by_actor_id" IS NOT NULL AND "property_management"."property_contracts"."ending_correlation_id" IS NOT NULL
      AND "property_management"."property_contracts"."cancelled_at" IS NULL AND "property_management"."property_contracts"."cancelled_by_actor_id" IS NULL AND "property_management"."property_contracts"."cancellation_correlation_id" IS NULL)
    OR ("property_management"."property_contracts"."status" = 'CANCELLED'
      AND "property_management"."property_contracts"."ended_at" IS NULL AND "property_management"."property_contracts"."ended_by_actor_id" IS NULL AND "property_management"."property_contracts"."ending_correlation_id" IS NULL
      AND "property_management"."property_contracts"."cancelled_at" IS NOT NULL AND "property_management"."property_contracts"."cancelled_at" >= "property_management"."property_contracts"."created_at"
      AND "property_management"."property_contracts"."cancellation_correlation_id" IS NOT NULL AND "property_management"."property_contracts"."cancelled_by_actor_id" IS NOT NULL
      AND (("property_management"."property_contracts"."activated_at" IS NULL AND "property_management"."property_contracts"."activated_by_actor_id" IS NULL AND "property_management"."property_contracts"."activation_correlation_id" IS NULL)
        OR ("property_management"."property_contracts"."activated_at" IS NOT NULL AND "property_management"."property_contracts"."activated_at" >= "property_management"."property_contracts"."created_at"
          AND "property_management"."property_contracts"."cancelled_at" >= "property_management"."property_contracts"."activated_at"
          AND "property_management"."property_contracts"."activated_by_actor_id" IS NOT NULL AND "property_management"."property_contracts"."activation_correlation_id" IS NOT NULL)))
  )
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_contracts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "property_clients_tenant_client_unique" ON "property_management"."property_clients" USING btree ("tenant_id","client_id");--> statement-breakpoint
ALTER TABLE "property_management"."property_contracts" ADD CONSTRAINT "property_contracts_property_tenant_fk" FOREIGN KEY ("tenant_id","property_id") REFERENCES "property_management"."properties"("tenant_id","property_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_management"."property_contracts" ADD CONSTRAINT "property_contracts_client_tenant_fk" FOREIGN KEY ("tenant_id","client_id") REFERENCES "property_management"."property_clients"("tenant_id","client_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_clients_tenant_created_client_idx" ON "property_management"."property_clients" USING btree ("tenant_id","created_at" DESC NULLS LAST,"client_id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "property_contracts_tenant_contract_unique" ON "property_management"."property_contracts" USING btree ("tenant_id","contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_contracts_tenant_reference_unique" ON "property_management"."property_contracts" USING btree ("tenant_id","reference");--> statement-breakpoint
CREATE INDEX "property_contracts_tenant_property_created_idx" ON "property_management"."property_contracts" USING btree ("tenant_id","property_id","created_at" DESC NULLS LAST,"contract_id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "property_contracts_tenant_property_status_idx" ON "property_management"."property_contracts" USING btree ("tenant_id","property_id","status");--> statement-breakpoint
CREATE INDEX "property_contracts_tenant_client_idx" ON "property_management"."property_contracts" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE POLICY "property_clients_tenant_isolation" ON "property_management"."property_clients" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_clients"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("property_management"."property_clients"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "property_contracts_tenant_isolation" ON "property_management"."property_contracts" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_contracts"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("property_management"."property_contracts"."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "property_management"."property_clients" TO "monpiole_runtime";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "property_management"."property_contracts" TO "monpiole_runtime";
