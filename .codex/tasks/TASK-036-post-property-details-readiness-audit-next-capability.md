# TASK-036 — Audit de préparation post-Property Details et prochaine capability

## Statut

**READY WITH CONTAINED GAPS** — gaps métier contenus.

## 1. Conclusion exécutive

Le socle Property livré par TASK-034 et TASK-035 est techniquement cohérent,
tenant-safe et suffisamment fiable pour porter une prochaine tranche verticale
contrôlée. Les invariants actuellement revendiqués sont protégés dans le domaine,
les cas d'usage et PostgreSQL ; les contrats `/v1`, l'autorisation par opération,
la non-divulgation inter-tenant, les migrations et les tests applicables passent.

Il n'est toutefois **pas fonctionnellement complet pour la publication**. Le
repository ne contient aucun concept métier représentant le propriétaire
juridique ou économique d'un bien, aucune relation de propriété, et aucune
composition immeuble/résidence/unité. `tenantId` identifie l'organisation qui
utilise MonPiole et gère le bien ; il ne répond pas à « qui possède ce bien ? ».
L'identité authentifiée et ses grants désignent l'acteur autorisé ; ils ne sont
pas davantage le propriétaire.

La réponse aux questions de l'audit est donc :

- le modèle Property actuel est une fondation sûre pour poursuivre le bounded
  context, mais pas une représentation complète du portefeuille immobilier ;
- `DRAFT` suffit aux opérations existantes ; le prochain état ne serait justifié
  que par l'action métier explicite de publier un bien prêt à être exposé ;
- cette publication est **PREMATURE** tant qu'un propriétaire tenant-scoped ne
  peut pas être créé puis explicitement rattaché au bien ;
- la plus petite prochaine capability à valeur métier est **TASK-037 — Property
  Owner Management Vertical Slice**.

## 2. Périmètre et preuves examinées

L'audit a examiné TASK-034, TASK-035, le README du service, les ADR 0003 à 0007,
le domaine et les cas d'usage Property, les schémas Zod/OpenAPI, les contrôleurs
Nest, le filtre Problem Details, l'adaptateur PostgreSQL, les migrations `0000`
et `0001`, ainsi que les tests unitaires, HTTP, contrat et PostgreSQL. Une
recherche globale dans `apps/`, `services/`, `packages/`, `tests/`, `engineering/`
et `.codex/` a confirmé l'absence de modèle Owner/Ownership et de composition
Building/Residence/Unit ; les occurrences génériques de « ownership » concernent
la gouvernance technique ou le tenant.

## 3. Matrice de preuves

