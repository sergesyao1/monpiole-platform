# TASK-054 — Post-Property-Composition Recovery Readiness Audit & Next Capability

- **Statut :** DONE — READY WITH CONTAINED GAPS
- **Date :** 2026-08-29
- **Baseline auditée :** `818a2205672d33dcfcd1c4305ffd5f7f2aae46fd` (`fix(property): recover composition readiness`)
- **Verdict :** **READY WITH CONTAINED GAPS**
- **Décision de sortie :** GO vers une discovery de Property Publication ; NO-GO pour une implémentation directe du workflow de publication

## 1. Résumé exécutif

TASK-053 ferme effectivement les écarts bloquants relevés par TASK-052. La tranche Property Composition est maintenant cohérente sur les chemins supportés : un premier Building transforme atomiquement une Property `STANDALONE` en `COMPOSITE`, une Unit est une Property `UNIT` créée atomiquement avec son unique relation à un Building, les listes sont tenant-scoped et déterministes, les six routes `/v1` sont alignées avec l'OpenAPI, le runtime normal utilise PostgreSQL sans fallback mémoire, et le parcours Web français couvre consultation, création et modification.

Les preuves automatisées sont vertes : tests ciblés Domaine/Application `8/8`, API `9/9`, contrat Composition `5/5`, PostgreSQL Property Management `36/36`, runtime PostgreSQL/OIDC `9/9`, Web ciblé `29/29`, Web complet `78/78`, intégration complète `138/138` et suite globale `503/503`. La migration est appliquée depuis une base vide et un test réel couvre explicitement l'upgrade `0005` vers `0006` avec donnée historique.

Aucun `BLOCKER` n'est observé. Deux `CONTAINED GAP` restent réels :

1. `schema.ts` et le snapshot Drizzle `0006` ne représentent pas les contraintes `CHECK`, l'activation RLS ni les policies écrites manuellement dans le SQL ; la base réelle et les tests les imposent, mais la source déclarative et les métadonnées ne décrivent pas tout le schéma live ;
2. le Web permet de créer une Unit avant d'avoir chargé les Units existantes ; après succès, l'état local est marqué chargé avec la seule Unit créée, donc les Units préexistantes restent momentanément masquées jusqu'à « Actualiser les unités ».

Ces écarts ne compromettent ni les invariants persistés ni la discovery suivante. Ils doivent être fermés respectivement avant la prochaine migration Property Management et avant qu'un futur parcours de publication s'appuie sur la sélection ou la complétude visuelle des Units.

La prochaine capability unique sélectionnée est :

> **TASK-055 — Property Publication Domain Discovery & Vertical Slice Definition**

Il n'existe encore aucun contrat produit approuvé qui décide le niveau publiable, la publishability, les transitions, l'audience, la projection publique ou l'unpublish. Une implémentation directe inventerait ces règles. TASK-055 doit les définir sans produire de code.

## 2. Baseline et portée

### État Git initial

L'audit a commencé sur `main`, à la révision complète `818a2205672d33dcfcd1c4305ffd5f7f2aae46fd`.

`git status --short` ne retournait aucune ligne : le worktree était propre et aucune modification préexistante de l'utilisateur n'était présente.

Les dix derniers commits étaient :

```text
818a220 (HEAD -> main) fix(property): recover composition readiness
a3681cd docs(property): audit post-composition readiness
d8607d7 feat(property): add buildings and units composition
8f6218f docs(property): define buildings and units composition
afd9afb docs(property): audit core information update readiness
6459c6c feat(property): add core information update
0175c14 docs(property): audit post-owner-directory readiness
0709786 feat(property): add owner directory and web management
e32eafd docs(property): audit post-portfolio web readiness
8fa24c2 feat(web): add property portfolio discovery
```

### Portée auditée

- contrat normatif TASK-050 ;
- implémentation TASK-051 et audit TASK-052 ;
- récupération TASK-053 et diff complet du commit `818a220` ;
- Domain, Application et ports Property Management ;
- schéma Drizzle, migration SQL `0006`, journal, snapshots et repositories PostgreSQL ;
- contrôleurs NestJS, DTO/Zod, erreurs, OpenAPI et composition runtime ;
- client API authentifié et parcours Web Property Composition ;
- tests unitaires, intégration/API, contrat, PostgreSQL, runtime et Web ;
- documentation de gouvernance, ADR/TD, historique des audits Property, backlog et éléments relatifs à Publication.

### Hors portée

- aucune correction de code, migration, contrat ou test ;
- aucune implémentation de Publication, média, disponibilité, suppression, move/reparent ou bail ;
- aucune décision de déploiement ou affirmation de readiness production ;
- aucun commit et aucun push.

Le commit `818a220` touche 32 fichiers, avec `3 207` insertions et `332` suppressions. Les cinq créations sont le rapport TASK-053, le snapshot `0006`, l'entité de relation `PropertyBuildingUnit`, le test de contrat Composition et le test Application Composition. Dans le dossier des migrations, TASK-053 ajoute uniquement `migrations/meta/0006_snapshot.json` : le SQL `0006_property_composition.sql` et le journal existaient déjà dans TASK-051.

## 3. Preuves examinées

### Décisions et tâches

