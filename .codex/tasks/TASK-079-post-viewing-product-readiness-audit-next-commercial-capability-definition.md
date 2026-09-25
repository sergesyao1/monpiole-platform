# TASK-079 — Post-Viewing Product Readiness Audit & Next Commercial Capability Definition

## 1. Status and repository state

**Status: DONE**

Repository inspection was performed on `main` with a clean worktree.

- TASK-078 implementation commit: `e83ec8e feat(property): add property viewing management`.
- TASK-078 definition commit: `28a9817 docs(property): define property viewing capability`.
- TASK-076 implementation commit: `62e1880 feat(property): add public inquiries and lead intake`.
- No TASK-080 implementation, migration, endpoint or UI was created by this task.

## 2. Sources inspected

The audit verified current source rather than relying only on reports:

- Property, Inquiry, Viewing, Client and Contract domain models;
- corresponding application use cases and repository ports;
- Property authority grants;
- PostgreSQL schema and migrations through `0020`;
- private and public API controllers, Zod contracts and generated OpenAPI;
- Property Workspace inquiry and viewing components;
- domain, HTTP, contract, PostgreSQL and Web tests;
- TASK-077 and TASK-078 reports;
- Property Management and API documentation.

## 3. Actual supported journey

| Stage | Concept and lifecycle | Actor/surface | Tenant and persistence | Authorization |
| --- | --- | --- | --- | --- |
| Publish | `Property`: `DRAFT -> PUBLISHED` | tenant manager, private | tenant Property row, forced RLS | `PUBLISH_PROPERTY` |
| Discover | public catalogue projection of `PUBLISHED` Property | anonymous visitor, public | dedicated read role and restrictive catalogue RLS | host-to-tenant resolver |
| Inquire | `PropertyInquiry`: created `NEW` | anonymous visitor, public write | server-resolved tenant and published Property | no private grant |
| Acknowledge | `NEW -> ACKNOWLEDGED` | tenant manager, private Web/API | tenant-scoped locked Inquiry | `MANAGE_PROPERTY_INQUIRIES` |
| Schedule | `PropertyViewing`: created `SCHEDULED` from acknowledged Inquiry | tenant manager, private Web/API | tenant-scoped transaction, Inquiry lock, one Viewing per Inquiry | `MANAGE_PROPERTY_VIEWINGS` |
| Reschedule | `SCHEDULED -> SCHEDULED` | tenant manager, private Web/API | locked Viewing row | `MANAGE_PROPERTY_VIEWINGS` |
| Finish | `SCHEDULED -> COMPLETED` or `CANCELLED` | tenant manager, private Web/API | terminal persisted state | `MANAGE_PROPERTY_VIEWINGS` |

The structured public-to-commercial journey therefore ends at
`PropertyViewing.COMPLETED` or `PropertyViewing.CANCELLED`.

## 4. Capability classification

### A. Capabilities that exist end to end

- Property authoring, pricing, availability, publication and withdrawal;
- public catalogue/detail and inquiry submission;
- private inquiry listing, acknowledgement and closure;
- private viewing scheduling, retrieval, rescheduling, completion and cancellation;
- reusable Property Client directory;
- Property Contract creation and lifecycle;
- Property Workspace sections for inquiries, viewings, clients/contracts and property data.

### B. Partial capabilities

- Viewing records whether an appointment happened, but not its commercial result.
- Client and Contract are production-shaped private capabilities, but are manually
  initiated and disconnected from Inquiry and Viewing provenance.
- Availability records operational state but does not reserve a Property for a prospect.
- Pricing describes Property commercial terms, not a negotiated offer.

### C. Existing objects not connected to this journey

- `PropertyClient` is a reusable tenant contact directory entry.
- `PropertyContract` binds a Property to a PropertyClient and owns a
  `DRAFT -> ACTIVE -> ENDED | CANCELLED` contractual lifecycle.
- Neither references `PropertyInquiry` nor `PropertyViewing`.
- Neither captures the prospect's post-viewing decision.

### D. Capabilities that do not exist

- viewing outcome and post-viewing decision;
- prospect qualification or lost/proceeding disposition;
- offer, proposal or negotiation;
- rental application or sale application;
- reservation/booking and deposit/payment;
- explicit conversion from Inquiry prospect to PropertyClient;
- contract preparation originating from a commercial decision.

Searches found no equivalent concept under another domain name.

## 5. Post-viewing gap

