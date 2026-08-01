# ADR 0002: Require an ADR before selecting platform technology

- Status: Accepted
- Date: 2026-08-01

## Context

The foundation reserves areas for application, data, container, orchestration, provisioning, and observability concerns, but no runtime, framework, package manager, or cloud provider has been approved.

## Decision

Do not select or install a platform technology until its decision record identifies the problem, alternatives, compatibility implications, operational impact, security considerations, and migration or rollback approach.

## Consequences

Sprint 0 may define boundaries and documentation but does not introduce a framework, dependency lockfile, runtime code, deployable container, or cloud resource. Follow-up ADRs will be required for monorepo tooling, runtime, persistence, API contracts, eventing infrastructure, and deployment platform.