- `.codex/tasks/TASK-050-property-composition-domain-discovery-vertical-slice-definition.md` ;
- `.codex/tasks/TASK-051-property-buildings-units-composition-vertical-slice.md` ;
- `.codex/tasks/TASK-052-post-property-composition-readiness-audit-next-capability.md` ;
- `.codex/tasks/TASK-053-property-composition-contract-migration-web-readiness-recovery.md` ;
- `engineering/adr/0003-domain-driven-design-strategy.md`, ADR-0004 à ADR-0007 ;
- `engineering/decisions/td-006-api-contract-representation-proposal.md` ;
- `engineering/decisions/td-008-persistence-database-technology-proposal.md` ;
- TD-013, TD-014 et TD-015 pour API/Web/authentification ;
- `engineering/planning/first-product-slice-implementation-readiness.md`, `BACKLOG.md`, `ROADMAP.md` et les audits Property antérieurs.

### Code et contrats

- `services/property-management/src/domain/property.ts` ;
- `services/property-management/src/domain/property-building.ts` ;
- `services/property-management/src/domain/property-building-unit.ts` ;
- `services/property-management/src/application/property-composition.ts` et ses ports ;
- repositories `postgres-property-repository.ts` et `postgres-property-composition-repository.ts` ;
- `services/property-management/src/infrastructure/persistence/postgres/schema.ts` ;
- migrations `0000` à `0006`, `_journal.json`, snapshots `0005` et `0006` ;
- schémas, DTO, curseurs, contrôleur et filtre d'erreurs de l'API ;
- `engineering/contracts/http/openapi.json` ;
- `apps/api/src/composition/create-postgres-runtime-composition.ts`, `app.module.ts` et `main.ts` ;
- `PropertyDetailPage.tsx`, `PropertyCompositionSection.tsx`, `property-api.ts`, `property-errors.ts` et le client HTTP centralisé.

### Preuves exécutables

- tests Domaine/Application ciblés ;
- tests API et OpenAPI ciblés ;
- migration-check Drizzle ;
- tests PostgreSQL réels, dont base vide, upgrade, RLS, rollback et concurrence ;
- test runtime durable PostgreSQL/OIDC ;
- tests Web ciblés et complets ;
- typechecks, architecture, build Web, suites unitaires, intégration, contrat et globale.

## 4. Statut des écarts de TASK-053

| Écart établi par TASK-052 | Correction attendue | Preuve effectivement présente après `818a220` | Classement |
|---|---|---|---|
| Une Unit pouvait être construite/persistée sans relation Domain obligatoire par une frontière générique. | Rendre la relation explicite et fermer les chemins génériques incohérents. | `PropertyBuildingUnit` vérifie tenant, identifiants, rôle `UNIT` et code ; `CreatePropertyUnit` construit relation et Unit ensemble ; `saveStandalone` refuse une Unit ; le chargement générique d'une Unit exige exactement une relation valide ; le rôle ne peut plus être muté par l'update générique. | `CLOSED` |
| Le contrat OpenAPI exposait des path parameters parasites/optionnels, des erreurs incomplètes et n'avait pas de test dédié. | Aligner routes, payloads, statuts, headers, schémas et curseurs. | Trois schémas de path stricts ; six opérations exactes ; erreurs applicables `400/401/403/404/409/500`, les lectures omettant `409` ; headers de trace ; payload Unit strict ; curseurs et codes canoniques ; test dédié `5/5`. | `CLOSED` |
| Le Web ne matérialisait pas le rôle, la transition, la localisation Unit modifiable, le résumé français et les états locaux attendus. | Livrer le parcours normatif TASK-050. | Rôle `STANDALONE/COMPOSITE/UNIT` traduit en français, transition locale après premier Building, localisation/description Unit éditables à la création, résumé français, états vide/chargement/succès/erreur/retry, pagination préservant les résultats ; tests ciblés `29/29`. | `CLOSED` |
| Le snapshot `0006` et la preuve `0005→0006` manquaient. | Ajouter les métadonnées et démontrer empty-to-head/previous-to-head. | Snapshot `0006` chaîné à `0005`; journal continu `0..6`; migration complète appliquée au démarrage du test PostgreSQL ; test d'upgrade avec Property historique, contraintes, index et RLS ; suite PostgreSQL `36/36`. | `CLOSED` |
| L'isolation, le runtime durable, la concurrence Unit et les interactions détails/termes/ownership n'étaient pas suffisamment démontrés. | Ajouter les preuves aux niveaux adaptés. | Tests cross-tenant/RLS Building et Unit, concurrence de codes Building et Unit, rollback, conflits ciblés, runtime après redémarrage et parcours réel racine→Building→Unit→détails/termes→ownership ; suites runtime et globale vertes. | `CLOSED` |
| Toute violation PostgreSQL `23505` pouvait devenir à tort un conflit métier de code. | Mapper uniquement les contraintes de code connues. | `uniqueViolationConstraint` inspecte le nom exact ; seules `property_buildings_tenant_property_code_unique` et `property_building_units_tenant_building_code_unique` sont traduites ; une collision d'identifiant n'est pas masquée. | `CLOSED` |

TASK-053 a donc corrigé les blockers qu'il revendique. Les gaps résiduels des sections 6 et 8 sont distincts et bornés ; ils ne réouvrent pas les constats ci-dessus.

## 5. Audit Domaine et Application

### Modèle et invariants

