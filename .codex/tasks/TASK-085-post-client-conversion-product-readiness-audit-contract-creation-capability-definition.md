# TASK-085 — Post-Client Conversion Product Readiness Audit & Contract Creation Capability Definition

## Status

DONE

## Executive Summary

The repository now supports the commercial journey through an approved application
being explicitly converted into a reusable `PropertyClient`. A complete generic
`PropertyContract` capability also exists, including draft creation, editing,
activation, ending, cancellation, private API routes, PostgreSQL persistence, RLS,
and Workspace UI.

The two capabilities are not connected. Generic contract creation accepts any
tenant client identifier and property identifier. It does not require or record the
approved application/client conversion, and it does not prevent several contracts
from being created for the same conversion. The correct next capability is therefore
a dedicated, conversion-aware contract creation entry point that reuses the existing
`PropertyContract` aggregate and lifecycle.

Selected direction: **B. Introduce a dedicated application/client → contract
conversion operation**, implemented as an orchestration around the existing contract,
not as a second contract aggregate.

## Repository Evidence

- `services/property-management/src/domain/property-application.ts` owns application
  status through `SUBMITTED -> APPROVED | REJECTED | WITHDRAWN`.
- `services/property-management/src/domain/property-application-client-conversion.ts`
  represents immutable conversion provenance.
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-application-client-conversion-repository.ts`
  locks the application and atomically creates the client and conversion.
- `services/property-management/src/domain/property-client.ts` defines reusable,
  tenant-level party data without a property or application relationship.
- `services/property-management/src/domain/property-contract.ts` defines the existing
  contract aggregate and lifecycle.
- `services/property-management/src/application/manage-property-contracts.ts` exposes
  generic contract creation and lifecycle use cases.
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-contract-repository.ts`
  persists and locks contracts.
- `services/property-management/migrations/0017_property_client_contracts.sql`
  introduced clients and contracts.
- `services/property-management/migrations/0023_property_management_baseline.sql`
  introduced application/client conversion provenance.
- `apps/api/src/http/properties/property-contracts.controller.ts` exposes the existing
  private contract API.
- `apps/web/src/features/properties/PropertyContractsSection.tsx` provides the existing
  French contract workspace.
- `engineering/contracts/http/openapi.json` documents both contract and conversion
  routes.

## Current Commercial Journey

The durable repository-backed journey is:

`Public Property -> PropertyInquiry -> PropertyViewing ->`
`PropertyViewingOutcome.PROCEED -> PropertyApplication.SUBMITTED ->`
`PropertyApplication.APPROVED -> PropertyApplicationClientConversion -> PropertyClient`

After conversion, the client appears in the tenant-wide client directory. An operator
may then manually select it in the generic contract form. No durable operation connects
that contract to the originating application.

## TASK-084 Verification

TASK-084 is implemented and committed under `edf4c28`.

- Conversion requires the dedicated private grant.
- Tenant comes from authenticated authority.
- PostgreSQL locks the application with `FOR UPDATE`.
- Only `APPROVED` is eligible.
- Contact data is loaded from the authoritative inquiry.
- Client and immutable conversion are inserted in one transaction.
- `(tenant_id, application_id)` is the conversion primary key.
- `(tenant_id, client_id)` is unique.
- Tenant-scoped foreign keys retain application and client provenance.
- Replays and concurrent attempts converge on the existing client.
- Conversion does not create a contract or mutate availability/occupancy.

The originating viewing, outcome, and inquiry remain traceable through the application
foreign keys. The converted client itself is intentionally generic; provenance lives
in `property_application_client_conversions`.

## Current PropertyClient Semantics

`PropertyClient` is reusable tenant master data, not a commercial-journey record.
It contains identity/contact data and timestamps only. It has no property, application,
conversion, contract, availability, or lifecycle status.

This is appropriate. Adding `propertyId` or `applicationId` to the client would prevent
reuse and duplicate the conversion relation. Contract eligibility must be established
through the conversion record, not inferred from client contact fields.

