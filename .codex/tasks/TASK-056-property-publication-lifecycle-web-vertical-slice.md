# TASK-056 — Property Publication Lifecycle Web Vertical Slice

- **Statut :** DONE
- **Date :** 2026-08-29
- **Baseline :** `8758f245369e8c0eb2d0c89ba945c12b0435e3e1`
- **Référence fonctionnelle :** TASK-055
- **Verdict :** tranche verticale privée livrée, CG-01 fermé, aucune diffusion publique créée

## Objectif

Livrer le premier cycle de publication d'une `Property`, du Domain à
l'interface Web privée. Un acteur disposant du grant interne
`PUBLISH_PROPERTY` peut faire passer une Property éligible de `DRAFT` à
`PUBLISHED` depuis sa fiche. La transition est persistée, tenant-scoped,
idempotente et sérialisée sous concurrence réelle.

## Périmètre livré

- cycle Domain `DRAFT → PUBLISHED` et `publishedAt` ;
- use case `PublishProperty` et résultat distinguant transition et replay ;
- grant interne `PUBLISH_PROPERTY` et rôle `TENANT_ADMINISTRATOR` ;
- repository PostgreSQL transactionnel, traces de première publication et
  no-op durable sur replay ;
- migration `0007_property_publication.sql`, snapshot et journal Drizzle ;
- route privée bodyless `PUT /v1/properties/{propertyId}/publication` ;
- union Zod/OpenAPI DRAFT/PUBLISHED et portfolio étendu ;
- Problem Details 409 avec causes sûres et stables ;
- composition runtime PostgreSQL/OIDC ;
- client Web authentifié, section Publication, confirmation et portfolio ;
- tests Domain/Application, HTTP, contrat, PostgreSQL, runtime et Web ;
- documentation Property Management, API et Web.

## Décisions reprises de TASK-055

La création reste toujours `DRAFT`. `PUBLISHED` est terminal dans cette tranche :
aucune dépublication, archive ou republication n'est ajoutée. `publishedAt` est
fourni par l'horloge injectée, fixé une seule fois et copié dans `updatedAt` lors
de la première publication. Les mutations existantes restent permises ensuite
et préservent statut et date de publication.

Les prédicats de préparation exigent les détails, les conditions commerciales
cohérentes et une photo AVAILABLE sélectionnée comme principale. La description,
un Owner, une somme de quotes-parts à 100 % et la composition ne sont pas des
prérequis. Les rôles `STANDALONE`, `COMPOSITE` et `UNIT` se publient
indépendamment, sans cascade. Un Building n'est jamais publiable.

La publication est une décision dans l'espace privé. Aucun catalogue, page,
URL, projection, événement `PropertyPublished`, Outbox ou broker n'est créé.

## Traitement de CG-01

CG-01 est fermé avant l'introduction de `0007` :

1. `schema.ts` représente désormais les CHECK existants des cinq tables
   Property Management, l'activation RLS et les cinq policies tenant nommées ;
2. le snapshot `0007` contient ces contraintes, policies et
   `isRLSEnabled: true` pour chaque table ;
3. les migrations historiques `0000` à `0006` restent inchangées ; elles
   demeurent la source appliquée des objets déjà livrés ;
4. `0007` ne tente pas de recréer ces objets historiques : il contient seulement
   les trois colonnes de publication, le remplacement du CHECK de statut, le
   CHECK d'état de publication et le nouvel index ;
5. `FORCE ROW LEVEL SECURITY`, que le snapshot Drizzle ne sait pas représenter,
   reste explicite dans les migrations historiques ; le test PostgreSQL le
   vérifie dans `pg_class` pour les cinq tables ;
6. la preuve `0006 → 0007` insère un DRAFT historique, applique la tête et
   confirme données, colonnes nullable, CHECK, indexes, RLS enabled/forced et
   policies ; l'initialisation empty-to-head est aussi exercée.

Les contraintes métier existantes, clés étrangères et policies ne sont ni
supprimées ni réécrites. CG-02 reste volontairement inchangé : la publication
ne dépend d'aucune collection de Units.

## Implémentation par couche

### Domain et Application

`PropertyStatus` accepte `DRAFT | PUBLISHED`. Une Property DRAFT interdit
`publishedAt`; une Property PUBLISHED exige un instant valide et le couple
détails/conditions commerciales. `Property.publish()` retourne la même instance
sur replay avant toute lecture d'horloge. Une DRAFT incomplète lève
`PropertyPublicationRequirementsNotMetError` avec la liste fermée
`DETAILS | COMMERCIAL_TERMS`.