| Comportement | État constaté |
|---|---|
| Property simple | `Property.create` délègue à la création `STANDALONE`; les données historiques migrent avec ce rôle par défaut. |
| Passage en ensemble | La création du premier Building appelle `becomeComposite`; la transition `STANDALONE→COMPOSITE` est atomique et idempotente pour un parent déjà composite. Une `UNIT` ne peut pas devenir composite. |
| Building | Entité structurelle non-Property, UUIDs et timestamps validés, code trimé/canonisé en ASCII majuscule de 1 à 50 caractères, nom non vide borné. |
| Unit | Property complète avec rôle `UNIT`; elle porte titre, type, projet commercial, localisation et éventuellement description. Elle ne peut être créée que dans le use case Composition. |
| Relation | `PropertyBuildingUnit` exige la concordance tenant/identifiant avec la Property `UNIT` et représente l'appartenance unique à un Building. |
| Cardinalité | Une racine a un ou plusieurs Buildings après sa transition ; un Building peut avoir zéro ou plusieurs Units ; une Unit a exactement un Building par frontière supportée et unicité `(tenant_id, unit_property_id)`. |
| Non-récursivité | Aucun Building sous une Unit, aucune Unit parent, aucun attach/detach/move/reparent. |
| Mutations | Building : code et nom. Unit : code structurel ; les autres informations restent modifiables par les capabilities Property existantes. Aucun DELETE n'est exposé ou simulé. |
| Ordre | Buildings par `(buildingCode ASC, buildingId ASC)` ; Units par `(unitCode ASC, unitPropertyId ASC)` ; pagination keyset `limit + 1`, curseur opaque au transport. |
| Doublons | Codes Building uniques dans la racine ; codes Unit uniques dans le Building ; normalisation avant persistance ; erreurs métier distinctes. |

### Cas d'usage et protections

Les cinq grants métier sont résolus avant lecture ou effet : `CREATE_PROPERTY_BUILDING`, `RETRIEVE_PROPERTY_COMPOSITION`, `UPDATE_PROPERTY_BUILDING`, `CREATE_PROPERTY_UNIT` et `UPDATE_PROPERTY_UNIT_STRUCTURE`. `authorizedTenant` dérive le tenant de l'autorité interne ; aucune commande ne l'accepte depuis le payload.

Les créations et mises à jour passent par des ports Application. La création Building verrouille le parent, applique la transition et insère le Building dans la même transaction. La création Unit valide d'abord la relation en Domain puis verrouille racine et Building avant les deux inserts atomiques. Les erreurs de parent/Building/Unit absent restent non révélatrices entre inconnu et cross-tenant.

Le repository générique est maintenant explicitement `saveStandalone`. Il refuse les rôles non autonomes, valide la relation lors du chargement d'une Unit et empêche une mutation générique du rôle. Cela ferme le changement partiel précédemment possible par les chemins supportés.

### Frontières d'architecture

Domain et Application ne dépendent ni de NestJS, ni de Drizzle, ni de React. Drizzle/`pg` restent en Infrastructure ; Zod/NestJS et la traduction HTTP restent dans l'application edge ; React consomme les contrats HTTP. Le contrôle d'architecture passe et ne signale ni cycle ni violation de frontière.

Le modèle couvre le périmètre TASK-050 sans extension spéculative : aucune suppression, récursivité, publication, disponibilité, média, propagation d'ownership ou nouvel événement n'a été ajouté.

## 6. Audit PostgreSQL et migrations

### Migration et reconstruction

Le journal est continu :

```text
0 0000_property_management_baseline
1 0001_property_management_baseline
2 0002_property_management_baseline
3 0003_property_management_baseline
4 0004_property_management_baseline
5 0005_property_management_baseline
6 0006_property_composition
```

Le snapshot `0006` a l'identifiant `7c39dee4-1914-4255-9694-7de090930ab0` et référence exactement le snapshot `0005` `711d7863-ffcf-4f4c-990b-ad268e2049ad`.

`0006_property_composition.sql` :

- ajoute `properties.structural_role NOT NULL DEFAULT 'STANDALONE'` et son `CHECK` fermé ;
- crée `property_buildings` et `property_building_units` ;
- pose PK, FKs composites tenant-aware et uniques locales ;
- ajoute les index suivant les ordres de liste ;
- active et force RLS sur les deux tables ;
- crée les policies tenant fondées sur `app.tenant_id`.

Le `beforeAll` de `postgres-property-repository.test.ts` applique toutes les migrations à une base PostgreSQL 18 vide. Le test d'upgrade construit un dossier temporaire limité à `0000..0005`, insère une Property historique sans `structural_role`, applique ensuite le dossier complet et vérifie : rôle `STANDALONE`, contraintes, index, RLS forcée et policies. Les fichiers temporaires sont supprimés dans le `finally`.

Les repositories ouvrent des transactions tenant-scoped, combinent prédicats explicites et RLS, verrouillent les parents dans un ordre déterministe et traduisent seulement les uniques de code prévues. Les tests réels couvrent rollback, références cross-tenant, accès hors contexte RLS, pagination et courses concurrentes Building/Unit.

### Limite intentionnelle de l'invariant inter-table

PostgreSQL ne possède pas de trigger affirmant qu'une ligne `properties.structural_role='UNIT'` a exactement une relation, ni qu'une relation cible une Property `UNIT`. TASK-050 a explicitement retenu l'invariant dans le repository sous verrous plutôt qu'un trigger. Les écritures et chargements supportés le protègent ; les FKs et uniques protègent identité, tenant et cardinalité. Une écriture SQL privilégiée hors de ces frontières peut encore produire une corruption et relève d'une opération administrative/migration gouvernée, pas d'un chemin produit.

### Divergence déclarative résiduelle

`schema.ts` décrit colonnes, PK, FKs, uniques et index, mais n'importe ni ne déclare `check`/policy/RLS. Le snapshot `0006` contient pour `properties`, `property_buildings` et `property_building_units` :

