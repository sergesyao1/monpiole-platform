# TASK-061 — Post-Geolocation Readiness Audit & Property Catalog Withdrawal Definition

- **Statut :** DONE — audit et définition uniquement
- **Date :** 2026-09-01
- **Branche auditée :** `main`
- **HEAD audité :** `c1f5dc9 feat(property): add privacy-first geolocation vertical slice`
- **Référence d’implémentation :** TASK-060
- **Readiness TASK-060 :** **READY WITH CONTAINED GAPS**
- **Décision TASK-062 :** **GO**
- **Prochaine capability :** **TASK-062 — Property Catalog Withdrawal Web Vertical Slice**
- **Commit/push :** aucun

## 1. Executive Summary

TASK-060 constitue une tranche verticale privée de géolocalisation cohérente,
persistante et tenant-safe. La position WGS84 est un concept séparé de
l’adresse métier textuelle. Elle est facultative, stockée à six décimales dans
une table dédiée, validée dans le domaine, Zod et PostgreSQL, et protégée par
une RLS activée et forcée. `STANDALONE` et `COMPOSITE` portent une position
propre ; `UNIT` lit dynamiquement celle de sa Property `COMPOSITE` parente et ne
peut pas créer d’override. Le Web privé permet de consulter, définir, corriger
et retirer cette position sans provider, carte ou clé externe.

Aucune coordonnée n’est exposée par le catalogue public. Les modes `EXACT`,
`APPROXIMATE` et `HIDDEN` capturent une intention future, mais leur projection
reste derrière la frontière privée. Le reader public n’a aucun privilège sur
`property_geolocations`. Les requêtes publiques continuent d’exiger exactement
`status = 'PUBLISHED'` pour la liste, le détail et la photo principale.

Les validations fraîches sont vertes : 187 tests unitaires, 168 intégration,
87 contrats, 71 PostgreSQL Property Management, 115 Web et 655 sur la suite
globale, plus les typechecks, builds API/Web, contrôle d’architecture,
validation Drizzle et régénération OpenAPI. Deux premiers runs ont révélé des
conditions d’exécution, pas des défauts du code : l’intégration chargeait un
`dist` antérieur à TASK-060 avant le build, et Vitest Web a rencontré un
`spawn EPERM` dans le bac à sable. Après build et relance adaptée, les deux
suites passent intégralement.

Le verdict post-TASK-060 est **READY WITH CONTAINED GAPS**. Aucun gap de tenant
isolation, de migration ou d’intégrité ne bloque la suite. Les gaps bornés sont
principalement une projection publique de géolocalisation volontairement non
activée, une représentation OpenAPI de path UUID incomplète, l’absence de
preuve explicite de l’owner SQL et quelques dettes UX/traçabilité différables.

Pour TASK-062, le lifecycle recommandé est
`DRAFT -> PUBLISHED -> WITHDRAWN`. Un retrait ne supprime, n’archive et ne
réinitialise rien. Il conserve le bien dans le portefeuille privé, préserve la
première publication et rend le bien immédiatement inéligible à toute nouvelle
lecture à l’origine public. Le retrait est idempotent sur `WITHDRAWN` ; une
demande sur `DRAFT` est un conflit ; la republication reste explicitement hors
scope et doit être refusée. Le contrat cible est
`DELETE /v1/properties/{propertyId}/publication`, sans body, avec une réponse
200 portant la Property canonique. Le grant retenu est
`WITHDRAW_PROPERTY_FROM_CATALOG`.

La trajectoire est donc **GO** pour **TASK-062 — Property Catalog Withdrawal
Web Vertical Slice**. Le verdict d’exposition Internet demeure **NO-GO** : il
est indépendant de la readiness fonctionnelle et reste soumis aux gaps
d’exploitation, d’anti-abus et de cache déjà recensés.

## 2. Repository Baseline

Les contrôles ont été exécutés avant toute modification :

```text
git status
git status --short
git branch --show-current
git log -8 --oneline
```

| Élément | Résultat observé |
| --- | --- |
| Branche | `main` |
| HEAD | `c1f5dc9 feat(property): add privacy-first geolocation vertical slice` |
| Upstream | `main...origin/main [ahead 44]` |
| Worktree initial | propre |
| Prédécesseur | `1fb2d8f docs(property): audit public catalog readiness and define geolocation slice` |
| Commit TASK-061 | aucun |
| Push TASK-061 | aucun |

Historique pertinent observé :

```text
c1f5dc9 feat(property): add privacy-first geolocation vertical slice
1fb2d8f docs(property): audit public catalog readiness and define geolocation slice
6910457 feat(property): add tenant-scoped public catalog slice
ed8db4a docs(property): audit public catalog readiness
b03501a fix(property): grant runtime access to photo tables
54f05b7 feat(property): complete publication with photo standards
8758f24 docs(property): define publication lifecycle
18f9e13 docs(property): audit composition recovery readiness
```

L’audit a lu `AGENTS.md`, les ADR 0001, 0003, 0004, 0005, 0006 et 0007,
les tâches TASK-050, 051, 052, 053, 055, 056, 057, 058, 059 et 060, les
migrations réelles 0000 à 0012, le snapshot/journal Drizzle, les contrats Zod
et OpenAPI, les compositions NestJS, l’interface React et les suites de tests.
Le dépôt, et non le statut DONE des rapports antérieurs, a servi de source de
vérité.

## 3. TASK-060 Implementation Inventory

### 3.1 Domaine et application

- `services/property-management/src/domain/property-geolocation.ts` définit
  `PropertyGeolocation`, les visibilités publiques, la validation canonique et
  une projection publique non consommée.
- `property-geolocation-repository.ts` définit le port, les résolutions
  `OWN`/`INHERITED`, la trace de mutation et le conflit Unit.
- `manage-property-geolocation.ts` contient les use cases retrieve, update et
  remove avec grants explicites et tenant dérivé de l’autorité.
- `property-authority.ts` contient les trois grants de géolocalisation.

### 3.2 Persistance

- migration append-only `0012_property_geolocation.sql` ;
- snapshot `migrations/meta/0012_snapshot.json` et entrée du journal ;
- mapping Drizzle dans `schema.ts` ;
- `PostgresPropertyGeolocationRepository` avec transactions tenant-scoped,
  verrou Property, upsert et résolution de l’héritage Unit.

### 3.3 API et composition

