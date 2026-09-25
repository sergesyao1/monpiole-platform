# TASK-064 — Property Availability & Occupancy Web Vertical Slice

## État

**Implémentée et validée localement le 2026-09-01 — prête pour revue propriétaire.**

- Branche inspectée : `main`.
- HEAD de départ : `02c388c docs(property): define availability and occupancy`.
- Working tree de départ : propre.
- Source normative : `TASK-063-post-catalog-withdrawal-readiness-audit-property-availability-occupancy-definition.md`.
- Commit ou push effectué : aucun.
- Suppression de fichier, reset, checkout destructif, clean ou stash : aucun.

## Résultat livré

La tranche privée permet de lire et remplacer la paire disponibilité/occupation
d’une Property directe, et de lire une synthèse dérivée pour une Property
composite.

- Disponibilité : `AVAILABLE | UNAVAILABLE`.
- Occupation : `VACANT | OCCUPIED`.
- Les quatre paires sont valides.
- L’absence de snapshot reste explicite et n’est jamais déduite de la
  publication.
- `STANDALONE` et `UNIT` possèdent un snapshot direct facultatif.
- `COMPOSITE` ne possède jamais de snapshot direct.
- Le premier Building efface atomiquement un éventuel snapshot direct du parent.
- Le cycle `DRAFT | PUBLISHED | WITHDRAWN` reste indépendant.
- La visibilité publique reste strictement `status = 'PUBLISHED'`.
- Aucun champ ou filtre de disponibilité n’est exposé au catalogue public.

## Domaine et application

`Property` porte un snapshot typé avec son instant de dernière mise à jour. La
transition directe protège les enums, refuse `COMPOSITE` avec le code stable
`PROPERTY_AVAILABILITY_DERIVED_FROM_UNITS`, et retourne la même instance lors du
replay de la même paire.

Deux use cases ont été ajoutés :

- `RetrievePropertyAvailability`, sous le grant
  `RETRIEVE_PROPERTY_AVAILABILITY` ;
- `UpdatePropertyAvailability`, sous le grant
  `UPDATE_PROPERTY_AVAILABILITY`.

L’autorisation précède toute lecture ou mutation. Une autorité doit porter
exactement un tenant. Les Properties absentes et cross-tenant partagent le même
`PROPERTY_NOT_FOUND`. La réponse projette seulement
`canUpdateAvailability` ; elle n’expose aucun grant brut.

Le replay de la même paire ne lit pas l’horloge, n’écrit pas et conserve
`updatedAt`, l’acteur et la corrélation du snapshot. Les remplacements concurrents
réutilisent `PropertyRepository.updateAtomically` et son `SELECT ... FOR UPDATE` :
ils sont sérialisés, la dernière écriture validée gagne et aucune paire hybride
ne peut être persistée.

## PostgreSQL et migration

La migration append-only
`0014_property_availability_occupancy.sql`, accompagnée du snapshot Drizzle
`0014_snapshot.json`, ajoute à `property_management.properties` :

- `availability_status text NULL` ;
- `occupancy_status text NULL` ;
- `availability_updated_at timestamptz NULL` ;
- `availability_updated_by_actor_id text NULL` ;
- `availability_correlation_id uuid NULL`.

La contrainte `properties_availability_occupancy_check` exige soit les cinq
colonnes nulles, soit les cinq valeurs présentes avec les enums canoniques et un
rôle `STANDALONE | UNIT`. Un `COMPOSITE` doit donc conserver les cinq colonnes
nulles.

La migration ne crée ni table, ni index, ni policy, ni grant public. Elle
réutilise la RLS forcée et les droits runtime existants. Le lecteur
`monpiole_public_catalog_reader` ne peut pas lire les nouvelles colonnes.

`PostgresPropertyAvailabilityQuery` effectue une seule requête métier
tenant-scopée. Pour un composite, elle agrège toutes les Units et retourne :

- `totalUnitCount` ;
- `configuredUnitCount` ;
- `availableUnitCount` ;
- `unavailableUnitCount` ;
- `vacantUnitCount` ;
- `occupiedUnitCount` ;
- `unconfiguredUnitCount`.

