# Platform backlog

This file is the canonical register for candidate MonPiole Platform work that has not been committed to a sprint. An entry records enough confirmed context to support prioritisation; it does not approve implementation or reserve sprint capacity.

Committed work belongs in [.codex/tasks/](.codex/tasks/) and the applicable sprint scope in [.codex/CURRENT_SPRINT.md](.codex/CURRENT_SPRINT.md). Durable architecture decisions belong in [engineering/adr/](engineering/adr/). Do not use this backlog to replace those records or their review gates.

## Ownership

Platform Delivery owns the backlog process. Each candidate must name an accountable owner before it is added. The owner maintains factual scope, dependencies, risks, priority evidence, and links; ownership does not authorise delivery.

## Work categories

Use exactly one primary category so different kinds of work remain distinguishable without implying product requirements:

- Discovery: evidence gathering needed before scope or a decision can be approved.
- Architecture: boundaries, contracts, or durable design decisions.
- Platform: domain-neutral platform capabilities and repository foundations.
- Quality: test strategy, verification, and quality controls.
- Security: threat, control, assurance, and remediation work handled under [SECURITY.md](SECURITY.md).
- Operations: operability, support, recovery, and delivery concerns.
- Product: approved product work only; do not infer capabilities, workflows, or customer requirements.

## Priority

Priority expresses review order, not a delivery commitment:

| Priority | Meaning |
| --- | --- |
| P0 | Time-critical risk or prerequisite with documented evidence and an identified decision owner. |
| P1 | High-value or blocking candidate supported by confirmed dependencies and impact. |
| P2 | Useful candidate with no current blocking impact. |
| P3 | Candidate retained for later review; timing or value remains uncertain. |

Review priorities during planning and whenever their evidence or dependencies change. Stale or unsupported entries must be updated, marked `On hold`, or removed through review rather than silently treated as committed work.

## Candidate states

- `Candidate`: sufficiently described for prioritisation but not approved for a sprint.
- `Needs discovery`: missing confirmed information prevents prioritisation or bounded acceptance criteria.
- `On hold`: intentionally retained but blocked or not currently eligible for promotion.
- `Promoted`: approved through sprint planning and linked to both a task record and sprint scope.

## Entry format

Use the next sequential identifier in the form `BL-0001`. Copy this template beneath `Candidate register` and replace every placeholder. Do not add an item when its objective, ownership, or source is unconfirmed.

```markdown
### BL-NNNN — Concise factual title

- State: Candidate | Needs discovery | On hold | Promoted
- Priority: P0 | P1 | P2 | P3
- Category: Discovery | Architecture | Platform | Quality | Security | Operations | Product
- Owner: accountable role or approved team
- Source: link to the approved request, finding, decision, or other repository evidence
- Objective: outcome sought, without prescribing unapproved implementation
- Rationale: confirmed reason this work should be considered
- Scope: bounded work included in this candidate
- Out of scope: adjacent work explicitly excluded
- Dependencies: links or `None confirmed`
- Risks: known delivery, architecture, tenant, security, compatibility, or operational risks
- Acceptance criteria: observable conditions required for the candidate to be eligible for completion
- ADR impact: linked accepted/proposed ADR, `ADR required before promotion`, or `None identified`
- Task: `.codex/tasks/TASK-NNN-description.md` after promotion; otherwise `Not promoted`
- Sprint: linked sprint record and named scope after promotion; otherwise `Unscheduled`
- Delivery evidence: links to verification or review evidence after delivery; otherwise `Not delivered`
- Last reviewed: YYYY-MM-DD
```

Entries must contain no credentials, secrets, customer data, production configuration, or confidential payloads. Use repository-relative Markdown links for repository records.

## Promotion to sprint work

A candidate may become committed work only through explicit sprint-planning approval. Before changing its state to `Promoted`, confirm all of the following:

1. The objective, rationale, scope, exclusions, dependencies, risks, and acceptance criteria are current and factual.
2. An accountable owner and delivery priority are approved.
3. The work fits the proposed sprint goal and capacity and is added to the sprint scope.
4. A corresponding task record exists under [.codex/tasks/](.codex/tasks/) with bounded scope, acceptance criteria, dependencies, risks, and verification.
5. Architecture-affecting work links an applicable accepted ADR or has an ADR prepared for approval. Technology selection remains blocked until the decision required by [ADR-0002](engineering/adr/0002-technology-selection-gate.md) is accepted.
6. API, event, tenant, security, data-ownership, and bounded-context impacts are identified where applicable.
7. The backlog entry links the task and sprint records; those records link back to the backlog item when their governed format permits it.

Promotion does not itself authorise a technology choice, bypass security review, or prove delivery. If any criterion is missing, retain `Candidate`, `Needs discovery`, or `On hold` as appropriate.

## Delivery traceability

After delivery, keep the promoted entry as a compact traceability record. Link its task, sprint scope, applicable ADRs, and concrete verification evidence such as test output recorded in the task or pull-request review. A task status or documentation review must not be represented as technical enforcement evidence.

The minimum traceability chain is:

```text
backlog item -> sprint scope -> task record -> ADRs (when applicable) -> delivery evidence
```

## Candidate register

### BL-0001 — Tenant Onboarding

- State: On hold
- Priority: P1
- Category: Product
- Owner: Tenant Management
- Source: [Approved Tenant Onboarding product contract](engineering/product/tenant-onboarding-product-contract.md)
- Objective: Implement the first bounded Tenant Onboarding capability for administrator-driven creation and activation of an organization or real-estate agency tenant.
- Rationale: Product scope was explicitly approved on 2026-08-23 and Tenant Onboarding is the selected first MonPiole business slice.
- Scope: Administrator-driven tenant onboarding, minimum business inputs, generated tenant identifier, PENDING-to-ACTIVE lifecycle, mandatory bootstrap tenant administrator, explicit authorization boundary, idempotency, duplicate-conflict semantics, audit/correlation requirements, TenantCreated event, and backend API entry surface.
- Out of scope: Public self-service onboarding, subscription purchase, billing, payment, property publication, property management, rental management, advertising, and dedicated frontend onboarding UI.
- Dependencies: TD-004 testing decision; TD-005 application-framework decision; TD-006 API/validation/contracts decision; TD-008 persistence/migrations decision.
- Risks: Premature implementation before technology decisions could violate ADR-0002; tenant bootstrap must preserve authorization and isolation boundaries; partial onboarding must not expose an ACTIVE tenant before bootstrap administrator creation succeeds.
- Acceptance criteria: Approved product contract is preserved; required technology gates are approved; implementation task and sprint scope are created before promotion; successful onboarding returns tenant identifier, resulting lifecycle state, and bootstrap administrator identity/reference; duplicate, unauthorized, invalid, and idempotent-retry scenarios are verifiable.
- ADR impact: ADR-0002 technology gates required before promotion
- Task: Not promoted
- Sprint: Unscheduled
- Delivery evidence: Not delivered
- Last reviewed: 2026-08-23