`PublishProperty` autorise d'abord le grant et le tenant unique, puis utilise
`updateAtomically`. Son résultat porte `PUBLISHED` ou `ALREADY_PUBLISHED`. Une
absence ou une ressource cross-tenant reste `PROPERTY_NOT_FOUND`; un grant
absent reste `PROPERTY_FORBIDDEN`.

### PostgreSQL

Le repository charge la ligne sous `SELECT ... FOR UPDATE`. Si le callback
retourne la même instance, aucun `UPDATE` n'est exécuté. Lors de la première
transition seulement, il persiste statut, `published_at`, acteur et correlation
dédiés. Les colonnes génériques restent la trace de dernière mutation ; les
colonnes dédiées restent la preuve de première publication.

Deux appels concurrents sont donc sérialisés : le premier écrit, le second voit
`PUBLISHED` et réussit sans write. La concurrence avec une update de détails
préserve les deux résultats. Le chargement d'une Unit continue à valider son
unique relation Building avant toute mutation.

### API et autorisation

Le contrat exact est :

```text
PUT /v1/properties/{propertyId}/publication
Authorization: Bearer <token>
request body: absent
success initial: 200 PropertyResponse
replay:          200 PropertyResponse
errors:          400, 401, 403, 404, 409, 500 Problem Details
```

`PropertyResponse` et les items du portfolio sont des unions discriminées. La
variante DRAFT interdit `publishedAt`; la variante PUBLISHED l'exige. Le filtre
portfolio accepte les deux statuts.

Une DRAFT incomplète retourne exactement :

```json
{
  "type": "https://api.monpiole.example/problems/property-publication-requirements-not-met",
  "title": "Property publication requirements not met",
  "status": 409,
  "code": "PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET",
  "correlationId": "<uuid>",
  "errors": [
    { "path": "property.details", "code": "required_for_publication" },
    { "path": "property.commercialTerms", "code": "required_for_publication" },
    { "path": "property.primaryPhoto", "code": "required_for_publication" }
  ]
}
```

Le filtre construit ces causes depuis une liste fermée, sans données métier.
L'adaptateur Identity attribue `PUBLISH_PROPERTY` au rôle interne prévu ; aucun
scope ou claim OIDC ne devient un grant métier. Le runtime normal compose le use
case avec le repository PostgreSQL.

### Web privé en français

La fiche affiche une section « Publication » pour toute Property :

- DRAFT incomplète : explication et checklist des trois prérequis, bouton
  désactivé ;
- DRAFT prête : « Ce bien est prêt à être publié. » et action
  « Publier le bien » ;
- confirmation explicite avant le premier PUT ;
- verrou en mémoire et désactivation du fieldset pendant
  « Publication en cours… » ;
- succès : remplacement immédiat de la Property locale et annonce
  « Le bien est publié. » ;
- PUBLISHED : badge « Publié », date française, aucune action inverse et texte
  « La diffusion publique n'est pas incluse dans cette version. » ;
- erreurs métier, 401, 403 et réseau via les messages français existants.

Le client commun injecte le Bearer et envoie le PUT sans corps. Le portfolio
affiche « Brouillon » ou « Publié » et transmet les deux filtres. Aucune valeur
technique d'enum n'est présentée à l'utilisateur. Les contrôles restent
accessibles au clavier, les états utilisent les rôles live/alert existants et
la mise en page s'appuie sur les grilles responsives de l'application.

## Migration

Fichiers créés :

- `services/property-management/migrations/0007_property_publication.sql` ;
- `services/property-management/migrations/meta/0007_snapshot.json`.

Le journal ajoute l'entrée `0007_property_publication`. La migration :

1. ajoute `published_at timestamptz NULL` ;
2. ajoute `published_by_actor_id text NULL` ;
3. ajoute `publication_correlation_id uuid NULL` ;
4. remplace `properties_status_check` par `DRAFT | PUBLISHED` ;
5. ajoute `properties_publication_state_check` ;
6. ajoute `properties_tenant_status_created_property_idx` sur
   `(tenant_id, status, created_at DESC, property_id DESC)`.

Les DRAFT historiques restent valides avec trois traces nulles.

## Tests ajoutés ou adaptés

- Domain/Application : transition, instant, prérequis, grant, tenant, replay et
  absence de seconde lecture d'horloge ;
- PostgreSQL : empty-to-head, `0006 → 0007`, CG-01 complet, contraintes,
  publication, replay, traces, mutation ultérieure, isolation, deux publications
  concurrentes, concurrence publication/update et indépendance COMPOSITE/UNIT ;
