# TASK-081 - Post-Viewing Outcome Product Readiness Audit & Next Commercial Capability Definition

## 1. Executive Summary

**Status:** DONE

The durable next step after `PropertyViewingOutcome.PROCEED` should be a
**PropertyApplication** (French product label: **Candidature**).

The repository currently records initial interest, a scheduled interaction, and the
immediate outcome of that interaction. It does not record a formal decision by the
prospect to enter a commercial selection process. Creating a reusable
`PropertyClient` or a draft `PropertyContract` directly from `PROCEED` would erase
that distinction and prematurely enter the contractual model.

Recommended journey:

`PropertyInquiry -> PropertyViewing -> PropertyViewingOutcome.PROCEED -> PropertyApplication -> decision -> PropertyClient -> PropertyContract`

TASK-082 should implement a small tenant-scoped application aggregate, created only
from a completed viewing whose outcome is `PROCEED`, with a minimal review lifecycle.

## 2. Current Commercial Journey

The implemented journey ends at an intent signal:

1. A public visitor submits a `PropertyInquiry` for a published property.
2. An authorized operator acknowledges it.
3. One `PropertyViewing` may be scheduled for that inquiry.
4. A scheduled viewing may be completed or cancelled.
5. A completed viewing may receive one `PropertyViewingOutcome`.
6. The outcome starts as `FOLLOW_UP_REQUIRED` and terminates as `PROCEED` or `DECLINED`.
7. `PROCEED` has no downstream side effect.

This is evidenced by:

- `services/property-management/src/domain/property-inquiry.ts`
- `services/property-management/src/domain/property-viewing.ts`
- `services/property-management/src/domain/property-viewing-outcome.ts`
- `services/property-management/src/application/manage-property-viewing-outcomes.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-viewing-outcome-repository.ts`

## 3. Repository Evidence

### PropertyInquiry

`PropertyInquiry` captures a contact name, at least one contact channel, an optional
message, consent evidence, and a client-supplied idempotency key. Its states are
`NEW`, `ACKNOWLEDGED`, and `CLOSED`. Acknowledgement is allowed only from `NEW`;
closure is terminal and can occur from an open state.

It belongs to a property and tenant, but not to `PropertyClient`. Public submission
resolves the tenant from the public catalog host rather than accepting a client
tenant identifier. Persistence enforces tenant/property association, RLS, and
uniqueness of `(tenant_id, property_id, idempotency_key)`.

Evidence:

- `services/property-management/src/domain/property-inquiry.ts`
- `services/property-management/src/application/manage-property-inquiries.ts`
- `apps/api/src/http/properties/property-inquiries.controller.ts`
- `services/property-management/migrations/0019_property_management_baseline.sql`

### PropertyViewing

`PropertyViewing` belongs to one inquiry and one property. It has the lifecycle
`SCHEDULED -> COMPLETED | CANCELLED`, supports rescheduling only while scheduled,
requires a future start at scheduling time, and caps duration at four hours.

Scheduling requires an acknowledged inquiry. PostgreSQL locks the relevant rows for
state changes and enforces one viewing per inquiry with
`(tenant_id, inquiry_id)` uniqueness. Tenant-scoped foreign keys bind the viewing to
both its property and inquiry.

Evidence:

- `services/property-management/src/domain/property-viewing.ts`
- `services/property-management/src/application/manage-property-viewings.ts`
- `services/property-management/migrations/0020_property_management_baseline.sql`

### PropertyViewingOutcome

The outcome is separate from the viewing, belongs to the same tenant/property/viewing
chain, and contains an optional trimmed internal note of at most 2,000 characters.
It starts in `FOLLOW_UP_REQUIRED`; `PROCEED` and `DECLINED` are terminal. Replaying
the same decision is idempotent, while attempting the opposite terminal decision is
a domain conflict.

Creation locks and verifies a completed viewing. Updates lock the outcome row. A
composite foreign key `(tenant_id, property_id, viewing_id)` prevents cross-property
or cross-tenant attachment, and `(tenant_id, viewing_id)` permits only one outcome.
RLS is enabled and forced.

