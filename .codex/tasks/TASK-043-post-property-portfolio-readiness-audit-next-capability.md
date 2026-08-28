# TASK-043 — Post-Property-Portfolio Readiness Audit & Next Capability

## 1. Executive conclusion

**Verdict: READY WITH CONTAINED GAPS.**

The next smallest coherent capability is **TASK-044 — Property Portfolio Web
Discovery Vertical Slice**, not Property Composition yet.

TASK-042 is implemented in the API and PostgreSQL runtime: an authenticated
authority with `LIST_PROPERTIES` can list only its single tenant's private
portfolio, filter it, search it and traverse it with a stable keyset cursor. The
published OpenAPI contract and executable unit, HTTP and contract tests agree
with that behavior. PostgreSQL-specific tests exist for tenant isolation, RLS,
filter/search/order/pagination and the runtime composition, although they could
not execute in this audit environment because no container runtime was
available.

The browser is now the most immediate continuity break. `apps/web` consumes
create, retrieve, details and ownership APIs, but has no portfolio response
model or `listProperties` client operation. `/properties` still asks for a UUID
and explicitly tells the user that the list API is unavailable. Consequently,
the API capability delivered by TASK-042 is not usable as a portfolio workflow.
Closing this bounded gap creates a complete authenticated French-language user
journey without a schema, domain, authorization or architectural expansion.

Property Composition remains justified as the next domain capability after
that UI alignment. Its vocabulary and invariants are not yet confirmed well
enough to silently select one of several materially different models.
Publication is premature on the current representation.

## 2. Repository state inspected

Audit date: **2026-08-28**. Initial Git state was clean. The inspected revision
history places `424b923 feat(property): add portfolio listing and discovery API`
after `5fadd8c feat(web): add property management vertical slice`.

Authoritative evidence inspected:

- root `AGENTS.md`; no nested `AGENTS.md` exists;
- `apps/api` composition, Property controllers, DTOs, Zod schemas, cursor codec,
  OpenAPI generation and runtime integration;
- `apps/web` routing, shell, Property API client, workspace, creation, detail,
  details and ownership components and tests;
- `services/property-management` Domain, Application ports/use cases,
  PostgreSQL adapters, schema, migrations `0000` through `0004`, README and
  persistence tests;
- reusable `packages`, particularly the PostgreSQL transaction/RLS baseline;
- `engineering/contracts/http/openapi.json`, `engineering/adr`,
  `engineering/decisions`, relevant engineering guidance and task records;
- Property unit, HTTP integration, contract, PostgreSQL and web tests.

Task documents were used as context only. Implementation, generated contract,
migrations and executable tests determined the findings.

## 3. Current Property capability map

| Capability | State | Repository evidence and exact behavior |
|---|---|---|
| Create Property | Implemented | `Property.create`, `CreateProperty`, `POST /v1/properties`, PostgreSQL repository and web creation page. Server supplies UUID, tenant, actor, correlation/time and forces `DRAFT`. |
| Retrieve Property | Implemented | Tenant-scoped `RetrieveProperty`, `GET /v1/properties/{propertyId}` and browser detail route. Missing and cross-tenant reads are indistinguishable. |
| Update details | Implemented | `defineDetails` and `UpdatePropertyDetails` replace details and matching commercial terms atomically through a row-locked tenant transaction. There is no general title/address/type update operation. |
| Commercial terms | Implemented | Exactly one transaction-compatible variant: monthly long-term rent, nightly/weekly short-term rate, or sale price. Amounts are non-negative safe integers in minor units; currency is three uppercase letters. Zero and syntactically valid non-ISO currency codes remain allowed. |
| Authorization | Implemented | Operation-specific internal grants cover create, retrieve, list, details, owner and ownership operations. OIDC claims do not create business authority. A single internal tenant scope is required. |
| Tenant isolation | Implemented | Tenant comes from authenticated authority, never Property payload/query. Repository predicates, tenant transactions, composite keys/FKs and forced PostgreSQL RLS protect owned tables. |
| PropertyOwner | Implemented | Create, retrieve and update for `INDIVIDUAL` or `LEGAL_ENTITY`; immutable owner/type/tenant identity; optional contact details; tenant-owned PostgreSQL table and API. Browser can retrieve an owner only while rendering a Property ownership. It cannot create, search or manage owners as a workspace. |
| Assign/list/remove ownership | Implemented | Explicit `(tenantId, propertyId, ownerId)` relation; multiple owners per Property and one owner across Properties; assign, list by Property and remove APIs; composite tenant FKs, forced RLS and concurrency control. Browser supports assignment by known owner UUID, listing and removal. |
| Ownership limitations | Contained gaps | Precision is two decimal percentage places (`0.01`–`100.00`). Partial totals are valid and total may not exceed 100; exactly 100% is not mandatory. There is no share update (remove/reassign is required), history/effective dates/transfer, inverse Owner → Properties navigation, or owner discovery UI. These do not block private portfolio discovery. |
| Private portfolio API | Implemented | See section 4. |
| Private portfolio UI | Not implemented | Web client has no list operation/model. `/properties` provides only create and UUID lookup and contains the stale statement that the list API is unavailable. |

