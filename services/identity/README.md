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
