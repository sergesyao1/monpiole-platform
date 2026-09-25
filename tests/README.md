# tests

## Purpose

Cross-cutting verification assets.

## Ownership

Quality Engineering owns this area and approves changes affecting its responsibilities.

## Conventions

Tests must be deterministic, tenant-aware, and runnable in automated delivery.

## Expected contents

Shared suites, test data, fixtures, and quality documentation.

## TD-004 executable baseline

The repository uses exact-pinned Vitest `4.1.11` with
`@vitest/coverage-v8` `4.1.11`. Root commands are stable, non-watch interfaces:

```text
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm test:contract
corepack pnpm test
corepack pnpm test:coverage
corepack pnpm typecheck:tests
```

Vitest projects isolate unit, HTTP integration, PostgreSQL persistence
integration, and contract discovery. Coverage currently reports the applicable
unit smoke fixture without an organization-wide threshold; it does not prove
security or tenant isolation. Testcontainers is installed and used with the
approved immutable PostgreSQL image for package and service-owned persistence
tests. Other TD-004-deferred tools remain uninstalled.

## Authentication security tests

Authentication tests use locally generated asymmetric keys and an in-process
JWKS resolver. The deterministic CI graph does not require Auth0 or Internet
availability. Any future provider smoke test must be a separate opt-in
deployment check using non-production credentials.