## 4. TASK-042 verification

`GET /v1/properties` exists in the generated OpenAPI artifact and the NestJS
controller. It is composed in the normal PostgreSQL runtime as
`ListProperties(PostgresPropertyPortfolioQuery)` and exposed by the application
module.

Exact behavior:

- bearer authentication is required; missing authentication returns 401;
- `LIST_PROPERTIES` and exactly one authority tenant are required; rejection is
  403 before repository access;
- no client tenant selector is accepted; the strict query schema rejects
  `tenantId` and any unknown parameter;
- optional filters are `status=DRAFT`, `type` in the five existing Property
  types, and trimmed `search` of 1–100 characters;
- `limit` defaults to 20 and accepts 1–100;
- search is a parameterized, escaped, case-insensitive PostgreSQL `ILIKE` over
  title, description, city, district and address line; it is private bounded
  discovery, not ranked/full-text/public search;
- order is `createdAt DESC, propertyId DESC`;
- the opaque canonical Base64URL cursor encodes the last `(createdAt,
  propertyId)` pair; the adapter reads `limit + 1` and returns
  `pageInfo.hasNextPage` plus a nullable `nextCursor`;
- items expose identity, title, optional description, type, transaction, draft
  status, location and timestamps. They omit tenant, details/commercial terms
  and ownership;
- migration `0004` adds the aligned
  `(tenant_id, created_at DESC, property_id DESC)` index;
- the PostgreSQL adapter executes inside `withTenantPostgresTransaction` and
  also applies an explicit tenant predicate; forced RLS remains defense in
  depth.

Evidence includes `property-portfolio-listing.test.ts`,
`api-property-portfolio.test.ts`, `property-openapi.test.ts`, the portfolio case
in `postgres-property-repository.test.ts`, and the real runtime case in
`api-identity-postgres-runtime.test.ts`. TASK-042 is therefore verified as an
API vertical slice, with its explicitly stated UI non-goal still outstanding.

## 5. Remaining gaps

| Area | Classification after TASK-042 |
|---|---|
| Portfolio browser discovery | **Now required**: implemented API has no user-facing consumer and the UI contradicts repository truth. |
| Standalone house/land/commercial asset | Implemented as a standalone `Property` type, though richer type-specific attributes are absent. |
| Apartment | Partially represented as a standalone `APARTMENT`; no containing structure or unit identifier exists. |
| Building/residence/unit composition | Intentionally deferred and now a credible next domain capability; no role, parent/child relation or composition invariants exist. |
| Physical composition | Omitted: no floors, common areas, contained units, hierarchy, unit reference or independent-management semantics. |
| Occupancy and availability | Intentionally deferred and still premature until the managed resource level and business meaning are confirmed. |
| Publication/marketplace visibility | Omitted except for the internal `DRAFT` literal; now assessable but premature. |
| Media and amenities | Omitted and still premature as an isolated capability; storage, ordering, classification, limits and publication use are undefined. |
| Address/location depth | Partially represented by country, city, district and address line. No coordinates, structured postal/cadastral identity or inherited building/unit address. Current depth is sufficient for private discovery, not proven sufficient for publication. |
| Owner workspace/inverse navigation | Missing but non-blocking for portfolio UI; users need known owner UUIDs. A later owner discovery capability may be valuable, but TASK-042 makes the main Property portfolio gap more immediate. |

## 6. Property Composition readiness assessment

Composition would solve a real modeling limit. A house, land or commercial
asset can be represented independently today. An apartment can also be stored,
but the model cannot say whether it is standalone or unit A-12 inside a
building/residence. A building or residence can only be mislabeled as `OTHER`;
it cannot contain independently managed/rentable/sellable units. Ownership can
only attach to existing `Property` records, so the correct structural level
cannot be expressed where both a building and its units matter.

