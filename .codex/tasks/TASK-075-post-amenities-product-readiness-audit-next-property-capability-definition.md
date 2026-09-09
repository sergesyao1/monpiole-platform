# TASK-075 - Post-Amenities Product Readiness Audit & Next Property Capability Definition

## 1. Executive Summary

**Status: DONE - documentary audit; no capability implemented.**

Repository inspection confirms that MonPiole can create, enrich, compose, price,
illustrate, locate, equip and publish a Property. It also has private
`PropertyClient` and `PropertyContract` capabilities. The public journey,
however, still ends at the Property detail: no visitor can persist an interest,
request contact or enter a manager workflow.

TASK-074 is **SUBSTANTIALLY COMPLETE**. Its production path is present from
domain through public/private Web, including migration, forced RLS and atomic
replacement. The main residual weaknesses are test depth around the real
PostgreSQL replacement adapter and the still-empty SDK package; neither blocks
the next product capability.

The recommended next capability is **Public Property Inquiries & Lead Intake**.
It closes the first absolute break in the customer journey without prematurely
building scheduling, applicant management, messaging or leases.

Future implementation task:

```text
TASK-076 - Public Property Inquiries & Lead Intake Vertical Slice
```

## 2. Repository Baseline

Audit baseline:

- repository: `C:\Projet\monpiole-platform`;
- branch history inspected through `fa7da00 feat(property): add amenities and equipment`;
- TASK-073 is committed at `97efbc0` and TASK-074 at `fa7da00`;
- TASK-071 previously identified public interest capture as the main conversion gap;
- no TASK-072 report or implementation exists in `.codex/tasks`;
- TASK-069 already introduced tenant-owned clients and Property contracts;
- `packages/sdk` remains a documentation-only placeholder;
- the working tree was clean before this report was created.

Primary sources inspected:

- recent TASK-068, TASK-069, TASK-071, TASK-073 and TASK-074 reports;
- Property domain/application ports and PostgreSQL adapters;
- migrations and Drizzle schema;
- authenticated grants, private controllers and OpenAPI contracts;
- private workspace routes/components;
- public catalogue list/detail query, routes and components;
- relevant unit, HTTP, contract, PostgreSQL and Web tests;
- repository TODO/placeholder and capability-name searches.

No lead, inquiry, visit request, appointment, favourite or equivalent
conversion model was found under another name.

## 3. TASK-074 Completion Assessment

**Assessment: SUBSTANTIALLY COMPLETE.**

| Concern | Repository evidence | Assessment |
| --- | --- | --- |
| Canonical catalog | 42 stable codes and eight categories in `property-amenity.ts` | Complete |
| Seed/migration | `0018_property_amenities.sql` seeds the catalog | Complete |
| Association model | tenant-scoped `property_amenities` composite identity | Complete |
| DB constraints | composite Property FK, amenity FK, PK and indexes | Complete |
| Tenant isolation | tenant authority, forced RLS and tenant-scoped SQL | Complete |
| Atomic replacement | Property row lock, delete/insert in one transaction | Complete |
| Grants | dedicated retrieve/update grants and explicit DB grants | Complete |
| Private API | catalog, selection read and replacement under `/v1` | Complete |
| Contracts/OpenAPI | strict Zod schemas and generated OpenAPI | Complete |
| Private Web | grouped French checkbox editor in Property Workspace | Complete |
| Public projection | active selected amenities on public detail only | Complete |
| Public DB boundary | restricted view for published Properties, no tenant column | Complete |
| SDK | `packages/sdk` contains no generated client | Missing, platform-wide debt |
| Documentation | TASK report exists; service/API README coverage is limited | Partial |
| Tests | domain, HTTP, contract, Web and shared PG suites pass | Good, not exhaustive |

Important residual findings:

- no dedicated PostgreSQL test directly exercises amenity replacement,
  rollback, unknown-code FK behaviour and cross-tenant adapter reads;
