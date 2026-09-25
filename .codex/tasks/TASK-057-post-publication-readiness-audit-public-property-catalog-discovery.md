# TASK-057 — Post-Publication Readiness Audit & Public Property Catalog Discovery

- **Statut :** DONE — AUDIT ET DISCOVERY UNIQUEMENT
- **Date :** 2026-08-31
- **HEAD audité :** `b03501a0926fb7f1ccaa712c9ab8bb6888b1db1b`
- **Branche :** `main`
- **Référence fonctionnelle :** TASK-056
- **Verdict de readiness :** **READY WITH CONTAINED GAPS**
- **Décision pour TASK-058 :** **GO pour la tranche de développement**, sous les
  conditions de sécurité, de tenant resolution et de validation PostgreSQL
  définies ci-dessous ; **NO-GO pour une exposition Internet de production** à
  ce stade.

## 1. Executive Summary

**FAIT OBSERVÉ.** La tranche de publication privée de TASK-056 est bien présente
dans le Domain, l'Application, PostgreSQL, l'API, OpenAPI et le Web. Le chemin
normal implémente une transition unique `DRAFT → PUBLISHED`, tenant-scoped,
autorisée par `PUBLISH_PROPERTY`, sérialisée par verrou de ligne et rejouable
sans nouvelle écriture. Les exigences de détails, conditions commerciales,
sous-type d'appartement, minimum photographique, vues obligatoires et photo
principale content-backed sont alignées entre le Domain et les gardes SQL.

**FAIT OBSERVÉ.** Les tables Property Management ont la RLS activée et forcée.
Les migrations `0007` à `0010`, leurs snapshots et le journal Drizzle existent.
`0010` accorde au rôle privé `monpiole_runtime` les privilèges minimaux attendus
sur les trois tables photo. Les tests présents couvrent les upgrades, la RLS,
les accès inter-tenant, les replays, la concurrence, les normes photo, les
contrats HTTP et l'expérience Web.

**LIMITE DE PREUVE.** Les validations sans Testcontainers ont passé pendant cet
audit. Les tests PostgreSQL n'ont pas pu être rejoués : le client Docker est
installé mais le moteur Docker Desktop n'est pas démarré. Les 58 tests Property
Management PostgreSQL ont donc été ignorés après échec des hooks `beforeAll` ;
ce rapport ne transforme pas les résultats historiques `568/568` de TASK-056 en
résultat courant.

**DÉCISION RECOMMANDÉE.** Le premier catalogue ne doit être ni global ni
cross-tenant. Une requête anonyme reste limitée à un seul tenant résolu côté
serveur par une correspondance exacte et allowlistée `hôte public → tenantId`.
Cette correspondance est également le consentement opérationnel d'activation du
catalogue pour le tenant. Aucun `tenantId`, header de tenant ou paramètre de
tenant n'est accepté du navigateur.

**DÉCISION RECOMMANDÉE.** La première lecture publique reste dans le Bounded
Context Property Management via un port de query et un repository publics
dédiés, lisant directement les tables propriétaires. Elle utilise un pool et un
rôle PostgreSQL séparés, `monpiole_public_catalog_reader`, sans écriture et sans
`BYPASSRLS`. Des policies restrictives propres à ce rôle limitent les Properties
à `PUBLISHED` et les photos aux contenus principaux des Properties publiées.
Les DTO publics sont de nouvelles listes blanches ; les DTO privés existants ne
sont jamais réutilisés.

**DÉCISION RECOMMANDÉE.** L'UUID v4 `propertyId` existant devient, par décision
explicite, l'identité publique de la Property pour cette tranche. Il est stable,
immuable et peu prédictible. Aucun besoin produit observé ne justifie un slug ou
un second identifiant. L'UUID n'est toutefois jamais traité comme une mesure
d'autorisation : la RLS, le tenant résolu et le statut restent les contrôles.

## 2. Scope

Cette tâche :

- audite le dépôt après TASK-056 ;
- compare le rapport TASK-056 au code, aux migrations et aux tests présents ;
- évalue la readiness de la publication privée ;
- définit la première tranche de catalogue public et ses frontières de données ;
- propose TASK-058 sans l'implémenter.

Cette tâche ne :

- modifie aucun comportement applicatif ;
- n'ajoute ni endpoint, page Web, migration ou dépendance ;
- ne modifie aucun ADR ;
- ne stage, commit ou push aucun changement.

Le seul fichier créé est le présent rapport.

### 2.1 Légende de décision

| Label | Signification |
| --- | --- |
| **FAIT OBSERVÉ** | Preuve lisible dans le dépôt ou résultat réellement exécuté pendant TASK-057. |
| **DÉCISION ÉTABLIE** | Règle déjà normative dans une ADR ou TASK-055/TASK-056. |
| **RECOMMANDATION** | Choix proposé par TASK-057 pour TASK-058. |
| **HYPOTHÈSE** | Élément plausible mais non prouvé ; ne devient pas une exigence sans validation. |
| **QUESTION OUVERTE** | Décision produit ou opérationnelle pouvant être différée sans créer une fuite dans la tranche proposée. |

## 3. Sources of Evidence

### 3.1 Gouvernance et décisions

- `AGENTS.md` ;
- `.codex/PROJECT_CONTEXT.md`, `.codex/CURRENT_SPRINT.md`, `BACKLOG.md` ;
- ADR-0003, ADR-0004, ADR-0005, ADR-0006 et ADR-0007 ;
- décision TD-008 de persistance PostgreSQL ;
- TASK-055 et TASK-056 ;
- READMEs racine, Property Management, API et Web.

### 3.2 Domain et Application

- `services/property-management/src/domain/property.ts` ;
- `property-photo.ts`, `property-details.ts` et les modèles de composition ;
- `publish-property.ts`, `property-authority.ts` ;
- ports `property-repository.ts`, `property-photo-repository.ts`,
  `property-photo-standard-repository.ts` et `property-portfolio-query.ts`.

### 3.3 Persistance et sécurité PostgreSQL

- `postgres-property-repository.ts`, `postgres-property-photo-repository.ts`,
  `postgres-property-photo-standard-repository.ts` et
  `postgres-property-portfolio-query.ts` ;
