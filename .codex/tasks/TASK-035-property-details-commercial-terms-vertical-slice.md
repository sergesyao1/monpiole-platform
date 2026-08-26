# TASK-035 — Property Details & Commercial Terms Vertical Slice

## Status

DONE

## Objective

Extend the tenant-owned Property aggregate with explicit physical details and
transaction-compatible commercial terms, persisted atomically and returned by
the authenticated Property API.

## Implemented contract

- `PUT /v1/properties/{propertyId}/details` defines or replaces details and
  commercial terms and returns the canonical Property representation.
- `GET /v1/properties/{propertyId}` exposes persisted details and terms.
- Existing properties without the optional pair remain readable.
- The request has no `tenantId`; tenant ownership is resolved from exactly one
  trusted `AuthenticatedAuthority` tenant scope.
- Grant `UPDATE_PROPERTY_DETAILS` is required before repository access.
- Unknown and cross-tenant properties both return 404 without disclosure.

## Domain model

- Details support positive usable surface, non-negative integer room/bedroom/
  bathroom counts, and furnished status. At least one detail is required and
  bedrooms cannot exceed rooms when both are supplied.
- Amounts are non-negative safe integers in minor currency units.
- Currency is an uppercase three-letter ISO 4217 representation.
- `LONG_TERM_RENTAL` requires monthly rent and permits deposit and charges.
- `SHORT_TERM_RENTAL` requires a rate priced by `NIGHT` or `WEEK`.
- `SALE` requires a sale price.
- Commercial kind must equal the immutable Property transaction type.

## Architecture and persistence

- Domain/Application remain independent from HTTP, NestJS, Drizzle and PostgreSQL.
- Application uses the existing Property repository port and generic authenticated
  authority boundary; no parallel authentication or tenant context is introduced.
- Repository update is one tenant-scoped `READ COMMITTED` transaction with
  `SELECT FOR UPDATE`, Domain mutation and SQL update.
- Migration `0001` adds nullable detail/terms columns for backward compatibility
  and database checks that reject negative, mixed, incomplete or transaction-
  incompatible commercial representations.
- No publication, search, media, booking, billing, subscription or workflow is added.

## Front-end language

TASK-035 adds no UI. Future user-visible presentation remains French under the
TASK-034 rule. Technical enums remain API values; `MONTH`, `NIGHT`, and `WEEK`
must be presented as `Mensuel`, `Nuit`, and `Semaine` respectively.

## Verification evidence

- `corepack pnpm typecheck:tests`: passed.
- `corepack pnpm app:api:typecheck`: passed.
- `corepack pnpm service:property-management:typecheck`: passed.
- `corepack pnpm app:api:build`: passed.
- `corepack pnpm service:property-management:build`: passed.
- `corepack pnpm architecture:check`: passed.
- `corepack pnpm service:property-management:migration:check`: passed.
- `corepack pnpm service:property-management:test:integration`: 1 file,
  8 tests passed.
- `corepack pnpm test:unit`: 10 files, 58 tests passed.
- `corepack pnpm test:integration`: 10 files, 59 tests passed.
- `corepack pnpm test:contract`: 9 files, 57 tests passed.
- `corepack pnpm app:api:contracts:check`: 9 files, 57 tests passed.
- `corepack pnpm test`: 33 files, 205 tests passed.
- `git diff --check`: passed.
- Root `pnpm typecheck` and `pnpm lint` scripts do not exist; the repository-owned
  scoped typechecks and architecture gate above were used instead.

## Completion gate

Set `DONE` only after unit, PostgreSQL, API, contract, migration, architecture,
typecheck/build, complete regression, and Git diff checks pass.

All applicable implementation gates passed. Final Git whitespace and status
evidence is reported during delivery review; no commit is performed by this task.
