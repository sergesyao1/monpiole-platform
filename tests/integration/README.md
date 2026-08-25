# tests/integration

## Purpose

Component integration tests.

## Ownership

Owning Engineering Team owns this area and approves changes affecting its responsibilities.

## Conventions

Use controlled dependencies and clean state between tests; cover persistence and adapters.

## Expected contents

Integration suites, test containers, and adapter fixtures.

PostgreSQL-specific proofs live with the infrastructure package at
`packages/persistence/tests/` and run through the `persistence-integration`
Vitest project. They require Docker and the pinned real PostgreSQL 18 image;
container unavailability is a failure, not a skip or substitution.
