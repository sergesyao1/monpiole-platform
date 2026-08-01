# services/audit

## Purpose

Audit trail bounded context.

## Ownership

Security Engineering owns this area and approves changes affecting its responsibilities.

## Conventions

Store immutable, tenant-scoped records and never make audit writes optional for protected actions.

## Expected contents

Audit event consumers, retention policies, query adapters, and tests.

