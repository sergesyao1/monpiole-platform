# TASK-050 — Property Composition Domain Discovery & Vertical Slice Definition

- **Statut :** DONE — GO
- **Date :** 2026-08-28
- **Baseline auditée :** `afd9afb docs(property): audit core information update readiness`
- **Nature :** discovery métier et définition de tranche ; aucune implémentation
- **Décision :** Option B — Property → Buildings → Unit Properties

## Contexte

TASK-034 à TASK-048 ont livré un actif `Property` tenant-scoped, ses informations cœur, détails et conditions commerciales, les `PropertyOwner` et `PropertyOwnership`, le portefeuille privé et leurs parcours Web. TASK-049 a vérifié cette base au commit `6459c6c`, conclu `READY WITH CONTAINED GAPS`, sélectionné Property Composition et interdit une implémentation tant que rôles, cardinalités, héritage et niveau d’ownership restaient indéterminés.

TASK-050 ferme ce NO-GO de conception. Elle ne crée ni code, ni migration, ni endpoint, ni TASK-051. Elle définit un langage, un modèle conceptuel et une première tranche verticale suffisamment bornés pour être implémentés séparément.

## Baseline et preuves inspectées

### État du dépôt

Au démarrage, `git status --short` ne produisait aucune sortie. `main` pointait sur :

```text
afd9afb docs(property): audit core information update readiness
6459c6c feat(property): add core information update
0175c14 docs(property): audit post-owner-directory readiness
0709786 feat(property): add owner directory and web management
e32eafd docs(property): audit post-portfolio web readiness
8fa24c2 feat(web): add property portfolio discovery
```

Le seul `AGENTS.md` applicable est celui de la racine. TASK-039 n’existe pas dans `.codex/tasks`; TASK-042 mentionne seulement une ancienne réservation provisoire de ce numéro. Aucun contenu ni intitulé TASK-039 n’est donc repris comme exigence.

### Documents lus

- TASK-034 à TASK-038, TASK-042 à TASK-049 et UI-003 ;
- ADR-0003 API/Event Contracts, ADR-0004 Multi-Tenant Context, ADR-0005 Clean Architecture/DDD, ADR-0006 Bounded Contexts et ADR-0007 OIDC ;
- TD-006 Zod/OpenAPI, TD-008 PostgreSQL/Drizzle, TD-013 Web, TD-014 OIDC Web et TD-015 session cache ;
- README de `services/property-management`, `apps/api` et `apps/web`.

### Code, contrats et données inspectés

- `Property`, `PropertyDetails`, `PropertyOwner`, `PropertyOwnership` et leurs use cases ;
- `PropertyRepository`, les queries Portfolio/Owner et les repositories PostgreSQL ;
- `schema.ts`, migrations 0000–0005, contraintes, clés composites, indexes et forced RLS ;
- contrôleurs `/v1`, DTO Zod, mappers, Problem Details et OpenAPI 3.1 généré ;
- grants, résolution OIDC interne et `createPostgresApiRuntime` ;
- routes, portefeuille, création, fiche Property, formulaires, annuaire Owner et ownership Web ;
- tests unitaires, HTTP, contrat, PostgreSQL/Testcontainers, runtime et Web.

### Vérité actuelle structurante

- Une `Property` est aujourd’hui le seul actif immobilier adressable. Elle possède `propertyId`, tenant, type physique, projet commercial, statut `DRAFT`, informations cœur, détails/termes optionnels et ownerships.
- `PropertyType` vaut `APARTMENT`, `HOUSE`, `LAND`, `COMMERCIAL` ou `OTHER`; il décrit une catégorie physique et non un rôle dans une composition.
- Le tenant, l’acteur, les grants et la propriété juridique sont quatre notions distinctes.
- `PropertyOwnership` cible un `propertyId`; une Unit qui doit être indépendamment possédée ou gérée gagne donc à rester une Property plutôt qu’à devenir une seconde forme d’actif.
- La table `properties` possède une clé unique `(tenant_id, property_id)`, des traces, forced RLS et les colonnes nécessaires aux capacités existantes.
- Aucun DELETE Property n’existe. Les relations Ownership utilisent des FKs tenant-qualifiées, `ON DELETE NO ACTION`, une RLS forcée et des verrous explicites.
- Les collections utilisent une pagination keyset stable, une limite 1–100, un curseur opaque et des projections distinctes du repository d’agrégat.
- Le Web utilise le client bearer partagé, ne transmet pas de tenant et présente toute interface utilisateur en français.

## Terminologie métier retenue

### Property — Bien immobilier

Actif immobilier géré dans le portefeuille MonPiole. Il reste l’unique ressource pouvant porter les informations cœur, détails, conditions commerciales et ownerships existants.

Chaque Property reçoit un rôle structurel serveur :

- `STANDALONE` — **Bien autonome** : ni conteneur de composition, ni unité d’un immeuble ;
- `COMPOSITE` — **Ensemble immobilier** : Property racine contenant un ou plusieurs Buildings ;
- `UNIT` — **Unité** : Property exploitable rattachée à exactement un Building.