## Existing PropertyContract Capability

### Existing types

- `LEASE`
- `MANAGEMENT`
- `OTHER`

There is no `SALE` contract type. `OTHER` must not be treated as implicit sale support.

### Existing lifecycle

- New contracts start `DRAFT`.
- Only drafts can be edited.
- `DRAFT -> ACTIVE` requires `startDate`.
- `ACTIVE -> ENDED` requires an `endDate`.
- `DRAFT -> CANCELLED` and `ACTIVE -> CANCELLED` are supported.
- Replaying activation, the same ending, or cancellation is idempotent.
- Invalid or contradictory transitions conflict.

### Existing creation rules

Creation loads the tenant-scoped property and client, creates a new contract ID, checks
the domain eligibility rule, and saves the draft. `LEASE` is allowed only for a
`LONG_TERM_RENTAL` property whose structural role is not `COMPOSITE`; therefore it
supports `STANDALONE` and `UNIT` rental targets.

The generic use case does not:

- verify an approved application;
- verify a matching conversion;
- require the client to originate from the selected property;
- retain application/conversion provenance;
- lock the property, client, application, or conversion during creation;
- establish one contract per conversion;
- naturally replay a create command to the existing contract.

Reference uniqueness is tenant-wide, but it is not commercial-conversion idempotence.
A retry with another generated contract ID and another reference creates another draft;
a retry with the same reference produces a conflict rather than returning a canonical
contract.

## Current API and Web Coverage

Existing private routes are:

- `POST /v1/properties/{propertyId}/contracts`
- `GET /v1/properties/{propertyId}/contracts`
- `GET /v1/properties/{propertyId}/contracts/{contractId}`
- `PUT /v1/properties/{propertyId}/contracts/{contractId}`
- `POST /v1/properties/{propertyId}/contracts/{contractId}/activate`
- `POST /v1/properties/{propertyId}/contracts/{contractId}/end`
- `POST /v1/properties/{propertyId}/contracts/{contractId}/cancel`

The create payload contains `clientId`, type, reference, optional dates, and notes.
The Workspace loads up to 100 tenant clients and lets an operator select any of them.
It displays draft/active/ended/cancelled contracts and exposes capability-controlled
French actions. It does not surface application provenance or distinguish a converted
candidate from a manually created client.

## Persistence, RLS and Authorization Assessment

`property_contracts` has tenant-scoped foreign keys to property and client, lifecycle
checks, date/reference checks, tenant-unique reference, useful property/status/client
indexes, forced RLS, and runtime `SELECT, INSERT, UPDATE` privileges.

Existing grants separate creation, retrieval, update, and lifecycle management:

- `CREATE_PROPERTY_CONTRACT`
- `RETRIEVE_PROPERTY_CONTRACTS`
- `UPDATE_PROPERTY_CONTRACT`
- `MANAGE_PROPERTY_CONTRACT_LIFECYCLE`

These remain useful. A conversion-aware creation operation needs a narrower explicit
grant such as `CREATE_PROPERTY_CONTRACT_FROM_APPLICATION`; it must not accept tenantId.

The database currently guarantees tenant-scoped property/client references and contract
lifecycle shape. It does not guarantee application/client/property lineage or one
contract per application conversion.

## Contract Creation Gap Analysis

A contract can currently be created for the converted client by manually selecting it.
That path is technically tenant-scoped but commercially under-constrained. It permits:

- a contract for a client unrelated to the property;
- several contracts for one approved conversion;
- loss of the inquiry/viewing/application lineage at contract level;
- concurrent duplicate drafts with different references;
- accidental use of a generic client instead of the selected applicant.

The missing durable fact is:

> This PropertyContract was explicitly created from this approved application/client
> conversion for this same Property.

## Contract Activation and Lifecycle Assessment

The existing lifecycle is sufficient for V1 and must be reused. Activation is an
atomic locked contract update and requires a start date. It replays safely and records
actor/correlation/time traces. Ending and cancellation are also locked and traced.

