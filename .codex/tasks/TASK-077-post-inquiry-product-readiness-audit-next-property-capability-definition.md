# TASK-077 - Post-Inquiry Product Readiness Audit & Next Property Capability Definition

## 1. Executive Summary

**Status: DONE - documentary audit only.**

TASK-076 is present at commit `62e1880` and provides a genuine end-to-end
`PropertyInquiry` slice. A visitor can submit a consented inquiry against a
published Property; an authorized manager can list, retrieve, acknowledge and
close it. Tenant resolution, RLS, idempotency and public/private contract
separation are implemented.

The new product break is immediately after acknowledgement. MonPiole records an
interest but cannot turn that interest into a concrete real-estate interaction.
There is no viewing, appointment, scheduled time, reschedule, cancellation or
completion record. `PropertyClient` and `PropertyContract` exist, but they
represent later private commercial concepts and must not be used as substitutes
for a viewing.

The recommended next capability is:

```text
TASK-078 - Property Viewing Scheduling & Management Vertical Slice
```

V1 should let a tenant manager schedule one viewing from an acknowledged
inquiry, reschedule it, cancel it or mark it completed. It should remain a
Property Management capability, expose no new anonymous public write route and
avoid becoming a generic calendar, CRM or notification system.

## 2. Repository Evidence Reviewed

Repository baseline:

- repository: `C:\Projet\monpiole-platform`;
- current branch: `main`;
- HEAD before this report: `62e1880 feat(property): add public inquiries and lead intake`;
- TASK-075 commit: `a68e8e4`;
- TASK-074 commit: `fa7da00`;
- initial working tree: clean;
- next migration number after TASK-076: `0020`.

Evidence inspected:

- `.codex/tasks/TASK-075-post-amenities-product-readiness-audit-next-property-capability-definition.md`;
- `.codex/tasks/TASK-076-public-property-inquiries-lead-intake-vertical-slice.md`;
- `services/property-management/src/domain/property-inquiry.ts`;
- `services/property-management/src/application/manage-property-inquiries.ts`;
- `services/property-management/src/application/property-inquiry-repository.ts`;
- PostgreSQL inquiry adapter, schema and migration `0019`;
- public/private inquiry controllers and Zod/OpenAPI contracts;
- `PropertyInquiriesSection.tsx` and `PublicPropertyInquiryForm.tsx`;
- `PropertyClient`, `PropertyContract` and their application/API/Web surfaces;
- current public catalogue, publication and withdrawal boundaries;
- grants and authenticated authority adapters;
- repository-wide searches for visit, viewing, appointment, prospect,
  candidate, booking, reservation, application, occupant and lease concepts;
- relevant inquiry, Property, contract, PostgreSQL, HTTP and Web tests.

No existing Property visit/viewing aggregate, table, route, schema, grant or Web
surface was found under another name.

## 3. Current Property Product Journey

The implemented journey is:

```text
Create Property
-> enrich core/details
-> assign ownership
-> define composition
-> configure pricing
-> add media
-> select amenities
-> geolocate
-> configure availability/occupancy
-> publish
-> browse public catalogue
-> inspect public Property detail
-> submit PropertyInquiry
-> manager lists/retrieves inquiry
-> manager acknowledges or closes inquiry
-> STOP
```

The pre-publication half is broad and operational. The public catalogue supports
basic discovery and a credible detail. TASK-076 now persists a visitor's intent.
The product still cannot represent the most common next concrete action: showing
the Property to that prospect.

After receipt, a manager can see contact data and message, change `NEW` to
`ACKNOWLEDGED`, then close the inquiry. Acknowledgement has no structured
business consequence. Follow-up time, meeting status and outcome necessarily
live outside MonPiole today.

## 4. Capability Readiness Matrix

Scale: `READY`, `PARTIAL`, `MISSING`, `DEFERRED`.

