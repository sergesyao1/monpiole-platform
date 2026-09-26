# TASK-104 - Complete Agency to Organization Generalization

## Status

COMPLETE

## Architectural boundary

- `Organization` is the customer/legal business concept owned by Tenant Management.
- `Tenant` remains the technical SaaS isolation and authorization boundary.
- V1 associates one Organization with one primary Tenant while preserving distinct identifiers.
- `countryCode` remains business data and never selects tenant scope.
- `Organization.type` is classification data and never grants permissions.

## Coupling audit

### GENERIC

- Registration identity, legal/contact/address data, supporting documents and lifecycle.
- Platform submission review, approval, rejection and provisioning claim/convergence.
- Tenant plus Organization composite provisioning through `ProvisionOrganizationTenant`.
- First-administrator invitation, verified-email binding, Auth0 provenance, activation and replay.
- Platform review grants and tenant-scoped `TENANT_ADMINISTRATOR` authority.
- Public onboarding form and platform review workspace, except their historical labels/routes.

### AGENCY-SPECIFIC

- `REAL_ESTATE_AGENCY` as one valid Organization type.
- Agency-specific labels that may be selected conditionally for that type.
- Historical registration records, which semantically represent `REAL_ESTATE_AGENCY`.

### TRANSITIONAL

- `services/agency-onboarding` package name and bounded-context folder.
- PostgreSQL `agency_onboarding` schema, `agency_registrations` tables and existing migrations.
- Existing `/v1/agency-registrations`, `/v1/agency-registration-documents` and platform Agency routes.
- Existing `AgencyRegistration*`, `AgencyTenantProvisioning*` exported names and error codes.
- Existing `agencyLegalName` / `agencyTradeName` compatibility DTO fields.
- Existing Agency Web component/file names and bookmarked routes.

These transitional surfaces remain supported and forward to the same canonical implementation;
they are not duplicated business workflows.

## Design decisions

1. Add `organizationType` to the existing registration aggregate and persistence table.
2. Backfill historical rows to `REAL_ESTATE_AGENCY`; do not rename or recreate physical tables.
3. Do not persist `provisionedOrganizationId`: the provisioned Organization is uniquely retrievable
   through the existing one-Organization-per-Tenant invariant, while `provisionedTenantId` remains
   required by the bootstrap lifecycle.
4. Introduce generic Organization registration/provisioning names as canonical aliases and keep
   Agency names as compatibility aliases/adapters.
5. Map `registration.organizationType` to `organization.type`; remove the generic flow's hard-coded
   `REAL_ESTATE_AGENCY` value.
6. Retain `TENANT_ADMINISTRATOR` as the one generic tenant administrator role. No `AGENCY_ADMIN`
   persisted role exists in the current lifecycle, so no competing role or role migration is added.
7. Add canonical Organization HTTP routes additively; legacy Agency routes remain operational.
8. Web labels become organization-neutral and the public form requires a supported type.

## Compatibility and migration

- Additive Agency Onboarding migration only.
- Existing rows receive `organization_type = 'REAL_ESTATE_AGENCY'` and remain otherwise unchanged.
- Existing review/document/provisioning/bootstrap identifiers, timestamps and foreign keys remain.
- Existing Agency JSON requests without `organizationType` continue to map to
  `REAL_ESTATE_AGENCY`; canonical Organization requests require the field.
- RLS continues to use `tenant_id`; registration review remains PLATFORM-scoped.

## Validation target

- Agency and SCI registration, approval and canonical composite provisioning.
- Same first-administrator lifecycle for both types.
- Existing C1/C2 38-test baseline.
- Migration, API contract, Web, authorization and complete regression suites.

## Delivered behavior

- Canonical public submission: `POST /v1/organization-registrations`.
- Canonical document upload: `POST /v1/organization-registration-documents`.
- Canonical platform review aliases under `/v1/platform/organization-registrations`.
- Legacy Agency routes and payloads remain supported and default to `REAL_ESTATE_AGENCY`.
- The public Web route `/inscription-organisation` requires one of the seven supported types;
  `/inscription-agence` remains a compatible bookmark.
- The first administrator uses the existing tenant-scoped `TENANT_ADMINISTRATOR` role for every
  organization type. Organization type is never consulted for authorization.

## Final validation results

- C2 regression baseline: 6 files, 38/38 tests passed.
- Unit suite: 57 files, 385/385 tests passed.
- Integration suite: 31 files, 284/284 tests passed.
- Contract suite: 26 files, 117/117 tests passed.
- Web suite: 37 files, 239/239 tests passed.
- First-administrator PostgreSQL suite: 8/8 tests passed, including SCI.
- Organization HTTP suite: 49/49 tests passed, including canonical SCI and invalid type cases.
- Organization registration schema: 2/2 tests passed.
- Agency Onboarding and Tenant Management migration checks: passed.
- Recursive workspace typecheck and test typecheck: passed.
- Architecture check: passed.
- Web production build: passed (only the pre-existing chunk-size advisory).
- OpenAPI regenerated and its dedicated contract test passed 7/7.
- `git diff --check`: passed.

## Deferred transitional debt

- Physical `agency_onboarding` schema/table names, package names, legacy DTO fields and legacy routes
  remain deliberate compatibility surfaces. Removing them requires a separately versioned migration.
- Côte d'Ivoire national-number canonicalization remains explicitly limited technical debt; E.164
  numbers work independently of country and no country value affects tenant isolation.