- contrôleur `PropertyGeolocationController` ;
- DTO et schémas Zod dédiés ;
- mapper HTTP ;
- composition mémoire/PostgreSQL et filtre de grants Identity ;
- artefact `engineering/contracts/http/openapi.json` régénéré.

### 3.4 Web

- `PropertyGeolocationSection.tsx` intégré à `PropertyDetailPage` ;
- méthodes GET/PUT/DELETE dans le client Property authentifié ;
- modèles de réponse `OWN`/`INHERITED` ;
- traductions d’erreurs et tests de section/page.

### 3.5 Tests dédiés

- domaine/application : `tests/unit/property-geolocation.test.ts` ;
- PostgreSQL/migration/RLS :
  `services/property-management/tests/postgres-property-geolocation.test.ts` ;
- HTTP : `tests/integration/api-property-geolocation.test.ts` ;
- OpenAPI : `tests/contract/property-geolocation-openapi.test.ts` ;
- Web : `PropertyGeolocationSection.test.tsx` et tests de pages.

## 4. Geolocation Domain Audit

### 4.1 Modèle réellement livré

La géolocalisation n’a pas été ajoutée dans `Property.location`. Elle est une
ressource optionnelle 0..1 séparée :

```text
propertyId: UUID v4
tenantId: UUID v4
latitude: number, [-90, 90], maximum 6 décimales
longitude: number, [-180, 180], maximum 6 décimales
publicVisibility: EXACT | APPROXIMATE | HIDDEN
```

L’adresse métier textuelle (`country`, `city`, `district`, `addressLine`) reste
obligatoire sur Property et n’est ni géocodée ni remplacée. Les biens existants
restent valides sans ligne de géolocalisation. La création d’une Property ne
crée aucune coordonnée et la publication n’en exige aucune.

### 4.2 Invariants numériques

Le domaine exige `Number.isFinite`, les bornes géographiques et l’égalité avec
`Number(value.toFixed(6))`. Zod exige un nombre JSON fini, les mêmes bornes et
`multipleOf(0.000001)`. PostgreSQL utilise `numeric(8,6)` et `numeric(9,6)` avec
CHECK de bornes.

| Entrée | Résultat |
| --- | --- |
| bornes `-90/90`, `-180/180` | acceptées |
| hors bornes | refusé domaine/Zod/SQL |
| `NaN`, `Infinity`, `-Infinity` | refusé ; non représentable en JSON standard |
| chaîne numérique | refusée par `z.number()` |
| `null` | refusé |
| latitude/longitude absente au PUT | refusée par le body strict |
| plus de six décimales | refusé domaine/Zod ; SQL canonise à six |
| champ supplémentaire | refusé par `.strict()` |

Les réponses JSON contiennent des nombres, pas les chaînes SQL de `numeric` :
le mapping Drizzle configuré renvoie des nombres puis `rehydrate` repasse les
invariants. Les erreurs distinguent entrée client, identifiant serveur invalide
et corruption persistée.

### 4.3 Confidentialité et projection

- `EXACT` retourne les coordonnées canoniques dans `publicPosition()` ;
- `APPROXIMATE` arrondit de façon déterministe à deux décimales et normalise
  `-0` en `0` ;
- `HIDDEN` ne produit aucune position publique.

Cette méthode de domaine n’est appelée par aucune query ni aucun mapper public.
Elle exprime une politique préparatoire, pas une autorisation actuelle de
diffusion. Un arrondi à `0.01°` représente un ordre de grandeur kilométrique
variable avec la latitude ; son adéquation aux biens occupés ou sensibles doit
être revue avant une future exposition.

### 4.4 Rôles structurels

| Rôle | Lecture | Écriture/suppression |
| --- | --- | --- |
| `STANDALONE` | position propre ou absence explicite | autorisée |
| `COMPOSITE` | position propre ou absence explicite | autorisée |
| `UNIT` | position effective du parent `COMPOSITE` | refusée avec `PROPERTY_UNIT_GEOLOCATION_INHERITED` |

Pour une Unit, la résolution suit la relation Unit -> Building -> Property
parente et vérifie qu’il existe exactement une relation et que le parent est
`COMPOSITE`. Une incohérence persistée produit une corruption, pas un fallback
silencieux. L’héritage est dynamique : une modification du parent est visible
à la lecture suivante sans copie. `Building` ne porte pas de coordonnées.

### 4.5 Création, modification et suppression

Le PUT est un remplacement canonique. Le repository verrouille la Property ;
un replay strictement identique retourne la position courante sans réécrire la
trace. Le DELETE est idempotent si aucune ligne propre n’existe. La suppression
retire uniquement la position ; elle ne modifie ni l’adresse, ni le statut, ni
la publication. Aucun provider, géocodeur, reverse geocoder, place ID, PostGIS
ou appel réseau n’est introduit.

## 5. PostgreSQL / Migration Audit

La migration réelle est `0012_property_geolocation.sql`, applicable après
`0011_public_property_catalog_read_boundary.sql`.

| Point | Audit |
| --- | --- |
| Table | `property_management.property_geolocations` dédiée |
| Cardinalité | PK `(tenant_id, property_id)`, donc 0..1 par Property |
| Tenant integrity | FK composite vers `properties(tenant_id, property_id)` |
| Nullabilité | toutes les colonnes d’une ligne sont NOT NULL ; absence = aucune ligne |
| Coordonnées | `numeric(8,6)` / `numeric(9,6)` et CHECK de bornes |
| Visibilité | CHECK `EXACT/APPROXIMATE/HIDDEN` |
| Trace | `updated_at`, `correlation_id`, `actor_id` |
| Indexes | PK seulement ; suffisant pour les lectures exactes actuelles |
| RLS | ENABLE + FORCE |
| Runtime | SELECT/INSERT/UPDATE/DELETE à `monpiole_runtime` |
| Public reader | privilèges explicitement révoqués |
| Bootstrap | snapshot/journal valides, tests clean bootstrap et upgrade verts |

L’upgrade ne backfill aucune coordonnée et ne modifie aucune ligne Property ;
les données historiques restent compatibles. La FK est `NO ACTION`, cohérente
avec l’absence actuelle de suppression de Property. Aucun index spatial n’est
justifié avant une query par zone/rayon.

Le test de migration vérifie la structure, les contraintes, les grants, les
policies, l’upgrade 0011 -> 0012 et l’absence de backfill. L’owner effectif des
objets reste le rôle exécutant les migrations selon le bootstrap standard, mais
ce point n’est pas asserté explicitement par le test : gap de preuve LOW, sans
chemin de fuite observé. `drizzle-kit check` passe.

