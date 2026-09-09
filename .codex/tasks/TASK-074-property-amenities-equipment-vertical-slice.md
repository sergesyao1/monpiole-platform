# TASK-074 - Property Amenities & Equipment Vertical Slice

## Status

**DONE**

## Implementation Summary

TASK-074 implements the TASK-073 canonical model end to end. Managers can load the global catalog, retrieve a Property's explicit selection, replace it atomically, and reload it. Published Property detail responses expose only selected active amenities.

## Model

- 42 stable amenity codes in eight categories.
- Global migration-controlled `Amenity` catalog with French labels and display order.
- Tenant-scoped `PropertyAmenity` association identified by tenant, Property and amenity code.
- Presence/absence only; no metadata, quantity, inheritance or tenant-created catalog values.
- Existing `furnished` semantics are unchanged.

## PostgreSQL

Migration `0018_property_amenities.sql` adds and seeds `amenities`, adds `property_amenities`, composite Property reference, amenity reference, primary key, index, audit fields, forced RLS and explicit runtime grants.

Replacement locks the tenant-owned Property, deletes its previous selection and inserts the validated replacement in one tenant-scoped transaction. Missing and cross-tenant Properties are indistinguishable.

The public reader has no direct access to tenant association tables. It reads `public_property_amenities`, a restricted view that includes only active amenities of published Properties in the current Host-resolved tenant and does not expose `tenant_id`.

## API

- `GET /v1/amenities`
- `GET /v1/properties/{propertyId}/amenities`
- `PUT /v1/properties/{propertyId}/amenities`

Strict Zod contracts expose stable codes, categories, French labels and bounded selections. Writes use `UPDATE_PROPERTY_AMENITIES`; private reads use `RETRIEVE_PROPERTY_AMENITIES`. Tenant context is derived from authenticated authority only. Invalid or duplicate codes produce 400, missing grants 403, and absent/cross-tenant Properties 404.

OpenAPI was regenerated. The existing public Property detail contract now includes `amenities`; summaries and private tenant data are unchanged.

## Web

The Property Workspace contains a responsive “Commodités et équipements” section with French grouped checkboxes, loading/error/success states and atomic save. Saved values reload checked. Units manage their own explicit selection.

The public Property detail displays a simple section containing only selected amenities and omits it for an empty selection.

## Security

- No client-supplied tenant identifier.
- Forced RLS and tenant-scoped composite Property reference.
- Explicit runtime grants.
- Public projection limited to published Properties through the existing Host tenant context.
- No audit, tenant, owner, client or contract data exposed publicly.

## Validation

- Property Management typecheck: PASS.
- API typecheck: PASS.
- Web typecheck: PASS.
- Test typecheck: PASS.
- Migration check: PASS.
- Focused domain/public unit tests: PASS, 2 files and 11 tests.
- Property PostgreSQL integration: PASS, 5 files and 94 tests.
- Web suite: PASS, 21 files and 144 tests.
- Focused HTTP/OpenAPI tests: PASS, 2 files and 2 tests.
- Web production build: PASS, 168 modules.
- API/OpenAPI build and generation: PASS.

## Limitations

Amenity filtering, quantities, typed attributes, inheritance, tenant customization, localization beyond French and mobile UI remain out of scope. Public display is intentionally simple; category grouping can evolve without changing stable codes.

## Files

The slice adds the domain catalog, application use cases, PostgreSQL repository/migration, private API contracts/controller, public projection, Workspace component, targeted tests and this report. Existing fixtures were updated only where the additive public contract or new FK required it.
