# TASK-031 — Tenant Onboarding Authenticated Authority Vertical Slice

## Status

DONE

## Objective

Establish a trusted authenticated-authority boundary for the four privileged
Tenant Onboarding mutations without selecting or implementing a complete
authentication platform.

## Audit findings

- Create Tenant already carries distinct `actorId` and `authorityId` values and
  checks a technology-neutral Application authorization port, but the HTTP
  adapter maps missing authentication to 403 and normal PostgreSQL runtime does
  not compose the use case or an authenticated authority provider.
- Bootstrap Administrator, Activate Administrator, and Activate Tenant carry
  correlation and target identifiers but no actor, authority, or Application
  authorization decision. Their OpenAPI operations explicitly declare
  `security: []`.
- `RequestContextInterceptor` validates correlation, request, idempotency, and
  optional tenant headers. It does not establish an authenticated principal.
- Tenant IDs in paths identify target resources. Administrator IDs identify the
  target Identity. Neither is proof of the calling actor.
- Tenant Management and Identity already expose inward Application ports and
  are composed in `apps/api`; PostgreSQL adapters enforce tenant-scoped RLS.
- Problem Details safely maps business outcomes, but has no explicit 401
  mapping for a missing authenticated principal.
- OpenAPI already defines a bearer security scheme. No JWT validation,
  credential store, session, OAuth/OIDC, or production authentication adapter
  has been approved.

## Scope and architectural decisions

- Resolve an authenticated onboarding authority only through an injectable HTTP
  boundary port. Controllers never accept actor or authority fields in request
  payloads or business headers.
- Represent actor/subject, authority, tenant scope, and target administrator as
  distinct values.
- Carry the trusted authority into Application commands and require each use
  case to call a technology-neutral authorization port before reads or writes.
- Use an API-composed policy with explicit onboarding grants and tenant scopes.
  Create Tenant requires platform create authority; tenant-owned mutations
  require the operation grant and the target tenant in scope.
- Missing authentication maps to 401. A resolved authority rejected by the
  Application policy maps to 403.
- Default and normal runtime authentication remains fail-closed until a real
  authentication adapter is selected and injected. No client-controlled fallback
  or test-environment branch is permitted.
- Preserve existing PostgreSQL stores, transactions, RLS, domain behavior,
  HTTP request/response bodies, and lifecycle semantics.

## Acceptance criteria

- [x] All four onboarding mutations require an authenticated authority.
- [x] No request body or target identifier can establish actor authority.
- [x] Authorization occurs before every repository, transaction, or event side effect.
- [x] Tenant-scoped grants cannot authorize another tenant.
- [x] Missing authentication returns safe RFC 7807 401.
- [x] Authenticated but unauthorized access returns safe RFC 7807 403.
- [x] Authorized requests preserve TASK-023 through TASK-029 behavior.
- [x] OpenAPI declares bearer security and 401/403 responses on every operation.
- [x] PostgreSQL runtime composition remains explicit and fail-closed.
- [x] Unit, integration, contract, architecture, typecheck, build, and full tests pass.

## Exclusions

- Authentication provider selection or implementation.
- JWT validation or issuance, credentials, passwords, sessions, refresh tokens,
  OAuth/OIDC, MFA, invitations, and email verification.
- Full Audit bounded-context integration or unrelated persistence changes.
- New onboarding operations, broker dispatch, billing, or subscriptions.

## Verification commands

```text
corepack pnpm typecheck:tests
corepack pnpm architecture:check
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm test:contract
corepack pnpm app:api:typecheck
corepack pnpm app:api:build
corepack pnpm app:api:openapi
corepack pnpm app:api:contracts:check
corepack pnpm service:identity:typecheck
corepack pnpm service:identity:build
corepack pnpm service:tenant-management:typecheck
corepack pnpm service:tenant-management:build
corepack pnpm test
git diff --check
git diff --stat
git status --short
```

## Implementation evidence

Implemented on 2026-08-25:

- Added Identity authority types, grants, forbidden outcome, and authorizer port;
  bootstrap and activation authorize before persistence access.
- Extended Tenant Management authority with explicit grants and tenant scopes;
  tenant activation authorizes before opening its transaction while Create
  Tenant retains its pre-side-effect authorization boundary.
- Added an API-only authenticated authority provider, trusted mapping helpers,
  and a composed policy for operation grants plus tenant scope.
- Normal PostgreSQL runtime now composes Create Tenant and all four use cases
  with the same authority policy. The absent production authentication adapter
  remains fail-closed rather than falling back to client headers or memory.
- Added safe 401/403 Problem Details mappings and Bearer OpenAPI requirements
  to all onboarding mutations. Request/response business schemas are unchanged.
- Added unit coverage for policy decisions and pre-side-effect rejection;
  integration coverage for authenticated success, missing authentication,
  forbidden grants, cross-tenant scope, and unchanged lifecycle behavior; and
  contract coverage for security and 401/403 responses.

Verification evidence:

```text
corepack pnpm install --frozen-lockfile                  PASS
corepack pnpm typecheck:tests                           PASS
corepack pnpm test:unit                                 PASS — 7 files / 40 tests
corepack pnpm test:integration                          PASS — 8 files / 46 tests
corepack pnpm test:contract                             PASS — 8 files / 54 tests
corepack pnpm architecture:check                        PASS
corepack pnpm service:identity:typecheck                PASS
corepack pnpm service:identity:build                    PASS
corepack pnpm service:tenant-management:typecheck       PASS
corepack pnpm service:tenant-management:build           PASS
corepack pnpm app:api:typecheck                         PASS
corepack pnpm app:api:build                             PASS
corepack pnpm app:api:openapi                           PASS
corepack pnpm app:api:contracts:check                   PASS
corepack pnpm test                                      PASS — 26 files / 163 tests
git diff --check                                        PASS
```

The repository exposes no formatting or lint script, so no such gate could be
run. Formatting safety is covered by `git diff --check`; lint baseline selection
remains outside TASK-031.

## Completion gate

Completion gate satisfied. No authentication mechanism was invented: a real
provider must be selected in a separately approved security capability.