`COMPLETED` means only that the scheduled appointment occurred. It does not say:

- whether the prospect remains interested;
- whether follow-up is required;
- whether the prospect declined;
- whether the manager should proceed toward an application, client conversion or offer;
- why the opportunity stopped.

The missing durable fact is a **commercial outcome of the completed viewing**.
Without it, creating a Client or Contract would erase the distinction between
attendance and commercial intent.

## 6. PropertyClient analysis

`PropertyClient` is a tenant-owned, reusable contact record with server identity,
display name and optional email/phone. It has no lifecycle beyond creation, no
Property association, and no Inquiry or Viewing reference.

It is created manually through `POST /v1/property-clients`, listed with opaque
keyset pagination and retrieved privately. PostgreSQL provides tenant scoping,
RLS and stable identity. The Web supports directory selection for contracts.

It can represent a contractual party or reusable customer contact, but the
current model does not identify it specifically as prospect, tenant or buyer.
It must not be treated as proof of post-viewing interest.

**A completed viewing should not directly or automatically create a
PropertyClient.** Conversion must follow an explicit commercial decision and
must include deliberate duplicate/contact handling in a later slice.

## 7. PropertyContract analysis

`PropertyContract` is a tenant-owned agreement between one Property and one
existing PropertyClient. It supports types `LEASE`, `MANAGEMENT`, `OTHER` and
states `DRAFT`, `ACTIVE`, `ENDED`, `CANCELLED`.

Creation validates Property and Client in the current tenant. Lease eligibility
checks Property transaction/structure. Draft terms can be updated; activation,
ending and cancellation are explicit locked transitions. APIs, OpenAPI, RLS,
pagination and Workspace controls exist.

It does not represent a prospect, inquiry, viewing, offer or application. It has
no provenance link to any acquisition journey.

**A completed viewing should not directly or automatically create a
PropertyContract.** Attendance is insufficient contractual intent, and the
required client, decision, application/offer and transaction-specific terms may
not yet exist.

## 8. Candidate capabilities

| Candidate | Value and dependency fit | Main risk | Decision |
| --- | --- | --- | --- |
| Viewing Outcome / Follow-up | closes the immediate gap with a small explicit decision | becoming a CRM if notes/stages expand | **select** |
| Prospect Qualification | useful before/after viewing at scale | premature scoring/taxonomy and unclear ownership | defer |
| Property Offer / Proposal | advances sale/rental negotiation | requires decision, pricing variance and acceptance rules | defer |
| Property Application | coherent for long-term rental | not universal for sale, hotel or short stay | defer |
| Property Reservation | valuable for short stay/hotel | requires inventory, expiry, capacity and payment semantics | defer |
| Client Conversion | connects the reusable directory | conversion criteria and deduplication need an explicit decision | defer |
| Contract Preparation | reuses Contract drafts | jumps over interest/application/offer and requires a Client | defer |

## 9. Selected next capability

### Canonical name

**Property Viewing Outcome & Follow-up**

### Business purpose

Record the tenant manager's durable post-visit disposition: follow up, proceed,
or stop. This turns a completed operational appointment into an explicit
commercial decision without creating a generic CRM.

### Ownership and relationships

- Primary actor: authorized tenant manager.
- Bounded context: Property Management, because the outcome exists specifically
  for a Property viewing and controls progression in its real-estate journey.
- Property: immutable tenant-scoped reference, derived through the Viewing.
- Inquiry: traceable through the Viewing; not duplicated as a mutable contact.
- Viewing: exactly one outcome, and only when `COMPLETED`.
- Client: no V1 FK and no automatic creation.
- Contract: no V1 FK and no automatic creation.

This comes first because every later candidate needs to know whether the
prospect proceeds, declines or still needs follow-up.

## 10. Minimum V1 domain model

### Aggregate root: `PropertyViewingOutcome`

- `outcomeId`: server-generated UUID;
- `tenantId`: derived from authenticated authority;
- `propertyId`: derived and immutable;
- `viewingId`: immutable;
- `status`: `FOLLOW_UP_REQUIRED | PROCEED | DECLINED`;
- optional `note`: private, trimmed, maximum 2,000 characters;
- `createdAt`, `updatedAt`;
- optional `decidedAt` for terminal states;
- persistence audit: actor and correlation identifiers.

### Invariants