| Dimension | Preuve | Statut | Gap | Action requise |
|---|---|---|---|---|
| Identité et frontière de l'agrégat | `PropertyValues` porte `propertyId` UUID v4 et `tenantId` UUID v4 ; création et réhydratation passent par `Property`; le service possède sa table. | READY | Aucun pour le périmètre actuel. | Conserver Property comme agrégat de l'actif géré. |
| Invariants de création | Le domaine normalise/valide titre, description, type, transaction, adresse, dates et impose `DRAFT`; les valeurs serveur ont une erreur distincte. | READY | L'ordre `updatedAt >= createdAt` est implicite et non protégé. | Documenter puis protéger seulement si un workflow démontre ce besoin. |
| Détails physiques | Objet non vide ; surface finie et positive ; compteurs entiers non négatifs ; chambres ≤ pièces. Schémas HTTP, domaine et contraintes SQL sont alignés. | READY | Le modèle est volontairement minimal ; étage, référence d'unité et autres caractéristiques ne sont pas représentés. | Ne les ajouter qu'avec Composition/Building & Units ou un prérequis métier démontré. |
| Conditions commerciales | Union discriminée stricte `LONG_TERM_RENTAL`/`SHORT_TERM_RENTAL`/`SALE`; compatibilité avec `transactionType`; colonnes incompatibles forcées à `NULL`; remplacement atomique testé. | READY | La devise valide seulement la forme alphabétique majuscule sur 3 caractères, pas le registre ISO 4217. Les montants zéro sont autorisés sans preuve métier explicite. | Valider avec Product si zéro est légitime et si une liste ISO doit être imposée avant publication/transaction. |
| Représentation monétaire | Entiers sûrs JavaScript en unités mineures, maximum `Number.MAX_SAFE_INTEGER`; `bigint` PostgreSQL borné par contrainte. | READY | `bigint` est mappé en `number`, sûr uniquement grâce à la borne SQL et à la réhydratation domaine. | Maintenir cette borne ; réévaluer decimal/bigint uniquement si les besoins dépassent cette plage. |
| Cohérence details/terms | Le domaine et SQL interdisent qu'un seul des deux soit présent ; `defineDetails` valide les deux avant mutation. | READY | Aucun pour les flux supportés. | Réutiliser cet invariant comme prérequis candidat, à confirmer, d'une future publication. |
| Cycle de vie | Seul `DRAFT` est accepté dans le type, le domaine, le contrat et SQL. | READY pour l'existant | Existence, complétude, readiness commerciale et exposition marché ne sont pas des états distincts. | Ne pas ajouter d'état maintenant. `PUBLISHED` sera justifié uniquement par une action `publish` après Owner/Ownership et prérequis approuvés. |
| Création tenant-safe | Le tenant n'est pas fourni par le body ; `authorizedTenant` exige le grant et exactement un tenant ; le repository ouvre une transaction tenant-scoped. | READY | Aucun. | Reproduire ce modèle pour Owner. |
| Lecture tenant-safe | Requête par `(tenantId, propertyId)`, transaction tenant-scoped, RLS forcée ; absent et cross-tenant donnent la même erreur `PROPERTY_NOT_FOUND`. | READY | Aucun. | Conserver des 404 indistinguables pour Owner et Ownership. |
| Mise à jour tenant-safe | `UPDATE_PROPERTY_DETAILS`, verrou `FOR UPDATE`, update avec double prédicat tenant/property et RLS ; cross-tenant testé HTTP et PostgreSQL. | READY | Aucun. | Exiger la même défense en profondeur pour les futures mutations. |
| Autorisation | Grants métier `CREATE_PROPERTY`, `RETRIEVE_PROPERTY`, `UPDATE_PROPERTY_DETAILS`; l'application ne dépend pas de HTTP/OIDC. OIDC établit issuer/subject puis un resolver interne fournit grants et tenants. | READY | Aucun grant Owner n'existe, normalement. | TASK-037 : `CREATE_PROPERTY_OWNER` et `RETRIEVE_PROPERTY_OWNER` (nom final aligné sur la convention). Réserver update/assign aux slices qui les implémentent. |
| Persistance et migrations | `0000` crée schéma/table/contraintes/index/RLS ; `0001` ajoute les détails et l'union commerciale sans rendre les lignes historiques illisibles ; Drizzle check passe ; Testcontainers migre une base vide. | READY | Les contraintes de longueur `city`, `district`, `addressLine` et la non-vacuité après trim ne sont pas toutes doublées en SQL. | Gap de défense en profondeur contenu ; ajouter des contraintes lors d'une migration justifiée, sans bloquer Owner. |
| Concurrence | `updateAtomically` lit avec `SELECT ... FOR UPDATE`, transforme et persiste dans la même transaction ; rollback d'une mutation incompatible testé. | READY WITH GAP | Aucun test ne lance deux mises à jour réellement simultanées ; la dernière transaction sérialisée gagne, sans détection de stale write. | Ajouter un test PostgreSQL concurrent avant un workflow avec enjeu d'écrasement ; ne pas introduire de versioning sans besoin démontré. |
| API `/v1` | POST 201, GET 200, PUT 200 ; entrées strictes ; champs serveur exclus ; union discriminée ; OpenAPI golden et contrats passent ; structures de persistence non exposées. | READY | La réponse ne porte pas `tenantId`, ce qui est favorable à la non-divulgation mais impose au client de conserver son contexte séparément. | Aucun changement requis. Évoluer additivement. |
| Erreurs opérationnelles | Validation/domain → 400, absence auth → 401, grant → 403, absent/cross-tenant → 404, inattendu → 500 générique ; Problem Details omet SQL, stack, tenant étranger et structures d'autorité. | READY | Les tests Property ne provoquent pas explicitement une erreur SQL pour vérifier le corps 500. | Ajouter un test focalisé de sanitisation 500 si le filtre commun n'est plus suffisamment couvert. |
| Tests | 58 unitaires, 59 intégration, 57 contrat, 8 PostgreSQL Property et 205 tests globaux passent ; chemins négatifs majeurs couverts. | READY WITH GAP | Pas de concurrence réelle ; couverture explicite incomplète pour devise de forme valide mais inexistante, tous types Property invalides au domaine, corruption de chaque variante et 500 persistence. | Compléter au plus bas niveau utile, prioritairement avant publication ou transactions. |
| Localisation UI | Les enums techniques anglaises sont stables et peuvent être mappées côté UI : `DRAFT`→Brouillon, types et modes selon la table fournie. Aucun libellé français n'est encodé dans le domaine. | READY | Aucun registre/catalogue de traduction n'est dans ce slice backend, ce qui est normal. | TASK-037 exposera `INDIVIDUAL`/`LEGAL_ENTITY`, mappables en « Personne physique »/« Personne morale ». |
| Utilisabilité gestion Property | Création, lecture et enrichissement produisent un brouillon significatif avec adresse, caractéristiques optionnelles et prix. | PARTIALLY READY | Impossible d'identifier le propriétaire, son portefeuille ou la structure immobilière. | Owner puis Ownership ; Composition ensuite selon validation métier. |
| Property Owner | Aucun type, agrégat, use case, endpoint, table ou test ne représente la personne qui possède juridiquement/économiquement le bien. | NOT READY | Gap métier explicite ; `tenantId` ne doit pas être réinterprété comme owner. | Sélectionner TASK-037 Owner Management. |
| Ownership | Aucun `ownerId` ni `PropertyOwnership`; aucune cardinalité ou histoire de détention. | NOT READY | Le système ne peut relier un owner à un bien, ni garantir la portée tenant de ce lien. | TASK-038 séparé, après création/lecture d'Owner. |
| Building/Residence/Unit | `PropertyType` distingue appartement, maison, terrain, local commercial et autre, mais ni immeuble/résidence, ni parent/enfant, ni unité/référence. | NOT READY | Un appartement peut exister, mais pas être rattaché à une structure ; `Property` ne peut pas actuellement représenter sans ambiguïté bâtiment et unité. | Discovery ciblée puis TASK-039 provisoire ; ne pas créer un bounded context séparé sans preuve d'ownership métier distinct. |
| Publication | Le brouillon et ses conditions existent, mais ni owner ni assignment ni règles de readiness/publication. | PREMATURE | Les questions « qui possède ? » et, pour une unité, « dans quelle structure ? » restent sans réponse. | Reporter le lifecycle de publication après Owner/Ownership et décision Composition ; ne pas inférer la publication de la complétude. |

