# TASK-063 — Post-Catalog-Withdrawal Readiness Audit & Property Availability/Occupancy Definition

- **Status :** DONE
- **Date :** 2026-09-01
- **Branche auditée :** `main`
- **HEAD audité :** `51b1e3b feat(property): add catalog withdrawal`
- **Type de tâche :** discovery / audit / définition
- **Implémentation Availability/Occupancy :** aucune
- **Commit / push :** aucun

## 1. Executive Summary

Le verdict post-TASK-062 est **READY WITH CONTAINED GAPS**. Le retrait du
catalogue est une vraie transition métier `PUBLISHED -> WITHDRAWN`, persistée,
tenant-scoped, autorisée et idempotente. Une Property retirée reste lisible et
modifiable dans le périmètre privé, mais elle n'est plus découvrable à
l'origine par aucun chemin public supporté : liste, détail et photo principale.
Une représentation déjà détenue par un cache peut néanmoins survivre jusqu'aux
TTL existants de 60 secondes pour le JSON et 300 secondes pour la photo.

Le repository est suffisamment cohérent pour poursuivre avec TASK-064. Aucun
blocker propre à Availability/Occupancy n'a été trouvé. Sept gaps ou contraintes
résiduels sont enregistrés : deux conditions à fermer dans TASK-064, deux dettes
contenues, deux améliorations futures et un blocker de production Internet qui
ne bloque pas le développement fonctionnel.

Le modèle minimal recommandé sépare quatre notions :

1. `Property.status` contrôle le lifecycle de publication ;
2. `availabilityStatus` décrit la disponibilité commerciale courante ;
3. `occupancyStatus` décrit l'occupation courante ;
4. la visibilité publique reste strictement déterminée par `PUBLISHED`.

`availabilityStatus` vaut `AVAILABLE | UNAVAILABLE` et `occupancyStatus` vaut
`VACANT | OCCUPIED`. Toutes les combinaisons sont valides : un bien occupé peut
être commercialement disponible, et un bien libre peut être indisponible. Pour
les données historiques, l'absence du snapshot signifie « non renseigné » ;
aucune valeur ne doit être déduite de DRAFT, PUBLISHED ou WITHDRAWN.

STANDALONE et UNIT portent leur snapshot courant. COMPOSITE ne porte pas de
snapshot manuel : sa synthèse est calculée depuis ses Units pour éviter deux
sources de vérité. TASK-064 doit gérer uniquement l'état courant, sans
`availableFrom`, période, bail, réservation, calendrier ni historique complet.

La recommandation finale est **GO pour TASK-064**, sous le titre exact :

> **TASK-064 — Property Availability & Occupancy Web Vertical Slice**

## 2. Repository Evidence

### 2.1 Baseline Git réelle

Le pré-flight a exécuté `git status --short` et
`git log --oneline --decorate -20` avant toute écriture.

- le working tree était propre ;
- `HEAD` et `main` pointaient sur `51b1e3b` ;
- TASK-062 était donc commitée, contrairement à son état local inachevé pendant
  son implémentation ;
- le commit audité modifie 54 fichiers, avec 3 652 insertions et 168 suppressions ;
- aucun fichier fonctionnel n'a été modifié par TASK-063.

Chaîne récente vérifiée :

| Capability | Preuve Git / tâche |
| --- | --- |
| Publication | `8758f24`, `TASK-056-property-publication-lifecycle-web-vertical-slice.md` |
| Catalogue public | `6910457`, `TASK-058-public-property-catalog-api-web-vertical-slice.md` |
| Géolocalisation | `c1f5dc9`, `TASK-060-property-geolocation-web-vertical-slice.md` |
| Définition Withdrawal | `3e374b8`, `TASK-061-post-geolocation-readiness-audit-property-catalog-withdrawal-definition.md` |
| Implémentation Withdrawal | `51b1e3b`, `TASK-062-property-catalog-withdrawal-web-vertical-slice.md` |

### 2.2 Sources inspectées

L'audit a inspecté :

- `AGENTS.md` ;
- `.codex/tasks/TASK-056...` à `TASK-062...` ;
- `apps/api`, `apps/web`, `services/property-management`, `packages`, `tests` ;
- migrations `0000` à `0013`, snapshot `0013_snapshot.json` et journal Drizzle ;
- contrat Zod et artefact `engineering/contracts/http/openapi.json` ;
- `.github/workflows/architecture-checks.yml` et `vitest.config.ts` ;
- ADR 0001, 0003, 0004, 0005 et 0006, ainsi que les décisions NestJS,
  Zod/OpenAPI, testing et PostgreSQL/Drizzle pertinentes ;
- l'historique Git récent et le contenu complet du commit TASK-062.

### 2.3 Compatibilité architecture

La proposition TASK-064 reste dans `services/property-management`. Le domaine
et l'application restent framework-neutral ; NestJS demeure un adapter externe ;
PostgreSQL/Drizzle reste un adapter de persistence ; Zod reste la source des
contrats transport ; l'autorité et le tenant demeurent explicites.

Aucun nouveau bounded context, package partagé ou ADR n'est nécessaire. Le
snapshot courant Availability/Occupancy est une responsabilité de Property,
pas un système de lease, booking ou tenant management. La décision est assez
locale et réversible pour être documentée dans cette tâche plutôt que dans un
nouvel ADR.

## 3. TASK-062 Implementation Reconstruction

| Couche | Implémentation réelle | Preuve principale |
| --- | --- | --- |
| Domaine | statut `WITHDRAWN`, `withdraw()`, refus de republication | `services/property-management/src/domain/property.ts:25-28,137-179,220-272` |
| Application | use case atomique et grant dédié | `services/property-management/src/application/withdraw-property-from-catalog.ts:7-37`, `property-authority.ts:1-22` |
| Persistence | verrou de ligne, transition et trace du premier retrait | `postgres-property-repository.ts:68-141` |
| SQL | migration `0013`, tuple de retrait et checks | `migrations/0013_property_catalog_withdrawal.sql:1-23` |
| API | `DELETE /v1/properties/{propertyId}/publication` | `apps/api/src/http/properties/publish-property.controller.ts:45-64` |
| Contrat privé | union DRAFT/PUBLISHED/WITHDRAWN et affordance | `apps/api/src/contracts/v1/properties/property.schema.ts:95-145` |
| Autorité runtime | grant du TENANT_ADMINISTRATOR et filtrage explicite | `identity-external-authority.adapter.ts:7-17`, `authenticated-authority.ts:54-70` |
| Catalogue public | trois requêtes bornées par `status = 'PUBLISHED'` | `postgres-public-property-catalog-query.ts:24-123` |
| Web privé | confirmation, pending, succès, erreurs, état retiré | `PropertyPublicationSection.tsx:16-95` |
| Web portfolio | filtre et libellé WITHDRAWN | `PropertyWorkspacePage.tsx:96-149` |
| Tests | domaine, HTTP, OpenAPI, Web, PG/RLS/concurrence/upgrade | fichiers détaillés en section 10 |

