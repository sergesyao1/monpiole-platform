CREATE POLICY "tenants_exists_capability"
ON "tenant_management"."tenants"
FOR SELECT
USING (current_setting('app.tenant_capability', true) = 'tenant:exists'
  AND "id"::text = current_setting('app.tenant_id', true));