| Area | Capability | Status | Repository finding |
| --- | --- | --- | --- |
| Property Core | create/read/update | READY | domain, API, PostgreSQL and Web |
| Property Core | composition/buildings/units | READY | standalone/composite/unit slice |
| Property Core | ownership | READY | owner directory and assignments |
| Property Core | characteristics | READY | physical details and furnished state |
| Property Core | pricing | READY | advanced terms by transaction type |
| Property Core | availability/occupancy | READY | direct and composite read model |
| Merchandising | media/gallery | READY | ordered gallery and public projection |
| Merchandising | amenities | READY | canonical catalog and selections |
| Merchandising | geolocation | READY | persistence, visibility and map editor |
| Merchandising | public presentation | READY | list/detail projection |
| Discovery | public catalogue | READY | Host-scoped list/detail |
| Discovery | pagination | READY | opaque keyset cursors |
| Discovery | filters | PARTIAL | type and transaction only |
| Discovery | text/price/area/amenity search | MISSING | no public query capability |
| Discovery | map discovery | MISSING | private point map only |
| Lead/Prospect | inquiry capture | READY | TASK-076 |
| Lead/Prospect | basic follow-up | PARTIAL | acknowledge/close only |
| Lead/Prospect | qualification/history/assignment | MISSING | no model or workflow |
| Lead/Prospect | conversion | MISSING | no inquiry-to-client command |
| Visits | request/scheduling | MISSING | no visit concept found |
| Visits | reschedule/cancel/status | MISSING | no lifecycle found |
| Client lifecycle | tenant client directory | READY | `PropertyClient` |
| Client lifecycle | explicit prospect identity | PARTIAL | contact exists only in inquiry |
| Client lifecycle | tenant/client/property relationship | PARTIAL | contracts link later stage |
| Transactional | Property contracts | READY | draft/active/ended/cancelled |
| Transactional | application/offer/reservation | MISSING | no models or routes |
| Documents | Property/client documents | MISSING | no owned document capability |
| Financial | pricing | READY | commercial terms only |
| Financial | rent/payment/deposit ledger | MISSING | no operational finance workflow |
| Platform | generated SDK | DEFERRED | `packages/sdk` remains placeholder |
| Platform | public production gate | DEFERRED | existing explicit Internet gate |

## 5. Post-Inquiry Gap Analysis

`PropertyInquiry` stores:

- tenant and Property relationship;
- visitor name and email and/or phone;
- optional message;
- consent version/time;
- idempotency key;
- `NEW`, `ACKNOWLEDGED`, `CLOSED` state and transition timestamps.

Its application consumers support submission, list, retrieve, acknowledge and
close. Its private Web component shows the contact and supports those two
transitions. It does not contain qualification notes, responsible manager,
appointment data, client link or transaction intent beyond the originating
Property.

This is deliberately correct for TASK-076, but `ACKNOWLEDGED` is currently a
functional cul-de-sac. The natural next fact after a qualified inquiry is often:

```text
A viewing of this Property has been scheduled with this prospect.
```

That fact deserves its own lifecycle and audit trail. It should not be encoded
in the inquiry message, a contract note or an availability flag.

## 6. Existing Domain Reuse Analysis

### PropertyInquiry

Reuse as the origin of the viewing and source of prospect contact. Do not copy
mutable workflow state into the inquiry. V1 should require the inquiry to be
`ACKNOWLEDGED`, so scheduling follows an explicit manager decision.

### Property

Reference the tenant-owned Property with a composite FK. Scheduling a viewing
does not change commercial availability or occupancy. A Property may be
withdrawn after a viewing was scheduled; the viewing record remains valid and
must be explicitly cancelled or completed.

### PropertyClient

Keep distinct. `PropertyClient` is a tenant-owned commercial contact used by
contracts. An inquiry contact need not become a client merely because a viewing
is scheduled. Future explicit conversion may reuse the inquiry identity/contact
and link the resulting client.

### PropertyContract

Do not reuse. Contracts model `DRAFT`, `ACTIVE`, `ENDED`, `CANCELLED` legal or
commercial records. A viewing is upstream and has different invariants.

### Authenticated identity

The authenticated actor schedules and transitions viewings. V1 may persist
`scheduledByActorId` for audit, but should not introduce staff assignment or a
foreign key into Identity because direct cross-context persistence is forbidden.