## 4. Invariants actuels documentés

Les flux supportés ne peuvent persister un état invalide sans contourner les
ports applicatifs :

1. `propertyId` et `tenantId` sont des UUID v4 fournis par des sources de
   confiance ; le client ne choisit ni l'identité, ni le tenant, ni le statut.
2. Toute Property créée est `DRAFT` ; aucun autre état n'est accepté.
3. Titre et adresse sont normalisés et requis ; pays, types et instants ont une
   forme bornée.
4. Détails et conditions commerciales sont tous deux absents ou tous deux
   présents.
5. Les détails ne sont pas vides et respectent leurs bornes physiques simples.
6. Il existe exactement une variante commerciale, identique au
   `transactionType`, avec uniquement ses champs compatibles.
7. Les montants sont des entiers non négatifs en unités mineures dans la plage
   sûre JavaScript ; la devise est une chaîne majuscule de trois lettres.
8. Toute opération résout un tenant unique depuis une autorité interne et
   vérifie un grant spécifique avant l'accès repository.
9. Lecture et mutation sont filtrées par tenant dans la requête et protégées par
   le contexte transactionnel/RLS ; la mutation des détails est atomique et
   verrouillée.

Invariants encore implicites ou non établis : chronologie stricte des timestamps,
validité sémantique ISO 4217, prix strictement positif, définition de la
complétude publiable, présence d'un owner, unicité/cardinalité de l'ownership et
cohérence d'une unité avec son bâtiment. Ils ne doivent pas être inventés dans
TASK-036.

