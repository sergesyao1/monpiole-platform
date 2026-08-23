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

