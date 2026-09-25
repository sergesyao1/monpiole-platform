# TASK-058 — Public Property Catalog API & Web Vertical Slice

- **Statut : DONE — environnement contrôlé**
- **Date : 2026-08-31**
- **Branche :** `main`
- **HEAD de départ et HEAD final :** `ed8db4a5ba5790c420ae6889a9210a69d3c2ae0b`
- **Référence de décision :** TASK-057
- **Exposition Internet production : NO-GO maintenu**
- **Commit/push :** aucun

## 1. Résultat

La tranche verticale TASK-058 est livrée dans le Bounded Context Property
Management, l’API, le contrat OpenAPI et l’application Web. Un visiteur anonyme
peut, pour un hôte explicitement allowlisté en environnement contrôlé, lister
les Properties `PUBLISHED` d’un seul tenant, consulter leur détail et charger
leur photo principale publique. Les routes Web `/catalogue` et
`/catalogue/:publicPropertyId` fonctionnent hors de `AuthenticationBoundary`.

Le catalogue n’est pas global. Le navigateur ne fournit aucun tenant, statut
ou élément d’autorité. Le tenant est résolu côté serveur par égalité exacte sur
`Host`, puis propagé explicitement aux use cases et à `SET LOCAL app.tenant_id`.
Une absence de mapping retourne 404 avant toute transaction Property.

La production Internet reste fermée. L’allowlist est vide par défaut et une
allowlist non vide fait échouer la configuration lorsque
`MONPIOLE_ENV=production`. Aucun tenant réel, hostname réel, credential ou
rate limiter n’est ajouté par cette tâche.

## 2. Conditions d’entrée TASK-057

| Condition | Résultat |
| --- | --- |
| Catalogue tenant-scoped par hôte exact | Appliqué ; aucun catalogue global. |
| Liste blanche publique | Appliquée dans des schemas, types et mappers dédiés. |
| Rôle public provisionnable avant migration | Prouvé par Testcontainers ; le login reste une responsabilité Operations hors migration. |
| Docker/Testcontainers disponible | Oui, Docker Desktop 4.87.0 et Engine 29.7.2. |
| Tenant/hôte synthétiques | Oui, UUID et domaines `.test` uniquement. |
| Activation production vide | Oui, valeur vide par défaut et garde production. |
| Revue des publications d’un tenant pilote | Non applicable : aucun tenant réel n’est activé. Reste un gate avant Internet. |
| Changements utilisateur chevauchants | Aucun au démarrage de TASK-058 ; le worktree était propre. |

## 3. Préflight obligatoire avant implémentation

Le préflight a été exécuté avant la première modification de code :

1. `docker version` : **PASS** — client 29.7.2, Docker Desktop 4.87.0,
   Engine 29.7.2, API 1.55, contexte `desktop-linux` ;
2. `corepack pnpm service:property-management:test:integration` : **PASS** —
   2 fichiers, **58/58 tests PostgreSQL** précédemment ignorés ;
3. `corepack pnpm service:property-management:migration:check` : **PASS** —
   `Everything's fine` ;
4. la suite de 58 tests a confirmé la RLS enabled/forced sur les tables
   Property Management et la matrice de privilèges photo du rôle
   `monpiole_runtime`.

Aucun échec fonctionnel n’a donc déclenché le blocker d’arrêt défini par
TASK-057.

## 4. Fonctionnalités livrées

### 4.1 Property Management Application

- port `PublicPropertyCatalogQuery` indépendant du portfolio privé ;
- projections `PublicPropertyCatalogItem`, `PublicPropertyCatalogDetail` et
  `PublicPrimaryPhotoContent` dédiées ;
- use cases `ListPublicProperties`, `RetrievePublicProperty` et
  `RetrievePublicPrimaryPhoto` ;
