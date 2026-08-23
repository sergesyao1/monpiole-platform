# services/audit

## Purpose

Audit trail bounded context.

## Ownership

Security Engineering owns this area and approves changes affecting its responsibilities.

## Responsibilities

- Maintain the audit trail for protected and auditable actions.
- Consume audit-related events.
- Enforce retention and tenant-scoped audit records.

## Data Ownership

Owns audit records, audit metadata, retention state, and audit query projections.

## Boundaries

- Does not own business transactions of other Bounded Contexts.
- Does not modify another service's business data.
- Consumes explicit contracts and events rather than internal service storage.

## Conventions

Store immutable, tenant-scoped records and never make audit writes optional for protected actions.

## Expected contents

Audit event consumers, retention policies, query adapters, and tests.

