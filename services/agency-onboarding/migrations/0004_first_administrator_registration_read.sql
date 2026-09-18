DROP POLICY IF EXISTS "agency_registrations_platform_select"
    ON "agency_onboarding"."agency_registrations";

CREATE POLICY "agency_registrations_platform_select"
    ON "agency_onboarding"."agency_registrations"
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (
        current_setting('app.platform_capability', true)
            IN (
                'agency-registration:retrieve',
                'agency-registration:review',
                'agency-registration:decide',
                'agency-registration:administrator'
            )
    );