TASK-086 should strengthen activation only by revalidating the conversion-backed
contract lineage and the target property's continued structural/transaction eligibility.
It should not introduce another lifecycle.

Existing financial terms are property pricing, not contract-specific negotiated
financial fields. TASK-086 should not invent rent, deposit, payment schedule, or sale
consideration fields. The draft references the selected property whose pricing remains
the current source of commercial pricing truth.

## Property Availability / Occupancy Assessment

Properties model explicit `AVAILABLE | UNAVAILABLE` and `VACANT | OCCUPIED` snapshots.
Composite availability is derived from units. The contract repository and lifecycle
use cases do not update either value on activation, ending, or cancellation.

Automatic mutation must remain deferred. The current model does not define:

- whether activation date or contract start date triggers occupation;
- advance-signed contracts;
- overlapping/future contracts;
- how termination dates synchronize vacancy;
- short-term inventory/reservation semantics;
- whether cancellation of an active contract immediately vacates the property.

TASK-086 must preserve the existing no-side-effect behavior. A later occupancy
coordination capability should define those rules transactionally.

## Options Considered

### A. Extend generic PropertyContract creation silently

Rejected. Adding optional lineage to the current generic endpoint would leave callers
able to bypass the commercial invariant and would blur manual management contracts with
application-derived leases.

### B. Dedicated application/client → contract operation

Selected. It reuses the existing aggregate while making lineage, eligibility,
idempotence, and concurrency explicit at one private entry point.

### C. Add offer/agreement/reservation before contract

Rejected for now. No repository evidence establishes the necessary lifecycle or data.
A reservation would also require unavailable inventory semantics not yet defined.

### D. Another capability first

Rejected. The converted client is already reusable and the existing contract aggregate
can represent the supported long-term lease draft and lifecycle. The gap is connection,
not another party or workflow model.

## Selected Next Capability

**TASK-086 — Property Contract Creation & Activation Vertical Slice**

Its primary command is conversion-aware contract creation. It reuses
`PropertyContract`, its lifecycle transitions, existing generic read routes, and the
contract Workspace. Generic contract creation may remain for legitimate management or
other contracts, but it must not be presented as application conversion.

## Why This Capability Comes Next

TASK-084 establishes a selected reusable counterparty but no commercial agreement.
The repository already has a mature contract aggregate, so the smallest coherent next
step is to connect that aggregate to verified application conversion with durable,
concurrency-safe provenance.

## Proposed Domain Model

Keep these existing ownership boundaries:

- `PropertyApplication`: selection decision.
- `PropertyApplicationClientConversion`: authoritative selected client provenance.
- `PropertyClient`: reusable tenant party.
- `PropertyContract`: agreement terms and lifecycle.

Add an immutable relationship/audit entity, not an aggregate lifecycle:

`PropertyApplicationContractOrigin`

Minimum values:

- `tenantId`
- `applicationId`
- `clientId`
- `propertyId`
- `contractId`
- `createdAt`
- actor/correlation trace

The IDs may be normalized to only those needed by composite foreign keys, but the
database must be able to enforce the same tenant, property, converted client, application,
and contract. Do not copy inquiry/viewing/outcome fields; they remain reachable through
the application.

## Eligibility and Invariants

- Tenant is derived exclusively from authenticated authority.
- The application belongs to the path property and current tenant.
- The application is `APPROVED`.
- An immutable application/client conversion exists.
- The client is exactly the client in that conversion; clientId is not supplied by the
  browser for this command.
- The property still exists and is the conversion application's property.
- V1 supports `LEASE` only for `LONG_TERM_RENTAL` `STANDALONE` or `UNIT` properties.
- `COMPOSITE` roots are not direct lease targets.
- Sale, short-term booking contracts, `MANAGEMENT`, and `OTHER` are excluded from this
  conversion path.
- At most one application-origin contract exists per conversion/application.
- Replays return the canonical existing contract.
- Contract creation does not change the application, client, availability, occupancy,
  publication, or composition.