- the focused HTTP test combines happy path and one validation case but does
  not exhaustively prove missing grants, non-revealing 404 and adapter conflicts;
- the public rendering is a flat list rather than category-grouped;
- no SDK artifact prevents contract reuse without manual client types.

These are quality/developer-experience gaps, not evidence that the capability is
absent. TASK-075 does not repair them.

## 4. Current Property Capability Map

| Capability | State | Product surface |
| --- | --- | --- |
| Property core | Implemented | create, retrieve, update, portfolio |
| Physical details | Implemented | surface, rooms, bedrooms, bathrooms, furnished |
| Ownership | Implemented | owner directory and assignments |
| Composition | Implemented | standalone, composite, buildings and units |
| Pricing | Implemented | rental, short-stay and sale terms |
| Availability/occupancy | Implemented | commercial and operational state |
| Media | Implemented | ordered gallery and primary photo |
| Geolocation | Implemented | coordinates, privacy mode and private map UX |
| Amenities | Implemented | catalog and explicit Property selection |
| Publication | Implemented | draft, published and withdrawn lifecycle |
| Public catalog | Implemented, deployment-gated | list/detail, pagination and basic filters |
| Private clients | Implemented | tenant client directory |
| Property contracts | Implemented | draft/active/ended/cancelled lifecycle |
| Public interest capture | Absent | no inquiry/contact persistence |
| Visit scheduling | Absent | no appointments or calendars |
| Advanced discovery | Partial | type/transaction filters only |

## 5. Product Readiness Assessment

Scale: `MATURE`, `GOOD`, `PARTIAL`, `MISSING`.

| Axis | Rating | Rationale |
| --- | --- | --- |
| A. Property identity & core description | MATURE | coherent private/public model and validation |
| B. Composition | MATURE | explicit roles, tenant references and workflows |
| C. Ownership | GOOD | directory and assignments; broader mandates excluded |
| D. Pricing | GOOD | commercializable V1 terms across transaction types |
| E. Availability & occupancy | GOOD | distinct states and composite calculation |
| F. Media | GOOD | ordered public/private gallery; scaling strategy remains limited |
| G. Geolocation | GOOD | structured coordinates and workspace map |
| H. Amenities & equipment | GOOD | canonical model; test/SDK debt remains |
| I. Publication lifecycle | MATURE | controlled publish/withdraw transitions |
| J. Public catalogue | GOOD | useful list/detail, still production-gated |
| K. Search & discovery | PARTIAL | only type and transaction filters |
| L. Prospect/customer conversion | MISSING | no contact or persistent intention |
| M. Property operational workflow | PARTIAL | clients/contracts exist, no acquisition handoff |
| N. Web product readiness | GOOD | real journeys, but workspace and conversion gaps remain |
| O. Mobile readiness | PARTIAL | clean HTTP concepts, empty SDK and duplicated Web types |

## 6. Public Customer Journey Audit

Current journey:

```text
Browse -> filter by type/transaction -> open detail -> inspect price, photos,
location, characteristics and amenities -> dead end
```

The visitor can understand a discovered Property reasonably well. Availability
is represented in the domain, although its prominence in public discovery is
limited. Search by price, area, rooms, location and amenities is absent, so
discovery becomes inefficient at volume.

The larger break occurs after evaluation. There is no CTA backed by a business
record, no contact request, no visit request, no agency handoff and no persisted
consent. Even a visitor who already has the correct Property cannot proceed.

## 7. Private Property Manager Journey Audit

Current journey:

```text
Create -> enrich -> assign owner -> compose -> price -> add media -> locate
-> select amenities -> publish -> monitor availability -> no public inquiries
```

Managers can separately create `PropertyClient` records and Property contracts.
Those objects represent an identified commercial party and a contractual
relationship; they do not explain how a public visitor became known. There is
no inbox or Property-level queue after publication and no explicit conversion
from anonymous interest to a client.

## 8. Gap Analysis