Aucune régression n’a été observée sur publication, catalogue, portfolio,
composition ou photos ; les 71 tests PostgreSQL Property Management et la
suite globale passent.

## 6. Tenant Isolation / RLS Audit

La policy `property_geolocations_tenant_isolation` compare `tenant_id` à
`NULLIF(current_setting('app.tenant_id', true), '')::uuid` en `USING` et
`WITH CHECK`. Toutes les opérations repository passent par
`withTenantPostgresTransaction` et répètent le tenant dans les prédicats et les
jointures.

Les preuves couvrent :

- lecture et écriture par le tenant propriétaire ;
- absence non révélatrice pour un autre tenant ;
- impossibilité pour tenant A de mettre à jour la position de tenant B ;
- lecture vide et écriture refusée sans contexte tenant ;
- FK et chemin d’héritage Unit tenant-scoped ;
- accès direct du reader public refusé avec SQLSTATE `42501` ;
- absence/cross-tenant traduite en 404 au niveau HTTP.

La policy `FOR ALL TO public` ne rend pas la table publique : `PUBLIC` n’a aucun
privilège, le reader public est explicitement révoqué et seul le runtime possède
les droits DML. Ce pattern est identique aux conventions RLS du dépôt. Aucun
BLOCKER de tenant isolation n’est identifié.

## 7. API / OpenAPI Audit

### 7.1 Contrat réel

| Méthode | Route | Corps | Succès |
| --- | --- | --- | --- |
| GET | `/v1/properties/{propertyId}/geolocation` | aucun | 200, absence ou position effective |
| PUT | `/v1/properties/{propertyId}/geolocation` | latitude, longitude, publicVisibility | 200, position OWN canonique |
| DELETE | `/v1/properties/{propertyId}/geolocation` | aucun | 204, absence garantie |

Les quatre formes de réponse distinguent `configured: true/false` et
`source: OWN/INHERITED`, avec `inheritedFromPropertyId` pour l’héritage. Aucun
tenant, acteur, corrélation ou timestamp SQL n’est exposé.

Les statuts documentés couvrent 400, 401, 403, 404, 409 et 500 selon
l’opération. L’autorité authentifiée est résolue côté serveur ; le tenant vient
de l’unique tenant autorisé et n’apparaît ni dans le path ni dans le body. Les
grants sont :

```text
RETRIEVE_PROPERTY_GEOLOCATION
UPDATE_PROPERTY_GEOLOCATION
REMOVE_PROPERTY_GEOLOCATION
```

Ils sont attribués au `TENANT_ADMINISTRATOR` et filtrés explicitement dans
l’adapter API.

### 7.2 Cohérence des frontières

Implémentation, Zod, DTO, mapper, OpenAPI, client Web et tests concordent sur
les champs, visibilités, bornes, précision et variantes de réponse. Aucun SDK
généré ou modèle partagé supplémentaire n’existe dans le dépôt.

Le path UUID généré dans OpenAPI contient actuellement `format: uuid` mais pas
`type: string`, malgré le décorateur source. Les tests de contrat valident le
format et les opérations, pas cette paire complète. C’est un gap documentaire
LOW hérité de la génération Nest/Zod, pas un défaut de validation runtime.

## 8. Web UX Audit

La section privée « Géolocalisation et confidentialité » est intégrée à la
fiche Property. Elle fournit :

- chargement initial, erreur et retry ;
- état vide explicite ;
- affichage et édition latitude/longitude ;
- normalisation de la virgule décimale ;
- validation locale des bornes et de six décimales ;
- sélection des trois modes de confidentialité ;
- confirmation spécifique avant `EXACT` ;
- sauvegarde, feedback succès, erreur et suppression confirmée ;
- Unit en lecture seule avec lien vers la Property parente.

L’utilisateur peut donc consulter, définir, modifier, constater
l’enregistrement et corriger une position. Les nombres sont présentés à six
décimales. Les labels sont en français, les champs ont des labels, les états
utilisent `role=status/alert` et la confirmation est accessible au clavier via
des boutons natifs. Le layout réutilise la grille responsive existante.

Aucune carte, manipulation visuelle de point ou dépendance externe n’existe ;
il n’y a donc ni credential, ni mode dégradé provider, ni transfert de position
vers un tiers. La saisie manuelle est volontairement plus austère mais complète
pour la tranche fondationnelle.

Le Web ne connaît pas les grants : comme les autres actions privées, la
sécurité reste imposée par l’API et un 403 est présenté comme erreur. C’est sûr,
mais insuffisant pour masquer préventivement une future action de retrait à un
utilisateur sans grant. TASK-062 devra fournir une projection d’affordance
minimale, sans exposer la liste brute des grants.

## 9. Public Catalog Integration Audit

La géolocalisation n’apparaît dans aucun schéma, DTO, mapper, query, page, cache
ou réponse publique. Le reader public n’a pas accès à sa table. Même une
position marquée `EXACT` reste privée aujourd’hui.

Les trois chemins publics sont protégés par un prédicat positif exact :

```text
list:          p.status = 'PUBLISHED'
detail:        p.status = 'PUBLISHED'
primary photo: p.status = 'PUBLISHED'
```

La policy RLS restrictive des Properties et celle des photos répètent cette
condition. Il n’existe aucune logique `status != 'DRAFT'`. Une future valeur
`WITHDRAWN` est donc exclue par défaut de la liste, du détail, des photos, des
filtres et de la pagination. Le détail et la photo doivent répondre 404 afin de
ne pas révéler une ressource redevenue privée.

Les réponses JSON publiques ont `Cache-Control: public, max-age=60` et les
photos `public, max-age=300`. Après retrait, toute nouvelle lecture à l’origine
est immédiatement exclue par transaction ; une copie déjà mise en cache peut
toutefois survivre au plus à son TTL. Sans mécanisme de purge, promettre une
révocation mondiale instantanée serait faux. Cette fenêtre doit être explicite
dans TASK-062 et reste un risque de production tant que le catalogue Internet
est NO-GO.

Avant toute future exposition géographique publique, une tranche séparée devra
valider le threat model des biens occupés/sensibles, l’adéquation de
l’approximation à deux décimales, l’héritage des Units et l’absence de
ré-identification par combinaison avec adresse/quartier. TASK-061 ne change pas
cette politique.

## 10. Test / Build Evidence

