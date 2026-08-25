# TASK-029 — Identity PostgreSQL Runtime Composition

## Status

READY FOR REVIEW

## Objective

Use the PostgreSQL-backed Identity store in normal API runtime composition for
administrator bootstrap, administrator activation, and active-administrator
readiness used by tenant activation.

## Implementation contract

- `main.ts` creates PostgreSQL runtime composition from the shared persistence
  environment configuration and fails explicitly when configuration is absent
  or invalid.
- One `PostgresIdentityStore` instance backs all three Identity capabilities.
- Tests continue to inject the in-memory adapter explicitly where appropriate;
  runtime contains no environment-based in-memory fallback.
- Tenant existence is supplied through a Tenant Management-owned application
  query and PostgreSQL adapter with a narrowly scoped `tenant:exists` RLS
  policy.
- Tenant activation continues to consume Identity readiness only through the
  existing neutral application capability and API composition adapter.
- The PostgreSQL pool participates in Nest application shutdown.
- Existing HTTP/OpenAPI contracts remain unchanged.

## Actual scope

- PostgreSQL API runtime factory and lifecycle wiring.
- Normal API entry-point wiring for Identity bootstrap/activation/readiness and
  tenant activation.
- Tenant Management existence query, PostgreSQL repository, and custom RLS
  migration.
- Real API/PostgreSQL integration covering durable bootstrap, durable
  activation, complete onboarding sequence, and cross-tenant isolation.

## Exclusions

- Authentication, login, credentials, JWT, sessions, OAuth/OIDC, MFA, RBAC
  expansion, email verification, password reset, Identity events, and new
  onboarding operations.
- Create Tenant production authority remains governed by its existing deferred
  authentication dependency; integration tests provide the approved explicit
  deterministic authority adapter.

## Evidence

- Runtime PostgreSQL integration: integration project 8 files and 38 tests
  passed, including 4 real runtime-composition scenarios.
- Unit project: 6 files and 34 tests passed.
- Contract project: 8 files and 54 tests passed.
- Identity persistence integration: 1 file and 5 tests passed.
- Persistence integration: 3 files and 23 tests passed.
- Events contract gate: 5 files and 36 tests passed.
- Complete repository graph: 25 files and 149 tests passed.
- Frozen install, all repository-provided service/API/test typechecks and
  builds, architecture verification, Identity/Tenant/Persistence migration
  checks, OpenAPI regeneration/drift, and `git diff --check` passed.
- Root `pnpm lint` and `pnpm typecheck` are not defined by this repository and
  return `Command not found`. No lint result is claimed; repository-provided
  `typecheck:tests` and all workspace typechecks passed.

## Completion gate

Set `DONE` only after all repository-provided typecheck, build, test,
architecture, migration, contract, and OpenAPI checks pass, OpenAPI has no
diff, `git diff --check` passes, and unavailable requested scripts are reported
without inventing replacements.
