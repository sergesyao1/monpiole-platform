# TASK-003 — Project context

## Status

Completed.

## Sprint

Sprint 0.

## Objective

Establish the authoritative project context used by engineers and AI agents when planning and executing repository work. The context must describe confirmed platform invariants, current delivery scope, ownership boundaries, and decision constraints without inventing product requirements.

## Scope

- Maintain .codex/PROJECT_CONTEXT.md as the concise repository context source.
- Record the platform identity, current foundation scope, architectural invariants, and operating model.
- Define how missing or undecided product and technology information is handled.
- Link the context to the current sprint, AGENTS.md, engineering standards, and ADRs.

## Out of scope

- Business capabilities, customer workflows, or domain requirements.
- Selection of runtime, framework, package manager, cloud provider, or infrastructure vendor.
- Implementation of applications, services, APIs, events, databases, or deployment automation.
- Replacing architecture decisions with undocumented assumptions.

## Constraints

- Respect Domain-Driven Design, Clean Architecture, API-first integration, and explicit multi-tenant boundaries.
- Keep the context factual, concise, and version-controlled.
- Do not duplicate the full project README or engineering contract.
- Do not include secrets, credentials, customer data, or environment-specific values.
- Update the context when an approved ADR or sprint scope changes a durable assumption.

## Deliverables

- A reviewed .codex/PROJECT_CONTEXT.md.
- Clear references from project context to current sprint and governing instructions.
- A maintenance rule describing when context changes require review.

## Acceptance criteria

- The project context identifies the repository purpose and current scope.
- Architectural invariants and ownership boundaries are explicit.
- Undecided requirements and technologies are clearly marked as undecided rather than inferred.
- The context does not contain business implementation or sensitive data.
- Markdown links are valid and the change is reviewable as an atomic documentation change.

## Dependencies

- AGENTS.md.
- README.md.
- .codex/CURRENT_SPRINT.md.
- engineering/adr/ and engineering/standards/.

## Verification

1. Confirm the context matches the current sprint and accepted ADRs.
2. Check local Markdown links and headings.
3. Search for secrets, credentials, customer data, and invented product requirements.
4. Review the Git diff for unrelated changes.

## Risks

- Stale context can cause agents to make incorrect assumptions.
- Excessive duplication can create conflicting sources of truth.
- Unapproved technology choices may become accidental commitments if recorded imprecisely.

## Next actions

1. Review the existing project context against the next accepted ADRs.
2. Add only confirmed changes through a focused pull request.
3. Revalidate the context at the start of each sprint.