- limite par défaut 20, maximum 50 ;
- filtres uniques `propertyType` et `transactionType` ;
- curseur `(publishedAt, publicPropertyId)` validé ;
- même `PublicPropertyNotFoundError` pour toute absence de projection publique.

Les use cases ne reçoivent ni autorité OIDC, ni owner, ni statut demandé. Le
tenant déjà résolu est un paramètre explicite.

### 4.2 Adapter PostgreSQL public

`PostgresPublicPropertyCatalogQuery` utilise un pool reader distinct et une
transaction tenant-scoped pour chaque lecture. Les trois requêtes portent des
prédicats explicites `tenant_id` et `status = 'PUBLISHED'`, même si la RLS
constitue déjà la défense finale.

La liste est triée par `published_at DESC, property_id DESC`, avec pagination
keyset. La liste et le détail ne joignent qu’une photo `AVAILABLE`, principale
et content-backed. Une publication historique sans contenu reste listée avec
`primaryPhoto: null`; sa route binaire retourne 404.

### 4.3 Résolution host vers tenant

`PUBLIC_CATALOG_HOST_TENANT_ALLOWLIST` contient des entrées exactes
`host=tenantUuid` séparées par des virgules. La résolution :

- canonicalise seulement la casse d’un host syntaxiquement valide ;
- conserve le port dans l’identité de l’hôte ;
- refuse wildcard, URL, path, userinfo, espaces, virgules et doublons ;
- ignore `X-Forwarded-Host` ;
- n’a aucun fallback ;
- retourne 404 avant le use case pour un host inconnu ;
- reste vide par défaut ;
- refuse toute valeur non vide en environnement `production`.

Le Web appelle `/v1/public/*` en same-origin pour préserver réellement ce
`Host`. Un ingress contrôlé devra router ces chemins sans réécrire l’hôte.

### 4.4 Pool et rôle PostgreSQL séparés

Une allowlist non vide exige un second ensemble de variables
`PUBLIC_CATALOG_DATABASE_*`. L’URL doit contenir exactement le login
`monpiole_public_catalog_reader`; elle ne peut donc pas réutiliser par erreur
`monpiole_runtime`. Le pool public est fermé avec le pool privé lors du shutdown.

Les preuves PostgreSQL réelles confirment :

- `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOBYPASSRLS` ;
- aucune appartenance au rôle owner ;
- aucune relation Property Management possédée ;
- `USAGE` mais pas `CREATE` sur le schema ;
- aucun privilège de table ;
- exactement 35 privilèges `SELECT` de colonne : 27 sur `properties`, 8 sur
  `property_photos` ;
- aucun accès à `address_line`, owners, ownerships, Buildings, relations Unit,
  standards ou audits ;
- aucun `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` ou `TRIGGER` ;
- rôles réellement distincts observés dans la composition runtime ;
- remise à zéro du tenant context après retour de connexion au pool.

### 4.5 API publique

Trois opérations sans Bearer et avec `security: []` :

- `GET /v1/public/properties` ;
- `GET /v1/public/properties/{publicPropertyId}` ;
- `GET /v1/public/properties/{publicPropertyId}/primary-photo`.

La liste expose seulement `limit`, `cursor`, `type` et `transactionType`. Le
curseur est un base64url canonique opaque limité à 512 caractères. Le détail
utilise l’UUID Property existant sous l’alias `publicPropertyId`.

Liste et détail répondent avec `Cache-Control: public, max-age=60`. La photo
répond avec `public, max-age=300`, `ETag`, `Content-Length`, le type JPEG/PNG/WebP
et `X-Content-Type-Options: nosniff`, plus 304 sur revalidation. Les réponses
publiques varient sur `Host, Origin`; Host, path et query restent dans la clé de
requête. Tous les Problem Details répondent `Cache-Control: no-store`.

Les 404 ne distinguent pas une Property absente, DRAFT, d’un autre tenant ou
une photo non publique. Les erreurs ne contiennent ni SQL, ni tenant, ni rôle,
ni cause interne libre.