- Existing contract reference and date invariants continue to apply.

## Transaction and Concurrency Requirements

One PostgreSQL transaction must:

1. establish tenant context;
2. load and lock the tenant/property/application;
3. verify `APPROVED`;
4. load and lock or deterministically read its conversion;
5. return the existing origin/contract on replay;
6. load and revalidate the property;
7. create the `PropertyContract` draft using the converted client;
8. insert the immutable origin relation;
9. commit both writes atomically.

Use `SELECT ... FOR UPDATE` on the application or conversion row as the serialization
point. A tenant/application unique constraint is the final duplicate boundary. Concurrent
commands must return the same logical contract, never create two drafts. Any validation,
constraint, or persistence failure must roll back contract and origin together.

Activation continues to lock the contract row. For application-origin contracts it
must revalidate intact tenant/property/client origin and existing domain eligibility.
Activation replay returns the current active contract.

## Authorization Model

- Add `CREATE_PROPERTY_CONTRACT_FROM_APPLICATION` for the new command.
- Reuse `RETRIEVE_PROPERTY_CONTRACTS` for reads.
- Reuse `UPDATE_PROPERTY_CONTRACT` for draft edits.
- Reuse `MANAGE_PROPERTY_CONTRACT_LIFECYCLE` for activation/end/cancel.
- Do not broaden `CREATE_PROPERTY_CONTRACT` implicitly.
- Never accept tenantId, application lineage IDs, or converted clientId from request
  bodies when derivable from the path and server-side relations.

## Persistence Requirements

Add an additive table such as
`property_management.property_application_contract_origins` with:

- primary key or unique key `(tenant_id, application_id)`;
- tenant-scoped FK to the application/client conversion;
- tenant-scoped FK to `(tenant_id, contract_id)`;
- property consistency enforced through a composite FK or an equivalent normalized
  tenant/property/application key;
- unique `(tenant_id, contract_id)` so a contract has at most one application origin;
- forced tenant RLS;
- runtime `SELECT, INSERT` only; no update/delete;
- only indexes required by application and contract lookup.

If composite FK enforcement requires adding tenant/property/application uniqueness to
the source table, do so additively. Do not modify historical migrations.

## Proposed API Surface

Add one private creation route:

`POST /v1/properties/{propertyId}/applications/{applicationId}/contract`

Strict body:

- `reference`
- `startDate` optional for draft creation but required before activation
- `endDate` optional
- `notes` optional

The command derives `clientId` and fixes `contractType` to `LEASE` for V1. It returns
the existing `PropertyContractResponse` and returns that same contract on replay.

Reuse all existing contract list/detail/update/lifecycle routes. Do not add another
contract listing or duplicate activation endpoint. The existing activation route remains:

`POST /v1/properties/{propertyId}/contracts/{contractId}/activate`

Errors follow current Problem Details conventions: validation 400, authentication 401,
authorization 403, inaccessible lineage 404, eligibility/uniqueness/lifecycle 409.

## Property Workspace Integration

- On a converted approved application without an origin contract, show
  **Créer le contrat**.
- The form identifies the converted client without an arbitrary client selector.
- Explain that V1 creates a **Bail** for a long-term rental.
- After creation, show reference and **Brouillon** status and link/select it in the
  existing Clients et contrats section.
- Reuse existing draft edit, **Activer**, **Terminer**, and **Annuler** actions.
- Show the originating candidature where useful, without exposing opaque lineage IDs
  as the primary user label.
- Preserve French loading, success, validation, forbidden, not-found, and conflict states.
- Do not imply that activation changes availability or occupation.

## OpenAPI / SDK Requirements

- Add the conversion-aware POST operation and strict request schema.
- Reuse `PropertyContractResponse` rather than duplicate it.
- Document idempotent replay and conflict cases.
- Regenerate and contract-test `engineering/contracts/http/openapi.json`.
- Extend the Web/API client and any generated SDK only with the new creation method.
- Keep opaque cursor contracts and existing contract routes unchanged.