`structuralRole` est orthogonal à `propertyType`. Un ensemble peut être principalement résidentiel, commercial ou mixte sans transformer `BUILDING` en type physique. `propertyType` et `transactionType` restent immuables dans la première tranche.

### Building — Immeuble

Entité structurelle explicite appartenant à une Property `COMPOSITE`. Un Building regroupe des Units mais n’est pas lui-même une Property dans la première tranche.

Conséquences :

- il n’a ni conditions commerciales, ni ownership, ni statut de publication ;
- il n’apparaît pas comme carte autonome du portefeuille ;
- son identité sert à organiser la structure, pas à représenter un actif exploitable ;
- il est créé, consulté et modifié uniquement dans le contexte de sa Property.

### Unit — Unité exploitable

Rôle d’une Property enfant reliée à un Building. L’unité possède son propre `propertyId`, titre, localisation, type, transaction et peut réutiliser les capacités Property existantes. Le rattachement porte un `unitCode` structurel unique dans l’immeuble.

Une Unit n’est pas une chambre, un équipement, un lit ni une subdivision récursive. C’est un actif indépendamment adressable : appartement, local, maison de résidence ou autre lot géré.

### Residence — Résidence / ensemble immobilier

Ce n’est pas une nouvelle entité dans la première tranche. Une résidence est représentée par une Property `COMPOSITE` contenant un ou plusieurs Buildings. Si un futur besoin démontre des attributs ou un cycle de vie propres à Residence, il fera l’objet d’une discovery séparée.

### Composition

Structure non récursive :

```text
Property COMPOSITE (ensemble immobilier)
└── 1..n Building (immeuble)
    └── 0..n Property UNIT (unité exploitable)
```

Une Property `STANDALONE` n’a aucun Building et aucune relation parente. Une Property `UNIT` appartient à exactement un Building et ne peut contenir aucun Building.

## Questions de discovery et réponses

| Question | Décision | Justification repository |
|---|---|---|
| Qu’est-ce que la composition ? | Organisation explicite d’un ensemble Property en Buildings contenant des Unit Properties. | Le modèle actuel ne sait représenter qu’un actif autonome ; ownership et termes ciblent déjà Property. |
| Quelles catégories minimales ? | Bien autonome, ensemble composé, immeuble structurel, unité exploitable. | Couvre maison/appartement autonome, immeuble multi-unités et résidence multi-immeubles sans graphe générique. |
| Building est-il explicite ? | Oui, comme entité structurelle du bounded context, pas comme Property ni nouveau bounded context. | Évite de forcer transaction/ownership sur une structure et respecte la propriété des données du service. |
| Une Unit appartient-elle à Property ou Building ? | Directement à un Building ; le Building appartient à la Property racine. | Préserve l’appartenance métier de l’unité à un immeuble et supporte plusieurs immeubles par ensemble. |
| Une Unit est-elle une Property ? | Oui. `unitPropertyId` est son identité d’actif. | Réutilise les invariants, détails, termes, ownership, API et UI existants au lieu de créer un actif parallèle. |
| Une Property existante peut-elle être attachée comme Unit ? | Non dans la première tranche. Une Unit est créée par le parcours imbriqué. | Évite une mutation ambiguë d’un actif autonome déjà référencé ou possédé. |
| La structure est-elle récursive ? | Non : exactement trois niveaux conceptuels et deux relations. | Aucun cas confirmé ne justifie arbre, cycles ou profondeur arbitraire. |
| Les données héritent-elles ? | Non. Une Unit possède une copie explicite de sa localisation et ses propres champs. L’UI peut préremplir depuis la Property racine. | L’agrégat Property actuel valide une localisation complète et ne connaît aucun mécanisme d’héritage. |
| Où porte l’ownership ? | Sur les Properties seulement : ensemble racine ou Unit. Jamais sur Building. Aucun héritage automatique. | `PropertyOwnership` cible déjà Property avec des invariants tenant et concurrence éprouvés. |
| Où portent détails et termes ? | Sur chaque Property, donc racine ou Unit, sans propagation. | Préserve `defineDetails` et l’union commerciale existante. TASK-051 n’ajoute pas de tarification. |
| Faut-il un type d’usage Unit ? | Non dans TASK-051. `propertyType` de la Unit exprime sa catégorie physique. | Un second enum d’usage n’est étayé par aucun cas métier du dépôt. |
| Comment ordonner ? | Building par `buildingCode ASC, buildingId ASC`; Units par `unitCode ASC, unitPropertyId ASC`. | S’aligne sur la pagination keyset déterministe. Aucun besoin d’ordre manuel n’est prouvé. |
| Suppression ? | Aucun DELETE Building/Unit/rattachement dans TASK-051. | Property n’a pas de suppression ; les futures références exigent une stratégie explicite. |
| Événements métier ? | Aucun événement d’intégration dans TASK-051. Traces obligatoires ; événements différés jusqu’à un consommateur. | Les capacités Property actuelles n’ajoutent pas d’événement sans besoin inter-contextes. |

## Comparaison des options de modélisation

### Option A — Property possède directement des Units

