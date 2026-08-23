# TASK-005 — Backlog governance

## Status

Completed.

## Sprint

Sprint 0.

## Objective

Define a durable backlog structure for MonPiole Platform so future work can be prioritised, scoped, and traced without introducing unapproved business requirements or implementation.

## Scope

- Establish the backlog record as the source for candidate work that is not yet committed to a sprint.
- Define the minimum information required for a backlog item: objective, rationale, scope, dependencies, risks, and acceptance criteria.
- Separate discovery, architecture, platform, quality, security, operations, and product work without inventing product content.
- Link promoted backlog items to task records, sprint scope, ADRs, and verification evidence.

## Out of scope

- Implementing backlog items.
- Committing work to a sprint without explicit planning approval.
- Defining business capabilities, customer workflows, or product requirements not yet approved.
- Replacing task records, ADRs, or the current sprint record.

## Constraints

- Backlog entries must remain factual, prioritised, and free of secrets or customer data.
- Every committed item must have a clear owner, bounded scope, and acceptance criteria.
- Architecture-affecting work must reference or create an ADR.
- Candidate work must preserve DDD, Clean Architecture, API-first, and multi-tenant invariants.
- Do not use the backlog to bypass security review, ownership, or delivery gates.

## Deliverables

- A reviewed backlog location and entry format.
- A prioritisation and promotion rule from backlog to sprint task.
- Traceability between backlog items, task records, ADRs, and delivery evidence.

## Acceptance criteria

- Unscheduled work is distinguishable from committed sprint work.
- Each backlog item has enough context for prioritisation without requiring conversation history.
- Promotion criteria and ownership are explicit.
- No unapproved business requirement or implementation is introduced.
- Markdown links and the Git diff are verified before completion.

## Dependencies

- .codex/CURRENT_SPRINT.md.
- .codex/PROJECT_CONTEXT.md.
- .codex/tasks/.
- engineering/adr/.
- AGENTS.md.

## Verification

1. Confirm backlog entries do not conflict with current sprint scope or accepted ADRs.
2. Check that each promoted item has a corresponding task record.
3. Validate Markdown links and scan for secrets or customer data.
4. Review the Git diff for unrelated changes.

## Risks

- An unprioritised backlog can become a substitute for planning.
- Vague entries can create hidden scope or conflicting interpretations.
- Stale priorities can misrepresent current architectural or operational needs.

## Completion verification

Verified on 2026-08-23.

Codex repository audit confirmed:

- canonical backlog record created: PASS;
- backlog entry format documented: PASS;
- prioritisation and promotion rules documented: PASS;
- ownership and traceability rules documented: PASS;
- unscheduled work is distinguished from committed sprint work: PASS;
- no unapproved product or technology work introduced: PASS;
- repository-relative Markdown links: PASS;
- sensitive-value scan: PASS;
- Git diff check: PASS.

Technical backlog enforcement remains PENDING until an applicable
technology decision is approved under ADR-0002.

Result: PASS.
## Next actions

1. Define the canonical backlog file or directory.
2. Add only confirmed candidate work with an accountable owner.
3. Promote backlog items through sprint planning and create linked task records.
