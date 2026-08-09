# TASK-004 — Current sprint

## Status

Completed.

## Sprint

Sprint 0 — Foundation.

## Objective

Maintain a durable, reviewable definition of the current sprint so engineers and AI agents can identify active scope, exclusions, completion criteria, and the next delivery boundary without relying on conversation history.

## Scope

- Maintain .codex/CURRENT_SPRINT.md as the authoritative current-sprint record.
- Record the sprint objective, in-scope foundation work, out-of-scope work, active tasks, and completion criteria.
- Link sprint scope to project context, AGENTS.md, task records, and accepted ADRs.
- Define a review cadence for advancing or closing the sprint.

## Out of scope

- Business features, product requirements, or domain workflows.
- Replacing task records with informal notes.
- Selecting technologies or changing architecture without an ADR.
- Recording temporary credentials, customer data, or machine-specific details.

## Constraints

- Keep sprint scope concise, factual, and version-controlled.
- Do not add work to the sprint without explicit scope approval.
- Every active task must have a task record under .codex/tasks/.
- Sprint changes must preserve DDD, Clean Architecture, API-first, and multi-tenant invariants.
- Closing a sprint requires verification evidence and an explicit list of remaining work.

## Deliverables

- A reviewed .codex/CURRENT_SPRINT.md.
- A clear relationship between sprint scope, task records, project context, and ADRs.
- A repeatable closeout and handoff record for the next sprint.

## Acceptance criteria

- The current sprint has one objective and an explicit scope boundary.
- In-scope and out-of-scope work are distinguishable.
- Active tasks and completion criteria are discoverable and internally consistent.
- No business requirements or temporary operational data are introduced.
- Markdown links and the Git diff are verified before closeout.

## Dependencies

- .codex/PROJECT_CONTEXT.md.
- AGENTS.md.
- .codex/tasks/.
- engineering/adr/.

## Verification

1. Confirm sprint scope matches the project context and accepted ADRs.
2. Confirm every listed active task exists and has a defined status.
3. Validate local Markdown links and scan for secrets or temporary data.
4. Review the Git diff for unrelated changes.

## Risks

- A stale sprint file can cause work to drift beyond approved scope.
- Overloading one sprint with architecture and implementation can reduce review quality.
- Unclosed tasks may be lost during sprint transition.

## Next actions

1. Review the active task list at sprint planning and closeout.
2. Update completion evidence as foundation work lands.
3. Create the next sprint record only after Sprint 0 closeout is approved.
