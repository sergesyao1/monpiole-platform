# TASK-049 — Post-Property Core Information Update Readiness Audit & Next Capability

- **Status:** DONE — READY WITH CONTAINED GAPS
- **Date:** 2026-08-28
- **Repository baseline:** `6459c6c feat(property): add core information update`
- **Exit decision:** GO vers la préparation de Property Composition ; NO-GO pour son implémentation avant clarification du modèle

## Objective

Vérifier la tranche TASK-048 à partir du dépôt exécutable, établir la readiness actuelle du bounded context Property Management et sélectionner une seule prochaine capability sans l’implémenter.

## Audit scope

L’audit couvre :

- `.codex/tasks/TASK-048-property-core-information-update-web-vertical-slice.md` et les audits TASK-043, TASK-045 et TASK-047 ;
- `services/property-management/src/domain/property.ts` ;
- `services/property-management/src/application/update-property-core-information.ts` et `property-authority.ts` ;
- `PostgresPropertyRepository`, le schéma Drizzle, les migrations 0000–0005 et les politiques forced RLS ;
- le contrat Zod, les DTO/mappers, `UpdatePropertyCoreInformationController` et `engineering/contracts/http/openapi.json` ;
- `app.module.ts`, `create-postgres-runtime-composition.ts`, l’adaptation de l’autorité OIDC et le filtrage des grants ;
- le client Property Web, `PropertyCoreInformationForm`, `PropertyDetailPage`, le portefeuille et la gestion des erreurs ;
- les tests Domain/Application, HTTP, OpenAPI, PostgreSQL, runtime et Web ;
- les README API, Web et Property Management ainsi que les ADR/TD de frontières, multi-tenancy, Clean Architecture, OIDC et frontend.

Sont exclus : toute correction des écarts, toute capability métier, migration, modification de contrat, test ou code applicatif.

## Repository baseline inspected

**Fait observé.** Au démarrage, `git status --short` ne produisait aucune sortie. `main` pointait sur :

```text
6459c6c feat(property): add core information update
0175c14 docs(property): audit post-owner-directory readiness
0709786 feat(property): add owner directory and web management
e32eafd docs(property): audit post-portfolio web readiness
8fa24c2 feat(web): add property portfolio discovery
```

Le seul `AGENTS.md` applicable est celui à la racine. Aucun changement utilisateur préexistant n’a été rencontré. Le seul fichier créé par TASK-049 est le présent document.

## Delivered capability assessment

TASK-048 est réellement livrée de bout en bout.

| Comportement | Preuve observée | Évaluation |
|---|---|---|
| Mutation Domain | `Property.updateCoreInformation` | remplace titre, description optionnelle et localisation en réutilisant `validate` |
| Autorisation | `UpdatePropertyCoreInformation.execute` | exige `UPDATE_PROPERTY_CORE_INFORMATION` et exactement un tenant avant accès au repository |
| Persistance | `PostgresPropertyRepository.updateAtomically` | verrouille la ligne, persiste les six colonnes cœur et les traces dans une transaction tenant-scoped |
| HTTP | `PUT /v1/properties/{propertyId}` | contrat de remplacement complet strict ; 200/400/401/403/404/500 |
| Runtime | `createPostgresApiRuntime` | compose le use case avec le repository PostgreSQL réel, sans fallback mémoire |
| Web | `PropertyCoreInformationForm` dans `PropertyDetailPage` | formulaire français, saving, succès, erreurs et conservation des saisies en échec |
| Projection | `PropertyResponseSchema` et portfolio | la réponse de détail et le prochain chargement du portefeuille utilisent les valeurs persistées |

La capability ne modifie pas `propertyId`, `tenantId`, `propertyType`, `transactionType`, `status`, `createdAt`, détails, conditions commerciales ou ownerships. Le test PostgreSQL prouve explicitement la conservation des détails et termes existants.

## Architecture and domain findings

### Faits observés