Validations exécutées le 2026-09-01 sur `c1f5dc9` :

| Validation réelle | Résultat | Preuve |
| --- | --- | --- |
| `corepack pnpm typecheck:tests` | PASS | TypeScript tests |
| `corepack pnpm app:api:typecheck` | PASS | API sans émission |
| `corepack pnpm app:web:typecheck` | PASS | Web sans émission |
| `corepack pnpm service:property-management:typecheck` | PASS | service sans émission |
| `corepack pnpm architecture:check` | PASS | boundaries, cycles, resolver, graph |
| `corepack pnpm app:api:build` | PASS | 6 projets de dépendance et API |
| `corepack pnpm app:web:build` | PASS | build Vite ; warning de chunk non bloquant |
| `corepack pnpm service:property-management:migration:check` | PASS | Drizzle « Everything’s fine » |
| `corepack pnpm app:api:openapi` | PASS | OpenAPI régénéré sans diff |
| `corepack pnpm test:unit` | PASS | 26 fichiers, 187 tests |
| `corepack pnpm test:integration` | PASS après build | 19 fichiers, 168 tests |
| `corepack pnpm test:contract` | PASS | 15 fichiers, 87 tests |
| `corepack pnpm service:property-management:test:integration` | PASS | 4 fichiers, 71 tests PostgreSQL |
| `corepack pnpm app:web:test` | PASS hors sandbox | 16 fichiers, 115 tests |
| `corepack pnpm test` | PASS | 83 fichiers, 655 tests |

Le premier run d’intégration a échoué 10 fois avec
`PostgresPropertyGeolocationRepository is not a constructor` parce que le
runtime d’intégration charge les exports compilés et que le `dist` présent
précédait TASK-060. Le build API, qui reconstruit ses dépendances, puis la
relance ont produit 168/168 PASS. Ce comportement confirme que le build doit
précéder cette suite sur un checkout dont les artefacts ignorés sont anciens.

Le premier run Web a échoué au chargement de Vite avec `spawn EPERM` dans le
bac à sable Windows. La même commande exécutée avec les permissions nécessaires
a produit 115/115 PASS. Aucun test n’est annoncé PASS sans exécution réussie.

## 11. Gaps & Risk Register

### 11.1 Gaps hérités

| ID | Finding | Severity | Evidence | Impact | Required Action |
| --- | --- | --- | --- | --- | --- |
| H-01 | Readiness Internet toujours incomplète | HIGH | TASK-059 ; aucun rate limit/anti-abus/attestation ingress et exploitation prouvée | exposition publique production risquée | conserver le verdict Internet NO-GO ; traiter dans une tranche de hardening distincte |
| H-02 | Cache public non invalidable | MEDIUM | JSON 60 s, photo 300 s | retrait visible depuis une copie fraîchement cachée jusqu’au TTL | garantir l’exclusion à l’origine dans TASK-062 ; documenter le TTL ; définir purge/revalidation avant Internet si l’exigence devient stricte |
| H-03 | Texte Web publication obsolète | LOW | « La diffusion publique n’est pas incluse dans cette version » alors que TASK-058 existe | information utilisateur trompeuse | corriger le wording dans la section publication modifiée par TASK-062 |
| H-04 | Web sans projection d’actions autorisées | MEDIUM | la session Web n’expose pas les grants ; sécurité uniquement serveur | action potentiellement visible puis 403 | ajouter une affordance serveur minimale `canWithdrawFromCatalog`, sans exposer les grants bruts |

### 11.2 Gaps TASK-060

| ID | Finding | Severity | Evidence | Impact | Required Action |
| --- | --- | --- | --- | --- | --- |
| G-01 | Politique publique géographique non encore threat-modelée | MEDIUM | `publicPosition()` existe mais aucun consommateur public | une future activation naïve pourrait révéler un bien occupé/sensible | garder toute coordonnée hors DTO public ; discovery séparé avant exposition |
| G-02 | Suppression de géolocalisation sans trace durable dédiée | LOW | le DELETE reçoit une corrélation mais le repository supprime la ligne | diagnostic historique impossible après suppression | différer jusqu’à un vrai besoin d’audit/event ; ne bloque pas la donnée actuelle |
| G-03 | Owner SQL non asserté explicitement | LOW | migration/test couvrent grants et RLS, pas `pg_class.relowner` | gap de preuve bootstrap, sans accès constaté | ajouter une assertion lors d’un futur durcissement migration |
| G-04 | Path UUID OpenAPI sans `type: string` généré | LOW | `format: uuid` seul dans l’artefact | consommateurs stricts potentiellement gênés | corriger le wiring/decorator avec la prochaine modification OpenAPI concernée |
| G-05 | Saisie uniquement numérique | LOW | aucune carte/provider par décision TASK-060 | ergonomie moindre, pas d’incomplétude fonctionnelle | différer carte/géocodage à leurs capabilities propres |

### 11.3 Risques TASK-062

| ID | Finding | Severity | Evidence | Impact | Required Action |
| --- | --- | --- | --- | --- | --- |
| W-01 | Extension incomplète de l’union de statuts | HIGH | statut dupliqué domaine, Zod, Web, filtres, SQL | corruption, réponse rejetée ou bien privé invisible | matrice exhaustive DRAFT/PUBLISHED/WITHDRAWN sur toutes les frontières |
| W-02 | Republication accidentelle | HIGH | `publish()` traite actuellement tout non-PUBLISHED comme publiable | `WITHDRAWN -> PUBLISHED` possible sans décision explicite | ajouter un conflit domaine stable avant la vérification des prérequis |
| W-03 | Retrait/publication concurrents | HIGH | deux actions utilisent la même ligne Property | résultat non déterministe sans sérialisation | réutiliser `updateAtomically` et `SELECT ... FOR UPDATE`, tester les ordres de commit |
| W-04 | Filtre public rendu permissif | BLOCKER si introduit | toutes les queries/policies sont aujourd’hui exactes | fuite d’un bien WITHDRAWN | conserver et tester strictement `status = 'PUBLISHED'` sur liste/détail/photo/RLS |
| W-05 | Replay écrasant la trace initiale | MEDIUM | la publication préserve la première trace par no-op | audit du premier retrait perdu | no-op sur WITHDRAWN, ne pas modifier les colonnes de retrait |
| W-06 | Action Web mal alignée sur l’autorité | MEDIUM | absence actuelle de projection des grants | UX trompeuse, sans contournement serveur | projeter `canWithdrawFromCatalog`; conserver l’enforcement use case |

