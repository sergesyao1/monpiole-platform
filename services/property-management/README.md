# services/property-management

## Purpose

Own the Property real-estate bounded context.

## TASK-034 baseline

The service owns the tenant-bound `Property` aggregate and the
`property_management.properties` PostgreSQL table. Create and retrieve use cases
derive ownership from authenticated authority, never request payloads. The
PostgreSQL adapter uses tenant-scoped transactions and forced RLS. Publication,
search, pricing, media, availability, and workflow are outside this baseline.