- `schema.ts` ;
- migrations `0007_property_publication.sql` à
  `0010_runtime_photo_permissions_recovery.sql` ;
- snapshots `0007` à `0010` et `_journal.json` ;
- `packages/persistence/src/transaction.ts`.

### 3.4 API, OpenAPI et runtime

- contrôleur de publication, contrôleurs photo et portfolio ;
- schemas Zod Property, DTO et mappers ;
- `ProblemDetailsFilter` ;
- composition PostgreSQL/OIDC et adaptation d'autorité interne ;
- `engineering/contracts/http/openapi.json` ;
- configuration CORS.

### 3.5 Web

- routes et `AuthenticationBoundary` ;
- client HTTP authentifié ;
- `PropertyPublicationSection`, `PropertyPhotoGallery`, fiche et portfolio ;
- modèles et formatage monétaire français.

### 3.6 Tests

- unitaires Domain/Application Property ;
- HTTP Property, photos, portfolio, runtime OIDC/PostgreSQL et CORS ;
- contrats OpenAPI Property ;
- intégration PostgreSQL Property et photos ;
- tests Web publication, galerie, portfolio et modèles.

## 4. Current Repository State

| Élément | Résultat | Classification |
| --- | --- | --- |
| Branche | `main` | **FAIT OBSERVÉ** |
| HEAD | `b03501a0926fb7f1ccaa712c9ab8bb6888b1db1b` — `fix(property): grant runtime access to photo tables` | **FAIT OBSERVÉ** |
| Historique directement pertinent | `8758f24` définition publication, `54f05b7` standards photo, `b03501a` permissions runtime photo | **FAIT OBSERVÉ** |
| Worktree initial | propre, aucun fichier staged, modifié ou non suivi | **FAIT OBSERVÉ** |
| Upstream | `main...origin/main [ahead 40]` | **FAIT OBSERVÉ** |
| TASK-056 | `DONE`, rapport présent | **FAIT OBSERVÉ** |

`.codex/PROJECT_CONTEXT.md`, `.codex/CURRENT_SPRINT.md` et plusieurs passages du
README racine décrivent encore une fondation sans runtime ni métier. Ils sont
historiquement cohérents avec Sprint 0 mais contredisent l'état exécutable
actuel. Cette obsolescence est une dette documentaire, pas une source
d'autorité sur TASK-056. Elle n'est pas corrigée ici car le périmètre autorise
uniquement le rapport TASK-057.

La phrase finale de TASK-056 indiquant que la tâche ne commitait rien décrivait
son exécution au moment du rapport. L'état courant contient désormais deux
commits applicatifs ultérieurs et un worktree propre ; il n'y a donc pas de
changement TASK-056 non versionné à récupérer.

## 5. TASK-056 Verification

### 5.1 Lifecycle et idempotence

`Property.publish()` ne connaît que `DRAFT | PUBLISHED`. Il retourne la même
instance avant lecture de l'horloge si le statut est déjà `PUBLISHED`.
`PublishProperty` distingue `PUBLISHED` et `ALREADY_PUBLISHED`.

`PostgresPropertyRepository.updateAtomically()` :

1. ouvre une transaction tenant-scoped ;
2. charge la Property avec `SELECT ... FOR UPDATE` ;
3. recharge les photos content-backed et le standard du tenant ;
4. ne fait aucun `UPDATE` si le callback retourne la même instance ;
5. écrit les traces dédiées uniquement pour la première transition.

Les tests présents vérifient un replay sans nouvelle horloge ni écriture, deux
publications concurrentes donnant un seul gagnant, ainsi qu'une publication
concurrente avec une mise à jour de détails.

### 5.2 Autorisation et tenant

`authorizedTenant()` exige le grant exact et exactement un tenant. Le contrôleur
résout d'abord une autorité OIDC interne puis filtre ses grants vers
`PropertyAuthority`. Le rôle interne `TENANT_ADMINISTRATOR` reçoit
`PUBLISH_PROPERTY`; aucun scope ou rôle OIDC ne devient un grant métier.

Le tenant ne vient ni du body, ni du path, ni d'une query Property. Le repository
applique simultanément un prédicat explicite `tenant_id` et la transaction
`SET LOCAL app.tenant_id`. Les absences et accès cross-tenant deviennent le même
`PROPERTY_NOT_FOUND`.

### 5.3 Building, Standalone, Composite et Unit

- une `Property` porte `STANDALONE | COMPOSITE | UNIT` ;
- un `Building` est une entité distincte et n'a aucun statut de publication ni
  endpoint de publication ;
- le repository générique refuse les Units orphelines ou ambiguës ;
- les tests PostgreSQL présents publient une `UNIT` puis une `COMPOSITE`
  indépendamment, sans cascade ;
- aucune relation Building ou Unit n'est modifiée par la publication.

La protection contre la « publication d'un Building » est donc structurelle :
le use case accepte un `propertyId`, jamais un `buildingId`.

### 5.4 Readiness métier et photo

Pour une nouvelle transition, le Domain exige :

- détails présents ;
- conditions commerciales cohérentes avec le type de transaction ;
- sous-type `STUDIO | MULTI_ROOM` pour un appartement en location longue durée ;
- une photo `AVAILABLE`, content-backed et principale ;
- le minimum MonPiole ou tenant, le plus élevé ;
- toutes les catégories MonPiole et tenant, par union.

Le minimum général est 1. L'appartement en location longue durée exige 6
photos. Les catégories Studio et Multi-room sont distinctes. Une quantité
supplémentaire ne compense pas une catégorie absente.

La migration `0009` ajoute une garde SQL différée versionnée. Elle marque les
nouvelles publications avec `photo_standard_version = 1` et contrôle aussi les
écritures SQL directes. Les publications historiques de `0008`, basées sur une
URL sans contenu, restent `PUBLISHED` avec une version nulle ; elles ne
satisfont pas une nouvelle publication mais ne sont pas invalidées a posteriori.

### 5.5 API, OpenAPI et Web

