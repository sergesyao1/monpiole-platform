# apps/api

## Purpose

Public API edge application.

## Ownership

API Platform owns this area and approves changes affecting its responsibilities.

## Conventions

Version external contracts, propagate tenant and correlation context, and keep business logic in services or packages.

## Expected contents

API routing, authentication adapters, OpenAPI delivery assets, and edge tests.

## TD-005 executable baseline

This workspace is the reference NestJS composition root. NestJS dependencies,
decorators, and HTTP abstractions stay within this outer application boundary;
service-owned Domain and Application layers remain framework-independent.

TASK-015 initially exposed only the operational `GET /health` endpoint and did
not select the later TD-006 transport-contract baseline.

## TD-006 executable contract baseline

TASK-017 adds a deliberately non-business `POST /api/v1/contract-baseline`
fixture. Canonical Zod schemas live under `src/contracts`; NestJS wrappers,
validation, response serialization, request-context transport handling, and
RFC 9457 adaptation live under `src/http`; OpenAPI 3.1 assembly and
normalization live under `src/openapi`.

`engineering/contracts/http/openapi.json` is the single generated JSON review
artifact. Run `corepack pnpm app:api:openapi` to reproduce it and
`corepack pnpm app:api:contracts:check` to verify schema and OpenAPI behavior.
No Swagger UI route is exposed.

This technical fixture does not authenticate or authorize callers, implement
Tenant Onboarding, create tenant authority, persist idempotency state, or add
business behavior. Transport values are explicitly mapped to plain values;
Domain and Application layers remain independent of Zod and NestJS tooling.

## TASK-031 authenticated authority boundary

All Tenant Onboarding mutation controllers resolve an authenticated authority
through an injected API-boundary provider. Missing authentication is rejected
with Problem Details 401 before a use case is called. The trusted authority is
mapped separately from tenant path context and target administrator identity;
service Application ports enforce operation grants and tenant scope before
reads or side effects. Normal runtime deliberately has no implicit provider and
therefore fails closed until an approved production authentication adapter is
selected and injected.

## TASK-033 authentication security baseline

ADR-0007 selects managed OpenID Connect with Auth0 Public Cloud as the reference
provider. The provider-neutral JOSE adapter requires an exact HTTPS issuer,
audience and JWKS source, `RS256`, signature, expiration, issued-at, maximum age,
and subject before producing `VerifiedAuthenticationContext`.

Provider claims do not grant tenant scope or business authority. MonPiole maps
`issuer + subject` to internal state and derives grants and tenant scopes there.
Invalid or unresolved credentials use 401 Problem Details; authenticated
authorities rejected by Application policy receive 403. Tokens and
Authorization headers must never be logged.

### TASK-040 runtime composition and browser readiness

The normal PostgreSQL runtime now composes `OidcAccessTokenVerifier`,
`OidcAuthenticatedAuthorityProvider` and Identity's durable
`PostgresExternalIdentityStore`. Startup requires the following public
configuration in addition to `DATABASE_*`:

```text
AUTHENTICATION_ISSUER=https://<tenant>.eu.auth0.com/
AUTHENTICATION_AUDIENCE=https://api.monpiole.local
AUTHENTICATION_JWKS_URI=https://<tenant>.eu.auth0.com/.well-known/jwks.json
AUTHENTICATION_JWT_ALGORITHM=RS256
AUTHENTICATION_CLOCK_TOLERANCE_SECONDS=30
AUTHENTICATION_MAX_TOKEN_AGE_SECONDS=900
API_ALLOWED_BROWSER_ORIGINS=http://localhost:5173
```

`API_ALLOWED_BROWSER_ORIGINS` is a comma-separated allowlist of exact HTTP(S)
origins. Missing, path-bearing or wildcard values fail startup. The browser
policy permits the required authorization, JSON, correlation, tenant and
idempotency headers; it never uses a wildcard origin.

A valid token whose `(issuer, subject)` is not linked, an inactive internal
identity and an invalid token all receive the same safe 401 response. This
prevents external identity enumeration; their internal verification/resolution
paths remain distinct. An authenticated authority rejected by an internal
grant or tenant-scope policy receives 403.

External linking is a provisioning operation, not login behavior. An approved
operations or future administration workflow must construct `ExternalIdentity`
and call `PostgresExternalIdentityStore.link` for an existing internal identity.
No public auto-provisioning endpoint exists. Never link by email or translate
Auth0 roles/scopes into MonPiole grants.