| Gap | User/business problem | Impact and value | Dependencies/complexity/risk |
| --- | --- | --- | --- |
| Public inquiries | Interested visitors cannot act; managers lose demand | Highest immediate conversion value; unlocks commercial workflow | public write security, PII, consent, anti-abuse; medium |
| Advanced search | Users scan too many listings | High discovery value at catalogue scale | query/index design and filter UX; medium |
| Visit requests | No scheduling after interest | High downstream value | requires contact intent, time rules and calendars; high |
| Favourites | Visitors cannot shortlist | Helpful retention/comparison | anonymous storage or accounts; medium |
| Applicant workflow | No qualification/application flow | Strong long-term rental value | documents, privacy, statuses and review; high |
| Production catalogue gate | Public catalog remains intentionally gated | Blocks actual Internet acquisition | operational/security decision beyond Property model; medium/high |
| SDK | Web/mobile duplicate contracts | Slows future clients | API platform generation/versioning; medium |

Short-term value favours inquiries. Long-term, inquiries form the acquisition
origin for visits, qualification and client conversion without forcing those
features into V1.

## 9. Candidate Capabilities

Serious candidates derived from the repository are:

1. Public Property Inquiries & Lead Intake.
2. Advanced Public Catalog Search & Filters.
3. Property Visit Requests & Scheduling.
4. Public Favourites & Shortlists.
5. Rental Application / Candidate Workflow.

## 10. Candidate Comparison Matrix

Scores are 1-5. Complexity and risk are reverse-scored: 5 means smaller/safer.
Weights: user value 20%, business value 20%, urgency 15%, unlocks 15%, domain
fit 10%, Web/mobile reuse 10%, delivery simplicity 5%, architectural safety 5%.

| Candidate | User | Business | Urgency | Unlocks | Fit | Reuse | Simplicity | Safety | Weighted /5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Inquiries & lead intake | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 3 | **4.80** |
| Advanced search/filtering | 5 | 4 | 4 | 4 | 5 | 5 | 3 | 4 | **4.35** |
| Visit requests/scheduling | 4 | 5 | 3 | 4 | 4 | 5 | 2 | 2 | **3.90** |
| Favourites/shortlists | 3 | 3 | 2 | 3 | 3 | 5 | 3 | 3 | **3.05** |
| Rental applications | 4 | 5 | 2 | 5 | 3 | 4 | 1 | 2 | **3.65** |

## 11. Recommended Next Capability

**Public Property Inquiries & Lead Intake** lets an anonymous visitor submit a
minimal, consented contact request for a currently published Property and lets
an authorized tenant manager read and progress those requests.

This is not a generic CRM. It is the smallest persisted bridge from a public
Property to the existing private commercial world.

## 12. Why This Capability Now

1. It fixes the only unconditional dead end in every successful public journey.
2. It creates immediate measurable business value from the existing catalog.
3. It uses publication, Host tenant resolution and Property identity already present.
4. It can later feed clients, visits or applications through explicit commands.
5. It is deliverable as one coherent vertical slice.
6. Its transport-neutral contracts are reusable by Web and mobile.

## 13. Rejected / Deferred Alternatives

- **Advanced search** is next-tier important, but improves finding a Property
  without enabling action once found. It should follow conversion capture or be
  planned independently when catalogue volume justifies indexes.
- **Visit scheduling** presupposes a captured person and contact channel. V1
  inquiries may express visit interest in a message without calendar semantics.
- **Favourites** improve consideration but introduce anonymous persistence or
  customer identity before the conversion path exists.
- **Applications** and **leases** are substantially larger workflows. Contracts
  already cover the private contractual baseline; applicant acquisition remains
  upstream.
- **Documents** support later qualification/contracts but do not repair public
  conversion alone.

## 14. Proposed Domain Model

### Problem statement

A visitor who is interested in a published Property needs a safe way to ask for
contact. The owning tenant needs a durable, tenant-isolated record to follow up
without treating an unqualified visitor as a contractual client.

### Actors

