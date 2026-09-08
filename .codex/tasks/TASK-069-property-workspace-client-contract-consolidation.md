# TASK-069 — Property Workspace & Client Contract Consolidation

## Status

**DONE — validated on 8 September 2026.**

| Area | Status | Result |
| --- | --- | --- |
| Repository audit | DONE | TASK-063 through TASK-068 reports, current code, Git state and existing conventions audited before implementation. |
| Property Workspace | DONE | Stable private route, canonical server projection, concise header, accessible section navigation and overview summaries. |
| Client / Contract Domain | DONE | Reusable real-estate client, contract aggregate, explicit lifecycle, invariants and idempotence. |
| PostgreSQL | DONE | Migration `0017`, Drizzle snapshot, repositories, constraints, RLS, grants and real PostgreSQL tests. |
| API / OpenAPI | DONE | Versioned endpoints, strict Zod DTOs, Problem Details, regenerated OpenAPI and contract tests. |
| Web | DONE | Client creation/reuse, contract list/create/detail/update/lifecycle, permission-aware UI and responsive layout. |
| Public isolation | DONE | No client or contract field/route/grant is exposed through the public catalog. |
| Validation | DONE | Typechecks, tests, migration check, architecture check, PostgreSQL tests and production builds pass. |
| PARTIAL | NONE | No acceptance criterion remains partially implemented. |
| MISSING | NONE | No in-scope acceptance criterion remains missing. |

No commit and no push were performed.

## Executive summary

TASK-069 consolidates the existing Property detail screen into a durable private
Property Workspace and adds a complete client-contract vertical slice. The
workspace is still reached through `/properties/:propertyId`, so existing routing
and bookmarks remain stable. One tenant-scoped workspace query now supplies the
Property, availability/occupancy, publication readiness, owner summary,
composition summary, contract counters and explicit capabilities.

The new contract capability is deliberately small and business-specific. A
`PropertyClient` is reusable across several Properties and contracts and is not a
SaaS Tenant or a `PropertyOwner`. A `PropertyContract` stores structured terms,
references one Property and one client in the same tenant, and preserves history
through lifecycle transitions instead of hard deletion.

## Initial repository state

- Repository: `C:\Projet\monpiole-platform`.
- Branch: `main`.
- Initial HEAD: `17fd9f562126397388884de0e329520aef6a52f8`
  (`docs(web): audit product and mobile readiness`).
- Initial working tree: clean (`git status --short` and `git diff` empty).
- TASK-063 through TASK-068 reports and their implemented capabilities were
  inspected before coding.
- There was no uncommitted TASK-069 implementation to recover. The relevant
  recovered input was the integrated TASK-068 audit and the existing Property,
  pricing, availability, ownership, composition, publication and media slices.
- No reset, clean, stash, destructive checkout, commit or push was used.

## TASK-068 findings addressed

- Replaced client-side reconstruction of publication readiness with the canonical
  Domain calculation exposed by the workspace response.
- Replaced the Property detail page's initial fan-out with a workspace projection.
- Removed the initial owner-summary N+1 from the Property page. The fallback load
  remains available to the standalone ownership component.
- Added a coherent header, overview cards and keyboard-accessible anchor
  navigation while preserving the existing route.
- Added an explicit extension point for contracts rather than another isolated
  product page.
- Preserved the public/private boundary and the existing UI primitives/tokens.

## Architecture decisions

- `PropertyClient` is a tenant-owned real-estate contact. It is deliberately
  distinct from the multi-tenant SaaS `Tenant` and from legal/economic ownership
  represented by `PropertyOwner`.
- The client directory is tenant-wide (`/v1/property-clients`) so one client can
  be reused by contracts on several Properties. It is not artificially scoped to
  the first Property on which it is used.
- `PropertyContract` is the aggregate for contract terms and lifecycle state.
- Contract commands and reads are handled by dedicated application use cases and
  repositories. Controllers do not implement business rules.
- The Property Workspace is a server-owned projection. It embeds compact owner,
  composition and contract summaries, avoiding per-owner and per-contract API
  fan-out.
- Contracts do not mutate Property pricing, availability or occupancy. These
  concepts remain independently managed.

## Property Workspace consolidation

The existing private route `/properties/:propertyId` now loads:

- Property identity and commercial terms;
- current availability and occupancy, including derived composite summaries;
- canonical publication readiness;
- compact owners and ownership shares;
- building and unit counts;
- contract counts by status;
- explicit server capabilities for every workspace action.