### 4.6 Liste blanche de données

Les nouveaux DTO publics exposent uniquement :

- `publicPropertyId`, titre, type, projet commercial, sous-type applicable et
  rôle structurel ;
- pays, ville et quartier, jamais `addressLine` ;
- conditions commerciales ;
- URL/type de la photo principale ou `null` ;
- date de publication ;
- description et détails physiques seulement dans la fiche.

Ils n’importent ni `PropertyResponse`, ni DTO privé. Ne sont pas exposés :
tenant, owners, ownerships, contacts, identité, membership, grants, OIDC,
acteur/autorité/corrélation, traces de publication, timestamps techniques,
photoId/hash/taille/catégorie, base64, Buildings, codes Unit, parents, standards
ou audits.

### 4.7 Web public en français

- `/catalogue` et `/catalogue/:publicPropertyId` sont hors OIDC ;
- aucun `getAccessToken`, client authentifié ou header Authorization ;
- rendu et appel API prouvés avec session `loading`, `unauthenticated` et
  `error`, sans redirection `/connexion` ;
- filtres « Type de bien » et « Projet » conservés dans l’URL ;
- cartes avec photo/placeholder, libellés français, localisation, prix, rôle et
  lien clavier ;
- bouton « Afficher plus de biens », curseur opaque et déduplication par UUID ;
- chargement `role=status`, vide sans CTA privé, erreur sûre avec retry ;
- fiche française, retour catalogue et état « Bien introuvable » ;
- alt de photo, placeholder accessible, skip link, focus visible et grilles
  responsive à 900 px et 620 px ;
- aucune enum technique rendue.

## 5. Migration créée

### `0011_public_property_catalog_read_boundary.sql`

Migration append-only, sans écriture de donnée ni modification d’historique :

1. index partiel `properties_public_catalog_idx` sur
   `(tenant_id, published_at DESC, property_id DESC)` où
   `status = 'PUBLISHED'` ;
2. policy `properties_public_catalog_published_select`, `AS RESTRICTIVE FOR
   SELECT TO monpiole_public_catalog_reader`, limitée à `PUBLISHED` ;
3. policy `property_photos_public_catalog_primary_select`, restrictive, limitée
   à la photo `AVAILABLE`, principale, content-backed d’une Property publiée du
   même tenant ;
4. rappel `ENABLE/FORCE ROW LEVEL SECURITY` sur `properties` et
   `property_photos` ;
5. révocation des privilèges schema/table du reader puis `USAGE` et les grants
   `SELECT` de colonnes exacts ;
6. snapshot `0011_snapshot.json` et entrée Drizzle journal correspondante.

Le rôle doit exister avant migration. Son login et son credential restent hors
du dépôt et hors migration conformément à TASK-057.

## 6. Résultats exacts des validations

### 6.1 Résultats finaux

| Validation | Résultat exact |
| --- | --- |
| `docker version` | PASS — Desktop 4.87.0, client/Engine 29.7.2, API 1.55 |
| Préflight PostgreSQL avant code | PASS — 2 fichiers, 58/58 tests |
| `service:property-management:migration:check` final | PASS — `Everything's fine` |
| PostgreSQL Property final | PASS — 3 fichiers, 65/65 tests |
| Runtime PostgreSQL ciblé | PASS — 1 fichier, 11/11 tests |
| HTTP catalogue ciblé | PASS — 1 fichier, 8/8 tests |
| OpenAPI catalogue ciblé | PASS — 1 fichier, 4/4 tests |
| `corepack pnpm -r typecheck` | PASS — 9 workspaces applicatifs |
| `corepack pnpm typecheck:tests` final | PASS |
| `corepack pnpm test:unit` | PASS — 25 fichiers, 170/170 tests |
| `corepack pnpm test:integration` | PASS — 18 fichiers, 159/159 tests |
| `corepack pnpm app:api:contracts:check` | PASS — 14 fichiers, 83/83 tests |
| `corepack pnpm --filter @monpiole/web test` | PASS — 15 fichiers, 107/107 tests |
| `CI=true corepack pnpm test` | PASS — 78 fichiers, **611/611 tests** |
| `CI=true corepack pnpm app:api:build` | PASS — 6 workspaces construits |
| `CI=true corepack pnpm --filter @monpiole/web build` | PASS — 112 modules ; JS 579,42 kB, gzip 168,69 kB ; warning chunk > 500 kB |
| `corepack pnpm app:api:openapi` | PASS — artefact régénéré |
| `CI=true corepack pnpm architecture:check` | PASS — workspace, exports, resolver, graph, boundaries, cycles, diagnostics |
| `git diff --check` | PASS — aucune sortie |
| contrôle whitespace des fichiers non suivis | PASS — aucune sortie |
| recherche ciblée de secrets dans les fichiers concernés | PASS — aucune correspondance |

