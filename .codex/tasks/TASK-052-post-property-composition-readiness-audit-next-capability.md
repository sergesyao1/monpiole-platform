# TASK-052 — Post-Property-Composition Readiness Audit & Next Capability

- **Statut :** DONE — NOT READY
- **Date :** 2026-08-29
- **Commit audité :** `d8607d7 feat(property): add buildings and units composition`
- **Nature :** audit de readiness et décision de séquencement ; aucune correction fonctionnelle
- **Verdict :** **NOT READY**
- **Décision de sortie :** **GO WITH CONDITIONS** vers une tranche de récupération de readiness de Property Composition ; **NO-GO** pour Publication directe

## Résumé exécutif

TASK-051 livre une base exécutable réelle : rôles `STANDALONE`, `COMPOSITE` et `UNIT`, six routes `/v1`, création atomique Building/Unit, PostgreSQL tenant-scoped, forced RLS, clés composites, pagination keyset, grants internes et une section Web française. Les validations finales passent, y compris PostgreSQL `30/30`, intégration `136/136` et suite globale `476/476`.

Cette base ne satisfait toutefois pas plusieurs exigences normatives de TASK-050 que TASK-051 déclare closes :

1. le contrat OpenAPI des six routes ne publie que les réponses de succès, omet les Problem Details et headers attendus, et expose sur chaque opération des paramètres de chemin optionnels qui ne correspondent pas toujours à l'URL ;
2. aucun test de contrat Composition ne détecte ces divergences, malgré une suite contractuelle verte à `69/69` ;
3. le parcours Web ne rend pas le rôle structurel, ne l'actualise pas après le premier Building, ne permet pas de modifier la localisation préremplie d'une Unit et n'affiche pas le résumé Unit normatif ; plusieurs états vide/erreur/retry obligatoires sont absents ;
4. l'invariant « une Property `UNIT` est créée uniquement sous un Building et possède exactement un parent » n'est pas fermé à toutes les frontières internes : le factory public `Property.create` accepte encore un rôle arbitraire, `PropertyRepository.save` peut le persister, la base accepte une ligne `UNIT` sans relation, et aucun modèle Domain `BuildingUnit` ne réhydrate/valide la relation ;
5. la migration 0006 est exécutable et la RLS est forcée, mais le journal référence 0006 sans `0006_snapshot.json` et aucun test dédié ne prouve une montée 0005→0006 avec Properties historiques ;
6. les preuves annoncées sont plus larges que les tests réellement ajoutés : pas de test contractuel Composition, pas de parcours runtime PostgreSQL/OIDC Composition, pas de preuve dédiée des grants/autorités ambiguës, de la concurrence Unit, des mutations cross-tenant de composition ou de la réutilisation details/terms/ownership par une Unit.

Ces écarts touchent le contrat public, le parcours utilisateur et des invariants structurants. Ils ne sont donc pas une dette contenue compatible avec un verdict `READY WITH CONTAINED GAPS`. **Property Composition est NOT READY pour servir de fondation à une nouvelle capability métier.**

La publication immobilière demeure l'objectif métier aval le plus logique, mais elle n'est pas sélectionnée pour implémentation : avancer maintenant figerait une frontière Property/Unit dont le contrat et l'expérience ne sont pas conformes. La prochaine tranche doit terminer la capability en cours.

## Périmètre et méthode

### Inclus

- comparaison de chaque exigence, critère d'acceptation et exclusion de TASK-050 avec TASK-051 et le code livré ;
- inspection intégrale du commit `d8607d7`, de la migration 0006, du schéma Drizzle, des repositories, des transactions et des politiques RLS ;
- inspection Domain/Application, des six routes, DTO Zod, curseurs, Problem Details, OpenAPI et grants ;
- inspection de la section Web, du client HTTP, des modèles et des tests ;
- vérification des régressions Property, Owner et Ownership ;
- exécution des gates réellement définies par le dépôt ;
- comparaison des prochaines capabilities à partir du roadmap, du backlog, des audits et du code réels.

### Exclus

- toute correction des écarts ;
- toute implémentation de TASK-053 ou de Publication ;
- toute migration, évolution de contrat ou ajout de test ;
- tout commit, push ou changement hors du présent document.

### Règle de preuve