Le contrôleur fournit un `PUT` bodyless authentifié et retourne 200 sur
transition et replay. Le mapper produit une union DRAFT/PUBLISHED stricte.
Les causes 409 sont construites depuis une liste fermée et ne contiennent aucune
donnée métier libre.

L'artefact OpenAPI expose l'opération `publishProperty`, Bearer, aucun
`requestBody`, les réponses et la représentation discriminée. Le test de
contrat compare aussi l'artefact commité au document généré.

Le Web protège actuellement toutes les routes applicatives sauf `/connexion`.
La section de publication couvre checklist, confirmation, double soumission,
succès, erreurs françaises et absence de dépublication. La galerie utilise les
routes binaires privées authentifiées ; elle n'est pas réutilisable telle quelle
par un visiteur anonyme.

### 5.6 Écarts trouvés par rapport au rapport

Le cœur des affirmations TASK-056 est confirmé. Les nuances suivantes doivent
rester visibles :

- les résultats PostgreSQL historiques ne sont pas reproduits pendant TASK-057
  à cause du moteur Docker arrêté ;
- les grants de `monpiole_runtime` sur les tables historiques principales sont
  ajoutés manuellement par les fixtures runtime, alors que `0010` ne gouverne
  que les trois tables photo ; aucune procédure versionnée complète de grants
  Property Management n'est visible pour un environnement neuf ;
- une modification du sous-type d'un appartement déjà publié peut être refusée
  par la garde SQL si les photos ne satisfont plus la norme, mais ce conflit
  n'est pas prévalidé par l'Application et peut donc remonter en 500 sûr ;
- une Property `PUBLISHED` historique peut ne pas disposer d'une photo principale
  content-backed consommable par un futur catalogue.

Ces écarts ne permettent pas de déclarer une readiness production, déjà exclue
par TASK-056. Ils ne démontrent ni contournement de la publication ni fuite
cross-tenant dans le chemin livré.

## 6. Readiness Audit Matrix

| Sujet | Preuve observée | État | Conséquence |
| --- | --- | --- | --- |
| `DRAFT → PUBLISHED` uniquement | Enum Domain + CHECK SQL | READY | Aucun état inverse implicite. |
| Idempotence | même instance, pas d'horloge ni d'UPDATE sur replay | READY | Replay stable et peu coûteux. |
| Concurrence | lock Property `FOR UPDATE` | READY | Une seule première transition. |
| Grant | `PUBLISH_PROPERTY` interne | READY | Autorisation avant accès repository. |
| Tenant unique | `authorizedTenant`, prédicat et RLS | READY | Cross-tenant masqué en not-found. |
| Building | aucune Property/route de publication Building | READY | Non publiable par construction. |
| Rôles structuraux | tests d'indépendance COMPOSITE/UNIT | READY | Pas de cascade ni graphe public implicite. |
| Détails/termes | Domain + CHECK PostgreSQL | READY | Cohérence transactionnelle. |
| Photo principale | Domain, index unique, triggers, garde différée | READY | Une principale content-backed pour nouvelle publication. |
| Standards photo | `max` + union, relecture transactionnelle | READY | Le tenant ne réduit pas MonPiole. |
| API/OpenAPI | Zod, controller, artefact, contrats | READY | Contrat privé précis. |
| Web | confirmation, états et erreurs testés | READY | Journey privée utilisable. |
| Upgrade `0006 → 0007` | test présent avec historique | READY, non rejoué ici | CG-01 couvert par la suite. |
| Upgrade `0008 → 0009` | test présent avec publication historique | READY, non rejoué ici | Stabilité des anciennes données explicitée. |
| `0010` grants photo | matrice de privilèges testée | READY, non rejoué ici | Moindre privilège photo documenté. |
| Grants runtime historiques | SQL ad hoc dans fixtures | CONTAINED GAP | Provisioning neuf non entièrement gouverné par migrations. |
| Mise à jour subtype publiée | garde SQL sans mapping métier dédié | CONTAINED GAP | Rollback sûr mais 500 possible. |
| Photo legacy publique | publication conservée, contenu absent | CONTAINED GAP | Le catalogue doit avoir un placeholder. |
| Tests PostgreSQL TASK-057 | Docker daemon indisponible | EVIDENCE GAP | Réexécution obligatoire avant acceptation de TASK-058. |
| Readiness production | aucune preuve HA, backup, SLO, Auth0 réel | DEFERRED | Aucun claim production. |

## 7. Security and Data Exposure Analysis

### 7.1 Liste blanche publique proposée

Deux DTO publics distincts sont nécessaires.

| Champ | Liste | Détail | Décision |
| --- | --- | --- | --- |
| `publicPropertyId` | oui | oui | Alias contractuel de l'actuel `propertyId`. |
| `title` | oui | oui | Contenu explicitement édité pour le bien. |
| `description` | non | oui | Public seulement après activation explicite du catalogue tenant. |
| `propertyType` | oui | oui | Classification utile. |
| `transactionType` | oui | oui | Nécessaire à la compréhension commerciale. |
| `apartmentSubtype` | si applicable | si applicable | Utile pour un appartement longue durée. |
| `structuralRole` | oui | oui | Permet de distinguer bien, ensemble et unité sans exposer le graphe. |
| `location.country` | oui | oui | Exposition générale. |
| `location.city` | oui | oui | Exposition générale. |
| `location.district` | oui | oui | Recommandé ; validation produit requise avant activation réelle. |
| `location.addressLine` | non | non | Adresse exacte privée dans cette tranche. |
| `details` | non | oui | Surface, pièces, chambres, salles d'eau, meublé. |
| `commercialTerms` | oui | oui | Variante, prix, devise, période, dépôt/charges applicables. |
| `primaryPhoto.url` | oui/null | oui/null | URL publique dérivée ; null pour historique sans contenu. |
| `primaryPhoto.contentType` | oui/null | oui/null | Nécessaire au rendu ; aucun ID ou hash dans le JSON. |
| `publishedAt` | oui | oui | Ordre et information publique de publication. |

### 7.2 Champs interdits

Ne sont jamais exposés :

