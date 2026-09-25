CREATE POLICY "identities_platform_initialization_inspection"
ON "identity"."identities"
FOR SELECT
USING (current_setting('app.identity_capability', true) = 'platform:initialize:inspect');
--> statement-breakpoint
CREATE POLICY "memberships_platform_initialization_inspection"
ON "identity"."tenant_memberships"
FOR SELECT
USING (current_setting('app.identity_capability', true) = 'platform:initialize:inspect');