Les documents de tâche décrivent l'intention et les résultats historiques. Le code, les migrations, l'artefact OpenAPI généré et les tests exécutables déterminent le verdict. Un comportement évident par inspection mais non testé est distingué d'une preuve automatisée. Une suite verte ne compense pas un comportement normatif absent de sa matrice de tests.

## État Git et baseline

Au début de l'audit :

```text
git status --short
<aucune sortie>

git branch --show-current
main

git log -5 --oneline
d8607d7 feat(property): add buildings and units composition
8f6218f docs(property): define buildings and units composition
afd9afb docs(property): audit core information update readiness
6459c6c feat(property): add core information update
0175c14 docs(property): audit post-owner-directory readiness
```

Le worktree était donc propre, sur `main`, au commit demandé. Le seul `AGENTS.md` applicable est celui de la racine.

## Preuves inspectées

### Gouvernance, trajectoire et décisions

- `AGENTS.md`, `README.md`, `ROADMAP.md`, `BACKLOG.md` ;
- TASK-043, TASK-045, TASK-047, TASK-049, TASK-050 et TASK-051 ;
- ADR-0003 API/Event Contracts, ADR-0004 Multi-Tenant Context, ADR-0005 Clean Architecture/DDD, ADR-0006 Bounded Contexts et ADR-0007 Managed OIDC ;
- TD-006 Zod/OpenAPI, TD-008 PostgreSQL/Drizzle, TD-013 Web, TD-014 OIDC Web et TD-015 session cache ;
- README de `services/property-management`, `apps/api` et `apps/web`.

Le roadmap reste générique et le backlog ne contient aucune entrée Property. Le séquencement produit exploitable vient donc des tâches/audits approuvés et de l'état réel du code, pas d'une entrée roadmap détaillée inventée.

### Commit TASK-051

`git show --stat --summary d8607d7` observe 45 fichiers, 1 559 insertions et 21 suppressions. Le commit ajoute notamment :

- `property-building.ts`, les use cases/ports Composition et l'adapter PostgreSQL ;
- `0006_property_composition.sql` et l'entrée journal 0006 ;
- les six routes, schémas/DTO/cursor et 752 lignes OpenAPI générées ;
- la section Web et sept scénarios Composition dans un nouveau fichier de test ;
- deux tests Domain, cinq tests PostgreSQL Composition et cinq groupes de tests HTTP Composition ;
- aucune suite de contrat Composition dédiée et aucun scénario Composition ajouté au runtime PostgreSQL/OIDC.

### Contrats et artefacts

- `engineering/contracts/http/openapi.json` régénéré byte-for-byte ;
- schémas Zod Property et Composition ;
- contrôleur, DTO, cursor et filtre Problem Details ;
- tests contractuels existants, notamment `property-openapi.test.ts` et `openapi-baseline.test.ts`.

## Matrice de conformité TASK-050 / TASK-051

