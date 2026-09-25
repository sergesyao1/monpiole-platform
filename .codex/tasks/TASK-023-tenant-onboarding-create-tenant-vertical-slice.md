# TASK-023 — Tenant Onboarding Vertical Slice Implementation — Create Tenant

## Status

DONE

## Objective

Implement the first production-oriented Tenant Onboarding vertical slice:
Create Tenant.

The implementation must exercise the approved MonPiole baselines end-to-end:

HTTP contract
→ application use case
→ domain model
→ persistence
→ event contract
→ automated verification.

## Scope

- Create Tenant API operation
- input validation
- domain invariants
- application command/use case
- tenant persistence
- API response mapping
- Problem Details error mapping
- TenantCreated event
- correlation/context propagation
- unit tests
- integration tests
- contract tests
- architecture checks

## Out of Scope

- bootstrap administrator provisioning
- tenant activation
- complete onboarding
- subscription creation
- billing
- payment
- email verification
- external provisioning
- broker selection
- Transactional Outbox dispatcher and external event delivery
- full Audit bounded-context integration
- tenant administration UI

## Dependencies

- TD-004 Testing Strategy & Tooling
- TD-005 Application Framework
- TD-006 API Contract Baseline
- TD-007 Event Contract Baseline
- TD-008 Persistence Baseline
- TD-009 CI Execution Baseline
- Tenant Onboarding Product Contract

## Approved Implementation Contract

This section records the approved implementation contract for TASK-023. It
narrows the approved Tenant Onboarding product contract to tenant creation only
and does not redefine complete onboarding.

### Create Tenant HTTP contract

- Route: `POST /api/v1/tenants`.
- Success status: `201 Created`.
- The result represents tenant creation only, not complete onboarding.
- The created tenant lifecycle state is `PENDING`.
- `X-Tenant-Id` is not applicable because this is a pre-tenant operation.
- `X-Correlation-Id` follows the existing TD-006 baseline.
- `X-Request-Id` follows the existing TD-006 baseline.
- `Idempotency-Key` is required.

### Identifiers

- The product Tenant ID is a UUID v4 generated according to TD-008.
- Fixture-oriented slug Tenant ID schemas must not be silently reused for the
  persisted product Tenant ID.
- Tenant, correlation, request, event, and causation identifiers remain
  conceptually distinct even when they share UUID syntax.

### Input normalization

- Organization name is trimmed of surrounding whitespace and must remain
  non-empty.
- Responsible person name is trimmed of surrounding whitespace and must remain
  non-empty.
- Responsible email is trimmed and lowercased for canonical comparison and
  duplicate detection.
- Responsible telephone uses E.164 international representation.
- Country uses ISO 3166-1 alpha-2 uppercase representation.
- No additional speculative normalization rules are introduced by TASK-023.

### Duplicate detection

- The normalized responsible-person primary email is the duplicate key for
  TASK-023.
- A different creation intent using an email already associated with an
  existing tenant returns an explicit conflict.
- A database uniqueness constraint protects this invariant under concurrency.

### Idempotency

- `Idempotency-Key` is mandatory.
- The accepted request intent is represented deterministically after the
  approved normalization.
- Replaying the same key with the same normalized intent returns the persisted
  successful outcome and creates neither another tenant nor another
  `TenantCreated` event.
- Reusing the same key with a different normalized intent returns an explicit
  idempotency conflict.
- The successful idempotency outcome is persisted atomically with tenant
  creation.
- TASK-023 defines no idempotency retention or expiration behavior.

### Authorization

- Authorization occurs before every side effect.
- Application defines a technology-neutral authorization/authority port.
- TASK-023 does not invent a production Identity authentication mechanism.
- Automated tests may provide deterministic authorized and unauthorized
  adapters.
- Production HTTP integration with Identity remains an explicit external
  dependency and blocker to claiming production authentication integration.

### Pre-tenant persistence

- Create Tenant is a pre-tenant platform-authority operation.
- Implement the narrowest explicit platform-authority transaction path needed
  to create the tenant root.
- The ordinary tenant-scoped transaction must not be reused by pretending the
  new tenant already exists.
- The platform-authority path must be capability-specific and must not become a
  generic RLS bypass.
- Normal post-creation tenant-owned operations remain subject to explicit tenant
  context and RLS.

### TenantCreated event

- Event type: `monpiole.tenant.tenant-created`.
- Event version: `1`.
- The event is tenant-scoped using the newly created UUID Tenant ID.
- The event contract uses `@monpiole/events` envelope primitives.
- Domain and Application must not import `@monpiole/events`.
- The payload excludes responsible-person email and telephone.
- The payload remains minimal and tenant-lifecycle oriented.

### Event reliability

- Tenant creation and the durable `TenantCreated` event record commit
  atomically.
- Implement the minimum service-owned Transactional Outbox persistence needed
  for this guarantee.
- Broker selection, dispatcher implementation, and external delivery are
  outside TASK-023.
- Durable Outbox recording is the event boundary for this slice.

### Audit and tracing

- Preserve correlation and actor/authority trace metadata required by the
  operation.
- TASK-023 does not claim complete audit integration.
- Full Audit bounded-context integration remains future work.

### Error contract

Use stable TD-006 Problem Details mappings without database or internal
implementation details:

| Outcome | HTTP status | Required semantics |
| --- | ---: | --- |
| Invalid request | `400` | Safe validation problem with no side effects |
| Unauthenticated boundary | `401` | Reserved for a missing or invalid authenticated principal when an authentication adapter is present; TASK-023 does not invent that adapter |
| Forbidden platform authority | `403` | An established principal lacks Create Tenant authority; no side effects |
| Duplicate tenant email | `409` | Normalized email already identifies an existing tenant |
| Idempotency conflict | `409` | The same key was previously accepted for a different normalized intent |
| Unexpected internal failure | `500` | Existing safe internal-error mapping with correlation retained |

## Implementation Readiness Assessment

The approved contract resolves the Create Tenant route, success outcome,
identifier, normalization, duplicate, idempotency, pre-tenant persistence,
event, reliability, scope, tracing, and error semantics sufficiently to begin
the bounded-context implementation.

No remaining product ambiguity blocks Domain, Application, PostgreSQL, Outbox,
event-contract, HTTP-contract, or automated-test implementation within this
task. The following constraints remain explicit:

- Production HTTP authentication and Identity-backed principal resolution are
  not implemented or selected. The authorization port and deterministic test
  adapters may be implemented, but the endpoint must not be represented as
  production-authentication-complete until Identity integration is approved and
  delivered.
- No broker or Outbox dispatcher is selected. TASK-023 ends at an atomically
  persisted Outbox event record and must not claim external event delivery.
- Full Audit bounded-context integration is deferred. Correlation and
  actor/authority trace metadata are retained without claiming a complete audit
  trail.

## Proposed Implementation Phases

1. Define the tenant-management workspace and public composition boundary, then
   add architecture coverage for the new Domain, Application, Infrastructure,
   HTTP, persistence, and event dependency edges.
2. Implement the framework-neutral Tenant Domain model and approved input value
   normalization, with UUID, lifecycle, clock, and authority concepts kept
   explicit and independently testable.
3. Implement the `CreateTenant` Application command/use case and
   technology-neutral ports for authorization, identifiers, transactions,
   tenant/idempotency persistence, clock, and durable event recording.
4. Implement the service-owned PostgreSQL schema, mappings, repositories,
   capability-specific platform-authority transaction adapter, uniqueness and
   idempotency constraints, Transactional Outbox table, and migration.
5. Define the tenant-management-owned `TenantCreated` version 1 contract and
   infrastructure mapping using `@monpiole/events`, with durable Outbox recording
   as the event boundary.
6. Implement and compose the NestJS `POST /api/v1/tenants` adapter using the
   existing TD-006 Zod, request-context, response serialization, Problem
   Details, and OpenAPI conventions.
7. Extend the existing unit, HTTP integration, PostgreSQL integration, API
   contract, event compatibility, OpenAPI, and architecture suites, then run
   the full TD-009 validation graph and review the diff.

## Expected Files

Exact filenames may be refined to match the smallest cohesive units, but the
expected change surface is:

- `services/tenant-management/package.json`
- `services/tenant-management/tsconfig.json`
- `services/tenant-management/src/index.ts`
- `services/tenant-management/domain/` tenant aggregate, lifecycle, identifiers,
  and approved value normalization
- `services/tenant-management/application/` Create Tenant command/use case and
  technology-neutral ports
- `services/tenant-management/infrastructure/persistence/postgres/` schema,
  mappings, repositories, platform-authority transaction adapter, Drizzle
  configuration, and migration
- `services/tenant-management/infrastructure/events/` TenantCreated contract,
  envelope mapping, and durable Outbox adapter
- `services/tenant-management/tests/` focused Domain, Application, persistence,
  and event tests where package-local ownership is appropriate
- `services/tenant-management/README.md`
- `apps/api/src/contracts/v1/tenants/` request and response schemas
- `apps/api/src/http/tenants/` DTOs, mapper, controller, and Problem Details
  adaptation
- `apps/api/src/app.module.ts` and the minimum composition/configuration files
  needed to wire the service
- `engineering/contracts/http/openapi.json`
- existing `tests/unit/`, `tests/integration/`, `tests/contract/`, and
  `tests/fixtures/` files extended for Create Tenant behavior
- `tools/quality/` architecture rules or fixtures only where the existing rules
  do not already prove the new edges
- root/service TypeScript, Vitest, package-script, workspace dependency, and
  `pnpm-lock.yaml` updates required to compile and execute the new workspace

Generated `dist` output is not part of the source change.

## Verification Commands

Run the repository-owned commands that form the TD-009 validation baseline:

```text
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck:tests
corepack pnpm architecture:check
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm test:contract
corepack pnpm app:api:typecheck
corepack pnpm app:api:build
corepack pnpm app:api:openapi
corepack pnpm app:api:contracts:check
corepack pnpm package:events:typecheck
corepack pnpm package:events:build
corepack pnpm package:events:contracts:check
corepack pnpm package:persistence:typecheck
corepack pnpm package:persistence:build
corepack pnpm package:persistence:migration:check
corepack pnpm package:persistence:test:integration
corepack pnpm test
git diff --check
git diff --stat
git status --short
```

If tenant-management introduces narrower workspace commands, TD-009 should call
or cover them through the existing stable aggregate gates rather than creating
a parallel validation convention.

## Completion Gate

TASK-023 is DONE only when the Create Tenant flow is executable,
persisted with its successful idempotency outcome and `TenantCreated` Outbox
record atomically, contract-tested, architecture-compliant, and green in CI.
The task must report the deferred Identity authentication integration, Outbox
dispatcher/external delivery, and full Audit integration without claiming they
were completed.

