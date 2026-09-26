ALTER TABLE tenant_management.organizations
  ADD COLUMN default_language_code text,
  ADD COLUMN default_locale text,
  ADD COLUMN default_currency_code text,
  ADD COLUMN default_timezone text;

UPDATE tenant_management.organizations
SET
  default_language_code = 'fr',
  default_locale = 'fr-CI',
  default_currency_code = 'XOF',
  default_timezone = 'Africa/Abidjan'
WHERE country_code = 'CI'
  AND default_language_code IS NULL
  AND default_locale IS NULL
  AND default_currency_code IS NULL
  AND default_timezone IS NULL;

ALTER TABLE tenant_management.organizations
  ADD CONSTRAINT organizations_international_all_or_none_check CHECK (
    (
      default_language_code IS NULL
      AND default_locale IS NULL
      AND default_currency_code IS NULL
      AND default_timezone IS NULL
    )
    OR
    (
      default_language_code IS NOT NULL
      AND default_locale IS NOT NULL
      AND default_currency_code IS NOT NULL
      AND default_timezone IS NOT NULL
    )
  ),
  ADD CONSTRAINT organizations_default_language_code_check CHECK (
    default_language_code IS NULL
    OR default_language_code ~ '^[a-z]{2,3}$'
  ),
  ADD CONSTRAINT organizations_default_currency_code_check CHECK (
    default_currency_code IS NULL
    OR default_currency_code ~ '^[A-Z]{3}$'
  );
