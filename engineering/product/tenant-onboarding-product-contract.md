# Tenant Onboarding product contract

- Status: **APPROVED**
- Owner: Tenant Platform Team (bounded-context owner); Product Management approval required
- Owning bounded context: `services/tenant-management`
- Discovery date: 2026-08-23
- Source task: `TASK-013`

## Evidence and decision labels

This contract uses three labels so architectural requirements are not mistaken
for approved product behavior:

- **APPROVED EVIDENCE** — required by the accepted ADR-0001 through ADR-0006
  baseline or an existing repository ownership statement.
- **PROPOSED** — a candidate behavior that requires Product, Security, or another
  named owner to approve it.
- **UNRESOLVED** — repository evidence is insufficient to define the behavior.

TASK-012 identifies Tenant Onboarding only as the leading product-clarification
candidate. It explicitly does not approve the slice. The roadmap identifies
tenancy as a platform capability, and Tenant Management owns tenant records,
configuration, lifecycle, and provisioning state. No approved repository
evidence defines the onboarding actor, business inputs, lifecycle, or entry
surface.

## Actors

- **UNRESOLVED:** the human or system actor allowed to initiate onboarding.
- **UNRESOLVED:** whether onboarding is administrator-driven, self-service, or
  supports both modes.
- **APPROVED EVIDENCE:** any initiating actor must have an authenticated,
  explicit identity and authorization must be evaluated before side effects.
- **APPROVED EVIDENCE:** Identity owns authentication, authorization data, and
  access policy; Tenant Management must not absorb those responsibilities.

## Objective

Establish one new tenant through a Tenant Management-owned operation whose
result is durable, isolated, correlated, authorized, and auditable, once the
unresolved product decisions in this document are approved.

## Scope

- Define the product intent and observable contract for establishing a tenant.
- Define the boundary between pre-tenant authorization and the resulting tenant
  context.
- Identify durable information, failures, audit evidence, contract needs, and
  later test scenarios without choosing implementation technology.

## Out of scope

- Source code, endpoints, schemas, migrations, dependencies, or technology
  selection.
- Authentication or credential implementation.
- Billing, subscription, property, publication, notification, reporting, or
  workflow behavior.
- UI journeys, physical deployment topology, and asynchronous provisioning.
- A sprint commitment or authorization to implement.

## Business inputs

### Required by architecture or contract traceability

- **APPROVED EVIDENCE:** authenticated actor identity and authorization context.
- **APPROVED EVIDENCE:** correlation identifier propagated through command,
  persistence, logging, audit, and any event boundary.
- **PROPOSED:** a caller-supplied idempotency key scoped to the authorized actor
  or other approved pre-tenant authority.

### Tenant business information

- **UNRESOLVED:** the minimum tenant identity data.
- **UNRESOLVED:** legal name, display name, registration identifier, locale,
  contact details, and any other mandatory or optional fields.
- **UNRESOLVED:** which business identifier, or combination of identifiers, is
  unique and the scope and normalization rules for that uniqueness.
- **UNRESOLVED:** whether bootstrap-administrator identity information is part
  of the request or established separately through an Identity-owned contract.

No tenant business field becomes mandatory or optional until Product approves
its meaning, validation, and necessity.

## Business invariants

- **APPROVED EVIDENCE:** Tenant Management owns the tenant record, lifecycle,
  configuration, and provisioning state; other contexts may not write them.
- **APPROVED EVIDENCE:** authorization is checked before any side effect.
- **APPROVED EVIDENCE:** resulting data access is scoped by explicit tenant
  context; hidden global or optional tenant state is prohibited.
- **APPROVED EVIDENCE:** public APIs and integration events, if approved, are
  explicit, versioned, additive-by-default contracts and do not expose internal
  persistence models.
- **PROPOSED:** one accepted idempotency key represents one immutable onboarding
  intent; reuse with different normalized business input is a conflict.
- **UNRESOLVED:** tenant uniqueness, required business data, lifecycle
  invariants, and activation conditions.

## Lifecycle

The repository supports the existence of tenant lifecycle state but supplies no
approved state names, initial state, transitions, or activation rule.

- **UNRESOLVED:** initial lifecycle state.
- **UNRESOLVED:** whether creation and activation are one operation or distinct
  transitions.
- **UNRESOLVED:** conditions required for activation.
- **UNRESOLVED:** allowed transitions and terminal states.

No lifecycle state is proposed merely to support a technical workflow. Invalid
transition behavior can be specified only after Product approves a lifecycle.

## Authorization rules

- **APPROVED EVIDENCE:** the entry boundary must authenticate the actor, resolve
  an explicit pre-tenant authority, and authorize onboarding before persistence,
  identity, audit, or event side effects.