Le chemin réel est :

```text
DELETE privé
  -> autorité OIDC projetée
  -> WithdrawPropertyFromCatalog
  -> authorizedTenant(..., WITHDRAW_PROPERTY_FROM_CATALOG)
  -> PropertyRepository.updateAtomically
  -> SELECT ... FOR UPDATE sous transaction tenant
  -> Property.withdraw
  -> UPDATE status + trace de premier retrait
  -> PropertyResponse WITHDRAWN
```

## 4. Catalog Withdrawal Lifecycle Audit

### 4.1 Modèle réel

Le retrait modifie réellement le statut métier. Il ne s'agit ni d'un booléen,
ni d'un soft delete, ni d'un attribut de publication séparé.

```text
DRAFT --publish--> PUBLISHED --withdraw--> WITHDRAWN
```

`DRAFT` et `WITHDRAWN` sont distingués durablement : DRAFT ne possède ni
`publishedAt` ni `withdrawnAt`, tandis que WITHDRAWN conserve les deux instants
et les traces de première publication/retrait.

### 4.2 Matrice de transitions

| État courant | Commande | Résultat |
| --- | --- | --- |
| DRAFT | publish | PUBLISHED si les prérequis sont satisfaits |
| DRAFT | withdraw | 409 `PROPERTY_NOT_PUBLISHED` |
| PUBLISHED | publish | succès no-op `ALREADY_PUBLISHED` |
| PUBLISHED | withdraw | WITHDRAWN |
| WITHDRAWN | withdraw | succès no-op `ALREADY_WITHDRAWN` |
| WITHDRAWN | publish | 409 `PROPERTY_REPUBLICATION_NOT_SUPPORTED` |

Le domaine refuse la republication avant les prérequis photo
(`property.ts:142-157`). La persistence ne réécrit rien lorsque le callback
retourne l'instance courante (`postgres-property-repository.ts:103-109`). Le
replay conserve donc le premier `withdrawnAt`, l'acteur et la corrélation.

### 4.3 Cohérence multicouche

- le domaine valide les tuples DRAFT/PUBLISHED/WITHDRAWN ;
- SQL impose le même ensemble fermé et les mêmes nullabilités ;
- Zod expose une union discriminée de trois variantes ;
- le portfolio filtre les trois valeurs ;
- le Web possède les trois libellés et ne propose aucune republication ;
- les tests couvrent les transitions et les replays.

Aucune divergence lifecycle domaine/persistence/API/Web n'a été trouvée.

## 5. Public Catalog Exclusion Audit

### 5.1 Chemins publics supportés

| Chemin | Garde réelle | Après retrait |
| --- | --- | --- |
| `GET /v1/public/properties` | SQL `p.status = 'PUBLISHED'` | absent de la liste et de la pagination |
| `GET /v1/public/properties/{id}` | SQL `p.status = 'PUBLISHED'` | 404 non révélateur |
| `GET /v1/public/properties/{id}/primary-photo` | join Property + `p.status = 'PUBLISHED'` | 404, même avec `If-None-Match` |
| RLS Property du reader | policy restrictive PUBLISHED | ligne invisible |
| RLS photo du reader | `EXISTS` vers Property PUBLISHED | photo invisible |

Preuves SQL :

- liste : `postgres-public-property-catalog-query.ts:24-68` ;
- détail : `postgres-public-property-catalog-query.ts:71-93` ;
- photo : `postgres-public-property-catalog-query.ts:95-123` ;
- policies et index : `schema.ts:33-38,98-108,172-191` ;
- migration de frontière publique :
  `migrations/0011_public_property_catalog_read_boundary.sql`.

Le catalogue public ne propose actuellement ni endpoint de recherche distinct,
ni endpoint public de géolocalisation, ni route alternative d'accès au contenu
Property. Les seuls filtres de liste sont type et transaction ; ils s'ajoutent
au prédicat PUBLISHED et ne le remplacent pas. La pagination utilise le couple
`published_at, property_id` et ne réintroduit pas une ligne WITHDRAWN.

Les DTO publics sont des whitelists séparées. Ils n'exposent pas status,
`withdrawnAt`, trace, tenant, autorité, adresse exacte ou géolocalisation
(`public-property.schema.ts:40-69`, `public-property.mapper.ts:8-42`).

### 5.2 Cache

L'exclusion est immédiate à l'origine après commit. Les réponses publiques
déjà mises en cache peuvent subsister :

- JSON : `Cache-Control: public, max-age=60` ;
- photo : `Cache-Control: public, max-age=300` et ETag.

Un appel photo après retrait passe d'abord par le use case/repository, puis
répond 404 `no-store`; il ne peut pas répondre 304 à l'origine. Un cache
intermédiaire ayant déjà la représentation reste toutefois hors contrôle
jusqu'à expiration.

### 5.3 Réponse sans ambiguïté

> **Non, une Property retirée ne peut plus être découverte par un chemin public
> supporté à l'origine. Oui, une copie antérieure peut rester visible dans un
> cache pendant au plus les TTL contractuels existants.**

## 6. Authorization / Tenant Isolation Audit

Le grant réel est `WITHDRAW_PROPERTY_FROM_CATALOG`.