## 5. Audit métier Owner, Ownership et composition

### Distinction des concepts

| Concept | Responsabilité retenue |
|---|---|
| `Tenant` | Organisation cliente qui utilise MonPiole et dans laquelle les données sont isolées. |
| `AuthenticatedAuthority` | Identité interne, grants et périmètres tenant de l'utilisateur connecté. |
| `PropertyOwner` | Personne physique ou morale possédant juridiquement ou économiquement un actif. |
| `Property` | Actif immobilier géré par le tenant. |
| `PropertyOwnership` | Relation métier entre owner et property, susceptible de porter dates, quote-part et historique. |
| Building/Residence | Structure immobilière éventuelle regroupant des unités. |
| Unit | Appartement, studio, local ou autre actif contenu dans cette structure. |

Ces concepts ne sont pas interchangeables. En particulier, « tenant propriétaire
de la donnée » au sens SaaS n'implique jamais « tenant propriétaire du bien ».

### Formes et cardinalités Owner

TASK-037 doit permettre au minimum `INDIVIDUAL` et `LEGAL_ENTITY`. Le minimum
confirmé pour une création utile est une identité affichable et discriminée :

- personne physique : nom et prénoms ;
- personne morale : raison sociale/dénomination.

Téléphone, email et adresse sont utiles mais leur caractère obligatoire doit
être validé par le produit. Pièce d'identité, identifiant légal, documents,
KYC, représentants, contacts multiples et données sensibles sont différables et
hors du slice minimal.

Le modèle futur doit supporter **un Owner vers plusieurs Properties**. Une clé
unique sur `ownerId` dans une relation future serait donc incorrecte. Plusieurs
Owners vers une Property (indivision, copropriété, détention partagée) est une
extension plausible mais non démontrée pour TASK-037/038 ; elle ne doit pas
complexifier le prochain slice.

### Relation directe ou `PropertyOwnership`

Un `Property.ownerId` serait le minimum technique pour une détention unique et
actuelle, mais rendrait coûteux l'ajout ultérieur de dates, quote-part, historique,
changement de propriétaire et indivision. Une entité/relation
`PropertyOwnership` est donc la direction recommandée pour TASK-038, sans la
concevoir dans TASK-036. La décision finale devra être prise avec les exigences
de TASK-038 : si seule une affectation unique, actuelle et sans métadonnées est
confirmée, `ownerId` reste une option KISS ; dès qu'un des besoins temporels ou
multi-owner est confirmé, la relation explicite devient nécessaire.

TASK-037 ne rattache aucun bien : il établit seulement des Owners réutilisables,
ce qui garantit naturellement le portefeuille 1→N au lieu de coupler la création
d'un owner à une seule Property.

### Building, Residence et Unit

Le type actuel permet de décrire une maison, un appartement, un terrain ou un
local commercial comme Property autonome. Il ne dit pas si l'actif est un
bâtiment, une résidence ou une unité, et ne porte ni parent, ni numéro d'unité.
`OTHER` ne constitue pas une modélisation fiable de ces concepts.

Trois options restent ouvertes pour TASK-039 :