## 7. Candidate Capabilities

Scores: 1 low to 5 high. Complexity/risk use reverse scoring, where 5 is easier
and safer.

| Candidate | User value | Business value | Continuity | Dependencies | Delivery fit | Mobile reuse | Simplicity | Risk safety | Overall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Property Viewing Scheduling | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 4 | **4.65** |
| Inquiry-to-Client Conversion | 4 | 4 | 5 | 5 | 4 | 5 | 4 | 4 | **4.35** |
| Prospect Qualification | 4 | 4 | 5 | 3 | 3 | 4 | 2 | 3 | **3.60** |
| Advanced Public Search | 5 | 4 | 2 | 4 | 5 | 5 | 3 | 4 | **4.05** |
| Rental Application | 5 | 5 | 3 | 2 | 3 | 4 | 1 | 2 | **3.35** |
| Property Documents | 3 | 4 | 2 | 3 | 4 | 4 | 2 | 3 | **3.10** |
| Reservation/Hold | 4 | 5 | 3 | 2 | 3 | 4 | 2 | 2 | **3.30** |
| Contract initiation | 3 | 4 | 3 | 5 | 4 | 4 | 4 | 4 | **3.85** |

### Property Viewing Scheduling

Highest continuity with TASK-076. It turns an acknowledged lead into a concrete,
time-bound operation and remains a clean aggregate-sized slice.

### Inquiry-to-Client Conversion

Valuable and relatively small, but conversion alone still leaves the manager
with a client record and no intermediate operational action. Creating a client
is already possible manually; structured viewing is wholly absent.

### Prospect Qualification

Useful at scale, but status taxonomies, notes, scoring and ownership readily
expand into CRM design. Current volume evidence does not justify it first.

### Advanced Search

Important for catalogue scale and mobile discovery. It improves the path before
inquiry but does not advance an inquiry already received. It is independent and
can follow when catalogue volume makes the current filters insufficient.

### Applications, reservations and documents

These are later-stage, transaction-specific workflows with larger privacy,
storage, lifecycle and financial consequences. They should build on a clearer
prospect interaction trail.

## 8. Recommended Next Capability

**Property Viewing Scheduling & Management**.

The capability lets an authorized tenant manager schedule a viewing from an
acknowledged Property inquiry, retrieve it in the Property Workspace, reschedule
it and mark it completed or cancelled.

It is a real-estate operation rather than a generic calendar. The aggregate
owns the appointment facts and lifecycle. It references but does not absorb the
Property, inquiry or client concepts.

## 9. Why This Capability Now

1. It is the first concrete operation naturally produced by a qualified inquiry.
2. It gives `ACKNOWLEDGED` an actionable continuation.
3. It adds value unavailable through current clients or contracts.
4. It can be delivered privately without another anonymous abuse boundary.
5. It establishes reusable scheduling semantics before notifications or mobile.
6. It remains small enough for one domain-to-Web vertical slice.

## 10. Why Alternatives Are Deferred

- Conversion to `PropertyClient` remains useful but is not required to arrange a
  first viewing and is already approximable through manual client creation.
- Lead qualification would prematurely create a CRM taxonomy without evidence
  for scoring, assignment or pipeline stages.
- Search/filtering should be prioritized by catalogue volume; it is not the
  missing continuation after TASK-076.
- A public visit-request endpoint would duplicate the inquiry entry point and
  create slot/abuse semantics before a manager scheduling model exists.
- Applications, reservations, contracts, documents and finance occur later and
  differ materially across rental, short stay and sale.

## 11. Proposed TASK-078 Definition

### Proposed title

```text
TASK-078 - Property Viewing Scheduling & Management Vertical Slice
```

### Problem statement

An authorized manager who acknowledges a Property inquiry needs to record when
the prospect will view that Property and track whether the appointment happened
or was cancelled. Today this coordination is external and unaudited.

### Scope

