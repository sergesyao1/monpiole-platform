ALTER TABLE agency_onboarding.agency_registration_administrators
    ADD COLUMN invited_email text;

DO $$
BEGIN
    IF to_regclass('identity.identities') IS NOT NULL THEN
        EXECUTE $backfill$
            UPDATE agency_onboarding.agency_registration_administrators AS administrator
               SET invited_email = identity.email
              FROM identity.identities AS identity
             WHERE identity.id = administrator.internal_identity_id
               AND administrator.invited_email IS NULL
        $backfill$;
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM agency_onboarding.agency_registration_administrators
         WHERE invited_email IS NULL
            OR char_length(btrim(invited_email)) = 0
    ) THEN
        RAISE EXCEPTION
            'Unable to backfill first administrator invited_email';
    END IF;
END
$$;

ALTER TABLE agency_onboarding.agency_registration_administrators
    ALTER COLUMN invited_email SET NOT NULL;

ALTER TABLE agency_onboarding.agency_registration_administrators
    ADD CONSTRAINT agency_registration_administrators_invited_email_check
    CHECK (
        char_length(btrim(invited_email)) BETWEEN 3 AND 320
    );
