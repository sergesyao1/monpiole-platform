# Engineering Contract

This file defines how engineers and AI agents work in this repository. It is the mandatory operating contract for implementation, review, and delivery. The README explains the platform; this document explains how to change it safely.

## Required working sequence

Before changing code, infrastructure, documentation, or automation:

1. Read this file and every applicable nested AGENTS.md file.
2. Inspect the affected module, its local README, engineering guidance, and related documentation.
3. Check existing ADRs before making an architectural choice.
4. State a concise plan for work with more than one meaningful step.
5. Implement only the approved scope and preserve unrelated work.
6. Verify the change with appropriate checks.
7. Report created, modified, and deleted files; verification; risks; and recommended next work.

When project context or sprint records are absent, do not invent requirements. Record the missing context as a risk and proceed only with confirmed scope.

## Architecture and boundaries

- Follow Clean Architecture: dependencies point inward. Domain and application layers must not depend on framework, transport, persistence, or messaging adapters.
- Applications own client and transport composition. Bounded-context code belongs to its owning service.
- Packages contain reusable domain-neutral capabilities only; they must not bypass bounded-context ownership.
- Every service owns its data. Direct cross-service database reads or writes are forbidden.
- Integrate services through explicit, versioned APIs or event contracts.
- Treat public APIs, event schemas, and shared package exports as compatibility commitments.
- Record durable architecture decisions in engineering/adr/. Accepted ADRs are immutable; supersede rather than rewrite them.
- Prefer the smallest design that satisfies the approved requirement.

## Domain-Driven Design

- Use explicit ubiquitous language inside each bounded context.
- Keep aggregates, invariants, commands, queries, and domain events inside their owning context.
- Do not merge distinct concepts merely because their data shapes are similar.
- Publish integration events as facts; never expose internal persistence models as contracts.
- Document durable context-boundary, terminology, or integration-flow changes in engineering/ddd/ and, when appropriate, an ADR.

## Multi-tenant and API-first rules

- Resolve and validate tenant context at every external trust boundary.
- Propagate tenant and correlation identifiers through requests, commands, events, persistence, logs, and audit records.
- Enforce authorization before side effects and scope data access by tenant.
- Define public API behavior before implementation: versioning, authentication, authorisation, validation, responses, errors, and lifecycle expectations.
- Evolve APIs and events additively whenever possible. Breaking changes require approval, migration guidance, and compatibility testing.
- Event consumers must be idempotent, observable, and safe to retry.

## Security

- Never commit secrets, tokens, private keys, credentials, customer data, or production configuration.
- Validate untrusted input at trust boundaries and apply least privilege to identities, data stores, queues, and deployments.
- Do not log credentials, personal data, tenant data, or confidential payloads.
- Treat dependency additions, authentication and authorization changes, data retention, and infrastructure exposure as security-sensitive changes requiring focused review.
- Report vulnerabilities through SECURITY.md; never disclose them through public issues or commits.

## Testing and verification

- Add or update tests with every behavior change and test at the lowest meaningful level.
- Unit tests cover domain and application behavior without network, filesystem, or clock-dependent state.
- Integration tests cover adapters, persistence, and controlled dependencies.
- Contract tests cover API and event compatibility; end-to-end tests cover supported public journeys when lower-level tests are insufficient.
- Use synthetic tenant-safe fixtures. Never use production data in tests.
- Tests must be deterministic and independently runnable.
- Do not claim validation that was not run. Report unavailable checks and the reason.

## Coding standards

- Prefer clear names, small cohesive units, explicit dependencies, and straightforward control flow.
- Apply SOLID when it reduces coupling and improves testability; do not add abstractions without a demonstrated need.
- Apply DRY to stable knowledge and behaviour, not superficial similarity.
- Apply KISS: choose the simplest maintainable solution consistent with the architecture.
- Keep generated output, build artefacts, dependency caches, and editor-specific files out of source control.
- Update contracts, documentation, and runbooks in the same change when they are affected.

## Git workflow

- Work on focused branches and keep commits atomic, reviewable, and reversible.
- Inspect Git status and existing changes before editing. Preserve work you did not create.
- Do not overwrite, discard, reformat wholesale, or delete unrelated files.
- Review the diff for accidental files, secrets, unrelated changes, and missing tests or documentation before requesting review.
- Do not force-push, reset shared history, or use destructive Git operations without explicit approval.

## Definition of Done

A change is done only when:

- The approved scope is implemented without unrelated changes.
- Architecture, DDD boundaries, API and event compatibility, tenant impact, and security implications have been considered.
- Relevant tests and checks have passed, or unavailable checks are explicitly reported.
- Documentation, contracts, ADRs, and runbooks are updated where required.
- The Git diff has been reviewed for correctness, secrets, and unintended files.
- The change is ready for owner review with a concise delivery report.

## Forbidden practices

- Business implementation without approved requirements or bounded-context ownership.
- Direct cross-service database access or shared persistence models.
- Hidden tenant context, unscoped data access, or unaudited privileged actions.
- Secrets, production data, or private credentials in source, fixtures, logs, or documentation.
- Breaking API or event changes without versioning and migration guidance.
- Framework-driven domain logic, cyclic dependencies, or infrastructure dependencies in domain code.
- Large unrelated refactors, silent rewrites, generated artefacts, destructive Git commands, fabricated test results, or skipped verification.

## Reporting

Every completed task report must include:

- Summary of the outcome.
- Created, modified, and deleted files.
- Verification performed and results.
- Risks, constraints, or checks not run.
- Recommendations and the next logical task.