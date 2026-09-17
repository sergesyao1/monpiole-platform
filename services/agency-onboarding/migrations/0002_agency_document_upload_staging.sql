CREATE TABLE agency_onboarding.agency_registration_document_uploads (
    upload_id uuid PRIMARY KEY,
    storage_key text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    checksum_sha256 text NOT NULL,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,

    CONSTRAINT agency_registration_document_uploads_storage_key_unique
        UNIQUE (storage_key),

    CONSTRAINT agency_registration_document_uploads_storage_key_check
        CHECK (
            char_length(btrim(storage_key))
                BETWEEN 1 AND 1000
        ),

    CONSTRAINT agency_registration_document_uploads_filename_check
        CHECK (
            char_length(btrim(original_filename))
                BETWEEN 1 AND 255
        ),

    CONSTRAINT agency_registration_document_uploads_mime_type_check
        CHECK (
            char_length(btrim(mime_type))
                BETWEEN 1 AND 255
        ),

    CONSTRAINT agency_registration_document_uploads_size_check
        CHECK (
            size_bytes > 0
            AND size_bytes <= 52428800
        ),

    CONSTRAINT agency_registration_document_uploads_checksum_check
        CHECK (
            checksum_sha256 ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT agency_registration_document_uploads_expiry_check
        CHECK (
            expires_at > created_at
        ),

    CONSTRAINT agency_registration_document_uploads_consumed_check
        CHECK (
            consumed_at IS NULL
            OR consumed_at >= created_at
        )
);

CREATE INDEX agency_registration_document_uploads_expiry_idx
    ON agency_onboarding.agency_registration_document_uploads (
        expires_at,
        upload_id
    )
    WHERE consumed_at IS NULL;

ALTER TABLE
    agency_onboarding.agency_registration_document_uploads
ENABLE ROW LEVEL SECURITY;

ALTER TABLE
    agency_onboarding.agency_registration_document_uploads
FORCE ROW LEVEL SECURITY;

CREATE POLICY agency_registration_document_uploads_public_submit
    ON agency_onboarding.agency_registration_document_uploads
    FOR ALL
    USING (
        current_setting(
            'app.platform_capability',
            true
        ) = 'agency-registration:submit'
    )
    WITH CHECK (
        current_setting(
            'app.platform_capability',
            true
        ) = 'agency-registration:submit'
    );

GRANT SELECT, INSERT, UPDATE, DELETE
    ON agency_onboarding.agency_registration_document_uploads
    TO monpiole_runtime;