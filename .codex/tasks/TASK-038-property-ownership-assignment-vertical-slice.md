# TASK-038 — Property Ownership Assignment Vertical Slice

## Status

**DONE**

## Objective

Introduce an explicit, executable `PropertyOwnership` relation between an
existing tenant-owned `Property` and an existing tenant-owned `PropertyOwner`.
The slice supports assignment, co-ownership, one owner across multiple
properties, listing by Property, and removal without deleting either aggregate.

## Context inspected

The implementation was based on TASK-034 through TASK-037, the current Property
and PropertyOwner Domain/Application ports, Nest `/v1` controllers, authenticated
authority mapping, Problem Details filter, PostgreSQL/Drizzle adapters,
tenant-scoped transaction helper, forced RLS migrations, runtime composition,
and unit, HTTP, contract, PostgreSQL, runtime, and architecture tests.

Existing conventions prevailed: operation-specific grants, exactly one tenant
scope, 404 non-disclosure for absent/cross-tenant resources, 409 for business
conflicts, strict Zod contracts, service-owned persistence, and row locking for
aggregate-sensitive mutations.

## Modelling decisions

### Explicit relation and identity

`PropertyOwnership` is a distinct domain concept and is not embedded as
`Property.ownerId`. Its natural identity is:

```text
(tenantId, propertyId, ownerId)
```

No `ownershipId` was added. The tuple is stable, meaningful, sufficient for all
TASK-038 operations, and directly enforces one relation per owner/property pair.
Adding an opaque identifier would add no behavior and would weaken the visibility
of the tenant invariant. A future historical model can introduce immutable
ownership episodes or event identifiers without changing `Property`.

### Share representation

`ownershipShare` is a percentage with at most two decimal places. Domain and API
accept `0.01` through `100.00`; PostgreSQL stores `numeric(5,2)`. This avoids
unbounded floating-point precision while supporting common fractional shares.
Partial totals are valid; exactly 100 is not required.

### Domain/application/persistence separation

- `PropertyOwnership` validates one relation and its share.
- `assertOwnershipShareCapacity` owns the cross-relation total invariant.
- Application use cases own authorization and translate repository outcomes to
  business errors.
- The PostgreSQL adapter owns the cross-aggregate transaction and locking needed
  to evaluate existence, uniqueness, and the total against one consistent state.
- Controllers only authenticate, map contracts, and invoke use cases.

### API scope

Only the required minimal surface was added. No PUT/PATCH was introduced because
share modification is not required by the approved minimum and would add another
authority and concurrency workflow. The API does not claim DELETE+POST to be an
update operation; explicit share update remains a future capability if demanded.

Inverse lookup `GET /v1/property-owners/{ownerId}/properties` was deferred. The
database has an appropriate `(tenant_id, owner_id)` index, but the route adds a
new query contract and response representation without being needed for
assignment/list/removal acceptance.

DELETE of a missing relation returns tenant-safe 404 rather than succeeding
idempotently. This follows existing resource-not-found semantics; no repository
convention establishes idempotent DELETE.

## Invariants

- Property, PropertyOwner, and PropertyOwnership have the same tenant.
- Property and PropertyOwner must already exist in that tenant.
- `ownershipShare > 0` and `ownershipShare <= 100`.
- A share has at most two decimal places.
- The total shares for one Property remain `<= 100`.
- A total below 100 is valid for progressive entry.
- `(tenantId, propertyId, ownerId)` is unique.
- Removing a relation removes neither Property nor PropertyOwner.
- Reads, writes, and deletes are tenant-scoped and protected by forced RLS.

## API implemented

```text
POST   /v1/properties/{propertyId}/owners
GET    /v1/properties/{propertyId}/owners
DELETE /v1/properties/{propertyId}/owners/{ownerId}
```

POST request:

```json
{
  "ownerId": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "ownershipShare": 60
}
```

