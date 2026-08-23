# First product slice implementation readiness

- Assessment date: 2026-08-23
- Task: TASK-012
- Decision: **No first product slice is approved for implementation**
- Readiness: **BLOCKED on product clarification; technical implementation remains PENDING**

## Executive conclusion

The repository does not contain enough approved product evidence to select a
meaningful first implementation slice without inventing requirements. The
canonical backlog has no candidates, the product documentation contains no
capability definitions, and Sprint 0 expressly excludes business logic.

Tenant onboarding is the leading candidate for product clarification because
the roadmap places tenancy among the platform capabilities to establish before
business modules, and `services/tenant-management/README.md` assigns tenant
lifecycle, configuration, provisioning workflows, data, and lifecycle events to
one bounded context. This evidence establishes ownership and a capability area;
it does not establish an implementable workflow.

Accordingly, tenant onboarding is **not selected or approved here**. Product
Management and the Tenant Platform Team must first approve a bounded behavior
and observable acceptance criteria. Only then can the minimum technology
decisions be scoped under ADR-0002.

## Evidence reviewed

### Approved repository evidence

- `README.md` and `.codex/PROJECT_CONTEXT.md` define MonPiole as an API-first,
  multi-tenant platform and state that the foundation baseline has no business
  implementation.
- `ROADMAP.md` sequences identity, tenancy, event contracts, observability, and
  deployment standards before business modules.
- `.codex/CURRENT_SPRINT.md` defines Sprint 0 as foundation work without business
  logic. Its status text is stale relative to the now-present approved tooling
  decisions and implementation, so it is evidence of scope, not current
  technical readiness.
- `BACKLOG.md` is the canonical candidate register and contains no candidate
  work. It explicitly prohibits inferring product requirements.
- `docs/product/README.md` defines Product Management ownership but contains no
  product concepts or approved capabilities.
- ADR-0001 through ADR-0006 establish repository boundaries, technology gates,
  versioned contracts, explicit tenant context, Clean Architecture, DDD, and
  bounded-context/service ownership. They establish constraints, not a product
  workflow.
- Approved TD-001, TD-002, TD-003, and TD-009 establish Node.js with strict
  TypeScript and native ESM, pnpm workspaces, architecture dependency
  enforcement, and GitHub Actions CI for the existing architecture command.
  They do not approve product implementation tooling.
- Service and application README files define ownership and boundaries. No
  application or service contains runtime product source.

### Inference boundary

The following are reasonable candidates for clarification, not approved
requirements:

| Candidate | Repository evidence | Readiness conclusion |
| --- | --- | --- |
| Tenant onboarding | Roadmap names tenancy; tenant-management owns lifecycle, configuration, provisioning state, tenant records, and lifecycle events | **Leading candidate, requires product clarification** |
| Identity and access | Roadmap names identity; identity owns authentication, authorization, identity lifecycle, credentials, and access policy | Requires actors, credential model, flows, policy, and tenant relationship |
| Property or real-estate asset management | Mentioned only by TASK-012 as an area to evaluate | No approved product evidence |
| Property publication lifecycle | Mentioned only by TASK-012 | No approved product evidence |
| Subscription entitlement for publication | Billing ownership exists, but publication and entitlement behavior do not | No approved cross-context product evidence |
| Listing status or publication eligibility | Mentioned only by TASK-012 | No approved product evidence |

ADR-0006 includes illustrative event names such as `TenantCreated`; examples are
not treated as approved event contracts or behavior.

## Selected first product slice

**None.** Selecting a runtime behavior now would conflict with the empty
canonical backlog, the absence of product documentation, Sprint 0 scope, and the
instruction not to invent requirements.

The smallest candidate to take through clarification is a single
tenant-onboarding command owned by Tenant Management. Product approval must
define what that command actually does before it can become the selected slice.

## Candidate functional objective

Pending approval, the objective would be to let an approved actor initiate one
bounded tenant-onboarding operation and observe its result through one supported
application surface. This statement deliberately does not assume who the actor
is, what tenant data is required, which state transition occurs, or whether an
event is emitted.

## Product clarification required

Product Management and the Tenant Platform Team must approve at least:

1. the actor and business authority allowed to initiate onboarding;
2. the minimum input and validation rules, including uniqueness rules;
3. the initial and resulting tenant lifecycle states and invariants;
4. duplicate/retry behavior and stable business error outcomes;
5. whether onboarding is synchronous, asynchronous, or staged;
6. the application surface (public API, administration application, or another
   approved entry point);
7. authentication, authorization, and bootstrap-tenant rules;
8. required audit behavior and whether any lifecycle event is part of the slice;
9. the observable success and failure criteria; and
10. accountable product ownership, backlog promotion, and sprint approval.

## Proposed acceptance-criteria template

These are planning prompts, not approved acceptance criteria:

- An authorized `[actor]` can submit `[minimum approved tenant input]` through
  `[approved surface]`.
- The Tenant Management context enforces `[approved invariants]` and records the
  resulting `[approved lifecycle state]` in tenant-scoped, service-owned data.