```json
"policies": {},
"checkConstraints": {},
"isRLSEnabled": false
```

Le SQL versionné contient pourtant les `CHECK`, `ENABLE/FORCE ROW LEVEL SECURITY` et `CREATE POLICY`. La même omission existait déjà pour `properties` dans le snapshot `0005`, ce qui montre une convention historique plutôt qu'une régression propre à TASK-053. Néanmoins TD-008 qualifie les déclarations TypeScript Drizzle de source Infrastructure et exige la revue des contraintes/RLS ainsi que la détection de drift.

`drizzle-kit check` valide la cohérence interne des métadonnées, et les tests PostgreSQL prouvent le schéma live, mais aucune de ces deux preuves ne fait du snapshot une description complète des objets SQL manuels. Ce constat est `CONTAINED GAP` CG-01 : risque moyen lors d'une future génération ou revue de migration, non bloquant pour le comportement actuel. Il doit être fermé ou explicitement gouverné avant la prochaine migration Property Management.

## 7. Audit API, OpenAPI et runtime

### Surface HTTP réelle

| Méthode | Route | Succès | Grant |
|---|---|---:|---|
| `POST` | `/v1/properties/{propertyId}/buildings` | `201` | `CREATE_PROPERTY_BUILDING` |
| `GET` | `/v1/properties/{propertyId}/buildings` | `200` | `RETRIEVE_PROPERTY_COMPOSITION` |
| `PUT` | `/v1/properties/{propertyId}/buildings/{buildingId}` | `200` | `UPDATE_PROPERTY_BUILDING` |
| `POST` | `/v1/properties/{propertyId}/buildings/{buildingId}/units` | `201` | `CREATE_PROPERTY_UNIT` |
| `GET` | `/v1/properties/{propertyId}/buildings/{buildingId}/units` | `200` | `RETRIEVE_PROPERTY_COMPOSITION` |
| `PUT` | `/v1/properties/{propertyId}/buildings/{buildingId}/units/{unitPropertyId}` | `200` | `UPDATE_PROPERTY_UNIT_STRUCTURE` |

Les trois schémas de path sont stricts et non interchangeables. Les mutations sont strictes, n'acceptent aucun tenant, les codes d'entrée tolèrent la casse puis sont canonisés, les réponses et curseurs n'acceptent que la forme canonique. La description Unit est optionnelle et bornée à 5 000 caractères ; type, projet commercial et localisation sont requis à la création.

Chaque succès et chaque Problem Details déclare `X-Correlation-Id` et `X-Request-Id`. Les mutations documentent `400`, `401`, `403`, `404`, `409`, `500`; les lectures documentent les mêmes erreurs hors `409`. Les erreurs Domain/Application sont adaptées vers des codes stables sans exposer tenant, SQL ou trace interne. Les absences et accès cross-tenant convergent vers `404`.

L'artefact `engineering/contracts/http/openapi.json` a été régénéré sans diff Git. Le test dédié verrouille les six operationIds, les seuls paramètres présents dans chaque URL, leur caractère requis, les statuts exacts, media types, références de succès, Problem Details, headers, payload Unit, canonicité des codes et curseurs. Les tests HTTP exécutent succès et erreurs de validation/authentification/autorisation/not-found/conflit/500 sûr.

### Composition runtime

`main.ts` appelle `createPostgresApiRuntime`. Cette composition crée `PostgresPropertyRepository` et `PostgresPropertyCompositionRepository`, puis injecte les six use cases. Le placeholder `unavailableComposition` de `app.module.ts` échoue explicitement si une composition de test/incomplète omet ces providers ; il ne persiste rien en mémoire et ne constitue pas un fallback silencieux.

Le test runtime réel crée la racine, le Building et la Unit avec autorité OIDC interne, redémarre la composition runtime puis retrouve la Unit durablement. Un autre parcours couvre détail, termes commerciaux et ownership de la Unit. La propagation de l'autorité authentifiée et du tenant est donc démontrée jusqu'à PostgreSQL.

Verdict de cette surface : **READY**.

## 8. Audit Web

Depuis la fiche Property :

- la composition est chargée via `PropertyApi`, lui-même construit au-dessus du client HTTP authentifié central ; le seul `fetch` métier transite par `apps/web/src/infrastructure/http/api-client.ts` ;
- la section n'est pas affichée pour une Property `UNIT`, ce qui évite de suggérer la récursivité ;
- les libellés de rôle sont « Bien autonome », « Ensemble immobilier » et « Unité » ; le premier Building actualise immédiatement le rôle du parent ;
- Building peut être créé puis modifier son code et son nom ; Unit peut être créée avec description/localisation modifiables puis changer de code ;
- l'UI ne propose ni suppression, ni déplacement, ni rattachement tardif ;
- les listes dédupliquent et trient les résultats ; les pages supplémentaires conservent les données déjà affichées ;
- les états chargement, vide, succès, erreur et retry sont locaux ; les erreurs 401, 403, 404, 409, validation et réseau ont des messages français ;
- chaque Unit rend code, titre, type, projet commercial et adresse en français ;
- labels, legends, `role=status`, `role=alert`, boutons désactivés et media query globale apportent le socle d'accessibilité/responsive attendu.

### Gap de cohérence locale après création Unit

