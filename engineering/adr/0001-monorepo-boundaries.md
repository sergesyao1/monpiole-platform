# ADR 0001: Adopt monorepo boundaries for platform ownership

- Status: Accepted
- Date: 2026-08-01

## Context

MonPiole requires a repository structure that allows applications, bounded contexts, shared contracts, and infrastructure to evolve together without dissolving ownership boundaries.

## Decision

Use the repository areas apps/, services/, packages/, infrastructure/, engineering/, docs/, tests/, scripts/, and tools/ as canonical monorepo boundaries. Applications own composition and transport concerns. Services own bounded-context logic and data. Packages contain reusable domain-neutral assets. Infrastructure remains separate from application and service code.

## Consequences

Cross-service database access is prohibited. Shared packages must not become a shared domain layer. New deployable or reusable units must declare their owner and local conventions. Architectural exceptions require a superseding ADR.