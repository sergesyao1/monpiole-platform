# Project Context

This document is the durable context for MonPiole Platform. It records confirmed repository facts and architectural invariants so engineers and AI agents can work consistently across sessions. Temporary task details, credentials, customer data, and speculative requirements do not belong here.

## Vision

MonPiole Platform is the foundation for a modular, API-first, multi-tenant SaaS platform. The long-term aim is to let teams deliver tenant-aware capabilities while preserving domain boundaries, security, operability, and independent service ownership.

## Repository

- Official repository: https://github.com/sergesyao1/monpiole-platform
- Local workspace: C:\Projet\monpiole-platform
- Primary branch for the current foundation work: main
- Delivery model: monorepo, sprint-based, pull-request reviewed, and ADR governed.
- No business implementation is part of the foundation baseline.

Canonical areas:

- apps/ contains deployable client and edge applications.
- services/ contains independently owned bounded contexts.
- packages/ contains reusable, domain-neutral libraries and contracts.
- infrastructure/ contains runtime, provisioning, data, ingress, and observability assets.
- engineering/ contains ADRs, architecture, DDD, security, standards, and runbooks.
- docs/ contains published API, architecture, operations, security, and product guidance.
- tests/, scripts/, tools/, and .codex/ contain quality, automation, tooling, and delivery governance assets.

## Architecture

The platform follows Domain-Driven Design and Clean Architecture. Applications handle composition and transport concerns. Services own bounded-context behavior and persistence. Adapters depend on application and domain layers; domain code does not depend on frameworks, transport, persistence, or messaging.

Services integrate through explicit, versioned APIs and events. Direct cross-service database access and shared service persistence models are prohibited. Durable architectural choices are recorded in engineering/adr/ and accepted decisions are superseded rather than silently rewritten.

Tenant and correlation context are explicit at API, command, event, persistence, logging, and audit boundaries.

## Technology

No runtime, application framework, package manager, cloud provider, or deployment platform has been approved yet. Technology choices must be evaluated and recorded in ADRs before implementation.

The repository reserves operational boundaries for PostgreSQL, Redis, MinIO, Docker, Kubernetes, Terraform, Nginx, and monitoring. These names describe intended integration areas only; they do not represent configured or deployed infrastructure.

## Domain-Driven Design

- Use explicit ubiquitous language inside each bounded context.
- Keep aggregates, invariants, commands, queries, and domain events within their owning context.
- Publish integration events as facts, not internal persistence models.
- Keep context maps, terminology, and modelling decisions in engineering/ddd/ and related ADRs.
- Do not invent product capabilities, workflows, or domain requirements without approved scope.

## Security

Tenant isolation, least privilege, input validation, authorization before side effects, and auditable privileged actions are architectural requirements. Secrets, credentials, customer data, and production configuration must never be committed or logged. Security-sensitive changes require focused review and follow the process in SECURITY.md.

## Standards

AGENTS.md is the engineering contract for implementation and review. Contributions must preserve API and event compatibility, deterministic tests, idempotent asynchronous handlers, explicit dependencies, atomic Git changes, and documented operational impact. The normative catalogues are engineering/standards/ and engineering/security/.

## Roadmap

The durable sequence is:

1. Establish repository governance, standards, tooling, CI, and local development infrastructure.
2. Decide and record runtime, monorepo tooling, API contracts, event contracts, and tenancy strategy.
3. Bootstrap platform capabilities and operational controls through independently reviewable increments.
4. Introduce product bounded contexts only after requirements, ownership, contracts, and verification are approved.

The current detailed sprint scope belongs in .codex/CURRENT_SPRINT.md, not in this permanent context.

## Current status

The repository foundation is committed on main. The baseline contains repository structure, documentation, engineering governance, accepted foundation ADRs, and no business code. Runtime implementation and technology selection remain pending approved ADRs.

This file should change only when a durable repository fact, accepted architectural decision, or long-term roadmap invariant changes.