Modèle : `Property → Unit Property`, sans Building.

| Critère | Analyse |
|---|---|
| Simplicité | Meilleure à court terme : une seule relation et moins d’endpoints. |
| Cohérence métier | Suffisante pour un seul immeuble implicite, faible dès qu’une résidence contient plusieurs bâtiments. |
| Invariants | Parent 1→n Units, enfant au plus un parent ; cycles évitables avec rôles. |
| Extensibilité | Building devrait être ajouté plus tard entre deux niveaux déjà persistés. |
| API/DB/Web | Petite première tranche. |
| États incohérents | Le parent peut devenir un « immeuble implicite » sans identité structurelle claire. |
| Compatibilité PropertyType | Ne distingue pas le type physique du rôle d’immeuble ; risque d’utiliser `OTHER` comme Building. |
| Migration future | Élevée : création de Buildings implicites, réaffectation des relations et décision sur les codes existants. |

**Verdict : rejetée.** Elle optimise la première livraison au prix d’une migration quasi certaine pour le cas résidence déjà demandé dans les audits.

### Option B — Property possède des Buildings, chaque Building possède des Units

Modèle : `Property COMPOSITE → Building → Property UNIT`.

| Critère | Analyse |
|---|---|
| Simplicité | Plus de concepts et de routes que A, mais structure fixe et non récursive. |
| Cohérence métier | Représente explicitement immeuble et résidence ; une Unit reste l’actif exploitable. |
| Invariants | Rôles, cardinalités et unicités locales sont explicites et testables. |
| Extensibilité | Supporte déjà plusieurs Buildings sans imposer floors, wings ou graph. |
| API/DB/Web | Deux tables structurelles/projections et parcours imbriqués ; effort moyen. |
| États incohérents | Maîtrisables par rôles serveur, FKs tenant-qualifiées, verrous et absence de reparenting/delete. |
| Compatibilité PropertyType | `structuralRole` reste orthogonal aux enums physiques existants. |
| Migration future | Faible pour les cas multi-immeubles ; les lignes existantes deviennent `STANDALONE`. |

**Verdict : sélectionnée.** C’est le plus petit modèle qui couvre sans ambiguïté les cinq cas demandés tout en réutilisant Property pour les actifs unitaires.

### Option C — Units directes ou rattachées à un Building

Modèle hybride : une Property peut contenir des Units directes et des Buildings avec Units.

| Critère | Analyse |
|---|---|
| Simplicité | Faible : deux chemins de création, listing et mutation. |
| Cohérence métier | Flexible mais oblige à expliquer pourquoi deux Units équivalentes ont des parents de nature différente. |
| Invariants | XOR parent Property/Building, ordre global, déplacement et unicité deviennent complexes. |
| Extensibilité | Maximale en apparence, mais entraîne tôt une abstraction de graphe. |
| API/DB/Web | Contrats polymorphes, états UI et migrations plus coûteux. |
| États incohérents | Risque élevé de Unit sans parent, double rattachement ou code ambigu. |
| Compatibilité PropertyType | N’apporte aucune clarification supplémentaire. |
| Migration future | Faible seulement si les deux modes sont réellement nécessaires, ce qui n’est pas prouvé. |

**Verdict : rejetée comme abstraction prématurée.** Aucun cas actuel n’exige une unité hors immeuble dans une Property composée ; un appartement autonome reste une Property `STANDALONE`.

## Modèle conceptuel retenu

### Property enrichie

Attribut serveur ajouté :

```text
structuralRole: STANDALONE | COMPOSITE | UNIT
```

- migration des Properties existantes vers `STANDALONE` avec colonne non nulle et contrainte CHECK ;
- `POST /v1/properties` continue de créer `STANDALONE`; le client ne choisit pas `UNIT` ;
- la création du premier Building transitionne atomiquement le parent `STANDALONE → COMPOSITE` ;
- la création imbriquée d’une Unit crée une nouvelle Property avec rôle `UNIT` ;
- aucune transition inverse ni mutation libre de rôle dans TASK-051 ;
- `structuralRole` devient un champ public en lecture, avec labels français « Bien autonome », « Ensemble immobilier » et « Unité ».

### Building

```text
Building {
  buildingId: UUID v4 serveur
  tenantId: UUID v4 interne
  propertyId: UUID v4 de la Property COMPOSITE
  buildingCode: string canonique
  name: string normalisé
  createdAt: UTC instant
  updatedAt: UTC instant
  correlationId: UUID de trace
  actorId: identité interne de trace
}
```

### Unit relation

```text
BuildingUnit {
  tenantId: UUID v4 interne
  buildingId: UUID v4
  unitPropertyId: UUID v4 de la Property UNIT
  unitCode: string canonique
  createdAt: UTC instant
  updatedAt: UTC instant
  correlationId: UUID de trace
  actorId: identité interne de trace
}
```

`unitPropertyId` est à la fois l’identité de l’unité exploitable et la FK vers `properties`. Aucun `unitId` redondant n’est créé.

## Agrégats et frontières transactionnelles