La suite PostgreSQL finale prouve empty-to-head, upgrade historique vers head,
upgrade `0010 → 0011`, index, grants, rôle, RLS/policies, cas inter-tenant,
DRAFT invisible, photo publique, legacy nullable, refus des colonnes/tables et
écritures interdites.

### 6.2 Boucles intermédiaires corrigées

Pour ne pas transformer des essais en validations finales silencieuses :

- premier typecheck Property : 3 erreurs TS2344 sur la contrainte générique des
  rows PostgreSQL ; types corrigés, puis PASS ;
- première suite PostgreSQL post-0011 : 62 tests passés, 3 échecs de fixtures ou
  d’attentes devenues obsolètes ; attentes de policies complétées et fixture
  publiée rendue conforme, puis 65/65 ;
- premier test HTTP public : 2 passés, 6 échecs car `fetch` remplaçait le header
  `Host` ; le test utilise maintenant le client HTTP Node bas niveau, puis 8/8 ;
- première suite Web : 106 passés, 1 échec dû à un sélecteur de test ambigu
  « Maison » ; sélecteur corrigé, puis 107/107 ;
- premier typecheck monorepo final : erreur de tuple sur le mock `fetch` du test
  Web ; signature du mock explicitée, puis les 9 workspaces passent ;
- premier harness whitespace des fichiers non suivis : code de différence
  `git --no-index` propagé malgré l’absence d’erreur ; harness corrigé pour
  distinguer différence et erreur whitespace, puis PASS.

Aucun de ces résultats intermédiaires n’a été contourné par désactivation ou
suppression de test.

## 7. Décisions techniques appliquées

1. lecture directe des tables propriétaires via port public dédié ;
2. aucun nouveau Bounded Context, service, événement, outbox ou broker ;
3. UUID Property existant comme identité publique ;
4. liste et détail autonomes pour `STANDALONE`, `COMPOSITE` et `UNIT`, sans
   Building ni graphe ;
5. résolution exacte `Host → tenant`, jamais depuis un input browser ;
6. rôle, credential, URL et pool reader séparés ;
7. double défense : prédicats repository et RLS forcée/restrictive ;
8. DTO API et modèles/client Web publics dédiés ;
9. appels Web publics same-origin pour conserver Host ;
10. cache court et 404 indifférencié ;
11. activation production empêchée dans le code tant que le NO-GO subsiste.

## 8. Limites avant exposition Internet

Le statut fonctionnel de TASK-058 est DONE, mais l’Internet production reste
NO-GO jusqu’à preuve de tous les points suivants :

- rate limiting/anti-abus approuvé et testé ;
- activation explicite d’un tenant réel et revue de toutes ses Properties déjà
  publiées, notamment description et quartier ;
- provisioning Operations du login/credential reader dans chaque environnement ;
- ingress same-origin par host, préservation de Host et politique explicite de
  proxy de confiance si les forwarded headers deviennent nécessaires ;
