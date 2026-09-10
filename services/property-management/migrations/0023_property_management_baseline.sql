CREATE TABLE "property_management"."property_application_client_conversions" (
	"tenant_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"converted_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	CONSTRAINT "property_application_client_conversions_tenant_id_application_id_pk" PRIMARY KEY("tenant_id","application_id")
);
--> statement-breakpoint
ALTER TABLE "property_management"."property_application_client_conversions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_application_client_conversions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "property_management"."property_application_client_conversions" ADD CONSTRAINT "property_application_client_conversions_application_tenant_fk" FOREIGN KEY ("tenant_id","application_id") REFERENCES "property_management"."property_applications"("tenant_id","application_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_management"."property_application_client_conversions" ADD CONSTRAINT "property_application_client_conversions_client_tenant_fk" FOREIGN KEY ("tenant_id","client_id") REFERENCES "property_management"."property_clients"("tenant_id","client_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_application_client_conversions_tenant_client_unique" ON "property_management"."property_application_client_conversions" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE POLICY "property_application_client_conversions_tenant_isolation" ON "property_management"."property_application_client_conversions" AS PERMISSIVE FOR ALL TO public USING ("property_management"."property_application_client_conversions"."tenant_id"=NULLIF(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK ("property_management"."property_application_client_conversions"."tenant_id"=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "property_management"."property_application_client_conversions" TO "monpiole_runtime";
