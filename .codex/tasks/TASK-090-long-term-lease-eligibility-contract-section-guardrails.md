# TASK-090 — Long-Term Lease Eligibility & Contract Section Guardrails

Status: DONE

## Context and scope

TASK-086 allowed a LEASE only for a long-term rental Property whose structural role was not COMPOSITE. That excluded a whole building even when the parent Property was commercially configured for rental. The Property Workspace also linked to Contracts for ineligible properties. This task changes only lease targeting, activation conflict protection, and that workspace guardrail. Existing contract IDs and `propertyId` targeting remain unchanged.

## Canonical target rules

- A STANDALONE Property with `transactionType=LONG_TERM_RENTAL` is eligible.
- A UNIT Property with `transactionType=LONG_TERM_RENTAL` and an attached `property_building_units` row is eligible; its own `propertyId` is the target.
- A COMPOSITE Property is eligible as a whole-building target only if it has exactly one Building and its own `commercialKind=LONG_TERM_RENTAL` (configured long-term rental terms). This does not infer whole-building rental from the existence of a Building or from a child's project.
- Any other transaction type, including SALE, is ineligible. An unattached UNIT and an unconfigured or multi-building COMPOSITE are invalid rental targets.
- The server assesses these conditions from tenant-scoped PostgreSQL state. The workspace exposes `leaseEligibility: { eligible: true } | { eligible: false, reasonCode }` with `NOT_LONG_TERM_RENTAL` or `INVALID_RENTAL_TARGET`.

## Conflict and lifecycle

Drafts may coexist only while no related lease is ACTIVE. MonPiole V1 does not support preparation of future leases while a lease is ACTIVE on the same rental target. Future planned leases are deferred to a later contract-period scheduling capability. Creation and DRAFT→ACTIVE both reject any related ACTIVE LEASE, regardless of proposed dates. A whole-building lease checks all attached child UNIT Properties; a UNIT lease checks its parent whole-building Property, not sibling units. ENDED and CANCELLED contracts do not block new creation, consistent with the existing status model.

Creation and activation run within tenant transactions and lock the root Property before checking ACTIVE leases. Competing whole-building and unit operations therefore serialize on the same root row. The existing `PROPERTY_CONTRACT_PERIOD_CONFLICT` code maps to HTTP 409 for compatibility, although V1 now blocks by ACTIVE status rather than date overlap. Existing authorization, tenant authority, tenant-scoped relations, and RLS remain in force. No migration is required.

## Workspace UX

The Contracts navigation item remains visible but is disabled for structurally ineligible targets, as is the header command. The section shows a French reason instead of mounting contract actions. For an eligible target temporarily blocked by an ACTIVE lease, the section remains accessible and existing contracts remain visible; only `Nouveau contrat` is disabled, with a French explanation. `leaseEligibility.blockedByActiveLease` comes from the server, not browser-side inference. Other workspace sections remain available.

## Validation

- Service, API, Web and test typechecks: passed.
- TASK-090 follow-up: targeted domain/unit, HTTP, PostgreSQL, and Web run: 5 files / 53 tests passed. Focused OpenAPI contract: 1 file / 4 tests passed. Service, API, Web, and tests typechecks passed. Web build and OpenAPI generation passed.
- Web build and `git diff --check`: passed.
- No migration, commit, or push.

## Deferred

Availability and occupancy synchronization, short-term or sale contracts, billing, documents, and generic scheduling are out of scope. A building with multiple Building records has no single canonical `propertyId` target under the current contract model and remains ineligible for a whole-building lease.