The capability could unlock unit-level ownership, availability, publication,
leases/reservations and meaningful building navigation. Existing service
ownership and technical patterns can support it without a new bounded context:
Property Management owns the language; API owns transport; Drizzle/PostgreSQL
owns persistence; existing authority and RLS patterns remain applicable.

It is nevertheless **READY WITH DISCOVERY GAPS**, not the next smallest slice.
Repository evidence does not decide:

- whether `BUILDING`, `RESIDENCE` and `UNIT` are Property roles, separate
  aggregates/entities, or a structure plus child assets;
- whether hierarchy is one level or recursive;
- whether every apartment must have a parent or may explicitly be standalone;
- which levels are independently managed, owned, priced and eventually
  publishable;
- whether location/details inherit from a structure or are copied/overridden;
- cardinality, deletion/reparenting rules and cycle prevention.

Selecting a schema before confirming these invariants risks premature
abstraction. After the contained web slice, a composition vertical slice should
begin with explicit language/invariants and choose the smallest non-recursive
model supported by confirmed cases. No new bounded context or generic graph is
currently justified.

## 7. Publication readiness assessment

**Property Publication Lifecycle is PREMATURE.** `DRAFT` exists only as the sole
accepted status; there is no transition behavior. The current aggregate cannot
define publishability consistently across a standalone house, a standalone
apartment and a unit within a building. It also lacks confirmed required
description/detail rules, media, amenities, availability/occupancy semantics
and marketplace visibility rules.

Ownership is representable, but partial ownership is explicitly valid and no
rule says 100% ownership is a publication prerequisite. Inventing that rule in
publication would conflate legal completeness with listing readiness.

A future lifecycle may use `DRAFT`, `READY_FOR_PUBLICATION`, `PUBLISHED` and
`UNPUBLISHED`, but these are candidate terms, not current requirements.
Publication must be an explicit authorized domain action with explicit
validation and public/private exposure behavior; it must not be inferred from
field presence. Composition should be settled first for unit-bearing assets,
and publishability inputs should be confirmed before statuses or migrations are
introduced.

## 8. Candidate capability comparison

| Candidate | Dependency and value | Slice/impact | Risk and capabilities unlocked | Decision |
|---|---|---|---|---|
| A — Composition / Building & Units | High downstream domain value; required to model multi-unit assets correctly. | Domain, persistence, migration, API, grants, RLS, contract and UI implications; vertically testable once language is confirmed. | Current invariants are underdetermined; wrong aggregate/hierarchy is expensive. Unlocks unit ownership, availability, publication and leasing. | **Next domain candidate, after TASK-044; READY WITH DISCOVERY GAPS.** |
| B — Publication lifecycle | Could move assets toward marketplace use. | Broad domain/API/persistence/auth/UI and eventual public-boundary impact. | Publishability and publishable resource level are undefined; missing structure/media/availability evidence. | **PREMATURE.** |
| C — Property media | Visible user value and likely publication input. | Requires media aggregate/metadata, object storage/security, ordering/lifecycle, API and UI. | Storage and publication requirements are absent; isolated media would be speculative. | **PREMATURE as next slice.** |
| D — Availability/occupancy | Enables leasing/reservation workflows. | Requires resource level, time/state semantics, persistence, concurrency and authorization. | Long-term occupancy and short-term calendar availability are distinct concepts; composition is unresolved. | **PREMATURE.** |
| E — Portfolio UI evolution | Makes completed TASK-042 behavior usable and removes a false UI message. | Small complete browser slice; consumes existing contract/auth; no backend, migration, grant or RLS change. | Low abstraction risk. Unlocks normal navigation from portfolio to creation/detail/ownership and creates a surface for later capabilities. | **SELECTED; READY WITH CONTAINED GAPS.** |
| F — Ownership follow-up | Owner discovery/inverse navigation has value; share updates/history may later matter. | Could be sliced, but requirements differ substantially. | Current assign/list/remove behavior is coherent; precision/partial totals are intentional and no repository evidence makes history or mandatory 100% blocking. | **DEFER.** |

Candidate E wins on user value per unit of change, end-to-end completeness,
testability and absence of speculative domain design. It is not merely cosmetic:
it closes the only break between an implemented portfolio capability and its
authenticated browser workflow.

## 9. Recommended next capability

Deliver authenticated, tenant-safe **Property Portfolio Web Discovery** in
French using the existing `GET /v1/properties` contract. The user should land on
`/properties`, see the first page of their portfolio, filter/search it, load
later pages, open a Property detail and reach creation without knowing a UUID.

