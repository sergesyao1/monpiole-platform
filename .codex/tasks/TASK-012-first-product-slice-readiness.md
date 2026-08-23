# TASK-012 — First Product Slice & Implementation Readiness

## Status

BLOCKED_PRODUCT_CLARIFICATION

## Objective

Determine the smallest approved MonPiole product slice that can become the
first real implementation increment, and identify only the additional technical
decisions required to implement that slice safely.

This task is discovery and implementation planning only.

## Context

The architectural foundation is now established and verified.

Completed technical baseline includes:

- bounded-context ownership and boundaries;
- data ownership rules;
- inter-service contract rules;
- package and application boundaries;
- deterministic architecture verification;
- GitHub Actions architecture validation;
- Node.js / strict TypeScript / native ESM baseline;
- pnpm workspace and dependency-management baseline;
- architecture dependency enforcement.

No arbitrary product implementation should begin until a bounded first slice
and its implementation prerequisites are identified.

## Scope

Review the current repository, backlog, project context, roadmap,
existing ADRs, approved technology decisions, service boundaries,
application boundaries, and available product/business documentation.

Determine:

- the smallest meaningful business capability suitable for first implementation;
- the bounded context that owns it;
- the application surface involved;
- required API contracts;
- required persistence capabilities;
- required testing capabilities;
- required authentication/tenant context dependencies;
- required UI or client surface where applicable;
- required technology decisions that remain unresolved;
- what can be deferred.

## Candidate Product Areas

Evaluate existing approved repository/product evidence for areas such as:

- identity and access;
- tenant onboarding;
- property / real-estate asset management;
- property publication lifecycle;
- subscription entitlement required for publication;
- listing status;
- publication eligibility;
- other explicitly documented MonPiole capabilities.

Do not invent product requirements.

If the repository does not contain sufficient approved evidence for a candidate,
mark it as requiring product clarification rather than assuming behavior.

## Product Slice Requirements

The selected first slice should preferably:

- be meaningful to the product;
- have one clear bounded-context owner;
- have observable acceptance criteria;
- exercise the approved architecture;
- remain small enough for a reviewable implementation increment;
- avoid unnecessary infrastructure decisions;
- allow automated tests;
- avoid coupling unrelated bounded contexts.

## Required Technical Decision Analysis

For the selected slice, determine whether decisions are required now for:

- application framework;
- HTTP/API implementation;
- persistence technology;
- schema/migration tooling;
- runtime validation / contract validation;
- unit testing;
- integration testing;
- contract testing;
- authentication integration;
- tenant-context propagation;
- frontend/web framework if the slice requires UI;
- other implementation tooling.

For each item classify it as:

- REQUIRED_NOW;
- REQUIRED_LATER;
- ALREADY_APPROVED;
- NOT_REQUIRED_FOR_SLICE.

## Expected Output

Create an implementation-readiness document under:

engineering/planning/

The document must contain:

- selected first product slice;
- product evidence supporting the selection;
- owning bounded context;
- involved applications/packages;
- functional objective;
- proposed acceptance criteria;
- architectural boundaries;
- API/contract needs;
- persistence needs;
- testing needs;
- tenant/security implications;
- unresolved technology decisions;
- minimum decision set required before implementation;
- deferrable decisions;
- recommended implementation sequencing;
- recommended next task(s).

## Rules

- Do not implement product code.
- Do not install new technology.
- Do not create database schemas or migrations.
- Do not create API endpoints.
- Do not create UI implementation.
- Do not modify accepted ADRs.
- Do not select unapproved technology.
- Distinguish product evidence from inference.
- Preserve existing bounded-context ownership.
- Respect ADR-0002 for any new technology decision.

## Verification

Verify that:

- current task inventory was reviewed;
- BACKLOG.md was reviewed;
- current sprint/project context was reviewed;
- ADR-0001 through ADR-0006 were reviewed;
- approved TD-001, TD-002, TD-003, and TD-009 were reviewed;
- service and application boundaries were reviewed;
- available product evidence was reviewed;
- no runtime implementation was introduced;
- no technology was selected without approval;
- final Git diff was reviewed.

## Acceptance Criteria

- [ ] A bounded first product slice is identified.
- [ ] Selection is supported by existing product evidence.
- [ ] Owning bounded context is identified.
- [ ] Acceptance criteria are proposed.
- [ ] Required application/API/persistence/testing needs are identified.
- [ ] Remaining technology decisions are classified.
- [ ] Minimum implementation unblock set is identified.
- [ ] Deferrable decisions are identified.
- [ ] Recommended next tasks are documented.
- [ ] No product code is implemented.
- [ ] No unapproved technology is selected.

## Constraints

Discovery and implementation planning only.

Implementation begins only after the required product and technology gates are
satisfied.
## Discovery result

Reviewed on 2026-08-23.

The implementation-readiness analysis is complete.

Result:

- architecture baseline: READY;
- first approved business slice: NOT YET AVAILABLE;
- leading clarification candidate: Tenant Onboarding;
- owning bounded context: services/tenant-management;
- product implementation: BLOCKED pending approved product behavior.

The repository currently lacks approved evidence defining:

- onboarding actor;
- tenant creation inputs;
- lifecycle states and transitions;
- authorization rules;
- bootstrap security context;
- idempotency behavior;
- failure/error semantics;
- audit/event requirements;
- application surface;
- observable acceptance criteria.

Technology decisions potentially required after product approval:

- TD-004: testing strategy/tooling;
- TD-005: application framework;
- TD-006: API/runtime validation/contracts;
- TD-008: persistence and migration tooling.

Result: BLOCKED_PRODUCT_CLARIFICATION.

## Related

- ADR-0001
- ADR-0002
- ADR-0003
- ADR-0004
- ADR-0005
- ADR-0006
- TD-001
- TD-002
- TD-003
- TD-009
- BACKLOG.md
