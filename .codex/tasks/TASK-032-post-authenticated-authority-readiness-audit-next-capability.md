# TASK-032 — Post-Authenticated-Authority Readiness Audit & Next Capability

## Status

DONE

## Objective

Assess repository readiness after TASK-031 authenticated onboarding authority,
confirm that the privileged Tenant Onboarding vertical slice remains stable and
secure, identify the highest-priority remaining capability gap, and select the
next capability without prematurely implementing an authentication technology.

## Baseline under review

Reference implementation: `a7f6e1f feat(auth): enforce authenticated tenant onboarding authority`.

The current onboarding flow covers:

- Create Tenant.
- Bootstrap Tenant Administrator.
- Activate Tenant Administrator.
- Activate Tenant.

TASK-031 introduced a trusted authenticated-authority boundary composed of:

- an HTTP authenticated-authority provider port;
- distinct actor and authority identifiers;
- explicit onboarding grants;
- explicit tenant scopes;
- Tenant Management and Identity authorization ports;
- API-composed authorization policy;
- 401 for missing authentication;
- 403 for authenticated but unauthorized callers;
- Bearer security declarations in OpenAPI;
- fail-closed PostgreSQL runtime composition.

## Audit findings

### Authenticated authority boundary

READY.

`AuthenticatedOnboardingAuthorityProvider` is the only HTTP-side source of the
trusted onboarding authority.

Controllers do not infer actor identity or authorization from:

- request payload fields;
- tenant path parameters;
- administrator identifiers;
- ordinary business headers.

The authority model explicitly carries:

- `actorId`;
- `authorityId`;
- `grants`;
- `tenantIds`.

### Authentication versus authorization separation

READY.

The platform now distinguishes:

- establishment of a trusted authenticated principal/authority;
- application authorization of that authority.

`requireAuthenticatedOnboardingAuthority` rejects absence of authentication
with 401 before application execution.

Application use cases remain responsible for technology-neutral authorization.

No authentication technology has leaked into Tenant Management or Identity.

### Tenant scope enforcement

READY.

Tenant-owned onboarding operations require both:

- the required operation grant;
- the target tenant ID in the authority tenant scope.

The onboarding authorization policy therefore rejects a caller whose grant is
valid for another tenant.

Cross-tenant authorization is explicitly covered by tests.

### Application authorization boundary

READY.

All privileged onboarding mutations authorize before repository, transaction,
or event side effects.

Tenant Management and Identity depend on inward authorization ports rather than
HTTP, JWT, NestJS, or provider-specific concepts.

### HTTP security semantics

READY.

The HTTP boundary distinguishes:

- 401 — no authenticated authority;
- 403 — authenticated authority rejected by application policy.

Problem Details mappings preserve safe RFC 7807 behavior.

OpenAPI declares Bearer authentication and 401/403 outcomes on all onboarding
mutations.

### PostgreSQL runtime composition

READY.

Normal PostgreSQL composition explicitly wires the onboarding authorization
policy.

The runtime does not invent authentication from request headers or test-only
fallbacks.

Without a real authenticated authority provider, normal runtime behavior remains
fail-closed.

Existing PostgreSQL persistence, tenant isolation controls, and lifecycle
semantics remain intact.

## Readiness matrix

| Capability | Status | Repository evidence |
| --- | --- | --- |
| Authenticated-authority HTTP boundary | READY | Injectable provider port used by all four mutation controllers |
| Authentication/authorization separation | READY | HTTP resolves authority; Application ports decide permission |
| Actor/authority separation | READY | Distinct `actorId` and `authorityId` fields |
| Explicit onboarding grants | READY | Four bounded-context-owned grant literals |
| Tenant scope authorization | READY | Grant and target `tenantId` scope are both required after creation |
| Cross-tenant rejection | READY | Policy unit tests and HTTP integration tests |
| Authorization before side effects | READY | All four use cases authorize before reads or transactions |
| Missing authentication semantics | READY | RFC 7807-compatible 401 `UNAUTHORIZED` |
| Forbidden authority semantics | READY | RFC 7807-compatible 403 `FORBIDDEN` |
| OpenAPI security contract | READY | Bearer plus 401/403 on every onboarding mutation |
| PostgreSQL runtime composition | READY | One explicit authorization policy, no implicit provider fallback |
| Architecture boundaries | READY | Public ports/exports and dependency checks |
| Production authentication trust model | OPEN | No approved principal or credential-validation model |
| Concrete authentication provider | OPEN | No provider selected or composed |
| Credential/token/session lifecycle | OPEN | Expiration, revocation, and rotation remain undefined |
| First platform-administrator bootstrap | OPEN | Initial root-of-trust process is undefined |
| Authentication audit/security events | OPEN | Content, ownership, and delivery expectations remain undefined |

