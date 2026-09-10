CREATE TABLE "property_management"."property_application_contract_origins" (
	"tenant_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_application_contract_origins_tenant_id_application_id_pk" PRIMARY KEY("tenant_id","application_id")
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_application_contract_origins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_application_contract_origins" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_application_contract_origins" ADD CONSTRAINT "property_application_contract_origins_conversion_tenant_fk" FOREIGN KEY ("tenant_id","application_id") REFERENCES "property_management"."property_application_client_conversions"("tenant_id","application_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_management"."property_application_contract_origins" ADD CONSTRAINT "property_application_contract_origins_contract_tenant_fk" FOREIGN KEY ("tenant_id","contract_id") REFERENCES "property_management"."property_contracts"("tenant_id","contract_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_application_contract_origins_tenant_contract_unique" ON "property_management"."property_application_contract_origins" USING btree ("tenant_id","contract_id");--> statement-breakpoint
CREATE POLICY "property_application_contract_origins_tenant_isolation" ON "property_management"."property_application_contract_origins" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_application_contract_origins"."tenant_id"=NULLIF(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK ("property_management"."property_application_contract_origins"."tenant_id"=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "property_management"."property_application_contract_origins" TO "monpiole_runtime";