### 11.4 Dettes explicitement différables

Domain/integration event, outbox, raison de retrait, historique multi-cycle,
republication, invalidation CDN, recherche géospatiale, carte et géocodeurs sont
différables. Aucune ne doit être cachée dans TASK-062.

## 12. TASK-060 Readiness Verdict

**Verdict : READY WITH CONTAINED GAPS.**

La capability livrée respecte son périmètre : modèle cohérent, validation
multicouche, migration append-only reproductible, RLS forcée, grants dédiés,
API/Web utilisables et frontière publique fermée. Les tests prouvent le
cross-tenant et les gates globales passent. Aucun finding BLOCKER/HIGH propre à
TASK-060 n’impose une recovery task.

Les gaps MEDIUM concernent uniquement une future exposition publique et la
projection d’autorisation nécessaire à la prochaine UX. Ils sont contenus par
l’absence totale de coordonnées publiques et peuvent être traités dans la
capability qui en a réellement besoin.

## 13. Property Catalog Withdrawal Business Definition

**Property Catalog Withdrawal** est l’action volontaire et autorisée qui retire
une Property déjà publiée de tous les chemins du catalogue public, tout en
conservant l’agrégat et toutes ses données dans le portefeuille privé.

Cette action :

- ne supprime pas la Property ;
- ne supprime ni adresse, géolocalisation, photos, owners, ownership,
  Buildings ou Units ;
- n’archive pas et ne marque pas une indisponibilité/occupation ;
- conserve la preuve de première publication ;
- autorise les modifications privées normales après retrait ;
- ne déclenche pas de republication dans TASK-062.

Tout `PUBLISHED`, quel que soit son rôle `STANDALONE`, `COMPOSITE` ou `UNIT`,
peut être retiré. Le lifecycle de chaque Property demeure indépendant ; retirer
un parent `COMPOSITE` ne retire pas implicitement ses Units publiées, et retirer
une Unit ne retire pas son parent. Une opération en cascade nécessiterait un
cas métier distinct et est hors scope.

## 14. Lifecycle Options Considered

| Option | Valeur | Coût/risque | Décision |
| --- | --- | --- | --- |
| A — `PUBLISHED -> DRAFT` | réutilise deux états | confond jamais publié et retiré, oblige à effacer ou détourner la trace de publication, ambigu pour support/UX | rejetée |
| B — état `WITHDRAWN` | sémantique explicite, historique conservé, filtre public exact déjà compatible | extension finie des unions/contraintes/tests | **retenue** |
| C — `publicationStatus` + `catalogVisibility` | prépare plusieurs canaux/visibilités | deux axes et combinaisons invalides sans besoin actuel de modération, planification ou multi-canal | rejetée comme prématurée |

L’option B est la plus cohérente avec le langage métier et les contraintes SQL
existantes. Elle ajoute une seule valeur et une seule transition sans créer un
second concept dont le produit n’a pas encore besoin.

## 15. Selected Lifecycle Model

```text
DRAFT --publish--> PUBLISHED --withdraw--> WITHDRAWN
```

| État source | Action | État cible | Règle TASK-062 |
| --- | --- | --- | --- |
| `DRAFT` | publish | `PUBLISHED` | autorisé si tous les prérequis sont satisfaits |
| `DRAFT` | withdraw | — | 409 `PROPERTY_NOT_PUBLISHED` |
| `PUBLISHED` | publish | `PUBLISHED` | succès idempotent existant |
| `PUBLISHED` | withdraw | `WITHDRAWN` | transition autorisée |
| `WITHDRAWN` | withdraw | `WITHDRAWN` | succès idempotent, aucune réécriture |
| `WITHDRAWN` | publish | — | 409 `PROPERTY_REPUBLICATION_NOT_SUPPORTED` |

`Property.withdraw(withdrawnAt)` est la transition de domaine cible. Elle doit
valider l’instant, préserver `publishedAt`, fixer `status/withdrawnAt/updatedAt`
et retourner `this` sur un replay `WITHDRAWN`. La demande DRAFT produit une
erreur métier stable.

`Property.publish()` doit être durci avant ses prérequis : `WITHDRAWN` ne doit
jamais retomber dans le chemin actuel « tout non-PUBLISHED peut être publié ».
Une republication future devra revalider tous les prérequis au moment de la
transition, notamment le standard photo tenant courant, et décider la
sémantique des dates/cycles. Elle n’est pas ajoutée automatiquement.

Les mutations privées actuelles de core information, détails, photos,
ownership, composition autorisée et géolocalisation restent possibles sur un
bien WITHDRAWN ; elles ne changent pas son statut.

## 16. Authorization Model

Grant cible unique :

```text
WITHDRAW_PROPERTY_FROM_CATALOG
```

Ce nom est préféré à `UNPUBLISH_PROPERTY`, qui suggère l’effacement de la
publication, et à `WITHDRAW_PROPERTY`, qui peut évoquer un retrait du
portefeuille. Il reprend précisément le langage de la capability.

Le grant est ajouté à `PropertyGrant`, filtré dans
`toPropertyAuthority` et attribué au rôle `TENANT_ADMINISTRATOR` dans la
composition Identity actuelle. Le use case appelle
`authorizedTenant(authority, "WITHDRAW_PROPERTY_FROM_CATALOG")` avant tout
accès repository. Aucun tenant client n’est accepté. Authentification absente =
401, grant/tenant non autorisé = 403, Property absente ou cross-tenant = 404.

Pour l’UX, l’API privée doit projeter uniquement
`canWithdrawFromCatalog: boolean`, calculé côté présentation à partir du grant,
du tenant et de l’état `PUBLISHED`. La liste brute des grants ne doit pas être
exposée au Web. Cette affordance ne remplace jamais l’autorisation du use case.
Le champ est requis uniquement dans le `PropertyResponse` authentifié de détail
(donc aussi dans les réponses canoniques des mutations qui réutilisent ce
schéma), pas dans le portfolio ni dans les DTO publics. Le mapper reçoit
l’autorité authentifiée et retourne `true` seulement si elle porte le grant,
porte l’unique tenant de la Property et que le statut est `PUBLISHED`; toutes
les autres combinaisons donnent `false` sans provoquer un 403 de lecture.

## 17. HTTP Contract

### 17.1 Alternatives