- Missing, invalid, unauthorized, duplicate, and conflicting requests return
  the approved stable outcomes without a side effect.
- The operation propagates an explicit correlation identifier and the approved
  bootstrap/tenant context; it does not rely on hidden global tenant state.
- Security-relevant activity is audited according to the approved audit scope,
  without logging credentials, personal data, or tenant payloads.
- Retries behave according to the approved idempotency rule.
- Unit, integration, contract, tenant-isolation, authorization, and negative-path
  tests pass at the levels applicable to the approved design.

## Ownership and involved boundaries

### Owning bounded context

`services/tenant-management` is the only proposed business owner. Its domain and
application layers would own onboarding invariants and orchestration; its
infrastructure layer would own persistence adapters; its interfaces layer would
own service-facing adapters.

### Application surface

The surface is unresolved. If Product approves an external API, `apps/api` would
own edge routing, authentication adaptation, versioned delivery, tenant and
correlation propagation, while business rules remain in Tenant Management. If
the operation is privileged internal administration, `apps/admin` may be the
client surface, but an API boundary would still need explicit approval. No web,
mobile, gateway, or UI implementation is justified yet.

### Packages

No new package is required by current evidence. Contract or domain-neutral
primitives may use an existing package only after a concrete reuse need is
demonstrated. Tenant business models must not move into `packages/shared`,
`packages/core`, or `packages/types`.

### Other services

No other bounded context is included by default. Identity, Audit, Notifications,
Billing, Workflow, and Reporting must not be coupled into the first slice unless
approved acceptance criteria require an explicit versioned contract. Their
databases and internals remain inaccessible to Tenant Management.

## API and contract needs

If the approved surface is an API, the slice needs one explicitly versioned
contract defining authentication, authorization, tenant/bootstrap and
correlation context, request validation, response and error semantics,
idempotency/retry behavior, compatibility policy, and lifecycle expectations.
The internal persistence model must not be exposed as that contract.

No event contract is required unless approved product behavior needs an
asynchronous result or external reaction. If an event is required, its fact,
version, tenant/correlation metadata, delivery assumptions, compatibility, and
consumer retry semantics must be defined before implementation.

## Persistence needs

An onboarding behavior that survives process lifetime will require
Tenant-Management-owned persistence, tenant/bootstrap scoping, uniqueness and
concurrency behavior, transactional boundaries, migration and rollback, backup
and recovery expectations, and integration-test isolation. No database, driver,
ORM, schema tool, schema, or migration is approved by this assessment.

An in-memory implementation would not satisfy a durable onboarding capability
unless Product explicitly approves it as a non-production demonstrator; it must
not be used to evade the persistence decision gate.

## Testing needs

- Domain unit tests for approved lifecycle invariants and value rules, without
  network, filesystem, database, or ambient clock dependencies.
- Application tests for orchestration, authorization-before-side-effect,
  idempotency, and explicit context handling through ports.
- Persistence integration tests for isolation, uniqueness/concurrency,
  transactions, migrations, and rollback using synthetic tenant-safe data.
- API contract tests for version, validation, stable errors, authentication,
  authorization, and additive compatibility if an API is included.
- Tenant and security tests proving missing, invalid, and cross-tenant context
  cannot read or mutate tenant data.
- Event contract and consumer tests only if an event is approved.
- Existing architecture checks for dependency direction and boundary violations.

## Tenant and security implications

Onboarding has a bootstrap problem: ADR-0004 requires explicit tenant context,
while a not-yet-created tenant may not have a normal tenant identifier. The
approved product and security design must specify a non-ambient bootstrap scope,
the authority that grants it, how it becomes a tenant context, and how the action
is correlated and audited. Assuming a global or optional tenant would violate
ADR-0004.

Authorization must precede persistence or event side effects. Inputs are
untrusted and require runtime validation. Credentials, personal data, tenant
payloads, and confidential data must not enter logs or test fixtures. Least
privilege must apply to the service identity, persistence, migrations, and any
contract integration.

## Technology decision classification

Classification is relative to the candidate tenant-onboarding API slice and is
conditional on product approval.