- Les informations cœur sont exactement `title`, `description?` et `location { country, city, district, addressLine }` dans `PropertyCoreInformation`, le contrat HTTP et le modèle Web.
- `title`, `city`, `district` et `addressLine` sont trimés, requis et limités à 200 caractères. `description` est trimée et limitée à 5 000 caractères. `country` doit déjà être une valeur ASCII majuscule sur deux lettres dans le Domain et l’API ; le Web la met en majuscules avant envoi.
- La mutation est un remplacement complet : `title` et les quatre champs de localisation sont obligatoires. Ce n’est ni un PATCH ni une mise à jour partielle.
- Une `description` absente retire l’ancienne valeur : le Domain enlève explicitement la description précédente avant validation et PostgreSQL écrit `NULL`.
- `PropertyType` reste l’enum `APARTMENT | HOUSE | LAND | COMMERCIAL | OTHER`; `PropertyStatus` reste uniquement `DRAFT`. Ils sont validés à la création/réhydratation et exclus du contrat de mutation.
- Le Domain ne dépend ni de NestJS, ni de Zod, ni de Drizzle. Les dépendances restent orientées vers l’intérieur conformément à ADR-0005.

### Inférences et écarts

- `description: ""` ou uniquement composée d’espaces est valide côté contrat et Domain, puis persistée comme chaîne vide. Le formulaire Web, lui, omet une description vide et provoque `NULL`. Deux représentations sémantiques de « sans description » existent donc selon le client.
- `null` est rejeté pour tous les champs, y compris `description`; cette règle est cohérente avec le contrat optionnel, mais elle n’est pas explicitement testée pour TASK-048.
- Une omission de `description` est destructive par conception. C’est cohérent avec PUT et documenté dans TASK-048, mais un client qui croit effectuer un PATCH peut effacer involontairement la description. Le schéma OpenAPI indique les champs requis et l’optionalité, sans texte descriptif portant cette sémantique de suppression.
- Le verrou PostgreSQL sérialise les mutations concurrentes sur une ligne. Il n’existe toutefois ni version, ni ETag/`If-Match`, ni conflit métier : la dernière écriture validée gagne. L’absence de réponse 409 est donc cohérente avec l’implémentation actuelle, mais ne protège pas deux formulaires ouverts simultanément.

## API, persistence and tenant-isolation findings

### Faits observés

- `UpdatePropertyCoreInformationRequestSchema` est `.strict()` et interdit notamment `tenantId`, `propertyId`, `propertyType`, `transactionType` et `status`.
- Le mapper ajoute uniquement `propertyId`, `correlationId` et l’autorité issus des frontières fiables.
- Le contrôleur résout l’autorité authentifiée avant le use case. Le Web ne transmet aucun tenant.
- `IdentityExternalAuthorityAdapter` attribue le grant au rôle interne `TENANT_ADMINISTRATOR`; `toPropertyAuthority` le filtre explicitement. Aucun scope ou rôle Auth0 n’est converti en autorisation métier.
- La lecture `SELECT ... FOR UPDATE` et l’`UPDATE` portent tous deux les prédicats `tenantId` et `propertyId` dans `withTenantPostgresTransaction`.
- La migration `0000_property_management_baseline.sql` active et force la RLS de `properties`. Aucune migration TASK-048 n’était nécessaire, les colonnes existant déjà. `drizzle-kit check` confirme la cohérence des migrations et snapshots.
- Une Property inconnue et une Property d’un autre tenant convergent vers `PropertyNotFoundError` puis Problem Details 404, sans révélation cross-tenant.
- Les erreurs réellement annoncées sont 400, 401, 403, 404 et 500. Aucun scénario 409 n’existe pour cette opération.

### Compatibilité

L’endpoint est additif. Les contrats create, retrieve, details, portfolio, Owner et Ownership restent inchangés. `PropertyResponseSchema` reste la représentation publique unique de la fiche et exclut tenant, acteur, corrélation et détails de persistance. Le portfolio continue d’utiliser sa projection bornée, avec la nouvelle valeur visible au prochain chargement.

## Web and UX findings

### Faits observés

