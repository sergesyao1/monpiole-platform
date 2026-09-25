CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE TABLE "identity"."identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"status" text NOT NULL,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."tenant_memberships" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"identity_id" uuid NOT NULL,
	"role" text NOT NULL,
	"correlation_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "identities_email_unique" ON "identity"."identities" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "identities_id_tenant_unique" ON "identity"."identities" USING btree ("id","tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_memberships_identity_unique" ON "identity"."tenant_memberships" USING btree ("identity_id");--> statement-breakpoint
ALTER TABLE "identity"."tenant_memberships" ADD CONSTRAINT "tenant_memberships_identity_tenant_fk" FOREIGN KEY ("identity_id","tenant_id") REFERENCES "identity"."identities"("id","tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "identity"."identities" ADD CONSTRAINT "identities_status_check"
CHECK ("status" IN ('PENDING_ACTIVATION', 'ACTIVE'));
--> statement-breakpoint
ALTER TABLE "identity"."tenant_memberships" ADD CONSTRAINT "tenant_memberships_role_check"
CHECK ("role" = 'TENANT_ADMINISTRATOR');
--> statement-breakpoint
ALTER TABLE "identity"."identities" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "identity"."identities" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "identity"."tenant_memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "identity"."tenant_memberships" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "identities_tenant_isolation"
ON "identity"."identities"
USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_memberships_tenant_isolation"
ON "identity"."tenant_memberships"
USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
