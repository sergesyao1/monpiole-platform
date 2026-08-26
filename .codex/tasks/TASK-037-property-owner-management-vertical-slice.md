# TASK-037 — Property Owner Management Vertical Slice

## Status

**DONE**

## Outcome

The Property Management bounded context now owns an explicit, tenant-scoped
`PropertyOwner` aggregate. It supports creation, retrieval, and safe update of
discriminated `INDIVIDUAL` and `LEGAL_ENTITY` owners through `/v1`, application
use cases, a persistence port, and PostgreSQL with forced RLS.

`PropertyOwner` is distinct from the tenant organization, authenticated actor,
and `Property`. This slice does not assign owners to properties.

## Domain model and invariants

- `ownerId` and `tenantId` are trusted UUID v4 server values and immutable.
- `ownerType` is either `INDIVIDUAL` or `LEGAL_ENTITY` and cannot change after
  creation.
- `INDIVIDUAL` requires normalized `firstName` and `lastName` and cannot contain
  legal-entity identity fields.
- `LEGAL_ENTITY` requires normalized `legalName`, permits an optional non-empty
  `registrationNumber`, and cannot contain individual identity fields.
- Optional phone numbers are non-empty after trimming without imposing a
  country-specific format.
- Optional emails are format-validated, bounded, trimmed, and normalized to
  lowercase.
- `createdAt` and `updatedAt` are trusted UTC instants; update preserves owner
  and tenant identity.
- PostgreSQL mirrors the discriminated identity and contact structure with
  CHECK constraints.

## Application and authorization

The slice adds:

- `CreatePropertyOwner`;
- `RetrievePropertyOwner`;
- `UpdatePropertyOwner`;
- `PropertyOwnerRepository` with tenant-explicit reads and atomic updates;
- `CREATE_PROPERTY_OWNER`;
- `RETRIEVE_PROPERTY_OWNER`;
- `UPDATE_PROPERTY_OWNER`.

The `RETRIEVE_` name follows the established `RETRIEVE_PROPERTY` convention.
OIDC scopes remain non-authoritative: the authenticated authority provider maps
an internally resolved authority to the Property grants and tenant scopes.

Expected error categories are explicit:

- `INVALID_PROPERTY_OWNER_INPUT` → safe `400`;
- `PROPERTY_OWNER_TYPE_CHANGE_NOT_ALLOWED` → safe `400`;
- `PROPERTY_OWNER_NOT_FOUND` → tenant-safe `404`;
- missing authentication → `401`;
- missing grant or invalid tenant authority → `403`;
- `PROPERTY_OWNER_PERSISTENCE_FAILURE` and unexpected errors → safe `500`.

## HTTP and contract surface

```text
POST /v1/property-owners
GET  /v1/property-owners/{ownerId}
PUT  /v1/property-owners/{ownerId}
```

Requests and responses use an OpenAPI `oneOf` discriminated by `ownerType`.
Server-owned `ownerId`, `tenantId`, timestamps, and authority data cannot be
supplied as request authority. Responses omit `tenantId` and persistence
details. French UI labels remain a presentation mapping:

```text
INDIVIDUAL   → Personne physique
LEGAL_ENTITY → Personne morale
```

## PostgreSQL migration

Migration `0002_property_management_baseline.sql` adds
`property_management.property_owners` with:

- primary key `owner_id`;
- tenant/owner unique index;
- discriminated identity and contact CHECK constraints;
- trace fields (`correlation_id`, `actor_id`);
- enabled and forced RLS;
- tenant isolation policy using transaction-local `app.tenant_id`.

All repository predicates include `(tenant_id, owner_id)`. Update loads the row
with `FOR UPDATE` and persists within the same tenant-scoped transaction. Missing
and cross-tenant access are indistinguishable.

## Tests

Coverage added includes:

- valid individual and legal-entity creation and reconstruction;
- missing/blank identity fields, invalid contacts, mixed variants, unknown type,
  and client-controlled tenant fields;
- mutable updates plus preservation of owner ID, tenant ID, and owner type;
- forbidden owner-type transition and transaction rollback;
- operation-specific 401/403 behavior;
- safe missing/cross-tenant 404 behavior for retrieval and update;
- sanitized 500 behavior;
- OpenAPI endpoints, security, discriminators, enums, and strict variants;
- PostgreSQL insert, retrieve, update, both variants, constraints, forced RLS,
  missing owner, and tenant isolation.

## Verification

All applicable gates passed on 2026-08-26:

| Gate | Result |
|---|---|
| Property Management typecheck | PASS |
| API typecheck | PASS |
| Tests typecheck | PASS |
| Architecture verification | PASS |
| Drizzle migration check | PASS |
| Unit tests | PASS — 11 files, 71 tests |
| Integration tests | PASS — 11 files, 77 tests |
| Contract tests | PASS — 10 files, 61 tests |
| Property PostgreSQL tests | PASS — 1 file, 15 tests |
| Full test suite | PASS — 36 files, 247 tests |

The OpenAPI baseline guard previously rejected every occurrence of the word
`entity` as a presumed internal-model leak. It was narrowed to continue rejecting
`aggregate`, `persistence`, and `repository`, because `LEGAL_ENTITY` is now a
required public business term rather than an infrastructure leak.

## Explicit non-goals and deferred work

No ownership assignment relation, ownership share/history,
Building/Residence/Unit composition, publication lifecycle, KYC/KYB, documents,
banking, billing, commissions, mandate, contact collection, physical deletion,
or generic Party/CRM abstraction was introduced.

Contact information is optional because the approved invariants require
validation when present. Regulatory uniqueness, registration-number format,
phone normalization, duplicate-owner resolution, lifecycle/deletion, and
concurrent stale-write detection remain deferred until demonstrated.

The next planned capability is Property Ownership Assignment. It must not begin
automatically; TASK-037 is handed off for owner review first.
