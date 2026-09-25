# TASK-076 - Public Property Inquiries & Lead Intake Vertical Slice

## Status

**DONE**

## Objective

Close the public Property conversion gap by allowing an anonymous visitor to
submit a minimal consented inquiry for a published Property and allowing an
authorized tenant manager to list, inspect, acknowledge and close it.

## TASK-075 Decisions Implemented

- independent `PropertyInquiry` aggregate in Property Management;
- strict separation from `PropertyClient`, contracts, owners and identities;
- lifecycle `NEW -> ACKNOWLEDGED -> CLOSED`, with direct `NEW -> CLOSED`;
- at least one contact channel and explicit consent;
- Host-resolved tenant for public writes and authority-resolved tenant privately;
- idempotent submission scoped by tenant, Property and idempotency key;
- deterministic opaque-cursor private listing;
- no CRM, scheduling, messaging, scoring or automatic client conversion.

## Architecture and Domain

`PropertyInquiry` owns visitor contact, an optional bounded message, consent
version/timestamp, idempotency key, lifecycle and timestamps. Domain validation
normalizes names, email and optional values and rejects malformed contacts,
missing channels and invalid transitions.

Application commands/queries are `SubmitPublicPropertyInquiry`,
`ListPropertyInquiries`, `RetrievePropertyInquiry`,
`AcknowledgePropertyInquiry` and `ClosePropertyInquiry`. Public creation accepts
a trusted tenant supplied by the API boundary; private operations use
`PropertyAuthority` and dedicated grants.

## Public API

```text
POST /v1/public/properties/{publicPropertyId}/inquiries
```

The controller resolves tenant ownership through the existing exact-Host
allowlist. Strict Zod input accepts only name, email/phone, optional message,
explicit consent, consent version and idempotency key. It never accepts tenant,
status, internal trace or management fields. The response contains only
`inquiryId` and `receivedAt`.

## Private API

```text
GET /v1/properties/{propertyId}/inquiries
GET /v1/properties/{propertyId}/inquiries/{inquiryId}
PUT /v1/properties/{propertyId}/inquiries/{inquiryId}/acknowledgement
PUT /v1/properties/{propertyId}/inquiries/{inquiryId}/closure
```

Lists use stable `(createdAt DESC, inquiryId DESC)` pagination and opaque
base64url cursors. Reads and transitions return non-revealing 404 responses for
missing or cross-tenant resources.

## Tenant Resolution and Security

- public tenant comes only from `PublicCatalogTenantResolver`;
- private tenant comes only from the authenticated authority;
- public creation locks and rechecks the tenant-owned Property as `PUBLISHED`;
- a concurrent withdrawal cannot race past the eligibility check;
- payload size and field bounds are enforced by Zod and the domain;
- idempotency prevents accidental repeated submissions;
- PII is absent from public responses and is not copied to logs/events;
- unknown, unpublished, withdrawn and cross-tenant targets are non-revealing.

The public endpoint uses the normal runtime persistence boundary with a trusted
server-derived tenant context. It does not weaken RLS or grant anonymous clients
database access.

## Persistence and RLS

Migration `0019_property_management_baseline.sql` adds
`property_management.property_inquiries` with:

- UUID inquiry identity and tenant ownership;
- composite tenant/Property foreign key;
- contact, consent, idempotency, lifecycle and trace columns;
- database checks matching contact and lifecycle invariants;
- tenant/Property/idempotency uniqueness;
- deterministic listing index;
- forced tenant RLS;
- explicit runtime `SELECT`, `INSERT` and `UPDATE` grants.

The adapter executes every operation in `withTenantPostgresTransaction`, locks
the Property for public submission and locks the inquiry for transitions.

## Grants

- `LIST_PROPERTY_INQUIRIES`;
- `RETRIEVE_PROPERTY_INQUIRY`;
- `MANAGE_PROPERTY_INQUIRIES`.

Tenant administrators receive these through the established external authority
adapter. OIDC scopes are not treated as business grants.

## Web UX

The public detail includes a French inquiry form using existing `Field`,
`Button` and `Alert` primitives. It provides native/client validation, loading,
server-confirmed success, unavailable Property and generic failure states. A
fresh idempotency key is generated only after successful acceptance.

The private Property Workspace includes `Demandes reçues`, with loading, empty,
error and populated states, contact and received date, status badges,
acknowledge/close actions, opaque-cursor pagination and deduplication. Previously
loaded results remain present if a later page fails.

## Contracts and SDK Boundary

Public submission/response and private item/list/path/query schemas are strict
Zod contracts included in generated OpenAPI. Public and private representations
are intentionally separate. Web transport methods reuse the existing public and
authenticated API client boundaries.

`packages/sdk` remains a repository-wide documentation placeholder; no competing
SDK abstraction was introduced in this slice.

## Tests

- domain/application: valid creation, consent/contact validation, lifecycle,
  grants, listing and transitions;
- HTTP: strict public payload, tenant resolution, safe host failure and private listing;
- PostgreSQL: round trip, idempotency, tenant listing and forced-RLS isolation;
- contract: routes, schemas and absence of tenant data in public response;
- Web: public form success and private empty state;
- existing publication, catalogue, Property and Web suites remain green.

## Validation Results

- global TypeScript typecheck: PASS, 9 workspace projects;
- test TypeScript typecheck: PASS;
- migration check: PASS;
- focused TASK-076 tests: PASS, 3 files / 7 tests;
- Property PostgreSQL integration: PASS, 5 files / 95 tests;
- unit suite: PASS, 32 files / 238 tests;
- integration suite: PASS, 24 files / 202 tests;
- contract suite: PASS, 20 files / 102 tests;
- Web suite: PASS, 23 files / 146 tests;
- Web production build: PASS, 170 modules transformed;
- API build: PASS;
- architecture check: PASS;
- `git diff --check`: PASS.

The PostgreSQL suite emits an existing `pg` deprecation warning about calling
`client.query()` while a client query is executing; all tests pass.

## Files Changed

The slice adds the inquiry domain, application port/use cases, PostgreSQL
adapter/schema/migration, API schemas/controller/cursor, public and private Web
components, targeted tests and this report. Composition, authority filtering,
OpenAPI, styles and FK-sensitive PostgreSQL fixtures are updated additively.

## Intentional Limitations

- no rate-limiting service exists in the repository; V1 abuse resistance is
  strict allowlisted Host resolution, bounded payloads, publication eligibility
  and idempotency. Production Internet exposure remains subject to its existing gate;
- no retention job or erasure command is implemented; the retention policy must
  be approved before production Internet activation;
- no notifications, visits, assignment, notes, lead scoring or client conversion;
- no tenant-wide CRM inbox, public account or mobile UI;
- SDK generation remains separate platform work.

No commit and no push are performed by TASK-076.
