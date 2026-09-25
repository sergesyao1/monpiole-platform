# TASK-053 — Property Composition Contract, Migration & Web Readiness Recovery

- **Statut :** DONE
- **Date :** 2026-08-29
- **Baseline :** `a3681cd7e02a1e7f1e1e0772c8ba887af32fe37b`
- **Référence d’audit :** TASK-052
- **Nature :** récupération ciblée de readiness de Property Composition
- **Verdict :** **READY** pour réévaluation de la prochaine capability ; Publication reste hors périmètre

## Objectif

Fermer les écarts bloquants identifiés par TASK-052 sans étendre la capability :
contrat HTTP/OpenAPI, invariant Unit-parent aux frontières internes, preuve de
migration `0005 → 0006`, parcours Web normatif et matrice de tests explicite.

## Périmètre livré

### Contrat HTTP et OpenAPI

Les six routes existantes conservent leurs chemins :

```text
POST /v1/properties/{propertyId}/buildings
GET  /v1/properties/{propertyId}/buildings
PUT  /v1/properties/{propertyId}/buildings/{buildingId}
POST /v1/properties/{propertyId}/buildings/{buildingId}/units
GET  /v1/properties/{propertyId}/buildings/{buildingId}/units
PUT  /v1/properties/{propertyId}/buildings/{buildingId}/units/{unitPropertyId}
```

Chaque opération publie uniquement ses paramètres de chemin réels et les marque
requis. Les réponses de succès exposent leurs schémas et headers de traçage. Les
erreurs applicables `400`, `401`, `403`, `404`, `409` et `500` sont documentées
en Problem Details avec `application/problem+json` et les mêmes headers ; les
lectures n’annoncent pas de `409`. Les entrées restent strictes, la description
Unit est alignée à 5 000 caractères, et les codes structuraux des réponses et
curseurs sont canoniques uppercase. L’artefact OpenAPI est régénéré par la
commande officielle.

Une suite contractuelle dédiée verrouille chemins, paramètres, sécurité,
statuses, content types, headers, références Problem Details, schémas stricts et
curseurs. La suite HTTP couvre les six succès et les erreurs applicables, avec
absence de fuite interne dans les réponses sûres.

### Invariant Unit-parent

`Property.create` et le port générique `saveStandalone` ne créent/persistent que
des Properties `STANDALONE`. Une Unit passe exclusivement par
`CreatePropertyUnit`, qui construit une `Property` de rôle `UNIT` et une entité
Domain `PropertyBuildingUnit`, puis les persiste atomiquement sous le verrou du
parent Building.

`PropertyBuildingUnit` valide identités UUID, tenant commun, identité Unit,
rôle `UNIT`, code canonique et instants. Les listes et mises à jour réhydratent
cette relation. Le repository Property générique refuse une mutation de rôle et,
pour toute Unit chargée ou modifiée, exige exactement une relation valide ; une
Unit orpheline ou ambiguë devient une corruption persistée explicite. Aucun
attach tardif, move, detach, delete, transition inverse ou modèle récursif n’est
introduit.

Les garanties SQL existantes restent les clés composites tenant-scoped,
l’unicité d’un parent par Unit, l’unicité de code par Building, les contraintes
de rôle et la forced RLS. Aucun trigger n’est ajouté : la règle inter-table est
fermée dans les frontières supportées et les transactions déjà verrouillées.
Seules les contraintes uniques de code nommées sont traduites en conflits 409 ;
une collision d’identifiant n’est plus masquée comme conflit de code.

### Migration et snapshot

La migration historique `0006_property_composition.sql` et les migrations
`0000` à `0005` restent inchangées. Le snapshot Drizzle officiel
`migrations/meta/0006_snapshot.json` complète le journal existant.

Le test PostgreSQL crée une base d’upgrade séparée, applique `0000` à `0005`,
insère une Property historique, puis applique la tête. Il prouve le backfill
`STANDALONE`, la conservation des données, les clés/contraintes, les indexes de
pagination, l’activation et le forçage RLS, ainsi que les politiques des deux
tables Composition.

