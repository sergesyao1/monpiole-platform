# Project Context

## Repository identity

MonPiole Platform is the official repository for a modular, API-first, multi-tenant SaaS platform. It is developed incrementally, sprint by sprint.

## Current scope

Sprint 0 establishes repository structure, engineering governance, and delivery documentation. Business requirements, product workflows, and domain-specific capabilities are intentionally not defined at this stage.

## Architectural invariants

- Domain-Driven Design and explicit bounded contexts.
- Clean Architecture with inward dependency direction.
- API-first and versioned event-contract integration.
- Explicit tenant and correlation context at every relevant boundary.
- Service-owned data with no direct cross-service database access.
- Test-first delivery, secure defaults, and documented architectural decisions.

## Operating model

Applications provide client and edge composition. Services own bounded-context implementation. Packages contain reusable domain-neutral assets. Infrastructure contains runtime and provisioning assets. Engineering and docs contain the governing records and published guidance.

## Decision policy

Do not infer unapproved product requirements or technology selections. Record durable technical choices in engineering/adr/ before implementation. Follow AGENTS.md and any nested instruction files for every change.