Ownership responses expose `propertyId`, `ownerId`, `ownershipShare`, and
`createdAt`. They omit `tenantId`, actor/correlation trace fields, persistence
details, and duplicated PropertyOwner identity data. Technical contracts remain
English and are ready for French presentation mapping.

## Grants

```text
ASSIGN_PROPERTY_OWNER
RETRIEVE_PROPERTY_OWNERSHIP
REMOVE_PROPERTY_OWNER
```

The names follow the established `CREATE_`, `RETRIEVE_`, and operation-specific
Property grant conventions. They are filtered from internally resolved
authorities; OIDC scopes are not business permissions.

## Error semantics

- invalid identifier/share/payload → 400 `INVALID_REQUEST`;
- unauthenticated → 401 `UNAUTHORIZED`;
- missing operation grant or invalid tenant authority → 403 `FORBIDDEN`;
- missing/cross-tenant Property → 404 `PROPERTY_NOT_FOUND`;
- missing/cross-tenant PropertyOwner → 404 `PROPERTY_OWNER_NOT_FOUND`;
- missing relation removal → 404 `PROPERTY_OWNERSHIP_NOT_FOUND`;
- duplicate relation → 409 `PROPERTY_OWNERSHIP_CONFLICT`;
- total above 100 → 409 `PROPERTY_OWNERSHIP_SHARE_EXCEEDED`;
- unexpected persistence failure → safe 500 without SQL/internal details.

## PostgreSQL, tenant isolation, and RLS

Migration `0003_property_management_baseline.sql` creates
`property_management.property_ownerships` with:

- composite primary key `(tenant_id, property_id, owner_id)`;
- composite FK `(tenant_id, property_id)` to Property;
- composite FK `(tenant_id, owner_id)` to PropertyOwner;
- `numeric(5,2)` share plus `> 0 AND <= 100` CHECK;
- inverse lookup index `(tenant_id, owner_id)`;
- creation and audit trace columns;
- enabled and forced RLS;
- tenant policy using transaction-local `app.tenant_id`.

The composite FKs make orphan and cross-tenant relations impossible even for a
privileged migration owner bypassing RLS. Runtime queries also use explicit
tenant predicates. The runtime role receives DELETE only because TASK-038 adds
an explicit deletion operation for the relation.

## Concurrency strategy

Assignment runs in one tenant-scoped PostgreSQL transaction:

1. lock the target Property row with `SELECT ... FOR UPDATE`;
2. verify the PropertyOwner in the same tenant;
3. read current ownerships;
4. reject a duplicate;
5. validate the total through the domain rule;
6. insert the relation.

Every assignment for one Property contends on the same Property row, so two
transactions cannot both validate against the same prior total. A real
Testcontainers test starts two concurrent 60% assignments to distinct owners;
exactly one succeeds and the persisted total is 60.00.

Removal also locks the Property row and deletes only the composite relation.

## Migration

Created:

- `services/property-management/migrations/0003_property_management_baseline.sql`;
- `services/property-management/migrations/meta/0003_snapshot.json`.

Updated the Drizzle journal. Migration replay from an empty database is exercised
by PostgreSQL and real runtime integration suites.

## Files

### Created by TASK-038

