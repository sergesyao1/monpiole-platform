# TASK-034 — Property Create/Retrieve Vertical Slice

## Status

DONE

## Objective

Deliver the first real-estate vertical slice: an authenticated single-tenant
authority creates a tenant-owned draft Property and retrieves it without
cross-tenant disclosure.

## Implementation contract

- `POST /v1/properties` creates a server-owned UUID v4 Property in `DRAFT`.
- `GET /v1/properties/{propertyId}` retrieves only within the authority tenant.
- Create input contains no `tenantId`, `propertyId`, or `status`; strict Zod
  validation rejects those fields.
- Property ownership is immutable and derived by Application from exactly one
  authenticated tenant scope. Multi-scope authority is rejected until a future
  trusted tenant-selection capability is deliberately contracted.
- Property grants are `CREATE_PROPERTY` and `RETRIEVE_PROPERTY`.
- Cross-tenant and unknown retrieval share 404 `PROPERTY_NOT_FOUND` semantics.
- Invalid client Property fields map to 400 through `INVALID_PROPERTY_INPUT`;
  invalid server-generated values and persisted-data corruption retain safe 500
  semantics and are not presented as client errors.
- PostgreSQL operations use tenant-scoped transactions and forced RLS.
- Persistence includes only the primary key and the tenant/property composite
  index required by this slice; no future listing/search index is introduced.
- Public responses deliberately omit `tenantId`; internal Domain/Application and
  persistence retain it.

## Domain scope

- Types: `APARTMENT`, `HOUSE`, `LAND`, `COMMERCIAL`, `OTHER`.
- Transactions: `LONG_TERM_RENTAL`, `SHORT_TERM_RENTAL`, `SALE`.
- Status: `DRAFT` only.
- Title is trimmed, required, and limited to 200 characters.
- Optional description is trimmed and limited to 5000 characters.
- Country is uppercase ISO alpha-2 representation; city, district, and address
  line are trimmed, required, and limited to 200 characters.
- Identifier and timestamps are supplied externally.

## Architecture

- `property-management` owns Domain, Application ports/use cases, schema,
  migration, explicit row mapping, and PostgreSQL adapter.
- Domain/Application import no NestJS, HTTP, Drizzle, PostgreSQL, Identity, or
  Tenant Management implementation.
- API reuses the established authenticated authority provider and central
  Problem Details boundary.
- The API boundary uses the generic `AuthenticatedAuthority` name; onboarding
  and Property mappings preserve their bounded-context-specific authority types.
- Runtime composition supplies one `PostgresPropertyRepository` to both use cases.
- No event, outbox, publication workflow, search, media, price, billing, or
  onboarding extension is introduced.

## Front-end Language Requirement

Toute expérience utilisateur MonPiole introduite ou modifiée dans le cadre de
TASK-034 doit être intégralement en français. Cette règle couvre notamment les
titres, menus, libellés, boutons, placeholders, aides, validations, erreurs,
succès, confirmations, états vides et contenus accessibles visibles par
l'utilisateur final.

L'architecture, le code, les routes, les propriétés JSON, les contrats API, les
classes, les use cases, les identifiants et les valeurs d'enums restent en
anglais. Une couche de présentation doit traduire ces valeurs techniques avant
affichage et ne doit pas déplacer cette responsabilité dans le Domain,
l'Application ou la persistance.

Mapping français minimal obligatoire dans toute future présentation Property :

| Valeur technique | Libellé utilisateur français |
| --- | --- |
| `DRAFT` | Brouillon |
| `APARTMENT` | Appartement |
| `HOUSE` | Maison |
| `LAND` | Terrain |
| `COMMERCIAL` | Local commercial |
| `OTHER` | Autre |
| `LONG_TERM_RENTAL` | Location longue durée |
| `SHORT_TERM_RENTAL` | Location courte durée |
| `SALE` | Vente |

TASK-034 ne crée et ne modifie actuellement aucun composant sous `apps/web`,
`apps/mobile` ou `apps/admin`. Il n'existe donc pas de couche de présentation à
modifier ni de test UI pertinent à ajouter. Les réponses HTTP conservent leurs
enums contractuels anglais ; elles ne constituent pas des libellés prêts à être
affichés directement à l'utilisateur.

## Definition of Done

- [x] Toute UI introduite ou modifiée par TASK-034 est en français ; aucune UI
  n'est introduite par cette tranche backend/API.
- [x] Le contrat interdit d'afficher directement un enum technique anglais à
  l'utilisateur final.
- [x] Les labels français des types de biens sont définis pour la présentation.
- [x] Les labels français des types de transaction sont définis pour la présentation.
- [x] Le statut métier `DRAFT` est défini comme `Brouillon` pour la présentation.
- [x] Les messages de validation, succès et erreur visibles dans une future UI
  devront être en français.
- [x] Les enums, routes, propriétés JSON et identifiants techniques restent
  inchangés en anglais.
- [x] Aucun test UI artificiel n'est ajouté en l'absence de couche front-end.

## Verification evidence

Executed evidence:

```text
corepack pnpm typecheck:tests                                  PASS
corepack pnpm service:property-management:typecheck            PASS
corepack pnpm service:property-management:build                PASS
corepack pnpm service:property-management:migration:check      PASS
corepack pnpm service:property-management:test:integration     PASS — 1 file / 3 tests
corepack pnpm app:api:typecheck                                PASS
corepack pnpm app:api:build                                    PASS
corepack pnpm app:api:openapi                                  PASS
corepack pnpm app:api:contracts:check                          PASS — 9 files / 55 tests
corepack pnpm test:unit                                        PASS — 10 files / 55 tests
corepack pnpm test:integration                                 PASS — 10 files / 57 tests
corepack pnpm test:contract                                    PASS — 9 files / 55 tests
corepack pnpm architecture:check                               PASS
corepack pnpm test                                             PASS — 33 files / 193 tests
git diff --check                                               PASS
```

The real API runtime test migrates all three service schemas, creates a tenant,
creates a Property through PostgreSQL composition, verifies persisted tenant
ownership and `DRAFT`, and retrieves the resource through HTTP. Separate HTTP
tests prove unauthenticated 401, strict server-field rejection, invalid UUID
400, and cross-tenant non-disclosure 404.

## Completion gate

Set `DONE` only after Domain/Application, PostgreSQL/RLS, real runtime HTTP,
OpenAPI contract, architecture, typecheck/build, migration, complete tests, and
Git diff checks pass.

All applicable gates passed. TASK-034 stops at Create/Retrieve as required.
