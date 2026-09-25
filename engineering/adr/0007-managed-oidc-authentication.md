# ADR-0007 — Managed OpenID Connect authentication

## Status

Accepted for the production authentication baseline.

## Context

MonPiole already authorizes a trusted `AuthenticatedOnboardingAuthority`, but
does not establish it from an Internet credential. Authentication must support
web and future mobile clients without making external token roles authoritative
for tenant access.

## Decision

Use a managed OpenID Connect provider. Auth0 Public Cloud is the reference
provider for the first production integration. The API validates asymmetric
`RS256` access tokens against an explicitly configured HTTPS issuer, audience,
and JWKS endpoint.

The provider establishes only `issuer + subject`. MonPiole maps that pair to an
internal identity and derives actor, authority, grants, memberships, and tenant
scopes from MonPiole-owned data. Email and provider role claims are not identity
or authorization keys. Provider types remain behind
`VerifiedAuthenticationContext`; authorization remains Application-owned.

Auth0 owns hosted credentials, recovery, refresh-token handling, MFA, attack
protection, token issuance, and signing-key rotation. MonPiole owns token
verification, external linkage, internal identity status, tenant membership,
authorization, Problem Details, and security audit outcomes.

## Alternatives

- Self-hosted OIDC (Keycloak): standards-compatible and controllable, but adds
  patching, hardening, backup, monitoring, scaling, and availability duties.
- Application-owned authentication: rejected because credentials, recovery,
  sessions, MFA, abuse protection, and signing keys would become MonPiole's
  responsibility without a demonstrated product advantage.

## Consequences

- Auth0 commercial terms, regional data location, and outage posture require
  production review. Public Cloud has no Africa region; EU is the initial
  candidate, subject to legal approval.
- Environments use separate provider tenants/applications and configuration.
- Access tokens default to a 15-minute maximum age (hard maximum 60 minutes)
  and 30 seconds clock skew (hard maximum 120 seconds).
- Unknown key IDs trigger controlled JWKS refresh; cache/outage failures remain
  fail-closed. No payload is used before signature and claim validation.
- MFA is required for privileged, tenant-administrator, and platform accounts.
- Refresh tokens use provider-managed rotation, reuse detection, revocation,
  and absolute expiry; the resource API never accepts or logs them.

## Exit strategy

The stable key remains the MonPiole identity ID. External links use
`issuer + subject`, so a second OIDC issuer can be linked during migration.
Avoid proprietary claims and export linkage/audit data before provider exit.

## Initial platform administrator

The first platform administrator is provisioned through a reviewed, auditable
operations procedure linking a verified `issuer + subject` to an internal
platform authority. No email lookup, self-registration, token role, or
client-supplied identifier grants platform authority. Durable platform-authority
provisioning is an explicit production deployment gate.