The backend remains the authority for tenant, grants, filtering and cursor
semantics. The web client treats cursors as opaque and does not reproduce
authorization or pagination logic.

## 10. Proposed task identifier and title

```text
TASK-044 — Property Portfolio Web Discovery Vertical Slice
```

Composition should be reassessed immediately afterward as the likely next
domain task; its identifier must be allocated from repository truth at that
time rather than precommitted here.

## 11. Explicit scope

TASK-044 should:

- add web-owned TypeScript models for the published portfolio response;
- add `listProperties` to the authenticated Property API client with supported
  `type`, `status`, `search`, `limit` and opaque `cursor` parameters;
- replace the stale UUID-only portfolio workspace with a French-language list;
- render loading, empty, success, next-page and safe 400/401/403/500 states;
- provide bounded type/status/search controls supported by the existing API;
- preserve deterministic server ordering and append or replace pages without
  client-side reordering;
- link each item to `/properties/{propertyId}` and preserve prominent access to
  `/properties/new`;
- retain direct UUID navigation only if product value justifies it, without
  presenting it as the sole discovery mechanism;
- add client/model/component tests and verify browser navigation, bearer use,
  query encoding and opaque cursor forwarding;
- keep every user-facing label and message in French.

## 12. Explicit non-goals

TASK-044 must not add or change:

- Property, Building, Residence, Unit or hierarchy domain models;
- API portfolio behavior, response projection, cursor format or ordering;
- PostgreSQL tables, migrations, indexes or RLS policies;
- new grants, OIDC claims, tenant selectors or client-side authorization;
- public catalogue/search, publication lifecycle or marketplace visibility;
- media, amenities, occupancy, availability, leases, reservations, payments or
  billing;
- owner creation/search, inverse Owner → Properties navigation, ownership share
  update/history or mandatory 100% allocation;
- infinite scrolling, total counts, ranking, analytics, saved filters or a
  speculative generic design-system abstraction.

## 13. Architecture implications

No ADR or architecture change is required. The web application remains the
transport/client composition owner and consumes only the versioned public HTTP
contract. Property domain/application layers remain framework-independent in
`services/property-management`; reusable packages remain domain-neutral.

The implementation must preserve monorepo dependency rules, Clean Architecture
direction, the Property Management bounded-context boundary, managed OIDC,
NestJS composition, Zod/OpenAPI ownership and CI architecture checks. A frontend
contract model must not import service Domain types.

Composition later can remain in the existing bounded context unless confirmed
independent ownership/responsibility justifies an ADR. No such change is
required for TASK-044.

## 14. API implications

TASK-044 consumes the existing additive API without changing it. Query names,
bounds and strictness are those already published. The cursor is opaque; the
browser may store/forward it but must not decode, synthesize or compare it.

The web should omit empty optional filters, encode query values safely and not
send a tenant ID. It should use the existing authenticated client so bearer and
correlation behavior remain centralized. Any discovered contract defect must be
reported separately rather than silently worked around with an incompatible
client shape.

## 15. Persistence implications

There is no persistence or migration change in TASK-044. It relies on the
service-owned `properties` table, forced RLS and migration `0004` index already
present. Browser-side durable caching, offline storage and persisted cursors are
out of scope.

For later Composition, persistence will likely require additive structural
tables/columns, tenant-qualified references, cycle/cardinality constraints,
forced RLS and migration-from-empty verification, but no schema is selected by
this audit.

## 16. Authorization and tenant-isolation implications

The existing API boundary remains authoritative: OIDC bearer verification maps
to internal authority; `LIST_PROPERTIES` and exactly one tenant are enforced;
PostgreSQL tenant transactions and RLS scope reads. TASK-044 adds no grant and
must never accept, infer or display a tenant selector.

The UI should render safe French responses for 401 and 403 and must not expose
tokens, grants, tenant IDs, cursor payload internals or raw Problem Details.
Frontend visibility is not authorization; direct API calls remain protected.

## 17. Frontend implications

Current consumption:

- create Property;
- retrieve Property;
- update details/commercial terms;
- retrieve Property ownerships and referenced owners;
- assign and remove ownership.

TASK-042 consumption is absent. Routes already connect `/properties`,
`/properties/new` and `/properties/:propertyId`, so TASK-044 can complete the
navigation without route redesign. The Property workspace and its test fixture
must be updated together; the current “Liste des biens indisponible” statement
must disappear. French locale labels already exist for Property and transaction
types and should be reused.