The header shows the Property type, publication status, availability, occupancy,
optional main price and internal reference. The overview provides operational
cards. The sticky horizontally scrollable navigation links to the existing
sections, exposes `aria-current="location"`, and remains usable on small screens.

## Client model

`PropertyClient` contains:

- `clientId`, `tenantId`;
- `displayName`;
- optional normalized `email` and optional `phoneNumber`;
- `createdAt`, `updatedAt`;
- persistence trace (`correlationId`, `actorId`).

Input and persisted-value validation are distinct. E-mail is normalized to
lowercase. API responses never expose `tenantId` or persistence trace fields.

## Contract model

`PropertyContract` contains:

- `contractId`, `tenantId`, `propertyId`, `clientId`;
- type `LEASE`, `MANAGEMENT` or `OTHER`;
- status `DRAFT`, `ACTIVE`, `ENDED` or `CANCELLED`;
- tenant-unique human reference, normalized to uppercase;
- optional calendar `startDate`, `endDate` and notes;
- creation/update timestamps and trace;
- activation, ending and cancellation timestamps, actors and correlation ids.

No Property pricing amount is duplicated in the contract model. Contract dates
are PostgreSQL `date` values rather than artificial UTC instants.

## Lifecycle and invariants

Allowed transitions:

```text
DRAFT -> ACTIVE -> ENDED
  |         |
  +-------> CANCELLED
```

- Activation requires a start date.
- Ending requires an end date and is only allowed from `ACTIVE`.
- Cancellation is allowed from `DRAFT` or `ACTIVE`.
- `ENDED` and `CANCELLED` are terminal.
- Replaying activation, ending or cancellation on the identical resulting state
  is idempotent and performs no new persistence write.
- Dates must be valid ISO calendar dates and `endDate >= startDate`.
- A `LEASE` is accepted only for `LONG_TERM_RENTAL` Properties whose structural
  role is `STANDALONE` or `UNIT`; a composite root cannot directly receive it.
- All property/client references must resolve within the authorized tenant.
- There is no hard-delete contract operation.

## Authorization / grants

New application grants:

```text
RETRIEVE_PROPERTY_WORKSPACE
CREATE_PROPERTY_CLIENT
RETRIEVE_PROPERTY_CLIENTS
CREATE_PROPERTY_CONTRACT
RETRIEVE_PROPERTY_CONTRACTS
UPDATE_PROPERTY_CONTRACT
MANAGE_PROPERTY_CONTRACT_LIFECYCLE
```

Identity authority mapping, authenticated authority validation and PostgreSQL
runtime composition recognize these grants. Responses project capabilities such
as `canCreateContract`, `canUpdate`, `canActivate`, `canEnd` and `canCancel`; the
Web does not infer permissions from raw grants.

## PostgreSQL schema

Migration `0017` creates:

- `property_management.property_clients`;
- `property_management.property_contracts`.

Integrity and performance controls include:

- primary keys and tenant-aware unique indexes;
- composite `(tenant_id, property_id)` and `(tenant_id, client_id)` foreign keys;
- tenant-unique contract reference;
- deterministic tenant/client and tenant/property keyset indexes;
- contract status/type/reference/date/lifecycle checks;
- client name/contact/timestamp checks;
- lifecycle audit columns;
- no cascade delete and no runtime `DELETE` grant.

## Migration

Final migration:

`services/property-management/migrations/0017_property_client_contracts.sql`

Drizzle metadata:

- `services/property-management/migrations/meta/0017_snapshot.json`;
- updated `services/property-management/migrations/meta/_journal.json`.

Compatibility policy:

- no existing Property column is rewritten;
- no client or contract row is fabricated for legacy data;
- a fresh database can apply the full migration chain;
- a database stopped at `0016` can preserve its Property rows and apply `0017`;
- the legacy Property pricing compatibility guarantees from `0015` remain
  unchanged.

### PostgreSQL correction found during real execution

The first Testcontainers execution failed with PostgreSQL `42830` because the
generated SQL added `property_contracts_client_tenant_fk` before creating the
unique `(tenant_id, client_id)` index it references. The final migration creates
`property_clients_tenant_client_unique` immediately after both tables and before
the composite foreign keys. The Drizzle schema and snapshot remain semantically
unchanged; only executable statement order was corrected.

