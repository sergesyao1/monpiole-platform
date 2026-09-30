ALTER TABLE agency_onboarding.agency_registrations
  ADD COLUMN organization_type text;

UPDATE agency_onboarding.agency_registrations
SET organization_type = 'REAL_ESTATE_AGENCY'
WHERE organization_type IS NULL;

ALTER TABLE agency_onboarding.agency_registrations
  ALTER COLUMN organization_type SET DEFAULT 'REAL_ESTATE_AGENCY',
  ALTER COLUMN organization_type SET NOT NULL;

ALTER TABLE agency_onboarding.agency_registrations
  ADD CONSTRAINT agency_registrations_organization_type_check
  CHECK (organization_type IN (
    'REAL_ESTATE_AGENCY',
    'PROPERTY_MANAGEMENT_COMPANY',
    'SCI',
    'DEVELOPER',
    'SYNDIC',
    'PROFESSIONAL_LANDLORD',
    'OTHER'
  ));