The separate `/proprietaires` placeholder demonstrates another UI lag, but it
does not prevent a complete Property portfolio slice. It remains a contained
follow-up candidate.

## 18. Required tests for TASK-044

At the lowest meaningful level:

- model parsing/typing for strict portfolio items and page information;
- API client query encoding, omitted empty filters, bearer propagation and
  exact opaque cursor forwarding;
- portfolio component loading, empty, populated and next-page behavior;
- filter/search submission and server-result rendering without client reorder;
- navigation to create and detail routes;
- French safe handling of 400, 401, 403 and 500 without token/tenant leakage;
- regression proving the stale “API list unavailable” state is removed;
- web typecheck, unit/component tests and production build;
- repository unit, integration, contract, architecture and full gates to prove
  the consumer-only change does not regress the provider.

No new API, contract or PostgreSQL behavior test is required unless TASK-044
discovers and fixes a separately justified provider defect.

## 19. Validation evidence

Commands were executed against the audited working tree:

| Command | Result |
|---|---|
| `corepack pnpm typecheck` | **Initial attempt failed before typechecking**: pnpm dependency-state check attempted registry metadata and then refused a non-TTY modules purge. The equivalent repository-wide check was rerun as below. |
| `$env:CI='true'; corepack pnpm -r typecheck` | **PASS** — all nine workspace projects with scripts, including web, Property service and API. |
| `corepack pnpm test:architecture` | **Attempted, not validated** — the same pnpm preflight/environment failure occurred before script resolution. The repository's actual named gate is `architecture:check`. |
| `corepack pnpm architecture:check` | **PASS** — workspace, exports, resolver, dependency graph, boundaries, cycles and diagnostics. |
| `corepack pnpm typecheck:tests` | **PASS**. |
| `corepack pnpm test:unit` | **PASS** — 20 files, 132 tests. |
| `corepack pnpm test:integration` | **FAIL (environmental)** — 13 files/107 tests passed; the PostgreSQL runtime suite could not start because Testcontainers found no container runtime, so its 8 tests were skipped after suite setup failure. |
| `corepack pnpm test:contract` | **PASS** — 11 files, 65 tests. |
| `corepack pnpm test` | **FAIL (environmental)** — 52 files/346 tests passed; five PostgreSQL/Testcontainers suites failed setup with no container runtime and 57 tests were skipped. No executed assertion failed. |
| `corepack pnpm service:property-management:migration:check` | **PASS** — Drizzle reported `Everything's fine`. |
| `corepack pnpm service:property-management:test:integration` | **UNAVAILABLE** — its 22 PostgreSQL tests could not start without a container runtime. The suite includes portfolio filter/search/cursor/order, tenant/RLS and index evidence but was not claimed as passing. |
| `corepack pnpm app:web:test` | **PASS outside sandbox after Windows `spawn EPERM`** — 8 files, 42 tests. |
| `corepack pnpm app:web:build` | **Not validated in sandbox** — TypeScript completed, then Vite config loading hit Windows `spawn EPERM`; no source/build assertion failure was observed, but the build is not claimed as passed. |
| `corepack pnpm app:api:contracts:check` | **PASS** — 11 files, 65 tests. |

Warnings/constraints: Corepack displayed that pnpm 11.24.0 is available while
the repository remains pinned to 11.22.0; no upgrade was made. Docker was not
available, so this audit relies on inspected PostgreSQL tests plus prior
repository artifacts for database semantics and explicitly leaves execution of
those tests unverified in this environment. Windows sandbox process restrictions
caused `spawn EPERM`; affected checks were rerun outside the sandbox where
approval was available. No audit-blocking source defect required repair.

## 20. Final readiness verdict

```text
TASK-042  Property Portfolio Listing / Discovery API
    ↓
TASK-043  Post-Property-Portfolio Readiness Audit
    ↓
TASK-044  Property Portfolio Web Discovery Vertical Slice

TASK-043 verdict: READY WITH CONTAINED GAPS
TASK-044 readiness: READY
Property Composition readiness: READY WITH DISCOVERY GAPS, deferred until the
implemented portfolio can be used through the browser
Property Publication readiness: PREMATURE
```

The contained gaps are lack of a container runtime for fresh PostgreSQL test
execution, unresolved composition vocabulary/invariants, the Owner workspace
gap, and intentional ownership limitations. None prevents TASK-044 because it
is a consumer-only completion of an existing authenticated contract. TASK-044
must finish before another backend-only Property expansion so the platform
first turns its verified portfolio API into a usable portfolio.
