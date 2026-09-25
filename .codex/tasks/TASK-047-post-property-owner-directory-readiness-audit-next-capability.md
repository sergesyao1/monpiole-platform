# TASK-047 — Post-Property-Owner-Directory Readiness Audit & Next Capability

- Statut : **DONE — READY WITH CONTAINED GAPS**
- Date : 2026-08-28
- Commit audité : `0709786 feat(property): add owner directory and web management`
- Décision : **GO** vers une seule capacité suivante bornée

## Conclusion exécutive

TASK-046 est réellement livrée. Le parcours Web n’exige plus la saisie manuelle d’un UUID Owner : l’utilisateur peut ouvrir l’annuaire depuis la navigation, rechercher ou créer une personne physique ou morale, revenir au portefeuille, ouvrir un bien et sélectionner l’Owner par son nom avant d’indiquer sa quote-part. Le répertoire est protégé par `LIST_PROPERTY_OWNERS`, dérive son tenant de l’autorité interne, utilise PostgreSQL avec transaction tenant-scoped et forced RLS, et expose une pagination keyset déterministe alignée avec OpenAPI.

Les fondations Property Management forment désormais un parcours privé démontrable : création et découverte des biens, consultation, détails commerciaux, annuaire Owner et ownership. Les preuves automatisées couvrent chaque segment, y compris la composition PostgreSQL réelle. Il n’existe toutefois pas de test navigateur actuel qui enchaîne tout le parcours avec Auth0 et PostgreSQL réels ; cette limite interdit une conclusion de readiness production.

Le prochain incrément recommandé n’est pas encore Building/Units ni publication. Le gap le plus petit et immédiatement observable est l’impossibilité de corriger les informations fondamentales d’un bien après sa création. Le domaine et le Web permettent de modifier les détails physiques et conditions commerciales, mais pas le titre, la description ni la localisation qui alimentent directement le portefeuille.

La capacité recommandée est donc :

> **TASK-048 — Property Core Information Update Web Vertical Slice**

Elle doit autoriser la modification tenant-safe du titre, de la description et de la localisation d’une Property existante, depuis sa fiche Web, sans modifier son type, son projet commercial, son statut ou sa composition.

## Périmètre de l’audit

- tâches TASK-043, TASK-045 et TASK-046 ;
- domaine, application et infrastructure de `services/property-management` ;
- migrations 0000 à 0005, snapshots Drizzle, politiques RLS et tests PostgreSQL ;
- composition runtime et résolution d’autorité de `apps/api` ;
- contrôleurs, DTO, Zod, Problem Details et OpenAPI ;
- routes, navigation, portefeuille, annuaire Owner, formulaires Owner et ownership Web ;
- tests unitaires, HTTP, runtime, contrat, PostgreSQL et Web ;
- README API, Web et Property Management ;
- architecture Clean Architecture/DDD, API-first, multi-tenant et OIDC existante.

Sont hors périmètre de TASK-047 : toute modification fonctionnelle, correction des gaps constatés, contrat, migration, test ou implémentation de TASK-048.

## Baseline Git

**Fait observé.** L’audit a commencé sur `main` au commit attendu :

```text
0709786 feat(property): add owner directory and web management
e32eafd docs(property): audit post-portfolio web readiness
8fa24c2 feat(web): add property portfolio discovery
8ab4b43 docs(property): audit post-portfolio readiness
424b923 feat(property): add portfolio listing and discovery API
5fadd8c feat(web): add property management vertical slice
```

`git status --short` ne produisait aucune sortie avant l’audit. Aucun changement préexistant n’a été rencontré. Le seul fichier créé par TASK-047 est le présent document.

## Capacités désormais disponibles