- referenced Viewing belongs to the same tenant and Property;
- Viewing must be `COMPLETED`, never merely scheduled or cancelled;
- at most one Outcome exists per Viewing;
- creation may record any of the three statuses;
- only `FOLLOW_UP_REQUIRED` may transition to `PROCEED` or `DECLINED`;
- `PROCEED` and `DECLINED` are terminal in V1;
- terminal status requires `decidedAt`; follow-up status forbids it;
- note is optional and carries no public PII duplication;
- replay of the same terminal decision may be idempotent;
- a different terminal decision returns conflict;
- concurrent creation yields one winner through lock plus uniqueness.

No score, assignee, reminder, probability, pipeline stage or arbitrary metadata
belongs in V1.

## 11. Intended business flow

```text
Inquiry NEW
  -> ACKNOWLEDGED
  -> Viewing SCHEDULED
  -> Viewing COMPLETED
  -> Outcome FOLLOW_UP_REQUIRED
       -> PROCEED
       -> DECLINED
```

An Outcome may also be created directly as `PROCEED` or `DECLINED` when the
decision is already known.

- Creation prerequisite: completed Viewing in the current tenant and Property.
- Captured information: disposition and optional concise private note.
- `PROCEED` enables a future explicit conversion/application/offer workflow; it
  performs none of those actions itself.
- `DECLINED` closes this commercial branch without deleting Inquiry/Viewing history.
- Property withdrawal or unavailability does not erase an Outcome. A future
  progression use case must revalidate current availability and publication as needed.

## 12. Recommended private API

No public endpoint is required.

| Method and route | Intent | Grant | Payload/response |
| --- | --- | --- | --- |
| `POST /v1/properties/{propertyId}/viewings/{viewingId}/outcome` | record outcome | `MANAGE_PROPERTY_VIEWING_OUTCOMES` | `{ status, note? }` -> Outcome |
| `GET /v1/properties/{propertyId}/viewings/{viewingId}/outcome` | retrieve outcome | `RETRIEVE_PROPERTY_VIEWING_OUTCOMES` | `{ outcome: Outcome | null }` |
| `PUT /v1/properties/{propertyId}/viewings/{viewingId}/outcome/decision` | resolve follow-up | `MANAGE_PROPERTY_VIEWING_OUTCOMES` | `{ status: PROCEED | DECLINED, note? }` -> Outcome |

Contracts must be strict Zod/OpenAPI schemas and exclude tenant/audit internals.
Use 400 for validation, 401/403 for authority, non-revealing 404 for absent or
cross-tenant references, and 409 for eligibility, uniqueness or transition conflicts.

## 13. Authorization and tenant security

- derive exactly one tenant through authenticated Property authority;
- never accept `tenantId`, actor or audit data from request bodies;
- require Property, Viewing and Outcome to resolve inside the same tenant;
- derive Property and Inquiry provenance from the locked Viewing;
- reject cross-tenant knowledge as resource absence;
- force RLS and use tenant-scoped transactions for every operation;
- grant only `SELECT`, `INSERT`, `UPDATE` to `monpiole_runtime`;
- expose no outcome, note or prospect PII publicly;
- add `RETRIEVE_PROPERTY_VIEWING_OUTCOMES` and
  `MANAGE_PROPERTY_VIEWING_OUTCOMES` to administrator authority composition.

## 14. Persistence design

Future table: `property_management.property_viewing_outcomes`.

Key columns:

- `outcome_id uuid primary key`;
- `tenant_id`, `property_id`, `viewing_id`;
- `status text`, `note text`;
- `created_at`, `updated_at`, `decided_at`;
- `actor_id`, `correlation_id`.

Constraints and indexes:

- unique `(tenant_id, outcome_id)`;
- unique `(tenant_id, viewing_id)`;
- composite FK `(tenant_id, property_id)` to Property;
- composite FK `(tenant_id, property_id, viewing_id)` to a corresponding
  tenant/Property/Viewing candidate key;
- status enum CHECK;
- bounded, nonblank optional note CHECK;
- lifecycle CHECK coupling status and `decided_at`;
- index `(tenant_id, property_id, status, updated_at desc, outcome_id desc)` only
  if a future Property follow-up list is included; it is not required by V1 routes;
- enabled and forced RLS with tenant USING/WITH CHECK policy.

Creation must lock the Viewing row `FOR UPDATE`, revalidate `COMPLETED`, then
insert in one transaction. Outcome transitions lock the Outcome row. Property
and Inquiry need not also be locked: their identity/provenance is immutable and
availability is explicitly not an Outcome invariant.