`addUnit` ajoute la réponse au tableau local puis force `loaded: true`. Si l'utilisateur n'a jamais choisi « Afficher les unités », `current[buildingId]` est absent : l'interface montre uniquement la Unit créée et considère la collection chargée, même si des Units existaient déjà en base. « Actualiser les unités » restaure la vue serveur et aucune donnée n'est perdue, mais le résumé immédiat peut être incomplet. Le test de création vérifie le payload et le succès, pas le cas « Units préexistantes non chargées ».

Ce constat est `CONTAINED GAP` CG-02, risque moyen pour la confiance UX mais sans impact de persistance. Avant qu'un workflow de publication utilise la composition visible pour décider ou sélectionner des ressources, il faut soit charger la collection avant création, soit invalider/refetch après succès, avec un test de non-masquage.

### Follow-ups Web non critiques

- les réponses `2xx` sont typées par cast générique mais ne sont pas validées au runtime côté Web (`readResponse` retourne `payload as ResponseBody`) ; les contrats serveur et tests réduisent le risque, sans le supprimer ;
- le chargement initial des Units change le libellé/désactive le bouton, mais `aria-busy` de la section n'inclut pas les états Unit individuels ; une annonce live explicite serait plus robuste ;
- le build produit un chunk JS de `553,64 kB` (`162,33 kB` gzip) et émet l'avertissement Vite supérieur à 500 kB.

Ces points sont des `FOLLOW-UP`, non des blockers de la discovery suivante.

## 9. Résultats des validations

Aucun script `lint` ou `format` n'est déclaré dans le `package.json` racine ou celui du Web ; aucun succès de lint n'est donc revendiqué.

| Commande exacte | Résultat | Preuve / diagnostic |
|---|---|---|
| `corepack pnpm -r typecheck` | `BLOCKED` | Première tentative dans le sandbox : `spawn EPERM`, cause environnementale avant résultat TypeScript ; ni échec TASK-053 ni échec de code. |
| `$env:CI='true'; corepack pnpm -r typecheck` | `PASS` | 9 workspaces exécutés, tous les typechecks terminés sans erreur. |
| `$env:CI='true'; corepack pnpm typecheck:tests` | `PASS` | `tsc --project tsconfig.tests.json` sans erreur. |
| `$env:CI='true'; corepack pnpm architecture:check` | `PASS` | workspace, exports, resolver, graphe, frontières, cycles et diagnostics valides. |
| `$env:CI='true'; corepack pnpm service:property-management:migration:check` | `PASS` | `drizzle-kit check` : `Everything's fine`. |
| `$env:CI='true'; corepack pnpm app:api:openapi` | `PASS` | Build API et dépendances réussi ; artefact régénéré ; `git diff` OpenAPI vide. |
| `$env:CI='true'; corepack pnpm exec vitest run --project contract tests/contract/property-composition-openapi.test.ts` | `PASS` | 1 fichier, 5/5 tests. |
| `$env:CI='true'; corepack pnpm test:contract` | `PASS` | 13 fichiers, 74/74 tests. |
| `$env:CI='true'; corepack pnpm exec vitest run --project unit tests/unit/property-composition.test.ts tests/unit/property-composition-application.test.ts` | `PASS` | 2 fichiers, 8/8 tests Domaine/Application Composition. |
| `$env:CI='true'; corepack pnpm exec vitest run --project integration tests/integration/api-property-composition.test.ts` | `PASS` | 1 fichier, 9/9 tests API Composition. |
| `$env:CI='true'; corepack pnpm service:property-management:test:integration` | `PASS` | 1 fichier, 36/36 tests PostgreSQL, incluant migration et Composition. |
| `$env:CI='true'; corepack pnpm exec vitest run --project integration tests/integration/api-identity-postgres-runtime.test.ts` | `PASS` | 1 fichier, 9/9 tests runtime PostgreSQL/OIDC. |
| `$env:CI='true'; corepack pnpm --filter @monpiole/web exec vitest run src/features/properties/PropertyCompositionSection.test.tsx src/features/properties/PropertyPages.test.tsx` | `PASS` | 2 fichiers, 29/29 tests Web ciblés. |
| `$env:CI='true'; corepack pnpm --filter @monpiole/web test` | `PASS` | 12 fichiers, 78/78 tests Web. |
| `$env:CI='true'; corepack pnpm --filter @monpiole/web build` | `PASS` | Typecheck + build, 105 modules ; avertissement non bloquant sur le chunk JS de 553,64 kB. |
| `$env:CI='true'; corepack pnpm test:unit` | `PASS` | 23 fichiers, 150/150 tests. |
| `$env:CI='true'; corepack pnpm test:integration` | `PASS` | 16 fichiers, 138/138 tests. |
| `$env:CI='true'; corepack pnpm test` | `PASS` | 68 fichiers, 503/503 tests globaux. |

La tentative environnementale bloquée a été rejouée avec les mêmes sources hors de la restriction de spawn et passe. Aucun FAIL fonctionnel n'est observé.

## 10. Matrice des écarts

Chaque constat possède une seule catégorie.