- `tenantId` et identifiants de tenant internes ;
- `addressLine` ;
- `ownerId`, personnes propriétaires, contacts, ownerships et quotes-parts ;
- identité, membership, grants, rôles internes et données OIDC ;
- `actorId`, `authorityId`, correlation de mutation et traces de publication ;
- `publishedByActorId`, `publicationCorrelationId`, `photoStandardVersion` ;
- `createdAt`, `updatedAt` et timestamps techniques photo ;
- `photoId`, hash SHA-256, byte size et catégories photo dans le JSON public ;
- Buildings, codes Building, relations Unit et identifiants de parent ;
- standards photo du tenant et audits de sélection ;
- contenu base64 en JSON ;
- structures de persistance ou DTO privés complets.

### 7.3 Risques et protections attendues

| Risque | Protection exigée |
| --- | --- |
| DRAFT visible | policy RLS restrictive `status = 'PUBLISHED'`, prédicat SQL identique et test négatif réel. |
| Fuite autre tenant | résolution host allowlistée, `SET LOCAL app.tenant_id`, prédicat tenant et RLS forcée. |
| Fuite par DTO | schemas Zod publics `.strict()`, mappers par liste blanche et tests d'absence de chaque champ interdit. |
| Énumération | UUID v4, 404 identique pour absent/DRAFT/autre tenant, aucun signal owner/tenant. |
| Description contenant des données personnelles | activation tenant après revue de contenu ; rendu texte échappé ; future gouvernance éditoriale. |
| Photo privée | endpoint public dérivé ne lit que la principale content-backed d'une Property PUBLISHED. |
| Scraping | données minimales, pages bornées, limites de débit avant production et aucune PII owner. |
| Cache cross-tenant | clé comprenant l'hôte canonique, TTL borné, aucun cache partagé ignorant l'hôte. |
| SQL/recherche coûteuse | pas de recherche libre dans TASK-058, enums strictes, limite 1–50 et pagination keyset. |
| Host spoofing | égalité exacte avec l'allowlist ; aucun fallback ; forwarded host uniquement depuis proxy de confiance. |

## 8. Multi-Tenant and RLS Analysis

### 8.1 Modèle retenu

**RECOMMANDATION.** Le catalogue est tenant-scoped. Une requête traite un seul
tenant. Un catalogue global cross-tenant est explicitement interdit dans
TASK-058.

Le tenant est résolu par un port `PublicCatalogTenantResolver` à partir de
l'hôte canonique reçu par l'API. La configuration contient une map exacte
`host → tenantId`. Une absence de correspondance retourne 404 et n'ouvre pas de
transaction Property. La map n'est jamais envoyée au client.

Cette map constitue aussi l'opt-in de distribution : ajouter un hôte pour un
tenant autorise l'exposition de ses Properties `PUBLISHED` après revue. Aucun
tenant n'est exposé automatiquement lors du déploiement de TASK-058.

Le tenant résolu est ensuite un paramètre explicite des use cases et critères de
query. Cette approche n'est pas un tenant global caché : la frontière HTTP le
résout, l'Application le reçoit explicitement et PostgreSQL le porte via
`SET LOCAL` dans chaque transaction.

### 8.2 Rôle PostgreSQL public

Créer/provisionner un login dédié `monpiole_public_catalog_reader` :

- `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOBYPASSRLS` ;
- non propriétaire du schema, des tables, fonctions et policies ;
- `USAGE` sur `property_management` ;
- uniquement des `SELECT` au niveau colonnes sur `properties` et
  `property_photos` ;
- aucun droit sur owners, ownerships, buildings, relations, standards ou audits ;
- aucun `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` ou `TRIGGER` ;
- pool et URL de connexion séparés du pool privé `monpiole_runtime`.

La migration candidate `0011` doit ajouter :

- une policy `AS RESTRICTIVE FOR SELECT TO monpiole_public_catalog_reader`
  sur `properties`, exigeant `status = 'PUBLISHED'` ;
- une policy restrictive photo exigeant `AVAILABLE`, content-backed,
  `is_primary` et l'existence de la Property publiée du même tenant ;
- les grants de colonnes exacts ;
- un index partiel de catalogue :
  `(tenant_id, published_at DESC, property_id DESC) WHERE status = 'PUBLISHED'`.

Les policies tenant permissives existantes restent actives. Pour le rôle public,
la combinaison attendue est donc : policy tenant existante **ET** policy
restrictive publique. Le repository applique encore `tenant_id` et
`status = 'PUBLISHED'` explicitement ; la RLS est la défense finale, pas le seul
filtre.

### 8.3 Preuves obligatoires

- rôle réel courant et absence de capacités privilégiées ;
- matrice exacte de grants colonnes/tables ;
- RLS enabled et forced ;
- expressions des policies et rôle cible ;
- lecture tenant A ne voyant jamais tenant B ;
- DRAFT invisible même si le repository omet accidentellement son filtre dans
  un test de défense ;
- impossible de sélectionner owners, traces ou colonnes interdites ;
- impossible d'écrire ;
- pool privé et pool public réellement connectés avec des rôles différents ;
- `SET LOCAL app.tenant_id` remis à zéro lors du retour de connexion au pool.

## 9. Public Catalog Domain Discovery

### 9.1 Vocabulaire

| Terme | Définition proposée |
| --- | --- |
| **Property publiée** | Property ayant terminé la transition privée et durable vers `PUBLISHED`. |
| **Catalogue tenant** | Ensemble public des Properties `PUBLISHED` d'un unique tenant explicitement activé. |
| **Public Property summary** | Projection minimale d'une carte de catalogue. |
| **Public Property detail** | Projection détaillée par liste blanche, sans données owner/tenant/admin. |
| **Photo publique principale** | Contenu de la photo principale content-backed d'une Property `PUBLISHED`. |
| **Activation de catalogue** | Correspondance opérationnelle allowlistée entre un hôte public et un tenant. |

### 9.2 Comportement fonctionnel minimal

