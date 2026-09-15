# TASK-100 — End-to-End Commercial Journey & Product Readiness Audit

## Status

DONE — Audit only. No product implementation is included in this task.

## 1. Objective

Audit the complete MonPiole commercial journey from anonymous public discovery to contract creation and identify the remaining gaps before considering the rental lifecycle product-ready.

Audited journey:

Catalogue public
→ Fiche du bien
→ PropertyInquiry
→ Acknowledge
→ Communication
→ PropertyViewing
→ PropertyViewingOutcome
→ PropertyApplication
→ PropertyClient conversion
→ PropertyContract

This task intentionally does not implement the identified gaps.

---

## 2. Executive conclusion

The MonPiole commercial funnel is functionally connected end-to-end.

An anonymous prospect can discover a published property, submit an inquiry without an account, be handled by an authenticated agency user, progress through communication and viewing, reach a commercial decision, submit an application, be converted into a client, and obtain a contract derived from the approved application.

The current implementation therefore provides a credible commercial vertical slice.

However, the complete rental lifecycle is not yet production-ready.

The most important remaining gaps concern:

1. synchronization between active leases, commercial availability, occupancy and public catalogue visibility;
2. lease notice, planned departure and future availability;
3. real contract documents and attachments;
4. public map rendering using effective and privacy-safe geolocation;
5. UX continuity between application-derived contract creation and contract activation;
6. future consolidation of dynamic tenant/platform authorization.

The strongest blockers are not in lead acquisition or commercial conversion. They are located after or around contractualization, where the property operational state must become consistent with the legal/commercial state.

---

## 3. End-to-end journey assessment

### 3.1 Public catalogue

Status: PASS WITH PRODUCT GAP

The public catalogue exposes published commercial properties through tenant resolution based on the request Host.

Public catalogue access uses a dedicated public reader and tenant-scoped database access.

Public list/retrieve operations require the property to have status PUBLISHED.

The catalogue is operational in the validated local runtime once the public catalogue environment is correctly configured.

Gap:

Public visibility currently depends primarily on publication status and is not automatically synchronized with active lease, availability or occupancy state.

---

### 3.2 Public property detail

Status: PASS WITH UX GAP

A public property detail page exists.

The page exposes two commercial entry points:

- Je suis intéressé
- Demander une visite

Both routes correctly create a PropertyInquiry rather than bypassing the inquiry lifecycle.

The property is inferred from the public route and tenantId is not supplied by the anonymous prospect.

Gap:

The public detail currently presents textual location information but does not render the existing geolocation map capability.

---

## 4. Public inquiry intake

Status: PASS

PropertyInquiry supports:

- CONTACT
- VIEWING_REQUEST

The public form requires a contact name and at least one usable contact method.

Supported preferred communication channels are:

- PHONE
- SMS
- EMAIL

The request remains accountless for the prospect.

Public creation is idempotent and limited to published properties.

The prospect cannot directly create a PropertyViewing.

This preserves the commercial workflow and prevents anonymous users from creating operational scheduling records.

---

## 5. Inquiry management

Status: PASS

The inquiry lifecycle is:

NEW
→ ACKNOWLEDGED
→ CLOSED

A NEW inquiry must first be acknowledged before communication or viewing operations become available.

An ACKNOWLEDGED inquiry enables the operational follow-up workflow.

A CLOSED inquiry no longer allows viewing creation and its communication history becomes read-only.

The state model therefore provides an explicit administrative acceptance boundary between public lead intake and internal commercial processing.

---

## 6. Prospect communications

Status: PASS

PropertyInquiryCommunication provides an append-only communication history associated with the inquiry.

Supported channels:

- PHONE
- SMS
- EMAIL

Supported directions:

- OUTBOUND
- INBOUND

Supported statuses:

- RECORDED
- SENT
- FAILED

Communication records preserve actor and occurrence information and are tenant-scoped.

The current capability is intentionally a lightweight communication history rather than a complete CRM.

Automated delivery through the notifications service remains a future capability.

---

## 7. Viewing scheduling

Status: PASS

A PropertyViewing can be created from an eligible acknowledged inquiry.

The implementation provides:

- scheduling;
- rescheduling;
- completion;
- cancellation;
- UTC scheduling;
- IANA timezone information.

Only one logical viewing exists per inquiry.

Critical transitions use transactional persistence and locking.

Terminal states are protected against incompatible transitions.

---

## 8. Viewing outcome

Status: PASS

PropertyViewingOutcome provides the commercial decision after a completed viewing.

Lifecycle:

FOLLOW_UP_REQUIRED
→ PROCEED
→ DECLINED

PROCEED and DECLINED are terminal decisions.

An application can only continue from an eligible PROCEED outcome.

This avoids converting every completed viewing directly into a client or contract.

---

## 9. Property application

Status: PASS

PropertyApplication provides a durable commercial application between viewing and client conversion.

Lifecycle:

SUBMITTED
→ APPROVED
→ REJECTED
→ WITHDRAWN

An application originates from a PROCEED viewing outcome.