### Web

La fiche affiche en français les trois rôles : « Bien autonome », « Ensemble
immobilier » et « Unité ». La création du premier Building actualise
immédiatement le parent en `COMPOSITE`.

Le formulaire Unit préremplit la localisation du parent tout en rendant pays,
ville, quartier et adresse éditables ; la description est également modifiable.
Les Units affichent code, titre, type, projet commercial et adresse en français.
Les états chargement, vide, succès, erreur et retry sont couverts aux niveaux
initial, Building et Unit, sans perdre les résultats déjà chargés.

### Preuves complémentaires

- grants manquants et autorités ambiguës sont refusés avant tout effet ;
- absence parent/Building/Unit reste non révélatrice ;
- mutations et relations cross-tenant sont bloquées par application, FKs et RLS ;
- créations concurrentes Unit conservent une seule valeur de code ;
- le runtime PostgreSQL/OIDC exerce création parent → Building → Unit, lecture,
  mise à jour, details et ownership, puis relecture après redémarrage ;
- les régressions Property, Owner et Ownership restent dans les suites globales.

## Exclusions respectées

Aucune Publication, suppression, move/reparent, attach tardif, récursivité,
héritage automatique, média, disponibilité, bail, occupant, tarification Unit,
recherche Composition, total count ou événement d’intégration n’est ajouté.
Aucune dépendance ou commande lint artificielle n’est introduite.

## Validations

- `corepack pnpm -r typecheck` : PASS, 9 workspaces applicatifs typés ;
- `corepack pnpm typecheck:tests` : PASS ;
- `corepack pnpm service:property-management:migration:check` : PASS,
  `Everything's fine` ;
- preuve `0005 → 0006` : PASS dans la suite PostgreSQL, avec données historiques,
  contraintes, indexes et forced RLS vérifiés ;
- `corepack pnpm test:unit` : PASS, 23 fichiers et 150/150 tests ;
- `corepack pnpm test:integration` : PASS, 16 fichiers et 138/138 tests ;
- `corepack pnpm test:contract` : PASS, 13 fichiers et 74/74 tests, dont la
  suite Composition dédiée 5/5 ;
- `corepack pnpm service:property-management:test:integration` : PASS, 1 fichier
  et 36/36 tests PostgreSQL ;
- runtime PostgreSQL/OIDC ciblé : PASS, 9/9 tests ;
- `corepack pnpm --filter @monpiole/web test` : PASS, 12 fichiers et 78/78 tests,
  dont les deux fichiers ciblés Composition/fiche 29/29 ;
- `corepack pnpm app:api:openapi` : PASS, build des 6 workspaces dépendants et
  régénération officielle de `engineering/contracts/http/openapi.json` ;
- `corepack pnpm app:api:contracts:check` : PASS, 13 fichiers et 74/74 tests ;
- `corepack pnpm --filter @monpiole/web build` : PASS, 105 modules transformés ;
  avertissement non bloquant préexistant pour le chunk JavaScript de 553,64 kB ;
- `corepack pnpm architecture:check` : PASS ;
- `corepack pnpm test` : PASS, 68 fichiers et 503/503 tests ;
- `git diff --check` : PASS.

Le dépôt ne définit aucun script lint et aucun contrôle artificiel n’a été créé.
Les tentatives sandbox de certaines commandes pnpm/Vite ont rencontré le
`spawn/open EPERM` Windows connu ; les mêmes gates relancées hors sandbox ont
terminé avec succès. Aucun test n’est ignoré ou affaibli.

## Résultat

Les cinq familles de blockers de TASK-052 sont fermées dans le périmètre demandé.
Property Composition peut faire l’objet d’un nouvel audit de séquencement ; cette
tâche ne sélectionne ni n’implémente elle-même la Publication.