| Capacité | État observé | Preuve principale |
|---|---|---|
| Créer une Property | Disponible | `Property.create`, `CreateProperty`, `POST /v1/properties`, `CreatePropertyPage.tsx` |
| Consulter une Property | Disponible | `RetrieveProperty`, `GET /v1/properties/{propertyId}`, `PropertyDetailPage.tsx` |
| Découvrir le portefeuille | Disponible | `ListProperties`, query PostgreSQL, `/properties`, pagination et filtres Web |
| Définir détails et conditions commerciales | Disponible | `Property.defineDetails`, `PUT /v1/properties/{propertyId}/details`, `PropertyDetailsForm.tsx` |
| Corriger titre/description/localisation | **Absente** | aucune méthode Domain, use case, route API ou UI ; ces champs ne sont écrits qu’à la création |
| Créer/consulter/modifier un Owner | Disponible | aggregate Owner, POST/GET/PUT et pages `/proprietaires/*` |
| Découvrir les Owners | Disponible | `GET /v1/property-owners`, `ListPropertyOwners`, query PostgreSQL, annuaire Web |
| Affecter/lister/retirer une ownership | Disponible | POST/GET/DELETE sous `/v1/properties/{propertyId}/owners` et `PropertyOwnershipSection.tsx` |
| Affecter sans UUID manuel | Disponible | `<select name="ownerId">` alimenté par `listPropertyOwners`; aucun champ UUID visible de saisie |
| Composition Building/Unit | Absente | aucun rôle, parent, enfant ou invariant de composition |
| Publication, médias, disponibilité, occupation | Absentes | statut Property limité à `DRAFT` et aucun modèle associé |

## Vérification de TASK-046

### Parcours Web réel

**Faits observés.** `ApplicationShell.tsx` expose « Propriétaires » dans la navigation. `routes.tsx` protège `/proprietaires`, `/proprietaires/new` et `/proprietaires/:ownerId` par la même `AuthenticationBoundary` que les biens.

`PropertyOwnerDirectoryPage.tsx` charge 20 Owners, permet une recherche bornée, conserve le curseur opaque, accumule les pages sans doublon par `ownerId`, garde les résultats si une page suivante échoue et distingue portefeuille vide d’une recherche sans résultat. Les cartes présentent les deux variantes avec des libellés français et ouvrent une fiche.

`CreatePropertyOwnerPage.tsx` réutilise `POST /v1/property-owners`; la fiche réutilise GET et PUT et rend le type Owner non modifiable. Les formulaires visibles et leurs erreurs sont en français.

`PropertyOwnershipSection.tsx` ne contient plus de champ « Identifiant du propriétaire ». Il charge au plus 100 Owners via l’annuaire, permet de rechercher, affiche les Owners par nom, désactive ceux déjà affectés et transmet seulement l’`ownerId` sélectionné à l’API. Les cas aucun Owner, aucun résultat, 403/serveur et retry sont explicitement rendus.

**Réponse à la question de parcours.** Oui, un utilisateur peut partir de la navigation, créer ou trouver un Owner, revenir aux biens, trouver une Property dans le portefeuille, ouvrir sa fiche et affecter l’Owner sans connaissance technique. Le parcours demande toutefois plusieurs navigations manuelles : après création d’un Owner, aucun retour contextuel vers la Property d’origine n’est conservé, et le message « Créez-en un depuis l’annuaire » de la section ownership n’est pas un lien direct.

### API et contrat

`GET /v1/property-owners` accepte uniquement :

- `limit` entier 1–100, 20 par défaut ;
- `cursor` opaque de 1–512 caractères ;
- `search` normalisé de 1–100 caractères.