- Le formulaire utilise des labels associés, un `fieldset` désactivé pendant la sauvegarde, des contraintes HTML et un bouton dont le texte devient « Enregistrement… ».
- Tous les textes ajoutés sont en français. La fiche actualise son titre, sa description, sa localisation et `updatedAt` depuis la réponse 200.
- Une erreur 400/403/500 affiche le feedback existant sans supprimer la Property chargée ni réinitialiser les champs non contrôlés. Une 401 utilise le renouvellement unique du client partagé, puis le comportement de session expirée existant.
- Une réponse 404 à la mutation bascule vers l’état global « Bien introuvable », ce qui est cohérent avec une ressource supprimée ou devenue inaccessible.
- Le formulaire envoie toujours le remplacement complet. Il ne permet pas de modifier type, projet commercial ou statut.
- Le retour vers `/properties` remonte le portefeuille et déclenche un nouveau `GET /v1/properties`; aucun cache applicatif n’empêche de voir les nouvelles valeurs.

### Limites observées

- Aucun test unique n’enchaîne mutation puis navigation vers le portefeuille. La persistance et le rechargement sont prouvés séparément par les tests PostgreSQL/runtime et Web.
- Le client Web ne parse pas les réponses 2xx avec Zod à l’exécution.
- Il n’existe pas de smoke test navigateur réel Auth0/PostgreSQL pour le parcours complet.
- Le build Web réussit mais conserve un chunk JavaScript de 541,36 kB, au-dessus du warning Vite de 500 kB.

## Contract and compatibility findings

OpenAPI 3.1 expose `operationId: updatePropertyCoreInformation`, bearer, UUID de chemin, le schéma strict `UpdatePropertyCoreInformationRequest`, `PropertyResponse` et les Problem Details attendus. Les tests vérifient les champs requis, l’absence des champs autoritatifs, `additionalProperties: false`, les bornes principales et l’alignement des réponses.

Les preuves ne couvrent pas explicitement : `description` absente après une valeur existante, `description: ""`, `description: null`, chaque champ de localisation vide/surdimensionné, ni une mise à jour concurrente. Le comportement résulte clairement du code et des schémas, mais ces cas constituent une dette de preuve contenue.

## Validation commands and exact results

Toutes les commandes ci-dessous ont été exécutées le 2026-08-28 :

| Commande | Résultat exact |
|---|---|
| `corepack pnpm --filter @monpiole/web test` | PASS — 11 fichiers, 63 tests |
| `corepack pnpm test:unit tests/unit/property-management.test.ts` | PASS — 1 fichier, 11 tests |
| `corepack pnpm test:integration tests/integration/api-properties.test.ts tests/integration/api-identity-postgres-runtime.test.ts` | PARTIAL — API 12/12 ; runtime 8 skipped après timeout du hook Testcontainers à 10 s |
| `corepack pnpm test:integration tests/integration/api-identity-postgres-runtime.test.ts` | PASS isolé — 1 fichier, 8 tests |
| `corepack pnpm test:contract tests/contract/property-openapi.test.ts` | PASS — 1 fichier, 7 tests |
| `corepack pnpm service:property-management:test:integration` | PASS — 1 fichier, 25 tests PostgreSQL/Testcontainers |
| `corepack pnpm -r typecheck` | PASS — 9 workspaces applicables |
| `corepack pnpm typecheck:tests` | PASS |
| `corepack pnpm architecture:check` | PASS — workspace, exports, resolver, graph, boundaries, cycles, diagnostics |
| `corepack pnpm service:property-management:migration:check` | PASS — `Everything's fine` |
| `corepack pnpm app:api:contracts:check` | PASS — 12 fichiers, 69 tests |
| `corepack pnpm --filter @monpiole/web build` | PASS — 104 modules ; warning chunk 541,36 kB, 159,68 kB gzip |
| `corepack pnpm test:unit` | PASS — 21 fichiers, 142 tests |
| `corepack pnpm test:integration` | FAIL environnemental — 14 fichiers/120 tests passent ; runtime 8 skipped après timeout du hook Testcontainers à 10 s |
| `corepack pnpm test:contract` | PASS — 12 fichiers, 69 tests |
| `corepack pnpm test` | PASS — 63 fichiers, 454 tests |

Le timeout d’intégration globale est sensible à la concurrence de démarrage des conteneurs, non à une assertion TASK-048 : le même fichier runtime passe 8/8 isolément et la suite globale finale passe 454/454. Cette instabilité reste néanmoins une preuve CI à ne pas masquer.

## Readiness matrix