| Frontière | Preuve |
| --- | --- |
| Type application | `property-authority.ts:1-8` |
| Autorisation avant repository | `withdraw-property-from-catalog.ts:21-35` |
| Projection HTTP allowlistée | `authenticated-authority.ts:54-70` |
| Attribution TENANT_ADMINISTRATOR | `identity-external-authority.adapter.ts:7-17` |
| Affordance privée | `property.mapper.ts:24-36` |
| UI | `PropertyPublicationSection.tsx:66-93` |

`authorizedTenant` exige le grant et exactement un tenant. Le use case ne prend
aucun tenant fourni par le client ; il utilise uniquement celui de l'autorité.
Le repository répète le prédicat tenant et exécute la transaction avec
`app.tenant_id`. La table `properties` a RLS activée et forcée.

Matrice observée :

| Situation | Réponse |
| --- | --- |
| sans authentification | 401 |
| authentifié sans grant | 403 |
| autorité avec zéro ou plusieurs tenants | 403 |
| id absent dans le tenant | 404 |
| id existant dans un autre tenant | même 404 |
| id path invalide | 400 |

Les tests PostgreSQL exécutent aussi des SELECT/UPDATE directs sous le contexte
du tenant B et observent zéro ligne. Aucun risque de révélation cross-tenant n'a
été identifié.

## 7. API & OpenAPI Audit

### 7.1 Contrat effectif

```http
DELETE /v1/properties/{propertyId}/publication
Authorization: Bearer <token>
X-Correlation-Id: <uuid>

# aucun request body
```

| Élément | Runtime / OpenAPI |
| --- | --- |
| Méthode / path | DELETE, path exact ci-dessus |
| Body | absent du controller et de l'OpenAPI |
| Succès | 200 avec `PropertyResponse` canonique WITHDRAWN |
| Replay | 200, même `withdrawnAt`, aucune mutation |
| Path | UUID string/format uuid |
| Sécurité | bearer |
| Erreurs | 400, 401, 403, 404, 409, 500 |
| Headers réponse | X-Correlation-Id, X-Request-Id |
| Erreurs | `application/problem+json`, `Cache-Control: no-store` |

Les 409 sont stables : `PROPERTY_NOT_PUBLISHED` sur DRAFT et
`PROPERTY_REPUBLICATION_NOT_SUPPORTED` sur la tentative PUT depuis WITHDRAWN.
Les exceptions inattendues deviennent un 500 sûr sans message interne.

### 7.2 Concordance

Le controller (`publish-property.controller.ts:45-64`), les schémas Zod
(`property.schema.ts:95-145`), le mapper (`property.mapper.ts:8-36`), le filtre
Problem Details (`problem-details.filter.ts:123-160`) et l'artefact OpenAPI sont
concordants. `corepack pnpm app:api:openapi` a régénéré l'artefact sans diff.

Aucune divergence contractuelle bloquante n'a été trouvée.

## 8. Web Audit

### 8.1 Expérience privée

L'action est réellement pilotée par la réponse serveur :

- affichée seulement pour PUBLISHED + `canWithdrawFromCatalog: true` ;
- absente pour DRAFT, WITHDRAWN ou sans affordance ;
- confirmation française explicite ;
- double clic neutralisé par un verrou `useRef` ;
- champset désactivé et texte « Retrait en cours… » ;
- réponse serveur remplace immédiatement le modèle local ;
- succès « Le bien a été retiré du catalogue. » et date affichée ;
- 403, 404, 409 et erreur réseau présentés sans masquer la fiche ;
- retry possible ;
- aucune action de suppression ou republication ajoutée.

Le client centralisé envoie un DELETE sans body
(`property-api.ts:59-64`). La fiche utilise `setProperty` après succès
(`PropertyDetailPage.tsx:92-99`). Un refresh relit la Property via
`GET /v1/properties/{id}` ; les tests PostgreSQL et runtime prouvent que l'état
WITHDRAWN est durable. Le portfolio garde la Property et peut filtrer
WITHDRAWN (`PropertyWorkspacePage.tsx:101-149`).

### 8.2 Expérience publique

Le Web public relit la liste/détail via les routes publiques sans bearer. Un
404 retiré et un 404 inconnu produisent le même état « Bien introuvable »
(`PublicPropertyDetailPage.tsx:25-52`). Il n'existe pas de cache applicatif
React persistant qui contourne la prochaine requête API.

### 8.3 Finding sémantique

Le titre public « Biens disponibles »
(`PublicPropertyCatalogPage.tsx:81-84`) décrit actuellement toutes les
Properties PUBLISHED, sans modèle de disponibilité. Cette dette G-08 avait déjà
été identifiée dans TASK-059 et reste présente. TASK-064 doit la corriger en
« Biens publiés » tant que le catalogue public n'expose pas une disponibilité
commerciale contractuelle.

## 9. Persistence / Migration / RLS Audit

### 9.1 Migration 0013

La chaîne Drizzle est append-only : migration SQL, snapshot `0013` et entrée de
journal sont cohérents. Les migrations antérieures n'ont pas été réécrites.

`0013_property_catalog_withdrawal.sql` :

- ajoute `withdrawn_at`, `withdrawn_by_actor_id`,
  `withdrawal_correlation_id`, tous nullables pour l'upgrade ;
- étend la contrainte status à WITHDRAWN ;
- impose les tuples exacts des trois états ;
- impose `withdrawn_at >= published_at` ;
- conserve les termes commerciaux d'une Property retirée ;
- étend l'audit de photo principale à WITHDRAWN.

L'upgrade 0012 -> 0013 laisse les DRAFT/PUBLISHED historiques inchangés et ne
backfill aucune trace fictive. Le public reader conserve seulement ses grants
de colonnes historiques : il ne peut pas lire les nouvelles traces.

### 9.2 RLS, policies et index

- RLS de `properties` reste activée et forcée ;
- la policy tenant reste symétrique USING/WITH CHECK ;
- la policy publique restrictive reste exactement PUBLISHED ;
- l'index partiel public reste exactement PUBLISHED ;
- aucune nouvelle table ou policy n'était nécessaire ;
- les relations Building/Unit conservent leurs clés tenant et RLS forcée.

### 9.3 Dette vis-à-vis d'Availability/Occupancy

Le modèle de retrait ne crée pas de dette structurelle pour la prochaine
capability. Au contraire, l'état de publication est maintenant fermé et peut
rester indépendant. La nouvelle donnée doit être ajoutée comme état courant
séparé ; elle ne doit modifier ni `properties_status_check`, ni la policy
publique PUBLISHED, ni les traces de retrait.