- introduce `PropertyViewing` as an independent aggregate;
- schedule one V1 viewing from an acknowledged inquiry;
- retrieve/list viewings for the Property and inquiry;
- reschedule a scheduled viewing;
- cancel a scheduled viewing;
- mark a scheduled viewing completed;
- persist tenant-scoped data with RLS and composite references;
- add private API/OpenAPI contracts and dedicated grants;
- integrate a compact viewing workflow into the Property Workspace inquiry area;
- add domain, application, PostgreSQL, HTTP, contract and Web tests;
- document timezone and date/time presentation explicitly.

### Acceptance direction

1. Only an acknowledged inquiry can create a viewing.
2. Property and inquiry must belong to the same current tenant and the inquiry
   must originate from that Property.
3. Tenant comes only from authenticated authority.
4. V1 permits at most one viewing aggregate per inquiry; rescheduling updates it.
5. A scheduled viewing has a future start, positive bounded duration and timezone.
6. Only `SCHEDULED` may be rescheduled, completed or cancelled.
7. Completion and cancellation are terminal and idempotent on replay.
8. Withdrawal does not erase historical scheduling; the manager controls its terminal state.
9. RLS and composite FKs prevent cross-tenant reads and writes.
10. Web and contracts expose no internal tenant field.

## 12. Domain Model

### Aggregate: PropertyViewing

Suggested values:

- `viewingId`: server UUID;
- `tenantId`;
- `propertyId`;
- `inquiryId`;
- `status`: `SCHEDULED`, `COMPLETED`, `CANCELLED`;
- `startsAt`: UTC instant;
- `endsAt`: UTC instant;
- `timeZone`: validated IANA timezone for presentation intent;
- optional bounded `locationInstructions` or `managerNote` only if product
  confirms it is necessary and private;
- `createdAt`, `updatedAt`;
- `completedAt` or `cancelledAt`;
- actor/correlation audit fields for creation and transitions.

No `PropertyClient` FK is required in V1. Prospect contact remains available
through the tenant-safe inquiry relation.

### Boundaries

`PropertyViewing` is not part of the Property aggregate because it has an
independent identity/lifecycle and may remain as history after Property changes.
It is not part of `PropertyInquiry` because appointment rescheduling and terminal
outcomes are separate invariants.

## 13. Lifecycle / State Machine

```text
                 reschedule
             +---------------+
             |               |
             v               |
          SCHEDULED ---------+
             |       |
             |       +------> CANCELLED
             +--------------> COMPLETED
```

- creation starts directly at `SCHEDULED`;
- reschedule changes time while remaining `SCHEDULED`;
- completion and cancellation are terminal;
- repeated completion/cancellation to the same terminal state is idempotent;
- transitions between terminal states and rescheduling a terminal viewing fail
  with a conflict;
- no `REQUESTED` state: TASK-076 already captures public intent;
- no `NO_SHOW` in V1 unless product evidence explicitly distinguishes it from
  completed/cancelled before implementation begins.

## 14. Authorization Model

Proposed grants:

- `CREATE_PROPERTY_VIEWING`;
- `RETRIEVE_PROPERTY_VIEWINGS`;
- `UPDATE_PROPERTY_VIEWING_SCHEDULE`;
- `MANAGE_PROPERTY_VIEWING_LIFECYCLE`.

The repository may consolidate the last two only if current authority conventions
favour one management grant. Listing and detail may share the retrieve grant,
matching existing client/contract patterns.

Every operation requires one authenticated authority with exactly one resolved
tenant. Knowing viewing, inquiry or Property UUIDs never confers access.

## 15. Tenant Isolation & Security

- tenant is derived exclusively through `authorizedTenant`;
- browser payloads contain no `tenantId` or actor fields;
- viewing references use composite `(tenant_id, property_id)` and
  `(tenant_id, property_id, inquiry_id)` constraints or an equivalent
  tenant-safe candidate key;
- forced RLS applies to all reads and writes;
- all repository methods include tenant predicates inside tenant transactions;
- transitions lock the viewing row;
- scheduling locks or transactionally verifies the inquiry state;
- PII is read through the inquiry and is not duplicated into viewing rows;
- private notes, if approved, are bounded and excluded from public contracts/logs.

## 16. Proposed API Surface

Minimal private routes:

```text
POST /v1/properties/{propertyId}/inquiries/{inquiryId}/viewing
GET  /v1/properties/{propertyId}/viewings?limit=&cursor=&status=
GET  /v1/properties/{propertyId}/viewings/{viewingId}
PUT  /v1/properties/{propertyId}/viewings/{viewingId}/schedule
PUT  /v1/properties/{propertyId}/viewings/{viewingId}/completion
PUT  /v1/properties/{propertyId}/viewings/{viewingId}/cancellation
```

Creation body: `startsAt`, `endsAt`, `timeZone`, and only approved optional
private instructions. Reschedule accepts the same temporal fields. Status,
tenant, inquiry contact and audit values are server-owned.

List ordering should be deterministic, preferably upcoming time then viewing ID
for scheduled operations. If one endpoint mixes terminal history and upcoming
records, define stable ordering explicitly rather than overloading creation order.

Problem Details should distinguish invalid input (400), forbidden (403),
non-revealing missing relation (404) and invalid transition/conflict (409).

## 17. Web UX Scope

Extend the existing `Demandes reçues` workspace section rather than creating a
CRM page:

- show `Planifier une visite` only for acknowledged inquiries without a viewing;
- French date, start/end time and timezone-aware form;
- show the scheduled appointment beside its originating inquiry;
- allow `Replanifier`, `Marquer comme effectuée` and `Annuler` when permitted;
- display terminal status/history without editable controls;
- loading, empty, validation, saving, success, forbidden, not-found, conflict and
  network error states;
- refresh inquiry/viewing data consistently after mutations;
- preserve loaded cursor pages when a later page fails;
- accessible labels, confirmations for destructive cancellation and responsive layout.

A small Property-level upcoming view may be included if it reuses the same query
and does not create a separate dashboard.

## 18. Public Surface

No new public route is required in V1.

The public visitor continues to submit an inquiry. A tenant manager then agrees
on a time through the existing contact channel and records it privately. Public
self-service slot selection, rescheduling tokens and visitor authentication are
explicitly deferred.

This choice avoids a second anonymous write boundary, public token management
and false promises about real-time availability.

## 19. Persistence Impact

Future additive migration `0020` should conceptually add
`property_management.property_viewings` with:

- tenant/viewing identity and one-viewing-per-inquiry V1 uniqueness;
- tenant-safe Property and inquiry references;
- status, UTC start/end, IANA timezone and transition timestamps;
- creation/update actor and correlation trace;
- checks for `ends_at > starts_at`, a bounded duration and lifecycle consistency;
- deterministic Property/status/time indexes;
- forced RLS and explicit least-privilege runtime grants.

An overlap exclusion constraint is not recommended in V1. Multiple prospects
may legitimately view a Property together, and no staff/resource capacity model
exists. Adding a guessed non-overlap invariant would encode an unsupported
business rule.

## 20. OpenAPI / Contract Impact

Add strict schemas for:

- viewing status;
- create/reschedule request;
- private viewing response;
- list query and opaque pagination response;
- Property, inquiry and viewing paths;
- lifecycle responses and documented Problem Details.

The response may include the originating inquiry's minimal private contact view
for Web efficiency, but must not expose `tenantId`, raw persistence trace or
public consent internals unnecessarily. Contracts should remain reusable by a
future manager mobile application.

## 21. Testing Strategy

### Domain

- valid schedule and normalization;
- invalid dates, timezone and duration;
- reschedule and terminal transitions;
- idempotent replay and forbidden terminal transitions.

### Application

- acknowledged inquiry eligibility;
- Property/inquiry consistency;
- grant checks and non-revealing cross-tenant absence;
- one-viewing-per-inquiry conflict;
- withdrawal behaviour explicitly preserved.

### PostgreSQL/RLS

- persistence round trip and tenant-safe composite references;
- uniqueness and lifecycle checks;
- RLS reads/writes across two tenants;
- transaction rollback;
- concurrent create and transition row locking;
- deterministic pagination.

### HTTP/OpenAPI