| Contrat | Analyse | Décision |
| --- | --- | --- |
| `DELETE /v1/properties/{id}/publication` | retire la ressource publication, symétrique du PUT, naturellement idempotent | **retenu** |
| `PUT /v1/properties/{id}/withdrawal` | matérialise une commande/ressource supplémentaire | inutile tant qu’il n’existe ni reason ni workflow |
| `POST .../withdraw` | exprime une commande | moins REST et idempotence moins lisible |

### 17.2 Contrat figé

```http
DELETE /v1/properties/{propertyId}/publication
Authorization: Bearer <token>
X-Correlation-Id: <uuid>   # convention de contexte existante

# aucun request body
```

Succès : `200 OK` avec `PropertyResponse` canonique discriminée
`status: "WITHDRAWN"`, `publishedAt`, `withdrawnAt` et
`canWithdrawFromCatalog: false`. Une réponse 200, plutôt que 204, permet au Web
de mettre à jour atomiquement son modèle et donne la même réponse canonique au
premier appel et au replay. OpenAPI ne déclare aucun `requestBody` ; aucune
sémantique n’est attachée à un body DELETE.

| Situation | HTTP | Code stable |
| --- | --- | --- |
| PUBLISHED retiré | 200 | réponse WITHDRAWN |
| WITHDRAWN rejoué | 200 | même état canonique, trace initiale préservée |
| DRAFT | 409 | `PROPERTY_NOT_PUBLISHED` |
| identifiant/path invalide | 400 | Problem Details de validation |
| non authentifié | 401 | convention existante |
| grant/tenant interdit | 403 | convention existante |
| absent/cross-tenant | 404 | `PROPERTY_NOT_FOUND` non révélateur |
| échec interne sûr | 500 | Problem Details sans fuite |

L’opération porte `operationId: withdrawPropertyFromCatalog`, bearer security,
path UUID, réponses Problem Details et headers de corrélation/requête. Le PUT
de publication doit documenter son nouveau 409 de republication refusée. Les
schémas Property, portfolio et filtre de statut ajoutent la variante
`WITHDRAWN`.

## 18. Persistence Impact

Migration cible append-only :

```text
0013_property_catalog_withdrawal.sql
meta/0013_snapshot.json
meta/_journal.json
```

Changements recommandés sur `property_management.properties` :

```text
status accepte DRAFT | PUBLISHED | WITHDRAWN
withdrawn_at timestamptz NULL
withdrawn_by_actor_id text NULL
withdrawal_correlation_id uuid NULL
```

Ces trois colonnes sont justifiées par un besoin immédiat, pas seulement par
symétrie : un retrait rend une annonce inaccessible et doit pouvoir être
diagnostiqué par support/sécurité ; les colonnes génériques
`updated_at/actor_id/correlation_id` peuvent être écrasées par les modifications
privées autorisées après retrait ; un replay ne doit pas effacer l’auteur, la
date ou la corrélation du premier retrait. Seul `withdrawnAt` est exposé dans la
réponse privée. Aucune `withdrawal_reason`, table d’historique ou collection de
cycles n’est ajoutée.

Contrainte d’état cible :

```text
DRAFT:
  publication tuple NULL
  withdrawal tuple NULL

PUBLISHED:
  publication tuple NOT NULL
  withdrawal tuple NULL
  commercial_kind NOT NULL

WITHDRAWN:
  publication tuple NOT NULL
  withdrawal tuple NOT NULL
  commercial_kind NOT NULL
```

Les lignes existantes DRAFT/PUBLISHED satisfont la nouvelle contrainte sans
backfill. Le premier retrait écrit statut, `withdrawn_at`, acteur, corrélation,
`updated_at` et trace générique dans la même transaction. Un replay retourne la
ligne verrouillée sans UPDATE. Les index existants sont suffisants : l’index
privé commence par `(tenant_id, status, ...)` et l’index public partiel demeure
`WHERE status = 'PUBLISHED'`.

Aucune nouvelle table, policy ou grant SQL n’est nécessaire. La RLS Properties
existante s’applique. Les nouvelles colonnes ne sont pas ajoutées au grant
SELECT column-level du reader public. Les policies publiques restent
restrictives et exactes.

La publication actuelle ne produit ni domain event, ni integration event, ni
outbox. TASK-062 conserve cette cohérence et n’introduit pas seule une
infrastructure événementielle. Le tuple immuable de retrait constitue la trace
durable minimale. La dette est explicite : lorsqu’un moteur de recherche, une
invalidation de cache, des notifications ou d’autres consommateurs asynchrones
apparaîtront, le lifecycle publication/retrait devra émettre un événement via
une outbox transactionnelle, et non après commit en best effort.

## 19. Public Catalog Visibility Invariants

Invariant central :

```text
publiclyVisible(property) <=> property.status === PUBLISHED
```

Après commit du retrait :

- la collection ne contient plus la Property ;
- le détail public répond 404 ;
- la photo principale publique répond 404, y compris avec `If-None-Match` ;
- les filtres et pages suivantes ne peuvent pas la réintroduire ;
- l’adresse privée, la géolocalisation et la trace de retrait ne sont jamais
  ajoutées aux DTO publics ;
- le portefeuille privé continue de la retourner et accepte le filtre
  `status=WITHDRAWN`.

La garantie techniquement honnête est **immédiate à l’origine après commit**.
Une représentation déjà cachée peut subsister 60 secondes pour JSON et 300
secondes pour la photo selon les headers actuels. TASK-062 teste l’origine et
documente cette borne ; une purge ou une politique de revalidation stricte est
un prérequis d’ouverture Internet si le produit exige une disparition globale
sans fenêtre. Une copie déjà reçue par un client ne peut jamais être révoquée.

## 20. Web UX Definition

L’action est placée dans la section existante « Publication » de la fiche
privée, uniquement quand `canWithdrawFromCatalog` est vrai. Libellé :

```text
Retirer du catalogue
```

Statut :

```text
WITHDRAWN -> Retiré du catalogue
```

La confirmation simple existante suffit ; aucun modal complexe :

```text
Retirer ce bien du catalogue ?

Il ne sera plus visible publiquement, mais restera disponible dans votre
portefeuille.
```

Comportement minimal :

- bouton non ambigu, jamais « Supprimer » ;
- action absente si le grant manque ou si l’état n’est pas PUBLISHED ;
- double clic neutralisé par le garde in-flight existant ;
- état « Retrait en cours… » et contrôles désactivés ;
- succès : modèle local remplacé par la réponse WITHDRAWN, badge et date de
  retrait affichés, message « Le bien a été retiré du catalogue. » ;