- lister les Properties `PUBLISHED` du tenant résolu ;
- ouvrir le détail d'une Property publiée ;
- paginer par curseur opaque ;
- filtrer par type de bien et type de transaction ;
- trier uniquement par `publishedAt DESC, propertyId DESC` ;
- afficher les conditions commerciales ;
- afficher la photo principale ou un placeholder pour un historique sans contenu ;
- retourner le même 404 pour absent, DRAFT, autre tenant ou contenu photo public absent ;
- inclure `STANDALONE`, `COMPOSITE` et `UNIT` si chacun est `PUBLISHED` ;
- ne jamais lister un Building ni exposer les relations de composition ;
- permettre navigation catalogue → détail → retour catalogue.

La recherche textuelle, les tris alternatifs et le filtre ville/quartier sont
différés. Les champs de localisation sont du texte libre non canonisé et le
`ILIKE` privé actuel inclut l'adresse exacte ; le réutiliser créerait un risque
de fuite et de requêtes coûteuses.

### 9.3 Identité publique

| Option | Analyse | Décision |
| --- | --- | --- |
| UUID `propertyId` existant | Stable, immuable, v4, aucune migration ; déjà la clé des URLs privées. | **RETENUE** sous l'alias contractuel `publicPropertyId`. |
| Nouvel UUID public | Découple les identités mais ajoute colonne, migration et mapping sans menace démontrée. | Rejeté pour TASK-058. |
| Slug de titre | SEO lisible, mais collisions, changement de titre, normalisation multilingue et redirects. | Différé ; SEO avancé hors scope. |
| UUID + slug | Robuste mais plus complexe et sans valeur requise dans la première tranche. | Différé. |

La prévisibilité faible de l'UUID réduit le balayage opportuniste mais ne porte
aucune autorisation. Les mêmes réponses 404 et la RLS restent obligatoires.

### 9.4 Composition publique

**DÉCISION ÉTABLIE.** TASK-056 publie une Property COMPOSITE et une Property UNIT
indépendamment. **RECOMMANDATION.** TASK-058 respecte cette décision : chaque
ligne PUBLISHED est une annonce autonome. `structuralRole` peut être affiché
avec un libellé français, mais aucun Building, code d'unité, parent ou lien de
composition n'est exposé. Une expérience « immeuble et ses unités » serait une
capability ultérieure avec ses propres règles de visibilité.

### 9.5 Données historiques

Une publication pré-`0009` peut ne pas avoir de photo content-backed. La cacher
introduirait un second état de visibilité non approuvé. TASK-058 doit donc :

- inclure toute Property `PUBLISHED` du tenant activé ;
- rendre `primaryPhoto` nullable dans les DTO publics ;
- afficher un placeholder accessible ;
- répondre 404 sur la route binaire si aucun contenu public n'est disponible ;
- documenter une éventuelle remédiation/backfill sans modifier l'historique.

## 10. Candidate API Contracts

Tous les schemas sont nouveaux, stricts et séparés de `PropertyResponse` privé.
Chaque opération déclare explicitement `security: []` dans OpenAPI.

### 10.1 `GET /v1/public/properties`

Query :

| Paramètre | Règle |
| --- | --- |
| `limit` | entier, défaut 20, minimum 1, maximum 50 |
| `cursor` | base64url canonique opaque, maximum 512 caractères |
| `type` | enum `APARTMENT | HOUSE | LAND | COMMERCIAL | OTHER` |
| `transactionType` | enum `LONG_TERM_RENTAL | SHORT_TERM_RENTAL | SALE` |

Ordre fixe : `publishedAt DESC`, puis `publicPropertyId DESC`. Le curseur encode
ces deux valeurs, est validé strictement et ne contient aucun tenant.

Réponse 200 candidate :

```json
{
  "items": [
    {
      "publicPropertyId": "<uuid-v4>",
      "title": "Maison des Lagunes",
      "propertyType": "HOUSE",
      "transactionType": "SALE",
      "structuralRole": "STANDALONE",
      "location": { "country": "CI", "city": "Abidjan", "district": "Cocody" },
      "commercialTerms": {
        "kind": "SALE",
        "currency": "XOF",
        "salePriceAmountMinor": 125000000
      },
      "primaryPhoto": {
        "url": "/v1/public/properties/<uuid-v4>/primary-photo",
        "contentType": "image/webp"
      },
      "publishedAt": "2026-08-31T10:00:00.000Z"
    }
  ],
  "pageInfo": { "nextCursor": null, "hasNextPage": false }
}
```

Réponses : 200, 400 paramètres/cursor, 404 hôte de catalogue inconnu, 429 si le
rate limiter approuvé est actif, 500 sûr. Aucun 401 ou 403.

### 10.2 `GET /v1/public/properties/{publicPropertyId}`

Retourne la projection de liste plus `description` et `details`. Réponses :
200, 400 UUID invalide, 404 indifférencié pour absent/DRAFT/autre tenant, 429 et
500 sûr.

La réponse ne contient ni `status` ni `tenantId`. Le fait de recevoir 200 prouve
déjà que la projection est publiée dans le catalogue tenant résolu.

### 10.3 `GET /v1/public/properties/{publicPropertyId}/primary-photo`

Route binaire nécessaire car le `contentPath` actuel est privé et authentifié.

- 200 avec le type canonique JPEG, PNG ou WebP ;
- `Content-Length`, `ETag` dérivé de l'empreinte du contenu et
  `X-Content-Type-Options: nosniff` ;
- 304 sur revalidation ;
- 400 UUID invalide ;
- 404 identique pour absent, DRAFT, autre tenant, photo non principale ou
  historique sans contenu ;
- aucun `photoId` dans l'URL publique.

### 10.4 Cache et erreurs

- liste et détail : `Cache-Control: public, max-age=60` ;
- photo : `Cache-Control: public, max-age=300`, revalidation par ETag ;
- Problem Details et 429 : `Cache-Control: no-store` ;
- la clé de cache doit inclure l'hôte canonique, le path et la query ;
- `X-Correlation-Id` et `X-Request-Id` restent exposés ;
- aucune erreur ne contient tenant, SQL, rôle, path interne ou cause libre.

Ces TTL courts tiennent compte des mutations autorisées après publication et du
remplacement de photo principale. Un CDN et des URLs immuables versionnées
restent ajoutables plus tard sans modifier les DTO : `primaryPhoto.url` est une
abstraction, pas un chemin de stockage.

