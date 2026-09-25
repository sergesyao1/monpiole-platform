CREATE TABLE "identity"."external_identities" (
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"internal_identity_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "identity"."external_identities" ADD CONSTRAINT "external_identities_internal_identity_tenant_fk" FOREIGN KEY ("internal_identity_id","tenant_id") REFERENCES "identity"."identities"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "external_identities_issuer_subject_unique" ON "identity"."external_identities" USING btree ("issuer","subject");
--> statement-breakpoint
ALTER TABLE "identity"."external_identities" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "identity"."external_identities" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "external_identities_link_or_resolve"
ON "identity"."external_identities"
USING (
	"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
	OR current_setting('app.external_identity_resolution', true) = 'resolve'
)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