Le résumé est `AVAILABLE` si au moins une Unit est disponible,
`UNAVAILABLE` si toutes les Units sont configurées sans Unit disponible, et
`NOT_CONFIGURED` dans les autres cas, y compris zéro Unit.

## API, autorité et runtime

Les endpoints privés livrés sont exactement :

- `GET /v1/properties/{propertyId}/availability` ;
- `PUT /v1/properties/{propertyId}/availability`.

Le body `PUT` est strict et accepte seulement `availabilityStatus` et
`occupancyStatus`. Il refuse notamment `availableFrom`, les champs tenant et les
propriétés supplémentaires. Le GET documente les réponses directes configurée
ou absente et la synthèse composite. Le PUT documente seulement la réponse
directe configurée. Les statuts, la sécurité bearer, le path UUID obligatoire,
les Problem Details et les en-têtes de traçage sont verrouillés dans OpenAPI.

Les deux grants sont attribués au rôle interne `TENANT_ADMINISTRATOR`, puis
filtrés par la projection `toPropertyAuthority`. Le runtime réel construit le
query adapter PostgreSQL et les deux use cases dans
`create-postgres-runtime-composition`.

## Web

La fiche Property contient une section française « Disponibilité et
occupation » avec :

- chargement, erreur et nouvelle tentative locaux ;
- « Non renseignée » pour un snapshot direct absent ;
- « Disponible / Indisponible » et « Libre / Occupé » ;
- formulaire visible uniquement si `canUpdateAvailability` est vrai ;
- neutralisation des doubles soumissions ;
- remplacement immédiat de l’état local par la réponse persistée ;
- synthèse et compteurs sans édition pour `COMPOSITE` ;
- affichage et édition directs pour chaque Unit développée dans la composition ;
- nouvelle lecture après la transition du parent vers `COMPOSITE` ;
- explication unité par unité après la création du premier Building ;
- note courte durée : disponible accepte globalement des demandes sans garantir
  une date.

Le titre public est corrigé de « Biens disponibles » vers « Biens publiés ».
Aucun badge, filtre ou champ availability/occupancy n’est ajouté au parcours
public.

## Fichiers ajoutés

- `.codex/tasks/TASK-064-property-availability-occupancy-web-vertical-slice.md`
- `services/property-management/migrations/0014_property_availability_occupancy.sql`
- `services/property-management/migrations/meta/0014_snapshot.json`
- `services/property-management/src/application/manage-property-availability.ts`
- `services/property-management/src/application/property-availability-query.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-availability-query.ts`
- `apps/api/src/contracts/v1/properties/property-availability.schema.ts`
- `apps/api/src/http/properties/property-availability.controller.ts`
- `apps/api/src/http/properties/property-availability.dto.ts`
- `apps/api/src/http/properties/property-availability.mapper.ts`
- `apps/web/src/features/properties/PropertyAvailabilitySection.tsx`
- `apps/web/src/features/properties/PropertyAvailabilitySection.test.tsx`
- `tests/unit/property-availability.test.ts`
- `tests/integration/api-property-availability.test.ts`
- `tests/contract/property-availability-openapi.test.ts`

## Fichiers existants modifiés

