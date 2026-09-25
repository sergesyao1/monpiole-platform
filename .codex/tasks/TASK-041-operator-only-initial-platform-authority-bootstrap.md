# TASK-041 — Operator-only Initial Platform Authority Bootstrap

- Date: 2026-08-26
- Status: **DONE**

## Context and decision

TASK-040 made OIDC resolution durable, but a fresh installation has no internal
authority. HTTP onboarding requires authority while OIDC resolution requires an
existing ACTIVE identity. TASK-041 provides the one-shot operator CLI
`platform:bootstrap-initial-authority`; it is never registered as HTTP.

The CLI composes the approved `CreateTenant`,
`BootstrapTenantAdministrator`, `ActivateTenantAdministrator`, and
`ActivateTenant` use cases and unchanged authorization policy. Auth0 linking
remains the separate `identity:link-external` operation.

## Safety invariants

- explicit enable flag and exact confirmation phrase in every environment;
- all tenant, administrator, idempotency and operator inputs required;
- Domain validation before the first database effect;
- PostgreSQL advisory lock serializes command instances;
- each bounded context owns its initialization-state probe;
- any existing tenant, identity or membership refuses execution;
- state created only through existing Application services;
- success requires ACTIVE tenant, ACTIVE identity and TENANT_ADMINISTRATOR;
- second execution rejected; no HTTP/OIDC authorization is weakened.

The use cases retain transactions in their owning contexts. No cross-context
transaction is introduced. An interruption after a partial commit is
fail-closed and requires an approved recovery procedure; the CLI never silently
resumes, overwrites state, or applies raw SQL repair.

## Scope and tests

The implementation adds service-owned probes, a narrow Identity SELECT-only RLS
policy, CLI configuration/orchestration/advisory lock, unit tests, PostgreSQL
lifecycle/re-run coverage, runbooks, and UI-002A evidence. No credentials,
tokens, Auth0 subject or external link are created by TASK-041.

## Execution evidence

The local database was confirmed empty immediately before execution (`0`
tenants, `0` identities, `0` memberships). The command completed with:

- tenant ID: `4a4a66d1-c55f-49e3-a50f-ccb2a21afbe8`;
- tenant lifecycle: `ACTIVE`;
- internal identity ID: `bebcbce1-3140-46c7-8049-bc2f6ca04f75`;
- identity status: `ACTIVE`;
- membership: `TENANT_ADMINISTRATOR`.

A read-only SQL verification confirmed these states and `0` external identity
links. `identity:link-external` was not executed.

Validation: 119 unit tests PASS, 100 integration tests PASS, Identity migration
check PASS, all workspace typechecks PASS, API dependency-aware build PASS,
architecture check PASS, and global suite 50 files / 356 tests PASS.