## 10. Test Evidence

### 10.1 Cartographie TASK-062

| Niveau | Scénarios couverts | Preuves |
| --- | --- | --- |
| Domaine | transitions, instants, données conservées, republication | `tests/unit/property-management.test.ts:105-139` |
| Application | grant, tenant, not-found, replay sans clock/write | `tests/unit/property-management.test.ts:200-258` |
| HTTP privé | 200/replay, 400/401/403/404/409/500, affordance | `tests/integration/api-properties.test.ts:206-305` |
| HTTP public | visible avant, absent liste/détail/photo après | `tests/integration/api-properties.test.ts:306-333` |
| Runtime réel | API + rôle public distinct + retrait durable | `tests/integration/api-identity-postgres-runtime.test.ts:597-665` |
| OpenAPI | DELETE bodyless, sécurité, UUID, réponses, union | `tests/contract/property-openapi.test.ts:54-94,179+` |
| DTO public | absence des champs privés/retrait | `tests/contract/public-property-catalog-openapi.test.ts:44-74` |
| PostgreSQL | upgrade, RLS, trace, concurrence, contraintes | `postgres-property-repository.test.ts:99-139,260-508` |
| Catalogue PG | liste/détail/photo excluent WITHDRAWN | `postgres-public-property-catalog.test.ts:58-105` |
| Photo PG | remplacement privé après retrait | `postgres-property-primary-photo.test.ts:227-253` |
| Web privé | confirmation, pending, erreurs, retry, permissions | `PropertyPublicationSection.test.tsx:112-185` |
| Web intégré | vrai client DELETE bodyless + bearer | `PropertyPages.test.tsx:153-191` |
| Portfolio/Web public | filtre WITHDRAWN et 404 non révélateur | `PropertyPortfolioPage.test.tsx:176+`, `PublicCatalogPages.test.tsx:119+` |

### 10.2 Validations exécutées le 2026-09-01

Docker Desktop était opérationnel : client/server Engine 29.7.2, contexte
`desktop-linux`.

| Commande réelle | Résultat |
| --- | --- |
| `corepack pnpm -r typecheck` | PASS — 9 workspaces |
| `corepack pnpm typecheck:tests` | PASS |
| `corepack pnpm architecture:check` | PASS |
| `corepack pnpm app:api:build` | PASS |
| `corepack pnpm app:web:build` | PASS — warning chunk 588,24 kB |
| `corepack pnpm service:property-management:migration:check` | PASS — `Everything's fine` |
| `corepack pnpm test:unit` | PASS — 26 fichiers, 194/194 |
| `corepack pnpm test:integration` | PASS — 19 fichiers, 175/175 |
| `corepack pnpm test:contract` | PASS — 15 fichiers, 88/88 |
| `corepack pnpm app:web:test` | PASS — 16 fichiers, 123/123 |
| `corepack pnpm service:property-management:test:integration` | PASS — 4 fichiers, 75/75 PostgreSQL réel |
| `corepack pnpm app:api:openapi` | PASS — artefact régénéré sans diff |
| `corepack pnpm test` | PASS — 83 fichiers, 682/682 |

Aucun test n'est annoncé PASS sur un skip. La suite PostgreSQL ciblée a utilisé
Docker/Testcontainers et une base PostgreSQL réelle.

## 11. Gaps and Risk Classification

Sept findings sont enregistrés. Aucun n'est un blocker pour démarrer TASK-064.

| ID | Classe | Finding | Impact | Action |
| --- | --- | --- | --- | --- |
| G-063-01 | Condition d'entrée TASK-064 / MEDIUM | le workflow CI exécute bien tous les tests `persistence-integration` via le script package, mais n'appelle pas explicitement `service:property-management:migration:check` | un drift Drizzle propre au service peut ne pas être détecté par la CI | câbler ce check dans le job persistence de TASK-064 |
| G-063-02 | Condition d'entrée TASK-064 / LOW | le catalogue dit « Biens disponibles » alors qu'il ne connaît que PUBLISHED | confusion publication/disponibilité | renommer « Biens publiés » dans TASK-064 |
| G-063-03 | Dette contenue / MEDIUM | aucune purge des caches publics 60/300 s | visibilité transitoire d'une copie antérieure après retrait | conserver la borne ; traiter purge/CDN avant exigence stricte Internet |
| G-063-04 | Dette héritée contenue / HIGH | durcir `property_photo_standards` ne réévalue pas les Properties déjà publiées | annonce publiée potentiellement non conforme au nouveau standard | tranche dédiée ; sans lien causal avec Availability |
| G-063-05 | Amélioration future / MEDIUM | pas de test navigateur déployé couvrant action privée, cache intermédiaire et refresh public | preuve de wiring déployé moins directe | smoke/E2E hosting avant Internet |
| G-063-06 | Amélioration future / TECH DEBT | chunk Web 588,24 kB > 500 kB | performance initiale | code splitting dans la tranche UI/UX prévue |
| G-063-07 | Blocker production Internet, pas TASK-064 / HIGH | gates TASK-059 ingress, secrets, anti-abus, capacité, observabilité, HA et contenu réel non closes | catalogue non prêt à une exposition Internet production | conserver Internet NO-GO jusqu'au hardening attesté |

Le rapport TASK-062 annonçait correctement zéro gap fonctionnel/RLS/migration
sur le retrait lui-même. Le présent registre ajoute des gaps de readiness et de
CI plus larges ; il ne remet pas en cause la correction fonctionnelle du retrait.

## 12. Post-TASK-062 Readiness Verdict

**READY WITH CONTAINED GAPS.**

Justification :

- lifecycle fermé et cohérent ;
- retrait durable, autorisé, tenant-safe et idempotent ;
- exclusion publique prouvée par SQL, RLS, HTTP et PostgreSQL réel ;
- contrat runtime/OpenAPI concordant ;
- Web privé utilisable et portfolio conservé ;
- migrations reproductibles ;
- toutes les suites et builds demandés passent ;
- aucune dette du retrait n'oblige à détourner publication pour Availability.