The frontend values `VITE_OIDC_ISSUER` and `VITE_OIDC_AUDIENCE` must exactly
match the API issuer and audience. For local browser use, Auth0 must also allow
the callback, logout and Web origin documented in `apps/web/README.md`.

### UI-002A local operations

`GET /v1/authentication/session` is a side-effect-free smoke endpoint. A 200
means that the bearer passed OIDC verification and its exact `(issuer, subject)`
resolved to an active internal authority. Its response is only
`{ "authenticated": true }`; grants and tenant scope stay server-side.

`GET /v1/authentication/authorization/platform-tenant-creation` is the
side-effect-free 403 probe. It resolves the same authenticated authority and
invokes the existing `CREATE_TENANT` authorizer, but never calls the Create
Tenant use case. A normal TENANT_ADMINISTRATOR receives 403 because its internal
grants intentionally exclude platform tenant creation; an authorized platform
authority receives 204. The route neither changes grants nor accepts claims as
business authority.

Use `infrastructure/local/postgres.compose.yaml` for isolated local PostgreSQL,
then run `corepack pnpm --filter @monpiole/api migrations:apply`. This requires
`DATABASE_MIGRATION_URL` and `DATABASE_MIGRATION_TLS`. TLS may be disabled only
for loopback development; remote databases still require verified TLS.

Run `corepack pnpm --filter @monpiole/api identity:link-external` to link an
existing ACTIVE internal identity. It requires `DATABASE_URL`, `DATABASE_TLS`,
`EXTERNAL_IDENTITY_ISSUER`, `EXTERNAL_IDENTITY_SUBJECT`,
`EXTERNAL_IDENTITY_INTERNAL_ID` and `EXTERNAL_IDENTITY_TENANT_ID`. The command
does not create an identity, infer a link from e-mail, or assign Auth0 claims as
grants. Never place a real subject in tracked configuration.

For a completely empty installation only, run
`corepack pnpm --filter @monpiole/api platform:bootstrap-initial-authority`
before external linking. The command requires the explicit enable flag, exact
confirmation phrase, operator/idempotency identifiers, tenant contact fields
and administrator fields listed in `.env.example`. It validates inputs before
effects, takes an advisory lock, and refuses if any tenant, identity or
membership exists. Success creates one ACTIVE tenant and one ACTIVE
TENANT_ADMINISTRATOR, then prints their UUIDs.

This is a one-shot Operations trust boundary, not development authentication.
It is not reachable through HTTP and does not process Auth0 data. A second run
is refused. Because bounded contexts retain their own transactions, an
interruption after a partial commit requires an approved recovery procedure.

## Private Property portfolio

`GET /v1/properties` lists only the portfolio of the tenant derived from the
authenticated internal authority. It requires `LIST_PROPERTIES`; no OIDC claim
or query parameter selects a tenant. Optional `status`, `type` and `search`
filters are validated, `limit` defaults to 20 and is capped at 100, and
`cursor` is an opaque keyset cursor. Results are ordered deterministically by
creation date then Property ID, descending. The endpoint is private portfolio
discovery; its status filter accepts `DRAFT`, `PUBLISHED` and `WITHDRAWN`. It does
not expose a public catalogue.

`PUT /v1/properties/{propertyId}` updates only title, optional description and
location for an existing Property. It requires
`UPDATE_PROPERTY_CORE_INFORMATION`, derives the tenant from internal authority,
and preserves type, commercial project, status, details, terms and ownerships.
Missing and cross-tenant identifiers share the same non-revealing 404 response.

`PUT /v1/properties/{propertyId}/publication` publishes and the bodyless
`DELETE` on the same resource withdraws a publication from the public catalog.
They require `PUBLISH_PROPERTY` and `WITHDRAW_PROPERTY_FROM_CATALOG`
respectively, derive the only tenant from authenticated authority, and return
the canonical `PropertyResponse` with 200 for both the first transition and an
idempotent replay. The response contract is a strict
`DRAFT | PUBLISHED | WITHDRAWN` union. Published and withdrawn variants retain
`publishedAt`; only withdrawn requires `withdrawnAt`. The authenticated detail
and mutation representation projects `canWithdrawFromCatalog` without exposing
the authority's grants.

