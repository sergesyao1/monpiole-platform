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