| ID | Catégorie | Description et preuve | Impact | Risque | Décision | Action et moment recommandés |
|---|---|---|---|---|---|---|
| CL-01 | `CLOSED` | Invariant Unit-parent fermé par `PropertyBuildingUnit`, création atomique, `saveStandalone` et validation au chargement/update générique. | Supprime les Units orphelines sur les chemins supportés et les mutations libres de rôle. | Faible résiduel, limité au SQL privilégié hors frontière. | Écart TASK-052 fermé. | Conserver les tests à chaque nouveau chemin d'écriture ; revue avant toute opération admin. |
| CL-02 | `CLOSED` | Six contrats OpenAPI exacts, paths stricts, erreurs/headers/schemas/cursors couverts par 5 tests ciblés et 74 contrats complets. | Client et serveur partagent une surface stable. | Faible. | Écart TASK-052 fermé. | Maintenir le gate de régénération et contrat à chaque changement HTTP. |
| CL-03 | `CLOSED` | Parcours Web normatif, rôle et transition, localisation Unit, résumé français et états locaux présents ; 29/29 ciblés. | Composition exploitable depuis la fiche Property. | Faible hors CG-02. | Écart TASK-052 fermé. | Préserver le test de journey et les libellés français. |
| CL-04 | `CLOSED` | Snapshot `0006`, journal continu, empty-to-head et vrai `0005→0006` avec donnée historique, contraintes/index/RLS. | Migration reproductible et compatible avec l'état antérieur supporté. | Faible sur le SQL appliqué. | Écart TASK-052 fermé. | Garder les deux chemins de migration dans la CI. |
| CL-05 | `CLOSED` | RLS/cross-tenant, rollback, concurrence Unit, runtime durable et interactions Property démontrés. | Readiness verticale étayée au-delà des doubles mémoire. | Faible. | Écart TASK-052 fermé. | Conserver les preuves ciblées dans la suite globale. |
| CL-06 | `CLOSED` | Mapping `23505` limité aux deux contraintes de code ; collision d'identifiant non masquée. | Les erreurs serveur inattendues ne deviennent pas de faux 409 métier. | Faible. | Écart TASK-052 fermé. | Ajouter explicitement chaque future contrainte traduisible. |
| CG-01 | `CONTAINED GAP` | Le SQL contient CHECK/RLS/policies mais `schema.ts` et le snapshot `0006` les omettent et annoncent RLS false. | Drift déclaratif et revue/génération future potentiellement incomplète ; schéma live actuel protégé. | Moyen. | Ne bloque pas la capability de discovery, bloque une nouvelle migration non gouvernée. | Aligner la représentation ou ajouter une convention/gate explicite avant la prochaine migration Property Management. |
| CG-02 | `CONTAINED GAP` | Création Unit avant chargement : état local `loaded: true` avec uniquement la réponse créée ; refresh manuel disponible. | Vue temporairement incomplète, aucune perte de données. | Moyen UX. | Ne bloque ni Composition backend ni discovery Publication. | Invalider/refetch ou charger avant création et tester les Units préexistantes avant tout parcours Publication dépendant de cette vue. |
| FU-01 | `FOLLOW-UP` | Le client Web caste les réponses succès sans validation runtime. | Une dérive serveur non captée à la compilation pourrait atteindre l'UI. | Moyen transversal. | Hors chemin critique actuel. | Choisir une validation de réponses centralisée avant exposition publique ou durcissement client. |
| FU-02 | `FOLLOW-UP` | `aria-busy` de section ne suit pas le chargement Unit individuel, malgré bouton désactivé/libellé dynamique. | Annonce de chargement perfectible pour technologies d'assistance. | Faible. | Socle minimal utilisable ; amélioration recommandée. | Ajouter un statut live ciblé lors du prochain travail Web Composition. |
| FU-03 | `FOLLOW-UP` | Build Web vert avec warning chunk `553,64 kB`. | Performance initiale potentiellement dégradée, sans échec de build. | Faible à moyen selon réseau cible. | Ne bloque pas la discovery. | Budgéter/code-splitter avant readiness production. |
| FU-04 | `FOLLOW-UP` | Aucun smoke navigateur avec Auth0/tenant réels ni preuve déployée CSP, observabilité, backup/restore ou HA. | Production non démontrée. | Élevé pour production, nul pour la prochaine tâche documentaire. | Le GO produit ne vaut pas GO production. | Exécuter les gates opérationnels avant démonstration réelle puis production. |

### BLOCKER

**Aucun.** Aucun constat ouvert n'empêche d'engager la capability de discovery sélectionnée.

## 11. Verdict de readiness

| Surface | Verdict | Justification |
|---|---|---|
| Domaine | `READY` | rôles, cardinalités, non-récursivité, codes et relation Unit-parent protégés sur les frontières supportées ; périmètre TASK-050 respecté. |
| Application | `READY` | autorité avant effets, ports explicites, transactions atomiques, erreurs métier et absence de dépendance framework. |
| Persistance | `READY WITH CONTAINED GAPS` | SQL, migration, upgrade, RLS, contraintes, rollback et concurrence verts ; divergence déclarative CG-01. |
| API et contrats | `READY` | six routes, DTO/Zod, erreurs, headers et OpenAPI alignés, artefact reproductible. |
| Runtime | `READY` | composition PostgreSQL réelle, autorité durable, redémarrage prouvé, aucun fallback mémoire silencieux. |
| Web | `READY WITH CONTAINED GAPS` | journey français complet et testé ; vue locale Unit potentiellement incomplète dans CG-02. |
| Tests et CI locale | `READY` | toutes les validations exécutables critiques passent ; le seul blocage initial était le sandbox `spawn EPERM` et a été rejoué avec succès. |
| Produit, prochaine tranche | `READY` pour discovery | Composition lève le risque de niveau structurel ; le contrat Publication reste à découvrir avant code. |
| Production | `NOT READY` hors verdict TASK-054 | smoke réel, sécurité/opérations et performance ne sont pas démontrés. |

Verdict global exact : **READY WITH CONTAINED GAPS**.

