# TASK-083 - Post-Application Product Readiness Audit & Client Conversion Capability Definition

## 1. Executive Summary

**Status:** DONE

The smallest coherent next capability is an explicit, idempotent
**Property Application Client Conversion** operation.

An approved application should not create a client as a side effect of approval.
Instead, an authorized operator should explicitly convert the approved application.
The operation should atomically:

1. lock and verify the tenant-scoped application is `APPROVED`;
2. derive applicant identity/contact data from its originating inquiry;
3. create one existing-model `PropertyClient`;
4. persist a dedicated tenant-scoped conversion relation linking application and client;
5. return the canonical client on retries.

It must not create a contract or mutate property availability or occupation.

Recommended journey:

`Application.APPROVED -> explicit conversion -> PropertyClient -> explicit contract workflow`

## 2. Current Journey Endpoint

After TASK-082 the durable journey is:

`Public Property -> Inquiry -> Viewing -> ViewingOutcome.PROCEED -> Application.SUBMITTED -> APPROVED | REJECTED | WITHDRAWN`

The commercial endpoint is `PropertyApplication.APPROVED`. Technically this means
only that `PropertyApplication.status` is `APPROVED`, `decidedAt` is present, and the
decision trace is persisted. Commercially it means the tenant has selected the
application to progress. It is not yet counterparty creation or commitment.

Evidence:

- `services/property-management/src/domain/property-application.ts`
- `services/property-management/src/application/manage-property-applications.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-application-repository.ts`
- `services/property-management/migrations/0022_property_management_baseline.sql`

The approval use case calls only the application repository's locked update. It does
not invoke client, contract, availability, occupancy, reservation, billing, payment,
or any other downstream repository.

## 3. Repository Findings

### PropertyApplication

The aggregate has independent identity and tenant/property/inquiry/viewing/outcome
provenance. It starts `SUBMITTED` and terminates as `APPROVED`, `REJECTED`, or
`WITHDRAWN`. Replaying the same terminal decision is idempotent; a contradictory
terminal decision conflicts.

Creation derives upstream lineage transactionally and locks the outcome. Decisions
lock the application row. There is one application per viewing/outcome but multiple
applications per property.

The aggregate currently has no `clientId`, conversion timestamp, or converted state.
That absence is intentional: commercial decision and client conversion are distinct.

### API and Web

The private API exposes create, retrieve, list, approve, reject, and withdraw. The
Property Workspace shows applications and terminal French statuses. An approved
application currently has no downstream CTA or linked client.

Evidence:

- `apps/api/src/http/properties/property-applications.controller.ts`
- `apps/api/src/contracts/v1/properties/property-application.schema.ts`
- `apps/web/src/features/properties/PropertyApplicationsSection.tsx`
- `engineering/contracts/http/openapi.json`

### Authority

Applications use `RETRIEVE_PROPERTY_APPLICATIONS` and
`MANAGE_PROPERTY_APPLICATIONS`. Clients use `CREATE_PROPERTY_CLIENT` and
`RETRIEVE_PROPERTY_CLIENTS`; contracts use separate creation, retrieval, update, and
lifecycle grants. This supports a dedicated least-privilege conversion grant rather
than silently reusing contract authority.

## 4. Existing PropertyClient Analysis

`PropertyClient` is reusable tenant-level commercial master data. It contains:

- `clientId` and `tenantId`;
- mandatory normalized `displayName`;
- optional normalized email;
- optional normalized phone number;
- creation/update timestamps.

It has no lifecycle or status. It has no direct property, inquiry, viewing,
application, or contract reference. It can exist without a property or contract and
may be reused by several contracts.

The current create API accepts `displayName`, email, and phone from a private client
request. It is shape-compatible with inquiry contact data, but it is not sufficient
for conversion because:

- the caller could substitute applicant data rather than using authoritative inquiry data;
- it does not verify application approval;
- it records no application provenance;
- it provides no idempotency boundary per application;
- concurrent calls could create duplicate clients.

An approved applicant can safely become a `PropertyClient`; the existing client
aggregate does not need redesign. Conversion needs its own application service and
persistence relation around that aggregate.

Evidence:

- `services/property-management/src/domain/property-client.ts`
- `services/property-management/src/application/manage-property-clients.ts`
- `services/property-management/src/application/property-client-repository.ts`
- `apps/api/src/http/properties/property-clients.controller.ts`
- `services/property-management/migrations/0017_property_client_contracts.sql`

## 5. Existing PropertyContract Analysis

`PropertyContract` requires an existing tenant-scoped `PropertyClient`, property,
contract type, unique reference, and terms. Its types are `LEASE`, `MANAGEMENT`, and
`OTHER`; there is no explicit sale contract type. Its lifecycle is:

`DRAFT -> ACTIVE -> ENDED`, with `CANCELLED` available from draft or active.