- anonymous public visitor/prospect;
- authenticated tenant manager with inquiry grants;
- future public or manager mobile client.

### Core concepts

`PropertyInquiry`:

- `inquiryId`: server-generated UUID;
- `tenantId`: resolved server-side, never accepted from public input;
- `propertyId`: internal tenant-scoped Property reference;
- `publicPropertyId`: captured reference or projection aid, not trust input;
- `contactName`;
- `email` and/or `phoneNumber`;
- optional bounded `message`;
- `consentGivenAt` and consent version/purpose;
- `status`: `NEW`, `ACKNOWLEDGED`, `CLOSED`;
- creation/update timestamps and audit trace;
- optional `acknowledgedAt` and `closedAt`.

The inquiry is distinct from `PropertyClient`, identity membership, owner and
contract. Future conversion may create or link a client explicitly.

## 15. Aggregate / Bounded Context Decision

`PropertyInquiry` is an independent aggregate inside **Property Management**.
It references a Property but has its own identity, lifecycle, PII and manager
workflow. It must not enlarge the Property aggregate or be stored as an array
inside Property.

Property Management is the correct V1 owner because the request only exists in
relation to a Property's publication and tenant. A new CRM/Leads service is not
justified until inquiries acquire independent campaigns, pipelines, assignment,
automation or multi-resource ownership. Notifications may later consume an
event; they do not own the record.

## 16. State Model

```text
NEW -> ACKNOWLEDGED -> CLOSED
NEW ----------------> CLOSED
```

- `NEW`: received and not yet acknowledged;
- `ACKNOWLEDGED`: a manager has taken notice or begun follow-up;
- `CLOSED`: no further action is expected.

Transitions are idempotent where the target state is already reached. Reopen,
assignment, qualification stages and automated transitions are outside V1.

## 17. Business Invariants

1. Public submission targets a Property currently `PUBLISHED` in the Host-resolved tenant.
2. Missing, withdrawn and cross-tenant Properties produce the same non-revealing result.
3. `tenantId`, status and audit fields never come from public input.
4. Contact name is required and bounded.
5. At least one valid contact channel, email or phone, is required.
6. Consent must be explicit and its timestamp/version recorded.
7. Message is optional, trimmed and bounded; no opaque metadata blob is accepted.
8. State transitions follow the declared graph and are tenant-scoped.
9. A Property inquiry is not implicitly a `PropertyClient` or contract.
10. Submission idempotency or a bounded duplicate-suppression rule prevents accidental double creation.
11. No write is possible after publication eligibility is rechecked transactionally.
12. PII is excluded from logs, public reads and public success responses.

## 18. Commands & Queries

Commands:

- `SubmitPublicPropertyInquiry`;
- `AcknowledgePropertyInquiry`;
- `ClosePropertyInquiry`.

Queries:

- `ListPropertyInquiries` for one Property with opaque deterministic pagination;
- `RetrievePropertyInquiry` for manager detail;
- optionally `CountNewPropertyInquiries` only if required by the workspace summary.

V1 does not include update-contact, delete, convert-to-client or assignment commands.

## 19. Authorization Model

Public submission is anonymous and authorized by resolved public catalog
visibility, not by a user grant.

Private grants:

- `LIST_PROPERTY_INQUIRIES`;
- `RETRIEVE_PROPERTY_INQUIRY`;
- `MANAGE_PROPERTY_INQUIRIES` for acknowledge/close.

OIDC scopes remain separate from business grants. Private 404 responses must not
reveal records outside the current authority tenant.

## 20. Tenant Isolation

- Resolve public tenant from the existing allowlisted Host mechanism.
- Resolve private tenant only from authenticated authority.
- Never accept tenant identity in request bodies, query parameters or headers.
- Use composite tenant/Property references and tenant-scoped inquiry identity.
- Force RLS on the inquiry table with explicit runtime grants.
- Recheck publication under transaction/lock during public submission to avoid
  creating against a concurrently withdrawn Property.

## 21. Persistence Direction

