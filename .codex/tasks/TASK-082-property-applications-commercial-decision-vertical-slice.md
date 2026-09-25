# TASK-082 - Property Applications & Commercial Decision Vertical Slice

## Status

DONE.

## Repository audit

The slice follows TASK-076, TASK-078, TASK-080 and the TASK-081 decision. It reuses
the `property-management` aggregate/application/repository boundaries, authenticated
`PropertyAuthority`, Drizzle schema, tenant transactions, `FOR UPDATE`, forced RLS,
explicit runtime grants, Nest/Zod/OpenAPI contracts, and Property Workspace UI.

## Domain model and lifecycle

`PropertyApplication` is an independent tenant-scoped aggregate with identifiers for
property, inquiry, viewing and outcome provenance. It starts `SUBMITTED` and may end
as `APPROVED`, `REJECTED`, or `WITHDRAWN`. Terminal decisions are immutable; replaying
the same decision returns the same aggregate and a contradictory decision conflicts.
An optional trimmed internal note is bounded to 2,000 characters.

## Eligibility and cardinality

Creation is possible only from a tenant/property-scoped outcome in `PROCEED`.
PostgreSQL derives inquiry and outcome identifiers by joining the locked outcome to
its viewing. One application per viewing and outcome is enforced by unique indexes;
different viewings may create multiple applications for one property.

## Concurrency and idempotency

Creation locks the qualifying outcome row inside the tenant transaction, rechecks
`PROCEED`, then retrieves or inserts the canonical application. Concurrent identical
requests converge on one application. Decisions lock the application row before the
domain transition. Failed transitions roll back.

## Persistence, tenancy and security

Migration `0022_property_management_baseline.sql` adds
`property_management.property_applications`, lifecycle/note checks, composite
tenant-scoped foreign keys, deterministic pagination index, forced RLS and only
`SELECT`, `INSERT`, `UPDATE` runtime grants. Tenant is always derived from authority;
DTOs expose no `tenantId`. Private grants are `RETRIEVE_PROPERTY_APPLICATIONS` and
`MANAGE_PROPERTY_APPLICATIONS`.

## API and OpenAPI

Private operations:

- `POST/GET /v1/properties/{propertyId}/viewings/{viewingId}/application`
- `GET /v1/properties/{propertyId}/applications`
- `GET /v1/properties/{propertyId}/applications/{applicationId}`
- `POST .../{applicationId}/approval`
- `POST .../{applicationId}/rejection`
- `POST .../{applicationId}/withdrawal`

Zod schemas, opaque cursor handling, Problem Details mappings, runtime composition,
generated OpenAPI and the canonical Web API client are included.

## Web

Property Workspace displays a **Candidatures** section with pagination, deduplication,
French statuses and decision actions. A positive viewing outcome displays
**Créer la candidature**, then the canonical existing application instead of a
duplicate action. Already loaded data remains visible after errors.

## Tests

Coverage added for aggregate invariants/transitions/replays, application use cases,
HTTP routes/validation/conflicts, OpenAPI, Web decisions/errors, and real PostgreSQL
creation, concurrent replay, retrieval, listing, RLS tenant isolation, locked
transitions and rollback.

## Commercial journey

`Inquiry -> Viewing -> ViewingOutcome.PROCEED -> Application.SUBMITTED -> APPROVED | REJECTED | WITHDRAWN`

## Deferred scope

No automatic Client or Contract, reservation, availability lock, payment, KYC,
documents, scoring, offer negotiation, notification, CRM, or mobile-specific flow.

## Validation results

- Workspace typecheck: PASS (9 workspace projects).
- Test typecheck: PASS.
- Migration check: PASS (`Everything's fine`).
- Unit tests: PASS (35 files, 254 tests).
- HTTP/integration tests: PASS (27 files, 215 tests).
- Contract tests: PASS (23 files, 105 tests).
- Property PostgreSQL integration: PASS (5 files, 96 tests).
- Web tests: PASS (26 files, 154 tests).
- Web production build: PASS (174 modules transformed).
- Architecture check: PASS.
- Global suite: PASS (119 files, 851 tests).
- `git diff --check`: recorded in the final repository review.

## Recommended next capability

Audit and define explicit approved-application conversion into a reusable
`PropertyClient`, before considering contract or reservation creation.