| # | Exigence normative TASK-050 | Preuve observée | Évaluation |
|---:|---|---|---|
| 1 | Properties historiques `STANDALONE`, APIs compatibles | 0006 ajoute `structural_role DEFAULT 'STANDALONE' NOT NULL`; réponses détail/portfolio ajoutent le champ de façon additive | **PARTIEL** — SQL compatible et empty-to-head exécuté, mais aucune preuve dédiée 0005→0006 avec données historiques |
| 2 | Premier Building : transition atomique `STANDALONE → COMPOSITE` | transaction tenant, verrou Property, décision Domain `becomeComposite`, update et insert Building dans la même transaction | **CONFORME** |
| 3 | Unit créée uniquement sous Building dans une transaction | route imbriquée et repository atomique créent Property `UNIT` + relation | **NON CONFORME à la frontière globale** — factory/repository génériques et schéma permettent encore une `UNIT` orpheline via un appel interne |
| 4 | Structure non récursive, tenant-identique, Unit exactement un parent | rôle Unit refuse Building ; FKs tenant-qualifiées ; unique `(tenant_id, unit_property_id)` | **PARTIEL** — la relation créée est sûre, mais l'existence de toute Property `UNIT` n'implique pas une relation |
| 5 | Codes canonicalisés/uniques Domain/API/PostgreSQL, conflit 409 | trim/uppercase Domain, uniques SQL, traduction `23505`, Problem Details runtime 409 | **CONFORME avec gaps** — traduction trop large de toute unicité et absence de contrat 409 OpenAPI |
| 6 | Pagination keyset déterministe sans duplication | indexes et requêtes `(code, id) ASC`, `limit + 1`, curseur opaque, tests PostgreSQL/Web | **CONFORME** — validation interne du `code` de curseur moins stricte que la valeur canonique |
| 7 | Unknown et cross-tenant indistinguables en 404 | tenant d'autorité, prédicats, transactions et forced RLS ; erreurs not-found communes | **CONFORME par code, preuve Composition incomplète** — pas de matrice cross-tenant dédiée aux six opérations |
| 8 | Grants avant effet ; claims OIDC non autoritatifs | `authorizedTenant` est le premier effet des use cases ; grants filtrés et attribués au rôle interne | **CONFORME par inspection** — tests Composition ne couvrent ni grant manquant ni autorité multi-tenant au niveau Application |
| 9 | FKs composites, contraintes, transactions et forced RLS | deux tables, FKs tenant-qualifiées, uniques, checks, `ENABLE` + `FORCE RLS`, transactions | **PARTIEL** — invariant rôle/relation non fermé et couverture RLS Unit/cross-tenant limitée |
| 10 | Unit = Property publique réutilisant core/details/terms/ownership sans héritage | Unit insérée dans `properties`, lisible par les APIs Property ; aucune propagation automatique | **CONFORME par architecture, NON PROUVÉ en régression dédiée** |
| 11 | Aucun DELETE/reparenting/publication/média/disponibilité/bail | aucune route ni mutation correspondante dans le commit | **CONFORME** |
| 12 | Parcours Web complet en français, résultats conservés | création/update/pagination et messages français existent | **NON CONFORME** — rôle, localisation éditable, résumé Unit, vide Unit, retry initial et actualisation COMPOSITE manquent |
| 13 | OpenAPI, DTO, mappers et implémentation alignés/additifs | génération reproductible, six operationIds, bearer et schémas succès | **NON CONFORME** — erreurs/headers absents, paramètres de path invalides/optionnels, aucune preuve contractuelle dédiée |
| 14 | Migrations/snapshots depuis base vide et données historiques | empty-to-head PostgreSQL passe ; journal 0006 présent | **NON CONFORME** — `0006_snapshot.json` absent et upgrade historique non testé |
| 15 | Aucun test ignoré et toutes les gates passent | relances finales : toutes les suites passent, globale `476/476` | **CONFORME pour l'exécution finale**, mais la matrice de comportements est incomplète |

### Exclusions TASK-050

| Exclusion | Résultat |
|---|---|
| DELETE Building/Unit/Property, detach, move, reparent, reorder | absent |
| publication, marketplace, règles de publishability | absent |
| tarification spécifique par Unit, promotions | absent |
| disponibilité, réservation, occupant, locataire, bail, vente workflow | absent |
| médias, documents, équipements, niveaux supplémentaires | absent |
| héritage automatique de localisation, détails, termes ou ownership | absent ; le Web copie la localisation dans la requête |
| attach d'une Property existante, import, recherche/filtre/total count | absent |
| événements d'intégration/outbox | absent |

Le commit respecte donc les non-objectifs. Les blockers viennent de comportements **IN** manquants, pas d'un débordement de scope.

## Domaine et application

### Points conformes

- `PropertyStructuralRole` est orthogonal à `propertyType` et vaut exactement `STANDALONE | COMPOSITE | UNIT`.
- `CreateProperty` force `createStandalone`; `CreatePropertyUnit` utilise `createUnit`.
- `PropertyBuilding` normalise code et nom, valide UUID v4 et instants serveur.
- `becomeComposite` refuse une Unit et rend la transition inverse impossible.
- chaque use case dérive le tenant de `PropertyAuthority` et exige son grant avant repository.
- création Building, création Unit et mises à jour utilisent l'ordre de verrouillage parent → Building → relation.
- création Unit insère Property et relation dans une transaction unique ; un conflit relationnel rollbacke la Property.

### Écart d'invariant structurant

`Property.create` reste public, accepte un `structuralRole` optionnel et permet explicitement `UNIT` ou `COMPOSITE`. `PropertyRepository.save` accepte ensuite tout `Property`. En base, `properties.structural_role='UNIT'` n'impose aucune ligne dans `property_building_units`. La migration empêche une Unit d'avoir deux parents lorsqu'une relation existe, mais n'empêche pas une Unit sans parent.