- **APPROVED EVIDENCE:** least privilege applies to every participating service
  identity and contract.
- **UNRESOLVED:** permitted actor types, roles, permissions, delegations, and
  policy owner approval.
- **UNRESOLVED:** whether unauthorized callers receive a generic denial or a
  more specific observable response, subject to information-disclosure review.

## Bootstrap tenant and security context

- **APPROVED EVIDENCE:** a normal tenant context cannot be fabricated before the
  tenant exists. The request therefore needs an explicit, non-ambient pre-tenant
  authority approved by Security and Identity.
- **UNRESOLVED:** the kind of pre-tenant authority and how it is issued,
  validated, scoped, and revoked.
- **UNRESOLVED:** whether the tenant identifier is platform-generated or based
  on approved business input. It must be unique and immutable once issued, but
  its format is not selected here.
- **UNRESOLVED:** whether onboarding creates or links a bootstrap tenant
  administrator, which context initiates that work, and atomicity/compensation
  behavior across Tenant Management and Identity.
- **APPROVED EVIDENCE:** after successful establishment, downstream work must
  use the issued explicit tenant context; data and authority must not leak to
  another tenant.
- **APPROVED EVIDENCE:** audit identity and correlation must preserve the
  initiating actor and pre-tenant authority without logging credentials,
  personal data, or confidential payloads.

## Idempotency behavior

The following is a **PROPOSED** product contract and requires approval:

1. An onboarding request carries a non-secret idempotency key.
2. Repeating the same key with the same normalized intent returns the same
   successful tenant identity and lifecycle outcome without repeated side
   effects.
3. Reusing the key with different normalized intent returns an idempotency
   conflict and does not mutate the original tenant.
4. A request with a different key but a business identifier that violates the
   approved uniqueness rule returns a duplicate-tenant conflict and does not
   disclose unrelated tenant data.
5. Concurrent equivalent submissions have one durable outcome.

**UNRESOLVED:** key scope, normalization, retention period, replay response,
whether failed attempts reserve a key, and the approved tenant uniqueness rule.

## Failure semantics

The caller must be able to distinguish these product-level outcomes without
exposure of internal persistence or security details:

| Outcome | Required observable meaning | Decision status |
| --- | --- | --- |
| Invalid request | Mandatory or semantically invalid input; no side effects | Required category; field rules unresolved |
| Unauthenticated | No accepted actor identity; no side effects | Required category |
| Unauthorized | Actor lacks onboarding authority; no side effects | Required category; disclosure detail unresolved |
| Duplicate tenant | Approved unique business identity already exists; no new tenant | Required category; uniqueness unresolved |
| Idempotent replay | Existing result returned without repeated side effects | Proposed |
| Idempotency conflict | Same key represents different intent; no mutation | Proposed |
| Invalid transition | Requested lifecycle change is not allowed | Conditional on an approved lifecycle |
| Dependency unavailable | Required owned contract cannot complete the operation safely | Required if bootstrap spans contexts; retry semantics unresolved |
| Internal failure | No sensitive implementation detail exposed; correlation retained | Required category |

Transport protocol, status codes, error schema, and validation tooling are not
selected by this document.

## Audit and event requirements

### Audit

Onboarding is privileged and security-relevant, so **APPROVED EVIDENCE** requires
auditable evidence. The evidence must identify the action, initiating actor,
pre-tenant authority, correlation identifier, outcome, issued tenant identifier
when available, and occurrence time. It must not contain credentials,
confidential payloads, or unnecessary personal data.

**UNRESOLVED:** the exact audit event contract, retention, failure atomicity,
query visibility, and whether the Audit bounded context receives the evidence
synchronously or through an event. Audit owns audit records; Tenant Management
owns the business transaction.

### Domain and integration events

Tenant Management is responsible for publishing tenant lifecycle information
through versioned contracts, but repository evidence does not prove that the
first onboarding slice needs an integration event.

- **UNRESOLVED:** whether creation or activation produces a domain event.
- **UNRESOLVED:** whether another bounded context needs a versioned integration
  event in this slice.
- **APPROVED EVIDENCE:** if an event is approved, it is a fact rather than a
  command, carries tenant and correlation context, avoids persistence models,
  and its consumers are idempotent, observable, and retry-safe.

## Application surface

- **APPROVED EVIDENCE:** Tenant Management owns domain and application behavior.
- **UNRESOLVED:** the initiating application surface. Existing placeholders for
  `apps/admin`, `apps/api`, and `apps/api-gateway` do not select one.
- **PROPOSED:** use one contract-first API entry surface for the smallest slice,
  with composition/transport in an application and business rules in Tenant
  Management. Product and Application Engineering must approve the audience and
  owning application before implementation.