- erreur : message français via `PropertyFeedback`, retry possible ;
- le bien reste accessible depuis le portefeuille et le filtre « Retiré du
  catalogue » ;
- aucun bouton de republication ;
- corriger le texte obsolète affirmant que la diffusion publique n’existe pas.

La section peut signaler que les caches publics existants expirent dans la
fenêtre documentée, sans prétendre vérifier le catalogue depuis le navigateur
authentifié. Le catalogue public, sur une route non authentifiée, doit rendre
404 au détail après revalidation/réponse origine.

## 21. Concurrency / Idempotence Rules

Le pattern cible est celui de publication : transaction tenant-scoped et
`SELECT ... FOR UPDATE` via `PropertyRepository.updateAtomically`.

### 21.1 Deux retraits concurrents

Le premier verrouille et transitionne PUBLISHED -> WITHDRAWN. Le second attend,
relit WITHDRAWN et retourne un succès no-op. Les deux réponses sont 200 ; une
seule trace de premier retrait est écrite.

### 21.2 Publication et retrait concurrents

La ligne Property sérialise les actions :

- si publication DRAFT -> PUBLISHED commit en premier, le retrait relit
  PUBLISHED puis transitionne WITHDRAWN ;
- si un retrait d’un PUBLISHED commit en premier, le publish relit WITHDRAWN et
  répond 409 `PROPERTY_REPUBLICATION_NOT_SUPPORTED` ;
- un retrait demandé lorsque l’état verrouillé est DRAFT répond 409.

Le résultat dépend donc de l’ordre de verrou/commit, mais reste toujours un état
valide. Aucun optimistic versioning ou nouveau mécanisme distribué n’est requis.

### 21.3 Replays séquentiels

Le use case retourne un outcome interne `WITHDRAWN | ALREADY_WITHDRAWN` utile
aux tests/observabilité, mais le contrat HTTP reste identique. Un replay ne
change ni `withdrawnAt`, ni acteur, ni corrélation, ni `updatedAt`.

## 22. TASK-062 Test Matrix

### 22.1 Domaine/application

- PUBLISHED -> WITHDRAWN conserve `publishedAt` et fixe `withdrawnAt/updatedAt` ;
- retrait DRAFT -> `PROPERTY_NOT_PUBLISHED` ;
- retrait WITHDRAWN -> même instance/valeurs, outcome idempotent ;
- publish WITHDRAWN -> `PROPERTY_REPUBLICATION_NOT_SUPPORTED` ;
- absence -> `PropertyNotFoundError` ;
- grant absent, zéro tenant ou plusieurs tenants -> refus ;
- tenant dérivé de l’autorité, jamais de la commande ;
- tous rôles structurels PUBLISHED retirables indépendamment ;
- géolocalisation et autres données inchangées.

### 22.2 PostgreSQL/migration

- clean bootstrap 0000 -> 0013 ;
- upgrade 0012 -> 0013 avec DRAFT/PUBLISHED historiques inchangés ;
- colonnes, nullabilité, CHECK de statut et CHECK de tuples ;
- écriture atomique du premier retrait et conservation des traces de
  publication ;
- replay sans réécriture de trace ;
- violations SQL DRAFT/PUBLISHED/WITHDRAWN impossibles ;
- index public partiel encore exact PUBLISHED ;
- RLS ENABLE/FORCE et grants runtime inchangés ;
- reader public sans accès aux nouvelles colonnes ;
- tenant A ne lit/modifie/retire pas tenant B ;
- deux retraits concurrents et publish/withdraw sérialisés.

### 22.3 HTTP/API/OpenAPI

- DELETE PUBLISHED -> 200 WITHDRAWN canonique ;
- DELETE WITHDRAWN -> 200 identique et stable ;
- DRAFT -> 409 code stable ;
- publish WITHDRAWN -> 409 code stable ;
- 400 path invalide, 401, 403, 404 absent, 404 cross-tenant, 500 sûr ;
- endpoint sans requestBody dans OpenAPI ;
- bearer, UUID, headers et Problem Details documentés ;
- Zod/serializer acceptent les variantes WITHDRAWN détail et portfolio ;
- filtre privé `status=WITHDRAWN` et rejet d’un statut inconnu ;
- `canWithdrawFromCatalog` vrai uniquement avec grant + PUBLISHED ;
- tests de non-régression DRAFT/PUBLISHED.

### 22.4 Catalogue public

- préparer un PUBLISHED visible, vérifier collection/détail/photo ;
- retirer par le chemin privé ;
- nouvelle collection origine : bien absent ;
- détail origine : 404 non révélateur ;
- photo origine avec et sans `If-None-Match` : 404, jamais 304 ;
- deux tenants : le retrait de A n’affecte pas B ;
- policy reader et query empêchent une lecture SQL WITHDRAWN ;
- pagination/cursor ne réintroduit pas le bien ;
- DTO/OpenAPI publics n’exposent ni statut privé, ni traces, ni coordonnées ;
- assertions `Cache-Control` correspondant à la garantie retenue.

### 22.5 Web

- bouton visible pour PUBLISHED et `canWithdrawFromCatalog=true` ;
- bouton absent pour grant manquant, DRAFT et WITHDRAWN ;
- texte de confirmation exact, annulation sans appel ;
- double clic = un appel ; état pending accessible ;
- succès met badge/date/message à jour sans reload complet ;
- replay reste succès ;
- 403/404/409/réseau traduits et retry possible ;
- Property WITHDRAWN reste dans le portefeuille et filtre correctement ;
- route publique détail affiche l’état introuvable après réponse origine ;
- aucune action de suppression/republication rendue.

### 22.6 Gates

Rejouer tests ciblés, suites unit/integration/contract/PostgreSQL/Web, suite
globale, typechecks, builds, architecture, migration check, génération OpenAPI,
`git diff --check` et état Git.

## 23. Explicit Out-of-Scope

TASK-062 exclut :

- republication et ses règles multi-cycle ;
- suppression ou archivage de Property/Building/Unit ;
- cascade de retrait parent/Units ;
- disponibilité, occupation, réservation, bail ;
- raison de retrait et historique complet ;
- domain event, integration event et outbox ;
- notifications, publication/retrait planifié, expiration ;
- workflow d’approbation/modération ;
- purge CDN/cache distribuée ;
- tarification avancée ;
- médias/galerie avancés ;
- analytics, favoris, leads, contact ;
- SEO et enrichissement du catalogue public ;
- carte, géocodage, reverse geocoding, recherche zone/rayon/proximité ;
- applications mobiles et refonte/design system globale.