An incomplete draft returns
`PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET` as Problem Details 409 with only the
closed `property.details`, `property.commercialTerms`, `property.apartmentSubtype`,
`property.primaryPhoto`, photo-minimum and required-view causes. Invalid IDs,
missing authentication, missing grant, missing/cross-tenant Properties and
unexpected failures retain the safe 400/401/403/404/500 conventions. Withdrawal
of a draft returns `PROPERTY_NOT_PUBLISHED`; publishing a withdrawn Property
returns `PROPERTY_REPUBLICATION_NOT_SUPPORTED`, both as Problem Details 409. The normal
PostgreSQL runtime composes the use case and the active tenant-administrator
authority receives the grant from internal Identity state, never from OIDC
scopes or claims. Withdrawal creates no event or outbox entry. The existing
public routes continue to expose exactly `PUBLISHED`; after withdrawal the list
omits the Property and detail/photo return the same non-disclosing 404.

The private photo routes are:

- `POST /v1/properties/{propertyId}/photos` with `CREATE_PROPERTY_PHOTO`,
  persisting canonical JPEG/PNG/WebP content and its integrity evidence;
- `GET /v1/properties/{propertyId}/photos` with `RETRIEVE_PROPERTY_PHOTOS`;
- `GET /v1/properties/{propertyId}/photos/{photoId}/content` with
  `RETRIEVE_PROPERTY_PHOTOS`, returning the authenticated binary content;
- bodyless `PUT /v1/properties/{propertyId}/photos/{photoId}/primary` with
  `SELECT_PROPERTY_PRIMARY_PHOTO` for an atomic initial selection or replacement;
- `DELETE /v1/properties/{propertyId}/photos/{photoId}` with
  `DELETE_PROPERTY_PHOTO`, returning 409 for the current primary photo.

All routes derive the single tenant from internal authority, hide cross-Property
and cross-tenant photo identifiers as 404, and use the normal safe Problem
Details and correlation headers. No OIDC scope becomes one of these grants.
`GET` and `PUT /v1/property-photo-standard` retrieve or strengthen the current
tenant's minimum and mandatory views under dedicated internal grants. The
publication repository reloads this standard transactionally and combines it
with the non-reducible MonPiole baseline.

## Private Property owner directory

`GET /v1/property-owners` lists the owners of the tenant resolved from the authenticated internal authority. It accepts `limit`, an opaque `cursor`, and a bounded `search` over individual names, legal names, registration numbers, and email. Results use stable keyset ordering by creation date then Owner ID, descending. The endpoint requires `LIST_PROPERTY_OWNERS`; OIDC scopes are not business grants.

## Private Property composition

The six composition routes live below
`/v1/properties/{propertyId}/buildings`. `POST` and `GET` create and list
Buildings, `PUT /{buildingId}` updates a Building, and the nested `/units`
collection provides the equivalent create, list, and Unit-code update routes.
Lists accept `limit` and an opaque `cursor`; clients must return the cursor
unchanged and must not infer its representation.

The API derives tenant scope only from the authenticated internal authority.
Composition operations require their dedicated create, retrieve, or update
grant. Missing and cross-tenant parents, Buildings, and Units return the same
non-revealing 404 contract; duplicate codes and structural-role violations use
stable 409 problem codes. There are intentionally no delete, move, or reparent
routes in this slice.

Each operation publishes only the path parameters present in its URL, all marked
required. Mutation requests are strict, Unit descriptions accept up to 5,000
characters, response codes and cursor code components are canonical uppercase,
and tenant or persistence trace fields are never exposed. Success responses and
Problem Details responses declare the tracing headers. The OpenAPI contract
documents applicable `400`, `401`, `403`, `404`, `409`, and safe `500`
responses with `application/problem+json`; the two read operations omit `409`.
Dedicated contract tests lock these paths, schemas, headers, statuses, and
cursor representations to the runtime DTOs.

## Public Property catalog — TASK-058

Les opérations anonymes suivantes constituent des contrats publics distincts :

- `GET /v1/public/properties` ;
- `GET /v1/public/properties/{publicPropertyId}` ;
- `GET /v1/public/properties/{publicPropertyId}/primary-photo`.

Elles déclarent `security: []`, n’appellent pas la frontière OIDC et n’acceptent
aucun tenant, statut ou champ d’autorité du client. Le tenant unique provient de
la correspondance exacte `Host → tenant UUID` configurée dans
`PUBLIC_CATALOG_HOST_TENANT_ALLOWLIST`. La valeur est une liste séparée par des
virgules d’entrées `host=tenantUuid`; absente ou vide, elle ferme tous les
catalogues par 404. `X-Forwarded-Host` est ignoré tant qu’un proxy de confiance
n’est pas explicitement intégré.