- `Property` reste un aggregate root pour ses informations, détails, termes et rôle structurel.
- `Building` est un aggregate root structurel tenant-scoped, identifié par `buildingId`, appartenant à une Property.
- La relation `BuildingUnit` relie deux aggregate roots (`Building` et la Property UNIT). Elle possède le code structurel et ses traces.
- La création d’un Building est une transaction du bounded context : verrou Property parent, validation du rôle, transition éventuelle, insertion Building.
- La création d’une Unit est une transaction unique : verrou Property racine puis Building dans cet ordre, génération et validation de la Property UNIT, insertion Property et relation.
- La modification Building verrouille la Property racine puis Building. La modification `unitCode` verrouille la racine, le Building puis la relation, toujours dans cet ordre.
- Les listings utilisent des query ports de projection distincts et ne chargent pas un graphe d’agrégats complet.

Cette coordination reste dans `property-management`; aucun nouveau service ni transaction distribuée n’est justifié.

## Relations et cardinalités

| Relation | Cardinalité | Règle |
|---|---|---|
| Property COMPOSITE → Building | 1 à n après première création | un Building appartient à exactement une Property du même tenant |
| Building → Unit Property | 0 à n | une Unit appartient à exactement un Building |
| Property STANDALONE → Building | 0, puis transition atomique | la création du premier Building transforme le rôle en COMPOSITE |
| Property UNIT → Building enfant | 0 | une Unit ne contient jamais de Building |
| Property UNIT → parent Building | exactement 1 | garanti dès la création atomique ; aucun état UNIT orphelin validé |
| Property COMPOSITE → parent Building | 0 | un ensemble ne peut être Unit |

La profondeur maximale est fixe. Aucun Building dans Building, aucune Unit contenant des Units, aucun parent cross-tenant.

## Invariants

### Identifiants et tenant

- tous les UUID sont v4 et fournis par le serveur ;
- tenant dérivé de l’autorité, jamais du body/query ;
- Property racine, Building et Unit Property portent le même tenant ;
- FKs composites tenant-qualifiées doublent les prédicats applicatifs et la RLS ;
- ressources absentes et cross-tenant restent non distinguables.

### Codes et noms

- `buildingCode` et `unitCode` : trim, uppercase, longueur 1–50, pattern ASCII `^[A-Z0-9][A-Z0-9._/ -]{0,49}$` ;
- `buildingCode` unique dans une Property, `unitCode` unique dans un Building ;
- la valeur canonique uppercase est stockée et retournée ;
- `name` Building : trim, requis, longueur 1–200 ;
- le titre Property existant reste le nom d’affichage de la Unit ; aucun `unitName` dupliqué ;
- renommer un Building ou changer un code ne change aucun identifiant.

### Rôles et appartenance

- seul `STANDALONE` peut devenir `COMPOSITE`, uniquement lors du premier Building ;
- seul `COMPOSITE` peut recevoir d’autres Buildings ;
- une Unit est créée uniquement sous un Building existant ;
- une Property existante ne peut pas être attachée, détachée ou reparentée dans TASK-051 ;
- une Property ne peut pas être à la fois racine composée et Unit ;
- `propertyType`, `transactionType`, status et ownership ne décident pas le rôle structurel ;
- aucun héritage ou cascade métier de localisation, détails, termes ou ownership.

### Ordre et pagination

- Buildings : `buildingCode ASC, buildingId ASC` ;
- Units : `unitCode ASC, unitPropertyId ASC` ;
- pagination keyset, `limit` 1–100, défaut 20, curseur Base64URL opaque canonique ;
- changement de code peut déplacer un élément entre pages, comme toute vue vivante ; aucun ordre manuel dans TASK-051.

## Cycle de vie

### Création

1. Une Property existante est initialement `STANDALONE`.
2. « Ajouter un immeuble » crée un Building et transitionne la Property vers `COMPOSITE` dans la même transaction.
3. « Ajouter une unité » crée atomiquement une nouvelle Property `UNIT`, préremplie dans le Web depuis la localisation de l’ensemble mais envoyée avec ses propres valeurs, puis sa relation au Building.
4. Une Property UNIT devient immédiatement consultable par son `propertyId`; aucun statut de disponibilité ou publication n’est implicite.

### Consultation

- la fiche Property racine liste ses Buildings ;
- chaque Building permet de charger ses Units par curseur ;
- chaque Unit expose un résumé Property et peut utiliser la fiche Property existante ;
- un appartement autonome reste une Property `STANDALONE` sans faux Building.

### Modification

- Building : remplacement complet de `buildingCode` et `name` ;
- relation Unit : remplacement de `unitCode` ;
- informations cœur Unit : endpoint Property existant ;
- détails, termes et ownership Unit : capacités existantes, sans nouvelle règle TASK-051 ;
- rôle, parent, type et transaction restent immuables.

### Suppression et réorganisation

Aucun DELETE, detach, move ou reorder dans TASK-051. Les FKs utilisent `ON DELETE NO ACTION`/`RESTRICT`.

Une future suppression devra au minimum :

