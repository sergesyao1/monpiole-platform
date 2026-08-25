# TASK-033 — Authentication Provider Selection & Security Baseline

## Status

READY FOR REVIEW

## Objective

Select the production authentication strategy and establish a provider-neutral,
fail-closed access-token verification boundary before the first real-estate
vertical slice.

## Audit findings

- TASK-031 separates HTTP authentication from Application authorization.
- `AuthenticatedOnboardingAuthority` distinguishes actor, authority, grants,
  tenant scopes, path tenant, and target administrator.
- Identity owns PostgreSQL identities and memberships.
- Runtime previously injected no provider and therefore failed closed with 401.
- OpenAPI already declares Bearer authentication and Problem Details 401/403.
- No provider, validator, external identity link, credentials, sessions, or
  first-platform-administrator provisioning existed.

## Decision matrix

| Strategy | Security capability | Operations | Portability | Cost/scaling | Decision |
| --- | --- | --- | --- | --- | --- |
| Managed OIDC / Auth0 | Mature MFA, recovery, rotation, abuse protection | Lowest platform burden | OIDC limits lock-in | Vendor cost | Selected |
| Self-hosted OIDC / Keycloak | Strong when operated correctly | High HA, patching, backup burden | Strong | Staffing/infrastructure | Rejected now |
| Application-owned | Highest direct security responsibility | Highest | High code control | High hidden cost | Rejected |

ADR-0007 records the choice, trade-offs, and exit strategy.

## Implemented scope

- Provider-independent `VerifiedAuthenticationContext`.
- OIDC JWT verifier with exact HTTPS issuer/audience/JWKS, `RS256` allowlist,
  signature, expiration, issued-at/max-age, subject, and skew validation.
- Controlled remote JWKS cache, refresh cooldown, timeout, and fail-closed errors.
- Bearer adapter resolving only verified `issuer + subject` through an internal
  external-identity authority resolver.
- Missing, malformed, invalid, expired, unresolved, or disabled identities
  converge on safe 401. Valid authorities rejected by policy remain 403.
- Synthetic-key tests require no SaaS or network.

## Trust baseline

```text
Bearer token
  -> OIDC cryptographic verification
  -> VerifiedAuthenticationContext (issuer + subject)
  -> internal external-identity resolution
  -> MonPiole identity, membership, grants and scopes
  -> AuthenticatedOnboardingAuthority
  -> Application authorization
```

Email and token roles never identify or authorize the actor. Auth0 authenticates
the subject; MonPiole remains authoritative for enabled state, membership,
tenant scope, grants, and business authorization.

## Security baseline

- Access-token maximum age defaults to 15 minutes, configurable 1–60 minutes.
- Clock tolerance defaults to 30 seconds, configurable 0–120 seconds.
- Only `RS256` is initially supported. `alg=none`, arbitrary algorithms, wrong
  issuer/audience, invalid signature, missing claims, and expired/old tokens fail.
- Refresh tokens remain provider-managed and are never accepted by this API.
- Environments use separate provider tenants/applications and secret injection.
- MFA must be mandatory for tenant/platform administrators before production.
- Tokens, Authorization headers, secrets, private keys, passwords, and refresh
  tokens are excluded from logs, errors, traces, metrics, and audit payloads.
- Identity owns future authentication success/failure, disabled-account,
  external-link, MFA, recovery, and privileged-authentication audit facts.

## Exclusions and production gates

- No login UI, registration, social login, provider Management API, credential
  storage, session store, token issuance, invitation, or RBAC expansion.
- Durable external-identity linkage and the controlled first platform-authority
  provisioning runbook remain required before production traffic. Until
  composed, runtime continues to fail closed.
- Auth0 subscription, region/legal review, environment provisioning, MFA policy,
  alert routing, and secrets injection are operational gates.

## Test evidence

Focused unit coverage includes valid verification, issuer, audience, expiration,
signature, context mapping, malformed/missing credentials, unknown/disabled
mapping semantics, and fail-closed behavior. Existing integration and contract
suites cover authority mapping, 401/403, cross-tenant rejection, Bearer OpenAPI,
Problem Details, and authorization-before-side-effects.

Executed verification:

```text
corepack pnpm install --frozen-lockfile  PASS
corepack pnpm typecheck:tests            PASS
corepack pnpm app:api:typecheck          PASS
corepack pnpm test:unit                  PASS — 9 files / 49 tests
corepack pnpm test:integration           PASS — 9 files / 48 tests
corepack pnpm test:contract              PASS — 8 files / 54 tests
corepack pnpm architecture:check         PASS
corepack pnpm app:api:build              PASS
corepack pnpm app:api:openapi            PASS — no contract diff
corepack pnpm app:api:contracts:check    PASS — 8 files / 54 tests
corepack pnpm test                       PASS — 29 files / 174 tests
```

Git whitespace and working-tree evidence are recorded in the delivery report.

## Completion gate

The provider decision and executable cryptographic boundary are ready for human
review. Production enablement remains blocked on durable external-identity and
platform-authority provisioning plus provider/security operations approval.
Those gates do not justify additional onboarding work. The next implementation
should be the first Property vertical slice.
