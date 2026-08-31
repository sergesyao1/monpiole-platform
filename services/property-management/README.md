# services/property-management

## Purpose

Own the Property real-estate bounded context.

## TASK-034 baseline

The service owns the tenant-bound `Property` aggregate and the
`property_management.properties` PostgreSQL table. Create and retrieve use cases
derive ownership from authenticated authority, never request payloads. The
PostgreSQL adapter uses tenant-scoped transactions and forced RLS. Publication,
search, pricing, object storage, upload, broad media lifecycle, availability,
and workflow are outside this baseline.

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

The generic Property creation and persistence boundary accepts only
`STANDALONE` Properties. A Unit can be created only by the composition use case,
which builds a `PropertyBuildingUnit` domain relation and persists the Unit and
its parent relation atomically. Loading or modifying a Unit through the generic
repository rehydrates and validates its unique relation; an orphan or ambiguous
persisted Unit is reported as corruption, and generic updates cannot mutate a
structural role. The first Building remains the sole supported transition to
`COMPOSITE`.

Migration `0006_property_composition.sql` is paired with its Drizzle snapshot.
The PostgreSQL integration suite exercises the explicit `0005` to `0006`
upgrade with historical data and verifies the resulting role, constraints,
indexes, and forced-RLS policies. No trigger is used: supported write and load
boundaries enforce the cross-table role/relation invariant under the existing
tenant-scoped locks, while foreign keys and unique constraints provide the SQL
defence for relation identity and cardinality.

## Property publication lifecycle

`PublishProperty` performs the single supported transition from `DRAFT` to
`PUBLISHED` under the dedicated `PUBLISH_PROPERTY` grant. A Property is eligible
when its existing details, compatible commercial terms and exactly one
content-backed AVAILABLE primary photo are present. The selected photo counts
in both the applicable minimum and its category. Description, ownership, a
100% ownership total and composition are not publication prerequisites. Standalone, composite and Unit
Properties publish independently, with no cascade and no Building publication.

The PostgreSQL repository serializes the transition with its existing
tenant-scoped row lock. A replay returns the same published aggregate without a
write or a new clock value. `published_at`, `published_by_actor_id` and
`publication_correlation_id` preserve the first-publication evidence while the
generic actor and correlation columns continue to describe the last mutation.
Existing core, details, ownership and composition mutations remain available
after publication and preserve its status and date. Unpublish, archive,
republish, public projection and publication events are not part of this slice.

Migration `0007_property_publication.sql` preserves historical drafts, expands
the status constraint, enforces the publication trace tuple and adds the
tenant/status portfolio index. Before generating it, CG-01 was closed by
representing all existing Property Management CHECK constraints, RLS enablement
and tenant policies in `schema.ts` and snapshot `0007`. PostgreSQL `FORCE ROW
LEVEL SECURITY` remains explicit in the historical SQL migrations because
Drizzle snapshots do not model it; integration tests verify enabled/forced RLS,
named policies and constraints for all five tables on empty-to-head and
`0006 → 0007` paths.

## Property primary photo

Migration `0008_property_management_baseline.sql` adds tenant-owned
`property_photos` and append-only `property_primary_photo_audits`. A composite
foreign key binds every photo to its Property and tenant, an AVAILABLE-only
CHECK bounds this slice, and a partial unique index guarantees at most one
primary photo per Property. Both tables enable and force RLS with named tenant
policies. A deletion trigger rejects a primary photo until another photo has
been selected; a second trigger keeps the audit immutable. Deferred constraint
triggers also require every PUBLISHED Property to finish its transaction with
exactly one AVAILABLE primary photo, including for direct SQL writes.

`SelectPropertyPrimaryPhoto` locks the parent Property, verifies the target is
AVAILABLE under the same tenant and Property, clears the previous marker, sets
the replacement and appends the actor/correlation/status audit in one
transaction. Parent locking serializes concurrent selectors; the partial unique
index is the final database defence. Replacement remains allowed after
publication and records `PUBLISHED` in the audit.

Migration `0009_property_management_baseline.sql` leaves `0007` and `0008`
unchanged and adds actual JPEG/PNG/WebP content evidence, `STUDIO | MULTI_ROOM`,
tenant photo standards and a versioned deferred publication guard. New photos
are stored with canonical base64 content, decoded byte size and SHA-256; legacy
URL-only rows remain readable as historical data but are excluded from
readiness and private galleries. The private content endpoint returns the
persisted bytes. There is no functional maximum photo count.

The MonPiole baseline is one photo except for `APARTMENT + LONG_TERM_RENTAL`,
which requires six. Studio requires building exterior/entrance, a combined
living/sleeping main area, kitchen/kitchenette and bathroom/shower room.
Multi-room requires exterior/entrance, living/main room, kitchen,
bedroom/sleeping area and bathroom/shower room. Count and required-category
checks are independent. Tenant standards may only increase the minimum and add
required categories; resolution uses `max` plus category union. The repository
reloads that standard with the photos inside the locked publication
transaction. Image transformation, CDN lifecycle and public catalogue
projection remain separate capabilities.

## Catalogue public tenant-scoped

TASK-058 ajoute une frontière de lecture publique dédiée sans réutiliser le
portfolio privé ni sa représentation. `ListPublicProperties`,
`RetrievePublicProperty` et `RetrievePublicPrimaryPhoto` reçoivent explicitement
le tenant déjà résolu à la frontière HTTP. Leur adapter PostgreSQL applique
encore les prédicats `tenant_id` et `PUBLISHED` dans une transaction portant
`SET LOCAL app.tenant_id`.

La migration append-only `0011_public_property_catalog_read_boundary.sql`
ajoute l’index keyset partiel, deux policies RLS restrictives et uniquement des
grants `SELECT` par colonne au rôle pré-provisionné
`monpiole_public_catalog_reader`. Ce rôle est distinct de `monpiole_runtime`,
sans écriture ni `BYPASSRLS`, et ne peut lire ni adresse exacte, owners,
ownerships, composition, standards ou audits. Les publications historiques
sans photo content-backed restent visibles avec une photo principale nulle.

Le login et son credential sont provisionnés par Operations avant la migration,
jamais créés ou stockés dans le dépôt. La diffusion globale cross-tenant,
l’écriture publique, la recherche libre, les Buildings et le graphe de
composition restent interdits.