L'API livrée n'expose pas ce chemin, donc aucun utilisateur HTTP ne crée aujourd'hui une Unit orpheline. L'invariant reste néanmoins ouvert à un futur use case interne du bounded context et aux opérations de migration/administration. TASK-050 demandait une garantie de modèle, pas seulement une convention du contrôleur actuel.

La relation `BuildingUnit` n'existe pas comme entité/Value Object Domain ; `listUnits` restitue `unitCode` directement depuis la ligne sans réhydratation Domain de la relation. Cela réduit la capacité à détecter une corruption persistée et explique l'absence de tests Domain sur appartenance, identité et traces de relation.

### Concurrence et conflits

- les parents sont verrouillés avant unicité, ce qui sérialise les créations Building et Unit dans un même parent ;
- une concurrence de code Building est prouvée ; la concurrence Unit équivalente ne l'est pas ;
- toute violation `23505` dans une opération Building/Unit devient respectivement `PROPERTY_BUILDING_CODE_CONFLICT` ou `PROPERTY_UNIT_CODE_CONFLICT`, y compris une collision d'identifiant/attachement qui ne serait pas un conflit de code ;
- les updates restent last-write-wins sous verrou, sans version/ETag, dette déjà connue et non spécifique à Composition.

## Persistance et multi-tenant

### Migration 0006

La migration :

- ajoute `structural_role` avec backfill implicite sûr par défaut constant ;
- crée `property_buildings` et `property_building_units` ;
- utilise UUID natifs, `NOT NULL`, checks code/nom, PK et uniques tenant-aware ;
- ajoute les FKs composites vers Property et Building en `ON DELETE NO ACTION` ;
- ajoute les indexes alignés sur les deux keysets ;
- active et force la RLS sur les deux tables avec `USING` et `WITH CHECK` tenant ;
- conserve corrélation et acteur sur chaque ligne.

### Écarts migration

- `_journal.json` contient l'entrée 0006, mais `migrations/meta` s'arrête à `0005_snapshot.json` ;
- `drizzle-kit check` répond pourtant `Everything's fine`, donc cette gate ne protège pas contre l'absence du snapshot ;
- le test PostgreSQL applique toutes les migrations à une base vide ; il ne crée pas une Property sous 0005 avant d'appliquer 0006 ;
- aucune stratégie de rollout, durée/lock, rollback/restore ou smoke post-migration de production n'est documentée.

L'absence du snapshot crée un risque d'évolution : une future génération Drizzle peut recalculer les objets Composition à partir d'un snapshot 0005 obsolète ou demander une intervention manuelle non prévue.

### Isolation tenant

Le tenant vient exclusivement de l'autorité ; les six DTO ne l'acceptent pas. Les queries combinent transaction tenant-scoped, prédicat explicite et forced RLS. Les FKs composites interdisent une relation cross-tenant et les ressources d'un autre tenant convergent vers l'absence.

La preuve automatisée Composition reste plus étroite que la promesse : elle teste forced RLS sans contexte sur `property_buildings` et une FK cross-tenant directe, mais pas les six lectures/mutations depuis TENANT_B, ni la RLS de `property_building_units` de façon symétrique.

## API et contrats

### Surface runtime

Les six routes existent et répondent :

```text
POST /v1/properties/{propertyId}/buildings
GET  /v1/properties/{propertyId}/buildings
PUT  /v1/properties/{propertyId}/buildings/{buildingId}
POST /v1/properties/{propertyId}/buildings/{buildingId}/units
GET  /v1/properties/{propertyId}/buildings/{buildingId}/units
PUT  /v1/properties/{propertyId}/buildings/{buildingId}/units/{unitPropertyId}
```

Zod rejette les propriétés inconnues, les UUID/payloads invalides et les limites hors 1–100. Le cursor Base64URL est transmis opaque au Web. Les grants sont explicites et les mappers excluent tenant/acteur/corrélation.

Le filtre runtime traduit effectivement 400, 403, 404, 409 et 500 en Problem Details sûrs. Ce comportement n'est pas publié correctement.

### Défaut du contrat généré

Inspection de l'OpenAPI régénéré :

