# TASK-055 — Property Publication Domain Discovery & Vertical Slice Definition

- Status: **DONE — READY WITH CONDITIONS FOR TASK-056**
- Date: 2026-08-29
- Type: discovery et définition de tranche ; aucune implémentation
- Bounded context propriétaire: `services/property-management`
- Décision de sortie: **TASK-056 — Property Publication Lifecycle Web Vertical Slice**

## 1. Objective

Définir, à partir de l'état réellement livré du dépôt, le langage métier et le
plus petit contrat vertical permettant à un administrateur de tenant de publier
une `Property`. Cette tâche ne crée ni statut, ni endpoint, ni migration, ni
bouton. Elle ferme les décisions structurantes nécessaires à TASK-056 et rend
explicites les choix nouveaux.

Le résultat recherché n'est pas un catalogue public. La première tranche
enregistre une décision de publication dans le cycle de vie de la `Property`,
l'expose dans les interfaces privées existantes et prépare une future frontière
de diffusion sans la fabriquer.

## 2. Decision labels

Les quatre labels suivants sont normatifs dans ce document:

- **CONFIRMED FROM REPOSITORY**: comportement ou contrainte déjà démontré par
  le code, une migration, un contrat ou un test actuel;
- **PROPOSED**: nouvelle décision approuvable pour TASK-056; elle ne décrit pas
  encore un comportement livré;
- **DEFERRED**: décision volontairement repoussée car elle n'est pas nécessaire
  à la première tranche;
- **REJECTED FOR FIRST SLICE**: option examinée et explicitement exclue du
  périmètre autorisé de TASK-056.

Une ligne **PROPOSED** devient normative pour TASK-056 lorsque ce document est
accepté. Aucune affirmation **PROPOSED** ne doit être présentée comme déjà
implémentée.

## 3. Context and dependencies

### 3.1 Baseline d'entrée

- **CONFIRMED FROM REPOSITORY** — TASK-053 a livré la recovery Composition et
  TASK-054 a conclu `READY WITH CONTAINED GAPS`; voir
  `.codex/tasks/TASK-053-property-composition-contract-migration-web-readiness-recovery.md`
  et
  `.codex/tasks/TASK-054-post-property-composition-recovery-readiness-audit-next-capability.md`.
- **CONFIRMED FROM REPOSITORY** — le commit courant au début de cette discovery
  est `18f9e13` (`docs(property): audit composition recovery readiness`) et le
  worktree était propre.
- **CONFIRMED FROM REPOSITORY** — `AGENTS.md` est l'unique fichier
  d'instructions applicable trouvé dans le dépôt.
- **CONFIRMED FROM REPOSITORY** — aucun fichier TASK-039 n'existe. Sa
  réservation ancienne ne constitue donc pas une preuve produit; TASK-050
  demandait déjà de ne pas la traiter comme telle.

### 3.2 Autorité architecturale

- `engineering/adr/0003-api-and-event-contracts.md`: contrats HTTP et événements
  explicites, versionnés, compatibles de manière additive par défaut.
- `engineering/adr/0004-multi-tenant-context.md`: tenant et corrélation
  explicites à toutes les frontières, autorisation avant effet, action
  privilégiée ou sensible auditable.
- `engineering/adr/0005-application-architecture-clean-architecture-ddd.md` et
  `engineering/adr/0006-application-architecture-bounded-contexts-services-boundaries.md`:
  règles métier dans Domain/Application; Property Management possède ses
  données et adapters.
- `engineering/adr/0007-managed-oidc-authentication.md`: l'OIDC établit
  `(issuer, subject)`; les grants et tenants internes restent l'autorité.
- `engineering/decisions/td-006-api-contract-representation-proposal.md`: Zod
  exécutable, Problem Details RFC 9457, OpenAPI 3.1, mappers explicites et
  validation des frontières.
- `engineering/decisions/td-007-eventing-messaging-technology-proposal.md`:
  événement d'intégration séparé du Domain, contrat consommateur approuvé et
  Outbox transactionnelle seulement lorsqu'une émission fiable est requise.
- `engineering/decisions/td-008-persistence-database-technology-proposal.md`:
  PostgreSQL/Drizzle, transactions tenant-scoped, RLS forcée, SQL de migration
  revu, empty-to-head et previous-to-head, locks et contraintes testés.
- `engineering/decisions/td-013-web-frontend-foundation.md`, `td-014` et
  `td-015`: SPA React/Vite, client HTTP central, Auth0 adapté à une `Session`,
  tokens en cache `sessionStorage` géré par le SDK et autorisation métier
  exclusivement serveur.

### 3.3 Dépendances produit

La tranche dépend des capacités déjà présentes: création/récupération
(TASK-034), détails et conditions commerciales (TASK-035), gestion des
propriétaires (TASK-037), ownership (TASK-038), autorité OIDC durable
(TASK-040/041), portefeuille privé (TASK-042/044), mise à jour des informations
cœur (TASK-048) et composition (TASK-050 à TASK-054).

Elle ne dépend pas d'un catalogue, de média, de disponibilité, de réservation,
de facturation ou d'un workflow de modération: ces capacités n'existent pas
dans le dépôt et les documents de readiness antérieurs les déclarent absentes.

## 4. Evidence inspected

### 4.1 Historique de tâches

Les fichiers TASK-034, 035, 036, 037, 038, 040, 041, 042, 043, 044, 045,
046, 047, 048, 049, 050, 051, 052, 053 et 054 sous `.codex/tasks/` ont été
relus. Cette séquence couvre la totalité de l'évolution Property disponible
entre création, enrichissement, ownership, portfolio, Web et Composition.

### 4.2 Domain et Application