- `.codex/tasks/TASK-038-property-ownership-assignment-vertical-slice.md`;
- `services/property-management/src/domain/property-ownership.ts`;
- `services/property-management/src/application/property-ownership-repository.ts`;
- `services/property-management/src/application/assign-property-owner.ts`;
- `services/property-management/src/application/retrieve-property-ownerships.ts`;
- `services/property-management/src/application/remove-property-owner.ts`;
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-ownership-repository.ts`;
- `apps/api/src/contracts/v1/properties/property-ownership.schema.ts`;
- `apps/api/src/http/properties/property-ownership.dto.ts`;
- `apps/api/src/http/properties/property-ownership.mapper.ts`;
- `apps/api/src/http/properties/assign-property-owner.controller.ts`;
- `apps/api/src/http/properties/retrieve-property-ownerships.controller.ts`;
- `apps/api/src/http/properties/remove-property-owner.controller.ts`;
- `services/property-management/migrations/0003_property_management_baseline.sql`;
- `services/property-management/migrations/meta/0003_snapshot.json`;
- `tests/unit/property-ownership.test.ts`;
- `tests/integration/api-property-ownerships.test.ts`;
- `tests/contract/property-ownership-openapi.test.ts`.

### Modified by TASK-038

- `apps/api/src/app.module.ts`;
- `apps/api/src/composition/create-postgres-runtime-composition.ts`;
- `apps/api/src/http/authenticated-authority/authenticated-authority.ts`;
- `apps/api/src/http/errors/problem-details.filter.ts`;
- `engineering/contracts/http/openapi.json`;
- `services/property-management/README.md`;
- `services/property-management/migrations/meta/_journal.json`;
- `services/property-management/src/application/property-authority.ts`;
- `services/property-management/src/index.ts`;
- `services/property-management/src/infrastructure/persistence/postgres/schema.ts`;
- `services/property-management/tests/postgres-property-repository.test.ts`;
- `tests/contract/openapi-baseline.test.ts`;
- `tests/integration/api-identity-postgres-runtime.test.ts`.

### Deleted

None.

The worktree already contained the uncommitted TASK-037 implementation when
TASK-038 started; it was preserved and extended only at documented integration
points.

## Tests added

- Domain share boundaries, precision, partial/exact/exceeded totals, and natural
  identity.
- Application assignment, multi-owner, multi-property, references, duplicate,
  total conflict, removal, tenant isolation, and grants.
- HTTP POST/GET/DELETE, 400/401/403/404/409, strict payloads, listing, and removal.
- OpenAPI paths, security, response codes, strict request, public representation.
- PostgreSQL persistence, listing, removal, aggregate preservation, composite FK,
  PK uniqueness, share CHECK, RLS, multi-property owner, cross-tenant denial, and
  concurrent total guarantee.
- Real runtime API composition through PostgreSQL for create Property, create
  PropertyOwner, assign, list, verify SQL, and remove.

## Validation commands and results

All applicable gates passed on 2026-08-26:

| Command | Result |
|---|---|
| `corepack pnpm service:property-management:typecheck` | PASS |
| `corepack pnpm app:api:typecheck` | PASS |
| `corepack pnpm typecheck:tests` | PASS |
| `corepack pnpm architecture:check` | PASS |
| `corepack pnpm service:property-management:migration:check` | PASS |
| `corepack pnpm test:unit` | PASS — 12 files, 85 tests |
| `corepack pnpm test:integration` | PASS — 12 files, 91 tests |
| `corepack pnpm test:contract` | PASS — 11 files, 63 tests |
| `corepack pnpm service:property-management:test:integration` | PASS — 1 file, 21 tests |
| `corepack pnpm test` | PASS — 39 files, 283 tests |

## Contained gaps

- Share precision is deliberately limited to two decimal places.
- There is no share update endpoint or historical ownership episode model.
- There is no inverse Owner-to-Properties API despite the supporting index.
- There is no requirement that totals equal 100; publication may impose that
  later through an explicit readiness rule.
- PostgreSQL enforces individual share bounds, references, uniqueness, and tenant
  scope; the cross-row total requires the repository transaction/Property lock
  and is covered by a real concurrency test.

None of these gaps blocks the approved TASK-038 behavior.

## Confirmed non-goals

No Building, Residence, Unit, composition, publication, marketplace, search,
media, legal workflow, documents, payment, billing, commission, cadastral model,
usufruct, succession, or generic legal-ownership framework was introduced.

## Recommendation

TASK-038 is complete without a blocking gap. The repository appears ready for a
separately approved TASK-039 discovery/vertical slice on Property Composition /
Building & Units. Do not start it automatically; validate its ubiquitous
language and aggregate boundaries first.
