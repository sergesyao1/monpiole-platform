# TASK-024 — Tenant Onboarding Vertical Slice — Bootstrap Tenant Administrator

## Status

DONE

## Objective

Bootstrap the initial `TENANT_ADMINISTRATOR` identity and tenant membership for
an existing tenant through `POST /v1/tenants/{tenantId}/administrators/bootstrap`.

## Scope

- Identity-owned administrator identity and tenant membership.
- Tenant existence through an Identity Application port supplied by composition.
- Normalized unique email, `PENDING_ACTIVATION`, and `TENANT_ADMINISTRATOR`.
- Atomic in-memory Identity and membership persistence for this slice.
- Zod HTTP contract, Problem Details, OpenAPI, and automated tests.

## Explicit exclusions

- Login, JWT, refresh tokens, credential storage, password behavior, reset flows,
  invitation delivery, MFA, OAuth/OIDC, full RBAC, billing, subscriptions,
  brokers, and direct cross-context persistence access.

## Completion gate

Set `DONE` only after targeted tests, the full repository test graph,
architecture checks, test typecheck, API typecheck/build, OpenAPI drift, public
contract forbidden-term review, and Git diff checks all pass.