The new foreign key also required existing integration fixtures to include
`property_contracts` and `property_clients` when truncating their ephemeral test
databases. Those fixture-only changes eliminated cascading false failures and
data leakage between tests.

## RLS / tenant isolation

- RLS is enabled and forced on both new tables.
- Tenant policies compare `tenant_id` with the transaction-local
  `app.tenant_id` setting for both `USING` and `WITH CHECK`.
- Missing tenant context returns no runtime rows.
- Cross-tenant client/contract references are rejected by composite FKs.
- Cross-tenant repositories and HTTP access return the same not-found boundary as
  absent resources.
- Knowing a UUID does not grant access.

Exact database grants:

```text
monpiole_runtime on property_clients:  SELECT, INSERT
monpiole_runtime on property_contracts: SELECT, INSERT, UPDATE
monpiole_runtime:                       no DELETE on either table
monpiole_public_catalog_reader:         no privilege on either table
```

## Domain changes

- Added `PropertyClient` with strict input and rehydration validation.
- Added `PropertyContract`, lifecycle operations, eligibility rules and error
  taxonomy.
- Added `Property.assessPublicationReadiness(...)` and made `publish(...)` reuse
  the same canonical decision.
- Kept legacy persisted Properties readable while enforcing current rules for new
  contract writes and publication decisions.

## Application changes

- Create/list/retrieve Property clients.
- Create/list/retrieve/update Property contracts.
- Activate/end/cancel contracts through serialized repository mutations.
- Tenant-scoped keyset pagination.
- Joined client summary in every contract read, avoiding N+1 client requests.
- Retrieve one canonical Property Workspace with readiness, summaries and
  capabilities.

## API endpoints

Private authenticated endpoints:

```text
POST /v1/property-clients
GET  /v1/property-clients
GET  /v1/property-clients/{clientId}

POST /v1/properties/{propertyId}/contracts
GET  /v1/properties/{propertyId}/contracts
GET  /v1/properties/{propertyId}/contracts/{contractId}
PUT  /v1/properties/{propertyId}/contracts/{contractId}
POST /v1/properties/{propertyId}/contracts/{contractId}/activate
POST /v1/properties/{propertyId}/contracts/{contractId}/end
POST /v1/properties/{propertyId}/contracts/{contractId}/cancel

GET  /v1/properties/{propertyId}/workspace
```

There is no contract `DELETE` endpoint. Controllers use strict DTOs and the
established response/correlation headers. Error mapping covers invalid input,
client/contract/Property not found, duplicate reference, ineligible Property,
forbidden updates and invalid lifecycle transitions.

## OpenAPI changes

- Added strict request, response, directory, cursor, path and workspace schemas.
- Documented bearer security, operation ids, request bodies, success responses,
  Problem Details and response headers for every endpoint.
- Regenerated `engineering/contracts/http/openapi.json` from the application.
- Contract tests assert all intended methods, bodyless lifecycle operations,
  capabilities, strict schemas, absence of delete and absence of public leakage.

## Web UX

The Property page now provides:

- a concise workspace header and return-to-portfolio action;
- overview summaries and stable in-page navigation;
- a client/contract area with loading, empty, success and error states;
- selection of an existing tenant client;
- inline creation of a minimal client;
- draft contract creation and editing;
- contract list and selected-contract detail;
- explicit confirmed activation, ending and cancellation;
- action visibility driven by server capabilities;
- no destructive contract action;
- accurate French messages for client/contract not-found, reference conflict,
  invalid transition, forbidden update and Property ineligibility.

The UI explicitly states that a contract does not automatically update
availability or occupancy.

## Responsive behavior

- Workspace summary cards reflow on reduced widths.
- Contract list/detail changes from two columns to one column.
- Section navigation remains horizontally scrollable and sticky.
- Forms use existing responsive grid primitives and accessible labels.
- The active navigation item has a visible state and `aria-current`.

## Public catalog isolation

- No public route was added.
- Public Property response schemas were not extended with contract data.
- Contract reference, status and client identity are absent from public schemas.
- `monpiole_public_catalog_reader` has zero grant on the new tables.
- Contract OpenAPI tests reject any `/v1/public/*` client/contract exposure.

## Tests added or updated

Added:

- `tests/unit/property-client-contract.test.ts` — Domain and Application
  invariants, errors, permissions, tenant mismatch, update and lifecycle replay.