- `services/property-management/src/domain/property.ts`
- `services/property-management/src/domain/property-details.ts`
- `services/property-management/src/domain/property-owner.ts`
- `services/property-management/src/domain/property-ownership.ts`
- `services/property-management/src/domain/property-building.ts`
- `services/property-management/src/domain/property-building-unit.ts`
- `services/property-management/src/application/property-authority.ts`
- `services/property-management/src/application/property-repository.ts`
- `services/property-management/src/application/create-property.ts`
- `services/property-management/src/application/retrieve-property.ts`
- `services/property-management/src/application/list-properties.ts`
- `services/property-management/src/application/update-property-details.ts`
- `services/property-management/src/application/update-property-core-information.ts`
- `services/property-management/src/application/property-composition.ts`
- ports et use cases Owner/Ownership adjacents.

### 4.3 Persistence et runtime

- `services/property-management/src/infrastructure/persistence/postgres/schema.ts`
- repositories PostgreSQL Property, portfolio, ownership et composition;
- migrations `0000` à `0006` et snapshots/journal sous
  `services/property-management/migrations/`;
- `services/property-management/tests/postgres-property-repository.test.ts`;
- `apps/api/src/composition/create-postgres-runtime-composition.ts`;
- `apps/api/src/composition/identity-external-authority.adapter.ts`.

Il n'existe pas d'adapter InMemory de production. Les `MemoryRepository` de
`tests/unit/property-management.test.ts` et
`tests/integration/api-properties.test.ts` sont des doubles de test; le runtime
réel compose uniquement les repositories PostgreSQL. Le placeholder
`unavailable...` de `apps/api/src/app.module.ts` échoue explicitement et n'est
pas une persistance de secours.

### 4.4 HTTP, OpenAPI, événements et Web

- schemas et DTO Property sous `apps/api/src/contracts/v1/properties/`;
- controllers, mappers et filtre Problem Details sous
  `apps/api/src/http/properties/` et `apps/api/src/http/errors/`;
- artefact `engineering/contracts/http/openapi.json` et tests Contract Property;
- `packages/events/src/`, `packages/events/README.md` et contrats d'événements
  existants;
- `apps/web/src/features/properties/`, client HTTP central et tests Web;
- tests unitaires, intégration HTTP, contrats OpenAPI, PostgreSQL et Web listés
  dans `tests/`, `services/property-management/tests/` et `apps/web/src/`.

## 5. Current-state findings

### 5.1 Signification actuelle de DRAFT

- **CONFIRMED FROM REPOSITORY** — `PropertyStatus` vaut uniquement `"DRAFT"`.
  `Property.createStandalone`, `Property.createUnit`, `Property.rehydrate`, les
  schemas Zod, le filtre portfolio et `properties_status_check` refusent toute
  autre valeur.
- **CONFIRMED FROM REPOSITORY** — `DRAFT` est server-controlled: le client ne
  peut fournir ni `status`, ni `propertyId`, ni `tenantId` à la création.
- **CONFIRMED FROM REPOSITORY** — toutes les routes Property sont privées,
  authentifiées et tenant-scoped. `DRAFT` signifie donc actuellement « Property
  privée dans le seul état de cycle accepté », pas nécessairement « incomplète ».
  Une DRAFT peut déjà avoir détails, termes, owners, Buildings et Units.
- **CONFIRMED FROM REPOSITORY** — aucune méthode `publish`, aucun use case,
  grant, colonne `published_at`, route, contrat, libellé Web ou événement
  `PropertyPublished` n'existe. Le test unitaire traite même `PUBLISHED` comme
  corruption persistée et les filtres HTTP le refusent.

### 5.2 Invariants influençant la publication

- **CONFIRMED FROM REPOSITORY** — titre et localisation sont obligatoires et
  normalisés; description facultative; `propertyType` et `transactionType`
  immuables sur les commandes livrées.
- **CONFIRMED FROM REPOSITORY** — détails et conditions commerciales sont soit
  absents ensemble, soit présents ensemble. Les détails doivent être non vides;
  surface positive si fournie; compteurs entiers non négatifs;
  `bedrooms <= rooms` lorsque les deux existent.
- **CONFIRMED FROM REPOSITORY** — les termes doivent correspondre au
  `transactionType`: loyer mensuel, tarif nuit/semaine ou prix de vente. Les
  montants zéro sont autorisés et la devise n'est vérifiée que par la syntaxe
  `[A-Z]{3}`; le README emploie « ISO 4217 » mais le code ne consulte aucun
  registre.
- **CONFIRMED FROM REPOSITORY** — aucune ownership n'est obligatoire. Une
  relation vaut de `0.01` à `100.00`, le total ne peut dépasser 100, et un total
  inférieur à 100 est volontairement valide.
- **CONFIRMED FROM REPOSITORY** — rôles structurels: `STANDALONE`, `COMPOSITE`,
  `UNIT`. Un premier Building fait passer une racine STANDALONE à COMPOSITE;
  aucune transition inverse n'existe. Un Building est une entité structurelle,
  pas une Property. Une Unit est une Property complète, reliée exactement à un
  Building sur les chemins supportés, avec ses propres informations, détails,
  termes et ownerships.
- **CONFIRMED FROM REPOSITORY** — ni héritage, ni cascade, ni déplacement,
  détachement ou suppression n'est modélisé. Le repository générique valide la
  relation unique d'une Unit au chargement et sous verrou avant une update.
- **CONFIRMED FROM REPOSITORY** — `updateAtomically` utilise `SELECT ... FOR
  UPDATE`, mais son `UPDATE` actuel ne persiste pas `status`; TASK-056 devra
  explicitement ajouter cette colonne au set et gérer le no-op idempotent.

### 5.3 Frontières et lacunes réelles

- **CONFIRMED FROM REPOSITORY** — `ProblemDetails` accepte une liste sûre
  `errors[{path, code}]`; le filtre ne la peuple actuellement que pour les
  validations transport. Elle peut porter les prérequis de publication sans
  nouvelle forme d'erreur.
- **CONFIRMED FROM REPOSITORY** — le portfolio possède déjà un filtre status,
  mais seulement `DRAFT`; la réponse détaillée et les cards exposent le statut.