- chaque opération ne contient que `200` ou `201` ; aucune réponse `400`, `401`, `403`, `404`, `409` ou `500` n'est déclarée ;
- aucun header `X-Correlation-Id` ou `X-Request-Id` n'est déclaré sur les succès ;
- le DTO partagé `CompositionPathDto` ajoute `buildingId` et `unitPropertyId` à toutes les opérations, même lorsque ces placeholders ne sont pas dans l'URL ;
- sur les URLs qui les contiennent, `buildingId` et `unitPropertyId` sont publiés avec `required: false`, alors qu'un paramètre OpenAPI `in: path` doit être requis ;
- `CreateUnitDto.description.maxLength` vaut 2 000, alors que `Property` et les contrats create/update existants acceptent 5 000 ;
- les schémas de réponse code acceptent des minuscules alors que la représentation serveur promise est canonique uppercase.

Les tests contractuels `69/69` ne couvrent aucune de ces opérations. `openapi-baseline.test.ts` prouve seulement que l'artefact généré correspond à l'artefact commité ; il ne prouve pas la complétude sémantique de Composition.

## Web et expérience utilisateur

### Livré

- section « Composition du bien » en français ;
- création et modification Building ;
- chargement paginé et dédupliqué des Buildings/Units ;
- création Unit et modification de `unitCode` ;
- conservation des éléments déjà affichés lors d'un échec de page suivante ;
- formulaires labelisés, `fieldset` disabled, `aria-busy`, `status` et `alert` ;
- liens vers la fiche Property d'une Unit ;
- messages français pour session, 403 et conflits de codes.

### Manquant par rapport à TASK-050

- aucun badge/libellé du rôle structurel dans la fiche ; seules les valeurs Type, Projet et Statut sont affichées ;
- le succès du premier Building n'actualise pas l'objet parent ni un rôle visible en « Ensemble immobilier » ;
- le formulaire Unit ne rend aucun champ de localisation et envoie silencieusement `property.location` : la valeur est préremplie mais pas modifiable ;
- la description optionnelle Unit n'est pas proposée ;
- une Unit listée n'affiche pas son type, son projet commercial ni son adresse ;
- une liste Unit vide ne rend pas « Aucune unité dans cet immeuble » ;
- l'erreur de chargement initial des Buildings n'offre aucun bouton de retry ;
- un 404 Building/Unit utilise le message générique « Ce bien est introuvable », sans feedback local spécifique ;
- aucun test ne prouve le rendu `STANDALONE`, `COMPOSITE` et `UNIT`, le loading explicite, les états vides, 404/500, le retry initial, la localisation modifiable, le résumé Unit ou l'actualisation du rôle.

Le client continue aussi de caster les réponses 2xx sans validation runtime Zod, dette déjà connue.

## Tests et qualité

### Couverture réellement ajoutée pour Composition

| Niveau | Preuve ajoutée | Limites importantes |
|---|---|---|
| Domain | 2 tests | pas de BuildingUnit, bornes complètes, rôle COMPOSITE direct, Unit orpheline, dates/UUID invalides |
| Application | aucune suite fake dédiée | grants, tenant ambigu, not-found et appels sans effet non isolés |
| HTTP | 5 groupes de tests | six routes nominales, strict input, cursor, 401, quelques erreurs ; pas de 500 ni vérification exhaustive des codes Problem |
| Contract | aucune | les défauts OpenAPI restent verts |
| PostgreSQL | 5 tests Composition dans une suite de 30 | nominal/rollback/FK/RLS/pagination/concurrence Building ; pas upgrade, concurrence Unit, matrice cross-tenant, rôle-relation |
| Runtime | aucun parcours Composition ajouté | le fichier runtime est seulement adapté au `TRUNCATE` |
| Web | 7 scénarios dans un fichier | create/update/pagination et quelques erreurs ; états/UX normatifs incomplets |
| Régression | fixtures mises à jour avec `structuralRole` | pas de journey Unit avec details/terms/ownership |

### Interprétation des 476 tests

La suite globale prouve l'absence de régression dans les comportements couverts. Elle ne prouve pas les critères normatifs absents des tests. TASK-051 affirme que les quinze critères sont couverts ; cette affirmation n'est pas soutenue par la matrice ci-dessus.

## Résultats des validations

Toutes les commandes ont été exécutées le 2026-08-29 avec les dépendances verrouillées. Aucun script `lint` n'existe ; aucun lint artificiel n'a été ajouté.