Creation also checks property eligibility. Activation requires a start date. These
requirements demonstrate that a contract is a later legal/commercial commitment,
not a consequence of application approval or identity conversion.

Client conversion cannot legitimately derive:

- contract type, especially for a sale;
- contract reference;
- start/end dates;
- contractual notes or negotiated terms;
- whether a lease, management mandate, sale agreement, or future offer is appropriate.

Contract creation must therefore remain a separate explicit command after conversion.

Evidence:

- `services/property-management/src/domain/property-contract.ts`
- `services/property-management/src/application/manage-property-contracts.ts`
- `apps/api/src/http/properties/property-contracts.controller.ts`

## 6. Identified Commercial and Domain Gap

The platform can approve a property-specific candidate but cannot yet establish that
the candidate became a recognized reusable commercial counterparty while retaining
the source of that recognition.

The missing durable fact is:

> This approved PropertyApplication was explicitly converted into this PropertyClient.

That fact needs an explicit command and a persistent one-to-one conversion record.
It does not require a new Deal, Reservation, or Transaction aggregate.

## 7. Options Evaluated

### A. Automatic client creation on approval

**Rejected.** It appears simple, but couples two aggregate transitions and turns a
commercial decision into an irreversible master-data side effect. It makes approval
retries, permission separation, identity review, and failure recovery harder. It also
removes the operator's ability to distinguish approved-but-not-yet-converted work.

### B. Explicit Convert Application to Client operation

**Selected.** It preserves both boundaries, provides an observable conversion moment,
supports its own authority and idempotency, and can atomically create a client plus
provenance. It applies equally to rental and sale because it creates only generic
client identity.

### C. Create client and draft contract atomically

**Rejected.** The existing contract requires facts unavailable from the application,
and its contract types do not fully model sale. It couples identity recognition to
legal terms and would make partial retry semantics unnecessarily complex.

### D. Add Deal, Reservation, or Transaction aggregate

**Deferred.** None is needed merely to create a client. Reservation introduces
availability contention; Deal/Transaction introduces a broader pipeline without a
confirmed lifecycle. This is premature expansion.

### E. Reuse generic PropertyClient creation only

**Rejected.** It can create a suitable client shape, but cannot enforce approved
application eligibility, derive authoritative contact data, prevent duplicate
conversion, or retain provenance.

## 8. Options Comparison

| Option | Domain clarity | Idempotence | Traceability | Tenant safety | Lease + sale | Coupling | Expansion risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Automatic on approval | Low | Complex | Medium | Possible | Yes | High | Medium |
| Explicit conversion | High | Strong | High | Strong | Yes | Low | Low |
| Client + contract | Low | Complex | High | Strong | Weak today | Very high | High |
| New intermediate aggregate | Medium | Possible | High | Possible | Unknown | High | Very high |
| Generic client create | Low | None per app | None | Tenant only | Yes | Low | Medium debt |

## 9. Selected Capability

**Capability name:** Property Application Client Conversion

**French product wording:** Convertir en client

The capability is an explicit command in the `property-management` bounded context.
It coordinates existing aggregates and persists a conversion fact. The conversion
record is a relationship/audit entity, not a new commercial aggregate with its own
workflow.

## 10. Domain Boundaries

- `PropertyApplication` continues to own candidate selection state.
- `PropertyClient` continues to own reusable client identity/contact data.
- `PropertyApplicationClientConversion` owns immutable provenance and idempotency.
- `PropertyContract` remains independent and explicit.
- Property availability/occupation remain owned by their existing lifecycle.

The application need not gain a `CONVERTED` status. `APPROVED` remains the commercial
decision; presence of the conversion relation answers whether conversion occurred.
This avoids reopening TASK-082's terminal lifecycle.

## 11. Eligibility and Lifecycle Rules

Conversion eligibility:

- application exists under the route property and authenticated tenant;
- application status is exactly `APPROVED`;
- referenced inquiry exists in the same tenant/property lineage;
- no prior conversion exists for that application.

`SUBMITTED`, `REJECTED`, and `WITHDRAWN` return a conflict and create nothing.

The conversion relation is immutable and has no lifecycle. Its creation is the event.
No update or deletion operation is required.

Cardinality:

- one application converts to at most one client;
- one client may conceptually be linked to several applications over time;
- many clients/applications may concern the same property;
- V1 creates a new client for the approved application;
- contact equality must not be treated as verified identity or a unique constraint.

Supporting selection of an existing client is deferred until a reliable duplicate
resolution policy and UX exist. Silent email/phone matching is unsafe.

## 12. Idempotence and Concurrency Model

Execute conversion in one tenant-scoped PostgreSQL transaction:

1. `SELECT ... FOR UPDATE` the application under tenant and route property.
2. Validate `APPROVED`.
3. Read the authoritative tenant/property-scoped inquiry contact.
4. Look up the conversion row for the application.
5. If present, load and return its canonical client.
6. Otherwise create the `PropertyClient` and conversion row atomically.

A unique `(tenant_id, application_id)` constraint is the final duplicate safeguard.
Concurrent identical requests serialize on the application and return one client.
Any client insert failure rolls back the conversion, and any conversion insert failure
rolls back the client. Replays must not create additional clients.

## 13. Tenant Isolation and Security

Future implementation must:

- derive tenant exclusively from authenticated authority;
- accept no `tenantId`, inquiryId, viewingId, outcomeId, or clientId in the create body;
- use route property/application only as lookup keys, then derive all other relations;
- hide cross-tenant and cross-property records behind not-found semantics;
- use composite tenant-scoped foreign keys to application and client;
- enable and force RLS on the conversion table;
- use the established transaction-local `app.tenant_id` policy;
- expose no application/client PII publicly;
- grant no `DELETE` or `UPDATE` on immutable conversion records;
- require a dedicated `CONVERT_PROPERTY_APPLICATION_TO_CLIENT` authority grant.

The conversion operation should not be authorized merely because the caller may
approve applications or generically create clients. The cross-aggregate action is a
distinct business permission.

## 14. Persistence Design Recommendation

Add a dedicated table conceptually named:

`property_management.property_application_client_conversions`

Minimum columns:

- `tenant_id`;
- `application_id`;
- `client_id`;
- `converted_at`;
- `correlation_id`;
- `actor_id`.

Recommended constraints:

- primary or unique key `(tenant_id, application_id)`;
- unique `(tenant_id, client_id)` in V1 because conversion creates a new client;
- composite FK `(tenant_id, application_id)` to applications;
- composite FK `(tenant_id, client_id)` to clients;
- timestamp and non-empty audit checks consistent with repository conventions.

The unique client relation may be relaxed only if future explicit client linking
allows several applications to converge on one verified client. The domain rule is
one conversion per application; client reuse is conceptually valid, so code should
not assume permanent one-to-one identity beyond V1.

Why not add `application_id` directly to `property_clients`:

- clients are tenant-wide reusable master data, not application-owned children;
- a client may later originate from another channel or relate to several applications;
- nullable provenance columns would mix client identity with conversion audit;
- a relation evolves more cleanly toward explicit existing-client linking.

Indexes should support retrieval by application and reverse navigation by client.
RLS must be enabled and forced. Runtime privileges should be only `SELECT, INSERT`.

## 15. Future API Surface

Recommended private route:

`POST /v1/properties/{propertyId}/applications/{applicationId}/client`

This matches the existing property/application route hierarchy and expresses creation
of the client subresource resulting from the application.

Command semantics:

- request body is empty in V1;
- tenant comes from authenticated authority;
- property/application lineage and applicant data are server-derived;
- first success returns `201` with the existing `PropertyClient` response shape;
- idempotent replay returns the same client, preferably `200` or the repository's
  established canonical-create replay status, documented consistently in OpenAPI;
- ineligible state returns `409` Problem Details;
- missing/cross-property/cross-tenant application returns `404`;
- absent conversion authority returns `403`;
- authentication failure returns `401`.

For simple HTTP consistency, returning `200` for both first creation and replay is
acceptable only if MonPiole explicitly documents command semantics. Preferred V1:
`201` on creation and `200` on replay if the framework can expose the result kind
without weakening the application return type.

Probable retrieval addition:

`GET /v1/properties/{propertyId}/applications/{applicationId}/client`

It returns an envelope with `client: PropertyClient | null`, matching the existing
viewing outcome/application retrieval pattern. No new global client listing route is
needed; the current client directory already exists.

OpenAPI, Zod schemas, Problem Details and the canonical Web API client must be updated.

## 16. Minimal Web UX

In the existing Property Workspace applications section:

- an `APPROVED` application without a conversion shows **Convertir en client**;
- the action has loading, success, 401, 403, 404, conflict, and retry states in French;
- a converted application shows **Client créé** and a link/action to reach the
  existing client or client/contract workspace flow;
- the conversion CTA disappears after success and stays absent on reload;
- `SUBMITTED`, `REJECTED`, and `WITHDRAWN` never show it;
- loaded application data remains visible if conversion retrieval/action fails.

Contract creation must remain visibly separate. After conversion, the existing
contract workflow may offer **Créer un contrat** only as a distinct action requiring
its existing fields and grants.

No workspace redesign or global CRM screen is needed.

## 17. Property State and Contract Boundary

Conversion changes neither availability nor occupation. Client creation identifies a
counterparty; it does not allocate the property.

Future ownership of property state should remain event-specific:

- reservation/hold, if introduced, owns temporary exclusivity;
- active lease or completed sale may own availability/occupation transitions;
- merely approving or converting an application owns neither.