- `.github/workflows/architecture-checks.yml`
- `services/property-management/README.md`
- `services/property-management/migrations/meta/_journal.json`
- `services/property-management/src/application/property-authority.ts`
- `services/property-management/src/domain/property.ts`
- `services/property-management/src/index.ts`
- `services/property-management/src/infrastructure/persistence/postgres/schema.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-repository.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-composition-repository.ts`
- `services/property-management/tests/postgres-property-repository.test.ts`
- `apps/api/README.md`
- `apps/api/src/app.module.ts`
- `apps/api/src/composition/create-postgres-runtime-composition.ts`
- `apps/api/src/composition/identity-external-authority.adapter.ts`
- `apps/api/src/http/authenticated-authority/authenticated-authority.ts`
- `apps/api/src/http/errors/problem-details.filter.ts`
- `apps/web/README.md`
- `apps/web/src/features/properties/PropertyCompositionSection.tsx`
- `apps/web/src/features/properties/PropertyCompositionSection.test.tsx`
- `apps/web/src/features/properties/PropertyDetailPage.tsx`
- `apps/web/src/features/properties/PropertyPages.test.tsx`
- `apps/web/src/features/properties/property-api.ts`
- `apps/web/src/features/properties/property-errors.ts`
- `apps/web/src/features/properties/property-model.ts`
- `apps/web/src/features/public-catalog/PublicPropertyCatalogPage.tsx`
- `apps/web/src/features/public-catalog/PublicCatalogPages.test.tsx`
- `engineering/contracts/http/openapi.json`
- `tests/contract/public-property-catalog-openapi.test.ts`
- `tests/integration/api-identity-postgres-runtime.test.ts`

Aucun fichier n’a été supprimé. Les migrations `0000` à `0013`, les contrats
publics existants, le lockfile et les dépendances ont été conservés.

## Validation réellement exécutée

Docker Desktop était actif : client/server Docker Engine `29.7.2`.

| Gate | Résultat |
| --- | --- |
| Tests unitaires ciblés TASK-064 | 1 fichier, 11 tests, succès |
| Tests HTTP ciblés TASK-064 | 1 fichier, 8 tests, succès |
| Tests Web ciblés TASK-064 et régressions proches | 4 fichiers, 43 tests, succès |
| Tests contrat ciblés + non-régression publique | 2 fichiers, 8 tests, succès |
| Test PostgreSQL Property ciblé | succès sur PostgreSQL réel/Testcontainers |
| Runtime API PostgreSQL ciblé | 1 fichier, 11 tests, succès |
| `corepack pnpm test:unit` | 27 fichiers, 205 tests, succès |
| `corepack pnpm test:integration` | 20 fichiers, 183 tests, succès |
| `corepack pnpm test:contract` | 16 fichiers, 92 tests, succès |
| `corepack pnpm --filter @monpiole/web test` | 17 fichiers, 129 tests, succès |
| `corepack pnpm package:persistence:test:integration` | 7 fichiers, 108 tests, succès PostgreSQL réel |
| `corepack pnpm test` | 87 fichiers, 717 tests, succès |
| `corepack pnpm -r typecheck` | succès sur les 9 workspaces applicables |
| `corepack pnpm typecheck:tests` | succès |
| `corepack pnpm app:api:build` | succès |
| `corepack pnpm app:web:build` | succès |
| `corepack pnpm app:api:openapi` | succès, artefact régénéré |
| `corepack pnpm service:property-management:migration:check` | succès |
| `corepack pnpm architecture:check` | succès |
| `corepack pnpm audit --audit-level high` | succès, aucune vulnérabilité haute/critique |
| `git diff --check` | succès |

Les tests PostgreSQL couvrent l’upgrade réel `0013 -> 0014`, l’absence de
backfill, la contrainte de tuple, les enums, l’interdiction composite, la trace,
le replay, la concurrence, l’effacement au premier Building, les trois résumés
composites, les Units, la RLS, le cross-tenant, les privilèges du lecteur public
et l’indépendance envers publication/retrait.

## Gaps et risques résiduels

Aucun gap fonctionnel TASK-064 n’est connu.

- Le build Web réussit avec l’avertissement existant de chunk supérieur à
  500 kB ; le chunk principal mesuré est de `594.05 kB` (`171.69 kB` gzip).
  Le découpage du bundle reste un travail de performance distinct.
- `pnpm audit --json` signale une vulnérabilité **modérée** de développement sur
  `esbuild 0.18.20`, transitive via `drizzle-kit` / `@esbuild-kit`. Il n’y a
  aucune vulnérabilité haute ou critique et TASK-064 n’ajoute aucune dépendance.
- Les caches publics conservent les TTL déjà documentés ; aucune invalidation de
  cache, disponibilité publique, date `availableFrom`, historique, bail,
  réservation, calendrier ou filtre de portfolio n’entre dans cette tranche.
