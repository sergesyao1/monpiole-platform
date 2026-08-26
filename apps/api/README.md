# apps/api

## Purpose

Public API edge application.

## Ownership

API Platform owns this area and approves changes affecting its responsibilities.

## Conventions

Version external contracts, propagate tenant and correlation context, and keep business logic in services or packages.

## Expected contents

API routing, authentication adapters, OpenAPI delivery assets, and edge tests.

## TD-005 executable baseline

This workspace is the reference NestJS composition root. NestJS dependencies,
decorators, and HTTP abstractions stay within this outer application boundary;
service-owned Domain and Application layers remain framework-independent.

TASK-015 initially exposed only the operational `GET /health` endpoint and did
not select the later TD-006 transport-contract baseline.

## TD-006 executable contract baseline

TASK-017 adds a deliberately non-business `POST /api/v1/contract-baseline`
fixture. Canonical Zod schemas live under `src/contracts`; NestJS wrappers,
validation, response serialization, request-context transport handling, and
RFC 9457 adaptation live under `src/http`; OpenAPI 3.1 assembly and
normalization live under `src/openapi`.

`engineering/contracts/http/openapi.json` is the single generated JSON review
artifact. Run `corepack pnpm app:api:openapi` to reproduce it and
`corepack pnpm app:api:contracts:check` to verify schema and OpenAPI behavior.
No Swagger UI route is exposed.

This technical fixture does not authenticate or authorize callers, implement
Tenant Onboarding, create tenant authority, persist idempotency state, or add
business behavior. Transport values are explicitly mapped to plain values;
Domain and Application layers remain independent of Zod and NestJS tooling.

## TASK-031 authenticated authority boundary

All Tenant Onboarding mutation controllers resolve an authenticated authority
through an injected API-boundary provider. Missing authentication is rejected
with Problem Details 401 before a use case is called. The trusted authority is
mapped separately from tenant path context and target administrator identity;
service Application ports enforce operation grants and tenant scope before
reads or side effects. Normal runtime deliberately has no implicit provider and
therefore fails closed until an approved production authentication adapter is
selected and injected.

## TASK-033 authentication security baseline

ADR-0007 selects managed OpenID Connect with Auth0 Public Cloud as the reference
provider. The provider-neutral JOSE adapter requires an exact HTTPS issuer,
audience and JWKS source, `RS256`, signature, expiration, issued-at, maximum age,
and subject before producing `VerifiedAuthenticationContext`.

Provider claims do not grant tenant scope or business authority. MonPiole maps
`issuer + subject` to internal state and derives grants and tenant scopes there.
Invalid or unresolved credentials use 401 Problem Details; authenticated
authorities rejected by Application policy receive 403. Tokens and
Authorization headers must never be logged.

### TASK-040 runtime composition and browser readiness

The normal PostgreSQL runtime now composes `OidcAccessTokenVerifier`,
`OidcAuthenticatedAuthorityProvider` and Identity's durable
`PostgresExternalIdentityStore`. Startup requires the following public
configuration in addition to `DATABASE_*`:

```text
AUTHENTICATION_ISSUER=https://<tenant>.eu.auth0.com/
AUTHENTICATION_AUDIENCE=https://api.monpiole.local
AUTHENTICATION_JWKS_URI=https://<tenant>.eu.auth0.com/.well-known/jwks.json
AUTHENTICATION_JWT_ALGORITHM=RS256
AUTHENTICATION_CLOCK_TOLERANCE_SECONDS=30
AUTHENTICATION_MAX_TOKEN_AGE_SECONDS=900
API_ALLOWED_BROWSER_ORIGINS=http://localhost:5173
```

`API_ALLOWED_BROWSER_ORIGINS` is a comma-separated allowlist of exact HTTP(S)
origins. Missing, path-bearing or wildcard values fail startup. The browser
policy permits the required authorization, JSON, correlation, tenant and
idempotency headers; it never uses a wildcard origin.

A valid token whose `(issuer, subject)` is not linked, an inactive internal
identity and an invalid token all receive the same safe 401 response. This
prevents external identity enumeration; their internal verification/resolution
paths remain distinct. An authenticated authority rejected by an internal
grant or tenant-scope policy receives 403.

External linking is a provisioning operation, not login behavior. An approved
operations or future administration workflow must construct `ExternalIdentity`
and call `PostgresExternalIdentityStore.link` for an existing internal identity.
No public auto-provisioning endpoint exists. Never link by email or translate
Auth0 roles/scopes into MonPiole grants.

The frontend values `VITE_OIDC_ISSUER` and `VITE_OIDC_AUDIENCE` must exactly
match the API issuer and audience. For local browser use, Auth0 must also allow
the callback, logout and Web origin documented in `apps/web/README.md`.