- No UI surface is required unless Product explicitly approves a UI journey.

## API contract needs

If an API entry surface is approved, its versioned product contract must define:

- an `Establish tenant` command intent;
- authenticated actor, explicit pre-tenant authority, correlation identifier,
  and the approved business and idempotency inputs;
- successful tenant identifier and approved lifecycle outcome;
- validation, authentication, authorization, uniqueness, idempotency, lifecycle,
  dependency, and internal failure categories;
- compatibility and lifecycle expectations, including replay behavior.

The contract must not prescribe a framework, protocol library, schema language,
validation library, or internal persistence representation.

## Persistence needs

The durable business record must preserve:

- the issued immutable tenant identifier;
- approved tenant identity and business fields;
- approved lifecycle and provisioning state;
- approved uniqueness keys in their normalized business form;
- idempotency intent and outcome metadata needed to honor the approved replay
  window;
- creation and transition timestamps needed by the approved lifecycle;
- correlation and actor references needed for traceability, subject to data
  minimization and retention rules.

Tenant Management owns this information. Identity credentials and authorization
data remain Identity-owned; immutable audit records remain Audit-owned. No
database, schema, table, migration, ORM, or storage product is selected here.

## Product-level test scenarios

Later automated verification must cover, using synthetic tenant-safe data:

1. successful authorized onboarding with one durable tenant and correlated
   audit evidence;
2. every approved mandatory field omitted or invalid, with no side effects;
3. duplicate approved tenant identity, with no second tenant and no information
   disclosure;
4. unauthenticated and unauthorized actors, with no side effects;
5. identical idempotent retry returning the original outcome without duplicated
   tenant, administrator, audit, or event effects;
6. idempotency-key reuse with different intent returning a conflict;
7. concurrent equivalent submissions producing one durable outcome;
8. every approved lifecycle transition and rejection of invalid transitions;
9. approved bootstrap-administrator creation/linking, retry, and failure
   behavior across context boundaries;
10. tenant isolation: one tenant authority cannot read, mutate, or replay another
    tenant's onboarding result;
11. audit evidence for success and each security-relevant failure, with required
    identity/correlation and prohibited sensitive data absent;
12. API and event compatibility if those contracts are approved;
13. dependency failure and safe retry behavior if onboarding spans contexts.

Scenarios depending on unresolved product decisions remain pending and cannot
be converted into definitive assertions yet.

## Observable acceptance criteria

The capability is implementation-ready only when reviewers can mark all of the
following true:

- [ ] Product approves the initiating actor, mode, minimum fields, optional
  fields, and uniqueness rule.
- [ ] Product approves lifecycle states, initial outcome, transitions, and
  activation conditions.
- [ ] Security and Identity approve pre-tenant authority and authorization.
- [ ] Product, Security, Identity, and Tenant Platform approve bootstrap
  administrator behavior and cross-context failure semantics.
- [ ] Product approves idempotency and duplicate behavior, including replay
  retention and observable result.
- [ ] Security and Audit approve audit content, delivery expectation, retention,
  and failure behavior.
- [ ] Product and affected context owners decide whether events are required.
- [ ] Product and Application Engineering approve one owning entry surface.
- [ ] Product approves caller-visible outcome and failure categories.
- [ ] The approved decisions make every applicable test scenario deterministic.

These criteria are not satisfied by this draft because the repository contains
no product-owner approval evidence.

## Technology decision classification

The classification is relative to a later durable, contract-first onboarding
implementation and grants no selection authority:

| Decision | Classification | Reason |
| --- | --- | --- |
| TD-004 testing | `REQUIRED_NOW` | Required before a behavior change can meet Definition of Done; no testing technology is selected here. |
| TD-005 application framework | `REQUIRED_NOW` if an API/application adapter is approved; otherwise `NOT_REQUIRED_FOR_SLICE` | The entry surface is unresolved, so the condition must be settled first. |
| TD-006 API/validation/contracts | `REQUIRED_NOW` if an external API is approved; otherwise `NOT_REQUIRED_FOR_SLICE` | Versioned contract and boundary validation are required, but representation and tooling are unselected. |
| TD-008 persistence/migrations | `REQUIRED_NOW` | Establishing a tenant requires durable Tenant Management-owned state; no persistence technology is selected here. |

Eventing technology is `NOT_REQUIRED_FOR_SLICE` unless Product approves an
integration event; if approved it becomes `REQUIRED_NOW` before event
implementation. UI, deployment, and container technology are
`NOT_REQUIRED_FOR_SLICE`. Every `REQUIRED_NOW` decision begins only after the
product approval gate and must satisfy ADR-0002.