1. Property représente bâtiment et unité avec une relation parent/enfant et un
   rôle discriminant ; solution compacte mais invariants hétérogènes dans le
   même agrégat ;
2. `PropertyUnit` est un concept enfant d'une structure ; sémantique plus claire,
   mais frontières d'agrégat et identité propre à préciser ;
3. un bounded context distinct ; prématuré faute de responsabilité, données et
   évolution indépendantes démontrées.

Le besoin est important pour les portefeuilles de résidences, mais il ne bloque
pas Owner Management. Il doit faire l'objet d'une discovery ciblée avant tout
schéma. Pour une future publication d'une unité, le rattachement ou l'affirmation
explicite qu'elle est autonome devra être décidé comme prérequis.

## 6. Findings bloquants

**Aucun défaut bloquant n'a été démontré dans le périmètre implémenté de
TASK-034/TASK-035.** Les garanties tenant, autorisation, invariants, persistance,
migration et sécurité API nécessaires à ces trois opérations sont intactes.

L'absence d'Owner/Ownership et de composition est bloquante **pour prétendre à
une readiness de publication complète**, mais pas une corruption de l'agrégat
actuel. Elle est donc classée gap métier contenu et réordonne la roadmap plutôt
que d'imposer une correction du code existant.

## 7. Findings non bloquants

- L'appartenance réelle au registre ISO 4217 n'est pas vérifiée.
- Les montants zéro sont acceptés ; leur sens métier n'est pas documenté.
- La chronologie `updatedAt >= createdAt` n'est pas explicitement protégée.
- Quelques contraintes de normalisation HTTP/domaine ne sont pas doublées en SQL.
- Le verrou pessimiste est intentionnel, mais aucun test à deux transactions
  simultanées ne documente le comportement « dernière transaction sérialisée ».
- Les tests négatifs ne couvrent pas chaque corruption persistence ni une erreur
  SQL transformée en 500 générique dans le slice Property.
- Aucun Owner, Ownership, Building/Residence/Unit ou règle de publication
  n'existe ; ces absences sont des scopes futurs, pas des fonctionnalités à
  injecter spéculativement dans l'agrégat actuel.

## 8. Readiness des capabilities aval

| Capability candidate | Classement | Justification |
|---|---|---|
| Property Owner Management | READY | Nouveau petit agrégat tenant-scoped dans le bounded context Property ; infrastructure, auth, contrats et patterns de tests existent ; aucune mutation de Property requise. |
| Property Ownership Assignment | PARTIALLY READY | Property existe et Owner sera fourni par TASK-037 ; cardinalité et choix `ownerId`/`PropertyOwnership` restent à valider. |
| Property Building / Unit Composition | PARTIALLY READY | Les types et adresses existent, mais les concepts structure/unité et leurs invariants sont absents ; discovery nécessaire. |
| Property Publication Lifecycle | PREMATURE | Détails commerciaux disponibles, mais owner/assignment, composition éventuelle et prérequis de publication sont absents. |
| Property Media Management | PARTIALLY READY | `propertyId` et isolation existent ; modèle media, stockage, ordre, limites et lifecycle sont absents. Ne résout pas le gap owner. |
| Property Search / Listing | PREMATURE | Aucun état publié ni contrat d'exposition ; rechercher les brouillons risquerait une fuite et une sémantique incorrecte. |
| Availability | PREMATURE | Pas de ressource/calendrier, horizon ni sémantique par mode commercial. |
| Owner/mandate management étendu | PARTIALLY READY | Owner minimal est prêt comme prochaine fondation ; mandat, représentation et documents n'ont aucune exigence confirmée. |
| Rental applications | PREMATURE | Nécessite publication/listing, candidat et workflow locatif. |
| Lease management | PREMATURE | Nécessite owner/mandate, parties, propriété attribuée et workflow locatif. |
| Short-term reservations | PREMATURE | Nécessite unité publiable, disponibilité, réservation et règles tarifaires. |
| Sale transactions | PREMATURE | Nécessite owner/ownership, parties, processus de vente et garanties juridiques. |