| Decision area | Classification | Rationale |
| --- | --- | --- |
| Runtime, language, module system | `ALREADY_APPROVED` | TD-001 approves Node.js, strict TypeScript, and native ESM within its scope |
| Workspace/package management | `ALREADY_APPROVED` | TD-002 approves pnpm workspace/dependency management |
| Architecture dependency enforcement | `ALREADY_APPROVED` | TD-003 is approved and the local mechanism exists |
| CI execution for architecture validation | `ALREADY_APPROVED` | TD-009 approves the existing GitHub Actions architecture-validation adapter; additional product checks still need governed configuration |
| Application framework | `REQUIRED_NOW` | Required before installing or bootstrapping a framework for the approved API/application surface; TD-005 is unresolved |
| HTTP/API implementation | `REQUIRED_NOW` | Required before creating an endpoint; TD-006 is unresolved |
| Runtime/contract validation | `REQUIRED_NOW` | External input validation and contract representation are required; tooling is unresolved under TD-006/ADR-0002 |
| Persistence technology | `REQUIRED_NOW` | A durable onboarding capability requires service-owned persistence; TD-008 is unresolved |
| Schema/migration tooling | `REQUIRED_NOW` | Required with durable persistence and rollback; no tooling is approved |
| Unit testing | `REQUIRED_NOW` | Required before behavior implementation can meet Definition of Done; TD-004 is unresolved |
| Integration testing | `REQUIRED_NOW` | Required for persistence and API adapters; TD-004 is unresolved |
| Contract testing | `REQUIRED_NOW` | Required if the approved slice exposes an API; TD-004 and TD-006 are unresolved |
| Authentication integration | `REQUIRED_NOW` | Actor identity and trust-boundary behavior must be decided before the first side effect; concrete integration is unresolved |
| Authorization model | `REQUIRED_NOW` | Product/security approval must define who may onboard a tenant before implementation |
| Tenant-context propagation | `REQUIRED_NOW` | ADR-0004 approves the invariant, but bootstrap semantics and technical enforcement remain unresolved |
| Audit integration | `REQUIRED_NOW` | Required behavior and contract must be decided if onboarding is privileged/security-relevant; no cross-service coupling is assumed |
| Frontend/web framework | `NOT_REQUIRED_FOR_SLICE` | Prefer an API-only first increment if Product approves it; no UI evidence exists |
| Eventing/messaging | `REQUIRED_LATER` | Not required unless approved behavior includes an event or asynchronous provisioning |
| Observability technology | `REQUIRED_LATER` | Correlation/redaction requirements apply now, but concrete platform selection can wait until operational implementation |
| Container/runtime packaging | `REQUIRED_LATER` | Not needed for the smallest local implementation increment |
| Deployment platform | `REQUIRED_LATER` | Not needed for the smallest local implementation increment |
| End-to-end UI testing | `NOT_REQUIRED_FOR_SLICE` | No UI is included in the candidate |

`REQUIRED_NOW` does not authorize a selection. Each technology choice must pass
ADR-0002 with alternatives, compatibility, operations, security, and rollback
analysis before installation or implementation.

## Minimum unblock set

There are two sequential gates:

1. **Product gate:** approve and promote one bounded tenant-onboarding behavior,
   owner, surface, acceptance criteria, security model, and sprint scope.
2. **Technology gate:** after the product shape is known, approve only the
   decisions it requires: TD-004 testing, TD-005 application framework, TD-006
   HTTP/API and contract/validation representation, and TD-008 persistence plus
   schema/migration tooling. Authentication, authorization, bootstrap tenant
   context, audit, and CI test execution must be included in those decisions or
   in separately scoped decisions where their requirements justify it.

The product gate must precede technology selection because its answers may make
some technical decisions unnecessary or materially change their criteria.

## Deferrable decisions and scope

Unless product clarification proves otherwise, defer UI and frontend framework,
mobile support, gateway composition, notifications, billing/subscriptions,
property/listing/publication behavior, workflow orchestration, reporting,
message broker/event consumers, observability platform selection, containers,
deployment/orchestration, and cloud infrastructure.

Also defer reusable package extraction, physical service distribution, and any
cross-context event. A single-context implementation may remain physically
co-located while preserving the logical boundaries required by ADR-0005 and
ADR-0006.

## Recommended sequencing

1. Product Management and Tenant Platform clarify and approve the candidate,
   then create/promote a product backlog entry and sprint task with observable
   acceptance criteria.
2. Security, Identity, API Platform, and Audit owners review only the trust
   boundaries their approved behavior actually touches.
3. Prepare and approve the minimum ADR-0002-compliant technology decisions.
4. Define the versioned API contract and tests before implementation if an API
   surface is approved.
5. Implement domain and application behavior behind ports with unit tests.
6. Implement persistence and interface adapters with integration, contract,
   tenant, authorization, and negative-path tests.
7. Add the approved product checks to CI without weakening the existing
   architecture gate, then review documentation, security, and the full diff.

## Recommended next tasks

1. **Product discovery and approval: tenant-onboarding slice.** Produce approved
   terminology, actor, lifecycle transition, inputs, invariants, errors,
   idempotency, security/bootstrap context, audit/event scope, surface, acceptance
   criteria, ownership, backlog entry, and sprint approval.
2. **Minimum implementation technology decisions.** After product approval,
   evaluate TD-004, TD-005, TD-006, and TD-008 under ADR-0002, splitting decisions
   only where distinct requirements require separate ownership or rollback.
3. **Contract-first implementation task.** Only after both gates, create a task
   for the smallest approved API/domain/persistence increment and its tests.

## Readiness decision

TASK-012 has completed the requested discovery analysis and produced a governed
readiness record, but the first-slice selection acceptance criteria cannot be
met from current approved evidence. Recommended task status: **BLOCKED** (or
**PENDING PRODUCT CLARIFICATION** if the task workflow has no blocked state).
Do not begin product implementation or technology selection from this document.
