# TASK-026 — Tenant Onboarding Vertical Slice — Activate Tenant

## Status

DONE

## Objective

Activate an existing `PENDING` tenant after Identity confirms that the tenant
has an `ACTIVE` `TENANT_ADMINISTRATOR`.

## Implementation contract

- HTTP: `POST /api/v1/tenants/{tenantId}/activate`, bodyless, `200 OK`.
- Success returns `tenantId`, `lifecycleState: ACTIVE`, and `activatedAt`.
- Domain transition is `PENDING -> ACTIVE`; `ACTIVE -> ACTIVE` is idempotent.
- Tenant Management depends on the technology-neutral
  `ActiveTenantAdministratorPort`, never on Identity infrastructure.
- API composition adapts the public Identity
  `HasActiveTenantAdministrator` capability to that port.
- PostgreSQL activation uses the existing tenant root and Outbox tables under
  a tenant-scoped `tenant:activate` RLS capability.
- The state update and `monpiole.tenant.tenant-activated` version 1 Outbox row
  commit atomically and occur only for the actual transition.
- Problem Details maps invalid UUID to 400, missing tenant to 404,
  administrator-not-ready to 409, and unexpected failure to the safe 500
  baseline.

## Actual scope

- Tenant `ACTIVE` lifecycle state and `activatedAt`.
- `ActivateTenant` Application use case and required ports.
- Identity active-administrator query capability over the shared TASK-024/025
  in-memory store.
- PostgreSQL migration, explicit mapping, transaction, RLS policy, and Outbox.
- TenantActivated event producer/consumer contract and serialization.
- HTTP DTO/schema/mapper/controller, composition adapter, Problem Details, and
  OpenAPI contract.
- Domain/Application, Identity query, PostgreSQL, HTTP integration, event, and
  OpenAPI tests.

## Exclusions and deferred dependencies

- Identity remains in-memory; no Identity database migration is included.
- Production API bootstrapping of PostgreSQL and Identity authentication is not
  selected by the existing composition root and remains explicit future work.
- No credentials, login, JWT, invitation, billing, subscriptions, broker,
  Outbox dispatcher, or complete onboarding workflow.

## Tests and evidence

- Unit project: 6 files and 34 tests passed, including 6 Activate Tenant tests
  and the Identity readiness regression.
- HTTP integration project: 7 files and 34 tests passed, including 5 Activate
  Tenant endpoint tests.
- PostgreSQL/Testcontainers targeted service suite: 1 file and 11 tests passed,
  including 4 activation/RLS/rollback tests.
- Contract project: 8 files and 54 tests passed; the Events-specific contract
  gate passed 5 files and 36 tests.
- Complete repository graph: 23 files and 140 tests passed.
- Test typecheck, architecture, Identity/Tenant Management/API typechecks and
  builds, OpenAPI generation/drift, service and package migration checks,
  Events and Persistence package gates all passed.
- `git diff --check` and final diff/status review are recorded in the delivery
  report.

## Completion gate

Set `DONE` only after every applicable repository gate requested by TASK-026 is
green, OpenAPI matches its committed review artifact, `git diff --check`
passes, and the final diff/status review finds no unrelated or generated build
artifacts.