- `tests/integration/api-property-client-contracts.test.ts` — HTTP happy paths,
  strict validation, 401/403/404/409, cross-tenant behavior and all lifecycle
  endpoints.
- `tests/contract/property-client-contract-openapi.test.ts` — OpenAPI surface,
  security, strict schemas and public isolation.
- `services/property-management/tests/postgres-property-client-contract.test.ts`
  — fresh/full migration, 0016→0017 upgrade, constraints, repositories,
  transactions, audit, grants and RLS with real PostgreSQL.
- `apps/web/src/features/properties/PropertyContractsSection.test.tsx` — empty
  state, create, native validation, API conflict, permissions and lifecycle UI.

Updated Property page, publication and portfolio tests for the canonical
workspace response and owner-summary consolidation. Updated four PostgreSQL test
fixtures to respect the new foreign keys.

## Validation commands

```text
corepack pnpm -r typecheck
corepack pnpm typecheck:tests
corepack pnpm app:api:typecheck
corepack pnpm --filter @monpiole/web typecheck
corepack pnpm test:unit
corepack pnpm test:contract
corepack pnpm test:integration
corepack pnpm service:property-management:test:integration
corepack pnpm service:property-management:migration:check
corepack pnpm architecture:check
corepack pnpm app:api:openapi
corepack pnpm app:api:contracts:check
corepack pnpm app:api:build
corepack pnpm --filter @monpiole/web test
corepack pnpm --filter @monpiole/web build
git diff --check
git status --short
```

## Validation results

- Recursive workspace typecheck: **PASS** — 9 of 10 workspace projects checked.
- Tests typecheck: **PASS**.
- API typecheck: **PASS**.
- Web typecheck: **PASS**.
- Unit suite: **PASS** — 30 files, 230 tests.
- Contract suite / API contract check: **PASS** — 18 files, 100 tests.
- Integration suite: **PASS** — 22 files, 199 tests.
- Web suite: **PASS** — 20 files, 141 tests.
- Property PostgreSQL integration suite: **PASS** — 5 files, 94 tests.
- TASK-069 targeted Domain/Application: **PASS** — 9 tests.
- TASK-069 targeted HTTP: **PASS** — 5 tests.
- TASK-069 targeted OpenAPI: **PASS** — 4 tests.
- TASK-069 targeted Web: **PASS** — 5 tests.
- TASK-069 targeted PostgreSQL: **PASS** — 5 tests.
- Existing Property page regression target: **PASS** — 18 tests.
- Non-overlapping full-suite total: **764 passing tests**.
- Migration check (`drizzle-kit check`): **PASS**.
- Fresh full migration chain on PostgreSQL/Testcontainers: **PASS**.
- Existing `0016` chain upgraded through `0017`: **PASS**, legacy Property row
  preserved and zero client/contract backfill.
- RLS / runtime / public-reader verification on PostgreSQL: **PASS**.
- Architecture verification: **PASS** — workspace, exports, resolver, graph,
  boundaries, cycles and diagnostics.
- OpenAPI generation: **PASS** — artifact regenerated successfully.
- API production build: **PASS**.
- Web production build: **PASS** — Vite transformed 124 modules.
- `git diff --check`: recorded after report creation in the final Git quality
  section below.

## Files changed

Domain/Application/Persistence:

- `services/property-management/src/domain/property.ts`
- `services/property-management/src/domain/property-client.ts`
- `services/property-management/src/domain/property-contract.ts`
- `services/property-management/src/application/property-authority.ts`
- `services/property-management/src/application/property-client-repository.ts`
- `services/property-management/src/application/property-contract-repository.ts`
- `services/property-management/src/application/property-workspace-summary-query.ts`
- `services/property-management/src/application/manage-property-clients.ts`
- `services/property-management/src/application/manage-property-contracts.ts`
- `services/property-management/src/application/retrieve-property-workspace.ts`
- `services/property-management/src/infrastructure/persistence/postgres/schema.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-client-repository.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-contract-repository.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-workspace-summary-query.ts`
- `services/property-management/src/index.ts`

Migration:

- `services/property-management/migrations/0017_property_client_contracts.sql`
- `services/property-management/migrations/meta/0017_snapshot.json`
- `services/property-management/migrations/meta/_journal.json`

API/OpenAPI:

- `apps/api/src/app.module.ts`
- `apps/api/src/composition/create-postgres-runtime-composition.ts`
- `apps/api/src/composition/identity-external-authority.adapter.ts`
- `apps/api/src/http/authenticated-authority/authenticated-authority.ts`
- `apps/api/src/http/errors/problem-details.filter.ts`
- `apps/api/src/contracts/v1/properties/property-client-contract.schema.ts`
- `apps/api/src/http/properties/property-client-contract-cursor.ts`
- `apps/api/src/http/properties/property-client-contract.dto.ts`
- `apps/api/src/http/properties/property-client-contract.mapper.ts`
- `apps/api/src/http/properties/property-clients.controller.ts`
- `apps/api/src/http/properties/property-contracts.controller.ts`
- `apps/api/src/http/properties/property-workspace.controller.ts`
- `engineering/contracts/http/openapi.json`

Web:

- `apps/web/src/features/properties/PropertyDetailPage.tsx`
- `apps/web/src/features/properties/PropertyAvailabilitySection.tsx`
- `apps/web/src/features/properties/PropertyOwnershipSection.tsx`
- `apps/web/src/features/properties/PropertyPublicationSection.tsx`
- `apps/web/src/features/properties/PropertyPublicationSection.test.tsx`
- `apps/web/src/features/properties/PropertyContractsSection.tsx`
- `apps/web/src/features/properties/PropertyContractsSection.test.tsx`
- `apps/web/src/features/properties/property-api.ts`
- `apps/web/src/features/properties/property-model.ts`
- `apps/web/src/features/properties/property-errors.ts`
- `apps/web/src/features/properties/PropertyPages.test.tsx`
- `apps/web/src/features/properties/PropertyPortfolioPage.test.tsx`
- `apps/web/src/styles/features.css`

Cross-cutting tests:

- `tests/unit/property-client-contract.test.ts`
- `tests/integration/api-property-client-contracts.test.ts`
- `tests/integration/api-identity-postgres-runtime.test.ts`
- `tests/contract/property-client-contract-openapi.test.ts`
- `services/property-management/tests/postgres-property-client-contract.test.ts`
- `services/property-management/tests/postgres-property-repository.test.ts`
- `services/property-management/tests/postgres-property-primary-photo.test.ts`
- `services/property-management/tests/postgres-public-property-catalog.test.ts`

Documentation:

- `.codex/tasks/TASK-069-property-workspace-client-contract-consolidation.md`

## Known limitations

- There is no browser-level E2E suite yet; behavior is covered by React component,
  HTTP integration and real PostgreSQL tests.
- The client directory is intentionally minimal: no edit/delete/deduplication or
  dedicated directory page is included.
- The Web still maintains handwritten client models because `packages/sdk`
  remains a placeholder. Strict Zod/OpenAPI contracts are the source boundary.
- Workspace navigation uses stable anchors on the existing Property page rather
  than nested routes. This preserves compatibility but does not enable per-section
  code splitting.
- PostgreSQL tests emit the existing `pg@9` deprecation warning about invoking
  `client.query()` while a query is executing; all tests pass and this is not a
  TASK-069 correctness failure.
- The public catalog remains subject to the production enablement gates documented
  by previous tasks.

## Explicitly out of scope

- Contract files, uploads, electronic signature and document generation.
- Billing, invoicing, payments and accounting.
- Automatic Property pricing replication into contracts.
- Automatic availability/occupancy changes from contract transitions.
- Generic workflow engine, notifications, messaging and client portal.
- Hard deletion of contract history.

## Recommended next capability / TASK-070 candidate

**TASK-070 — Typed Property SDK & Browser Journey Hardening**: generate or expose
a typed consumer layer from the versioned schemas and add browser E2E coverage for
portfolio → workspace → client → contract → publication journeys. This removes the
largest remaining Web/mobile readiness risk before expanding contracts into
documents, billing or a client portal.

## Final Git quality

- `git diff --check`: **PASS**, no output.
- `git status --short`: 26 tracked files modified and 27 expected untracked
  TASK-069 files, including this report.
- Global diff and untracked-file inventory inspected: no temporary file, IDE
  file, `.env`, secret, debugger or TASK-069 debug log found. The only
  `console.log` match is the pre-existing intended OpenAPI generator output.
- Final HEAD remains `17fd9f562126397388884de0e329520aef6a52f8`
  (`docs(web): audit product and mobile readiness`).
- No commit performed.
- No push performed.
