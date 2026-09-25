# TASK-093 — First-Class Building & Real-Estate Hierarchy Audit + Vertical Slice

Status: DONE.

## Audit of the starting model

- `Property` was the only commercial object. Its structural role was `STANDALONE`, `COMPOSITE`, or `UNIT`.
- `property_buildings` represented a physical child of a Property, not a Property itself. A Building had no independent workspace, price, availability, ownership, publication, or contract target.
- `property_building_units` attached a `UNIT` Property to one Building. Existing independent apartments remained `STANDALONE`.
- The legacy first-Building workflow changed a standalone Property to `COMPOSITE`. TASK-092 made this visible only within a composite workspace.
- TASK-090 lease eligibility used the containing Property as the lock/conflict root. Existing rows and IDs must retain this interpretation.
- Pricing, ownership, photos, publication, clients, and contracts are keyed by canonical Property ID. Adding equivalent state to `property_buildings` would duplicate commercial truth.

## Options and decision

- A, child Building plus dedicated workspace: requires parallel commercial identity and would duplicate existing Property capabilities.
- B, replace Building with a Property subtype: attractive eventually but rewrites the established relation, APIs, and historical rows.
- C, link the existing structural Building to a canonical `BUILDING` Property: selected as the additive V1 path. A Building Property owns commercial state; the structural row organizes units and retains its code. Legacy unlinked rows remain valid.
- Direct children of a `COMPLEX` are represented by a separate `property_complex_children` association. The child remains its own Property rather than a fake Building or Unit. Existing standalone Properties are not silently attached.

## Implemented model

- New canonical Property types: `OFFICE`, `SHOP`, `BUILDING`, `COMPLEX`; existing `COMMERCIAL` remains valid.
- Direct Building creation creates a `COMPOSITE` Property and its structural Building row (`MAIN`) in one tenant transaction.
- Complex creation creates a `COMPOSITE` Property with no Building initially. Adding a Building creates a separate canonical `BUILDING` Property and linked structural row in one tenant transaction.
- `property_buildings.building_property_id` is nullable for legacy rows, with tenant-scoped FK and tenant-scoped unique index. No destructive backfill or reinterpretation.
- A `UNIT` remains a canonical Property. `BUILDING` and `COMPLEX` are rejected as Unit types in domain and HTTP input validation.
- Composition reads accept either the historical parent Property ID or the linked Building Property ID, tenant-scoped. Unit workspace parent navigation and inherited geolocation prefer the linked Building Property; legacy rows still use the historical parent.
- Availability aggregation includes linked Building units. Lease eligibility counts linked rows and uses the Building Property as the conflict root for new units. Existing unlinked rows retain their old root.
- The Web creation form offers the new types. Complex composition links to each Building workspace. A Building workspace offers Unit creation and never offers `Ajouter un immeuble`. Independent Property and Unit workspaces retain read-only composition.
- A `BUILDING` has an explicit, creation-time `commercializationMode`: `WHOLE_BUILDING` or `INDIVIDUAL_UNITS`. No mode-switch workflow exists in V1. Building Properties under a residence have the same modes as independent Buildings.
- `WHOLE_BUILDING` owns direct pricing and availability, can publish when ready, and can be a whole-building lease target. Its Units cannot be individually priced, published, or leased.
- `INDIVIDUAL_UNITS` has derived availability, cannot own pricing or publish as an individual listing, and leaves eligible Units as the commercial targets.
- A `COMPLEX` is a non-publishable/non-tariffable structural container in V1. Direct Villas and Apartments retain their own pricing, availability, publication, and contract identity.
- Server-side publication, pricing, and lease checks use the same persisted mode. Legacy unlinked composition retains TASK-090 semantics.
- Complex workspaces list Buildings and direct individual children separately. Children and linked Buildings open their canonical workspaces; direct child and Building workspaces can navigate back to the residence.

## V1 publication matrix

| Object | Listing target |
| --- | --- |
| Independent Villa or Apartment | The Property itself |
| Villa or Apartment directly in a Residence | The child Property itself |
| Building `WHOLE_BUILDING`, independent or in Residence | The Building Property |
| Units of Building `WHOLE_BUILDING` | Not individually publishable |
| Building `INDIVIDUAL_UNITS` | Not publishable as a listing |
| Eligible Units of Building `INDIVIDUAL_UNITS` | Each Unit Property |
| Residence / Complex | Not publishable in V1 |

## Security and migration

- Tenant ID comes from authenticated authority in application use cases, never from Web input.
- PostgreSQL writes run in tenant-scoped transactions; Building and direct-child creation lock the parent row. Existing RLS policies and table grants apply to the additive nullable Building link.
- Migration `0025_property_management_baseline.sql` extends the Property type check and adds the linked Property column, composite FK, and unique index.
- Migration `0026_property_management_baseline.sql` adds the mode/checks, direct-child table, tenant-scoped FKs, uniqueness, forced RLS, and runtime grants. No backfill or existing ID rewrite is performed.
- The private API accepts a Building mode at creation and exposes `POST`/`GET /v1/properties/{propertyId}/children` for direct Residence children, with strict validation, opaque pagination, authorization, and Problem Details.

## Compatibility and remaining gaps

- Canonical Building pricing, publication, photos, ownership, and contract targets reuse existing Property workflows. No ownership is implicitly copied from a Complex to Building or Unit.
- TASK-090 active-lease conflict queries use the canonical Building Property as the new lock root. Historical active lease conflict tests remain; new persisted-mode tests prove whole-versus-unit eligibility and cross-tenant isolation.
- The historical Building-create API can still convert a standalone Property to a composite one; the normal independent apartment workspace does not expose that action. Removing that API behavior requires an explicit compatibility decision.
- Structural Building name is an organization label, while canonical Building Property title is the listing/workspace title. They may diverge after edits; this is display metadata, not duplicated commercial state.
- Existing Property types `COMMERCIAL` and `OTHER` remain in the creation form for compatibility, although the new `SHOP` type provides the requested dedicated category.
- Ownership remains explicit per Property. No inheritance or duplication is introduced. Existing independent Properties cannot be attached later in V1; creation starts from the desired parent.

## Validation

- Property service, API, Web, and test TypeScript checks passed.
- Property migration check passed.
- Property PostgreSQL integration: 5 files, 104 tests passed, including direct children, modes, linked Units, RLS and tenant isolation.
- Unit: 37 files, 264 tests passed.
- HTTP/API integration: 30 files, 231 tests passed. The new association was added to the runtime test cleanup so PostgreSQL does not retain stale rows between cases.
- Web: 29 files, 173 tests passed, including Building navigation and direct Residence children.
- OpenAPI regenerated successfully; Web production build passed (176 modules transformed).
- Contract suite: 24 files, 106 tests passed. Architecture verification passed.
- Global suite: 128 files, 905 tests passed.
- `git diff --check` passed.
- No commit or push performed. TASK-092 changes present at start were preserved.
