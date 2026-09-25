# TASK-062 — Property Catalog Withdrawal Web Vertical Slice

- **Status :** DONE
- **Date :** 2026-09-01
- **Branche :** `main`
- **HEAD de départ :** `3e374b8 docs(property): define catalog withdrawal`
- **Source normative :** TASK-061
- **Prédécesseur d'implémentation :** TASK-060
- **Commit / push :** aucun

## Objective

Livrer une tranche verticale production-grade permettant à une autorité tenant
autorisée de retirer une Property publiée du catalogue public sans suppression,
avec persistance PostgreSQL, RLS, contrat HTTP/OpenAPI, UX Web privée et preuves
automatisées sur toutes les surfaces publiques concernées.

## Source / predecessor

TASK-061 prévaut sur le prompt générique. Le modèle retenu est
`DRAFT -> PUBLISHED -> WITHDRAWN`, avec retrait idempotent, conservation de la
première publication, republication refusée et visibilité publique définie
positivement par `status = 'PUBLISHED'`.

TASK-062 a repris une implémentation locale inachevée déjà présente au
pré-flight. Les 40 fichiers modifiés et trois fichiers non suivis initiaux ont
été audités avant correction. Aucun changement initial clairement hors scope
n'a été identifié ; ils appartenaient tous à la tranche de retrait.

## Scope

- extension du lifecycle Property avec `WITHDRAWN` ;
- transition de domaine `Property.withdraw(withdrawnAt)` ;
- refus explicite de republication ;
- use case `WithdrawPropertyFromCatalog` et grant dédié ;
- migration append-only `0013` et schéma Drizzle ;
- trace immuable du premier retrait ;
- endpoint privé DELETE bodyless avec réponse canonique 200 ;
- extension des DTO privés, du portfolio et des filtres ;
- affordance `canWithdrawFromCatalog` sans exposition des grants ;
- action Web française avec confirmation, attente, succès et erreurs ;
- disparition de la liste, du détail et de la photo publics à l'origine ;
- tests domaine, application, HTTP, OpenAPI, Web et PostgreSQL réel.

## Out of scope

- republication et cycles multiples ;
- suppression, archivage ou cascade parent/Units ;
- raison et historique complet de retrait ;
- événements, outbox, notifications ou planification ;
- purge CDN/cache distribuée ;
- availability, occupancy, pricing avancé, leads, analytics ou SEO ;
- exposition publique de géolocalisation ;
- carte, géocodage, recherche spatiale et refonte UI globale.

## Architecture

La capability respecte les frontières existantes :

```text
Web / NestJS HTTP
        |
        v
WithdrawPropertyFromCatalog
        |
        v
Property.withdraw
        ^
        |
PostgresPropertyRepository + transaction tenant-scoped + row lock
```

Le domaine ne dépend ni de NestJS, ni de Drizzle/PostgreSQL, ni de React. Le use
case dépend du port `PropertyRepository`. L'adapter PostgreSQL réutilise
`updateAtomically`, `withTenantPostgresTransaction` et `SELECT ... FOR UPDATE`.
Aucune architecture parallèle, dépendance ou infrastructure événementielle n'a
été ajoutée.

## Domain decisions

- `DRAFT -> withdraw` produit `PROPERTY_NOT_PUBLISHED` ;
- `PUBLISHED -> withdraw` produit `WITHDRAWN` ;
- `WITHDRAWN -> withdraw` retourne la même Property sans lecture d'horloge ni
  écriture ;
- `WITHDRAWN -> publish` produit
  `PROPERTY_REPUBLICATION_NOT_SUPPORTED` avant les prérequis photo ;
- `publishedAt` et toutes les données privées sont conservés ;
- le premier retrait fixe `withdrawnAt` et `updatedAt` ;
- les rôles `STANDALONE`, `COMPOSITE` et `UNIT` se retirent indépendamment ;
- aucune suppression, remise en brouillon ou cascade n'est effectuée.

## Final lifecycle

```text
DRAFT --publish--> PUBLISHED --withdraw--> WITHDRAWN
  |                    |                      |
  +--withdraw: 409     +--publish: no-op      +--withdraw: no-op 200
                                              +--publish: 409
```

## API contract

```http
DELETE /v1/properties/{propertyId}/publication
Authorization: Bearer <token>
X-Correlation-Id: <uuid>

# aucun request body
```

Succès : `200 OK` avec `PropertyResponse` canonique `WITHDRAWN`, contenant
`publishedAt`, `withdrawnAt` et `canWithdrawFromCatalog: false`.

Erreurs :

- path invalide : 400 ;
- authentification absente : 401 ;
- grant ou tenant authority invalide : 403 ;
- ressource absente ou cross-tenant : 404 non révélateur ;
- DRAFT : 409 `PROPERTY_NOT_PUBLISHED` ;
- republication : 409 `PROPERTY_REPUBLICATION_NOT_SUPPORTED` ;
- panne inattendue : 500 sûr sans fuite.