- successful private routes;
- strict validation and cursor rejection;
- unauthenticated/unauthorized cases;
- missing Property/inquiry/viewing and cross-tenant access;
- transition conflicts;
- contract generation compatibility.

### Web

- schedule from acknowledged inquiry;
- reschedule, complete and cancel;
- hidden/disabled actions by lifecycle and permissions;
- French validation and API error states;
- pagination/deduplication and retained results on next-page failure;
- responsive rendering at existing supported widths.

## 22. Explicit Non-Goals

- public self-service visit request or slot booking;
- availability-slot inventory or generic calendar UI;
- Google/Outlook calendar integration;
- email, SMS, WhatsApp or push notifications;
- staff assignment, routing or workload management;
- multi-attendee meetings and recurring appointments;
- video visits, check-in or geofencing;
- CRM pipelines, scoring, qualification forms or sales automation;
- automatic inquiry-to-client conversion;
- rental applications, reservations, offers or payments;
- leases, signatures and document management;
- no-show state unless separately approved;
- mobile UI;
- advanced public search.

## 23. Risks & Open Questions

### Confirm before TASK-078 implementation

1. Confirm that one viewing aggregate per inquiry is sufficient for V1; the
   proposed model supports rescheduling but not repeat visits.
2. Confirm the maximum viewing duration; a conservative bound such as four hours
   prevents invalid data without implying standard duration.
3. Confirm the timezone policy. Store UTC instants plus an IANA timezone; never
   rely on browser-local time alone.
4. Confirm whether private location instructions are genuinely required. Omit
   them if the existing Property location is enough.
5. Confirm whether a completed viewing should automatically close the inquiry.
   Recommendation: no implicit cross-aggregate transition in V1.

### Known repository risks

- `packages/sdk` remains a placeholder, so Web types are manually mirrored;
- public production exposure and inquiry retention/rate limiting remain gated
  concerns from TASK-076;
- the Property Workspace continues to accumulate sections and requests;
- no notification capability consumes scheduling facts yet.

These do not block a private viewing slice but must be stated honestly.

## 24. Architecture Decision

The capability belongs in **Property Management**, not a new service.

Its business identity depends on a Property and Property inquiry; its rules are
real-estate-specific and its V1 lifecycle has no independent calendar ownership.
Creating a Scheduling bounded context now would add cross-service contracts and
consistency problems without autonomous business value.

If future scheduling expands to staff calendars, external participants,
multi-resource capacity and organization-wide appointments, the boundary can be
revisited through an ADR. TASK-078 should not anticipate that system.

## 25. Mobile Readiness

Stable lifecycle codes, UTC instants, IANA timezone, opaque cursors and explicit
commands can be consumed by a future manager mobile client. No endpoint should
depend on anchors, browser state, HTML forms or locale-formatted timestamps.

Mobile does not justify public self-service scheduling in V1. A later mobile
prospect experience can reuse a dedicated public contract once secure visitor
tokens and slot availability are actually defined.

## 26. Final Recommendation

Recommended next capability:
Property Viewing Scheduling & Management

Future implementation task:
TASK-078 - Property Viewing Scheduling & Management Vertical Slice

Key decisions:
- introduce an independent `PropertyViewing` aggregate in Property Management;
- originate V1 viewings only from an acknowledged `PropertyInquiry`;
- use `SCHEDULED -> COMPLETED | CANCELLED` with rescheduling while scheduled;
- permit one viewing aggregate per inquiry in V1 and model changes as reschedules;
- keep all routes private and tenant-authority scoped;
- preserve inquiry/client/contract separation and avoid implicit conversions;
- defer public booking, notifications, staff calendars and CRM concerns.

Why now:
TASK-076 captures interest but acknowledgement currently leads nowhere inside
MonPiole. A focused viewing slice turns that interest into the next observable
real-estate operation while reusing the existing Property and inquiry boundaries
and avoiding a premature CRM or scheduling platform.

## 27. Validation

TASK-077 changes documentation only. No runtime, migration, contract, API, Web,
test or dependency file is modified. `git diff --check`: **PASS**. Final Git
state contains only this untracked report.

No commit and no push are performed by TASK-077.