## 11. Candidate Web Experience

### 11.1 Routes

- `/catalogue` : catalogue public ;
- `/catalogue/:publicPropertyId` : détail public.

Ces routes sont placées hors de `AuthenticationBoundary`. Elles n'appellent ni
`getAccessToken`, ni `login`, ni la route de session, et ne redirigent jamais
vers `/connexion`. Les routes privées actuelles restent sous le shell protégé.

### 11.2 Catalogue

Chaque carte affiche :

- photo principale ou placeholder ;
- titre ;
- type et projet commercial en français ;
- ville et quartier ;
- prix/devise avec la règle XOF/EUR/USD existante ;
- rôle structurel avec libellé français ;
- lien « Consulter le bien ».

Le formulaire expose seulement « Type de bien » et « Projet ». Les filtres
vivent dans l'URL. Le bouton « Afficher plus de biens » conserve la pagination
keyset et déduplique par `publicPropertyId`.

### 11.3 États et accessibilité

- chargement avec `role=status` ;
- état vide explicite sans CTA de création privée ;
- erreur sûre avec nouvelle tentative ;
- 404 détail « Bien introuvable » sans expliquer s'il est privé ;
- images avec texte alternatif dérivé du titre, placeholder décoratif ou
  explicite selon contexte ;
- titres hiérarchisés, liens accessibles au clavier et focus visible ;
- filtres correctement labellisés ;
- grille responsive réutilisant les primitives visuelles existantes ;
- aucune valeur enum technique visible.

### 11.4 Coexistence OIDC

`App` peut conserver le provider Auth0 au niveau racine si son initialisation
n'entraîne ni redirect ni blocage des routes publiques. Un test doit prouver que
`/catalogue` rend son chargement et appelle l'API publique avec une session
`loading`, `unauthenticated` ou en erreur. Si le SDK bloque encore le rendu, le
provider doit être descendu dans la branche privée des routes.

## 12. Architecture Options and Decision

| Option | Avantages | Risques/coût | Décision TASK-057 |
| --- | --- | --- | --- |
| Lecture directe des tables via query port public dédié | Plus petite tranche, données cohérentes immédiatement, aucune synchronisation | Exige whitelist stricte, rôle et policies publics dédiés | **RETENUE** |
| Vue/projection SQL publique | Colonnes centralisées dans la DB, requêtes simples | Sémantique de sécurité invoker/owner délicate avec RLS, duplication de contrat, migration supplémentaire | Non retenue pour la première tranche |
| Projection alimentée par événement/outbox | Découplage et optimisation futurs | Aucun `PropertyPublished` ni outbox ; projection fiable impossible sans nouvelle capability | Différée |
| Nouveau service/bounded context Catalog | Ownership et scaling indépendants | Microservice prématuré, données dupliquées, cohérence et opérations distribuées | Rejeté maintenant |

### 12.1 Décision

TASK-058 ajoute dans Property Management :

- `ListPublicProperties`, `RetrievePublicProperty` et
  `RetrievePublicPrimaryPhoto` ;
- des ports de query publics et valeurs de projection dédiées ;
- des adapters PostgreSQL sur un pool reader séparé ;
- des contrôleurs et schemas HTTP publics dans `apps/api` ;
- des pages publiques dans `apps/web`.

Il ne réutilise ni `ListProperties`, ni `RetrieveProperty`, ni
`PropertyResponse`, ni le client authentifié. Il n'ajoute aucun événement,
outbox, broker ou nouveau service.

Le modèle direct reste évolutif : les contrats publics et ports Application
constituent la frontière stable. Une projection SQL, événementielle ou un
service catalogue pourra remplacer l'adapter sans modifier le contrat si un
besoin de charge, recherche ou découplage est démontré.

## 13. Blockers

### 13.1 Blockers de la publication privée

**Aucun blocker de confidentialité, de RLS ou de lifecycle n'a été observé dans
le chemin TASK-056 audité.** Le verdict n'est pas `READY` absolu à cause des
gaps bornés et de la preuve PostgreSQL non rejouée.

### 13.2 Hard gates de TASK-058

Les éléments suivants deviennent des blockers d'acceptation de TASK-058 s'ils
sont omis ; ils font partie de la tranche proposée et ne peuvent être reportés :

1. résolution exacte d'un tenant public unique sans entrée `tenantId` client ;
2. absence de catalogue global ;
3. rôle/pool PostgreSQL public séparé sans écriture ni bypass RLS ;
4. policies restrictives PUBLISHED et photo principale ;
5. DTO/mappers publics par liste blanche ;
6. 404 identique pour DRAFT, absent et autre tenant ;
7. tests PostgreSQL réels prouvant la matrice et les accès négatifs ;
8. routes Web hors OIDC ;
9. activation explicite d'un tenant/hôte après revue des Properties déjà
   publiées.

Si l'une de ces preuves échoue, TASK-058 reçoit un NO-GO et la route publique ne
doit pas être exposée.

## 14. Contained Gaps

| ID | Gap | Risque | Containment |
| --- | --- | --- | --- |
| CG-01 | Docker daemon arrêté pendant TASK-057 | Les 58 tests PostgreSQL ne sont pas une preuve fraîche. | Tests présents, résultats historiques documentés ; réexécution obligatoire avant acceptation TASK-058. |
| CG-02 | Grants runtime des tables historiques appliqués par fixtures, pas par une migration Property complète | Environnement neuf mal provisionné. | Aucune production revendiquée ; TASK-058 doit versionner/prover son rôle public indépendamment. Recovery privé recommandé séparément. |
| CG-03 | Changement de subtype publié non prévalidé | 500 sûr au lieu d'un 409 métier, bien que la DB rollbacke. | Pas de corruption ; corriger dans une future tranche d'édition publiée. |
| CG-04 | Publication historique sans contenu photo | Carte sans image possible. | `primaryPhoto: null`, placeholder, route photo 404. |
| CG-05 | Images base64 en DB, pas de maximum fonctionnel ni streaming/CDN | Mémoire, bande passante, scraping coûteux. | Une seule image par carte, pages ≤ 50, cache court ; production soumise à capacité et rate limit. |
| CG-06 | Prix zéro et devise seulement syntaxique | Annonce commercialement étrange mais valide selon le contrat établi. | Ne pas inventer une nouvelle règle dans le catalogue ; follow-up produit. |
| CG-07 | Pas de dépublication/archivage | Pas de retrait unitaire par statut. | Activation host explicite, modification des champs encore possible, kill switch tenant par retrait de la map ; lifecycle futur requis avant large rollout. |
| CG-08 | Documents racine de sprint/contexte obsolètes | Onboarding et gouvernance trompeurs. | Les ADR, code et rapports récents restent l'autorité ; correction documentaire séparée. |
| CG-09 | Bundle Web 567,30 kB | Performance initiale du catalogue. | Warning préexistant, build vert ; code splitting futur. |