OpenAPI publie `operationId: withdrawPropertyFromCatalog`, bearer security,
path UUID `type: string, format: uuid`, aucun `requestBody`, les réponses 200,
400, 401, 403, 404, 409 et 500, ainsi que les headers de réponse corrélation et
request. Le PUT de publication documente aussi la republication refusée.

## Authorization

Grant unique :

```text
WITHDRAW_PROPERTY_FROM_CATALOG
```

Il est ajouté à `PropertyGrant`, filtré explicitement par l'adapter HTTP et
attribué au rôle `TENANT_ADMINISTRATOR`. Le use case appelle
`authorizedTenant` avant tout accès repository. Le tenant provient uniquement
de l'autorité authentifiée.

La réponse privée complète projette seulement
`canWithdrawFromCatalog: boolean`. Elle vaut vrai si et seulement si la
Property est `PUBLISHED`, l'autorité porte le grant et porte exactement le
tenant de la Property. Les grants et tenant IDs ne sont jamais exposés au Web.

## Persistence

La ligne Property porte désormais :

```text
status: DRAFT | PUBLISHED | WITHDRAWN
withdrawn_at timestamptz NULL
withdrawn_by_actor_id text NULL
withdrawal_correlation_id uuid NULL
```

Le premier retrait écrit statut, tuple de retrait et trace générique dans la
même transaction. Un replay retourne la ligne verrouillée sans UPDATE. Les
mutations privées suivantes préservent le tuple de premier retrait tout en
mettant à jour la trace générique de dernière mutation.

La contrainte SQL impose :

- DRAFT : tuples publication/retrait nuls ;
- PUBLISHED : tuple publication complet, tuple retrait nul, commercial terms ;
- WITHDRAWN : tuples publication/retrait complets, commercial terms et
  `withdrawn_at >= published_at`.

Le CHECK des audits photo accepte `WITHDRAWN`, ce qui permet le remplacement
privé de la photo principale après retrait tout en conservant son statut au
moment de l'audit.

## Migrations

Migration créée :

- `services/property-management/migrations/0013_property_catalog_withdrawal.sql` ;
- `services/property-management/migrations/meta/0013_snapshot.json` ;
- entrée `0013_property_catalog_withdrawal` dans `meta/_journal.json`.

Les migrations 0000 à 0012 restent inchangées. L'upgrade 0012 vers 0013 conserve
les lignes DRAFT/PUBLISHED sans backfill et leur ajoute des colonnes nulles. Le
reader public n'obtient aucun privilège sur les nouvelles colonnes. Le contrôle
Drizzle valide la chaîne.

## RLS / multi-tenancy

Aucune nouvelle table ni policy n'est nécessaire. `properties` conserve sa RLS
activée et forcée et la policy tenant existante fondée sur
`current_setting('app.tenant_id', ...)`. La policy restrictive du reader public
reste exactement `status = 'PUBLISHED'`.

Les preuves PostgreSQL couvrent :

- retrait par le tenant propriétaire ;
- tenant B obtenant 404 par le use case ;
- SELECT et UPDATE SQL directs sans filtre tenant retournant zéro ligne sous le
  contexte de tenant B ;
- absence de droit du reader public sur `withdrawn_at` et les traces ;
- RLS/policies/index public inchangés ;
- conservation de la géolocalisation privée et des autres données.

## Concurrency and idempotence

Deux retraits concurrents sont sérialisés par le verrou Property : un résultat
`WITHDRAWN`, un résultat `ALREADY_WITHDRAWN`, une seule trace durable.

Une publication rejouée en concurrence avec un retrait finit toujours dans un
état valide `WITHDRAWN`. Selon l'ordre du verrou, le publish est un replay
`ALREADY_PUBLISHED` ou échoue par
`PROPERTY_REPUBLICATION_NOT_SUPPORTED`. Aucun état impossible ni double trace
n'est observé.

## Web UX

La section privée « Publication » :

- affiche Brouillon, Publié ou Retiré du catalogue ;
- montre « Retirer du catalogue » uniquement avec l'affordance serveur ;
- confirme que le bien ne sera plus visible publiquement mais restera dans le
  portefeuille ;
- neutralise le double clic et affiche « Retrait en cours… » ;
- remplace le modèle local par la réponse WITHDRAWN ;
- affiche la date de retrait et « Le bien a été retiré du catalogue. » ;
- garde le dialogue réessayable après 403, 404, 409 ou erreur réseau ;
- ne rend aucune suppression ni republication.

Le portfolio privé accepte le filtre `WITHDRAWN` et affiche le libellé français
« Retiré du catalogue ». Le client centralisé effectue le DELETE sans body ;
aucun `fetch` ad hoc n'a été ajouté au composant.