- capacité et limites de taille des images base64, bande passante, cache/CDN et
  test de charge ;
- mécanisme de retrait unitaire/dépublication ou procédure opérationnelle
  approuvée ; le retrait du mapping reste seulement un kill switch tenant ;
- revue HA, backup/restore, SLO, monitoring et exploitation ;
- correction ou acceptation du warning Web à 579,42 kB ;
- validation des montants zéro et gouvernance éditoriale future selon les
  questions ouvertes TASK-057.

La garde production actuelle doit être retirée uniquement dans une tâche
ultérieure qui livre et prouve ces contrôles. Il ne suffit pas de renseigner un
hostname.

## 9. Fichiers créés

- `.codex/tasks/TASK-058-public-property-catalog-api-web-vertical-slice.md` ;
- `apps/api/src/configuration/public-catalog.ts` ;
- `apps/api/src/contracts/v1/public-properties/public-property.schema.ts` ;
- `apps/api/src/http/public-properties/public-properties.controller.ts` ;
- `apps/api/src/http/public-properties/public-property-cursor.ts` ;
- `apps/api/src/http/public-properties/public-property.dto.ts` ;
- `apps/api/src/http/public-properties/public-property.mapper.ts` ;
- `apps/web/src/features/public-catalog/public-property-api.ts` ;
- `apps/web/src/features/public-catalog/public-property-model.ts` ;
- `apps/web/src/features/public-catalog/PublicCatalogLayout.tsx` ;
- `apps/web/src/features/public-catalog/PublicCatalogPages.test.tsx` ;
- `apps/web/src/features/public-catalog/PublicPropertyCatalogPage.tsx` ;
- `apps/web/src/features/public-catalog/PublicPropertyDetailPage.tsx` ;
- `services/property-management/migrations/0011_public_property_catalog_read_boundary.sql` ;
- `services/property-management/migrations/meta/0011_snapshot.json` ;
- `services/property-management/src/application/public-property-catalog-query.ts` ;
- `services/property-management/src/application/public-property-catalog.ts` ;
- `services/property-management/src/infrastructure/persistence/postgres/postgres-public-property-catalog-query.ts` ;
- `services/property-management/tests/postgres-public-property-catalog.test.ts` ;
- `tests/contract/public-property-catalog-openapi.test.ts` ;
- `tests/integration/api-public-property-catalog.test.ts` ;
- `tests/unit/public-catalog-tenant-resolver.test.ts` ;
- `tests/unit/public-property-catalog.test.ts`.

## 10. Fichiers modifiés

- `.env.example` ;
- `apps/api/README.md` ;
- `apps/api/src/app.module.ts` ;
- `apps/api/src/composition/create-postgres-runtime-composition.ts` ;
- `apps/api/src/http/errors/problem-details.filter.ts` ;
- `apps/web/README.md` ;
- `apps/web/src/app/App.test.tsx` ;
- `apps/web/src/app/routes.tsx` ;
- `apps/web/src/styles/global.css` ;
- `engineering/contracts/http/openapi.json` ;
- `services/property-management/README.md` ;
- `services/property-management/migrations/meta/_journal.json` ;
- `services/property-management/src/index.ts` ;
- `services/property-management/src/infrastructure/persistence/postgres/schema.ts` ;
- `services/property-management/tests/postgres-property-primary-photo.test.ts` ;
- `services/property-management/tests/postgres-property-repository.test.ts` ;
- `tests/integration/api-identity-postgres-runtime.test.ts`.

Aucun fichier n’a été supprimé.

## 11. État Git

- branche `main` ;
- HEAD inchangé : `ed8db4a5ba5790c420ae6889a9210a69d3c2ae0b` ;
- upstream : `main...origin/main [ahead 41]` ;
- changements TASK-058 non staged ;
- aucun commit et aucun push exécuté.

## 12. Proposition de message de commit

```text
feat(property): add tenant-scoped public catalog slice
```