| Couche | Verdict | Preuves | Limites |
|---|---|---|---|
| Domain/Application TASK-048 | READY | invariants, grant, tenant unique, préservation | sémantique chaîne vide ; last-write-wins |
| PostgreSQL/RLS | READY FOR INTEGRATION | verrou, transaction tenant, forced RLS, 25 tests | pas de version optimiste |
| API/OpenAPI | READY | schéma strict, réponses, contrat 69/69 | suppression par omission peu explicitée ; pas de 409 |
| Runtime/OIDC | READY FOR INTEGRATION | composition réelle et test isolé 8/8 | test global d’intégration sensible au timeout |
| Web/UX | READY WITH CONTAINED GAPS | formulaire, bearer, succès/erreur, 63 tests | pas de test mutation→portfolio ni smoke réel |
| Compatibilité Property | READY | champs structurels, détails, termes et ownerships préservés | aucune composition immobilière |
| CI | READY WITH CONDITION | suite globale 454/454 | commande `test:integration` non déterministe sous charge locale |
| Production | NO-GO | aucun défaut fonctionnel bloquant TASK-048 | observabilité, CSP, backup/restore, HA et smoke Auth0 réel non prouvés |

## Findings classification

### BLOCKER

- **Pour TASK-048 et les parcours privés actuels : aucun blocker fonctionnel découvert.**
- **Pour implémenter directement Property Composition : le langage métier est insuffisant.** Le dépôt ne décide pas si Building et Residence sont des Property types, des conteneurs distincts ou des agrégats ; il ne définit pas les cardinalités, le déplacement d’une Unit, l’héritage de localisation/termes, ni le niveau d’ownership. Inventer ces règles rendrait la modélisation spéculative.

### REQUIRED

Avant une tranche Composition implémentable :

1. approuver le vocabulaire `standalone Property`, `Building`, `Residence`, `Unit` et leurs responsabilités ;
2. fixer cardinalités, cycle de rattachement/détachement et contraintes tenant ;
3. décider quelles entités sont indépendamment gérées, commercialisées et possédées ;
4. décider l’héritage — ou l’absence explicite d’héritage — des informations cœur, détails et conditions commerciales ;
5. définir la plus petite journey Web démontrable et son contrat API-first ;
6. préserver la non-divulgation cross-tenant et définir les verrous nécessaires aux changements de composition.

### CONTAINED GAP

- chaîne vide et absence de `description` ne sont pas canonicalisées de la même façon pour tous les clients ;
- sémantique destructive de l’omission de description insuffisamment décrite dans OpenAPI ;
- absence de contrôle de concurrence optimiste et de 409 ;
- dette de tests sur null/vide/suppression et mutation→portfolio ;
- test d’intégration global sensible au timeout Testcontainers, malgré réussite isolée et suite globale ;
- absence de parsing runtime des réponses Web, de smoke navigateur réel et warning de taille du bundle.

Ces écarts ne bloquent pas la capability suivante de discovery/modélisation et ne justifient pas une nouvelle tranche métier TASK-048 bis.

### DEFERRED

- update direct de quote-part, historique et inverse Owner→Properties ;
- déduplication/lifecycle/suppression Owner ;
- publication, média, disponibilité, occupation et bail ;
- historique générique Property et contrôle de concurrence optimiste ;
- amélioration du cache/navigation du portefeuille.

### OUT OF SCOPE

- facturation, paiements et workflow générique ;
- marketplace/search public ;
- cadastral, usufruit, succession ou ownership juridique générique ;
- intégrations externes de stockage, géocodage ou CRM ;
- readiness opérationnelle de production.

## Candidate capability comparison