- HTTP : 200 initial/replay bodyless, headers, 400/401/403/404/409/500 et réponse
  canonique ;
- OpenAPI/Zod : route, absence de `requestBody`, bearer, statuts, media types,
  headers, union et `publishedAt` conditionnel ;
- runtime : grant Identity/OIDC, écriture PostgreSQL et relecture après restart ;
- Web : préparation, prérequis, confirmation/annulation, double clic, succès,
  déjà publiée, date, 401/403/409/réseau, bearer bodyless et filtre français.

## Commandes exécutées et résultats exacts

- `corepack pnpm service:property-management:migration:check` : PASS,
  `Everything's fine` ;
- `corepack pnpm -r typecheck` : PASS, 9 workspaces applicatifs ;
- `corepack pnpm typecheck:tests` : PASS ;
- `corepack pnpm test:unit` : PASS final, 23 fichiers et 154/154 tests ;
- `corepack pnpm test:integration` : PASS final, 16 fichiers et 143/143 tests ;
- `corepack pnpm test:contract` : PASS, 13 fichiers et 76/76 tests ;
- `corepack pnpm service:property-management:test:integration` : PASS final,
  1 fichier et 42/42 tests PostgreSQL/Testcontainers ;
- test runtime API/PostgreSQL/OIDC ciblé : PASS, 9/9 tests ;
- test HTTP Property ciblé : PASS, 16/16 tests ;
- test Domain/Application Property ciblé : PASS, 15/15 tests ;
- test contrat Property ciblé : PASS, 9/9 tests ;
- `corepack pnpm --filter @monpiole/web test` : PASS, 13 fichiers et 88/88
  tests ;
- `corepack pnpm app:api:openapi` : PASS, build des 6 workspaces dépendants et
  régénération de `engineering/contracts/http/openapi.json` ;
- `corepack pnpm app:api:contracts:check` : PASS, 13 fichiers et 76/76 tests ;
- `corepack pnpm app:api:build` : PASS, 6 workspaces dépendants construits ;
- `corepack pnpm --filter @monpiole/web build` : PASS, 106 modules transformés ;
  warning Vite non bloquant pour le chunk JavaScript de 557,35 kB ;
- `corepack pnpm architecture:check` : PASS ;
- `corepack pnpm test` : PASS, 69 fichiers et 530/530 tests ;
- `git diff --check` : PASS.

Le dépôt ne définit pas de script lint ou format officiel. Aucun contrôle
artificiel ni nouvelle dépendance n'a été ajouté. Une première exécution
sandboxée du contrôle de migration a rencontré l'EPERM Windows connu, puis la
commande officielle relancée avec l'accès requis a passé. Trois premières
exécutions de tests ont révélé des assertions pré-TASK-056 qui classaient encore
`PUBLISHED` comme filtre invalide, ainsi qu'une assertion dépendante de l'ordre
PostgreSQL des CHECK ; les tests ont été alignés sur le nouveau contrat et
renforcés avec `ARCHIVED` et la lecture de la définition nommée. Toutes les
suites finales sont vertes.

## Fichiers principaux modifiés

- Domain/Application :
  `services/property-management/src/domain/property.ts`,
  `services/property-management/src/application/publish-property.ts`,
  `property-authority.ts`, `list-properties.ts` et exports ;
- persistance : `schema.ts`, `postgres-property-repository.ts`,
  `postgres-property-portfolio-query.ts`, migration/snapshot/journal ;
- API : schemas Property, mapper/DTO, `publish-property.controller.ts`, filtre
  Problem Details, autorité, AppModule et composition runtime ;
- contrat : `engineering/contracts/http/openapi.json` ;
- Web : modèle/client/erreurs, `PropertyPublicationSection.tsx`, fiche,
  portfolio, styles et tests ;
- preuves : tests Property unitaires, HTTP, OpenAPI, PostgreSQL, runtime et Web ;
- documentation : READMEs Property Management, API et Web, présent document.

## Gaps résiduels bornés

### Extension livrée — photo principale obligatoire

TASK-056 exige désormais une photo principale avant `DRAFT → PUBLISHED`.
L’extension ajoute la migration `0008_property_management_baseline.sql`, les
tables RLS `property_photos` et `property_primary_photo_audits`, la FK tenant /
Property, l’index unique partiel d’unicité, les triggers de suppression protégée
et d’audit append-only, les grants internes et les routes privées de galerie,
sélection atomique et suppression. La représentation complète d’une Property
expose `photos` et `primaryPhoto`.