Le curseur canonique encode `(createdAt, ownerId)`. L’ordre PostgreSQL est exactement `createdAt DESC, ownerId DESC`, et l’adapter lit `limit + 1`. La recherche littérale et insensible à la casse couvre prénom, nom, raison sociale, immatriculation et e-mail ; `%`, `_` et `\` sont échappés. Aucun tri ou filtre parallèle n’est inventé côté Web.

Le contrôleur, les DTO et `PropertyOwnerDirectoryResponseSchema` publient la même représentation discriminée que create/get/update. La réponse omet `tenantId`, acteur, corrélation et modèle de persistance. L’OpenAPI généré publie l’opération `listPropertyOwners`, les paramètres bornés, bearer et les réponses 200/400/401/403/500.

### Autorisation, OIDC et tenant

`ListPropertyOwners` appelle `authorizedTenant(authority, "LIST_PROPERTY_OWNERS")`. Un grant absent ou une autorité qui ne porte pas exactement un tenant est rejeté avant la query. `IdentityExternalAuthorityAdapter` attribue ce grant au rôle interne `TENANT_ADMINISTRATOR`; `toPropertyAuthority` le filtre explicitement. Aucun scope ou claim OIDC fourni par le navigateur ne décide de cette permission.

Le Web ne transmet jamais de tenant. `PostgresPropertyOwnerDirectoryQuery` exécute `withTenantPostgresTransaction`, ajoute un prédicat `tenantId` et s’appuie sur la forced RLS créée par `0002_property_management_baseline.sql`. Une paire curseur provenant d’un autre tenant ne change pas le tenant scope et ne peut pas révéler sa ligne.

Les opérations Owner individuelles et les ownerships conservent leurs réponses tenant-safe : les ressources absentes et cross-tenant ne sont pas distinguées publiquement.

### Persistance et migration

La migration `0005_property_management_baseline.sql` ajoute uniquement l’index :

```text
(tenant_id, created_at DESC, owner_id DESC)
```

Le schéma Drizzle, le SQL, `_journal.json` et `0005_snapshot.json` sont alignés. `drizzle-kit check` réussit. Les migrations 0002 et 0003 maintiennent forced RLS, contraintes discriminées Owner, clés composites d’ownership et non-divulgation tenant.

La composition normale `createPostgresApiRuntime` construit réellement `ListPropertyOwners(new PostgresPropertyOwnerDirectoryQuery(pool))`. Aucun fallback mémoire n’est introduit.

## Matrice de readiness par couche

| Couche | Readiness | Éléments prouvés | Limites |
|---|---|---|---|
| Domain Property | **READY WITH GAPS** | création, détails, termes, invariants | aucune mutation du titre/description/localisation ; composition absente |
| Domain PropertyOwner | **READY** | variantes, contacts, type immuable, create/update | pas de lifecycle, déduplication ou suppression, volontairement hors scope |
| PropertyOwnership | **READY WITH CONTAINED GAPS** | affectation, retrait, total ≤100, concurrence | pas d’update de part, historique, inverse Owner→Properties, total 100 obligatoire |
| Application queries | **READY** | grants, tenant unique, bornes et normalisation | recherche privée simple uniquement |
| PostgreSQL/RLS | **READY FOR INTEGRATION** | index, transactions, predicates, forced RLS, Testcontainers | exploitation production/backup/HA non prouvée |
| API/OpenAPI | **READY** | surface additive, Zod strict, Problem Details, bearer | client Web ne valide pas les 2xx à l’exécution |
| Runtime OIDC | **READY FOR INTEGRATION** | autorité externe résolue vers grants internes | Auth0 réel non exécuté dans cet audit |
| Web portfolio | **READY WITH UX DEBT** | recherche, filtres, pagination, création/détail | critères et scroll perdus après navigation |
| Web Owner directory | **READY WITH UX DEBT** | liste, recherche, pagination, create/get/update | critères perdus ; pas de retour contextuel vers une Property |
| Web ownership selector | **READY** | aucun UUID manuel, recherche, déjà affecté, vide et erreurs | première page plafonnée à 100 ; recherche requise au-delà |
| Tests/CI | **READY** | tous les niveaux ciblés passent | pas de navigateur réel ni test unique du parcours complet |
| Production | **NO-GO** | aucune régression fonctionnelle ciblée | CSP déployée, observabilité, sauvegarde/restauration, HA et smoke réel non prouvés |

## Matrice des preuves

| Assertion | Fichier/test |
|---|---|
| Valeurs par défaut, recherche, validation, grant et tenant unique | `tests/unit/property-owner-directory.test.ts` |
| Query, curseur, 400, 401 et 403 HTTP | `tests/integration/api-property-owner-directory.test.ts` |
| Composition PostgreSQL réelle de l’annuaire | `tests/integration/api-identity-postgres-runtime.test.ts` |
| Contrat collection Owner strict | `tests/contract/property-owner-directory-openapi.test.ts` |
| Recherche, ordre, pagination, index et absence de fuite tenant | `services/property-management/tests/postgres-property-repository.test.ts` |
| Annuaire, états, pagination, création et modification Web | `apps/web/src/features/properties/PropertyOwnerPages.test.tsx` |
| Sélecteur, Owner déjà affecté, vide, recherche et 403 | `apps/web/src/features/properties/PropertyPages.test.tsx` |
| Contrat généré | `engineering/contracts/http/openapi.json` |
| Grant OIDC interne | `apps/api/src/composition/identity-external-authority.adapter.ts` |
| Runtime sans fallback | `apps/api/src/composition/create-postgres-runtime-composition.ts` |
| RLS et index | migrations 0002, 0003 et 0005 |

## Blockers constatés

### Pour commencer la capacité suivante recommandée

**Aucun blocker.** Les colonnes, validations de création, repository atomique, patterns de grants, transport, Web et tests existent. TASK-048 peut démarrer après définition API-first de la mutation autorisée.

### Pour une démonstration contrôlée

- exécuter un smoke test navigateur avec PostgreSQL, Auth0, identité externe liée et tenant réel ;
- vérifier visuellement le responsive et le parcours navigation → Owner → Property → affectation.

### Pour la production

- CSP restrictive effectivement servie, notamment en raison du cache OIDC `sessionStorage` documenté par TD-015 ;
- sauvegarde/restauration, haute disponibilité, supervision et objectifs de service ;
- preuve de configuration CORS/Auth0 par environnement ;
- smoke test réel et tests de volumétrie.

Ces blockers opérationnels ne bloquent pas la poursuite du développement produit.

## Éléments requis avant TASK-048

1. Figer comme champs mutables uniquement `title`, `description` et `location`.
2. Réutiliser les bornes et normalisations de création plutôt que créer une validation parallèle.
3. Définir un grant explicite, par exemple `UPDATE_PROPERTY_CORE_INFORMATION`.
4. Définir additivement le contrat HTTP et les réponses 400/401/403/404/500 avant l’implémentation.
5. Conserver l’ID, le tenant, le type, le projet commercial, le statut, les détails, les termes, les ownerships et les timestamps de création.
6. Étendre l’écriture atomique PostgreSQL aux colonnes fondamentales sans migration, sauf preuve contraire issue du contrat final.
7. Mettre à jour la fiche et vérifier que le portefeuille reflète la mutation après rechargement.

## Améliorations non bloquantes

- conserver recherches, pages et position du portefeuille et de l’annuaire dans l’URL ;
- ajouter depuis la section ownership un lien direct vers la création Owner avec retour contextuel ;
- distinguer les messages 404 Property et PropertyOwner : `toPropertyUiError` dit actuellement « Ce bien est introuvable » même depuis `PropertyOwnerDetailPage` ;
- valider les réponses JSON 2xx à la frontière Web ;
- découper le bundle Web, mesuré à 538,92 kB par TASK-046 ;
- ajouter un test navigateur du parcours complet et un audit accessibilité dédié ;
- exposer ultérieurement Owner → Properties si un usage métier le justifie.

## Dette et risques résiduels

- le sélecteur Owner charge au plus 100 résultats et n’expose pas sa propre pagination ; une recherche plus précise est nécessaire au-delà ;
- la recherche `ILIKE %term%` convient au portefeuille privé actuel, sans garantie de performance à grande échelle ;
- aucune gestion de concurrence optimiste n’est exposée aux utilisateurs lors des mises à jour ;
- la suppression/lifecycle Owner, l’historique d’ownership et la mise à jour directe de quote-part sont absents ;
- la structure Building/Unit et le niveau correct d’ownership restent indéterminés ;
- le statut unique `DRAFT` ne constitue pas une publication lifecycle.

## Options de prochaines capacités examinées

| Candidate | Valeur démontrable | Fondations réutilisées | Risque/taille | Arbitrage |
|---|---|---|---|---|
| Mise à jour titre/description/localisation Property | Corrige les erreurs et maintient le portefeuille fiable sans recréer le bien | validations Property, repository atomique, fiche, API/grants/RLS | Petite à moyenne ; pas de migration attendue | **Recommandée** |
| Composition Building/Residence/Unit | Représente les actifs multi-lots et débloque les niveaux de gestion | Property, ownership, portfolio | Grande ; rôles, cardinalités, héritage et niveau d’ownership non décidés | Différée, toujours prématurée sans discovery métier |
| Publication/activation | Rend un bien visible hors portefeuille privé | Property DRAFT, Web et auth | publishability, audience, médias, disponibilité et composition absents | Prématurée |
| Médias/documents | Enrichit les fiches | détail Web et auth | stockage objet, upload, antivirus, ACL et lifecycle à créer | Prématurée |
| Disponibilité/occupation | Prépare l’exploitation locative | termes commerciaux | ressource concernée et temporalité non définies ; dépend de Unit | Prématurée |
| Mise à jour de quote-part Ownership | Évite remove/reassign | aggregate ownership et verrou Property | valeur plus étroite ; historique toujours absent | Crédible mais moins prioritaire |
| Owner → Properties | Facilite la navigation inverse | index `(tenant_id, owner_id)` existant | nouvelle query/API/UI mais ne corrige pas les données Property | Amélioration ultérieure |
| Persistance des critères Web | Améliore la continuité UX | React Router | petite dette UX, pas une capacité métier complète | Non bloquante |
| Bail, paiement, facturation ou workflow | Forte valeur future | presque aucune fondation métier suffisante | nouveaux bounded contexts et risques élevés | Explicitement hors séquence |

## Arbitrage

**Fait observé.** Le modèle Property valide déjà titre, description et adresse à la création, mais ne possède que `defineDetails` comme mutation. `PostgresPropertyRepository.updateAtomically` ne persiste actuellement que détails, termes et traces. `PropertyDetailPage` affiche les informations fondamentales sans formulaire de modification.

**Inférence.** Une erreur de saisie dans le titre ou l’adresse persiste durant toute la vie du bien et pollue immédiatement recherche et cartes du portefeuille. La seule correction possible serait de créer un doublon, car aucune suppression n’existe. Ce gap est plus proche de l’usage actuel et plus borné que l’ajout d’une hiérarchie immobilière.

**Recommandation.** Compléter la mutabilité d’une Property existante avant d’ajouter un nouveau concept structurel. Cette décision ne rend pas Building/Units inutile ; elle évite simplement de laisser un parcours de base incomplet en avançant vers un modèle encore sous-spécifié.

## Capacité recommandée

### TASK-048 — Property Core Information Update Web Vertical Slice

### Périmètre proposé

- méthode Domain explicite pour remplacer titre, description et localisation avec les invariants existants ;
- use case autorisé et tenant-scoped ;
- écriture atomique PostgreSQL et traces `correlationId`/`actorId` ;
- contrat HTTP additif et Zod strict ;
- formulaire français dans la fiche Property ;
- mise à jour immédiate du résumé et cohérence du portefeuille après rechargement ;
- états saving/success/400/401/403/404/500 ;
- tests Domain/Application, HTTP, OpenAPI, PostgreSQL/RLS, runtime et Web.

### Critères d’acceptation initiaux

1. Un utilisateur authentifié avec le grant dédié peut modifier titre, description et localisation d’une Property de son unique tenant.
2. Les mêmes bornes et normalisations que la création sont appliquées.
3. `propertyId`, `tenantId`, `propertyType`, `transactionType`, `status`, `createdAt`, détails, termes et ownerships restent inchangés.
4. Une Property absente ou cross-tenant retourne le même 404 non révélateur.
5. Une autorité absente ou insuffisante reçoit respectivement 401 ou 403 avant mutation.
6. PostgreSQL effectue l’opération atomiquement sous transaction tenant-scoped et forced RLS.
7. La fiche Web propose un formulaire accessible en français et conserve les données affichées si l’enregistrement échoue.
8. Le portefeuille affiche les nouvelles informations au prochain chargement, sans changement de pagination côté Web.
9. OpenAPI, DTO/Zod et implémentation restent alignés et additifs.
10. Les validations ciblées, PostgreSQL, architecture et suite globale passent.

### Non-objectifs proposés

- changement de `propertyType`, `transactionType` ou `status` ;
- modification des détails ou conditions commerciales déjà couverte ;
- suppression, duplication ou fusion de Property ;
- historique des modifications ou audit UI générique ;
- géocodage, coordonnées GPS ou cadastre ;
- Building/Residence/Unit, publication, médias, disponibilité ou occupation ;
- refonte du portefeuille ou du design system.

## Validations exécutées

Toutes les commandes suivantes ont été exécutées pendant TASK-047 le 2026-08-28 :

| Commande | Résultat réel |
|---|---|
| `$env:CI='true'; corepack pnpm --filter @monpiole/web exec vitest run src/features/properties/PropertyOwnerPages.test.tsx src/features/properties/PropertyPages.test.tsx` | PASS — 2 fichiers, 18 tests |
| `$env:CI='true'; corepack pnpm test:unit tests/unit/property-owner-directory.test.ts` | PASS — 1 fichier, 8 tests |
| `$env:CI='true'; corepack pnpm test:integration tests/integration/api-property-owner-directory.test.ts tests/integration/api-identity-postgres-runtime.test.ts` | PASS — 2 fichiers, 19 tests |
| `$env:CI='true'; corepack pnpm test:contract tests/contract/property-owner-directory-openapi.test.ts` | PASS — 1 fichier, 2 tests |
| `$env:CI='true'; corepack pnpm service:property-management:test:integration` | PASS — 1 fichier, 23 tests PostgreSQL/Testcontainers |
| `$env:CI='true'; corepack pnpm service:property-management:migration:check` | PASS — `Everything's fine` |
| `$env:CI='true'; corepack pnpm -r typecheck` | PASS — 9 workspaces applicables |
| `$env:CI='true'; corepack pnpm architecture:check` | PASS — workspace, exports, resolver, graph, boundaries, cycles et diagnostics |

La suite globale de 443 tests passée et consignée par TASK-046 n’a pas été réexécutée : pour cet audit documentaire sans changement fonctionnel, les suites ciblées couvrent le code audité, le runtime réel, PostgreSQL, le contrat et les frontières. Aucun navigateur Auth0 réel n’était configuré ; aucun smoke test réel n’est revendiqué.

## Verdict final

**READY WITH CONTAINED GAPS — GO vers TASK-048.**

TASK-046 a fermé le gap de découverte Owner et de saisie UUID. La prochaine tranche peut commencer sans migration préalable ni changement d’architecture, sous réserve de figer contractuellement la mutabilité aux informations fondamentales recommandées. Les lacunes opérationnelles et UX listées restent réelles mais ne bloquent pas TASK-048. Aucune implémentation de cette prochaine capacité n’est incluse dans TASK-047.