- **CONFIRMED FROM REPOSITORY** — Web affiche la fiche, les détails, ownerships
  et composition en français. Le client caste les succès sans parse runtime;
  ce follow-up transversal n'empêche pas une tranche privée testée.
- **CONFIRMED FROM REPOSITORY** — il n'existe aucune projection publique,
  audience anonyme, route publique, règle d'adresse publique, media ou
  disponibilité. `PUBLISHED` ne peut donc pas être présenté comme preuve qu'une
  page publique est effectivement distribuée.

## 6. Domain vocabulary

| Terme | Définition normative | Classement |
|---|---|---|
| **Brouillon / DRAFT** | Property privée, modifiable, non libérée pour une frontière de diffusion. Elle peut être complète ou incomplète. | **PROPOSED**, compatible avec l'état existant |
| **Éligibilité à la publication** | Prédicat métier déterministe évalué sur l'état courant de la Property avant la première transition. | **PROPOSED** |
| **Prérequis de publication** | Invariant déjà garanti ou donnée supplémentaire dont l'absence interdit la transition. | **PROPOSED** |
| **Publication initiale** | Décision explicite d'un acteur autorisé qui fait passer une Property éligible de DRAFT à PUBLISHED dans une transaction tenant-scoped. | **PROPOSED** |
| **Publié / PUBLISHED** | État terminal de la première tranche: le tenant a libéré cette Property pour une future frontière de diffusion. C'est une autorisation de diffusion, pas une mesure de reachabilité ni la preuve d'une page publique. | **PROPOSED** |
| **Refus de publication** | Échec métier 409 avec une cause stable et des chemins sûrs lorsque les prérequis ne sont pas remplis. | **PROPOSED** |
| **Distribution publique** | Projection, audience, URL ou indexation rendant effectivement une Property accessible hors du portfolio privé. | **DEFERRED** |
| **Dépublication / archivage / republication** | Transitions après PUBLISHED et éventuel retrait/rétablissement d'une diffusion. | **DEFERRED** |

La distinction entre publication et distribution est obligatoire. TASK-056
peut afficher « Publié » dans l'espace privé, mais ne doit pas promettre
« visible publiquement » ni produire de lien public.

## 7. Publication lifecycle

### 7.1 États et transitions

| État courant | Commande | Précondition | État résultant | Résultat |
|---|---|---|---|---|
| `DRAFT` | `PublishProperty` | Property trouvée dans le tenant et éligible | `PUBLISHED` avec `publishedAt` fixé | mutation unique, HTTP 200 |
| `DRAFT` | `PublishProperty` | prérequis absents | `DRAFT` inchangé | 409 déterministe |
| `PUBLISHED` | `PublishProperty` | aucune réévaluation nécessaire | même `PUBLISHED` | succès idempotent 200, aucun write |
| `PUBLISHED` | update cœur/détails/ownership/composition existante | grant existant et invariants actuels | `PUBLISHED` | modification autorisée, publication conservée |
| `PUBLISHED` | dépublier, archiver ou republier | non défini | interdit/absent | hors première tranche |

### 7.2 Décisions de cycle

- **PROPOSED** — ajouter `PUBLISHED` à `PropertyStatus` et une méthode Domain
  `publish(publishedAt)`; création et création Unit restent toujours `DRAFT`.
- **PROPOSED** — `publishedAt` est un instant UTC défini seulement lors de la
  première transition. `updatedAt` prend la même valeur lors de cette mutation.
- **PROPOSED** — `PUBLISHED` est terminal dans la première tranche. Aucun
  retour à `DRAFT`, état `ARCHIVED` ou seconde date de publication.
- **PROPOSED** — les commandes actuelles restent utilisables après publication
  et préservent `status` et `publishedAt`. Elles n'annulent jamais implicitement
  la publication.
- **PROPOSED** — publier une racine COMPOSITE ne publie pas ses Units; publier
  une Unit ne publie ni son Building ni sa racine. Chaque Property porte son
  propre état.
- **REJECTED FOR FIRST SLICE** — verrouiller toute modification après
  publication: aucune preuve produit ne justifie cette rupture et les invariants
  actuels empêchent déjà de retirer le couple détails/termes.
- **REJECTED FOR FIRST SLICE** — « publier » un Building: il n'a ni aggregate
  Property, ni statut, ni détails, ni termes, ni ownership.

## 8. Eligibility matrix

`PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET` est l'unique erreur métier
d'inéligibilité proposée. Les causes sûres complètent ses `errors`.