Conceptual additive table `property_management.property_inquiries`:

- composite unique identity `(tenant_id, inquiry_id)`;
- composite FK `(tenant_id, property_id)` to Properties;
- bounded contact, consent, status and transition timestamp columns;
- correlation/idempotency key with a tenant/property uniqueness strategy;
- checks for contact-channel presence, lifecycle timestamps and consent;
- index `(tenant_id, property_id, created_at DESC, inquiry_id DESC)`;
- optional tenant-wide status index only when a global inbox is approved;
- forced RLS and least-privilege grants.

No JSON source of truth, direct owner contact projection or mutation of client/
contract tables is proposed. Retention and erasure policy must be decided before
implementation because inquiry contact data is personal data.

## 22. API Direction

Conceptual endpoints:

```text
POST /v1/public/properties/{publicPropertyId}/inquiries
GET  /v1/properties/{propertyId}/inquiries?limit=&cursor=&status=
GET  /v1/properties/{propertyId}/inquiries/{inquiryId}
PUT  /v1/properties/{propertyId}/inquiries/{inquiryId}/acknowledgement
PUT  /v1/properties/{propertyId}/inquiries/{inquiryId}/closure
```

The public command accepts minimal contact, message, consent and an idempotency
key. It returns `202` or `201` with a generic reference and no tenant/private
data. Contracts must define strict Zod validation, RFC 9457 errors and rate-limit
behaviour. OpenAPI remains additive.

## 23. Private Web Integration

Add a compact `Demandes reçues` section or tab to the Property Workspace:

- new count and paginated newest-first list;
- name, contact channel, received date and status;
- detail view with message and consent context;
- acknowledge and close actions;
- French loading, empty, forbidden, error, conflict and success states;
- preserve loaded pages when loading a next cursor fails;
- permission-aware controls without hiding server authorization checks.

Do not add a full tenant CRM dashboard in V1.

## 24. Public Web Integration

The public Property detail gains one primary CTA and an inline or dedicated
French form:

- name;
- email and/or telephone;
- optional message;
- mandatory explicit consent;
- clear submitting, success, validation, unavailable and retry states;
- double-submit protection;
- accessible field errors and keyboard flow.

No manager/owner PII is disclosed. A withdrawn Property must fail generically
even when its detail was loaded moments earlier.

## 25. Mobile Readiness

The aggregate and commands contain no React, browser storage or Web routing
concept. Stable status values, idempotency, public/private HTTP contracts and
opaque cursors can serve future mobile clients. TASK-076 should avoid embedding
French labels as canonical business values and should expose them only as
presentation resources where repository conventions require.

The empty SDK remains a cross-cutting risk; implementing inquiry contracts does
not require solving SDK generation inside the same slice.

## 26. Auditability

Record or emit facts consistent with repository event/audit conventions:

- `PropertyInquirySubmitted` with no unnecessary PII payload;
- `PropertyInquiryAcknowledged`;
- `PropertyInquiryClosed`.

Persist actor/correlation trace for private transitions. Public submission
needs correlation and idempotency traces but must not log contact data. Whether
events are published through an outbox depends on established Property event
infrastructure at implementation time; do not invent a broker solely for V1.

## 27. Testing Strategy

- Domain: normalization, contact requirement, consent and lifecycle transitions.
- Application: publication eligibility, idempotency, authority and non-revealing not-found.
- HTTP: public success/validation, Host resolution, withdrawn/missing Property,
  abuse limits, private grants and state conflicts.
- Contract: additive OpenAPI schemas, public PII minimization and Problem Details.
- PostgreSQL: composite references, forced RLS, tenant isolation, rollback,
  concurrent withdrawal/submission, idempotency and keyset pagination.
- Web public: form validation, consent, success, API failures and double submission.
- Web private: list/detail, cursor pagination, permissions and transitions.
- Architecture: context dependencies and absence of direct cross-service reads.

## 28. V1 Scope

TASK-076 should deliver:

- `PropertyInquiry` domain and minimal lifecycle;
- submission and private management use cases;
- additive PostgreSQL migration, RLS and transactional adapter;
- one anonymous public submission route;
- private list/detail/acknowledge/close routes;
- Zod/OpenAPI contracts and grants;
- public Property detail inquiry form;
- private Property Workspace inquiry section;
- focused tests across domain, persistence, HTTP, contract and Web;
- explicit privacy retention decision documented with the slice.

## 29. Explicit Out-of-Scope

- visit calendars, time slots and external calendar integration;
- email/SMS/WhatsApp sending or real-time messaging;
- lead scoring, pipelines, assignment and automation;
- automatic creation or merging of `PropertyClient`;
- applicant dossiers, KYC and document uploads;
- reservation, payment, lease generation or signature;
- visitor accounts, favourites and saved searches;
- marketing campaigns, attribution analytics and custom forms;
- tenant-configurable statuses or arbitrary fields;
- CAPTCHA vendor integration unless platform security explicitly requires it;
- advanced catalogue search/filtering;
- mobile UI.

## 30. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Spam/automated abuse | bounded rate limiting, idempotency, payload limits and operational monitoring |
| PII over-collection | minimal fields, no public echo, retention/erasure decision |
| Tenant disclosure | Host resolution, generic failures, composite FK and forced RLS |
| Withdraw race | transactional eligibility check with Property lock |
| Confusion with client | distinct aggregate and explicit future conversion command |
| Notification scope creep | store inquiry first; emit fact for later consumers |
| Workspace overload | compact Property-level section, no CRM dashboard |
| Empty SDK | keep contracts transport-neutral; address generation separately |

## 31. Future Capabilities Unlocked

TASK-076 naturally enables, without committing numbers:

- inquiry-to-client conversion;
- visit request and scheduling workflows;
- manager notifications;
- qualification/application flows;
- response-time and conversion reporting;
- tenant-wide lead inbox when actual volume requires it.

Advanced discovery remains independently valuable and can follow based on
catalogue volume. It is not a dependency of inquiry submission.

## 32. TASK-076 Definition

**TASK-076 - Public Property Inquiries & Lead Intake Vertical Slice**

Problem: persist a minimal consented public interest in a published Property and
make it actionable to the owning tenant.

Architectural location: independent `PropertyInquiry` aggregate within
`property-management`, with public submission and grant-protected private
management boundaries.

Acceptance direction:

1. A visitor can submit a valid inquiry only for a currently published Property.
2. Tenant and Property ownership are resolved and verified server-side.
3. Cross-tenant, missing and withdrawn targets are non-revealing.
4. PII and consent are minimal, validated, retained deliberately and never publicly echoed.
5. Duplicate retries are idempotent or safely deduplicated.
6. Authorized managers can list, retrieve, acknowledge and close inquiries.
7. Private pagination is deterministic and cursor-opaque.
8. No inquiry implicitly creates a client, contract, visit or notification.
9. RLS, transactions, grants, OpenAPI and focused tests prove the boundaries.
10. Public and private Web journeys are responsive, accessible and French-labelled.

## 33. Final Recommendation

Recommended next capability:
Public Property Inquiries & Lead Intake

Future implementation task:
TASK-076 - Public Property Inquiries & Lead Intake Vertical Slice

Key decisions:
- model `PropertyInquiry` as an independent aggregate in Property Management;
- keep inquiries distinct from contractual `PropertyClient` records;
- accept anonymous submissions only for currently published Host-resolved Properties;
- use a minimal `NEW -> ACKNOWLEDGED -> CLOSED` lifecycle;
- enforce consent, PII minimization, idempotency, anti-abuse and forced RLS;
- defer scheduling, notifications, conversion, applications and advanced search.

Why now:
MonPiole already lets a visitor find and evaluate a credible published Property,
but provides no next action. Inquiry capture closes that conversion break with a
small reusable vertical slice and creates the clean upstream source for later
visits, client conversion and applicant workflows.

