# services/identity

## Purpose

Identity and access bounded context.

## Ownership

Identity Team owns this area and approves changes affecting its responsibilities.

## Responsibilities

- Manage identity and access domain rules.
- Manage authentication and authorization decisions.
- Manage identity lifecycle and access-related workflows.

## Data Ownership

Owns identity records, credentials, authentication state, authorization data, and access policies.

## Boundaries

- Does not share credential storage directly with another service.
- Does not modify another service's business data.
- Exposes identity capabilities through explicit contracts.

## Conventions

Make authentication and authorization decisions auditable; never share credential storage directly.

## Expected contents

Identity domain, application use cases, adapters, migrations, and tests.

## TASK-024 bootstrap administrator slice

Identity owns the initial administrator identity, its tenant membership,
`TENANT_ADMINISTRATOR` role, and `PENDING_ACTIVATION` status. Tenant existence is
resolved through an Application port supplied by API composition; Identity does
not access Tenant Management persistence. This slice uses an atomic in-memory
adapter and deliberately implements no authentication, credential, invitation,
or broker behavior.

## TASK-026 tenant activation readiness

The public `HasActiveTenantAdministrator` Application query reports whether the
shared TASK-024/025 store contains an `ACTIVE` `TENANT_ADMINISTRATOR` membership
for a tenant. API composition adapts this capability to Tenant Management's
neutral readiness port; neither bounded context imports the other's
infrastructure.

## TASK-028 PostgreSQL persistence baseline

Identity owns the `identity.identities` and `identity.tenant_memberships`
PostgreSQL tables and their migrations under `services/identity/migrations`.
`PostgresIdentityStore` implements the existing bootstrap, activation, and
active-administrator query ports through tenant-scoped TD-008 transactions.
Database rows are explicitly rehydrated through the Domain and never exposed
to Application or HTTP code.

The database persists `PENDING_ACTIVATION` and `ACTIVE`, enforces the approved
`TENANT_ADMINISTRATOR` role, globally unique normalized email, one bootstrap
membership per tenant, and RLS tenant isolation. PostgreSQL uniqueness failures
are translated to the existing bootstrap conflict outcome. The in-memory store
remains available for isolated deterministic tests; runtime composition can
construct the same use cases with the exported PostgreSQL store and the shared
configured PostgreSQL pool.

## TASK-029 runtime composition

Normal API startup constructs one `PostgresIdentityStore` from the shared
`@monpiole/persistence` environment configuration. That instance serves
bootstrap, activation, and active-administrator readiness; there is no silent
in-memory fallback. The pool is closed through the Nest application lifecycle.
Tests may continue to inject the in-memory store explicitly.

## TASK-031 onboarding authority

Bootstrap and administrator activation commands carry a trusted authenticated
authority distinct from the target tenant and administrator. Both use cases
invoke the Identity-owned technology-neutral authorization port before tenant
or Identity persistence access. API composition supplies the grant and tenant
scope policy; Identity remains independent of NestJS and authentication
transport technology.

## TASK-033 external authentication ownership

Managed OIDC authenticates an external subject, while Identity remains owner of
the MonPiole identity, enabled state, tenant membership, and authority data.
External linkage is keyed by `issuer + subject`, never email, and provider roles
are not business grants. Durable external-link storage and controlled first
platform-administrator provisioning remain production deployment gates.

## TASK-040 durable external identity resolution

Identity owns `identity.external_identities`. Each row links the exact OIDC
`(issuer, subject)` pair to an existing internal identity and its tenant, records
`created_at`, and is protected by a unique pair constraint, composite foreign
key and forced RLS. Resolution first performs an exact controlled link lookup,
then enters the linked tenant's RLS transaction to load the ACTIVE identity and
its internal membership.

`PostgresExternalIdentityStore` is both the provisioning persistence boundary
and runtime resolver. A fresh instance resolves previously persisted links;
there is no in-memory fallback. Unknown links, pending/disabled identities and
unsupported memberships resolve to no authority. E-mail is never part of the
lookup key.

Provisioning remains an explicit trusted operation: construct a validated
`ExternalIdentity` for an existing internal identity and call `link`. TASK-040
does not expose a public endpoint, auto-link on first login or create privileged
users. Tenant administrator grants are assigned from the internal membership by
API composition, never from OIDC claims.

UI-002A exposes the operator command
`corepack pnpm --filter @monpiole/api identity:link-external`. It links only an
existing ACTIVE internal identity and requires exact issuer, subject, identity
ID and tenant ID values. It is not a public endpoint, first-login mechanism or
invitation workflow. Internal onboarding remains a distinct approved operation.

TASK-041 adds the read-only `PlatformIdentityInitializationState` port and a
narrow SELECT-only RLS policy for its PostgreSQL adapter. The one-shot operator
CLI refuses if any identity or membership exists, then invokes the existing
bootstrap and activation use cases. It never derives authority from Auth0 and
does not combine external linking with internal provisioning.