- refuser un Building non vide ;
- refuser une Unit portant ownership ou toute future référence métier ;
- choisir explicitement entre archivage et suppression physique ;
- définir le devenir du rôle COMPOSITE lorsque le dernier Building disparaît ;
- produire des erreurs non révélatrices et un audit ;
- ne jamais cascader silencieusement la suppression de Properties.

Ces décisions restent des gaps contenus, pas des suppositions de TASK-051.

## Audit et événements

- chaque table nouvelle porte `createdAt`, `updatedAt`, `correlationId`, `actorId`, comme `properties` et `property_owners` ;
- les mutations réécrivent `updatedAt`, corrélation et acteur ;
- les logs ne contiennent ni payload complet, ni donnée personnelle, ni tenant étranger ;
- aucun événement d’intégration n’est publié sans consommateur confirmé ;
- les faits candidats futurs sont `BuildingCreated`, `BuildingUpdated`, `UnitCreated` et `UnitCodeUpdated`, mais leurs contrats ne sont pas définis dans TASK-051.

## Multi-tenancy, RLS et autorisations

### Persistance cible

Migration additive proposée :

1. ajouter `structural_role` à `properties`, backfill `STANDALONE`, rendre non nul, CHECK des trois valeurs ;
2. créer `property_buildings` avec PK `building_id`, unique `(tenant_id, building_id)`, FK `(tenant_id, property_id)` vers Property, unique canonique `(tenant_id, property_id, building_code)` et index de pagination ;
3. créer `property_building_units` avec PK `(tenant_id, building_id, unit_property_id)`, FK Building tenant-qualifiée, FK Unit Property tenant-qualifiée, unique `(tenant_id, unit_property_id)`, unique `(tenant_id, building_id, unit_code)` et index de pagination ;
4. ajouter CHECK identifiant/code/nom pertinent ;
5. activer et forcer RLS sur les deux tables, avec `app.tenant_id` pour `USING` et `WITH CHECK` ;
6. conserver `ON DELETE NO ACTION` ;
7. mettre à jour schéma Drizzle, journal et snapshot ; rejouer depuis une base vide.

Les invariants de rôle entre tables ne doivent pas dépendre uniquement d’un CHECK impossible à exprimer. Le repository les valide sous verrou ; les FKs, unicités et RLS assurent la défense SQL possible. Un trigger métier n’est pas introduit sans nécessité démontrée.

### Grants proposés

```text
CREATE_PROPERTY_BUILDING
RETRIEVE_PROPERTY_COMPOSITION
UPDATE_PROPERTY_BUILDING
CREATE_PROPERTY_UNIT
UPDATE_PROPERTY_UNIT_STRUCTURE
```

- grants internes explicitement filtrés et attribués au rôle interne approuvé ;
- aucun scope/claim OIDC ne devient une permission métier ;
- `RETRIEVE_PROPERTY` ne donne pas implicitement le droit de découvrir toute composition ;
- les capacités existantes sur une Unit exigent toujours leurs grants existants.

## Erreurs métier et HTTP

| Situation | Code métier proposé | HTTP |
|---|---|---:|
| payload, UUID, code, nom ou curseur invalide | `INVALID_PROPERTY_COMPOSITION_INPUT` / `INVALID_REQUEST` | 400 |
| authentification absente/invalide | `UNAUTHORIZED` | 401 |
| grant absent ou tenant authority ambiguë | `PROPERTY_COMPOSITION_FORBIDDEN` / `FORBIDDEN` | 403 |
| Property racine absente/cross-tenant | `PROPERTY_NOT_FOUND` | 404 |
| Building absent/cross-tenant ou n’appartenant pas à la Property | `PROPERTY_BUILDING_NOT_FOUND` | 404 |
| Unit absente/cross-tenant ou n’appartenant pas au Building | `PROPERTY_UNIT_NOT_FOUND` | 404 |
| tentative d’ajouter un Building sous une Unit | `PROPERTY_COMPOSITION_ROLE_CONFLICT` | 409 |
| `buildingCode` déjà utilisé dans la Property | `PROPERTY_BUILDING_CODE_CONFLICT` | 409 |
| `unitCode` déjà utilisé dans le Building | `PROPERTY_UNIT_CODE_CONFLICT` | 409 |
| unicité/concurrence équivalente détectée en persistence | même conflit métier | 409 |
| erreur inattendue/persistence | Problem Details générique sans SQL/tenant/stack | 500 |

La différence absent/cross-tenant n’est jamais exposée. Un code conflictuel ne révèle que les ressources déjà visibles dans le tenant et le parent autorisés.

## API cible de la première tranche

### Évolution Property additive

- `PropertyResponse` et `PropertyPortfolioItem` ajoutent `structuralRole` ;
- `POST /v1/properties` continue de créer uniquement `STANDALONE` et n’accepte pas un rôle client ;
- le mapper Web ajoute les labels français centralisés ;
- aucune route Property existante ne change de sémantique.

### Buildings

```text
POST /v1/properties/{propertyId}/buildings
GET  /v1/properties/{propertyId}/buildings?limit=&cursor=
PUT  /v1/properties/{propertyId}/buildings/{buildingId}
```

