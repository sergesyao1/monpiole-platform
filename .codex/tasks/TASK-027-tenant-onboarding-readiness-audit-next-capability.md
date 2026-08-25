# TASK-027 — Tenant Onboarding Readiness Audit — Next Capability

## Status

DONE

## Objective

Assess the implementation readiness of the Tenant Onboarding workflow after
TASK-023 through TASK-026 and determine the next capability to implement based
on repository evidence.

## Audited workflow

The implemented Tenant Onboarding sequence is:

1. Create Tenant
2. Bootstrap Tenant Administrator
3. Activate Tenant Administrator
4. Activate Tenant

Resulting lifecycle:

Tenant:
- PENDING
- ACTIVE

Tenant Administrator:
- PENDING_ACTIVATION
- ACTIVE

## Evidence

Implemented slices:

- TASK-023 — Tenant Onboarding — Create Tenant
- TASK-024 — Tenant Onboarding — Bootstrap Tenant Administrator
- TASK-025 — Tenant Onboarding — Activate Tenant Administrator
- TASK-026 — Tenant Onboarding — Activate Tenant

Repository commits observed during the audit:

- c8a4a6c — feat(tenant): implement create tenant vertical slice
- 9ea3562 — feat(identity): bootstrap tenant administrator
- aa58cb6 — feat(identity): activate tenant administrator
- 2206606 — feat(tenant): activate tenant

## Architecture findings

### Tenant Management

Tenant Management owns:

- tenant lifecycle;
- tenant configuration;
- provisioning state.

Tenant creation persists the PENDING tenant and its tenant-created Outbox
record atomically in PostgreSQL.

Tenant activation transitions an existing tenant from PENDING to ACTIVE only
after the Identity-owned readiness capability confirms the presence of an
ACTIVE TENANT_ADMINISTRATOR.

The tenant state update and tenant-activated Outbox record are persisted
atomically.

Repeated tenant activation is idempotent and does not emit duplicate lifecycle
events.

### Identity

Identity owns:

- administrator identity;
- tenant membership;
- TENANT_ADMINISTRATOR role;
- administrator activation state.

Tenant Management does not access Identity infrastructure directly.

The HasActiveTenantAdministrator Application capability is exposed through a
neutral port and adapted by API composition.

This preserves the bounded-context boundary between Identity and Tenant
Management.

## Quality evidence

Audit baseline:

- Test files: 23 passed
- Tests: 140 passed / 140
- TypeScript test typecheck: PASS
- Architecture verification: PASS
- API typecheck: PASS
- API build: PASS
- git diff --check: PASS
- Working tree after audit: clean

Relevant test coverage includes:

- tenant creation;
- tenant activation;
- administrator bootstrap;
- administrator activation;
- API integration;
- PostgreSQL tenant persistence;
- tenant-created event contract;
- tenant-activated event contract;
- OpenAPI contract baseline;
- architecture boundaries.

## Readiness matrix

| Capability | Status |
| --- | --- |
| Create Tenant | READY |
| Bootstrap Tenant Administrator | READY |
| Activate Tenant Administrator | READY |
| Activate Tenant | READY |
| HTTP contracts | READY |
| Event contracts | READY |
| Tenant PostgreSQL persistence | READY |
| Architecture boundaries | READY |
| Identity durable persistence | GAP |
| Authentication | DEFERRED |
| Credentials | DEFERRED |
| Invitation workflow | DEFERRED |
| Broker dispatch | DEFERRED |
| Audit bounded-context integration | DEFERRED |

## Critical gap

Identity currently relies on an atomic in-memory persistence adapter for the
bootstrap administrator workflow.

Consequently, Tenant Management can durably persist an ACTIVE tenant while the
Identity evidence that allowed activation is not durable across application
process restarts.

This creates an inconsistent durability boundary:

- Tenant lifecycle state is durable.
- Initial administrator lifecycle state is not yet durable.

The existing Application ports and bounded-context boundaries are considered
sound. The gap is therefore persistence infrastructure, not domain ownership.

## Readiness verdict

READY WITH CONDITIONS

The Tenant Onboarding vertical workflow is functionally established and its
current architecture is suitable for continuation.

However, onboarding must not yet be considered production-capable because the
Identity state required by the workflow is not durably persisted.

## Decision

The next capability SHALL address durable Identity persistence before expanding
the onboarding workflow or starting dependent business capabilities.

Selected next task:

TASK-028 — Identity PostgreSQL Persistence Baseline

## TASK-028 expected scope

TASK-028 should provide durable PostgreSQL persistence for the Identity state
already required by Tenant Onboarding:

- administrator identity;
- tenant membership;
- TENANT_ADMINISTRATOR role;
- PENDING_ACTIVATION state;
- ACTIVE state;
- bootstrap administrator operation;
- activate administrator operation;
- HasActiveTenantAdministrator query.

Existing Application ports should remain stable where possible.

Identity must continue to own its persistence and Tenant Management must not
access Identity tables directly.

## Explicitly deferred from TASK-028

The following capabilities are not part of the persistence baseline:

- password authentication;
- login endpoint;
- JWT issuance;
- refresh tokens;
- password reset;
- MFA;
- invitation email delivery;
- OAuth/OIDC;
- broker dispatch;
- complete Audit bounded-context integration.

These require separate vertical slices or technology decisions.

## TASK-028 target proof

The durable onboarding path should be demonstrable as:

Create Tenant
→ PostgreSQL Tenant PENDING
→ Bootstrap Tenant Administrator
→ PostgreSQL Identity PENDING_ACTIVATION
→ Activate Tenant Administrator
→ PostgreSQL Identity ACTIVE
→ application restart / new composition instance
→ HasActiveTenantAdministrator = true
→ Activate Tenant
→ PostgreSQL Tenant ACTIVE

## Exit decision

TASK-027 is complete.

The repository is READY WITH CONDITIONS for the next Tenant Onboarding
capability.

Next:

TASK-028 — Identity PostgreSQL Persistence Baseline