| Commande | Résultat exact final |
|---|---|
| `corepack pnpm -r typecheck` | **PASS** — 9 workspaces avec script ; Web, packages, 3 services et API |
| `corepack pnpm typecheck:tests` | **PASS** |
| `corepack pnpm service:property-management:migration:check` | **PASS** — `Everything's fine` |
| `corepack pnpm test:unit` | **PASS** — 22 fichiers, 144/144 tests |
| `corepack pnpm test:integration` | **PASS final** — 16 fichiers, 136/136 tests |
| `corepack pnpm test:contract` | **PASS** — 12 fichiers, 69/69 tests |
| `corepack pnpm service:property-management:test:integration` | **PASS final** — 1 fichier, 30/30 tests PostgreSQL |
| `corepack pnpm --filter @monpiole/web test` | **PASS** — 12 fichiers, 70/70 tests |
| `corepack pnpm app:api:openapi` | **PASS** — build des 6 workspaces concernés et régénération de `engineering/contracts/http/openapi.json` |
| `corepack pnpm app:api:contracts:check` | **PASS** — 12 fichiers, 69/69 tests |
| `corepack pnpm --filter @monpiole/web build` | **PASS** — 105 modules ; JS 550,32 kB, 161,67 kB gzip ; warning > 500 kB |
| `corepack pnpm architecture:check` | **PASS** — workspace, exports, resolver, graph, boundaries, cycles, diagnostics |
| `corepack pnpm test` | **PASS** — 66 fichiers, 476/476 tests |
| `git diff --check` | **PASS** |

Incidents de validation, sans défaut source final :

- la première exécution sandboxée du typecheck a échoué avant TypeScript avec `EPERM` sur un fichier temporaire pnpm ; la relance autorisée hors sandbox a réussi ;
- avant que Docker Desktop termine son démarrage, `test:integration` a produit 15 fichiers passants, 128 tests passants et 8 skipped, puis a échoué sur `Could not find a working container runtime strategy` ;
- la première exécution isolée PostgreSQL a de même échoué avec 30 skipped ;
- après disponibilité vérifiée de Docker Engine 29.7.2, les deux commandes ont été relancées et ont réussi intégralement ; seuls leurs résultats finaux sont revendiqués comme PASS.

## Exploitabilité, sécurité et dette

### Points positifs

- aucune dépendance, secret, service ou accès cross-context n'est ajouté ;
- corrélation et acteur sont persistés sur les nouvelles lignes et réécrits aux mutations ;
- payloads, tenant et SQL ne sont pas loggés par cette tranche ;
- keyset et indexes évitent les collections non bornées ;
- les nouvelles tables utilisent forced RLS et le runtime role testé n'a pas de bypass ;
- la migration est additive et sans suppression de données.

### Dette requise avant nouvelle capability

- corriger le contrat OpenAPI et ajouter une suite de contrat Composition ;
- fermer l'invariant Unit-parent dans les factories/ports/persistance, ou documenter et tester une garantie équivalente explicite ;
- restaurer la chaîne de snapshot et prouver 0005→0006 ;
- compléter le parcours Web et ses états normatifs ;
- ajouter les preuves Application, runtime, cross-tenant et concurrence Unit manquantes.

### Dette contenue après récupération

- ordre lexicographique des codes et convention de zéro-padding ;
- rôle COMPOSITE irréversible tant qu'aucune suppression n'existe ;
- absence volontaire de delete/move/reparent ;
- absence de contrôle optimiste/ETag ;
- parsing 2xx Web absent ;
- chunk Web de 550,32 kB supérieur au warning Vite ;
- absence de smoke navigateur Auth0/PostgreSQL réel ;
- absence de métriques/logs dédiés aux opérations Composition ;
- root README et certaines décisions historiques restent obsolètes sur l'état d'implémentation global.

### Production

Le résultat n'autorise aucune mise en production. CSP déployée, sauvegarde/restauration, HA, supervision, SLO, migration orchestrée et smoke réel restent non prouvés, comme dans les audits précédents.

## Écarts et risques classés

### BLOCKER

1. **Contrat public Composition invalide/incomplet.** Les erreurs promises sont absentes de l'OpenAPI et les paramètres de path sont publiés de façon incohérente. Un consommateur généré ne reçoit pas le contrat réel et la conformité ADR-0003/TD-006 n'est pas acquise.
2. **Parcours Web normatif incomplet.** La localisation Unit n'est pas modifiable, le rôle/sa transition ne sont pas visibles et le résumé/les états obligatoires manquent. Le cas de démonstration TASK-050 n'est pas livré tel qu'approuvé.

### REQUIRED