Multiple competing applications can exist for a property while maintaining one application per relevant viewing/outcome relationship.

No client or contract is automatically created merely because an application exists.

---

## 10. Client conversion

Status: PASS

An APPROVED PropertyApplication can be converted into a PropertyClient.

The conversion derives the required commercial context server-side.

Application-to-client conversion is durable and protected against duplicate concurrent conversion.

The conversion does not require the Web client to reconstruct trusted tenant or commercial provenance information.

---

## 11. Contract creation from application

Status: PASS WITH UX FRICTION

An approved and converted application can create a PropertyContract through the dedicated application-derived contract path.

The implementation:

- derives the client server-side;
- preserves application/conversion provenance;
- guarantees a canonical contract for the conversion;
- provides idempotent replay behavior;
- performs transactional locking;
- applies lease eligibility rules.

The resulting contract is initially DRAFT.

Gap:

After application-derived creation, the user is instructed to activate the contract separately in the Clients and Contracts section.

There is no strong direct navigation from the commercial journey to the newly created contract activation workflow.

Classification:

LOW/MEDIUM — UX friction.

This is not a domain integrity blocker.

---

## 12. Active lease concurrency and hierarchy

Status: PASS

Active lease conflict protection is implemented transactionally.

Before creating or activating a lease, the persistence layer locks the relevant root property and rechecks related active leases.

This serializes competing contract operations on the same commercial property hierarchy.

Hierarchy-aware conflict detection covers whole-building and unit relationships.

The current implementation therefore substantially protects against two concurrent active leases being created through supported repository operations.

This area is not considered a TASK-100 product gap.

---

## 13. Major gap — Contract vs availability, occupancy and public catalogue

Status: HIGH PRODUCT / DOMAIN GAP

Property currently distinguishes concepts including:

- publication;
- availability;
- occupancy;
- contract lifecycle.

This separation is correct.

However, these states are not yet operationally synchronized.

Activating a PropertyContract does not automatically update the property's availability or occupancy.

The Web explicitly communicates that contracts do not automatically modify property availability or occupancy.

The public catalogue primarily filters on PUBLISHED status.

Consequently, a property may remain publicly advertised after a lease becomes ACTIVE.

This creates a significant inconsistency between legal/commercial state and public commercial visibility.

### Recommendation

Do not simply translate:

ACTIVE contract → WITHDRAWN property.

Publication and commercial availability should remain distinct concepts.

A future capability should define authoritative rules connecting:

PropertyContract
→ Lease state
→ Occupancy
→ Commercial availability
→ Public catalogue eligibility

Possible future states may include concepts such as:

AVAILABLE
OCCUPIED
AVAILABLE_FROM(date)

The exact domain model must be defined in a dedicated future task.

---

## 14. Major gap — Lease notice and future availability

Status: HIGH DOMAIN GAP

The current PropertyContract lifecycle is:

DRAFT
→ ACTIVE
→ ENDED

with CANCELLED where applicable.

There is currently no explicit domain concept for:

- tenant notice;
- notice date;
- planned departure;
- planned contract end;
- future commercial availability;
- property available from a future date.

The current end operation transitions an ACTIVE contract immediately to ENDED.

An endDate may represent a contractual date, but it does not provide a real notice lifecycle.

Using a future endDate while immediately changing the contract to ENDED would be unsafe because active-lease conflict detection is based on ACTIVE contracts.

It could therefore allow a replacement contract while the current occupant is still legally or physically occupying the property.

### Recommendation

Introduce a dedicated lease notice / planned departure capability.

During notice:

- the existing lease remains ACTIVE;
- notice information is recorded separately;
- planned departure/end information is retained;
- future commercial availability can be calculated;
- the property may eventually be advertised as available from a future date;
- the contract transitions to ENDED only when the effective termination occurs.

Period-aware replacement contract rules will also be required.

---

## 15. Major gap — Contract documents

Status: HIGH PRODUCT / SECURITY GAP

PropertyContract currently represents business metadata and lifecycle information.

There is no dedicated contract document aggregate providing:

- upload;
- list;
- authenticated download;
- document viewing;
- signed contract storage;
- addenda;
- inventory documents;
- notices;
- termination documents.

Existing PropertyPhoto infrastructure provides useful implementation patterns for:

- binary registration;
- content type;
- content size;
- SHA-256 integrity;
- authenticated retrieval;
- tenant authorization;
- actor/correlation traceability.

PropertyPhoto must not be reused as the contract document aggregate.

### Recommended future aggregate

PropertyContractDocument

Potential metadata:

- documentId;
- tenantId;
- propertyId;
- contractId;
- documentType;
- originalFileName;
- contentType;
- contentByteSize;
- contentSha256;
- uploadedByActorId;
- uploadedAt;
- storage reference.

Potential document types:

SIGNED_CONTRACT
DRAFT_CONTRACT
ADDENDUM
INVENTORY
NOTICE
TERMINATION
OTHER

PDF should be the primary V1 document format.

Other formats should only be enabled where validation and secure rendering/download are explicitly supported.

