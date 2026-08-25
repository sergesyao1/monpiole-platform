# TASK-028 — Identity PostgreSQL Persistence Baseline

## Status

DONE

## Objective

Persist the existing Identity tenant-administrator bootstrap and activation
lifecycle in Identity-owned PostgreSQL storage without changing public HTTP
contracts or inward Application/Domain dependencies.

## Implementation contract

- Preserve the existing bootstrap, activation, and active-administrator ports.
- Pass `tenantId` explicitly on identity persistence operations so every
  PostgreSQL transaction is tenant-scoped and RLS-enforced.
- Persist identities and `TENANT_ADMINISTRATOR` memberships atomically.
- Persist only `PENDING_ACTIVATION` and `ACTIVE` Identity states.
- Rehydrate through explicit Domain factories; never mutate Domain objects or
  expose persistence rows.
- Translate uniqueness failures to `BootstrapAdministratorConflictError`.
- Retain the in-memory adapter for isolated tests.
- Make no HTTP or OpenAPI contract changes.

## Actual scope

- Identity and TenantMembership Domain rehydration.
- PostgreSQL schema, Drizzle configuration, baseline migration, constraints,
  RLS policies, and store implementation.
- Identity workspace migration and integration-test commands.
- PostgreSQL/Testcontainers coverage for bootstrap, fresh-store reload,
  activation reload, conflict translation, and tenant isolation.
- Identity persistence ownership documentation.

## Exclusions

- Login, credentials, password behavior, JWT, sessions, OAuth/OIDC, MFA,
  password reset, email verification, RBAC redesign, invitations, user CRUD,
  Identity events, and unrelated onboarding capabilities.

## Evidence

- PostgreSQL/Testcontainers Identity suite: 1 file and 5 tests passed.
- Unit project: 6 files and 34 tests passed.
- HTTP integration project: 7 files and 34 tests passed.
- Contract project: 8 files and 54 tests passed.
- Persistence integration project: 3 files and 23 tests passed.
- Events contract gate: 5 files and 36 tests passed.
- Complete repository graph: 24 files and 145 tests passed.
- Identity typecheck/build/migration check, test typecheck, API typecheck/build,
  OpenAPI regeneration, architecture verification, Events and Persistence
  package gates, frozen install, and `git diff --check` passed.
- The repository defines no lint script; no lint result is claimed.

## Completion gate

Set `DONE` only after migration checks, Identity typecheck/build, persistence
integration, existing unit/integration/contract suites, architecture checks,
the complete repository test graph, and `git diff --check` all pass.