## 15. Deferred Work

Restent hors TASK-058 :

- modification, publication ou administration depuis le catalogue ;
- espace propriétaire, contact, réservation, paiement ou disponibilité temps réel ;
- favoris, comparaison, avis et recommandation ;
- carte/géolocalisation avancée et adresse exacte ;
- recherche textuelle, moteur externe, ranking et tris multiples ;
- analytics produit avancées et SEO avancé ;
- slug et identifiant public distinct ;
- galerie publique complète ;
- CDN, transformation, optimisation et URLs immuables d'images ;
- dépublication, archivage et retrait unitaire ;
- événements Property, outbox, broker et projection asynchrone ;
- syndication externe ;
- catalogue cross-tenant global ;
- nouveau microservice Catalog ;
- readiness production, HA, backup/restore, SLO et test de charge réel.

## 16. Recommended Next Capability

**TASK-058 — Public Property Catalog API & Web Vertical Slice** est la prochaine
capability recommandée.

But utilisateur : un visiteur non authentifié ouvre le catalogue d'un tenant
MonPiole explicitement activé, parcourt ses Properties publiées et consulte une
fiche sans jamais entrer dans l'espace privé ni déclencher OIDC.

Le GO porte sur une tranche verticale testable en environnement contrôlé. Il ne
vaut pas autorisation de mise en production Internet.

## 17. TASK-058 Proposed Vertical Slice

### 17.1 Périmètre exact

- résolution host allowlistée vers un tenant ;
- query ports et repositories publics dédiés ;
- rôle/pool reader public et migration append-only `0011` ;
- liste, détail et route binaire principale ;
- schemas Zod/OpenAPI publics stricts ;
- `/catalogue` et `/catalogue/:publicPropertyId` hors auth ;
- filtres type/transaction, tri fixe et pagination keyset ;
- placeholder photo historique ;
- cache HTTP court, erreurs sûres, CORS explicite et headers minimaux ;
- documentation API, Property Management et Web ;
- tests de toutes les frontières.

### 17.2 Règles métier

1. Le tenant de catalogue est résolu côté serveur et doit être unique.
2. Seul `PUBLISHED` est public.
3. Une Property publiée de tout rôle structurel est une entrée autonome.
4. Un Building n'est jamais une entrée.
5. Aucune donnée owner, tenant, admin ou trace n'est publique.
6. L'adresse exacte est privée.
7. Une publication historique sans contenu reste listée avec placeholder.
8. Les mutations et l'authentification sont absentes de l'API publique.
9. `propertyId` est réutilisé comme `publicPropertyId` sans slug.
10. Aucun catalogue global ou agrégat cross-tenant n'est autorisé.

### 17.3 Migrations et opérations

`0011_public_property_catalog_read_boundary.sql` peut :

- ajouter l'index partiel du catalogue ;
- révoquer toute capacité non requise du rôle public ;
- accorder schema usage et SELECT par colonne ;
- ajouter les deux policies restrictives ;
- ne modifier aucune donnée, aucun statut et aucune migration historique.

Le login et son credential sont provisionnés hors migration par la frontière
Operations. Le test crée un rôle synthétique avant d'appliquer la chaîne, comme
les preuves runtime existantes. L'API exige une configuration de pool public
distincte et échoue au démarrage si elle est incohérente lorsque le catalogue
est activé.

## 18. Entry Conditions

TASK-058 peut commencer si :

1. le modèle tenant-scoped par host allowlisté est accepté ;
2. le catalogue global reste explicitement interdit ;
3. la liste blanche de la section 7 est approuvée, notamment description et
   quartier ;
4. le rôle public dédié peut être provisionné avant la migration ;
5. Docker/Testcontainers est disponible pour la validation finale ;
6. un tenant de test synthétique et un hôte local sont définis sans données
   réelles ;
7. l'activation de production reste vide par défaut ;
8. les Properties déjà publiées du premier tenant pilote sont revues avant son
   mapping d'hôte ;
9. aucun changement utilisateur non lié ne chevauche les fichiers ciblés.

Questions ouvertes non bloquantes pour le développement :

- le quartier doit-il être affiché pour tous les marchés ou configurable ?
- quel libellé français exact utiliser pour COMPOSITE dans le public ?
- quelle politique commerciale doit traiter les montants zéro ?
- quel rate limiter/ingress sera retenu avant Internet production ?

## 19. Acceptance Criteria

TASK-058 est acceptable seulement si :

1. `GET /v1/public/properties` fonctionne sans Bearer pour un hôte mappé ;
2. la liste ne retourne que le tenant résolu et `PUBLISHED` ;
3. `GET /v1/public/properties/{publicPropertyId}` applique les mêmes règles ;
4. absent, DRAFT et autre tenant ont le même 404 sûr ;
5. la route photo ne sert que la principale content-backed d'une Property
   publiée ;
