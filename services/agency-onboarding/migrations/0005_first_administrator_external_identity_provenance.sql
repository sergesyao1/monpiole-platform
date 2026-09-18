ALTER TABLE agency_onboarding.agency_registration_administrators
    ADD COLUMN external_issuer text,
    ADD COLUMN external_subject text;

ALTER TABLE agency_onboarding.agency_registration_administrators
    ADD CONSTRAINT agency_registration_administrators_external_identity_pair_check
        CHECK (
            (external_issuer IS NULL AND external_subject IS NULL)
            OR
            (
                external_issuer IS NOT NULL
                AND external_subject IS NOT NULL
                AND char_length(btrim(external_issuer)) > 0
                AND char_length(btrim(external_subject)) > 0
            )
        );

ALTER TABLE agency_onboarding.agency_registration_administrators
    ADD CONSTRAINT agency_registration_administrators_external_identity_lifecycle_check
        CHECK (
            (
                status = 'PENDING_IDENTITY'
                AND external_issuer IS NULL
                AND external_subject IS NULL
            )
            OR
            (
                status IN ('IDENTITY_LINKED', 'ACTIVE')
                AND external_issuer IS NOT NULL
                AND external_subject IS NOT NULL
            )
            OR
            status = 'CANCELLED'
        ) NOT VALID;