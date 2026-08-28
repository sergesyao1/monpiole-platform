# services/property-management

## Purpose

Own the Property real-estate bounded context.

## TASK-034 baseline

The service owns the tenant-bound `Property` aggregate and the
`property_management.properties` PostgreSQL table. Create and retrieve use cases
derive ownership from authenticated authority, never request payloads. The
PostgreSQL adapter uses tenant-scoped transactions and forced RLS. Publication,
search, pricing, media, availability, and workflow are outside this baseline.

## TASK-035 details and commercial terms

`Property` optionally owns explicit physical details and exactly one commercial
terms variant compatible with its transaction type. Amounts are non-negative
safe integers in minor currency units; currency uses an uppercase ISO 4217
three-letter representation. Long-term rental uses monthly rent, optional
deposit and charges; short-term rental uses a nightly or weekly rate; sale uses
a sale price. `UpdatePropertyDetails` executes through one tenant-scoped,
row-locked PostgreSQL transaction. Existing properties without details remain
readable.

## TASK-037 property owner management

`PropertyOwner` is a tenant-owned aggregate distinct from `Property`, the
authenticated authority, and the tenant organization. It supports discriminated
`INDIVIDUAL` and `LEGAL_ENTITY` identities with optional validated contact
information. Owner identity type, owner ID, and tenant ID are immutable; contact
and identity details may be updated through a tenant-scoped, row-locked
transaction. PostgreSQL forced RLS protects the service-owned
`property_management.property_owners` table. Ownership assignment, shared
ownership, building/unit composition, and publication remain outside this slice.

## TASK-038 property ownership assignment

`PropertyOwnership` is an explicit tenant-scoped relation between `Property` and
`PropertyOwner`, identified naturally by `(tenantId, propertyId, ownerId)`. It
supports multiple owners per property, one owner across multiple properties,
and percentage shares from `0.01` through `100.00`; partial totals are valid but
the total for one property cannot exceed 100. PostgreSQL composite foreign keys,
a composite primary key, forced RLS, and a transaction-level lock on the target
Property enforce reference, uniqueness, tenant, and concurrency guarantees.
Assignment, listing by Property, and removal are supported. Share updates,
inverse Owner-to-Property listing, history, building/unit composition, and
publication remain outside this slice.

## Property core information update

`UpdatePropertyCoreInformation` replaces title, optional description and
location under the dedicated `UPDATE_PROPERTY_CORE_INFORMATION` grant. The
aggregate reuses creation invariants, while the PostgreSQL repository performs
the update atomically in the tenant-scoped transaction and preserves type,
transaction type, status, details, commercial terms and ownerships. A missing
or cross-tenant Property remains indistinguishable through `PropertyNotFoundError`.

## Property portfolio listing

`ListProperties` exposes a private tenant portfolio through a dedicated query
port. It requires `LIST_PROPERTIES`, derives the single tenant from the internal
authority, and never accepts a tenant identifier from the caller. The
PostgreSQL adapter applies forced RLS, optional status/type filters, bounded
text discovery and keyset pagination ordered by `createdAt DESC, propertyId
DESC`. The projection deliberately excludes details, commercial terms and
ownership relations.

The default page size is 20 and the server maximum is 100. Search covers the
existing title, description, city, district and address fields using a
parameterized PostgreSQL `ILIKE`; it is a private bounded convenience search,
not a public full-text engine.

## Property owner directory

`ListPropertyOwners` exposes a tenant-scoped directory through a dedicated read
port and PostgreSQL keyset query. It requires `LIST_PROPERTY_OWNERS`, orders by
`(createdAt DESC, ownerId DESC)`, supports bounded identity search, and returns
the existing public Owner representation without tenant or persistence fields.

## Property composition

A standalone Property can become `COMPOSITE` when its first Building is created.
Buildings are structural entities identified by a code unique inside the parent
Property. Units remain full Properties with structural role `UNIT` and belong to
exactly one Building through a tenant-scoped relation. The model is deliberately
non-recursive and exposes no move, detach, deletion, or reverse transition.

Creation and structural updates use tenant-scoped PostgreSQL transactions and
parent row locks. Composite foreign keys, unique constraints, and forced RLS
enforce tenant ownership and attachment invariants. Building and Unit lists use
deterministic keyset pagination; their cursors are transport-opaque.