## Unresolved product questions

1. Who may create a tenant, under which authority, and through which onboarding
   mode?
2. What minimum business data identifies a tenant; which fields are mandatory
   or optional; what is unique and how is it normalized?
3. What is the initial lifecycle state, what transitions exist, and what makes a
   tenant active?
4. What pre-tenant security authority is accepted and how does it become tenant
   context?
5. Is a bootstrap administrator created or linked; who owns orchestration and
   what happens on partial failure?
6. Are the proposed idempotency semantics approved, including key scope,
   retention, failed-request behavior, and replay response?
7. What exact audit evidence, retention, delivery, and failure guarantees are
   required?
8. Are domain or integration events required in the first slice?
9. Which application owns the entry point, who is its audience, and is an API
   the approved surface?
10. Which caller-visible validation and security details are safe to disclose?

## Approval gate

This document is a discovery draft, not an approved product contract. Product
Management must resolve and approve the product questions and acceptance
criteria. Tenant Platform must confirm bounded-context behavior; Security and
Identity must approve the bootstrap trust boundary; Audit must approve audit
requirements; Application Engineering must approve the entry surface.

Until that evidence is recorded, the capability remains
**BLOCKED_PRODUCT_CLARIFICATION**, no Product backlog candidate is justified,
and no sprint promotion, implementation, API, persistence, dependency, or
technology-selection work is authorized.

## Evidence reviewed

- `TASK-012` readiness assessment and `TASK-013` discovery task
- ADR-0001 through ADR-0006 (current accepted baseline only)
- `README.md`, `ROADMAP.md`, `BACKLOG.md`, and current Sprint 0 record
- `engineering/planning/first-product-slice-implementation-readiness.md`
- `engineering/decisions/technology-decision-inventory.md`
- Tenant Management, Identity, Audit, application, and product ownership
  documentation
## Product owner approval

Approved on 2026-08-23.

The first MonPiole Tenant Onboarding product slice is approved with the
following minimum behavior.

### Actor and onboarding mode

The initial onboarding flow is administrator-driven.

Only an authorized MonPiole platform actor may initiate Tenant Onboarding.

Public self-service onboarding is outside the scope of this first slice.

### Tenant definition

For this slice, a tenant represents an organization or real-estate agency
using MonPiole.

### Minimum business inputs

The onboarding request requires:

- organization name;
- responsible person's name;
- responsible person's email address;
- responsible person's telephone number;
- country.

MonPiole generates the tenant identifier.

### Uniqueness

The tenant identifier generated by MonPiole is unique.

The responsible person's primary email participates in duplicate detection
for this initial onboarding workflow.

### Lifecycle

The initial tenant state is PENDING.

The tenant becomes ACTIVE after successful creation of the bootstrap tenant
administrator.

Failure to complete the bootstrap administrator creation must not result in an
apparently active tenant.

### Bootstrap administrator

A first tenant administrator is mandatory.

Tenant onboarding creates or provisions the bootstrap administrator associated
with the newly created tenant.

The resulting tenant security context must be explicit.

### Authorization

Only an authorized MonPiole platform actor may execute this initial onboarding
capability.

Pre-tenant authorization and post-creation tenant authorization must remain
explicitly separated.

### Idempotency

The onboarding operation must support an explicit idempotency mechanism.

Replaying the same accepted onboarding request with the same idempotency key
must not create a second tenant.

### Duplicate behavior

A conflicting request for an already existing tenant must return an explicit
business conflict and must not create another tenant.

### Audit

At minimum, the following must be auditable:

- onboarding initiation;
- initiating actor;
- tenant creation;
- activation;
- onboarding failure.

Correlation information must be preserved across the operation.

### Events

A TenantCreated event is required after effective tenant creation.

Additional lifecycle or integration events are deferred until concrete
consumer requirements exist.

### Initial application surface

The first implementation surface is backend API only.

Dedicated web, mobile, or administration UI implementation is outside this
first slice.

### Observable successful outcome

A successful onboarding operation exposes at minimum:

- tenant identifier;
- resulting tenant lifecycle state;
- bootstrap administrator identity/reference.

### Explicitly out of scope

The first Tenant Onboarding slice does not implement:

- subscription purchase;
- billing;
- payment;
- property publication;
- property management;
- rental management;
- advertising;
- public self-service onboarding;
- dedicated frontend onboarding UI.

These capabilities remain separate product slices and bounded-context
concerns.

## Product approval gate

Product scope: **APPROVED**

Tenant Onboarding may now be promoted into the governed backlog.

Implementation remains blocked until all technology decisions classified
REQUIRED_NOW for this slice have been approved under ADR-0002.