The four private operations are create, retrieve, proceed, and decline under
`/v1/properties/{propertyId}/viewings/{viewingId}/outcome`. They require authenticated
authority grants `RETRIEVE_PROPERTY_VIEWING_OUTCOMES` or
`MANAGE_PROPERTY_VIEWING_OUTCOMES`.

Evidence:

- `services/property-management/src/domain/property-viewing-outcome.ts`
- `services/property-management/src/application/manage-property-viewing-outcomes.ts`
- `apps/api/src/contracts/v1/properties/property-viewing-outcome.schema.ts`
- `apps/api/src/http/properties/property-viewing-outcomes.controller.ts`
- `services/property-management/migrations/0021_property_management_baseline.sql`

## 4. Existing Aggregate Assessment

### PropertyClient

`PropertyClient` is a reusable tenant-level real-estate client directory entry. It
contains identity/contact presentation data: `displayName`, optional email, and
optional phone number. It has no status, no property reference, no inquiry/viewing
provenance, and no requirement to have a contract.

It can therefore exist before or without a contract. Its global tenant directory,
search/list routes, and reuse by multiple contracts show that it represents a
recognized commercial counterparty, not an anonymous lead, a property-specific
candidate, or a record of post-visit intent.

Direct `PROCEED -> PropertyClient` conversion would:

- lose the property-specific commercial state and decision history;
- create client records for prospects that may later be rejected or withdraw;
- require an unclear deduplication rule based on mutable contact details;
- couple lead intake to a reusable master-data directory;
- make concurrent applications by the same person hard to represent;
- blur sale and rental qualification with contractual identity.

Evidence:

- `services/property-management/src/domain/property-client.ts`
- `services/property-management/src/application/manage-property-clients.ts`
- `apps/api/src/http/properties/property-clients.controller.ts`

### PropertyContract

`PropertyContract` is explicitly contractual. It requires a tenant-scoped property,
an existing tenant-scoped client, a contract type (`LEASE`, `MANAGEMENT`, `OTHER`),
a unique reference, and contract terms. Its lifecycle is
`DRAFT -> ACTIVE -> ENDED`, with cancellation from draft or active states.

Activation requires a start date; eligibility depends on property structural role
and transaction type. A contract therefore encodes selected counterparty and legal
or commercial terms, not merely willingness to continue.

Direct `PROCEED -> PropertyContract.DRAFT` skips qualification, selection, and client
recognition. It would also force contract type/reference/terms before those facts
necessarily exist. This is too large a domain transition.

Evidence:

- `services/property-management/src/domain/property-contract.ts`
- `services/property-management/src/application/manage-property-contracts.ts`
- `services/property-management/migrations/0017_property_client_contracts.sql`

## 5. Gap After ViewingOutcome.PROCEED

`PROCEED` says only that the prospect wishes to continue after the visit. The system
cannot yet preserve:

- the formal opening of a property-specific candidacy;
- review and commercial decision state;
- withdrawal independently of rejection;
- provenance from inquiry, viewing, and positive outcome;
- several competing prospects for one property;
- the later, deliberate conversion to a client and contract.

The missing concept is not another interaction log. It is a durable commercial
candidate record: a **PropertyApplication**.

## 6. Candidate Capabilities

### Option A - Direct PropertyClient Conversion

Simple mechanically and compatible with later contracts, but semantically lossy.
It produces false clients, lacks property-specific lifecycle, and creates premature
CRM/master-data coupling. Rejected.

### Option B - PropertyApplication / Candidate

Represents the formal intention to pursue one property after a positive viewing.
It preserves journey provenance, supports review and withdrawal, separates prospect
from client, and works for both sale and rental. Selected.

The aggregate name should be `PropertyApplication`; **Candidature** is the French UI
label. `PropertyCandidate` would describe a party rather than the commercial process
and would invite duplication of `PropertyClient` identity data.

### Option C - PropertyOffer / Proposal

An offer is appropriate when a party submits or receives concrete commercial terms,
especially price and validity. That is later than an intent to proceed and differs
between sale and rental. Deferred.

### Option D - PropertyReservation