Le domaine compte la sélection dans le minimum courant d’une photo disponible
et dans sa catégorie. Le Web affiche l’action « Définir comme photo principale »,
le badge « Photo principale » et le message bloquant exact. Le remplacement
après publication est autorisé et audité. Les tests PostgreSQL réels couvrent
absence/conformité, autre Property, concurrence, remplacement publié, audit,
suppression protégée, minimum/catégorie et RLS forcée. Les tests HTTP, contrat et
Web couvrent permissions, représentation et libellés.

- CG-02 reste le contained gap déjà documenté de liste Unit temporairement
  incomplète ; la publication ne lit pas cette collection et ne le corrige pas ;
- Drizzle ne représente pas `FORCE ROW LEVEL SECURITY` dans ses snapshots ; le
  SQL historique et les preuves `pg_class` restent l'autorité exécutable ;
- le warning Vite de chunk supérieur à 500 kB est préexistant et non bloquant ;
- distribution publique, transformation/optimisation d’image, CDN,
  événement/outbox, dépublication et archivage restent hors périmètre ; le
  catalogue public devra être une capacité distincte ;
- aucune readiness de production, smoke Auth0 réel, HA, backup/restore ou SLO
  n'est revendiqué par cette tâche.

## Product Requirement Amendment — Photos, Featured Photo, Capture Standards, Currency and CORS Recovery

Cet amendement complète la tranche existante sans rejouer TASK-056 et sans
modifier les migrations déjà appliquées `0007` et `0008`. La nouvelle migration
append-only `0009_property_management_baseline.sql` ajoute le sous-type
`STUDIO | MULTI_ROOM`, la preuve de contenu des photos et le standard photo du
tenant. Les lignes historiques basées uniquement sur une URL sont préservées,
mais ne comptent plus pour une nouvelle publication. Les publications déjà
effectuées sont conservées ; toute nouvelle transition `DRAFT → PUBLISHED`, y
compris en SQL direct, est marquée avec la version de standard courante et
revérifiée par un constraint trigger différé.

Le minimum MonPiole est d'une photo disponible et réellement persistée, sans
maximum fonctionnel. `APARTMENT + LONG_TERM_RENTAL` exige un sous-type et six
photos. Un Studio exige façade/entrée, pièce principale combinant vie et nuit,
cuisine/kitchenette et salle d'eau/salle de bain ; les deux vues restantes sont
libres, sans salon ni chambre séparés. Un Multi-room exige façade/entrée,
séjour/pièce principale, cuisine, chambre/espace nuit et salle d'eau/salle de
bain ; la sixième vue est libre. Le nombre et les catégories sont contrôlés
indépendamment : une photo supplémentaire ne compense jamais une vue absente.

Chaque organisation dispose d'un standard RLS qu'elle peut durcir par un
minimum supérieur et des catégories supplémentaires. La résolution utilise le
maximum entre le socle MonPiole et la valeur tenant, puis l'union des vues : une
organisation ne peut donc ni réduire le minimum ni supprimer une vue imposée.
Le standard est relu dans la même transaction que la Property et les photos au
moment de publier.

L'API privée persiste le contenu JPEG, PNG ou WebP canonique avec taille et
empreinte SHA-256, puis le restitue par une route binaire authentifiée. Une
photo URL/métadonnées seule n'est jamais disponible pour la readiness. La
galerie permet l'ajout du fichier, la catégorisation, « Définir comme photo
principale » et affiche le badge « Photo principale ». La sélection appartient
au même tenant et au même bien, compte à la fois dans le minimum et sa
catégorie, reste atomique et unique sous concurrence, et peut être remplacée
après publication avec audit. La suppression de la sélection courante reste
refusée tant qu'une remplaçante n'a pas été choisie. Son absence produit le
message exact « Sélectionnez la photo principale qui représentera ce bien dans
les annonces. »

La conversion monétaire utilise les décimales de la devise : facteur 1 pour
XOF et facteur 100 pour EUR/USD. Saisie, préremplissage et rendu partagent cette
règle ; `125000 XOF` est affiché `125 000 FCFA` et aucun libellé visible
« unité mineure » ne subsiste. La liste CORS conserve
`GET, POST, PUT, PATCH, DELETE, OPTIONS` et un test de preflight couvre `PUT`.

Le catalogue public, ses cartes et la première image publique restent hors de
TASK-056. Une capacité ultérieure pourra consommer `primaryPhoto`, déjà exposée
dans les représentations privées canoniques.

