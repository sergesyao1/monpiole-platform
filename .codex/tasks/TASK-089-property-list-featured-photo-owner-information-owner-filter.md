# TASK-089 — Property List Enhancement: Featured Photo, Owner Information & Owner Filter

## Status

DONE.

## Context and initial limitations

The authenticated `/properties` portfolio already supported tenant-scoped cursor pagination, property type/status filters, quick search and navigation to Property Workspace. Its cards exposed no canonical image or ownership information, and the API list projection did not support owner filtering or owner-name search.

## Scope delivered

- Canonical selected primary photo on every applicable portfolio card.
- Stable no-photo fallback with meaningful accessible text.
- Available gallery photo count.
- Deterministic owner summary, optional phone and email.
- Tenant-scoped owner selector.
- Owner association filter.
- Owner-name quick search in addition to existing property/location search.
- Existing status/type filters, cursor pagination and Property Workspace link preserved.

## Canonical sources

### Featured photo

`property_management.property_photos` remains the sole source of truth. The portfolio query only selects an `AVAILABLE` row with `is_primary = true`; it never infers a photo from gallery order. The existing unique partial index guarantees at most one primary photo per tenant/property.

The private list read model embeds the selected photo content and content type. This preserves bearer-authenticated privacy while keeping the initial Web portfolio to one list request rather than adding one authenticated content request per card. A future thumbnail capability should replace full-size embedded content when image derivatives exist.

### Ownership

`property_ownerships` and `property_owners` remain canonical. No primary-owner concept was invented. When several owners exist, the first assignment under the existing deterministic order (`ownership.created_at`, then `owner_id`) is displayed as `Nom + N autre(s)`. Full ownership remains available in Property Workspace.

No technical owner identifier is rendered in the UI. The identifier remains present in the private machine contract because it is the stable value used by the owner filter.

## Read model and API

`GET /v1/properties` remains the single portfolio endpoint. Its items add:

- `featuredPhoto?: { photoId, contentType, contentBase64 }`;
- `photoCount`;
- `owner?: { ownerId, displayName, phoneNumber?, email?, additionalOwnerCount }`.

The query adds optional `ownerId` (UUID). It is parsed and validated server-side. Tenant identity is still derived exclusively from authenticated authority with `LIST_PROPERTIES`; no client tenant identifier is accepted.

An unknown or cross-tenant valid owner identifier produces an empty collection, never cross-tenant data or a resource-existence disclosure.

## PostgreSQL strategy

The projection executes within `withTenantPostgresTransaction` and existing RLS policies. It performs a fixed number of set-based reads per page:

1. filtered and cursor-paginated property rows;
2. selected primary photos for page property IDs;
3. available photo counts grouped by property;
4. ownerships joined to owners for page property IDs.

This shape is independent of card count and introduces no N+1 query pattern. Reads are sequential on the single transaction connection.

Owner filtering and owner-name search use tenant-constrained `EXISTS` predicates, so ownership joins cannot duplicate portfolio rows or perturb keyset pagination. Existing indexes cover tenant/property and tenant/owner associations. No speculative index or migration was added.

## Search and filter semantics

- Search input is trimmed and limited to 100 characters.
- Existing title, description, city, district and address matching remains case-insensitive.
- Individual first/last names and legal-entity names now participate in the same PostgreSQL `ILIKE` search.
- The owner dropdown reuses the authenticated Property Owner directory and follows its opaque cursors until complete.
- `ownerId`, type, status and search compose conjunctively.
- Applying filters resets the property cursor; loading more preserves all active filters.

## Web and responsive behavior

Cards use a stable 16:9 media area with `object-fit: cover`. Missing or invalid image content falls back without a broken-image icon. Alt text names the relevant property.

The compact owner block wraps long contact values, omits unavailable phone/email fields and uses `tel:`/`mailto:` links. The existing two-column portfolio collapses to one column on mobile. The expanded filter grid collapses at the established tablet/mobile breakpoints without horizontal overflow.

Owner-directory loading and failure are explicit in French. A directory failure disables only that selector; existing portfolio discovery remains usable.

## Authorization and isolation guarantees

- Tenant is derived from authenticated authority only.
- `LIST_PROPERTIES` remains mandatory.
- Property, photo, ownership and owner queries all constrain `tenant_id` and run behind RLS.
- Composite foreign keys keep photo/ownership associations tenant-consistent.
- Foreign owner UUIDs cannot broaden visibility.

## Tests

Coverage includes:

- application normalization, owner-filter forwarding and invalid owner identifier;
- HTTP query validation, authorization and owner filter forwarding;
- contract parsing for enriched items and owner query;
- PostgreSQL canonical primary photo, no-photo preservation, photo count, deterministic multiple-owner summary, owner-name search, owner filter, foreign-owner isolation and duplicate-free cursor pagination;
- Web primary image, fallback, count, owner/contact rendering, identifier non-rendering, owner selector/filter, existing filters, pagination/error preservation and navigation.

## Files and migration

The implementation changes the Property portfolio application port/use case/query, API schema/controller/OpenAPI, Web model/API/page/styles/tests, shared tests and this report. No migration is required.

## Deferred enhancements

- Generated, size-bounded portfolio thumbnails and cache-aware image delivery.
- Owner selector virtualization or server-side autocomplete for very large directories.
- Phone/email owner quick search, deliberately excluded because name search satisfies V1.

## Validation results

- Targeted unit/API/Web tests: PASS — 3 files, 44 tests.
- Global TypeScript: PASS — 9 workspace projects.
- Test TypeScript compilation: PASS.
- Unit tests: PASS — 37 files, 261 tests.
- HTTP/integration tests: PASS — command exited with code 0.
- Contract/OpenAPI tests: PASS — 24 files, 106 tests.
- Property PostgreSQL integration: PASS. The run covering the new assertions exited with code 0. A second run requested after changing same-connection reads from parallel to sequential was rejected before execution by the command approval service; the final global typecheck and tests pass.
- Web tests: PASS — 29 files, 167 tests.
- Web production build: PASS — 175 modules transformed.
- Property migration check: PASS — `Everything's fine`.
- Architecture check: PASS — workspace, exports, resolver, graph, boundaries, cycles and diagnostics.
- Global test command: PASS — exited with code 0.
- OpenAPI generation and synchronization check: PASS.
- `git diff --check`: PASS — exit code 0.

## Recommended TASK-090

TASK-090 — Property Portfolio Thumbnail Derivatives & Cache-Aware Media Delivery.
