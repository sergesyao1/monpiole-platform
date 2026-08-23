# TASK-013 — Tenant Onboarding Product Discovery & Approval

## Status

Planned.

## Objective

Define and obtain an implementation-ready product contract for the first
MonPiole Tenant Onboarding capability without selecting or implementing
unapproved technology.

## Owning Bounded Context

services/tenant-management

## Purpose

Transform Tenant Onboarding from an architectural placeholder into an
approved, bounded business capability with explicit actors, inputs,
invariants, lifecycle rules, security requirements, failure semantics,
and observable acceptance criteria.

## Scope

Define the minimum Tenant Onboarding capability required to establish a new
tenant in MonPiole.

The discovery must determine:

- actor initiating onboarding;
- authorization required to initiate onboarding;
- tenant identity and required business information;
- mandatory and optional inputs;
- uniqueness rules;
- lifecycle states;
- allowed state transitions;
- tenant activation conditions;
- idempotency semantics;
- duplicate-request behavior;
- validation failures;
- authorization failures;
- conflict/error behavior;
- correlation requirements;
- audit requirements;
- event requirements if any;
- bootstrap administrator/security context;
- observable outcomes;
- owning application surface;
- API needs;
- persistence needs;
- testing requirements.

## Product Questions To Resolve

At minimum answer:

1. Who may create a tenant?
2. Is onboarding self-service, administrator-driven, or both?
3. What minimum data identifies a tenant?
4. Which fields are mandatory?
5. What makes a tenant unique?
6. What is the initial tenant lifecycle state?
7. When does a tenant become active?
8. Can onboarding be retried safely?
9. How are duplicate requests handled?
10. What authorization context is required?
11. Is a bootstrap tenant administrator created?
12. What audit evidence is required?
13. Are domain/integration events required?
14. What errors are observable by the caller?
15. Which application surface owns the onboarding entry point?

## Lifecycle

Define an explicit minimal lifecycle if supported by approved product evidence.

Do not invent states merely for technical convenience.

If product evidence is insufficient, record the unresolved decision instead.

## Security and Tenant Bootstrap

Explicitly define:

- pre-tenant security context;
- actor authorization;
- tenant identifier creation;
- bootstrap administrator behavior;
- tenant-context availability before and after creation;
- isolation requirements;
- audit identity;
- correlation identifier requirements.

## Idempotency

Define:

- idempotency key requirements if applicable;
- retry behavior;
- duplicate submission semantics;
- replay behavior;
- expected response for an already-created tenant.

## API / Contract Requirements

Describe product-level contract needs only.

Do not select an HTTP framework, validation library, schema technology,
or persistence technology.

Identify:

- command/request intent;
- required inputs;
- successful outcome;
- domain failures;
- authorization failures;
- conflict/duplicate behavior.

## Persistence Requirements

Identify business information that must survive onboarding.

Do not create database schemas, tables, migrations, ORM models, or select a
database technology.

## Testing Requirements

Define product-level scenarios required for later automated tests.

At minimum consider:

- successful onboarding;
- missing mandatory information;
- duplicate tenant;
- unauthorized actor;
- idempotent retry;
- invalid lifecycle transition where applicable;
- bootstrap administrator behavior;
- tenant isolation expectations;
- audit evidence.

## Expected Output

Create:

engineering/product/tenant-onboarding-product-contract.md

The document must contain:

- status;
- owner;
- actors;
- objective;
- scope;
- out-of-scope;
- business inputs;
- invariants;
- lifecycle;
- authorization rules;
- bootstrap tenant/security context;
- idempotency behavior;
- failure semantics;
- audit/event requirements;
- application surface;
- API contract needs;
- persistence needs;
- test scenarios;
- acceptance criteria;
- unresolved product questions;
- approval gate.

## Backlog

If sufficient evidence exists to approve the capability, prepare a governed
BACKLOG.md candidate entry for Tenant Onboarding.

Do not promote it to a sprint unless product approval and acceptance criteria
are complete.

## Technology Classification

After the product contract is defined, classify implementation decisions as:

- ALREADY_APPROVED;
- REQUIRED_NOW;
- REQUIRED_LATER;
- NOT_REQUIRED_FOR_SLICE.

At minimum classify:

- TD-004 testing;
- TD-005 application framework;
- TD-006 API/validation/contracts;
- TD-008 persistence/migrations.

No technology may be selected by this task.

## Rules

- Product discovery only.
- Do not implement source code.
- Do not create API endpoints.
- Do not create database schemas or migrations.
- Do not install dependencies.
- Do not modify accepted ADRs.
- Do not infer unsupported business rules.
- Distinguish approved evidence, proposed behavior, and unresolved questions.
- Respect tenant-management ownership.
- Respect ADR-0002 for technology choices.

## Verification

Verify:

- TASK-012 readiness assessment was reviewed;
- tenant-management boundaries were reviewed;
- ADR-0004 tenant context was reviewed;
- ADR-0005 and ADR-0006 boundaries were reviewed;
- product/project evidence was reviewed;
- no implementation code was introduced;
- no technology was selected;
- final Git diff was reviewed.

## Acceptance Criteria

- [ ] Tenant Onboarding actor is defined or explicitly unresolved.
- [ ] Product inputs are defined.
- [ ] Business invariants are defined.
- [ ] Lifecycle behavior is defined.
- [ ] Authorization requirements are defined.
- [ ] Bootstrap security context is defined.
- [ ] Idempotency semantics are defined.
- [ ] Failure semantics are defined.
- [ ] Audit/event requirements are defined.
- [ ] Application surface is identified.
- [ ] API and persistence requirements are identified.
- [ ] Product-level test scenarios are defined.
- [ ] Observable acceptance criteria exist.
- [ ] Remaining product questions are explicit.
- [ ] Technology decisions are classified.
- [ ] No product implementation is introduced.

## Constraints

No implementation authorization is granted by this discovery task.

The resulting product contract requires explicit product-owner approval before
promotion into implementation work.

## Related

- TASK-012
- ADR-0002
- ADR-0004
- ADR-0005
- ADR-0006
- services/tenant-management
- BACKLOG.md