Ce verdict signifie que Property Composition est une tranche verticale exploitable et que le produit peut avancer vers une nouvelle capability de définition. Il ne constitue ni une autorisation de publier des biens ni un GO de production.

## 12. Comparaison des prochaines capabilities

| Candidate | Valeur produit | Prérequis et dépendances | Risque / taille | Décision |
|---|---|---|---|---|
| **Property Publication Domain Discovery & Vertical Slice Definition** | Décide comment une Property devient visible et transforme la fondation privée en prochain contrat produit cohérent. | Property `DRAFT`, détails/termes, ownership, composition, auth et Web existent ; niveau publiable, publishability, audience, projection, transitions et unpublish restent à décider. | Petite à moyenne, documentaire/transversale ; risque réduit car aucune donnée ni API ne change. | **SÉLECTIONNÉE — une seule prochaine capability.** |
| Implémentation directe de Property Publication Workflow | Apporterait immédiatement une action publier/dépublier. | Exige précisément le contrat absent ci-dessus, ainsi que les décisions media/disponibilité et confidentialité de projection. | Grande et fortement irréversible côté état/API/public. | Rejetée maintenant : `NO-GO` avant discovery approuvée. |
| Tranche corrective résiduelle Property Composition | Fermerait CG-01 et CG-02. | Deux corrections indépendantes, aucune ne bloque une tâche documentaire ; CG-01 devient obligatoire avant migration, CG-02 avant dépendance UI Publication. | Petite mais non verticale si groupée artificiellement. | Non sélectionnée ; actions conditionnelles planifiées, pas de TASK corrective dédiée. |
| Property Media / galerie | Enrichit les annonces et peut devenir un critère de publishability. | Besoin média minimal non décidé ; stockage objet, ACL, upload, scan, ordre, quotas et suppression absents. | Grande, nouveau sous-système sécurité/infra. | Différée ; TASK-055 doit décider si un média est requis sans implémenter le stockage. |
| Disponibilité / occupation | Rend les actifs louables ou réservables. | Ressource porteuse désormais modélisable, mais temporalité, conflits, distinction longue/courte durée et publication absents. | Grande, forte concurrence métier. | Différée après contrat Publication et discovery dédiée. |
| Ownership follow-up (100 %, historique, update direct, navigation inverse) | Peut améliorer complétude juridique et ergonomie. | Le modèle actuel autorise volontairement un total inférieur à 100 ; aucune preuve ne rend ces extensions obligatoires. | Moyenne, sémantique juridique à clarifier. | Non imposée ; TASK-055 doit seulement décider si et comment l'ownership participe à la publishability. |

Publication est donc la prochaine direction produit, mais sous la forme d'une discovery/definition. Le dépôt ne contient qu'un statut `DRAFT` fermé et des mentions historiques explicitant l'absence de contrat produit Publication ; ni backlog approuvé ni document métier ne suffit pour coder les transitions.

## 13. Capability sélectionnée

> **TASK-055 — Property Publication Domain Discovery & Vertical Slice Definition**

Cette capability doit répondre à la question : « quelle ressource immobilière un tenant peut-il rendre visible, à quelles conditions, pour quelle audience et avec quel cycle de vie ? »

Elle est sélectionnée parce que :

1. Composition permet maintenant de distinguer sans ambiguïté `STANDALONE`, racine `COMPOSITE`, Building structurel et Property `UNIT` ;
2. informations cœur, détails, conditions commerciales et ownership existent déjà au niveau Property ;
3. l'authentification, les grants, l'isolation tenant, l'API contract-first et la fiche Web fournissent les frontières techniques nécessaires ;
4. l'absence restante est une décision produit, pas une fondation technique à inventer en code ;
5. une discovery transversale peut borner la plus petite future tranche implémentable sans embarquer prématurément catalogue, médias, calendrier ou bail.

Aucune autre capability n'est sélectionnée par TASK-054.

## 14. Définition initiale de la prochaine TASK

### Nom

**TASK-055 — Property Publication Domain Discovery & Vertical Slice Definition**

### Objectif

Produire un contrat métier approuvable et une définition de tranche verticale pour la publication d'une Property, fondés sur les rôles structurels désormais livrés, sans implémenter le workflow.

### Périmètre

- définir le vocabulaire Publication, visibilité, publishability, publier, retirer/dépublier et leurs différences ;
- décider séparément le comportement de `STANDALONE`, racine `COMPOSITE`, Building non-Property et `UNIT` ;
- définir qui initie les transitions, avec quels grants et quel tenant scope ;
- décider les états/transitions autorisés et leurs invariants, sans déduire automatiquement la publication de la présence de champs ;
- définir une matrice de publishability pour informations cœur, détails, conditions commerciales, ownership, composition, média et disponibilité ;
- décider si média et disponibilité sont requis, optionnels ou explicitement différés pour la première tranche ;
- définir la projection privée/publique, les données interdites (owner, tenant interne, traces, adresse trop précise) et l'audience ;
- définir concurrence, idempotence, audit/corrélation, erreurs et comportement cross-tenant/non révélateur ;
- proposer la surface API, les grants, les impacts Domain/persistence/migration/RLS/OpenAPI et le parcours Web français minimal ;
- définir la stratégie de tests et un verdict `GO`, `GO WITH CONDITIONS` ou `NO-GO` pour une implémentation ultérieure.

### Exclusions