### Validation de l'amendement

- `corepack pnpm test:unit` : PASS, 23 fichiers et 157/157 tests ;
- `corepack pnpm service:property-management:test:integration` : PASS,
  2 fichiers et 55/55 tests PostgreSQL, incluant `0008 → 0009` ;
- `corepack pnpm test:integration` : PASS, 17 fichiers et 149/149 tests ;
- `corepack pnpm test:contract` : PASS, 13 fichiers et 79/79 tests ;
- `corepack pnpm --filter @monpiole/web test` : PASS, 14 fichiers et 97/97
  tests ;
- `corepack pnpm -r typecheck` et `corepack pnpm typecheck:tests` : PASS ;
- `corepack pnpm app:api:build` et
  `corepack pnpm --filter @monpiole/web build` : PASS ; le warning Vite de
  chunk à 567,30 kB reste non bloquant ;
- `corepack pnpm app:api:openapi` puis `corepack pnpm test:contract` : PASS ;
- `corepack pnpm service:property-management:migration:check` : PASS ;
- `corepack pnpm architecture:check` : PASS ;
- `corepack pnpm test` : PASS final, 72 fichiers et 564/564 tests ;
- `git diff --check` : PASS.

## Runtime Photo Permissions Recovery

La migration Drizzle append-only `0010_runtime_photo_permissions_recovery.sql`
répare les droits manquants après `0009` sans modifier `0007`, `0008`, `0009`
ni aucune donnée. Elle réaffirme `ENABLE` et `FORCE ROW LEVEL SECURITY` sur les
trois tables photo, conserve leurs policies tenant nommées et accorde l'usage du
schema au rôle applicatif réel `monpiole_runtime`.

Les privilèges de table suivent strictement les opérations des repositories :

- `property_photos` : `SELECT`, `INSERT`, `UPDATE`, `DELETE` pour lire la
  galerie et le contenu, téléverser, sélectionner/remplacer la principale et
  supprimer une photo non principale ;
- `property_photo_standards` : `SELECT`, `INSERT`, `UPDATE` pour lire et
  renforcer le standard de l'organisation, sans suppression ;
- `property_primary_photo_audits` : `SELECT`, `INSERT` uniquement. La table
  reste append-only et le runtime ne peut ni modifier ni supprimer un audit.

La migration révoque explicitement les privilèges de table non requis avant de
réaccorder cette matrice minimale ; aucun `GRANT ALL` ni privilège de
`TRUNCATE`, `REFERENCES` ou `TRIGGER` n'est utilisé. Le snapshot et le journal
Drizzle portent l'entrée `0010`.

Les preuves PostgreSQL créent `monpiole_runtime` avant d'exécuter réellement la
chaîne de migrations, puis vérifient les grants effectifs, le rôle de connexion,
la RLS forcée, les trois policies tenant et leurs expressions tenant. Elles
exercent avec ce rôle la lecture d'un bien et de ses photos, l'upload, la
sélection principale, la suppression autorisée, la lecture et le renforcement
du standard, l'insertion/lecture d'audit, le masquage et le refus d'écriture
inter-tenant, ainsi que les refus `UPDATE` et `DELETE` sur l'audit. Le test
d'intégration API PostgreSQL utilise également `monpiole_runtime` et couvre les
GET du bien avec photos et du standard, puis le parcours POST/PUT/DELETE photo.

Validation du recovery :

- `corepack pnpm service:property-management:migration:check` : PASS ;
- `corepack pnpm service:property-management:test:integration` : PASS,
  2 fichiers et 58/58 tests PostgreSQL ;
- test d'intégration API runtime ciblé : PASS, 10/10 tests ;
- `corepack pnpm test:integration` : PASS, 17 fichiers et 150/150 tests ;
- `corepack pnpm test:contract` : PASS, 13 fichiers et 79/79 tests ;
- `corepack pnpm test` : PASS, 72 fichiers et 568/568 tests ;
- `corepack pnpm -r typecheck` et `corepack pnpm typecheck:tests` : PASS ;
- `corepack pnpm app:api:build` et `corepack pnpm app:web:build` : PASS ; le
  warning Vite de chunk à 567,30 kB reste non bloquant ;
- `corepack pnpm architecture:check` : PASS ;
- `git diff --check` : PASS.

## Résultat

La tranche TASK-056 est fonctionnelle et vérifiée de bout en bout. La décision
de publication est durable, privée, tenant-scoped et observable par ses traces
de première transition. La tâche ne stage, ne commit et ne pousse aucun fichier.