A reservation blocks availability and commonly introduces expiry, deposits,
payments, and contention between prospects. `PROCEED` does not justify such a hold.
Deferred until after approval or a future offer.

### Option E - Direct Contract Draft

Uses an existing aggregate but requires a client and contractual facts too early,
and bypasses selection. Rejected.

## 7. Options Comparison

| Option | Domain clarity | Prospect/client separation | Sale + rental | V1 simplicity | Auditability | Debt risk |
| --- | --- | --- | --- | --- | --- | --- |
| Direct client | Low | No | Partial | High | Low | High |
| Application | High | Yes | High | High | High | Low |
| Offer | Medium now | Yes | High | Medium | High | Medium |
| Reservation | Low now | Yes | Partial | Low | High | High |
| Draft contract | Low now | No | Low with current types | Medium | Medium | High |

`PropertyApplication` best preserves domain meaning while adding only the minimum
state needed after `PROCEED`.

## 8. Selected Capability

**Recommended capability:** Property Application Management

**Product language:** Candidatures immobilières

Its responsibility is to record that the prospect associated with a completed,
positively decided viewing has formally entered review for that property. It is the
commercial bridge, not a CRM contact, reservation, offer, or contract.

## 9. Domain Boundary

The capability belongs in the existing `property-management` bounded context because
it coordinates property eligibility, the inquiry/viewing journey, concurrent
candidates, and eventual property client/contract creation.

V1 must not introduce a generic workflow engine or a cross-context CRM aggregate.
The application should reference journey identities rather than copy their complete
state. A small immutable applicant snapshot may be considered only if audit/legal
requirements demonstrate that changing inquiry contact data is possible; today it
is immutable, so references are sufficient.

## 10. Proposed Conceptual Aggregate

### PropertyApplication

- `applicationId`: independent UUID v4 identity.
- `tenantId`: authority-derived ownership boundary; never accepted from request data.
- `propertyId`: target property.
- `inquiryId`: origin and applicant/contact source.
- `viewingId`: qualifying completed viewing.
- `outcomeId`: exact positive decision provenance.
- `status`: minimal lifecycle state.
- `note?`: optional internal review note, bounded and non-public.
- `createdAt`, `updatedAt`: audit chronology.
- terminal timestamps such as `approvedAt`, `rejectedAt`, or `withdrawnAt`.
- trace metadata following current persistence conventions.

An independent identifier is necessary because the application has its own lifecycle
and may later be referenced by an offer, client conversion, reservation, or contract.

## 11. Lifecycle Recommendation

Minimal V1 lifecycle:

`SUBMITTED -> APPROVED | REJECTED | WITHDRAWN`

- `SUBMITTED`: application opened from `PROCEED`, awaiting a commercial decision.
- `APPROVED`: selected to advance; terminal in V1.
- `REJECTED`: manager declines it; terminal.
- `WITHDRAWN`: prospect no longer wishes to proceed; terminal.

`UNDER_REVIEW` is deliberately omitted: without assigned reviewers, documents, or a
qualification workflow it adds state without durable behavior. Review is implied by
`SUBMITTED`. Future capabilities may add richer assessment while preserving these
terminal meanings.

Creation preconditions:

- property exists in the current tenant;
- viewing exists for that same tenant and property;
- viewing is `COMPLETED`;
- exactly one outcome exists for it and is `PROCEED`;
- no application already exists for that viewing/outcome.

## 12. Relationships

- Tenant: mandatory isolation owner.
- Property: many applications may compete for one property.
- Inquiry: one V1 application maximum per inquiry because one viewing exists per inquiry.
- Viewing: exactly one source viewing per application; at most one application per viewing.
- ViewingOutcome: exactly one source outcome, which must be `PROCEED`.
- PropertyClient: absent at creation; future approved conversion may link one client.
- PropertyContract: absent at creation; created only through a later explicit step.

The database should retain all three journey references, despite their present
functional dependency, to enforce and query provenance without inference.

## 13. Multi-Tenancy & Security

Future implementation requirements:

- derive `tenantId` exclusively from authenticated `PropertyAuthority`;
- expose no tenant identifier in request DTOs;
- verify the whole property/inquiry/viewing/outcome chain in the same tenant;
- use composite tenant-scoped foreign keys;
- enable and force PostgreSQL RLS using `app.tenant_id`;
- grant runtime only `SELECT`, `INSERT`, and `UPDATE` for V1;
- never grant `DELETE`; terminal transitions preserve history;
- introduce least-privilege grants such as `CREATE_PROPERTY_APPLICATION`,
  `RETRIEVE_PROPERTY_APPLICATIONS`, and `MANAGE_PROPERTY_APPLICATIONS`;
- return tenant-mismatched resources as not found rather than revealing existence.

## 14. Persistence Considerations

Use an additive `property_applications` table in the next migration sequence with:

- a primary key on `application_id`;
- unique `(tenant_id, application_id)` for composite references;
- composite FKs to the property and to the complete viewing/outcome lineage;
- unique `(tenant_id, viewing_id)` and `(tenant_id, outcome_id)`;
- lifecycle and timestamp check constraints;
- a deterministic list index such as
  `(tenant_id, property_id, created_at DESC, application_id DESC)`;
- optional status index for operational queues;
- forced RLS and explicit runtime grants.

No uniqueness constraint should limit a property to one application. Competing
applications are valid until a later capability controls reservation, contract, or
availability.

## 15. API Considerations

Probable private `/v1` operations:

- `POST /v1/properties/{propertyId}/viewings/{viewingId}/application`
- `GET /v1/properties/{propertyId}/viewings/{viewingId}/application`
- `GET /v1/properties/{propertyId}/applications?status=&limit=&cursor=`
- `GET /v1/properties/{propertyId}/applications/{applicationId}`
- `POST /v1/properties/{propertyId}/applications/{applicationId}/approve`
- `POST /v1/properties/{propertyId}/applications/{applicationId}/reject`
- `POST /v1/properties/{propertyId}/applications/{applicationId}/withdraw`

Creation should be idempotent by viewing: identical replay returns the existing
application or a documented equivalent success; conflicting duplicate provenance
returns `409`. Cursors remain opaque. Zod request/response schemas, OpenAPI operation
IDs, Problem Details mappings, and generated contract snapshots must follow current
Property conventions.

## 16. Web UX Considerations

Today inquiries appear in `PropertyInquiriesSection` inside Property Workspace.
Acknowledged inquiries reveal `PropertyViewingPanel`; completed viewings reveal
`PropertyViewingOutcomePanel`. A `PROCEED` outcome is visible only as
**Souhaite poursuivre**, with no next CTA.

The future minimal UX should add **Créer la candidature** beside that state, guarded
by capability data or permissions. After creation it should show the candidature
status and valid transition actions with French loading, success, empty, forbidden,
not-found, conflict, and retry states.

Property Workspace is sufficient for creation and property-specific review in V1.
A global candidate queue is useful later but not required until cross-property daily
operations demonstrate the need. Existing loaded inquiry/viewing/outcome state must
remain visible if application loading or a transition fails.

Evidence:

- `apps/web/src/features/properties/PropertyInquiriesSection.tsx`
- `apps/web/src/features/properties/PropertyViewingPanel.tsx`
- `apps/web/src/features/properties/PropertyViewingOutcomePanel.tsx`

## 17. Concurrency & Idempotency

Application creation must run in one tenant transaction and lock the source viewing
and/or outcome before validating `COMPLETED` plus `PROCEED`. The unique viewing and
outcome keys are the final defense against concurrent duplicate creation.

Transitions must lock the application row (`FOR UPDATE`), evaluate the aggregate,
and persist atomically. Replaying the same terminal transition should be idempotent;
attempting a different terminal transition should return a conflict. Failures must
roll back all state and trace changes.

Approval must not yet claim exclusive property availability. Multiple applications
may exist, and even approval is not reservation, contract, or occupation. A later
transactional conversion capability must arbitrate any exclusivity required by the
property transaction type.

## 18. Compatibility With PropertyClient