## Public catalog consequences

Invariant :

```text
publiclyVisible(property) <=> property.status === PUBLISHED
```

Après commit du retrait :

- les nouvelles listes et pages publiques omettent la Property ;
- le détail public répond 404 ;
- la photo principale répond 404, y compris avec `If-None-Match`, jamais 304 ;
- le portfolio et le détail privés restent disponibles ;
- les DTO/OpenAPI publics n'exposent ni statut privé, ni `withdrawnAt`, ni
  affordance, trace, adresse exacte ou géolocalisation.

La garantie est immédiate à l'origine. Les représentations déjà en cache
peuvent subsister jusqu'aux TTL existants : 60 secondes pour JSON et 300 secondes
pour la photo. TASK-062 n'ajoute pas de purge CDN.

## Tests added or extended

- domaine/application : transition, replay, DRAFT, republication, instants,
  trois rôles structurels, permission, zéro/multiple tenant, not-found et
  cross-tenant ;
- HTTP privé : succès, replay, bodyless, 400/401/403/404/409/500, affordance et
  réponse canonique ;
- HTTP public : PUBLISHED visible, puis liste vide, détail 404, photo 404 avec
  ETag après retrait et détail privé conservé ;
- PostgreSQL : upgrade 0012→0013, contraintes, trace immuable, RLS directe,
  géolocalisation conservée, retraits concurrents, publish/withdraw concurrent,
  portfolio et queries publiques ;
- runtime PostgreSQL API réel : publication, retrait, replay, tuple SQL,
  portfolio WITHDRAWN et public reader distinct ;
- OpenAPI/Zod : endpoint, absence de body, bearer, UUID complet, réponses,
  unions DRAFT/PUBLISHED/WITHDRAWN et frontière DTO publique ;
- Web : affordance, confirmation/annulation, double clic, pending, succès,
  403/404/409/réseau, retry, badge/date, portfolio et filtre WITHDRAWN.

## Validation commands and results

| Validation | Résultat |
| --- | --- |
| `corepack pnpm test:unit` | PASS — 26 fichiers, 194/194 |
| `corepack pnpm test:integration` | PASS — 19 fichiers, 175/175 |
| `corepack pnpm test:contract` | PASS — 15 fichiers, 88/88 |
| `corepack pnpm service:property-management:test:integration` | PASS — 4 fichiers, 75/75 PostgreSQL réel |
| `corepack pnpm app:web:test` | PASS — 16 fichiers, 123/123 |
| `corepack pnpm -r typecheck` | PASS — 9 workspaces |
| `corepack pnpm typecheck:tests` | PASS |
| `corepack pnpm architecture:check` | PASS |
| `corepack pnpm app:api:build` | PASS |
| `corepack pnpm app:web:build` | PASS — warning chunk préexistant/non bloquant |
| `corepack pnpm service:property-management:migration:check` | PASS — `Everything's fine` |
| `corepack pnpm app:api:openapi` | PASS — artefact régénéré |
| `corepack pnpm test` | PASS — 83 fichiers, 682/682 |
| `git diff --check` | PASS |

Les commandes Vitest, builds et architecture ont dû être exécutés hors du bac à
sable Windows après des `spawn EPERM`. Les relances autorisées ont réellement
exécuté les suites. Aucun test PostgreSQL n'est annoncé PASS sur un skip : les
quatre fichiers et 75 tests ont tourné avec Docker/Testcontainers.

## Deviations

- L'implémentation a été reprise depuis un working tree inachevé explicitement
  autorisé par le demandeur, puis corrigée en place sans reset, stash ou clean.
- La normalisation OpenAPI ajoute `type: string` à tous les schémas UUID qui ne
  portaient que `format: uuid`. Cette correction générique ferme le gap G-04 de
  TASK-061 et évite une exception spéciale à la nouvelle route.
- Le controller de publication existant porte aussi le DELETE symétrique afin
  de conserver la ressource HTTP et le pattern de composition existants.

## Residual gaps

- caches publics sans purge : fenêtre maximale documentée de 60/300 secondes ;
- exposition Internet toujours NO-GO selon TASK-059/TASK-061 ;
- warning de chunk Web supérieur à 500 kB, sans régression fonctionnelle ;
- republication, événements/outbox et historique multi-cycle restent
  explicitement hors scope.

Aucun gap fonctionnel, RLS, migration, contrat ou validation n'est ouvert.

## Final verdict

**DONE — les treize quality gates TASK-062 sont satisfaits.**

Le retrait est une transition métier persistée, autorisée côté serveur,
tenant-safe et idempotente. Le runtime et OpenAPI concordent, le Web privé
permet réellement le retrait, les données privées sont conservées et toutes les
lectures publiques à l'origine cessent d'exposer la Property. Les validations
PostgreSQL réelles, builds, typechecks, architecture et la suite globale sont
vertes.