Une allowlist non vide exige `PUBLIC_CATALOG_DATABASE_URL` et
`PUBLIC_CATALOG_DATABASE_TLS`. L’URL doit authentifier exactement
`monpiole_public_catalog_reader`; l’API crée alors un second pool, séparé de
`monpiole_runtime`. Les variantes `PUBLIC_CATALOG_DATABASE_POOL_MAX`,
`PUBLIC_CATALOG_DATABASE_CONNECTION_TIMEOUT_MS` et
`PUBLIC_CATALOG_DATABASE_IDLE_TIMEOUT_MS` sont optionnelles. Le rôle doit être
provisionné avant l’application de `0011` avec `NOSUPERUSER NOCREATEDB
NOCREATEROLE NOINHERIT NOBYPASSRLS`; la migration accorde seulement les droits
de lecture par colonne.

Les listes utilisent une pagination keyset bornée à 50, les seuls filtres
`type` et `transactionType`, et l’ordre `publishedAt DESC, publicPropertyId
DESC`. Les DTO sont des listes blanches sans `tenantId`, adresse, owners,
identités, traces ou identifiants photo. Liste et détail ont un cache public de
60 secondes ; la photo, 300 secondes avec ETag ; toutes les erreurs utilisent
`no-store` et la clé de cache doit conserver Host, path et query.

Le Web public appelle ces routes en same-origin afin que l’hôte du catalogue
arrive réellement à l’API. L’ingress contrôlé doit donc router `/v1/public/*`
depuis chaque hôte activé vers l’API sans réécrire Host.

La configuration refuse une allowlist non vide lorsque `MONPIOLE_ENV=production`.
Le catalogue reste **NO-GO Internet production** : aucun rate limiter n’est
livré, aucun tenant réel n’est activé et aucune revue de données pilote n’est
encodée dans le dépôt.

## Property geolocation — TASK-060

La frontière privée authentifiée expose `GET`, `PUT` et `DELETE
/v1/properties/{propertyId}/geolocation`. Le body `PUT` strict accepte uniquement
`latitude`, `longitude` et `publicVisibility` (`EXACT`, `APPROXIMATE` ou
`HIDDEN`), avec les bornes WGS84 et six décimales au maximum. `DELETE` représente
explicitement l'absence et reste idempotent. Les réponses privées distinguent
une valeur propre (`OWN`) d'une valeur héritée (`INHERITED`) pour les Units sans
retourner tenant, traces ou métadonnées de persistance.

Les grants `RETRIEVE_PROPERTY_GEOLOCATION`, `UPDATE_PROPERTY_GEOLOCATION` et
`REMOVE_PROPERTY_GEOLOCATION` sont attribués au rôle métier
`TENANT_ADMINISTRATOR`. Une Unit ne peut ni créer un override ni supprimer la
position héritée ; l'API répond 409 avec le code stable
`PROPERTY_UNIT_GEOLOCATION_INHERITED`. Les erreurs cross-tenant restent 404 et
non révélatrices.

Cette tranche n'ajoute aucune coordonnée aux trois routes du catalogue public.
Elle ne charge aucun SDK cartographique, géocodeur, credential ou provider. Le
contrat OpenAPI généré décrit les trois opérations privées, leurs validations,
réponses Problem Details et en-têtes de traçage.

## Property availability and occupancy — TASK-064

La frontière privée authentifiée expose `GET` et `PUT
/v1/properties/{propertyId}/availability`. `GET` requiert
`RETRIEVE_PROPERTY_AVAILABILITY` et retourne soit l’absence ou le snapshot direct
d’une Property `STANDALONE | UNIT`, soit les compteurs dérivés d’une Property
`COMPOSITE`. `canUpdateAvailability` est une projection booléenne calculée depuis
l’autorité interne ; aucun grant brut n’est sérialisé.

`PUT` requiert `UPDATE_PROPERTY_AVAILABILITY`. Son body strict contient
uniquement `availabilityStatus` (`AVAILABLE | UNAVAILABLE`) et
`occupancyStatus` (`VACANT | OCCUPIED`). Une mutation de `COMPOSITE` retourne le
Problem Details 409 stable `PROPERTY_AVAILABILITY_DERIVED_FROM_UNITS`; les
erreurs d’authentification, d’autorisation et d’absence/cross-tenant conservent
les conventions 401/403/404 non révélatrices. Le runtime PostgreSQL normal
compose les deux use cases et l’adapter de synthèse tenant-scopé.

Aucune route publique, aucun filtre `availableOnly`, aucun endpoint d’historique
et aucun champ `availableFrom` ne sont ajoutés. Les réponses du catalogue public
restent des listes blanches sans disponibilité ni occupation et continuent à
filtrer seulement les Properties `PUBLISHED`.