### Security requirements

Contract documents must require:

- tenant isolation;
- contract-aligned authorization;
- MIME and extension validation;
- maximum size validation;
- filename sanitization;
- malware scanning boundary;
- controlled Content-Disposition;
- auditability;
- immutable or versioned signed documents;
- no unrestricted public document URL.

A storage abstraction should be preferred over generalizing PostgreSQL Base64 storage for legal documents.

---

## 16. Public geolocation and map

Status: MEDIUM/HIGH PRODUCT / UX GAP

MonPiole already contains geolocation concepts including:

- latitude;
- longitude;
- privacy modes;
- effective/inherited geolocation;
- Web map rendering capability.

Supported privacy modes include:

EXACT
APPROXIMATE
HIDDEN

Effective geolocation can be inherited through the property hierarchy according to the existing model.

The public property page currently does not fully exploit this capability by rendering a map.

### Required future behavior

EXACT:

Render the permitted exact position.

APPROXIMATE:

Render deliberately degraded/approximate coordinates.

HIDDEN:

Do not expose coordinates or a map.

Display only safe textual information such as city, district and country.

The public API must expose only the privacy-safe projection and must never allow the Web to reconstruct hidden exact coordinates.

---

## 17. Authorization assessment

Status: PASS WITH FUTURE CONSOLIDATION REQUIRED

Property-management use cases are protected through explicit grants and authorized tenant resolution.

The business layer does not rely solely on route authentication.

Tenant context is derived from the authenticated authority.

This provides a strong foundation for future RBAC.

However, the current authority construction is not yet the final MonPiole agency/platform authorization model.

The future architecture should preserve the existing grant-based use-case authorization while changing how those grants are resolved.

Target direction:

Identity
→ Scope
→ Membership
→ Role(s)
→ Permission(s)
→ Grants
→ PropertyAuthority
→ authorizedTenant()
→ Use case

The future RBAC must maintain strict separation between PLATFORM and TENANT scopes.

Tenant roles must never provide platform privileges.

This subject belongs primarily to TASK-101 and subsequent administration tasks rather than TASK-100.

---

## 18. Product readiness classification

### Commercial funnel readiness

READY WITH CONSOLIDATION

The journey from anonymous prospect to draft contract is connected and usable.

There is no fundamental commercial dead-end in the audited funnel.

### Rental lifecycle readiness

NOT YET PRODUCTION READY

The main blockers are operational domain consistency after contractualization:

- active lease vs public visibility;
- availability and occupancy synchronization;
- notice and planned departure;
- future availability;
- contract document management.

---

## 19. Priority findings

### HIGH

1. Active lease / availability / occupancy / catalogue synchronization.
2. Lease notice, planned departure and future availability.
3. Property contract documents and secure attachment management.

### MEDIUM/HIGH

4. Public effective-geolocation map with privacy enforcement.

### LOW/MEDIUM

5. Direct UX continuity between application-derived contract and activation.

### FUTURE PLATFORM CONSOLIDATION

6. Dynamic platform/tenant roles, memberships and permissions.

---

## 20. Recommended sequencing

TASK-100 does not modify the frozen roadmap.

The following tasks remain reserved:

TASK-101 — Identity, Tenant & Platform Administration Readiness Audit

TASK-102 — Agency Registration & Verification

TASK-103 — Platform Users, Roles & Permissions

TASK-104 — Agency Approval & Tenant Provisioning

TASK-105 — Initial Agency Administrator Provisioning

TASK-106 — Agency Users, Roles & Permissions

TASK-107 — Agency Administration Workspace

Real-estate lifecycle capabilities identified by TASK-100 should resume from TASK-108 onward and be prioritized separately.

Likely capability families include:

- commercial availability / occupancy lifecycle;
- lease notice and future availability;
- public property map;
- property contract documents.

TASK-100 intentionally does not assign final task numbers to those capabilities.

---

## 21. Local runtime observation

During public catalogue runtime validation, a local Vite proxy configuration was required so Web `/v1` requests could reach the local API while preserving the Host used for public tenant resolution.

This is a local integration/configuration concern rather than a commercial domain capability.

The existing uncommitted modification to:

apps/web/vite.config.ts

is explicitly excluded from TASK-100.

It must not be silently committed or reverted as part of this audit.

---

## 22. Security observation

The public catalogue correctly requires a dedicated public database reader rather than the migration/runtime privileged database identity.

A local public-reader credential was exposed during interactive validation.

That credential should be rotated.

No credential value must be stored in this audit, source control or committed environment configuration.

---

## 23. Final decision

TASK-100: DONE

Decision:

COMMERCIAL_FUNNEL_READY_WITH_RENTAL_LIFECYCLE_GAPS

MonPiole now has a coherent commercial journey from public discovery to contract creation.

The next roadmap phase should focus on Identity, Tenant and Platform Administration through TASK-101 to TASK-107.

After that frozen administration sequence, property-management development should resume with the operational lifecycle gaps identified by this audit.

No production capability has been implemented by TASK-100.