Le verdict n'est pas READY absolu à cause des caches, du wording, du gate de
migration CI et des gates Internet. Aucun de ces points n'impose une recovery
task avant la capability fonctionnelle suivante.

## 13. Availability / Occupancy Problem Definition

TASK-064 doit répondre à deux questions courantes, sans prétendre gérer la
cause ni la période :

1. le bien peut-il actuellement être proposé pour son projet commercial ?
2. le bien est-il actuellement physiquement occupé ?

Le système ne possède ni Lease, ni Booking, ni Tenant/Occupant métier, ni
calendrier. La source de vérité initiale est donc une déclaration opérateur du
tenant, pas une déduction contractuelle.

Le plus petit résultat utile est un snapshot courant, modifiable et lisible,
tenant-scoped, avec une synthèse pour les ensembles immobiliers. La tranche ne
doit pas expliquer pourquoi le bien est indisponible, qui l'occupe, depuis
quand, jusqu'à quand, ni quelle réservation existe.

## 14. Domain Semantics

### 14.1 Deux axes indépendants

```ts
type PropertyAvailabilityStatus = "AVAILABLE" | "UNAVAILABLE";
type PropertyOccupancyStatus = "VACANT" | "OCCUPIED";

interface PropertyAvailabilitySnapshot {
  availabilityStatus: PropertyAvailabilityStatus;
  occupancyStatus: PropertyOccupancyStatus;
  updatedAt: string;
}
```

Sémantique :

- `AVAILABLE` : le tenant accepte actuellement de proposer la Property pour
  son `transactionType` ;
- `UNAVAILABLE` : le tenant ne la propose pas actuellement ; la raison n'est
  pas modélisée ;
- `VACANT` : la Property n'est pas physiquement occupée selon la connaissance
  opérationnelle actuelle ;
- `OCCUPIED` : la Property est physiquement occupée selon cette même
  connaissance, sans implication de bail valide.

L'absence de snapshot signifie **non renseigné**. Elle ne devient pas un
troisième enum persistant et n'est jamais assimilée à UNAVAILABLE ou VACANT.
Les réponses transport peuvent employer `configured: false` et les projections
COMPOSITE/publiques futures `NOT_CONFIGURED`.

### 14.2 Combinaisons valides

| Availability | Occupancy | Exemple |
| --- | --- | --- |
| AVAILABLE | VACANT | bien libre proposé maintenant |
| AVAILABLE | OCCUPIED | vente occupée ou location proposée pour un futur changement non daté |
| UNAVAILABLE | VACANT | travaux, pause commerciale, décision propriétaire |
| UNAVAILABLE | OCCUPIED | occupation actuelle sans commercialisation |

Aucune transition de l'un des axes ne doit modifier automatiquement l'autre.

### 14.3 Date et historique

`availableFrom` est différé. Sans période, fuseau métier, lease ou calendrier,
une date future rendrait AVAILABLE ambigu (« disponible maintenant » ou « à
partir de ») et introduirait des transitions dépendantes de l'horloge.

TASK-064 gère uniquement le dernier snapshot. Il conserve une trace de dernière
mise à jour, pas un historique complet, des périodes ou un event stream.

## 15. Publication vs Availability vs Occupancy

| Concept | Question | Source de vérité | Effet public TASK-064 |
| --- | --- | --- | --- |
| Publication | peut-on diffuser cette Property ? | `Property.status` | visible si et seulement si PUBLISHED |
| Availability | le tenant la propose-t-il maintenant ? | snapshot commercial | aucun effet de visibilité automatique |
| Occupancy | est-elle physiquement occupée ? | snapshot opérationnel privé | jamais exposé publiquement |
| Transaction effective | bail/vente/booking existe-t-il ? | non modélisée | aucun |

Matrice obligatoire :

| Cas | Représentable ? | Comportement |
| --- | --- | --- |
| A — PUBLISHED + AVAILABLE | oui | visible ; availability privée renseignée |
| B — PUBLISHED + OCCUPIED | oui | reste visible ; occupancy privée |
| C — WITHDRAWN + OCCUPIED | oui | privé uniquement |
| D — WITHDRAWN + AVAILABLE | oui | privé uniquement ; retrait domine la visibilité |
| E — DRAFT + OCCUPIED | oui | privé uniquement |
| F — UNIT AVAILABLE | oui | snapshot direct de la Unit |
| G — COMPOSITE mixte | oui | synthèse dérivée de ses Units |

Le retrait du catalogue ne doit jamais servir de commande « occupé » ou
« indisponible ». Réciproquement, `UNAVAILABLE` ou `OCCUPIED` ne doit jamais
écrire WITHDRAWN.

## 16. STANDALONE / COMPOSITE / UNIT Semantics

### 16.1 STANDALONE

- porte un snapshot direct facultatif ;
- peut être AVAILABLE/UNAVAILABLE et VACANT/OCCUPIED quel que soit son status
  de publication ;
- expose une action de mise à jour si l'autorité possède le grant.

### 16.2 UNIT

- porte exactement le même snapshot direct qu'un STANDALONE ;
- reste une Property autonome au niveau domaine/persistence ;
- est mise à jour par son `unitPropertyId`, sous le tenant authentifié ;
- ne reçoit aucune valeur héritée de COMPOSITE ou Building.

### 16.3 COMPOSITE

COMPOSITE ne porte pas de snapshot manuel. Sa synthèse est dérivée de toutes
les Units rattachées à ses Buildings :

- `totalUnitCount` ;
- `configuredUnitCount` ;
- `availableUnitCount` et `unavailableUnitCount` ;
- `vacantUnitCount` et `occupiedUnitCount` ;
- `unconfiguredUnitCount`.

Projection commerciale COMPOSITE :

```text
AVAILABLE      si availableUnitCount > 0
UNAVAILABLE    si totalUnitCount > 0, configuredUnitCount = totalUnitCount
               et availableUnitCount = 0
NOT_CONFIGURED sinon, notamment zéro Unit ou au moins une Unit inconnue sans
               aucune Unit AVAILABLE
```

Il n'existe pas de statut d'occupation unique du COMPOSITE ; les compteurs
VACANT/OCCUPIED sont la projection honnête d'un ensemble mixte.

