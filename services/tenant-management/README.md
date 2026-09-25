# services/tenant-management

## Purpose

Tenant lifecycle and configuration bounded context.

## Ownership

Tenant Platform Team owns this area and approves changes affecting its responsibilities.

## Responsibilities

- Manage tenant lifecycle and configuration.
- Manage tenant provisioning workflows.
- Publish tenant lifecycle events through versioned contracts.

## Data Ownership

Owns tenant records, tenant configuration, lifecycle state, and provisioning state.

## Boundaries

- Owns tenant lifecycle but does not own the business data of other Bounded Contexts.
- Does not modify another service's internal data.
- Publishes tenant lifecycle information through explicit versioned contracts.

## Conventions

Treat tenant context as mandatory and publish lifecycle events through versioned contracts.

## Expected contents

Tenant domain, provisioning workflows, adapters, and contract tests.

## TASK-023 Create Tenant slice

The first implemented slice creates only the tenant root in lifecycle state
`PENDING`. `POST /api/v1/tenants` is a pre-tenant operation: authorization is
represented by an Application port and production Identity integration remains
deferred. Tenant creation, its successful idempotency result, and the
`monpiole.tenant.tenant-created` version 1 Outbox record share one PostgreSQL
transaction. Broker dispatch, activation, bootstrap-administrator provisioning,
full onboarding, and Audit bounded-context integration are outside this slice.

## TASK-026 Activate Tenant slice

An existing tenant transitions from `PENDING` to `ACTIVE` only after an
Identity-owned Application capability confirms an `ACTIVE`
`TENANT_ADMINISTRATOR`. Tenant Management consumes that fact through a neutral
port. The PostgreSQL state update and
`monpiole.tenant.tenant-activated` version 1 Outbox record share a tenant-scoped
transaction; repeated activation returns the original `activatedAt` and emits
no duplicate event. Identity persistence, broker dispatch, and complete
onboarding remain outside this slice.

## Identity runtime composition support

Tenant existence for Identity bootstrap is exposed through the inward
`CheckTenantExists` application capability. Its PostgreSQL adapter uses the
tenant-scoped `tenant:exists` RLS policy. Identity and Tenant Management do not
import one another's persistence implementations; API composition adapts the
public capabilities.

## TASK-031 onboarding authority

Create Tenant and Activate Tenant enforce technology-neutral Application
authorization ports before opening persistence transactions. The authority
contains an authenticated actor and authority identity plus explicit grants;
tenant activation additionally requires the target tenant in authority scope.
API composition owns authentication resolution. No actor or authority field is
accepted from Tenant Onboarding request payloads.

## TASK-041 initial platform bootstrap probe

Tenant Management owns the read-only `PlatformTenantInitializationState` port
and PostgreSQL adapter. The operator-only CLI uses it to prove that no tenant
exists before invoking normal `CreateTenant` and `ActivateTenant` use cases. It
does not expose a generic bypass or public bootstrap endpoint.
