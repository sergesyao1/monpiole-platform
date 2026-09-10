# TASK-086 — Property Contract Creation & Activation Vertical Slice

## Status

DONE

## Implemented flow

`Inquiry -> Viewing -> PROCEED -> Application.APPROVED -> Conversion ->`
`PropertyClient -> PropertyContract.DRAFT -> explicit ACTIVE`

## Domain and application

The existing `PropertyContract` aggregate and lifecycle remain authoritative. The new
`CreatePropertyContractFromApplication` use case accepts only the existing editable
contract terms: reference, optional start/end dates, and optional notes. Tenant comes
from authority; client and `LEASE` type are derived server-side.

V1 accepts only approved, converted applications targeting `LONG_TERM_RENTAL`
`STANDALONE` or `UNIT` properties. `COMPOSITE`, sale and short-term targets are rejected.
Creation always produces `DRAFT`. Existing explicit activation remains unchanged,
requires a start date, locks the contract, and is idempotent when already active.

## Provenance and persistence

Migration `0024_property_management_baseline.sql` adds the immutable
`property_application_contract_origins` relation. Its tenant/application primary key
enforces one canonical contract per conversion. Tenant-scoped foreign keys reference
the application/client conversion and contract; contract IDs are independently unique
per tenant. RLS is enabled and forced. Runtime receives `SELECT, INSERT` only.

Contract and provenance are inserted atomically. The PostgreSQL repository locks the
tenant/property/application row with `FOR UPDATE`, verifies approval, resolves the
conversion and its exact client, checks property eligibility, and looks up existing
provenance. Compatible replays return the existing contract; incompatible replays
conflict. The database keys are the final concurrency boundary.

## Authorization

The dedicated least-privilege grant is
`CREATE_PROPERTY_CONTRACT_FROM_APPLICATION`. Existing retrieval, draft update and
lifecycle grants continue to control subsequent operations. No request accepts tenantId,
clientId, conversion identity, or contract type.

## API and OpenAPI

Added:

`POST /v1/properties/{propertyId}/applications/{applicationId}/contract`

The strict request contains reference, optional dates and optional notes. The response
reuses the canonical `PropertyContractResponse`. Existing contract list/detail/update,
activate/end/cancel routes are unchanged.

## Web

An approved converted application now displays a compact French **Créer le contrat**
form. It identifies the derived client and fixed long-term lease type. Success displays
**Contrat brouillon** and directs the operator to the existing Clients et contrats area,
where explicit activation and all existing French lifecycle states remain available.

## Tests

- Application: valid draft, server-derived client, missing conversion, replay.
- HTTP: success, strict rejection of client substitution, missing conversion mapping.
- PostgreSQL: atomic provenance/contract creation, simultaneous request convergence,
  and one stored origin.
- Web: converted-client form and resulting draft.
- Existing PropertyContract lifecycle tests continue to cover activation, invalid
  transitions, replay, ending and cancellation.

## Boundaries

No payment, invoice, deposit, signature, document, sale contract, short-term reservation,
availability mutation or occupancy mutation was added. Generic contract creation remains
available and does not silently acquire application semantics.

## Recommended next step

`TASK-087 — Post-Contract Activation Product Readiness Audit & Occupancy Coordination Capability Definition`

This should audit future-dated starts, overlapping contracts, unit-level occupancy and
termination timing before any automatic availability/occupancy side effect is designed.