- aucun code, migration, endpoint, grant ou écran ;
- aucun catalogue/recherche public complet, ranking, SEO ou analytics ;
- aucun stockage/upload média, antivirus, CDN ou traitement d'image ;
- aucun calendrier de disponibilité, réservation, occupation, candidature, bail, paiement ou billing ;
- aucune suppression, move/reparent ou refonte de Property Composition ;
- aucun contrat d'événement sans consommateur et besoin inter-contextes démontrés ;
- aucune décision de déploiement production.

### Principaux critères d'acceptation

1. Chaque rôle `STANDALONE`, `COMPOSITE`, Building et `UNIT` possède une décision explicite : publiable, non publiable ou publié seulement dans une relation clairement définie.
2. Le cycle de vie et toutes les transitions autorisées/interdites sont nommés avec préconditions, postconditions, idempotence et concurrence.
3. La publishability est une règle métier explicite ; elle distingue champs requis, optionnels et hors sujet sans inventer que l'ownership doit totaliser 100 %.
4. L'audience et la projection publique excluent toute donnée tenant, owner, authentification et trace interne ; la précision d'adresse est décidée.
5. Le comportement d'une racine composite et de ses Units est non ambigu : publication indépendante, groupée ou interdite, avec conséquences sur unpublish.
6. Les besoins minimum média et disponibilité sont décidés pour la première tranche ou explicitement différés avec justification.
7. Autorité, grants, tenant isolation, not-found non révélateur, erreurs, audit et corrélation sont définis.
8. Une première journey Web française et une surface API/OpenAPI minimales sont proposées, sans catalogue public spéculatif.
9. Les impacts de persistance/migration/RLS et la stratégie empty-to-head/previous-to-head sont décrits ; CG-01 est une précondition explicite de toute nouvelle migration.
10. CG-02 est une précondition explicite si la future UI utilise la collection Unit comme entrée ou preuve de publication.
11. Les niveaux unitaires, application, API, contrat, PostgreSQL, runtime et Web à couvrir sont listés.
12. La tâche conclut par un seul verdict de readiness pour une future implémentation, sans l'implémenter.

### Pourquoi cette tranche est cohérente

TASK-055 suit un même comportement métier de bout en bout au niveau de la décision : ressource cible, invariant Domain, autorité Application, état persistant, contrat HTTP, projection publique/privée et journey Web. Elle évite de définir un statut isolé dans Property ou un bouton sans contrat. Son résultat permettra de découper ensuite une tranche d'implémentation réellement verticale, ou de prononcer un NO-GO si les prérequis produit restent indécidables.

## 15. Risques et actions de suivi

| Risque | Action | Échéance/gate |
|---|---|---|
| Une future migration Drizzle ignore ou représente mal les objets SQL manuels. | Fermer CG-01 par alignement déclaratif supporté ou convention/gate live explicite ; vérifier qu'aucun objet n'est supprimé. | Avant toute nouvelle migration Property Management, y compris une migration Publication. |
| Le Web donne une image incomplète des Units après création avant chargement. | Refetch/invalider ou charger avant mutation, et ajouter le scénario avec Units préexistantes. | Avant toute UI Publication dépendant de la liste Unit ; au plus tard dans la prochaine modification Web Composition. |
| Le client accepte une réponse succès invalide. | Introduire une validation runtime centralisée à partir des contrats publics, sans dupliquer les modèles Domain. | Avant une frontière publique ou un durcissement de fiabilité Web. |
| La publication expose trop d'adresse, d'ownership ou de données tenant. | Décider une projection publique minimale et tester les champs interdits. | TASK-055, avant tout endpoint public. |
| Média/disponibilité gonflent artificiellement la première tranche Publication. | Décider leur nécessité minimale et les différer si aucun cas produit ne les rend bloquants. | TASK-055. |
| Bundle et absence de smoke réel masquent des risques de production. | Code splitting, CSP, smoke Auth0/tenant, observabilité, backup/restore et HA. | Avant GO production ; hors TASK-055 sauf contraintes à documenter. |
| La somme d'ownership est supposée devoir faire 100 % sans preuve. | Traiter cette règle comme question de publishability et obtenir validation produit/juridique. | TASK-055 ; aucune migration implicite. |

## 16. Fichiers modifiés par TASK-054

TASK-054 crée uniquement :

```text
.codex/tasks/TASK-054-post-property-composition-recovery-readiness-audit-next-capability.md
```

Aucun code produit, migration, test, contrat, artefact OpenAPI ou autre document n'est modifié par cette tâche. Aucun commit et aucun push ne sont effectués.

## Vérification finale

- verdict relu et conforme aux preuves : `READY WITH CONTAINED GAPS` ;
- blockers : aucun ;
- une seule prochaine capability sélectionnée : TASK-055 discovery/definition de Property Publication ;
- implémentation de la prochaine capability : absente ;
- `git diff --check` : `PASS`, exit `0`, aucune sortie ; le fichier TASK-054 est non suivi et n'entre donc pas dans le diff standard ;
- `git diff --stat` : `PASS`, exit `0`, aucune sortie pour la même raison ; le contrôle complémentaire `git diff --no-index --stat -- NUL <fichier TASK-054>` annonce `1 file changed, 439 insertions(+)` ;
- `git diff --no-index --check -- NUL <fichier TASK-054>` : aucune erreur d'espacement ; exit `1` attendu parce qu'un diff existe contre le fichier nul ;
- `git status --short` : uniquement `?? .codex/tasks/TASK-054-post-property-composition-recovery-readiness-audit-next-capability.md` ;
- commit/push : aucun.
