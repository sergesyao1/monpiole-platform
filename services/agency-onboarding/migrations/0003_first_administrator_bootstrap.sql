CREATE TABLE agency_onboarding.agency_registration_administrators (
    registration_id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    internal_identity_id uuid NOT NULL,
    administrator_kind text NOT NULL,
    status text NOT NULL,

    bootstrap_token_hash text NOT NULL,
    bootstrap_token_expires_at timestamptz NOT NULL,
    bootstrap_token_consumed_at timestamptz,

    created_by_platform_identity_id uuid NOT NULL,
    created_at timestamptz NOT NULL,
    identity_linked_at timestamptz,
    activated_at timestamptz,
    cancelled_at timestamptz,

    CONSTRAINT agency_registration_administrators_registration_fk
        FOREIGN KEY (registration_id)
        REFERENCES agency_onboarding.agency_registrations(registration_id)
        ON DELETE RESTRICT,

    CONSTRAINT agency_registration_administrators_tenant_unique
        UNIQUE (tenant_id),

    CONSTRAINT agency_registration_administrators_identity_unique
        UNIQUE (internal_identity_id),

    CONSTRAINT agency_registration_administrators_token_hash_unique
        UNIQUE (bootstrap_token_hash),

    CONSTRAINT agency_registration_administrators_kind_check
        CHECK (administrator_kind = 'FIRST_ADMINISTRATOR'),

    CONSTRAINT agency_registration_administrators_status_check
        CHECK (
            status IN (
                'PENDING_IDENTITY',
                'IDENTITY_LINKED',
                'ACTIVE',
                'CANCELLED'
            )
        ),

    CONSTRAINT agency_registration_administrators_token_hash_check
        CHECK (
            bootstrap_token_hash ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT agency_registration_administrators_expiry_check
        CHECK (
            bootstrap_token_expires_at > created_at
        ),

    CONSTRAINT agency_registration_administrators_consumed_check
        CHECK (
            bootstrap_token_consumed_at IS NULL
            OR bootstrap_token_consumed_at >= created_at
        ),

    CONSTRAINT agency_registration_administrators_lifecycle_check
        CHECK (
            (
                status = 'PENDING_IDENTITY'
                AND identity_linked_at IS NULL
                AND activated_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                status = 'IDENTITY_LINKED'
                AND identity_linked_at IS NOT NULL
                AND activated_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                status = 'ACTIVE'
                AND identity_linked_at IS NOT NULL
                AND activated_at IS NOT NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                status = 'CANCELLED'
                AND activated_at IS NULL
                AND cancelled_at IS NOT NULL
            )
        )
);

CREATE INDEX agency_registration_administrators_pending_token_idx
    ON agency_onboarding.agency_registration_administrators (
        bootstrap_token_expires_at,
        registration_id
    )
    WHERE bootstrap_token_consumed_at IS NULL
      AND status = 'PENDING_IDENTITY';

ALTER TABLE
    agency_onboarding.agency_registration_administrators
ENABLE ROW LEVEL SECURITY;

ALTER TABLE
    agency_onboarding.agency_registration_administrators
FORCE ROW LEVEL SECURITY;

CREATE POLICY agency_registration_administrators_platform_manage
    ON agency_onboarding.agency_registration_administrators
    FOR ALL
    USING (
        current_setting('app.platform_capability', true)
            = 'agency-registration:administrator'
    )
    WITH CHECK (
        current_setting('app.platform_capability', true)
            = 'agency-registration:administrator'
    );

REVOKE ALL PRIVILEGES
    ON TABLE agency_onboarding.agency_registration_administrators
    FROM PUBLIC;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON TABLE agency_onboarding.agency_registration_administrators
    FROM monpiole_runtime;

GRANT SELECT, INSERT, UPDATE
    ON TABLE agency_onboarding.agency_registration_administrators
    TO monpiole_runtime;