The application must not require or create a `PropertyClient` in TASK-082. Inquiry
contact data identifies the applicant for review. After approval, a later explicit
conversion can resolve or create a reusable client and retain a link from application
to that client.

That later conversion needs an explicit duplicate-resolution policy; email or phone
alone is insufficient as a universal identity key. Keeping conversion separate
avoids embedding that unresolved policy in application creation.

## 19. Compatibility With PropertyContract

The application precedes contractual terms. Approval means commercial selection,
not legal commitment. Contract creation must remain explicit and continue to enforce
existing property eligibility, client existence, contract reference uniqueness, and
lifecycle rules.

For sale transactions, the existing contract type catalog has no sale-specific type;
TASK-082 must not broaden it. A future conversion task should decide whether an offer
or sale agreement is required before extending `PropertyContract`.

## 20. Deferred Capabilities

- automatic client conversion or identity deduplication;
- contract creation and sale contract modeling;
- offers, proposals, negotiation, and price terms;
- reservations, expiry, deposits, and payments;
- availability blocking and winner arbitration;
- KYC, documents, scoring, configurable pipelines, assignments, notifications;
- global CRM, messaging, electronic signature, accounting, commissions, analytics.

## 21. Risks

- “Application” may imply document-heavy rental screening; V1 must define it narrowly
  as formal post-viewing candidacy.
- Approval without conversion could be misread as property allocation; UX must state
  that no reservation or contract is created.
- Inquiry contact identity can duplicate an existing client; V1 must not silently
  merge records.
- Multiple approved applications may be operationally awkward, but prohibiting them
  now would introduce an undeclared availability rule.
- Compact existing source formatting makes evidence harder to review, but does not
  change the observed domain behavior.

## 22. Recommendation

Implement `PropertyApplication` next. It is the smallest durable object that records
formal post-visit progression without pretending that a prospect is already a client
or that terms are ready for contract. It preserves traceability, permits competing
candidates, and creates a stable boundary for later approval-to-client conversion.

## 23. TASK-082 Definition

### Recommended capability

`PropertyApplication`

### Future task

`TASK-082 — Property Applications & Commercial Decision Vertical Slice`

### Objective

Implement the complete tenant-scoped vertical slice for creating and managing a
property application after a completed viewing with a `PROCEED` outcome.

### Required scope

- Domain aggregate `PropertyApplication` with
  `SUBMITTED -> APPROVED | REJECTED | WITHDRAWN`.
- Creation only from the same tenant/property chain of Inquiry, completed Viewing,
  and `PROCEED` ViewingOutcome.
- One application per viewing/outcome; multiple applications per property.
- No automatic `PropertyClient`, `PropertyContract`, reservation, or availability
  mutation.
- Application ports, use cases, PostgreSQL repository, additive migration, composite
  tenant FKs, checks, indexes, forced RLS, and explicit runtime grants.
- Private create/retrieve/list/approve/reject/withdraw `/v1` endpoints, Zod DTOs,
  Problem Details, opaque cursor pagination, and OpenAPI documentation.
- Authority grants `CREATE_PROPERTY_APPLICATION`,
  `RETRIEVE_PROPERTY_APPLICATIONS`, and `MANAGE_PROPERTY_APPLICATIONS` (names to be
  confirmed against the repository naming convention during implementation).
- Property Workspace integration after a `PROCEED` outcome, with French labels,
  permission-aware CTAs, resilient loading/error states, and consistent refresh.
- Domain, application, HTTP, contract, PostgreSQL/RLS/concurrency, Web, architecture,
  and build tests.

### Acceptance emphasis

- tenant comes only from authenticated authority;
- cross-tenant and cross-property lineage is impossible;
- creation and terminal transitions are concurrency-safe and replay-safe;
- deterministic pagination preserves opaque cursor semantics;
- current Inquiry, Viewing, Outcome, Client, and Contract behavior stays compatible;
- the task does not implement later client conversion or contractual allocation.

## Audit Validation

- Repository state inspected at `ee3f879 feat(property): add viewing outcomes and follow-up`.
- No application code, migration, endpoint, grant, or Web workflow changed by TASK-081.
- Final validation results are recorded after report creation.