1. fermer et tester l'invariant `UNIT` exactement un Building à toutes les frontières internes autorisées ;
2. ajouter `0006_snapshot.json` ou une stratégie Drizzle équivalente approuvée, puis un test previous-to-head ;
3. aligner CreateUnit sur les invariants Property existants, notamment description 5 000 ;
4. ajouter des tests de contrat, Application, runtime, cross-tenant, RLS Unit, concurrence Unit et régression Unit→details/terms/ownership ;
5. réduire la traduction `23505` aux contraintes réellement associées aux conflits de code.

### CONTAINED GAP

- curseur Composition opaque mais payload `code` validé moins strictement que la représentation canonique ;
- message Web 404 trop générique pour une ressource locale ;
- client Web sans parsing 2xx ;
- bundle au-dessus de 500 kB ;
- absence d'observabilité spécifique ;
- documentation racine/TD historique obsolète.

### DEFERRED / INTENTIONNEL

- suppression, detach, move, reparent et reorder ;
- publication, média, disponibilité, occupation et bail ;
- héritage d'adresse/détails/termes/ownership ;
- floors, wings, parking et structure récursive ;
- événements d'intégration ;
- ownership Building.

## Verdict de readiness

### Verdict obligatoire

**NOT READY.**

Le runtime principal fonctionne et toutes les gates passent, mais deux exigences utilisateur/contrat sont absentes et un invariant structurel reste ouvert. Le résultat ne peut pas être classé `READY WITH CONTAINED GAPS`, car les écarts affectent la surface `/v1`, le parcours Web approuvé et la sûreté d'évolution du modèle Unit.

### Readiness par couche

| Couche | Verdict |
|---|---|
| Domain/Application | **NOT READY** — invariant Unit-parent et preuves Application incomplets |
| PostgreSQL/RLS | **READY WITH REQUIRED GAPS** — runtime vert, snapshot/upgrade/role-relation à fermer |
| API runtime | **READY WITH GAPS** — six routes et erreurs fonctionnent |
| OpenAPI/Contract | **NOT READY** |
| Web/UX | **NOT READY** |
| Tests/CI | **GREEN BUT INSUFFICIENT** |
| Production | **NO-GO** |

## Comparaison des capabilities candidates

| Candidate | Valeur | Fondations | Prérequis/gaps | Décision |
|---|---|---|---|---|
| **Property Composition Readiness Recovery** | rend réellement utilisable et contractuelle la capability déjà engagée ; protège les futures Units | implémentation complète par couche, tests et migration existants | blockers précisément localisés et bornables sans nouveau domaine | **SÉLECTIONNÉE** |
| Property Publication Lifecycle | rend un actif visible selon un cycle explicite | `DRAFT`, Property/Unit, détail, termes, auth, Web | Composition non ready ; publishable level, audience, critères, transitions, public projection, unpublish et médias minimaux non décidés | **NO-GO direct** |
| Property Publication Domain Discovery | ferme les questions de Publication sans coder | historique d'audits et composition conceptuelle | préférable après récupération pour fonder la discovery sur un contrat fiable | DEFER après TASK-053 |
| Médias/galerie | prépare une annonce et enrichit la fiche | fiche Web/auth | stockage objet, upload, antivirus, ACL, quotas, ordre/lifecycle absents | PREMATURE |
| Disponibilité/occupation | prépare location/réservation | Unit et termes | temporalité, conflits, ressource et séparation long/court terme indéfinis | PREMATURE |
| Owner → Properties / update de quote-part | amélioration privée utile | ownership et indexes | valeur moins structurante ; historique/concurrence à définir | DEFER |
| Suppression/move Composition | corrige des structures erronées | FKs et rôles | lifecycle, références futures, audit et rôle du dernier Building indéfinis | NO-GO |

Publication reste le prochain **objectif métier aval plausible**, mais le prérequis plus fondamental demandé par cet audit est la complétude de Composition. Elle n'est donc pas sélectionnée automatiquement.

## Capability sélectionnée

**Property Composition Contract, Migration & Web Readiness Recovery.**

Il s'agit de terminer la capability métier TASK-051, non d'ajouter une capability adjacente. La tranche doit être corrective et verticale : modèle/invariant, migration, contrat, runtime, Web et preuves alignés sur TASK-050.

## Décision GO / NO-GO

### Décision pour la capability sélectionnée

**GO WITH CONDITIONS** pour implémenter directement la récupération de readiness.