## 15. Property Workspace experience

Place the capability inside the existing « Demandes reçues » Viewing panel.

- After completion, primary CTA: **« Consigner le résultat de la visite »**.
- Form choices: **« À relancer »**, **« Souhaite poursuivre »**, **« Ne souhaite pas poursuivre »**.
- Optional field label: **« Note interne »**.
- A follow-up Outcome shows **« Confirmer la poursuite »** and
  **« Marquer comme non retenu »**.
- Terminal Outcomes remain visible with date and note but no mutation controls.
- Empty, loading, saving, success, 401, 403, 404, 409 and network states use
  concise French messages and preserve already loaded Inquiry/Viewing data.
- History remains visually connected: Inquiry, appointment, then outcome.

Do not introduce a CRM board, global pipeline or generic task list.

## 16. Mobile readiness

The proposed aggregate and API use stable status codes, UUIDs, ISO instants and
resource-oriented private routes. A future manager mobile client can retrieve,
record and resolve the same Outcome without Web-specific state or localized
values in transport contracts. French labels remain presentation concerns.

## 17. Explicit exclusions for TASK-080

- automatic PropertyClient creation or deduplication;
- automatic Contract creation or activation;
- rental application, buyer application, offer or negotiation;
- reservation, availability hold, deposit, payment or accounting;
- generic CRM, sales pipeline, lead scoring or analytics;
- assignment, tasks, reminder dates or workflow engine;
- email, SMS, WhatsApp, push or in-app messaging;
- calendar synchronization;
- document generation, electronic signature or lease workflow;
- automated scoring or AI recommendations;
- public Outcome routes or public PII;
- mobile UI implementation;
- reopening or changing terminal decisions.

## 18. Future implementation task

### Exact title

**TASK-080 — Property Viewing Outcome & Follow-up Vertical Slice**

### Objective

Implement a complete private vertical slice that records and resolves the
commercial outcome of a completed Property Viewing while preserving explicit
separation from Client conversion, applications, offers and contracts.

### Required scope

- add the `PropertyViewingOutcome` aggregate and invariants defined above;
- add create, retrieve and resolve-follow-up application use cases and ports;
- add an additive PostgreSQL migration, repository, locks, uniqueness, forced
  RLS, explicit runtime grants and tenant-scoped composite references;
- expose the three private `/v1` operations above with strict Zod DTOs;
- add dedicated authority grants and Problem Details mappings;
- compose the PostgreSQL runtime and regenerate OpenAPI;
- integrate French Outcome controls into completed Viewings in Property Workspace;
- preserve Inquiry, Viewing, Client and Contract public contracts;
- add domain, application, HTTP, contract, PostgreSQL/RLS/concurrency and Web tests;
- update Property Management/API/Web documentation and the TASK-080 report.

### Acceptance criteria

1. Only a current-tenant `COMPLETED` Viewing can receive an Outcome.
2. Property is derived through the Viewing and cannot be injected by payload.
3. Exactly one Outcome exists per Viewing under concurrent requests.
4. `FOLLOW_UP_REQUIRED` transitions only to `PROCEED` or `DECLINED`.
5. Terminal outcomes cannot be changed or reopened.
6. Same terminal replay is idempotent; conflicting replay returns 409.
7. Cross-tenant reads/writes and references are prevented by application checks,
   composite constraints and forced RLS.
8. No public contract exposes Outcome, private note or prospect PII.
9. Web supports creation, resolution and all required French UX/error states.
10. No Client, Contract, reservation, payment or notification is created implicitly.
11. Typecheck, migration check, unit, HTTP, contract, PostgreSQL, RLS,
    concurrency, Web, build, architecture, global tests and `git diff --check` pass.

## 19. Final decision

The next capability is **Property Viewing Outcome & Follow-up**. It is the
smallest coherent bridge between an attended viewing and any later commercial
commitment. It records the missing decision without prematurely encoding a CRM,
transaction-specific application, reservation, contract or payment workflow.

## 20. Validation

- Initial `git status --short`: clean.
- `git log -5 --oneline`: TASK-078 verified at `e83ec8e`.
- Repository source, schema, API, OpenAPI, Web and tests inspected.
- Final `git diff --check`: PASS (no output, exit code 0).
- Documentation-only change; no runtime code, endpoint, migration or UI modified.
- No commit. No push.