| Règle candidate | Décision | Justification et preuve | Couche responsable | Erreur attendue |
|---|---|---|---|---|
| Identifiant, tenant, titre, type, projet commercial, localisation et timestamps valides | **Obligatoire — CONFIRMED FROM REPOSITORY** | `Property.validate` les impose déjà; un état persistant invalide est une corruption, pas une saisie de publication | Domain au rehydrate; PostgreSQL pour syntaxe/NOT NULL applicable | 500 sûr si corruption, jamais un 409 de complétude |
| État courant DRAFT | **Obligatoire pour muter — PROPOSED** | seule transition autorisée; PUBLISHED est traité comme replay | Domain | aucun échec sur PUBLISHED: 200 no-op |
| Détails non vides et conditions commerciales présentes/cohérentes | **Obligatoire — PROPOSED** | le couple existe déjà, est atomique et porte la description exploitable et la proposition commerciale minimale; son absence est le seul trou de complétude actuellement représentable | Domain, défense SQL existante pour cohérence; Application traduit l'erreur | 409 + `property.details/required_for_publication` et `property.commercialTerms/required_for_publication` |
| Description textuelle | **Facultative — CONFIRMED FROM REPOSITORY** | facultative depuis la création; le titre et la localisation restent présents | aucun contrôle nouveau | aucun |
| Au moins un Owner | **Facultative — REJECTED FOR FIRST SLICE comme prérequis** | ownership est une relation interne distincte; aucune preuve produit/juridique ne la lie à la publication | aucune lecture ownership dans `PublishProperty` | aucun |
| Somme des quotes-parts égale à 100 % | **REJECTED FOR FIRST SLICE** | TASK-038 et le Domain autorisent explicitement un total partiel; inventer 100 % contredirait la baseline | aucune | aucun |
| Somme des quotes-parts `<= 100 %` | **CONFIRMED FROM REPOSITORY**, mais hors prédicat de publication | garantie au moment des assignments par lock et contrainte; la publication n'a pas à la recalculer | Ownership Domain/repository existants | erreurs ownership existantes uniquement |
| Property STANDALONE | **Publiable indépendamment — PROPOSED** | c'est une Property complète; aucun Building n'est nécessaire à son identité | Domain Property | erreur de détails/termes seulement |
| Property COMPOSITE | **Publiable indépendamment — PROPOSED** | la racine conserve ses propres informations/détails/termes; le premier Building établit déjà le rôle sur les chemins supportés | Domain Property, sans query de composition | erreur de détails/termes seulement |
| Building | **Non publiable — REJECTED FOR FIRST SLICE** | entité structurelle seulement, confirmée par TASK-050/053 et le code | absence de route/use case | non applicable |
| Property UNIT | **Publiable indépendamment — PROPOSED** | aggregate Property complet; le repository générique valide son unique relation avant update | Domain Property + repository | 500 sûr si relation persistée corrompue; sinon erreur de détails/termes |
| Parent publié avant Unit, ou toutes les Units publiées avant parent | **REJECTED FOR FIRST SLICE** | aucune cascade/héritage et aucune preuve métier; imposer cela couplerait des aggregates | aucune | aucun |
| Au moins un Building/une Unit pour publier | **REJECTED FOR FIRST SLICE** | aucune composition obligatoire par type; publication au niveau Property | aucune | aucun |
| Règles distinctes par `propertyType` ou `transactionType` | **REJECTED FOR FIRST SLICE** | les seules variantes prouvées sont déjà dans `CommercialTerms`; pas de matrice produit supplémentaire | validation existante seulement | erreurs existantes si termes incompatibles |
| Montant strictement positif et devise issue d'un registre réel | **DEFERRED**, non bloquant | le Domain autorise zéro et ne vérifie que trois lettres; durcir à la publication serait une nouvelle politique tarifaire sans preuve | future discovery Domain | aucun dans TASK-056 |
| Média/galerie | **DEFERRED**, non bloquant | aucun modèle, stockage, ACL, scan, quota ou contrat | future capability dédiée | aucun dans TASK-056 |
| Disponibilité/occupation | **DEFERRED**, non bloquant | aucune temporalité ou règle de conflit livrée | future capability dédiée | aucun dans TASK-056 |

## 9. Proposed invariants

1. **PROPOSED** — `status` appartient à `DRAFT | PUBLISHED`.
2. **PROPOSED** — une nouvelle Property, y compris Unit, est `DRAFT`, sans
   `publishedAt` ni trace de publication.
3. **PROPOSED** — `DRAFT` implique `publishedAt` absent; `PUBLISHED` implique
   `publishedAt` présent, valide et détails/termes présents.
4. **PROPOSED** — `publish()` vérifie le couple détails/termes, fixe une fois
   `status`, `publishedAt` et `updatedAt`, puis retourne une nouvelle instance.
5. **PROPOSED** — `publish()` sur PUBLISHED retourne la même instance sans
   consommer un nouvel instant et sans réécrire la trace de première publication.
6. **PROPOSED** — les mutations existantes préservent le statut et la date de
   publication. Le modèle actuel ne fournit aucun chemin permettant de retirer
   détails/termes; l'éligibilité reste donc stable après publication.
7. **PROPOSED** — le rôle structurel ne change pas le prédicat. Un Building
   n'entre pas dans la fonction d'éligibilité; aucune collection de composition
   n'est chargée.
8. **PROPOSED** — aucune donnée Owner, ownership, tenant interne, actor ou
   correlation n'entre dans la réponse privée `PropertyResponse`.
9. **REJECTED FOR FIRST SLICE** — créer un aggregate `Publication`, une table
   de projection publique ou une machine d'états générique: un état et sa trace
   sur `Property` suffisent à la transition unique.

## 10. Authorization and tenant isolation

- **PROPOSED** — grant dédié exact: `PUBLISH_PROPERTY`.
- **PROPOSED** — `PublishProperty.execute` appelle
  `authorizedTenant(authority, "PUBLISH_PROPERTY")` avant clock, chargement ou
  effet. Une autorité sans grant ou avec zéro/plusieurs tenants reçoit
  `PROPERTY_FORBIDDEN`, traduit en 403 `FORBIDDEN`.
- **PROPOSED** — le grant est ajouté à `PropertyGrant`, au filtrage
  `toPropertyAuthority` et à la liste interne attribuée au rôle
  `TENANT_ADMINISTRATOR`. Aucun scope/claim Auth0 ne devient autorité.
- **PROPOSED** — aucun `tenantId` n'est accepté dans path, query, body ou header
  produit. Il provient exclusivement de l'identité interne résolue.
- **PROPOSED** — absence et accès cross-tenant sont indiscernables:
  `PROPERTY_NOT_FOUND`, HTTP 404. L'autorisation grant précède cette recherche.