The model is ready to authorize a trusted authority, but it does not yet define
the canonical authenticated principal or the provenance of `actorId`,
`authorityId`, grants, and tenant scopes. OpenAPI also retains the historical
descriptive hint `bearerFormat: JWT`; no JWT validator or approved JWT decision
exists, so TASK-033 must confirm, change, or remove that hint.

## Primary remaining gap

The platform can now answer:

> Given a trusted authenticated authority, may this actor perform this operation
> against this tenant?

The normal production runtime cannot yet answer:

> How does an incoming request establish that trusted authenticated authority?

TASK-031 deliberately excluded:

- authentication provider selection;
- JWT validation or issuance;
- credentials and passwords;
- sessions and refresh tokens;
- OAuth/OIDC;
- MFA;
- invitations;
- email verification.

This exclusion is now the highest-priority capability gap.

Tenant-Scoped Request Context is not the immediate missing capability. Tenant
scope already exists in the trusted authority and is enforced by Application
authorization. Another tenant-context mechanism would not establish caller
identity or make the supplied scope trustworthy.

## Decision

Do not introduce a tenant-scoped request context as the immediate next
capability.

Tenant scope already exists in the trusted authority representation and is
actively enforced by application policy.

The missing security boundary is upstream of authorization: production
authentication.

Do not implement JWT or another authentication mechanism directly without first
selecting the security model and recording its constraints.

## Next capability

### TASK-033 — Authentication Provider Selection & Security Baseline

TASK-033 should define the authentication architecture before any concrete
provider implementation.

It must determine at minimum:

- authentication trust model;
- principal representation;
- relationship between principal, actor, and authority;
- source of grants;
- source of tenant scopes;
- credential/token/session strategy;
- expiration semantics;
- revocation semantics;
- signing-key ownership and rotation where applicable;
- authentication versus authorization responsibility boundaries;
- multi-tenant authentication behavior;
- bootstrap strategy for the first platform administrator;
- Web API requirements;
- future mobile application compatibility;
- audit/security event expectations;
- failure semantics;
- required unit, integration, contract, security, and architecture tests;
- provider alternatives, operational impact, migration, and rollback.

Provider candidates may be assessed, but TASK-033 must not silently commit the
platform to JWT, OAuth/OIDC, Keycloak, Auth0, Entra ID, or another technology
without documented justification.

## Deferred capabilities

The following remain valid future capabilities but are not selected as the next
blocking step:

- concrete authentication-provider implementation;
- tenant-scoped request-context evolution beyond the authority scope already enforced;
- richer role/permission management;
- administrator invitations;
- password or credential lifecycle;
- MFA;
- session management;
- refresh-token handling;
- Audit bounded-context integration;
- Billing/subscription enforcement.

These should build on the authentication baseline rather than precede it.

## Verification evidence

Repository inspection covered the authority provider, all onboarding
controllers and mappers, both bounded-context authorization contracts, runtime
composition, Problem Details, OpenAPI, tests, architecture rules, ADR-0002,
ADR-0004, TD-006, TD-008, and the Tenant Onboarding product contract.

Commands executed for TASK-032 are recorded after verification:

```text
corepack pnpm typecheck:tests                          PASS
corepack pnpm test:unit                                PASS — 7 files / 40 tests
corepack pnpm test:integration                         PASS — 8 files / 46 tests
corepack pnpm test:contract                            PASS — 8 files / 54 tests
corepack pnpm architecture:check                       PASS
corepack pnpm app:api:typecheck                        PASS
corepack pnpm service:identity:typecheck               PASS
corepack pnpm service:tenant-management:typecheck      PASS
corepack pnpm app:api:build                            PASS
corepack pnpm app:api:openapi                          PASS
corepack pnpm app:api:contracts:check                  PASS — 8 files / 54 tests
corepack pnpm test                                     PASS — 26 files / 163 tests
git diff --check                                       PASS
```

Architecture verification passed for workspace, exports, resolver, graph,
boundaries, cycles, and diagnostics. Residual manual review controls remain for
semantic business ownership in shared packages and runtime/network/database
access; neither is introduced or worsened by TASK-031.

## Completion decision

Post-authenticated-authority readiness: **READY**.

Authenticated onboarding authority is stable, tenant-scoped, fail-closed,
contracted, and regression-tested.

The next blocking capability is establishment of a real trusted authenticated
principal in normal runtime.

Selected next task: **TASK-033 — Authentication Provider Selection & Security
Baseline**.

TASK-032 is ready for human review and commit. TASK-033 has not started.