6. le rôle public ne peut écrire ni lire une table/colonne interdite ;
7. la RLS est enabled/forced et ses policies sont prouvées par `pg_catalog` ;
8. le repository porte encore les prédicats tenant et PUBLISHED ;
9. aucun request DTO n'accepte `tenantId`, status ou champ d'autorité ;
10. aucun response DTO n'expose un champ interdit de la section 7 ;
11. les DTO publics ne réexportent pas `PropertyResponse` privé ;
12. pagination, limite et curseur sont bornés et déterministes ;
13. type et transaction sont les seuls filtres ;
14. les routes OpenAPI déclarent `security: []` et aucun 401/403 normal ;
15. les caches ne mélangent jamais deux hosts ;
16. la photo historique absente produit placeholder/404, pas 500 ;
17. `/catalogue` et son détail rendent sans session et sans redirection OIDC ;
18. chargement, vide, erreur, pagination et responsive sont testés ;
19. labels français, clavier, focus, alt et live regions sont vérifiés ;
20. upgrade `0010 → 0011`, empty-to-head, grants, RLS et index passent sur
    PostgreSQL réel ;
21. tests unitaires, HTTP, contrats, Web, typechecks, builds, migrations et
    architecture passent ;
22. aucune dépendance de production, outbox, broker ou service catalogue n'est
    ajouté sans nouvelle décision ;
23. l'allowlist de production reste vide tant que les contrôles opérationnels
    et la revue des données ne sont pas approuvés.

## 20. Validation Evidence

### 20.1 Commandes réussies pendant TASK-057

| Commande | Résultat exact |
| --- | --- |
| `corepack pnpm service:property-management:migration:check` | PASS — `Everything's fine` |
| `corepack pnpm -r typecheck` | PASS — 9 workspaces applicatifs |
| `corepack pnpm typecheck:tests` | PASS |
| `corepack pnpm test:unit` | PASS — 23 fichiers, 157/157 tests |
| `corepack pnpm test:contract` | PASS — 13 fichiers, 79/79 tests |
| `corepack pnpm --filter @monpiole/web test` | PASS — 14 fichiers, 97/97 tests |
| tests HTTP ciblés Property/publication/photos/portfolio/CORS | PASS — 4 fichiers, 41/41 tests |
| `corepack pnpm app:api:build` | PASS — 6 workspaces construits |
| `corepack pnpm app:web:build` | PASS — 107 modules ; warning non bloquant à 567,30 kB |
| `corepack pnpm architecture:check` | PASS — workspace, exports, resolver, graph, frontières, cycles et diagnostics |

Les premières exécutions parallèles migration/typecheck ont échoué avant le
contrôle avec l'`EPERM` Windows connu du lanceur pnpm. Les trois commandes ont
été relancées séquentiellement avec l'accès requis et ont passé. Aucun test ni
code n'a été modifié pour obtenir ces résultats.

### 20.2 Commandes limitées par l'environnement

| Commande | Résultat exact |
| --- | --- |
| `corepack pnpm test:integration` | FAIL environnement — 16 fichiers passés, 140 tests passés ; 1 fichier runtime PostgreSQL échoué au `beforeAll`, 10 tests ignorés |
| `corepack pnpm service:property-management:test:integration` | FAIL environnement — 2 suites échouées au `beforeAll`, 58/58 tests ignorés |
| `docker version` | client 29.7.2 présent ; échec de connexion au pipe `dockerDesktopLinuxEngine`, daemon non démarré |

L'erreur Testcontainers exacte est `Could not find a working container runtime
strategy`. Aucun test PostgreSQL n'a produit un échec d'assertion : ils n'ont
pas commencé. Le démarrage de Docker Desktop n'a pas été imposé par cette tâche.

`corepack pnpm test` n'a pas été exécuté après ce diagnostic car il aurait
rejoué les mêmes projets Testcontainers indisponibles. Le total historique
`568/568` reste une preuve enregistrée par TASK-056, pas une validation TASK-057.

### 20.3 Contrôles finaux du livrable

- contrôle whitespace du fichier non suivi avec
  `git diff --no-index --check -- NUL <rapport>` : PASS, aucune sortie ;
- stat du fichier non suivi : un seul fichier créé, sans autre diff ;
- recherche ciblée de motifs de credentials dans le rapport : PASS, aucune
  occurrence ;
- `git status --short --branch` : branche `main`, 40 commits devant
  `origin/main`, seul le rapport TASK-057 est non suivi ;
- revue de scope : aucun secret, migration, code, test, contrat, ADR ou autre
  documentation modifié.

## 21. Final Verdict

### 21.1 Readiness post-publication

**READY WITH CONTAINED GAPS.**

La publication privée est une fondation suffisamment robuste pour concevoir et
implémenter une lecture publique : statut durable, tenant explicite, RLS forcée,
autorisation interne, idempotence, concurrence et exigences photo sont
cohérents. Aucun blocker actuel ne démontre qu'une DRAFT ou une autre tenant
pourrait être publiée ou lue par les chemins privés livrés.

Le verdict n'est pas `READY` absolu à cause de la validation PostgreSQL non
rejouée, du provisioning incomplet des grants historiques, du cas subtype
publié mappé en 500, des photos legacy et de l'absence assumée de readiness
production.

### 21.2 Décision catalogue

- **Modèle :** lecture directe des tables Property Management par query port
  public dédié ;
- **Tenant :** un seul tenant résolu par host allowlisté ; aucun global ;
- **RLS :** rôle/pool public séparé, policies restrictives PUBLISHED/primary ;
- **Données :** DTO publics stricts par liste blanche ;
- **Identité :** UUID v4 Property existant, alias `publicPropertyId` ;
- **Web :** `/catalogue` et détail hors OIDC ;
- **Évolution :** ports stables permettant une projection ultérieure.

### 21.3 Prochaine capability

**TASK-058 — Public Property Catalog API & Web Vertical Slice : GO pour
implémentation contrôlée.**

Ce GO devient automatiquement **NO-GO** si la tranche tente un catalogue global,
réutilise les DTO/rôles privés, accepte un tenant client, omet les policies
restrictives ou ne peut pas prouver les cas négatifs sur PostgreSQL réel.

La mise en production Internet reste **NO-GO** tant que Docker/PostgreSQL n'ont
pas fourni une preuve fraîche, qu'un tenant n'a pas explicitement validé
l'activation et ses données déjà publiées, et que rate limiting, capacité image,
headers, exploitation et kill switch n'ont pas été acceptés.