- **CONFIRMED FROM REPOSITORY** — `properties` est déjà protégé par une policy
  tenant, `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, un rôle
  runtime non owner/non `BYPASSRLS` et une transaction avec `SET LOCAL`.
  TASK-056 ne crée pas une policy de publication distincte.

## 11. Concurrency and idempotency

### 11.1 Algorithme transactionnel proposé

1. autoriser `PUBLISH_PROPERTY` et dériver l'unique tenant;
2. ouvrir la transaction tenant-scoped existante;
3. charger la ligne `(tenantId, propertyId)` par `SELECT ... FOR UPDATE`;
4. rehydrate la Property et, pour une Unit, valider son unique relation;
5. appeler `publish(clock.now())` seulement si l'état courant est DRAFT;
6. en cas d'inéligibilité, rollback sans write;
7. persister état, timestamps et traces de première publication en un UPDATE;
8. retourner la représentation canonique.

### 11.2 Replays et courses

- **PROPOSED** — `PUT` est idempotent par sémantique; aucun
  `Idempotency-Key` n'est nécessaire pour cette mutation d'une ressource
  identifiée.
- **PROPOSED** — un second appel séquentiel retourne 200 avec les mêmes
  `status`, `publishedAt` et `updatedAt`. Il n'effectue aucun UPDATE et ne
  remplace ni `publishedByActorId` ni `publicationCorrelationId`.
- **PROPOSED** — deux appels concurrents sont sérialisés par le lock de ligne.
  Le premier effectue la transition, le second voit PUBLISHED et retourne le
  même état; deux réponses 200, exactement une mutation.
- **PROPOSED** — `updateAtomically` doit reconnaître le retour de la même
  instance et sauter l'UPDATE, ou un port équivalent doit garantir ce no-op.
  Les doubles InMemory doivent reproduire ce contrat, sans prétendre prouver le
  lock PostgreSQL.
- **PROPOSED** — une update détails concurrente est sérialisée sur la même
  ligne. Si elle commit avant la tentative, publish voit les détails; si publish
  évalue d'abord une DRAFT incomplète, il retourne 409 et le caller doit retry
  après l'update. Aucun check-then-act hors transaction n'est autorisé.

## 12. HTTP/OpenAPI contract proposal

### 12.1 Opération privée

- **PROPOSED** — méthode et path exacts:
  `PUT /v1/properties/{propertyId}/publication`.
- **PROPOSED** — operationId: `publishProperty`; tag: `Properties`; bearer
  obligatoire; `propertyId` validé par le schema UUID Property actuel.
- **PROPOSED** — aucun request body et aucun tenant contrôlé par le caller.
- **PROPOSED** — succès initial et replay: HTTP 200 `application/json`,
  `PropertyResponse`, avec `X-Correlation-Id` et `X-Request-Id`.
- **PROPOSED** — la forme minimale n'introduit pas de wrapper Publication:
  `PropertyResponse` reste canonique et gagne seulement `PUBLISHED` ainsi que
  `publishedAt` requis dans cette variante. La variante DRAFT interdit ce champ.
- **PROPOSED** — `PropertyPortfolioItem`, le filtre `status` et leurs schemas
  acceptent `DRAFT | PUBLISHED`; une card publiée porte `publishedAt`.
- **REJECTED FOR FIRST SLICE** — endpoint GET d'éligibilité séparé. Toutes les
  informations nécessaires au seul prérequis nouveau figurent déjà dans la
  réponse détaillée, et l'autorité finale reste le PUT/409 transactionnel.
- **REJECTED FOR FIRST SLICE** — endpoint ou page publique, URL partageable,
  projection anonyme et recherche publique.

### 12.2 Erreur d'éligibilité

Le contrat exact proposé est:

```json
{
  "type": "https://api.monpiole.example/problems/property-publication-requirements-not-met",
  "title": "Property publication requirements not met",
  "status": 409,
  "code": "PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET",
  "correlationId": "<uuid>",
  "errors": [
    { "path": "property.details", "code": "required_for_publication" },
    { "path": "property.commercialTerms", "code": "required_for_publication" }
  ]
}
```

La liste peut contenir les deux causes car l'invariant actuel les rend absentes
ensemble. Elle reste structurée pour que Web n'analyse jamais `title` ou un
message libre. Aucune valeur métier sensible n'est renvoyée dans `detail`.

### 12.3 Compatibilité

- **PROPOSED** — ajouter `PUBLISHED` à un enum de réponse et ajouter une
  variante à la réponse est une extension voulue; la compatibilité doit être
  vérifiée contre l'artefact OpenAPI committé conformément à ADR-0003/TD-006.
- **PROPOSED** — les schemas Zod de réponse utilisent une union discriminée par
  `status` afin de documenter `publishedAt` obligatoire seulement pour
  PUBLISHED. Les schemas ne deviennent jamais des modèles Domain.
- **PROPOSED** — l'artefact `engineering/contracts/http/openapi.json` est
  régénéré de façon déterministe dans TASK-056, jamais édité comme seule source.

## 13. Persistence and migration impact

### 13.1 Modèle proposé

La table `property_management.properties` reste l'unique stockage du cycle.
TASK-056 ajoute:

- `published_at timestamptz NULL`;
- `published_by_actor_id text NULL`;
- `publication_correlation_id uuid NULL`;
- `properties_tenant_status_created_property_idx` sur
  `(tenant_id, status, created_at DESC, property_id DESC)` pour le filtre
  portfolio devenu sélectif.

La migration suivante est nommée de façon continue
`0007_property_publication.sql`. Elle:

1. ajoute les trois colonnes nullable, sans backfill des DRAFT existantes;
2. remplace `properties_status_check` par `status IN ('DRAFT','PUBLISHED')`;
3. ajoute `properties_publication_state_check`: les trois traces sont toutes
   nulles pour DRAFT; elles sont toutes non nulles et `commercial_kind` est non
   null pour PUBLISHED. Le CHECK commercial existant garantit alors le couple
   détails/termes et sa variante cohérente;
4. ajoute l'index tenant/status;
5. préserve toutes les données, FK, CHECK métier et policies/RLS existants.

`publishedAt` appartient aux valeurs Domain et aux réponses privées.
`publishedByActorId` et `publicationCorrelationId` sont des traces persistantes
internes, jamais des champs Domain/publics. Les colonnes génériques `actor_id`
et `correlation_id` continuent de décrire la dernière mutation; les trois
champs dédiés empêchent une update ultérieure d'effacer la preuve de la première
publication.

### 13.2 Gate CG-01 obligatoire

- **CONFIRMED FROM REPOSITORY** — CG-01 de TASK-054: plusieurs CHECK, RLS et
  policies présents dans le SQL/live DB sont absents de `schema.ts` et du
  snapshot `0006`; ce gap ne bloque pas cette discovery mais bloque une nouvelle
  migration Property non gouvernée.
- **PROPOSED** — avant de générer ou finaliser `0007`, TASK-056 doit fermer le
  gate sur la table `properties`: représenter fidèlement les CHECK/RLS/policy
  avec les primitives Drizzle supportées; si une primitive ne peut pas exprimer
  le SQL exact, consigner l'exception raw-SQL autorisée par TD-008 et ajouter un
  contrôle `pg_catalog` sur les objets nommés. Un snapshot ne peut jamais être
  utilisé pour supprimer un objet live qu'il omet.
- **PROPOSED** — ce travail est limité aux objets `properties` affectés ou
  menacés par `0007`; TASK-056 n'est pas autorisée à refondre tous les schemas
  Property Management. C'est la fermeture explicite d'un blocker direct, pas
  une correction opportuniste générale.
- **PROPOSED** — empty-to-head et vrai `0006 -> 0007` avec donnée historique
  DRAFT sont obligatoires. Les assertions portent sur les valeurs, nouveaux
  checks/index, anciennes contraintes, RLS `enabled/forced`, policy tenant et
  rôle runtime.

### 13.3 Repository

- le mapper ligne/Domain prend en charge `PUBLISHED` et `publishedAt`;
- l'UPDATE atomique persiste `status`, `published_at`, les traces dédiées lors
  de la première transition et préserve ces dernières ensuite;
- un no-op PUBLISHED ne produit aucun UPDATE;
- aucun nouveau repository Ownership/Composition n'est appelé;
- RLS existante reste la défense tenant en profondeur.

## 14. Eventing decision

- **CONFIRMED FROM REPOSITORY** — `packages/events` ne contient que des
  primitives de contrat; les événements produit existants concernent le cycle
  Tenant. Property Management n'a ni publisher, ni Outbox, ni consommateur de
  publication approuvé.
- **REJECTED FOR FIRST SLICE** — aucun Domain Event ou Integration Event
  `PropertyPublished`, aucune Outbox et aucun broker dans TASK-056. L'état
  transactionnel Property et ses traces suffisent au comportement livré.
- **DEFERRED** — si une future projection publique, recherche, notification ou
  autre consommateur a besoin du fait, une tâche séparée doit approuver
  producteur, consommateur, version, payload minimal, idempotence et Outbox dans
  la même transaction que l'état. Aucun événement ne sera reconstruit
  implicitement depuis les logs.

## 15. Web/UX slice en français

TASK-056 étend uniquement la fiche et le portfolio privés existants.

### 15.1 Fiche Property

- section intitulée **Publication** visible pour toute `Property`, y compris une
  Unit ouverte par sa propre fiche;
- DRAFT complète: badge **Brouillon**, texte « Ce bien est prêt à être publié. »
  et bouton **Publier le bien**;
- DRAFT incomplète: texte « Complétez les détails et les conditions
  commerciales avant de publier. », checklist des deux éléments et bouton
  désactivé; le serveur reste autoritaire si l'état change entre affichage et
  clic;
- pendant l'appel: fieldset/bouton désactivé, libellé **Publication en cours…**,
  statut live et `aria-busy` local;
- succès: Property locale remplacée par la réponse canonique, badge **Publié**,
  date formatée en français et message « Le bien est publié. »;
- PUBLISHED: aucun bouton de dépublication; texte honnête « La diffusion
  publique n'est pas incluse dans cette version. »;
- erreurs 401/403/404/409/500 ou réseau: `PropertyFeedback`/mapping Property en
  français, focus/annonce accessibles et retry sûr. Le 409 mappe les codes
  structurés, pas le titre anglais.

### 15.2 Portfolio

- libellés `Brouillon` et `Publié` sur les cards;
- filtre statut avec les deux options et query `/v1/properties?status=...`;
- `publishedAt` n'est pas nécessaire sur la card visuelle, mais reste validé
  par le modèle reçu lorsqu'un item est PUBLISHED.

### 15.3 Frontière Composition

- **PROPOSED** — la publication ne lit aucune liste Building/Unit et ne dépend
  pas de son exhaustivité. Une Unit se publie depuis `/properties/{unitId}`.
- **CONFIRMED FROM REPOSITORY** — CG-02 (création Unit avant chargement pouvant
  montrer une liste locale incomplète) reste tracé mais ne bloque pas ce journey.
- **REJECTED FOR FIRST SLICE** — bouton « publier tout », compteur de Units
  publiées, sélection de Buildings/Units et correction CG-02.

## 16. Error model

| Situation | Erreur interne / contractuelle | HTTP | Effet |
|---|---|---:|---|
| path UUID invalide ou contrat transport invalide | `INVALID_REQUEST` | 400 | aucun use case |
| bearer absent/invalide | `UNAUTHORIZED` | 401 | aucun use case |
| grant absent ou autorité tenant ambiguë | `PROPERTY_FORBIDDEN` -> `FORBIDDEN` | 403 | aucun accès repository |
| Property absente ou d'un autre tenant | `PROPERTY_NOT_FOUND` | 404 | non révélateur |
| détails/termes absents | `PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET` + causes sûres | 409 | rollback/no write |
| Property déjà PUBLISHED | aucun | 200 | replay no-op |
| corruption persistée, erreur SQL ou défaut inattendu | `INTERNAL_ERROR` | 500 | réponse sûre, pas de valeur sensible |

Les erreurs de transport existantes `INVALID_PROPERTY_DETAILS` et
`INCOMPATIBLE_COMMERCIAL_TERMS` restent attachées à l'update des détails; elles
ne remplacent pas le 409 de publication d'une DRAFT cohérente mais incomplète.

## 17. Test strategy

TASK-056 doit ajouter les preuves suivantes sans réduire les suites existantes.

### 17.1 Unitaires Domain/Application

- création toujours DRAFT sans `publishedAt`;
- rehydrate des deux variantes et refus des combinaisons status/trace invalides;
- DRAFT avec détails/termes -> PUBLISHED, instant unique et valeurs conservées;
- DRAFT sans couple -> erreur avec causes stables et état inchangé;
- STANDALONE, COMPOSITE et UNIT publiables indépendamment;
- aucun Owner, total partiel et aucune composition ne bloquent;
- second appel retourne la même instance et ne consulte pas le clock;
- grant/tenant invalides avant repository/clock;
- not-found/cross-tenant non révélateur;
- updates cœur/détails et opérations adjacentes préservent PUBLISHED/publishedAt;
- doubles Memory conformes au no-op, sans prétendre tester la concurrence SQL.

### 17.2 HTTP et contrats

- succès 200 initial et replay de `PUT .../publication`, body absent;
- réponses 400, 401, 403, 404, 409 et 500 sûres;
- `errors` exactes sur le 409, sans donnée métier;
- PropertyResponse union DRAFT/PUBLISHED et `publishedAt` conditionnel;
- portfolio/filter acceptent les deux statuts;
- OpenAPI: operationId, path param, bearer, media types, headers, réponses,
  aucun requestBody, composant Problem Details;
- génération normalisée identique à l'artefact committé et contrôle de
  compatibilité.

### 17.3 PostgreSQL et runtime

- migration empty-to-head et `0006 -> 0007` avec DRAFT historique préservée;
- CHECK de statut et cohérence des trois traces, index, anciennes contraintes,
  RLS enabled/forced et policy nommée;
- runtime role incapable de lire/écrire hors transaction ou mauvais tenant;
- publish persiste puis survit à un restart runtime;
- deux publications concurrentes: deux succès, une seule transition et traces
  de première publication inchangées;
- publication concurrente avec update détails sérialisée et résultat expliqué;
- mutation après publication conserve état et traces dédiées;
- autorité OIDC interne reçoit le grant et le propage jusqu'à PostgreSQL.

### 17.4 Web

- labels et filtre français DRAFT/PUBLISHED;
- checklist et bouton désactivé si détails/termes absents;
- payload bodyless, bearer via client central et URL encodée;
- chargement, succès, replay visuel, 401, 403, 404, 409 détaillé, 500/réseau;
- focus/roles live, disabled et responsive;
- fiche Unit publie la Unit seulement;
- aucune lecture de collection Composition et aucune promesse de page publique.

### 17.5 Gates attendus

Au minimum: typecheck service/API/Web, tests unitaires, intégration HTTP,
contracts/OpenAPI, PostgreSQL/migration, Web ciblé et build, architecture check,
puis suite globale. Les résultats historiques `36/36`, `78/78`, `138/138` et
`503/503` de TASK-054 sont une baseline, pas des résultats anticipés de
TASK-056.

## 18. Observability and audit considerations

- **PROPOSED** — chaque réponse conserve les headers request/correlation
  existants; la première mutation stocke `publishedAt`, actor et correlation
  dédiés, en plus de la trace de dernière update.
- **PROPOSED** — signaux stables recommandés:
  `property.publication.succeeded`, `property.publication.replayed`,
  `property.publication.rejected`, durée du repository et catégorie SQLSTATE.
  Aucun SDK/backend de télémétrie nouveau n'est sélectionné.
- **PROPOSED** — les signaux peuvent porter operation, propertyId, tenantId,
  actorId, correlationId/requestId et résultat selon la politique de logs;
  jamais titre, adresse, description, détails, prix, Owner, token ou SQL/binds.
- **PROPOSED** — un replay est observable au niveau requête mais n'écrase pas
  l'audit persistant de la première publication.
- **DEFERRED** — journal métier append-only, dashboard/SLO, alerte, rétention et
  export audit. La trace dédiée rend la première transition investigable sans
  prétendre fournir une plateforme d'audit complète.

## 19. In scope for TASK-056

Le périmètre exact autorisé est:

1. statut Domain `PUBLISHED`, `publishedAt`, éligibilité et transition one-way;
2. use case `PublishProperty`, grant `PUBLISH_PROPERTY`, erreurs et exports;
3. no-op idempotent et sérialisation PostgreSQL par lock;
4. modèle/mapper/repository PostgreSQL et migration `0007` avec traces et index;
5. fermeture ciblée du gate CG-01 sur `properties` avant migration;
6. composition runtime et autorité interne;
7. `PUT /v1/properties/{propertyId}/publication`, Zod/DTO/mapper/controller,
   Problem Details et OpenAPI committé;
8. extension des réponses et du filtre portfolio aux deux statuts;
9. action et état Publication sur la fiche, labels/filtre portfolio en français;
10. tests unitaires, HTTP, contrats, PostgreSQL/runtime, Web et gates globaux.

## 20. Out of scope

Sont **REJECTED FOR FIRST SLICE**:

- portail, page, API de lecture ou catalogue public;
- recherche publique, SEO, partage et analytics d'audience;
- projection publique et choix de précision d'adresse;
- média, galerie, stockage objet, scan et quotas;
- disponibilité, occupation et calendrier;
- validation/modération ou approbation à plusieurs acteurs;
- notification, facturation, abonnement/entitlement;
- réservation, contrat de location ou de vente;
- dépublication, archivage, republication ou historique complet;
- cascade racine/Building/Unit et publication groupée;
- obligation d'Owner ou de somme ownership à 100 %;
- règle de complétude par type de bien;
- événement `PropertyPublished`, Outbox, broker ou consommateur;
- refonte générale Property Management;
- correction CG-02 ou follow-ups Web/production non nécessaires au journey;
- refonte générale des omissions Drizzle hors `properties` et `0007`.

## 21. Deferred decisions

- audience et canal réels de distribution, URL et projection publique;
- adresse publique exacte, partielle ou masquée;
- prérequis media et disponibilité;
- stricte positivité des montants et validation réelle de devise;
- dépublication, raison/retrait, archivage, republication et historique;
- effets d'une future modification publiée sur cache/projection/consommateurs;
- événement d'intégration et Outbox lorsqu'un consommateur existe;
- droits plus fins que le rôle TENANT_ADMINISTRATOR;
- journal append-only et plateforme d'observabilité;
- validation runtime des succès côté Web et optimisation du bundle.

Ces décisions ne peuvent pas être introduites implicitement dans TASK-056.

## 22. Risks and contained gaps

| ID | Catégorie | Risque | Traitement |
|---|---|---|---|
| CG-01 | blocker conditionnel de migration | CHECK/RLS/policies live omis de déclarations/snapshot; une génération non gouvernée peut dériver | gate ciblé obligatoire décrit en 13.2 avant `0007`; échec => TASK-056 s'arrête |
| CG-02 | contained gap, non blocker | liste Unit Web temporairement incomplète après création avant chargement | publication indépendante et sans lecture de collection; ne pas corriger dans TASK-056 |
| R-01 | sémantique produit | « Publié » pourrait être confondu avec une page publique existante | texte Web explicite; distinguer release state et distribution; aucune promesse/lien public |
| R-02 | compatibilité | élargir l'enum status peut casser un consommateur exhaustif | diff OpenAPI, tests consumer/Web et variante discriminée |
| R-03 | concurrence | un replay pourrait réécrire timestamp/audit | même-instance/no-op repository + test PostgreSQL concurrent |
| R-04 | audit | les traces génériques sont écrasées par les updates suivantes | colonnes dédiées première publication; journal complet différé |
| R-05 | scope | ownership, composition, média ou événement gonflent la tranche | matrice normative et exclusions explicites |
| R-06 | production | smoke Auth0 réel, CSP, backup/restore, HA et SLO ne sont pas prouvés | reste hors verdict de tranche; requis avant GO production |

## 23. Acceptance criteria

TASK-056 sera acceptable seulement si:

1. DRAFT et PUBLISHED ont une sémantique, des traces et invariants testés;
2. le seul passage DRAFT -> PUBLISHED exige le couple détails/termes;
3. STANDALONE, COMPOSITE et UNIT se publient indépendamment; Building jamais;
4. Owner, 100 %, composition, média et disponibilité ne sont pas requis;
5. `PublishProperty` autorise avant effet, dérive un tenant unique et retourne
   un 404 non révélateur cross-tenant;
6. `PUT /v1/properties/{propertyId}/publication` est bodyless, 200 idempotent et
   documente 400/401/403/404/409/500;
7. le 409 expose seulement les causes structurées exactes;
8. deux appels concurrents produisent une transition et deux succès cohérents;
9. les updates existantes restent possibles et préservent la publication;
10. `0007` passe empty-to-head et previous-to-head, préserve RLS/contraintes et
    ferme le gate CG-01 ciblé;
11. aucun événement/outbox et aucune surface publique ne sont ajoutés;
12. la fiche et le portfolio sont français, accessibles, testés et honnêtes sur
    l'absence de diffusion publique;
13. CG-02 n'est ni utilisé comme preuve d'éligibilité ni corrigé opportunément;
14. architecture, typechecks, builds et suites pertinentes sont verts sans test
    masqué ou snapshot forcé.

## 24. Definition of Done

- Domain/Application, ports, adapters, composition et exports sont cohérents;
- migration, snapshot/journal et gate CG-01 sont revus et testés;
- RLS/cross-tenant, locks, replay et audit de première publication sont prouvés
  sur PostgreSQL réel;
- Zod runtime, controller, Problem Details, OpenAPI et artefact sont alignés;
- Web consomme seulement le client authentifié central et rend tous les états en
  français avec annonces accessibles;
- suites ciblées et globales exécutées avec résultats consignés réels;
- aucune capacité Out of scope, dépendance ou refactor opportuniste;
- documentation Property/API/Web mise à jour seulement pour le comportement
  effectivement livré;
- `git diff --check` et revue finale propres; commit/push uniquement si une
  instruction distincte les autorise.

## 25. Recommended next task

> **TASK-056 — Property Publication Lifecycle Web Vertical Slice**

C'est l'unique prochaine capability sélectionnée. Son résultat utilisateur est
un administrateur de tenant capable, depuis la fiche privée, de voir les
prérequis, publier une Property éligible une seule fois et retrouver son état
Publié dans la fiche et le portfolio.

### Readiness verdict

**READY WITH CONDITIONS / GO WITH CONDITIONS pour TASK-056.**

Il ne reste aucune discovery structurante sur la transition, l'éligibilité,
l'autorité, l'endpoint, les erreurs, la concurrence, les rôles structurels,
l'événement ou le journey Web. Les décisions **PROPOSED** de ce document sont
le contrat d'entrée de TASK-056.

Le seul blocker d'exécution potentiel est CG-01: avant toute migration `0007`,
la représentation ou le gate explicite des CHECK/RLS/policy de `properties`
doit être établi conformément à la section 13.2. Si cette preuve échoue,
TASK-056 doit s'arrêter avant migration; elle ne peut ni ignorer le drift ni
élargir silencieusement sa correction. CG-02 reste contenu et non bloquant car
la publication ne dépend d'aucune liste de Units.

Le périmètre autorisé de TASK-056 est exactement celui de la section 19. La
distribution publique, les transitions après PUBLISHED et tout événement sont
explicitement reportés à des capabilities ultérieures.
