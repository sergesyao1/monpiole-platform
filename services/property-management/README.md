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
