# TASK-051 - Property Buildings & Units Composition Vertical Slice

- **Statut :** DONE
- **Reference normative :** TASK-050
- **Baseline :** `8f6218f`

## Contexte et objectif

Implementer la tranche verticale definie par TASK-050 afin qu'une Property autonome puisse devenir un ensemble immobilier compose de Buildings et de Unit Properties, sans modifier les frontieres du bounded context Property Management.

## Perimetre fonctionnel

- roles structurels `STANDALONE`, `COMPOSITE` et `UNIT` ;
- creation, consultation paginee et modification des Buildings ;
- creation atomique, consultation paginee et modification du code structurel des Units ;
- integration API `/v1`, PostgreSQL/RLS, runtime et Web dans la fiche du bien.

## Decisions reprises de TASK-050

Un Building est une entite structurelle appartenant a une Property `COMPOSITE`. Une Unit est une Property publique avec le role `UNIT`, rattachee a exactement un Building. La structure est fixe, non recursive et sans heritage automatique de localisation, details, conditions commerciales ou ownership. La creation du premier Building transitionne atomiquement le parent `STANDALONE` vers `COMPOSITE`.

## Invariants metier

- le tenant vient exclusivement de l'autorite authentifiee ;
- parent, Building et Unit appartiennent au meme tenant ;
- une Unit ne peut contenir de Building ;
- `buildingCode` est canonise et unique par Property ;
- `unitCode` est canonise et unique par Building ;
- une Unit appartient a exactement un Building ;
- aucun rattachement, deplacement, suppression ou transition inverse n'est expose.

## Endpoints et contrats

- `POST|GET /v1/properties/{propertyId}/buildings` ;
- `PUT /v1/properties/{propertyId}/buildings/{buildingId}` ;
- `POST|GET /v1/properties/{propertyId}/buildings/{buildingId}/units` ;
- `PUT /v1/properties/{propertyId}/buildings/{buildingId}/units/{unitPropertyId}`.

Les requetes sont strictes. Les listes utilisent une pagination keyset opaque, une limite de 1 a 100 et l'ordre code puis identifiant croissant. `PropertyResponse` et `PropertyPortfolioItem` exposent additivement `structuralRole`.

## Autorisations

Les grants internes sont `CREATE_PROPERTY_BUILDING`, `RETRIEVE_PROPERTY_COMPOSITION`, `UPDATE_PROPERTY_BUILDING`, `CREATE_PROPERTY_UNIT` et `UPDATE_PROPERTY_UNIT_STRUCTURE`. Aucun claim ou scope OIDC ne devient un grant metier.

## Persistance et migration

La migration additive `0006_property_composition.sql` ajoute `structural_role`, backfill les donnees historiques en `STANDALONE`, cree les tables service-owned des Buildings et rattachements Units, leurs contraintes, FKs composites, indexes, traces et politiques forced RLS. Les mutations concurrentes verrouillent les parents dans une transaction tenant-scoped et traduisent les uniques SQL en conflits metier stables.

## Web

La fiche du bien integre la section « Composition du bien ». Tous les libelles, validations et messages visibles sont en francais. Elle gere chargement, vide, succes, pagination, erreurs 401/403/404/409/500 et nouvelle tentative sans perdre les resultats deja charges. La creation d'une Unit pre-remplit la localisation depuis le parent sans creer d'heritage persistant.

## Strategie de tests

Les preuves couvrent domaine, application, HTTP, contrats/OpenAPI, PostgreSQL/RLS/concurrence, runtime PostgreSQL, regressions Property et Web. Les validations finales reprennent toutes les gates imposees par TASK-050 et les scripts equivalents du depot.

## Criteres d'acceptation

Les quinze criteres d'acceptation de TASK-050 sont normatifs : compatibilite historique, transitions et creation atomiques, isolation tenant, unicites, pagination stable, autorisation interne, Unit Property reutilisable, absence de DELETE/reparenting, parcours Web francais et alignement OpenAPI/DTO/runtime.

## Exclusions explicites

Publication, baux, occupants, disponibilite, tarification specifique, medias, equipements, niveaux supplementaires, heritage automatique, attach/detach/move, suppression, recherche de composition, total count, ordre manuel, import et evenements d'integration restent hors perimetre.

## Resultats de validation finaux

- `corepack pnpm -r typecheck` : PASS, 9 workspaces.
- `corepack pnpm typecheck:tests` : PASS.
- `corepack pnpm service:property-management:migration:check` : PASS.
- `corepack pnpm service:property-management:test:integration` : PASS, 1 fichier et 30/30 tests PostgreSQL, incluant RLS, rollback, références tenant-scoped, concurrence et pagination.
- `corepack pnpm test:unit` : PASS, 144/144.
- `corepack pnpm test:integration` : PASS, 16 fichiers et 136/136 tests HTTP/integration, dont la suite dédiée aux six routes de composition.
- `corepack pnpm test:contract` : PASS, 12 fichiers et 69/69 tests.
- `corepack pnpm --filter @monpiole/web test` : PASS, 12 fichiers et 70/70 tests.
- `corepack pnpm app:api:openapi` : PASS, build des 6 workspaces dépendants et régénération de `engineering/contracts/http/openapi.json`.
- `corepack pnpm --filter @monpiole/web build` : PASS, 105 modules transformés ; avertissement non bloquant pour le chunk JavaScript de 550,32 kB.
- `corepack pnpm architecture:check` : PASS.
- `corepack pnpm test` : PASS, 66 fichiers et 476/476 tests.
- `git diff --check` : PASS.

Le dépôt ne définit aucun script `lint`; aucun contrôle artificiel n’a été ajouté. Les quinze critères normatifs de TASK-050 sont couverts par l’implémentation, les contrats générés et les suites dédiées. TASK-051 est donc DONE.
