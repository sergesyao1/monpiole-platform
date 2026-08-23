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

Vitest projects isolate discovery to `tests/unit`, `tests/integration`, and
`tests/contract`. Coverage currently reports the applicable unit smoke fixture
without an organization-wide threshold; it does not prove security or tenant
isolation. Testcontainers and all TD-004-deferred tools remain uninstalled.