Requête create/update stricte :

```json
{
  "buildingCode": "BAT-A",
  "name": "Immeuble A"
}
```

Réponse : `buildingId`, `propertyId`, `buildingCode`, `name`, `createdAt`, `updatedAt`. Aucun `tenantId` ni trace interne.

### Units

```text
POST /v1/properties/{propertyId}/buildings/{buildingId}/units
GET  /v1/properties/{propertyId}/buildings/{buildingId}/units?limit=&cursor=
PUT  /v1/properties/{propertyId}/buildings/{buildingId}/units/{unitPropertyId}
```

Requête create stricte :

```json
{
  "unitCode": "A-101",
  "title": "Appartement A-101",
  "description": "Premier étage",
  "propertyType": "APARTMENT",
  "transactionType": "LONG_TERM_RENTAL",
  "location": {
    "country": "CI",
    "city": "Abidjan",
    "district": "Cocody",
    "addressLine": "Rue des Jardins, bâtiment A, unité 101"
  }
}
```

La réponse de création combine `unitCode` et la représentation publique Property créée. La requête PUT structurelle est strictement `{ "unitCode": "A-102" }`; les autres informations passent par les endpoints Property existants.

### Collections

Les deux collections retournent :

```json
{
  "items": [],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

Le curseur est opaque au Web. Aucun total count, arbre complet, filtre, recherche ou tri paramétrable dans TASK-051.

## Expérience Web cible en français

La fiche `/properties/:propertyId` reçoit une section **« Composition du bien »**.

### Bien autonome

- badge « Bien autonome » ;
- état vide : « Aucun immeuble n’est encore rattaché à ce bien. » ;
- action « Ajouter un immeuble » si autorisée ;
- l’ajout du premier immeuble actualise le badge en « Ensemble immobilier ».

### Ensemble immobilier

- cartes Building ordonnées, avec code, nom et action « Modifier l’immeuble » ;
- bouton explicite « Charger les immeubles suivants » ;
- chaque carte permet « Afficher les unités » puis une pagination explicite ;
- état vide Building : « Aucune unité dans cet immeuble. » ;
- action « Ajouter une unité » avec localisation préremplie depuis la Property racine mais modifiable ;
- chaque Unit affiche code, titre, type français, projet commercial français et adresse ;
- modification inline du code ; les informations du bien utilisent le formulaire Property existant ou une navigation claire vers la fiche Unit.

### États obligatoires

- chargement initial de la composition ;
- aucun immeuble et aucune unité ;
- succès create/update avec région `status` ;
- validation client française ;
- chargement de page suivante non destructif ;
- 401/session expirée selon le client partagé ;
- 403 sans masquer le reste de la fiche Property ;
- 404 Property global et 404 Building/Unit local non révélateur ;
- 409 avec message français précis sur le code ou rôle en conflit ;
- erreur serveur/réseau et nouvelle tentative conservant les résultats ;
- focus visible, labels, `fieldset`, `aria-busy`, `status`/`alert` et rendu responsive existants.

Les valeurs techniques ne sont jamais affichées directement : `STANDALONE → Bien autonome`, `COMPOSITE → Ensemble immobilier`, `UNIT → Unité`.

## Première tranche verticale — périmètre IN

1. `structuralRole` serveur et migration compatible des Properties existantes.
2. Entité Domain Building et relation BuildingUnit vers une Property UNIT.
3. Invariants, erreurs et use cases create/list/update décrits ci-dessus.
4. Création atomique d’une Unit Property sous un Building.
5. Ports de mutation et query ports paginés distincts.
6. Tables, FKs composites, unicités, indexes, traces et forced RLS.
7. Grants explicites, autorité interne, composition NestJS/PostgreSQL réelle.
8. Contrats Zod stricts, Problem Details et OpenAPI 3.1 additifs.
9. Section Web française dans la fiche Property avec gestion Building/Units.
10. Réutilisation des pages et mutations Property existantes pour une Unit.
11. Documentation API, Web et Property Management mise à jour.
12. Tests de tous les niveaux et validations finales.

## Périmètre OUT

- publication, marketplace ou règles de publishability ;
- tarification, conditions commerciales ou promotions nouvelles propres à la composition ;
- disponibilité, réservation, occupation, locataire, contrat ou vente ;
- équipements, amenities, pièces détaillées ou espaces communs ;
- médias, documents, stockage objet ou antivirus ;
- compteurs, consommations, charges, maintenance ou travaux ;
- floors, wings, entrances, parking, boxes ou hiérarchie récursive ;
- type d’usage Unit distinct de `propertyType` ;
- héritage/override automatique de localisation, détails, termes ou ownership ;
- attach d’une Property existante, detach, move/reparent, reorder manuel ou import massif ;
- suppression Building, Unit, relation ou Property ;
- événements d’intégration/outbox ;
- recherche, filtre, total count ou arbre non paginé de composition ;
- modification de type, transaction, status ou rôle structurel par un endpoint générique ;
- refonte générale du portefeuille ou du design system.

## Cas d’usage de démonstration

1. L’utilisateur ouvre une Property autonome depuis le portefeuille.
2. Il crée « Immeuble A » avec le code `BAT-A`; la Property devient un ensemble immobilier.
3. Il crée l’unité `A-101` avec les informations d’une Property.
4. La section affiche l’immeuble et l’unité dans l’ordre contractuel.
5. Il renomme l’immeuble et remplace le code de l’unité.
6. Il ouvre ou modifie les informations de la Unit comme une Property existante.
7. Un second tenant ne peut découvrir ni modifier aucun élément de cette composition.

Ce parcours apporte une valeur visible sans publication, disponibilité ou location.

## Critères d’acceptation proposés pour TASK-051

1. Toutes les Properties historiques sont `STANDALONE` après migration et les APIs existantes restent compatibles.
2. La création du premier Building transitionne atomiquement la Property vers `COMPOSITE`.
3. Une Property `UNIT` ne peut être créée que dans la transaction de création d’une unité sous un Building autorisé.
4. Les relations sont non récursives, tenant-identiques et une Unit possède exactement un Building.
5. Codes canonisés et uniques sont protégés Domain, API et PostgreSQL ; les conflits donnent 409.
6. Les listes Building et Unit sont paginées et ordonnées de façon déterministe sans duplication.
7. Unknown et cross-tenant retournent les mêmes 404 non révélateurs.
8. Les mutations exigent leurs grants avant tout effet et les claims OIDC ne deviennent pas des grants.
9. Les FKs composites, contraintes, transactions et forced RLS empêchent relations orphelines et cross-tenant.
10. Une Unit est une Property publique normale et réutilise core details/terms/ownership sans héritage.
11. Aucun DELETE, reparenting, publication, média, disponibilité ou bail n’est introduit.
12. La fiche Property offre le parcours complet en français et conserve ses résultats lors d’erreurs secondaires.
13. OpenAPI, DTO, mappers et implémentation sont alignés et additifs.
14. Migrations et snapshots Drizzle passent depuis une base vide et sur des Properties existantes synthétiques.
15. Aucun test n’est ignoré dans le résultat final et toutes les gates requises passent.

## Matrice de tests attendue

| Niveau | Preuves minimales |
|---|---|
| Domain | rôles, UUID/date serveur, normalisation/bornes codes et noms, transitions, interdiction de nesting, appartenance et unicité logique |
| Application | grants, tenant unique, create Building, create Unit atomique, update, pagination/limites, 404 et conflits |
| HTTP | routes et payloads stricts, UUID/cursor invalides, 200/201/400/401/403/404/409/500, absence de tenant/rôle autoritatif client |
| Contract | OpenAPI operationIds, bearer, schemas stricts, enums, required/optional, pagination, projection sans tenant/trace |
| PostgreSQL | migration/backfill, FKs composites, unicités, CHECK, indexes, ordre/cursor, RLS forcée, rollback, cross-tenant et concurrence de codes |
| Runtime | parcours create parent→Building→Unit→list/update par la vraie composition PostgreSQL/OIDC synthétique |
| Web | français, loading/vide/succès, formulaires, pagination, bearer, absence d’appel avant session, 401/403/404/409/500, préremplissage et navigation |
| Régression | create/retrieve/update/portfolio Property, Owner directory et Ownership sur standalone, composite et Unit |
| Architecture | frontières service/app, exports, graph, cycles et absence de Domain→framework/persistence |

## Contrats et documentation attendus

- OpenAPI généré et tests golden/contractuels ;
- README `services/property-management` : rôles, invariants, ownership sans héritage et non-objectifs ;
- README API : routes, grants, pagination et erreurs ;
- README Web : parcours français et routes existantes ;
- ADR uniquement si l’implémentation diverge de la décision de frontières ici ou crée un engagement durable non déjà couvert ;
- aucune modification de CURRENT_SPRINT/BACKLOG/PROJECT_CONTEXT sans exigence distincte.

## Commandes de validation finales proposées

```text
corepack pnpm service:property-management:migration:check
corepack pnpm service:property-management:test:integration
corepack pnpm --filter @monpiole/web test
corepack pnpm --filter @monpiole/web build
corepack pnpm -r typecheck
corepack pnpm typecheck:tests
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm test:contract
corepack pnpm app:api:contracts:check
corepack pnpm architecture:check
corepack pnpm test
git diff --check
```

Les suites Testcontainers doivent être exécutées isolément si la concurrence locale déclenche le timeout de hook déjà observé par TASK-049 ; aucun PASS ne doit être revendiqué sans relance réussie.

## Risques et mitigations

| Risque | Mitigation retenue |
|---|---|
| Unit duplique une partie de Property | Unit est une Property ; seule la relation structurelle est nouvelle. |
| Building devient un second actif commercial | Building ne porte ni termes, ownership, publication ni entrée portefeuille. |
| Graphe ou cycles | rôles serveur, profondeur fixe et aucune opération attach/reparent. |
| Fuite tenant | tenant d’autorité, FKs composites, prédicats explicites, transaction tenant et forced RLS. |
| Codes concurrents | parent verrouillé, uniques SQL et traduction déterministe en 409. |
| Collections volumineuses | query ports et pagination keyset, pas d’arbre complet. |
| Adresse répétée sur Units | préremplissage Web, stockage explicite, pas d’héritage caché. |
| Ownership ambigu | ownership uniquement sur Properties, jamais Building, sans propagation. |
| Suppression future dangereuse | aucun DELETE et FKs restrictives dans la première tranche. |
| Scope TASK-051 trop large | aucune suppression, recherche, publication, disponibilité, média, attach ou reorder. |

## Gaps contenus et conditions restantes

- La terminologie doit être validée par Product : « ensemble immobilier », « immeuble » et « unité » sont les libellés français proposés.
- Le pattern uppercase ASCII des codes doit être confirmé avec des exemples métier ivoiriens ; il peut être élargi avant migration, pas silencieusement après contrat.
- Le modèle autorise ownership sur la Property racine et sur les Unit Properties sans héritage. Si un Building doit être juridiquement possédé indépendamment, il devra devenir Property dans une capability ultérieure ; ce besoin n’est pas prouvé aujourd’hui.
- Les unités exigent une localisation complète copiée/préremplie. Un futur héritage d’adresse demandera une migration et une sémantique d’override explicites.
- Le rôle `COMPOSITE` est irréversible dans TASK-051 puisqu’aucune suppression n’existe.
- L’ordre lexicographique des codes ne résout pas naturellement `U-2` avant `U-10`; les conventions de zéro-padding relèvent du Product. Aucun `displayOrder` n’est ajouté sans besoin.
- L’ajout de `structuralRole` aux réponses est additif mais doit être répercuté dans tous les modèles Web et tests contractuels stricts.
- Les gaps TASK-049 sur description vide, stale writes, parsing 2xx, smoke réel et taille du bundle restent non bloquants et hors scope.

Ces trois points sont des décisions de TASK-050, pas des blockers reportés à TASK-051. Une objection explicite lors de la revue propriétaire devra rouvrir la discovery avant code ; en l’absence d’objection, l’implémentation suit ce contrat sans inventer une abstraction générique.

## Dépendances

- capacités Property TASK-034/035/042/044/048 ;
- PropertyOwner/Ownership TASK-037/038/046 ;
- autorité OIDC interne et CORS TASK-040 ;
- PostgreSQL/Drizzle/RLS et transaction tenant de `packages/persistence` ;
- conventions Zod/OpenAPI/Problem Details ;
- shell, client HTTP et composants Web existants.

Aucune nouvelle dépendance npm, service, base ou intégration externe n’est requise.

## Séquence d’implémentation recommandée

1. Valider les trois conditions Product avant code.
2. Définir Domain et tests unitaires des rôles, Building et BuildingUnit.
3. Définir API-first les schémas, projections, curseurs, erreurs et tests contractuels.
4. Créer la migration Drizzle additive, backfill, FKs/RLS/indexes et tests PostgreSQL.
5. Implémenter use cases, ports, adapters et concurrence dans l’ordre de verrouillage défini.
6. Composer NestJS, grants et runtime PostgreSQL ; ajouter tests HTTP/runtime.
7. Intégrer la section Web française et ses tests comportementaux.
8. Régénérer OpenAPI, mettre à jour les README, exécuter toutes les gates et inspecter le diff.

## TASK-051 proposé

### Nom

> **TASK-051 — Property Buildings & Units Composition Vertical Slice**

### Objectif

Permettre à un utilisateur authentifié et autorisé de transformer une Property autonome en ensemble immobilier en créant un Building, puis de créer, consulter et modifier des Unit Properties rattachées à ce Building depuis la fiche Property, avec persistance PostgreSQL/RLS et contrats `/v1` stricts.

### Périmètre

- `structuralRole`, Building et BuildingUnit selon le modèle retenu ;
- create/list/update Buildings et Unit Properties ;
- pagination déterministe et erreurs 400/401/403/404/409/500 ;
- migration/backfill, FKs composites, unicités, traces et forced RLS ;
- grants, runtime PostgreSQL/OIDC, OpenAPI et Problem Details ;
- section Web « Composition du bien » intégralement française ;
- tests Domain/Application, HTTP, contrat, PostgreSQL, runtime, Web et régression ;
- aucun élément du périmètre OUT de TASK-050.

TASK-051 ne doit être créée qu’après approbation de TASK-050 ; le présent document n’est pas une implémentation.

## Verdict final

**GO pour TASK-051 — Property Buildings & Units Composition Vertical Slice.**

Option B est sélectionnée : une Property composée possède des Buildings explicites et chaque Building possède des Units qui sont elles-mêmes des Properties. Ce modèle est non récursif, tenant-safe, compatible avec les capacités Property/Ownership existantes et évite le coût futur d’insérer Building dans une relation directe déjà publique.

Le NO-GO de TASK-049 est levé : terminologie, format des codes, rôles, cardinalités, ownership, héritage, transactions, API, persistance, UX et périmètre sont désormais décidés. Les incertitudes résiduelles sont contenues et explicitement différées ; elles ne bloquent pas la première tranche.
