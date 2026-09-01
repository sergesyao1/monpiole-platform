# TASK-060 — Property Geolocation Web Vertical Slice

- **Statut :** DONE
- **Date :** 2026-08-31
- **Branche :** `main`
- **HEAD de départ :** `1fb2d8f docs(property): audit public catalog readiness and define geolocation slice`
- **Commit/push :** aucun

## 1. Executive Summary

TASK-060 livre une tranche verticale privée complète de géolocalisation des
biens. Le modèle sépare l'adresse textuelle existante d'une position WGS84
canonique composée de `latitude`, `longitude` et `publicVisibility`. Les modes
retenus sont `EXACT`, `APPROXIMATE` et `HIDDEN` ; la géolocalisation est
facultative et ne change pas la publication.

Les `STANDALONE` et `COMPOSITE` peuvent porter une position propre. Une `UNIT`
n'enregistre aucun override et lit la position effective de sa Property
`COMPOSITE` parente. `Building` reste sans coordonnées. Le stockage 0..1 utilise
une table dédiée, des numériques à six décimales, une FK tenant-scoped, une RLS
activée/forcée et un accès refusé au reader public.

L'API privée expose GET/PUT/DELETE, trois grants dédiés, Zod, Problem Details et
OpenAPI. La fiche Web française gère les états vide, chargement, validation,
sauvegarde, suppression, succès, erreur et héritage Unit. Aucun provider, carte,
géocodeur, PostGIS ou credential externe n'est introduit. Le catalogue public
n'est pas enrichi et sa frontière est renforcée par des non-régressions
explicites interdisant latitude, longitude et policy privée.

Toutes les validations obligatoires passent, dont la suite globale : **655/655**.

## 2. Git Baseline

La baseline a été contrôlée avant modification :

| Élément | Résultat |
| --- | --- |
| Branche | `main` |
| HEAD | `1fb2d8f` |
| Upstream | `main...origin/main [ahead 43]` |
| Worktree initial | propre |
| Commit TASK-060 | aucun |
| Push TASK-060 | aucun |

Les quatre commits précédents étaient `6910457`, `ed8db4a`, `b03501a` et
`54f05b7`, conformément à la continuité TASK-058/TASK-059.

## 3. Existing Location Model

`Property.location` conserve les informations textuelles pays, ville, quartier
et adresse. Ce modèle est utile à la gestion et à l'affichage, mais ne fournit
ni coordonnées, ni précision, ni décision de confidentialité, ni primitive
fiable pour les futurs calculs spatiaux.

TASK-060 ne remplace, ne recalcule et ne détourne aucun de ces champs. La
géolocalisation structurée est un concept métier distinct et optionnel.

## 4. Domain Decisions

Le value model `PropertyGeolocation` porte :

```text
propertyId
tenantId
latitude
longitude
publicVisibility = EXACT | APPROXIMATE | HIDDEN
```

Les identifiants serveur doivent être des UUID v4. Latitude et longitude doivent
être finies, respecter respectivement `[-90, 90]` et `[-180, 180]`, et avoir au
plus six décimales. `NaN`, les infinis, les bornes dépassées et les valeurs plus
précises sont refusés. Création et réhydratation distinguent erreur client,
valeur serveur invalide et corruption persistée.

Six décimales représentent une résolution nominale décimétrique, suffisamment
fine pour les futurs usages sans introduire les égalités imprévisibles d'un
float SQL. Le domaine expose aussi une projection publique déterministe, mais
aucune route publique ne l'utilise dans cette tranche.

## 5. Privacy Model

- `EXACT` conserve l'intention explicite d'une future exposition exacte.
- `APPROXIMATE` produit dans le domaine un arrondi stable à `0.01°`, soit un
  ordre de grandeur kilométrique dépendant de la latitude. Aucun bruit aléatoire
  par requête n'est utilisé.
- `HIDDEN` ne produit aucune position publique.

La donnée stockée reste toujours la position privée précise. `publicVisibility`
est une décision explicite, jamais une permission implicite de copier les
coordonnées dans un DTO public. Même `EXACT` n'est pas exposé tant qu'une tranche
publique séparée n'a pas défini, revu et testé cette projection.

## 6. STANDALONE / COMPOSITE / UNIT Rules

| Rôle | Règle |
| --- | --- |
| `STANDALONE` | 0..1 géolocalisation propre, modifiable et supprimable. |
| `COMPOSITE` | 0..1 géolocalisation propre représentant l'ensemble. |
| `UNIT` | aucune ligne propre ; lecture héritée du parent `COMPOSITE`. |

Une Unit sans coordonnées sur son parent retourne explicitement
`configured: false`, `source: INHERITED` et `inheritedFromPropertyId`. Une
tentative PUT ou DELETE sur l'Unit produit le conflit stable
`PROPERTY_UNIT_GEOLOCATION_INHERITED`. Aucun fallback sur son adresse textuelle
n'est inventé et aucune copie n'est persistée.