| Candidate | Valeur utilisateur | Fondations disponibles | Lacunes/dépendances | Risque et taille | Décision |
|---|---|---|---|---|---|
| **Building/Units Composition** | représente un immeuble multi-lots et des unités indépendamment gérées ; débloque ownership, disponibilité et publication au bon niveau | Property complète, portfolio, détail, Owner/Ownership, PostgreSQL/RLS, grants, Web | vocabulaire, rôles, cardinalités, héritage et niveau d’ownership non décidés | élevée si implémentée sans discovery ; bornable après décision | **Sélectionnée, avec préalable obligatoire** |
| Property Publication | rendrait un bien visible hors portefeuille privé | Property DRAFT, informations cœur, détails, termes, Web | publishability, audience, média, disponibilité et niveau Building/Unit absents | prématurée et susceptible de publier le mauvais niveau | DEFERRED |
| Média/galerie documentaire | enrichit une fiche et prépare une annonce | fiche Web, auth, tenant | stockage objet, upload, antivirus, ACL, ordre et lifecycle inexistants ; sujet Unit non résolu | nouveau sous-système transversal | DEFERRED |
| Ownership share update | évite remove/reassign d’une quote-part | relation, verrou Property, UI | historique/concurrence et sémantique d’audit à décider | petite à moyenne, valeur contenue | crédible mais non structurante |
| Owner → Properties | navigation inverse utile | index ownership et annuaire | query/API/UI à ajouter | petite à moyenne | amélioration ultérieure |
| Disponibilité/occupation | prépare la location | termes commerciaux | ressource porteuse et temporalité indéfinies ; dépend de Unit | prématurée | DEFERRED |

## Readiness verdict

**TASK-048 : READY WITH CONTAINED GAPS.** Les comportements annoncés sont alignés entre Domain, API, PostgreSQL, runtime et Web. Les validations ciblées et la suite globale finale passent. Aucun défaut observé n’exige une correction avant de poursuivre la conception produit.

**Property Management : READY pour sélectionner Composition, NOT READY pour coder immédiatement son modèle.** Les capacités privées actuelles sont cohérentes et démontrables, mais le dépôt ne contient toujours pas les décisions métier requises pour une hiérarchie immobilière sûre.

## Decision

La seule prochaine capability sélectionnée est **Property Composition / Building & Units**.

Cette décision repose sur les faits suivants :

- toutes les lacunes plus proches du parcours actuel — portefeuille Web, annuaire Owner, sélection Owner et correction des informations cœur — sont désormais fermées ;
- la Property actuelle ne représente qu’un actif autonome et ne peut modéliser un bâtiment contenant plusieurs actifs commercialisables ;
- publication, disponibilité, occupation et futurs baux doivent cibler le bon niveau immobilier ;
- avancer sur ces lifecycles avant Composition risquerait des contrats et migrations à reprendre.

La préférence historique est donc confirmée sur la capability, mais pas comme autorisation d’inventer son modèle. Un préalable de discovery/decision est nécessaire.

## Selected next task

> **TASK-050 — Property Composition Domain Discovery & Vertical Slice Definition**

TASK-050 est un préalable de décision borné à la capability sélectionnée. Il ne doit pas implémenter Building, Residence ou Unit. Son résultat doit être un contrat métier et une définition de tranche verticale suffisamment précis pour autoriser — ou refuser — l’implémentation suivante.

## Expected scope of TASK-050

- documenter des cas réels minimaux : maison autonome, appartement autonome, bâtiment multi-unités, résidence et unité indépendamment gérée ;
- fixer le vocabulaire et les frontières d’agrégats ;
- décider les rôles structurels et cardinalités sans confondre type physique et rôle de composition ;
- décider création, rattachement, détachement/déplacement et règles de suppression éventuelles ;
- décider le niveau d’ownership et l’absence ou les règles d’héritage ;
- définir la projection portefeuille/détail et la navigation Web française ;
- proposer le contrat API, les grants, la persistence/RLS, la stratégie de verrouillage et de migration ;
- définir une première journey verticale petite et démontrable ;
- produire un verdict GO / GO WITH CONDITIONS / NO-GO pour l’implémentation Composition.

Critères de sortie initiaux : chaque cas doit avoir une représentation non ambiguë, aucune relation cross-tenant ne doit être possible, les propriétés standalone existantes doivent rester compatibles, et l’ownership existante doit conserver une signification explicite.

## Explicitly deferred from TASK-050

- code, migration, endpoint ou UI Building/Unit ;
- publication et marketplace ;
- médias/documents ;
- disponibilité, occupation, bail, paiement ou facturation ;
- héritage générique ou moteur de workflow ;
- cadastral ou ownership juridique avancée.

## Exit decision

**GO vers TASK-050 — Property Composition Domain Discovery & Vertical Slice Definition.**

**NO-GO pour une implémentation directe de Property Composition tant que les éléments REQUIRED ne sont pas approuvés.** Ce choix sélectionne une seule capability, ferme le risque de modélisation spéculative et maintient Publication explicitement différée.
