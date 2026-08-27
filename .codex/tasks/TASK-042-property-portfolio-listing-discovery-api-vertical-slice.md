# TASK-042 — Property Portfolio Listing & Discovery API Vertical Slice

- Status: **DONE**
- Date: 2026-08-27

## Traçabilité

Le numéro TASK-041 reste attribué au bootstrap operator-only de l’autorité
plateforme, livré par `158993a`. La capacité Portfolio utilise TASK-042, premier
identifiant libre après les tâches historiquement attribuées ; TASK-039 demeure
une réservation provisoire distincte pour Property Composition / Building & Units.

## État initial

Le dépôt était propre sur `5fadd8c`. Property exposait création, lecture unitaire,
détails/conditions commerciales, owners et ownership, mais aucun endpoint de
collection, use case de découverte ou port de listing. La table `properties`
était protégée par tenant transactionnel et forced RLS ; son index existant
`(tenant_id, property_id)` ne couvrait pas l’ordre de pagination visé.

## Objectif et périmètre

Ajouter `GET /v1/properties`, portefeuille privé tenant-scoped, avec autorité
interne explicite, projection bornée, filtres validés, recherche simple et
pagination stable. Publication, catalogue/recherche publics, ranking, analytics
et UI sont hors périmètre.

## Contrat final

Paramètres optionnels :

- `limit` : entier 1–100, défaut 20 ;
- `cursor` : chaîne Base64URL opaque, canonique et limitée à 512 caractères ;
- `status` : enum métier actuel (`DRAFT`) ;
- `type` : `APARTMENT`, `HOUSE`, `LAND`, `COMMERCIAL` ou `OTHER` ;
- `search` : texte normalisé de 1 à 100 caractères.

Réponse : `{ items, pageInfo: { nextCursor, hasNextPage } }`. Un item contient
l’identifiant, titre, description éventuelle, type, transaction, statut,
localisation et dates. Il ne contient ni tenant ID, détails commerciaux complets
ni ownership. Les queries invalides retournent Problem Details 400 ; absence
d’authentification et de `LIST_PROPERTIES` restent respectivement 401 et 403.

## Architecture retenue

`ListProperties` appartient à Application et applique grant, tenant unique,
bornes et normalisation. `PropertyPortfolioQuery` est un port de projection
distinct du repository d’agrégat. `PostgresPropertyPortfolioQuery` exécute une
requête Drizzle unique dans `withTenantPostgresTransaction`. Le contrôleur Zod
décode/encode uniquement le curseur de transport et mappe `type` vers le langage
Application. Il ne contient aucune logique SQL.

Le runtime OIDC résout toujours l’identité externe vers l’autorité persistée ;
le rôle interne TENANT_ADMINISTRATOR reçoit `LIST_PROPERTIES`. Aucun scope ou
claim arbitraire n’est interprété comme autorisation métier.

## Pagination et recherche

L’ordre est exclusivement `createdAt DESC, propertyId DESC`. Le curseur contient
la dernière paire observée, encodée en Base64URL et strictement validée avant de
devenir deux paramètres SQL. L’adapter charge au plus `limit + 1`, puis produit
le curseur suivant sans compteur cross-tenant.

La recherche privée utilise PostgreSQL `ILIKE` paramétré sur titre, description,
ville, quartier et adresse. `%`, `_` et l’échappement sont neutralisés pour
conserver une recherche littérale. Aucun moteur externe ou ranking n’est ajouté.

## Migration et indexation

La migration `0004_property_management_baseline.sql` ajoute uniquement l’index
`(tenant_id, created_at DESC, property_id DESC)`, directement aligné sur le
tenant scope et la pagination keyset. Aucun index de statut n’est justifié tant
que le seul statut est `DRAFT`; aucun index B-tree spéculatif n’est ajouté pour
la recherche `%term%`.

## Fichiers principaux

Créés : use case/port/adapter Portfolio, contrôleur et codec de curseur, migration
0004 et snapshot, tests unitaires et HTTP, plus cette fiche. Modifiés : grant et
exports Property, composition API/OIDC, schémas/DTO/Problem Details/OpenAPI,
index Drizzle, tests PostgreSQL/runtime/contrat et README API/service. Supprimés :
aucun.

## Stratégie de tests

- Unit : défaut/max, filtres, recherche normalisée, pagination vide/avec curseur,
  paramètres invalides et grant ;
- HTTP : toutes les queries, curseur round-trip, 200/400/401/403 et absence de
  tenant ID client ;
- PostgreSQL : deux tenants, filtre + recherche + pagination, ordre stable, RLS
  et présence de l’index ;
- Contract : schémas Zod stricts, projection minimale et OpenAPI versionné ;
- Runtime : listing réel via composition PostgreSQL.

## Validations exécutées

- typecheck de tous les workspaces : PASS ;
- typecheck des tests : PASS ;
- build API et dépendances : PASS ;
- architecture check : PASS ;
- migration Drizzle check : PASS ;
- tests unitaires : 20 fichiers, 132 tests, PASS ;
- tests d’intégration HTTP/PostgreSQL/Testcontainers : 14 fichiers, 115 tests, PASS ;
- tests contractuels : 11 fichiers, 65 tests, PASS ;
- suite globale : 57 fichiers, 403 tests, PASS ;
- contrôle OpenAPI déterministe : PASS ;
- `git diff --check` : PASS.

## Limites connues

Le statut filtrable est actuellement uniquement `DRAFT`. La recherche littérale
`ILIKE` convient à un portefeuille privé borné mais n’offre ni linguistique,
ranking ni performance full-text à grande échelle. Ces évolutions nécessiteront
des mesures et une capacité séparée. La pagination keyset est stable pour les
insertions concurrentes ; comme toute vue vivante, suppressions/modifications
concurrentes peuvent changer les pages restantes.

## Conclusion

Le portefeuille Property privé est disponible de bout en bout avec une autorité
interne dédiée, un tenant scope imposé, une query validée, une projection
minimale et une pagination keyset PostgreSQL stable. La capacité constitue une
base bornée pour UI-003 sans anticiper le catalogue public.