## 7. Building Decision

`Building` n'est pas une Property publiable et ne reçoit aucun champ
géographique dans TASK-060. Il hérite conceptuellement de la position de sa
Property `COMPOSITE`. Une localisation par bâtiment ne sera envisagée que si un
cas métier multi-sites démontre le besoin ; l'ajouter maintenant dupliquerait la
source de vérité et rendrait les Units ambiguës.

## 8. Persistence Design

L'option retenue est la table dédiée
`property_management.property_geolocations` :

- cardinalité 0..1 par clé primaire `(tenant_id, property_id)` ;
- FK composite vers `properties(tenant_id, property_id)` ;
- `latitude numeric(8,6)` et `longitude numeric(9,6)` ;
- CHECK des bornes et de l'enum de visibilité ;
- traces `updated_at`, `correlation_id`, `actor_id` ;
- aucun champ provider, place ID, geohash ou type PostGIS.

Cette séparation rend la donnée privée visible dans l'architecture, isole ses
droits SQL et permet une future migration spatiale ou un index géographique sans
gonfler immédiatement chaque Property historique. Les mises à jour prennent un
verrou sur la Property ; un replay identique ne réécrit pas les traces.

## 9. Migration

La migration append-only `0012_property_geolocation.sql`, son snapshot
`meta/0012_snapshot.json` et l'entrée `_journal.json` ont été créés. L'upgrade
depuis `0011` préserve les Properties historiques et ne backfill aucune
coordonnée. Il active puis force la RLS, retire les privilèges `PUBLIC` et reader,
et accorde uniquement SELECT/INSERT/UPDATE/DELETE à `monpiole_runtime`.

`drizzle-kit check` passe. L'upgrade `0011 -> 0012`, l'absence de backfill, les
types, contraintes, grants et policies sont exécutés dans le test PostgreSQL.

## 10. RLS

La policy `property_geolocations_tenant_isolation` compare `tenant_id` à
`app.tenant_id` en lecture et écriture. La table est en `ENABLE ROW LEVEL
SECURITY` et `FORCE ROW LEVEL SECURITY`.

Les tests prouvent : accès tenant A, absence non révélatrice pour tenant B,
écriture impossible sans contexte, lecture vide sans contexte, FK/relations
tenant-scoped, et erreur SQL `42501` lorsque
`monpiole_public_catalog_reader` tente une lecture directe.

## 11. Authorization

Trois grants suivent les conventions existantes :

```text
RETRIEVE_PROPERTY_GEOLOCATION
UPDATE_PROPERTY_GEOLOCATION
REMOVE_PROPERTY_GEOLOCATION
```

Ils sont filtrés par l'adapter API vers `PropertyAuthority` et attribués à
`TENANT_ADMINISTRATOR` dans la composition Identity. Les use cases dérivent le
tenant de l'autorité interne unique ; aucun tenant n'est accepté dans le path ou
le body.

## 12. API

| Méthode | Route | Résultat |
| --- | --- | --- |
| GET | `/v1/properties/{propertyId}/geolocation` | position effective ou absence explicite |
| PUT | `/v1/properties/{propertyId}/geolocation` | création/remplacement de la position propre |
| DELETE | `/v1/properties/{propertyId}/geolocation` | suppression idempotente, 204 |

Le PUT accepte strictement latitude, longitude et `publicVisibility`. Les
réponses n'exposent ni tenant, ni acteur, ni corrélation, ni timestamps SQL. GET
et PUT répondent 200 ; DELETE 204 ; les conventions 400/401/403/404/409/500 et
les en-têtes `X-Correlation-Id`/`X-Request-Id` sont documentés. Les erreurs
cross-tenant restent 404. Le conflit Unit est 409.

## 13. Public Boundary Impact

Aucune route, query, représentation ni cache public n'est enrichi. Les DTO,
schémas OpenAPI et réponses HTTP publiques excluent explicitement `latitude`,
`longitude` et `publicVisibility`. Le reader public ne possède aucun privilège
sur la nouvelle table.

La géolocalisation ne devient pas un prérequis de `DRAFT -> PUBLISHED`. Les
publications existantes, leurs curseurs, ETag, clés de cache et erreurs ne
consultent pas la nouvelle table. Le verdict Internet reste **NO-GO** ; le
retrait du catalogue reste obligatoire avant toute ouverture Internet.

## 14. Web UX

La fiche privée contient une section « Géolocalisation et confidentialité » :

- champs Latitude/Longitude et normalisation de la virgule décimale ;
- sélection « Position exacte », « Position approximative » ou « Masquer la
  position » ;
- validation bornes/précision avant appel ;
- confirmations pour l'intention exacte et la suppression ;
- états loading, vide, sauvegarde, suppression, succès, erreur et retry ;
- absence de carte ou appel externe ;
- Unit en lecture seule avec lien vers la Property parente.

Le client authentifié central reçoit les trois méthodes API. Les erreurs 409 Unit
sont traduites en français. Les mocks historiques de la fiche ont été complétés
pour préserver les tests existants.

