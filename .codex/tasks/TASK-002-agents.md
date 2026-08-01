# TASK-002 — Agent governance

## Status

Completed.

## Sprint

Sprint 0.

## Objective

Define a maintainable repository-level governance model for human and AI agents working on MonPiole Platform. The outcome must make scope, safety, architecture, verification, and handoff expectations explicit without introducing business implementation.

## Scope

- Review the root AGENTS.md agreement for completeness and consistency with repository governance.
- Define placement rules for scoped AGENTS.md files.
- Establish how agent instructions relate to .codex playbooks, tasks, templates, checklists, and engineering standards.
- Document review and maintenance expectations for future agent guidance.

## Out of scope

- Product requirements, business features, or service implementation.
- Installation or configuration of external AI tools, models, or credentials.
- Automated agent execution, CI workflow changes, or repository-wide policy enforcement.
- Replacing existing instructions without explicit review and approval.

## Constraints

- Preserve root AGENTS.md as the repository-wide source of truth.
- Scoped guidance may only add local context; it must not weaken higher-level security or architecture rules.
- Keep tenant isolation, Clean Architecture dependency direction, API and event contracts, and service ownership explicit.
- Never include secrets, customer data, or environment-specific credentials.

## Acceptance criteria

- The relationship between root and scoped agent instructions is unambiguous.
- Guidance identifies pre-implementation inspection, planning, implementation, verification, and reporting steps.
- Guidance protects architectural boundaries and tenant context.
- The change is limited to governance documentation and remains reviewable in an atomic pull request.

## Verification

1. Confirm all instruction files remain consistent with root AGENTS.md.
2. Check that scoped instructions do not weaken security, tenancy, or architecture constraints.
3. Validate Markdown links and review the Git diff for unrelated changes.
4. Confirm that no agent guidance contains secrets or business implementation.

## Risks

- Excessive or conflicting instructions can make delivery inconsistent.
- Directory-specific guidance may become stale if it is not reviewed with architectural changes.
- Automation guidance may accidentally expand authority beyond task scope.

## Outcome

The repository root now contains the engineering contract in AGENTS.md. It defines the instruction hierarchy, required work sequence, architecture and DDD boundaries, multi-tenant and API-first rules, security, testing, coding standards, Git workflow, Definition of Done, forbidden practices, and reporting requirements.

## Next actions

1. Propose the agent-instruction hierarchy for review.
2. Add only approved governance files in a focused change.
3. Link final guidance from the relevant .codex playbooks and checklists.