## Required Test Strategy

### Domain and application

- eligible converted approved application creates a lease draft;
- client and lineage are derived server-side;
- submitted, rejected, withdrawn, missing conversion, wrong property, composite root,
  sale, and short-term property are rejected;
- replay returns the same contract;
- no availability/occupancy mutation occurs;
- activation requires start date and revalidates eligibility;
- existing end/cancel transitions remain correct.

### PostgreSQL

- contract and origin commit atomically;
- forced failure rolls both back;
- composite tenant/property/application/client/contract references reject mismatches;
- one origin contract per conversion;
- concurrent commands converge on one contract;
- wrong tenant remains invisible under forced RLS;
- runtime cannot update/delete origin provenance;
- existing contract reference and lifecycle constraints remain effective.

### API and contracts

- success and idempotent replay;
- strict body and UUID validation;
- 401, 403, 404, and 409 behavior;
- wrong property/application relation and cross-tenant isolation;
- no caller-supplied clientId/tenantId/type;
- OpenAPI schema and route regression checks.

### Web

- eligible CTA, form, loading and success;
- existing contract shown on reload;
- no arbitrary client selector;
- French validation and API errors;
- permissions and ineligible property states;
- existing contract lifecycle actions remain usable.

## Explicitly Deferred Scope

- sale contracts and conveyancing;
- short-term reservation/booking contracts;
- availability or occupancy automation;
- payments, deposits, invoicing, accounting, FNE;
- documents, PDFs, signature, KYC, credit scoring;
- notifications and calendar integration;
- CRM, generic workflow, reservation, commissions, owner payouts;
- renewals, amendments, legal document management.

## Risks and Architectural Considerations

- Keeping the generic contract form unchanged could still allow operators to bypass
  application lineage for candidate leases. Product wording must distinguish manual
  contracts from application-origin contracts; a later policy may restrict generic
  `LEASE` creation once migration needs are known.
- Tenant-wide reference uniqueness can conflict with operator-generated references;
  replay identity must be application-based, not reference-based.
- Activation revalidation must not acquire locks in an order inconsistent with creation,
  or it may introduce deadlocks.
- Adding availability side effects before future-dated and overlapping contract rules
  exist would create incorrect occupancy state.
- `MANAGEMENT` and `OTHER` remain valid generic contract types but are not valid outputs
  of the application conversion journey.

## Future Task Definition

### TASK-086 — Property Contract Creation & Activation Vertical Slice

Implement the conversion-aware long-term lease contract slice defined above:

- application-origin relationship and PostgreSQL constraints;
- atomic, locked, idempotent creation from an approved client conversion;
- reuse of `PropertyContract` and existing activation lifecycle;
- dedicated authorization and private API;
- minimal French Workspace integration;
- OpenAPI/client updates;
- focused domain, application, HTTP, contract, PostgreSQL/RLS/concurrency, and Web tests.

Do not create contracts during TASK-084 conversion. Do not create a new contract
aggregate. Do not mutate availability or occupancy.

## Acceptance Criteria for TASK-086

- An authorized operator can create one lease draft from an approved, converted
  application for its exact tenant and property.
- The server derives the exact converted client and `LEASE` type.
- Only long-term rental `STANDALONE` or `UNIT` targets are eligible.
- Contract and immutable origin are atomic.
- Replays and concurrent requests return one canonical contract.
- PostgreSQL prevents duplicate and cross-tenant/mismatched lineage.
- Existing contract reads, edits, activation, ending, and cancellation are reused.
- Activation requires a start date and preserves existing locked lifecycle behavior.
- No contract creation or lifecycle command changes availability or occupancy.
- The Workspace provides a French application-to-contract path and retains existing
  contract management.
- OpenAPI and API client contracts are updated without breaking existing routes.
- Domain, application, PostgreSQL, RLS, concurrency, HTTP, contract, and Web tests pass.
- No payment, sale, reservation, document, notification, accounting, or CRM capability
  is introduced.