### Préconditions de TASK-053

1. conserver TASK-050 comme norme et ne pas redéfinir silencieusement son périmètre ;
2. ne pas ajouter Publication, DELETE, move/reparent, média, disponibilité, bail ou événement ;
3. définir avant code la fermeture exacte de l'invariant Unit-parent et la stratégie de snapshot/upgrade ;
4. corriger API et Web ensemble, avec tests faisant échouer les défauts constatés ;
5. exécuter une migration 0005→0006 synthétique, PostgreSQL/RLS/concurrence et runtime réel ;
6. terminer avec toutes les gates vertes, aucun skipped et une revue explicite de l'OpenAPI généré.

### Décision pour Publication

**NO-GO** pour une implémentation directe de Property Publication. Après TASK-053 et un audit vert, Publication devra commencer par une discovery dédiée sur le niveau publiable (`STANDALONE`, racine `COMPOSITE`, `UNIT`), les transitions, la publishability, l'audience, la projection publique, l'unpublish et le minimum média/disponibilité réellement requis.

## Périmètre recommandé de la prochaine tâche

### IN

- rendre impossible ou explicitement invalide toute Property `UNIT` sans relation Building dans les chemins internes supportés ;
- introduire/valider le concept Domain de relation Unit si nécessaire, sans graphe générique ;
- compléter metadata/snapshot 0006 et test 0005→0006 avec Properties historiques ;
- séparer les DTO/path schemas Composition et publier path params requis, Problem Details 400/401/403/404/409/500, bearer et response headers ;
- aligner CreateUnit avec les invariants Property 5 000 et la canonicalisation promise ;
- ajouter les contrats OpenAPI dédiés aux six routes ;
- afficher le rôle français et actualiser `STANDALONE → COMPOSITE` après premier Building ;
- proposer une localisation Unit préremplie mais modifiable et une description optionnelle ;
- afficher code, titre, type, projet et adresse des Units ;
- rendre loading, empty, succès, 401/403/404/409/500 et retry initiaux/secondaires ;
- ajouter tests Domain/Application/HTTP/contract/PostgreSQL/runtime/Web/régression ciblés.

### OUT

- nouvelle hiérarchie, suppression, attach/detach/move/reparent ;
- publication et catalogue public ;
- médias/documents ;
- disponibilité, occupant, bail ou paiement ;
- tarification propre à Composition ;
- héritage automatique ;
- refonte générale du design system ou du bounded context.

## Prochaine tâche exacte

> **TASK-053 — Property Composition Contract, Migration & Web Readiness Recovery**

### Objectif précis

Fermer les blockers de TASK-052 afin que les invariants Unit-parent, la migration 0006, les six contrats `/v1`, le parcours Web français et leur matrice de tests satisfassent intégralement TASK-050, sans introduire Publication ni aucun non-objectif de Composition.

### Critère de sortie

TASK-053 ne sera DONE que si un audit ciblé peut conclure au minimum `READY WITH CONTAINED GAPS`, que l'OpenAPI ne contient plus de path parameter parasite/optionnel, que chaque erreur promise est contractuelle, que le parcours Web normatif est démontré, que 0005→0006 est prouvé, et qu'aucune Unit orpheline n'est possible par les chemins supportés.

## État final attendu du worktree

Le seul changement de TASK-052 doit être :

```text
?? .codex/tasks/TASK-052-post-property-composition-readiness-audit-next-capability.md
```

Commande de staging autorisée après revue, **non exécutée** :

```text
git add -- .codex/tasks/TASK-052-post-property-composition-readiness-audit-next-capability.md
```

## Conclusion

TASK-051 n'est ni vide ni factice : son architecture principale fonctionne, sa persistance est tenant-safe dans les chemins testés et ses suites passent. Mais ses déclarations de complétude dépassent la preuve et le comportement livré sur trois surfaces essentielles : invariants, contrat public et UX.

Le séquencement sûr n'est donc pas « Composition verte → Publication ». Il est :

```text
TASK-051  implémentation Composition
    ↓
TASK-052  audit NOT READY
    ↓
TASK-053  récupération contrat + migration + Web
    ↓
nouvel audit ciblé
    ↓
discovery Publication, si la readiness est acquise
```

Cette décision protège les futures capabilities contre une dette de contrat et de modèle plus coûteuse une fois Publication, disponibilité ou bail construits au niveau Unit.