## 15. OpenAPI

`engineering/contracts/http/openapi.json` a été régénéré à partir de
l'application. Il contient les trois opérations, le path UUID, le body strict,
les bornes, le multiple `0.000001`, les trois valeurs de visibilité, les quatre
formes de réponse OWN/INHERITED configurée/non configurée, les statuts, la
sécurité bearer, Problem Details et les en-têtes de traçage.

Le contrat public demeure sans coordonnées privées.

## 16. Tests Added

- domaine/application : bornes, finitude, précision, visibilité, projection,
  absence, grants, tenant, update/remove et héritage ;
- PostgreSQL : upgrade, types, contraintes, replay, traces, CRUD, RLS, grants,
  absence de contexte, reader public et Unit ;
- HTTP : GET/PUT/DELETE, validation, authn/authz, tenant, 404, 409 et erreur sûre ;
- contrat : opérations, schemas, statuts, strictness, précision et héritage ;
- Web : labels FR, vide, save, validation, confirmation, delete, Unit, erreur,
  retry et parsing localisé ;
- public : assertions négatives DTO/OpenAPI/PostgreSQL sur les coordonnées.

Les teardowns PostgreSQL historiques ont été complétés avec la nouvelle table
afin de respecter sa FK avant la suppression des Properties.

## 17. Validation Results

| Validation | Résultat exact |
| --- | --- |
| Tests géolocalisation unitaires ciblés | 17/17 |
| Tests géolocalisation PostgreSQL ciblés | 6/6 |
| Tests géolocalisation HTTP ciblés | 9/9 |
| Tests géolocalisation OpenAPI ciblés | 4/4 |
| Tests Web ciblés fiche + géolocalisation | 26/26 |
| Tests HTTP publics ciblés | 8/8 |
| Tests OpenAPI publics ciblés | 4/4 |
| Property Management PostgreSQL complet | 71/71, 4 fichiers |
| Unitaires complets | 187/187, 26 fichiers |
| Intégration complète | 168/168, 19 fichiers |
| Contrats complets | 87/87, 15 fichiers |
| Web complet | 115/115, 16 fichiers |
| Suite globale | **655/655, 83 fichiers** |
| Typecheck Property Management | PASS |
| Typecheck API | PASS |
| Typecheck Web | PASS |
| Typecheck tests | PASS |
| Build Property Management | PASS |
| Build API | PASS |
| Build Web | PASS, warning de taille de chunk non bloquant |
| Migration check | PASS |
| Génération OpenAPI | PASS |
| Architecture check | PASS |

Docker/PostgreSQL ont bien été utilisés. Aucune validation non exécutée n'est
présentée comme PASS.

## 18. Security / Privacy Analysis

La défense repose sur quatre couches : authority tenant-scoped, repository en
transaction tenant, FK/RLS forcée, et absence totale de grant reader public.
Les coordonnées exactes ne transitent que par le contrat privé bearer. Les
Problem Details inattendus sont génériques et les DTO excluent traces et tenant.

Le choix d'une table dédiée limite aussi le risque d'un futur `SELECT *` public
sur `properties`. La projection approximative est déterministe et testée mais
reste non exposée ; sa pertinence devra être réévaluée avec la menace produit,
la densité locale et les biens occupés avant activation publique.

## 19. Known Gaps

- aucune projection géographique dans le catalogue public ;
- aucune carte, géocodage/reverse geocoding ou autocomplete ;
- aucune validation d'existence physique d'un point ni provenance de donnée ;
- aucun index spatial, PostGIS, recherche zone/rayon/proximité ou tri distance ;
- pas de géolocalisation propre par Building ni override Unit ;
- la granularité publique `0.01°` est une fondation, pas une attestation de
  confidentialité universelle ;
- `Property Catalog Withdrawal` reste la capability produit prioritaire suivante
  et une porte obligatoire avant Internet ;
- rate limiting, observabilité production et revue de données restent hors
  TASK-060 ;
- le build Web conserve son warning non bloquant de chunk supérieur à 500 kB.

## 20. Explicit Non-Goals

Dépublication, archivage, rate limiting, observabilité de production, PostGIS,
recherche rayon/zone/proximité, distance, tri spatial, clustering, carte publique,
Google Maps, Mapbox, Leaflet, géocodage, reverse geocoding, autocomplete,
navigation, tracking, GPS utilisateur et modification du lifecycle de
publication ne sont pas implémentés.

## 21. Final Status

**DONE.** Les critères de la tranche sont satisfaits : modèle structuré,
validation, privacy policy, invariants Unit/Composite, migration, RLS, API,
grants, Web FR, OpenAPI et non-régression publique sont livrés. Les validations
obligatoires et la suite globale passent. Aucun commit et aucun push n'ont été
effectués.

Message de commit proposé, non exécuté :

```text
feat(property): add privacy-first geolocation vertical slice
```
