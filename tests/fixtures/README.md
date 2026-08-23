# tests/fixtures

## Purpose

Shared test data fixtures.

## Ownership

Quality Engineering owns this area and approves changes affecting its responsibilities.

## Conventions

Use synthetic, non-sensitive data with explicit tenant ownership and lifecycle.

## Expected contents

Factories, canonical payloads, and seeded datasets.

## Baseline synthetic tenant fixture

`synthetic-tenant.ts` is the minimal TD-004 fixture pattern. Its factory requires
explicit tenant and correlation identifiers plus a deterministic sequence. It
returns immutable synthetic data and holds no shared mutable state. The pattern
is a fixture convention, not a tenant-testing framework and not a production
tenant model.