## 9. Décision de prochaine capability

### Capability sélectionnée — exactement une

**TASK-037 — Property Owner Management Vertical Slice**

### Problème métier et acteur

Une agence ou organisation tenant peut gérer un brouillon Property, mais ne peut
enregistrer la personne physique ou morale pour le compte de laquelle elle le
gère. Un utilisateur interne disposant de l'autorité Owner doit pouvoir créer un
propriétaire et le relire sans ambiguïté, dans son tenant uniquement.

### Pourquoi cette capability avant les alternatives

- Elle comble le premier trou de langage métier démontré, sans gonfler
  l'agrégat Property.
- Elle produit un référentiel réutilisable : un owner pourra être rattaché à N
  biens, contrairement à un owner embarqué dans chaque Property.
- Elle est une tranche verticale petite, testable et directement alignée sur les
  patterns techniques validés par TASK-034/035.
- Elle prépare l'affectation (TASK-038), les mandats et les transactions.
- Publication, media et search n'identifient pas la partie propriétaire et
  avanceraient un actif incomplet vers des flux aval.
- Composition est importante, mais indépendante de la création d'un owner et
  requiert davantage de discovery sur bâtiment versus unité.

## 10. Frontière proposée de TASK-037

### Objectif

Créer et consulter un `PropertyOwner` tenant-scoped représentant soit une
personne physique, soit une personne morale, sans l'affecter encore à un bien.

### Surface API indicative

```text
POST /v1/property-owners
GET  /v1/property-owners/{propertyOwnerId}
```

Contrats discriminés proposés, à confirmer par la discovery métier :

```text
INDIVIDUAL   → identité minimale : firstNames, lastName
LEGAL_ENTITY → identité minimale : legalName
```

Les réponses exposent identifiant, type, identité affichable et timestamps, mais
ni `tenantId`, ni structures persistence, ni libellés français. L'UI mappe
`INDIVIDUAL` vers « Personne physique » et `LEGAL_ENTITY` vers « Personne morale ».

### Impact agrégat et bounded context

Ajouter un agrégat `PropertyOwner` distinct dans `property-management`. Ne pas
modifier l'agrégat Property et ne pas créer un nouveau bounded context tant
qu'aucune responsabilité indépendante ne le justifie. La relation Ownership
reste hors TASK-037.

### Autorités

```text
CREATE_PROPERTY_OWNER
RETRIEVE_PROPERTY_OWNER
```

`READ_PROPERTY_OWNER` serait aussi compréhensible, mais `RETRIEVE_...` est plus
cohérent avec `RETRIEVE_PROPERTY`; le nom final doit suivre la convention retenue.
`UPDATE_PROPERTY_OWNER` et `ASSIGN_PROPERTY_OWNER` ne doivent être introduits
qu'avec les opérations correspondantes.

### Persistance

Nouvelle table service-owned dans `property_management`, avec identifiant owner,
`tenant_id`, discriminant, champs minimaux par variante, timestamps et trace
correlation/actor. Exiger prédicats `(tenant_id, property_owner_id)`, transaction
tenant-scoped, RLS activée et forcée, contraintes discriminées empêchant le
mélange personne physique/personne morale, et migration additive reproductible
depuis une base vide. Aucun `owner_id` dans `properties` pendant TASK-037.

### Tests attendus

- domaine : variantes valides, champs requis/normalisés, variantes incompatibles,
  valeurs serveur invalides et réhydratation corrompue ;
- application : grants spécifiques, tenant unique, identifiant/temps de confiance ;
- HTTP : 201/200, 400, 401, 403, 404 tenant-safe, champs inconnus et server-owned
  refusés, Problem Details sans fuite ;
- contrat : union discriminée, OpenAPI, sécurité bearer, compatibilité additive ;
- PostgreSQL : migration à vide, persistence/réhydratation des deux variantes,
  RLS forcée, lecture cross-tenant indistinguable, contraintes SQL et rôle runtime ;