Lors du premier Building, le passage STANDALONE -> COMPOSITE doit, dans la même
transaction, rendre absent tout ancien snapshot direct. Ce snapshot décrivait
le bien autonome et ne s'applique plus au conteneur. Le Web doit informer que
la disponibilité se gère désormais Unit par Unit. Cette règle doit être testée
et ne doit pas affecter les Units existantes.

## 17. Commercial Terms Interaction

Le modèle reste identique pour les trois `transactionType`, mais sa
signification est bornée :

| Transaction | Availability | Occupancy |
| --- | --- | --- |
| LONG_TERM_RENTAL | proposé ou non à un prospect locataire | état physique courant utile |
| SHORT_TERM_RENTAL | accepte globalement des demandes, sans promesse pour une date | observation courante seulement, pas un calendrier |
| SALE | accepte ou non des offres d'achat | indépendant ; un bien occupé peut être vendu |

TASK-064 ne doit ajouter aucune contrainte liant availability à
`commercialTerms.kind`, ni masquer les combinaisons AVAILABLE+OCCUPIED. Pour la
courte durée, AVAILABLE ne garantit aucune nuit précise. Cette limite doit être
visible dans la documentation et le texte Web privé.

## 18. Public Catalog Interaction

Décision TASK-064 : **ne pas exposer Availability/Occupancy dans le contrat
public initial et ne pas ajouter de filtre `availableOnly`.**

Raisons :

- l'occupation est une donnée privée et potentiellement sensible ;
- AVAILABLE en courte durée n'est pas une disponibilité calendaire ;
- la synthèse COMPOSITE nécessite une projection de relations privées que le
  reader public ne peut actuellement pas lire ;
- une exposition partielle STANDALONE/UNIT serait incohérente ;
- le Web privé suffit à démontrer la première tranche verticale.

Règles impératives :

- PUBLISHED + OCCUPIED reste visible ;
- PUBLISHED + UNAVAILABLE reste visible ;
- WITHDRAWN reste invisible même si AVAILABLE ;
- DRAFT reste invisible même si AVAILABLE ;
- le catalogue public ne reçoit jamais `occupancyStatus` ;
- TASK-064 remplace seulement le wording « Biens disponibles » par
  « Biens publiés » ;
- les tests publics prouvent que chaque combinaison availability/occupancy
  laisse le prédicat de visibilité inchangé.

Une tranche ultérieure pourra exposer uniquement une projection commerciale
après définition d'un read model public sûr pour COMPOSITE. Le filtre
`availableOnly` appartient à cette tranche ultérieure.

## 19. Persistence Model Recommendation

### 19.1 Choix

Ajouter le snapshot courant directement à la ligne `properties` est le modèle
minimal compatible avec le repository :

- Property est déjà l'aggregate qui porte rôle, transaction et lifecycle ;
- STANDALONE et UNIT sont tous deux des lignes Property ;
- `updateAtomically` fournit transaction et verrou ;
- aucun historique ni relation externe ne justifie une nouvelle table ;
- aucune nouvelle frontière de service n'est nécessaire.

Champs recommandés pour la migration `0014_property_availability_occupancy.sql` :

```text
availability_status                  text NULL
occupancy_status                     text NULL
availability_updated_at              timestamptz NULL
availability_updated_by_actor_id      text NULL
availability_correlation_id           uuid NULL
```

Contraintes :

1. les cinq champs sont tous nuls ou tous non nuls ;
2. `availability_status IN ('AVAILABLE', 'UNAVAILABLE')` ;
3. `occupancy_status IN ('VACANT', 'OCCUPIED')` ;
4. COMPOSITE impose les cinq champs nuls ;
5. STANDALONE/UNIT autorisent l'absence ou le tuple complet ;
6. aucune contrainte ne dépend de DRAFT/PUBLISHED/WITHDRAWN ;
7. aucune contrainte ne dépend du transactionType.

La synthèse COMPOSITE est un read model calculé par une query applicative sur
`properties`, `property_buildings` et `property_building_units`. Elle ne doit
pas être persistée comme une seconde autorité.

### 19.2 RLS et index

- réutiliser RLS `properties_tenant_isolation` ;
- ne créer aucune nouvelle policy ;
- ne donner aucun grant sur ces colonnes au public reader dans TASK-064 ;
- vérifier les privilèges runtime et le refus public par test PostgreSQL ;
- ne créer aucun index availability tant qu'aucun filtre/tri ne l'utilise ;
- réutiliser les index de relations existants pour la synthèse COMPOSITE.

## 20. Concurrency & Idempotence

### 20.1 Mise à jour directe

Le PUT réutilise `PropertyRepository.updateAtomically` et `SELECT ... FOR
UPDATE`. Deux mises à jour concurrentes sont sérialisées. TASK-064 accepte un
**last committed write wins** explicite : aucun optimistic lock ou ETag métier
n'est ajouté dans cette tranche.

La requête porte toujours les deux axes. Elle ne peut donc pas persister un
demi-snapshot incohérent. Le dernier client peut néanmoins remplacer le couple
du premier ; ce compromis est acceptable pour un état opérationnel déclaratif
sans workflow contractuel.

### 20.2 Replay

`AVAILABLE -> AVAILABLE` avec le même occupancy, et `OCCUPIED -> OCCUPIED` avec
la même availability, sont des succès 200 no-op :

- même snapshot ;
- même `updatedAt` et même trace ;
- aucune lecture d'horloge ;
- aucun UPDATE SQL.

Un changement d'un seul axe écrit le nouveau couple et une nouvelle trace de
dernière mise à jour.

### 20.3 Synthèse COMPOSITE

La synthèse doit être calculée par une seule requête SQL sous transaction tenant
afin d'obtenir un snapshot cohérent de la lecture. Une mise à jour Unit
concurrente peut être visible avant ou après cette lecture, jamais comme un
tuple partiel.

## 21. Authorization Model

Grants recommandés :

```text
RETRIEVE_PROPERTY_AVAILABILITY
UPDATE_PROPERTY_AVAILABILITY
```

Deux grants suivent le précédent géolocalisation et permettent le moindre
privilège. Ils sont attribués au rôle `TENANT_ADMINISTRATOR` dans la tranche.

Règles :