## 24. TASK-062 Entry Criteria

| ID | Critère | État | Preuve/décision |
| --- | --- | --- | --- |
| EC-01 | Baseline TASK-060 identifiée et propre | SATISFIED | `c1f5dc9`, branche main, worktree initial propre |
| EC-02 | Tenant isolation géolocalisation prouvée | SATISFIED | tests repository, RLS et HTTP cross-tenant |
| EC-03 | Migration 0012 valide et reproductible | SATISFIED | Drizzle check, bootstrap/upgrade, 71 tests PG |
| EC-04 | Frontière géolocalisation publique confirmée | SATISFIED | aucun DTO/query/grant public |
| EC-05 | Sémantique de visibilité publique confirmée | SATISFIED | prédicats et policies exacts PUBLISHED |
| EC-06 | Lifecycle de retrait choisi | SATISFIED | état terminal de tranche WITHDRAWN |
| EC-07 | Contrat HTTP figé | SATISFIED | DELETE publication, bodyless, 200 canonique |
| EC-08 | Grant figé | SATISFIED | `WITHDRAW_PROPERTY_FROM_CATALOG` |
| EC-09 | Idempotence/concurrence figées | SATISFIED | no-op replay + verrou de ligne existant |
| EC-10 | Republication tranchée | SATISFIED | hors scope et 409 explicite |
| EC-11 | Persistance/trace figées | SATISFIED | migration 0013 + tuple de premier retrait |
| EC-12 | UX et affordance d’autorisation figées | SATISFIED | section Publication + boolean serveur |
| EC-13 | Matrice de tests définie | SATISFIED | section 22 |
| EC-14 | Recovery préalable requise | SATISFIED | aucune ; gaps contenus/non bloquants |

Tous les critères d’entrée sont satisfaits. Les corrections H-03/H-04 et la
protection W-02 sont incluses dans la tranche, pas des prérequis externes.

## 25. Recommended TASK-062 Vertical Slice

### TASK-062 — Property Catalog Withdrawal Web Vertical Slice

Livrer une tranche verticale unique contenant :

1. domaine Property étendu à WITHDRAWN, transition `withdraw()` et refus
   explicite de republication ;
2. use case `WithdrawPropertyFromCatalog` avec grant dédié et outcomes
   premier/replay ;
3. adaptation atomique du repository existant ;
4. migration 0013, schema Drizzle, snapshot/journal et contraintes de trace ;
5. DELETE privé bodyless avec réponse Property canonique, Problem Details et
   OpenAPI ;
6. extension des unions détail/portfolio/filtres et affordance
   `canWithdrawFromCatalog` ;
7. section Web française avec confirmation, pending, succès et erreurs ;
8. maintien visible dans le portefeuille privé ;
9. non-régressions publiques liste/détail/photo/RLS après retrait ;
10. matrice de tests de la section 22 et toutes les gates du monorepo.

### Critères DONE TASK-062

- aucun statut SQL/domaine/API/Web incohérent ;
- PUBLISHED -> WITHDRAWN persiste une seule trace complète ;
- WITHDRAWN -> withdraw est un succès no-op ;
- DRAFT -> withdraw et WITHDRAWN -> publish sont des 409 stables ;
- isolation tenant et authorization prouvées sur deux tenants ;
- bien toujours privé, absent de toute lecture origine publique et détail/photo
  en 404 ;
- UX de confirmation et affordance sans grant testées ;
- migration clean/upgrade, OpenAPI, builds, types, architecture et toutes les
  suites passent ;
- aucune feature hors scope introduite ;
- rapport TASK-062, diff check et état Git fournis sans commit/push automatique.

### Pourquoi Withdrawal doit être TASK-062

Withdrawal est la plus petite capability qui ferme une lacune de contrôle
opérationnel du catalogue déjà livré. Availability/Occupancy introduit un autre
sous-domaine et davantage de règles. Pricing, médias, recherche et UX publique
enrichissent l’offre mais augmentent l’exposition avant de permettre son
retrait. Leads/Contact dépendent d’un catalogue publiquement maîtrisable. Une
refonte UI/design system est transverse et ne doit pas retarder cet invariant
métier. La géolocalisation est maintenant assez robuste pour avancer et ne
révèle aucune recovery prioritaire.

| Candidate | Pourquoi pas avant Withdrawal |
| --- | --- |
| Availability / Occupancy | modèle temporel et règles d’exploitation plus larges ; bénéficie d’abord d’un catalogue retirable |
| UI/UX Foundation & Design System | initiative transverse sans fermeture de l’invariant public |
| Advanced Pricing | enrichit l’offre mais ne résout pas la maîtrise de sa diffusion |
| Media / Gallery | socle photo déjà suffisant pour publier ; priorité opérationnelle moindre |
| Public Catalog UX enrichment | accroît l’exposition avant de sécuriser son retrait |
| Leads / Contact | dépend d’annonces dont le propriétaire peut stopper la visibilité |
| Advanced Search | étend le read model public ; doit conserver l’invariant WITHDRAWN dès sa conception |

## 26. Final GO / NO-GO Decision

```text
TASK-060 readiness:
READY WITH CONTAINED GAPS

Geolocation audit:
Capability privée cohérente, persistante, tenant-safe, provider-neutral et
non exposée au catalogue public ; aucun blocker d’intégrité ou d’isolation.

Selected withdrawal model:
DRAFT -> PUBLISHED -> WITHDRAWN ; retrait idempotent ; republication hors scope
et explicitement refusée.

Recommended HTTP contract:
DELETE /v1/properties/{propertyId}/publication -> 200 Property WITHDRAWN

Authorization:
WITHDRAW_PROPERTY_FROM_CATALOG

Public catalog invariant:
Seul status = PUBLISHED est visible ; WITHDRAWN est 404 sur détail/photo et
absent des collections à l’origine après commit.

TASK-062 decision:
GO

Recommended next task:
TASK-062 — Property Catalog Withdrawal Web Vertical Slice
```

Le GO fonctionnel ne change pas le verdict d’exposition Internet : **NO-GO**
tant que les contrôles de production déjà identifiés, notamment cache,
anti-abus, ingress, exploitation et observabilité, ne sont pas démontrés.