- localisation : enums techniques stables et mapping UI français possible sans
  traduction dans le domaine.

### Non-objectifs

- affecter un owner à une Property ;
- liste/portfolio des biens d'un owner ;
- multi-owner, quote-part, historique et transfert de propriété ;
- update/delete/archive/merge d'owners ;
- mandat de gestion, représentant légal, KYC, pièces d'identité ou documents ;
- Building/Residence/Unit ;
- publication, search/listing, media, disponibilité, réservation, bail, vente,
  paiement et notifications.

## 11. Séquence probable après TASK-037

Cette séquence est une recommandation, pas une implémentation ni un engagement de
sprint :

```text
TASK-037  Property Owner Management
    ↓
TASK-038  Property Ownership Assignment
    ↓
TASK-039  Property Composition / Building & Units (numéro provisoire)
    ↓
           Property Publication Lifecycle
```

TASK-038 devra vérifier dans une même autorité tenant-scoped l'existence de la
Property et du PropertyOwner, verrouiller ce qui est nécessaire, interdire tout
rattachement cross-tenant et retourner un 404 non révélateur. La décision entre
`Property.ownerId` et `PropertyOwnership` devra être fondée sur les besoins
confirmés ; la relation explicite est préférable si dates, historique, quote-part
ou multi-owner sont requis.

TASK-039 devra décider le langage métier (building, residence, unit), les types
publiables, les identités et invariants parent/enfant. Son numéro et son ordre
exact pourront changer après TASK-037/038. Publication restera une action domaine
explicite, jamais une inférence automatique de champs remplis.

## 12. Vérifications exécutées

Toutes les gates applicables passent après restauration des dépendances
verrouillées et démarrage du runtime Docker requis par Testcontainers :

| Commande | Résultat |
|---|---|
| `corepack pnpm install --frozen-lockfile` | PASS — lockfile inchangé, 383 paquets réutilisés depuis le store local. |
| `corepack pnpm service:property-management:typecheck` | PASS |
| `corepack pnpm app:api:typecheck` | PASS |
| `corepack pnpm typecheck:tests` | PASS |
| `corepack pnpm architecture:check` | PASS — workspace, exports, resolver, graphe, frontières, cycles et diagnostics. |
| `corepack pnpm service:property-management:migration:check` | PASS — Drizzle « Everything's fine ». |
| `corepack pnpm test:unit` | PASS — 10 fichiers, 58 tests. |
| `corepack pnpm test:integration` | PASS — 10 fichiers, 59 tests. |
| `corepack pnpm test:contract` | PASS — 9 fichiers, 57 tests. |
| `corepack pnpm service:property-management:test:integration` | PASS — 1 fichier, 8 tests PostgreSQL ; migrations rejouées sur base vide Testcontainers. |
| `corepack pnpm test` | PASS — 33 fichiers, 205 tests. |

Le premier lancement d'architecture et de Vitest dans la sandbox a rencontré
`spawn EPERM`; les mêmes commandes ont passé hors sandbox. Le premier lancement
d'intégration sans daemon Docker a échoué avant tests ; après démarrage de Docker,
la suite complète a passé. Ces incidents sont environnementaux et ne masquent
aucun échec final.

## 13. Décision finale et critères d'acceptation

TASK-034 et TASK-035 sont audités ; invariants, lifecycle, variantes commerciales,
tenant isolation, autorisation, PostgreSQL/migrations, concurrence, contrats,
erreurs, localisation et chemins négatifs sont évalués. Les gaps Owner,
Ownership et Building/Unit sont explicites ; les candidats aval sont classés ;
une seule prochaine capability est choisie et bornée ; aucun code fonctionnel ni
schéma spéculatif n'est introduit.

```text
TASK-036 → READY WITH CONTAINED GAPS
TASK-037 → Property Owner Management Vertical Slice
```