- GET exige `RETRIEVE_PROPERTY_AVAILABILITY` ;
- PUT exige `UPDATE_PROPERTY_AVAILABILITY` ;
- autorisation avant tout accès repository ;
- exactement un tenant issu de l'autorité ;
- cross-tenant et absent retournent le même 404 ;
- la réponse projette `canUpdateAvailability`, jamais les grants bruts ;
- COMPOSITE projette toujours `canUpdateAvailability: false` ;
- le catalogue public n'utilise aucun de ces grants et ne reçoit aucune
  donnée dans TASK-064.

## 22. Proposed TASK-064 API Surface

### 22.1 GET courant / synthèse

```http
GET /v1/properties/{propertyId}/availability
Authorization: Bearer <token>
```

Réponse directe non configurée :

```json
{
  "propertyId": "uuid",
  "source": "DIRECT",
  "structuralRole": "STANDALONE",
  "configured": false,
  "canUpdateAvailability": true
}
```

Réponse directe configurée :

```json
{
  "propertyId": "uuid",
  "source": "DIRECT",
  "structuralRole": "UNIT",
  "configured": true,
  "availabilityStatus": "AVAILABLE",
  "occupancyStatus": "OCCUPIED",
  "updatedAt": "2026-09-01T10:00:00.000Z",
  "canUpdateAvailability": true
}
```

Réponse COMPOSITE :

```json
{
  "propertyId": "uuid",
  "source": "DERIVED_FROM_UNITS",
  "structuralRole": "COMPOSITE",
  "availabilityStatus": "AVAILABLE",
  "totalUnitCount": 3,
  "configuredUnitCount": 2,
  "availableUnitCount": 1,
  "unavailableUnitCount": 1,
  "vacantUnitCount": 1,
  "occupiedUnitCount": 1,
  "unconfiguredUnitCount": 1,
  "canUpdateAvailability": false
}
```

Codes GET : 200, 400, 401, 403, 404, 500.

### 22.2 PUT idempotent

```http
PUT /v1/properties/{propertyId}/availability
Authorization: Bearer <token>
Content-Type: application/json

{
  "availabilityStatus": "AVAILABLE",
  "occupancyStatus": "VACANT"
}
```

Le body est strict. Il refuse notamment `availableFrom`, status de publication,
tenant, timestamps et champs de trace.

Succès : 200 avec la variante directe configurée du GET. Replay identique :
200 no-op.

Erreurs :

| Code | Situation |
| --- | --- |
| 400 | UUID/body/enum/champ supplémentaire invalide |
| 401 | absence d'authentification |
| 403 | grant absent ou autorité tenant ambiguë |
| 404 | Property absente ou cross-tenant |
| 409 | Property COMPOSITE, code `PROPERTY_AVAILABILITY_DERIVED_FROM_UNITS` |
| 500 | panne inattendue rendue sûre |

Les deux opérations publient bearer, UUID complet, Problem Details et headers
X-Correlation-Id/X-Request-Id dans OpenAPI. Aucun DELETE, PATCH, endpoint
d'historique ou endpoint public n'est retenu.

## 23. Proposed TASK-064 Web Scope

Périmètre Web recommandé, en français :

1. nouvelle section privée « Disponibilité et occupation » sur la fiche ;
2. chargement GET avec état de chargement, erreur locale et retry ;
3. pour STANDALONE/UNIT : deux choix explicites « Disponible / Indisponible »
   et « Libre / Occupé », confirmation simple, pending et succès ;
4. indication « Non renseignée » avant la première définition ;
5. action visible seulement avec `canUpdateAvailability` ;
6. pour COMPOSITE : compteurs dérivés, aucune édition directe et texte
   « La disponibilité de cet ensemble est calculée depuis ses unités » ;
7. dans la composition existante : affichage et modification de la disponibilité
   de chaque Unit lorsque ses unités sont développées ;
8. après refresh, lecture des valeurs PostgreSQL persistées ;
9. lors de la première création Building, message indiquant que la gestion est
   désormais Unit par Unit ;
10. correction publique « Biens disponibles » -> « Biens publiés ».

Déféré pour garder la tranche petite : badge/filtre availability dans le
portfolio, filtre public, badge public, redesign général et design system. Le
portfolio privé continue toutefois à contenir DRAFT/PUBLISHED/WITHDRAWN sans
être filtré par availability.

## 24. Proposed Test Matrix

### 24.1 Domaine

- création/rehydration sans snapshot ;
- quatre combinaisons valides des deux axes ;
- enum/instant invalides ;
- même couple = même instance ;
- changement d'un axe préserve l'autre fourni dans la commande ;
- DRAFT/PUBLISHED/WITHDRAWN n'altèrent pas le snapshot ;
- STANDALONE et UNIT acceptent ; COMPOSITE refuse une mutation directe ;
- `becomeComposite` retire le snapshot direct sans affecter publication.

### 24.2 Application

- GET direct configuré/non configuré et COMPOSITE dérivé ;
- PUT autorisé, no-op, horloge non consommée sur replay ;
- grant absent, zéro/multiple tenant, not-found, cross-tenant ;
- compteurs COMPOSITE avec zéro Unit, Units inconnues, toutes indisponibles,
  mélange AVAILABLE/UNAVAILABLE et VACANT/OCCUPIED.

### 24.3 HTTP / contrat

- GET/PUT exacts, body strict, UUID, bearer et headers ;
- 200/400/401/403/404/409/500 ;
- Problem Details stable et 500 sans fuite ;
- `canUpdateAvailability` true/false sans grants bruts ;
- OpenAPI union directe/composite et absence d'endpoint public ;
- schémas publics rejettent availability/occupancy.

### 24.4 PostgreSQL / migration / RLS

- bootstrap 0000 -> 0014 ;
- upgrade 0013 -> 0014 avec DRAFT/PUBLISHED/WITHDRAWN historiques inchangés
  et snapshot nul ;
- journal/snapshot/migration check ;
- contraintes all-null/all-non-null, enums et COMPOSITE ;
- trace dernière mise à jour et replay sans UPDATE ;
- SELECT/UPDATE cross-tenant directs = zéro ligne ;
- public reader ne peut lire aucune nouvelle colonne ;
- aucune modification des policies/index PUBLISHED ;
- deux PUT concurrents sérialisés, état final valide et last-write-wins ;
- promotion STANDALONE -> COMPOSITE atomique avec snapshot absent ;
- synthèse tenant-scoped sur plusieurs Buildings/Units.