LEASE versus SALE differences begin at offer/contract terms, not generic client
identity. TASK-084 must remain transaction-type neutral.

## 18. Explicitly Deferred Capabilities

- automatic conversion during approval;
- linking to an existing client and duplicate resolution;
- email/phone identity matching or merging;
- automatic contract or offer creation;
- sale-specific contract modeling;
- reservation, exclusivity, availability, or occupation mutation;
- KYC, documents, guarantors, scoring, ranking, credit checks;
- payment, deposit, billing, invoicing, commissions;
- notifications, messaging, CRM, configurable pipeline or workflow engine.

## 19. Risks and Open Questions

- Creating a new client per converted application can duplicate a real person across
  properties. This is explicit V1 behavior, preferable to unsafe silent matching.
- The current client aggregate permits both email and phone to be absent. Inquiry
  requires at least one; derived conversion therefore produces a contactable client.
- Client detail navigation is less mature than property workspace navigation; TASK-084
  should reuse the current client retrieval surface without expanding into CRM.
- Existing contract types are not sale-complete. Conversion must not attempt to solve
  that unrelated boundary.
- Whether first conversion returns `201` and replay `200` must be fixed in the future
  API contract before implementation; both must return the same canonical client.

## 20. TASK-084 Definition

### Future task

`TASK-084 — Approved Property Application to Client Conversion Vertical Slice`

### Objective

Implement an explicit, tenant-safe and idempotent conversion of an approved
`PropertyApplication` into the existing `PropertyClient`, retaining immutable
application provenance and creating no contract or property-state mutation.

### Required implementation

- Application use case `ConvertApprovedPropertyApplicationToClient`.
- Dedicated immutable conversion repository/port.
- Transactional PostgreSQL adapter locking the application and deriving Inquiry data.
- Additive migration for `property_application_client_conversions`.
- Composite tenant-scoped foreign keys, uniqueness, indexes, forced RLS.
- Runtime table privileges limited to `SELECT, INSERT`.
- Authority grant `CONVERT_PROPERTY_APPLICATION_TO_CLIENT`.
- Private POST and retrieval routes under the application resource.
- Empty strict creation body; no tenant or lineage identifiers from clients.
- Existing PropertyClient response reuse, Zod/OpenAPI/Problem Details updates.
- Canonical Web client methods and minimal Property Workspace CTA/link state.
- No change to PropertyApplication terminal status.
- No automatic PropertyContract, availability, occupation, reservation, or payment.

## 21. TASK-084 Acceptance Criteria

1. Only an `APPROVED` application can convert.
2. `SUBMITTED`, `REJECTED`, and `WITHDRAWN` return conflict without writes.
3. The tenant comes only from authenticated authority.
4. Property, inquiry, viewing and outcome are derived from the stored application.
5. Client name/contact are derived from the tenant-scoped source inquiry.
6. One application produces at most one client.
7. Concurrent conversions return the same canonical client.
8. Client and conversion persist or roll back together.
9. Cross-tenant and cross-property access is indistinguishable from absence.
10. Conversion provenance is retrievable in both directions internally.
11. RLS is enabled and forced; runtime cannot update or delete conversions.
12. Public APIs and catalog projections expose no conversion or client PII.
13. Web shows conversion only for eligible, unconverted approved applications.
14. Web displays the linked client after success/reload with French resilient states.
15. No contract or property availability/occupation mutation occurs.
16. Domain/application, HTTP, OpenAPI, PostgreSQL/RLS/concurrency and Web tests pass.
17. Migration, typecheck, architecture, complete test suite and builds pass.

## 22. Repository Evidence Summary

Primary runtime evidence reviewed:

- `services/property-management/src/domain/property-application.ts`
- `services/property-management/src/application/manage-property-applications.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-application-repository.ts`
- `services/property-management/src/domain/property-client.ts`
- `services/property-management/src/application/manage-property-clients.ts`
- `services/property-management/src/domain/property-contract.ts`
- `services/property-management/src/application/manage-property-contracts.ts`
- `services/property-management/src/infrastructure/persistence/postgres/schema.ts`
- `services/property-management/migrations/0017_property_client_contracts.sql`
- `services/property-management/migrations/0022_property_management_baseline.sql`
- `apps/api/src/http/properties/property-applications.controller.ts`
- `apps/api/src/http/properties/property-clients.controller.ts`
- `apps/api/src/http/properties/property-contracts.controller.ts`
- `apps/web/src/features/properties/PropertyApplicationsSection.tsx`
- `engineering/contracts/http/openapi.json`

Context reports reviewed include TASK-069, TASK-080, TASK-081 and TASK-082. Runtime
code was treated as authoritative where reports and implementation could differ.

## 23. Validation

TASK-083 changes only this report. Final Git validation is recorded after creation.