### 24.5 Web / catalogue

- libellés français et état non renseigné ;
- action absente sans affordance et sur COMPOSITE ;
- pending, succès, double clic, 400/401/403/404/409/réseau, retry ;
- refresh charge la valeur persistée ;
- Unit éditable depuis la composition ;
- compteurs COMPOSITE exacts ;
- wording public « Biens publiés » ;
- PUBLISHED reste public pour les quatre combinaisons ;
- DRAFT/WITHDRAWN restent absents même AVAILABLE ;
- aucune fuite d'occupancy dans DTO/OpenAPI/Web public.

### 24.6 Gates

- typechecks workspace/tests ;
- unit, integration HTTP, contract, Web ;
- PostgreSQL réel Docker/Testcontainers sans skip ;
- architecture check ;
- builds API/Web ;
- génération OpenAPI sans drift ;
- migration check Property explicitement câblé en CI ;
- `git diff --check`.

## 25. Explicit Out-of-Scope

TASK-064 ne doit pas inclure :

- locataires/occupants identifiés ;
- lease management, bail, contrat, signature ;
- réservation, booking, calendrier ou plages ;
- `availableFrom`, date de départ ou période d'occupation ;
- historique complet, event/outbox ou audit multi-version ;
- courte durée par nuit, check-in/check-out ou synchronisation OTA ;
- paiement, facturation, dépôt de garantie ;
- CRM, leads, maintenance, états des lieux, notifications ;
- pricing dynamique ;
- filtre/badge availability public ;
- changement automatique de publication/retrait ;
- cascade availability de COMPOSITE vers Units ;
- nouveau bounded context, nouveau microservice ou ADR ;
- redesign, design system ou application mobile.

## 26. Migration Strategy

1. créer `0014_property_availability_occupancy.sql` ;
2. ajouter snapshot `meta/0014_snapshot.json` et journal ;
3. ajouter les cinq colonnes nullables sans default/backfill ;
4. ajouter un CHECK nommé et déterministe pour tuple/enum/rôle ;
5. ne modifier aucune migration 0000-0013 ;
6. ne modifier ni status/publication checks ni policy/index publics ;
7. ne donner aucun grant de colonne au public reader ;
8. vérifier que `monpiole_runtime` peut lire/mettre à jour dans le périmètre de
   son grant table existant ;
9. adapter `becomeComposite` et la transaction de création du premier Building
   afin de vider atomiquement le snapshot direct ;
10. prouver upgrade 0013 -> 0014 et bootstrap complet sous PostgreSQL réel ;
11. ajouter `service:property-management:migration:check` au workflow CI.

L'absence de backfill est intentionnelle : inférer VACANT, AVAILABLE ou toute
autre valeur depuis le lifecycle créerait de fausses données métier.

## 27. Acceptance Criteria

TASK-064 est DONE seulement si :

- availability et occupancy sont deux axes séparés ;
- aucun axe n'écrit le status de publication ;
- toutes les combinaisons lifecycle/availability/occupancy définies sont
  représentables ;
- les lignes historiques restent non renseignées sans inference ;
- STANDALONE et UNIT ont un état direct ; COMPOSITE a uniquement une synthèse ;
- `GET/PUT /availability` respectent le contrat de section 22 ;
- PUT identique est no-op et concurrence sérialisée ;
- grants, authority, cross-tenant 404 et RLS sont prouvés ;
- migration 0014, snapshot, journal et upgrade passent ;
- le Web privé permet réellement lecture et mise à jour en français ;
- Units sont gérables et COMPOSITE affiche ses compteurs ;
- le public reader ne reçoit aucun nouveau champ ;
- visibilité publique reste exactement PUBLISHED ;
- « Biens publiés » remplace le wording ambigu ;
- le migration check Property est exécuté par CI ;
- tous les gates de section 24.6 passent sans skip PostgreSQL ;
- aucun élément out-of-scope n'est introduit.

## 28. Entry Conditions / Blockers

| ID | Condition | État |
| --- | --- | --- |
| EC-01 | TASK-062 commitée et worktree propre | SATISFIED — `51b1e3b` |
| EC-02 | lifecycle retrait stable | SATISFIED |
| EC-03 | exclusion publique exacte PUBLISHED | SATISFIED |
| EC-04 | tenant/RLS/grant retrait prouvés | SATISFIED |
| EC-05 | migration 0013 reproductible | SATISFIED |
| EC-06 | modèle availability/occupancy séparé | SATISFIED par cette définition |
| EC-07 | sémantique des trois rôles fixée | SATISFIED par cette définition |
| EC-08 | API, grants, idempotence et concurrence fixés | SATISFIED par cette définition |
| EC-09 | stratégie de migration/backfill fixée | SATISFIED par cette définition |
| EC-10 | check migration Property en CI | À FERMER dans TASK-064 |
| EC-11 | wording public non ambigu | À FERMER dans TASK-064 |

Il n'existe aucun blocker nécessitant une TASK de recovery préalable. EC-10 et
EC-11 sont de petites obligations intégrées à la tranche recommandée.

## 29. GO / NO-GO Recommendation

### Développement TASK-064

**GO.** Le bounded context, le modèle Property, les transactions tenant, la
composition, les contrats et le Web permettent une tranche verticale sans
refactor structurel préalable.

### Exposition Internet production

**NO-GO inchangé.** TASK-064 ne doit pas être utilisée pour lever les gates
Internet de TASK-059. Withdrawal réduit le risque opérationnel, mais ne prouve
ni ingress, ni secrets, ni anti-abus, ni capacité, ni observabilité, ni HA.

## 30. Exact Recommended TASK-064 Title

> **TASK-064 — Property Availability & Occupancy Web Vertical Slice**

Cette tranche doit implémenter exactement le snapshot courant privé, les règles
STANDALONE/UNIT/COMPOSITE, les endpoints GET/PUT, la migration 0014, les grants,
l'UX française et la matrice de tests définis ici, sans calendrier, bail,
booking ni couplage avec le lifecycle de publication.
