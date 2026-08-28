# TASK-045 — Post-Property-Portfolio-Web-Discovery Readiness Audit & Next Capability

## Statut

**DONE — GO WITH CONDITIONS**

## Date

2026-08-28

## Contexte

TASK-042 a livré `GET /v1/properties`, TASK-043 a recommandé de combler d'abord le décalage Web/API, et TASK-044 a livré la découverte du portefeuille dans `apps/web`. Le présent audit vérifie cette chaîne sur le dépôt au commit `8fa24c2` et sélectionne la prochaine tranche verticale à partir de l'état exécutable, sans implémenter cette tranche.

## Périmètre

- parcours Web du portefeuille, création et consultation d'un bien ;
- frontière Web/API et traitement de la session OIDC ;
- requête `GET /v1/properties`, domaine Property, PostgreSQL, RLS et autorisation ;
- tests unitaires, Web, intégration, contrat, architecture et PostgreSQL ;
- readiness locale, CI, intégration, démonstration et production ;
- comparaison des capacités suivantes et recommandation.

## Hors périmètre

- modification du code applicatif, des contrats HTTP/OpenAPI ou des dépendances ;
- migration ou évolution du modèle de données ;
- implémentation de la capacité recommandée ;
- déploiement, configuration Auth0 réelle ou smoke test navigateur réel.

## Sources et fichiers examinés

### Gouvernance, trajectoire et architecture

- `AGENTS.md`
- `README.md`
- `.codex/tasks/TASK-042-property-portfolio-listing-discovery-api-vertical-slice.md`
- `.codex/tasks/TASK-043-post-property-portfolio-readiness-audit-next-capability.md`
- `.codex/tasks/TASK-044-property-portfolio-web-discovery-vertical-slice.md`
- `.codex/tasks/UI-003-property-management-web-vertical-slice.md`
- `engineering/decisions/ADR-0001-clean-architecture-ddd-bounded-contexts.md`
- `engineering/decisions/ADR-0003-api-first-rest-and-asyncapi-contracts.md`
- `engineering/decisions/ADR-0004-multi-tenancy-and-isolation.md`
- `engineering/decisions/ADR-0005-identity-authentication-and-authorization.md`
- `engineering/decisions/ADR-0006-postgresql-drizzle-persistence.md`
- `engineering/decisions/ADR-0007-web-application-react-vite.md`
- `engineering/decisions/TD-008-postgresql-drizzle-runtime-persistence.md`
- `engineering/decisions/TD-013-web-application-foundation.md`
- `engineering/decisions/TD-014-auth0-react-oidc-integration.md`
- `engineering/decisions/TD-015-web-session-cache-policy.md`

### Web

- `apps/web/README.md`
- `apps/web/src/app/routes.tsx`
- `apps/web/src/app/AuthenticationBoundary.tsx`
- `apps/web/src/app/AppShell.tsx`
- `apps/web/src/features/properties/PropertyWorkspacePage.tsx`
- `apps/web/src/features/properties/PropertyDetailPage.tsx`
- `apps/web/src/features/properties/CreatePropertyPage.tsx`
- `apps/web/src/features/properties/property-api.ts`
- `apps/web/src/features/properties/property-model.ts`
- `apps/web/src/features/properties/property-labels.ts`
- `apps/web/src/features/properties/PropertyPortfolioPage.test.tsx`
- `apps/web/src/features/properties/PropertyPages.test.tsx`
- `apps/web/src/infrastructure/http/api-client.ts`
- `apps/web/src/infrastructure/http/api-client.test.ts`
- `apps/web/src/infrastructure/auth/`
- `apps/web/src/styles.css`

### API, domaine, persistance et contrats

- `apps/api/README.md`
- `apps/api/src/main.ts`
- `apps/api/src/property-management.controller.ts`
- `apps/api/src/property-management.dto.ts`
- `apps/api/src/property-portfolio-cursor.ts`
- `apps/api/src/runtime.ts`
- `apps/api/src/identity-external-authority.adapter.ts`
- `apps/api/src/oidc-authenticated-authority.provider.ts`
- `services/property-management/src/application/list-properties.ts`
- `services/property-management/src/domain/property.ts`
- `services/property-management/src/infrastructure/postgres-property-portfolio.query.ts`
- `services/property-management/src/infrastructure/postgres-property-owner.repository.ts`
- `services/property-management/src/infrastructure/schema.ts`
- `services/property-management/migrations/0000_initial_property_management.sql`
- `engineering/contracts/openapi/property-management.v1.yaml`
- `tests/unit/property-portfolio-listing.test.ts`
- `tests/integration/api-property-portfolio.test.ts`
- `tests/contract/property-openapi.test.ts`
- `services/property-management/tests/postgres-property-repository.test.ts`
- `tests/integration/api-identity-postgres-runtime.test.ts`
- `tests/integration/api-cors.test.ts`

## Baseline Git auditée

**Fait observé.** Au début de l'audit, `git status --short` ne produisait aucune sortie : le worktree était propre. `git log -5 --oneline` retournait :

```text
8fa24c2 feat(web): add property portfolio discovery
8ab4b43 docs(property): audit post-portfolio readiness
424b923 feat(property): add portfolio listing and discovery API
5fadd8c feat(web): add property management vertical slice
48fa702 fix(auth): restore Auth0 session and complete E2E smoke
```

Aucune modification préexistante n'a donc été rencontrée. Le seul fichier créé par TASK-045 est le présent document.

## Résumé exécutif

**Fait observé.** TASK-044 correspond bien à la capacité recommandée par TASK-043. Le portefeuille Web est protégé par la session, charge l'API authentifiée, expose recherche et filtres réellement contractuels, conserve le curseur opaque, accumule les pages sans doublon et donne accès à la création et au détail. Les états initial, vide, succès, pagination, erreurs initiale et secondaire, session expirée et absence de session sont couverts par tests.

**Fait observé.** L'API repose réellement sur PostgreSQL, une transaction tenant-scoped et une RLS forcée. La pagination est déterministe par `(createdAt DESC, propertyId DESC)`. L'autorité est résolue depuis l'identité externe, et le grant `LIST_PROPERTIES` est décidé côté serveur, pas déduit de claims dans le Web.

**Limite.** Le parcours n'est pas prouvé en navigateur réel avec une configuration Auth0/PostgreSQL actuelle. Les critères et pages chargées sont perdus après navigation vers une fiche. Le client Web ne valide pas à l'exécution le corps JSON d'une réponse 2xx. Ces points n'empêchent pas la capacité suivante, mais interdisent une conclusion « production ready ».

**Recommandation.** La prochaine tranche doit être **TASK-046 — Property Owner Directory & Web Management Vertical Slice**. Le domaine `PropertyOwner`, sa persistance tenant-scoped et ses opérations create/get/update existent déjà, tandis que `/proprietaires` est encore un placeholder et que l'affectation d'une propriété demande aujourd'hui un UUID connu. Cette tranche apporte davantage de valeur observable et moins d'abstraction spéculative que Building/Units, publication, médias ou occupation.

## Inventaire des capacités livrées

| Capacité | État | Preuve principale |
|---|---|---|
| Shell et routes Property protégées | Livrée | `apps/web/src/app/routes.tsx`, `AuthenticationBoundary.tsx` |
| Portefeuille responsive en français | Livrée | `PropertyWorkspacePage.tsx`, `property-labels.ts`, `styles.css` |
| Chargement authentifié | Livrée | `property-api.ts`, `api-client.ts` |
| Recherche texte | Livrée | query `search`, recherche littérale insensible à la casse côté PostgreSQL |
| Filtres type/statut | Livrée | query `type`, `status`; seul `DRAFT` existe actuellement |
| Pagination par curseur | Livrée | curseur opaque transmis sans interprétation ; keyset PostgreSQL |
| Déduplication Web | Livrée | accumulation par `propertyId` dans `PropertyWorkspacePage.tsx` |
| États loading/empty/error/retry | Livrée | composant et 10 tests portefeuille |
| Création et détail Property | Livrée | `/properties/new`, `/properties/:propertyId` |
| Détails et termes commerciaux | Livrée antérieurement | `PropertyDetailPage.tsx`, API Property existante |
| PropertyOwner create/get/update | Backend livré | contrôleur, use cases, repository PostgreSQL et OpenAPI |
| Ownership assign/list/remove | Backend et UI Property livrés | API et `PropertyDetailPage.tsx` |
| Annuaire Web des propriétaires | Absente | `/proprietaires` pointe vers `PlaceholderPage` |
| Liste API des propriétaires | Absente | aucun `GET /v1/property-owners` collection dans OpenAPI/contrôleur |
| Composition Building/Unit | Absente | aucun concept dans `Property` ou le schéma |
| Publication, médias, disponibilité, occupation | Absentes | `PropertyStatus` ne contient que `DRAFT` |

## Parcours fonctionnel audité

### Portefeuille et navigation

**Faits observés.** `/properties` est une route authentifiée. Le formulaire de recherche distingue l'absence de filtre d'une valeur vide : la recherche est `trim()` puis omise si elle est vide, et les sélecteurs vides ne produisent aucun paramètre. Les cartes n'affichent que les champs de TASK-042 : titre, type, statut, identifiant, adresse, ville et quartier lorsqu'ils existent. Les enums sont traduits via des mappings centralisés. Les liens conduisent vers `/properties/new` et `/properties/{propertyId}`.

La page suivante n'est demandée que si `nextCursor` existe. Le Web retransmet cette valeur opaque, conserve l'ordre serveur, élimine un doublon éventuel par `propertyId`, masque le bouton à la dernière page et conserve les résultats après une erreur secondaire. L'erreur initiale permet une nouvelle tentative.

**Écart observé.** Les filtres, le curseur, les pages accumulées et la position ne sont ni dans l'URL ni dans un store persistant. Le lien « Retour aux biens » remonte une nouvelle instance de `/properties` : les critères sont perdus. Aucun test ne promet leur conservation.

**Accessibilité et responsive.** Le formulaire utilise `role="search"`, des labels, états `status`/`alert`, `aria-busy`, une liste sémantique et des liens/boutons utilisables au clavier. `styles.css` conserve un focus visible et ramène la grille à une colonne sous 760 px. Ces propriétés sont prouvées par inspection et jsdom/CSS, pas par un audit WCAG ni par un appareil réel.

### Session et erreurs

**Faits observés.** `AuthenticationBoundary` n'affiche aucune route protégée tant que la session charge et redirige l'utilisateur non authentifié vers `/connexion`. Le client ajoute `Authorization: Bearer`, retente une seule fois un 401 avec renouvellement forcé, puis expose une erreur de session expirée. Il distingue 403 et Problem Details serveur. Les tests vérifient aussi l'absence de requête protégée avant disponibilité de la session.

**Écart observé.** Les réponses 2xx sont castées vers le type générique demandé ; elles ne sont pas validées par un schéma runtime. Une réponse serveur malformée peut donc atteindre l'UI. Les types Web sont locaux et correctement découplés de la persistance, mais ne sont pas dérivés automatiquement de l'OpenAPI.

## Frontière Web/API

| Point vérifié | Résultat |
|---|---|
| Construction des query parameters | `URLSearchParams`; uniquement `limit`, `cursor`, `status`, `type`, `search` |
| Valeur vide | omise après normalisation par la page |
| Curseur | valeur opaque conservée ; aucune pagination parallèle inventée |
| Tenant | jamais envoyé par le Web ; résolu depuis l'autorité serveur |
| Authentification | bearer fourni par l'abstraction de session existante |
| 401/403/5xx | distingués et présentés en français |
| Corps 2xx invalide | non validé à l'exécution |
| Couplage persistance | aucun import Web vers Drizzle, schéma DB ou service interne |

## API, domaine, runtime et sécurité

### Listing Property

**Faits observés.** `GET /v1/properties` accepte un `limit` de 1 à 100 (20 par défaut), un curseur limité à 512 caractères, `status=DRAFT`, cinq types et une recherche de 1 à 100 caractères. Le codec exige un base64url JSON canonique contenant un timestamp UTC et un UUID ; un curseur invalide produit 400. `ListProperties` exige exactement un tenant et le grant `LIST_PROPERTIES`.

`PostgresPropertyPortfolioQuery` exécute la lecture dans `withTenantPostgresTransaction`, applique aussi explicitement `tenantId`, échappe les jokers de recherche, utilise `limit + 1` et trie par `createdAt DESC, propertyId DESC`. L'index `(tenant_id, created_at DESC, property_id DESC)` soutient ce parcours. La migration initiale force la RLS. Les tests API et PostgreSQL couvrent validation, ordre, curseur, filtres et isolation inter-tenant.

Les opérations create/get/update Property et les opérations Owner/Ownership continuent d'utiliser leurs contrats existants ; TASK-044 ne les a pas modifiées.

### Composition runtime

**Faits observés.** `apps/api/src/main.ts` compose `createPostgresApiRuntime`; aucun fallback mémoire involontaire n'est sélectionné au démarrage normal. Le runtime construit le query adapter PostgreSQL, les repositories, `OidcAccessTokenVerifier`, `OidcAuthenticatedAuthorityProvider` et le store PostgreSQL d'identités externes.

Les grants viennent de l'autorité interne résolue par `(issuer, subject)`. Les claims/scopes du token ne deviennent pas des permissions métier dans le navigateur. Un token invalide ou une identité externe non liée conduit à 401 ; une autorité authentifiée dépourvue du grant conduit à 403.

### Configuration et CORS

Le démarrage local réel demande PostgreSQL, les variables DB, `AUTHENTICATION_ISSUER`, `AUTHENTICATION_AUDIENCE`, `AUTHENTICATION_JWKS_URI`, l'algorithme, `API_ALLOWED_BROWSER_ORIGINS`, les variables `VITE_AUTH0_*`, ainsi que le bootstrap de plateforme et la liaison de l'identité externe. CORS utilise des origines exactes, sans wildcard, et autorise les headers nécessaires au bearer et à la corrélation.

**Écart de production.** Aucun élément examiné ne prouve un déploiement production, la sauvegarde/restauration, la haute disponibilité, les SLO/alertes ni un smoke test portfolio avec un tenant et un Auth0 réels. TD-015 documente aussi le risque XSS du cache `sessionStorage` et dépend d'une CSP restrictive comme contrôle de déploiement. La production est donc explicitement NO-GO.

## Matrice des preuves

| Comportement | Preuve automatisée | Limite |
|---|---|---|
| Loading, empty, cards, labels français | `PropertyPortfolioPage.test.tsx` | jsdom seulement |
| Liens création/détail | tests Web | pas de navigation navigateur complète |
| Pagination/déduplication/fin | tests Web + unit/API/PostgreSQL | pas de volumétrie |
| Erreur initiale/secondaire et retry | tests Web | pas de chaos réseau réel |
| Bearer, refresh 401, 403 | tests portfolio + `api-client.test.ts` | pas d'Auth0 réel dans cet audit |
| Absence d'appel avant session | tests portfolio | frontière composant simulée |
| Validation query/cursor | unitaires et intégration API | — |
| Ordre/filtres/recherche | unitaires, API, PostgreSQL | pas de benchmark |
| Isolation tenant/RLS | PostgreSQL/Testcontainers | configuration production non prouvée |
| OpenAPI | tests contrat | client Web non généré |
| Boundaries | `architecture:check` | — |
| Responsive/accessibilité | inspection CSS/DOM | pas de WCAG ni device réel |
| Smoke navigateur portfolio | absent | reste non prouvé |

## Résultats des validations

Toutes les commandes ci-dessous ont été exécutées le 2026-08-28. Les commandes ciblées et globales ont utilisé les dépendances déjà verrouillées.

| Commande | Résultat réel |
|---|---|
| `corepack pnpm --filter @monpiole/web exec vitest run src/features/properties/PropertyPortfolioPage.test.tsx` | PASS — 1 fichier, 10 tests |
| `corepack pnpm exec vitest run --project unit tests/unit/property-portfolio-listing.test.ts` | PASS — 1 fichier, 10 tests |
| `corepack pnpm exec vitest run --project integration tests/integration/api-property-portfolio.test.ts` | PASS — 1 fichier, 15 tests |
| `corepack pnpm exec vitest run --project contract tests/contract/property-openapi.test.ts` | PASS — 1 fichier, 5 tests |
| `corepack pnpm --filter @monpiole/web typecheck` | PASS |
| `corepack pnpm app:api:typecheck` | PASS |
| `corepack pnpm typecheck:tests` | PASS |
| `corepack pnpm architecture:check` | PASS — workspace, exports, resolver, graph, boundaries, cycles, diagnostics |
| `$env:CI='true'; corepack pnpm --filter @monpiole/web test` | PASS — 9 fichiers, 52 tests |
| `$env:CI='true'; corepack pnpm --filter @monpiole/web build` | PASS — 100 modules ; avertissement bundle JS 527,34 kB (157,99 kB gzip) |
| `corepack pnpm service:property-management:test:integration` | PASS — 1 fichier, 22 tests PostgreSQL/Testcontainers |
| `$env:CI='true'; corepack pnpm test` | PASS — 58 fichiers, 413 tests |

Deux premières relances de `corepack pnpm --filter @monpiole/web test` et `build` sans `$env:CI='true'` ont échoué avant exécution avec `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. La cause était le contrôle automatique des dépendances en environnement non interactif, pas un défaut du code. Les mêmes commandes ont ensuite réellement réussi avec `CI=true`, comme indiqué ci-dessus.

Docker était disponible ; la suite PostgreSQL/Testcontainers a donc été exécutée et réussie. Aucun Auth0 réel ni navigateur contrôlable n'a été utilisé : ce parcours opérationnel reste non prouvé.

## Constats classés

### Capacité prête et prouvée

- listing Web/API tenant-scoped, authentifié et autorisé ;
- recherche, filtres contractuels et pagination déterministe ;
- création et consultation accessibles depuis le portefeuille ;
- états UX essentiels et messages français ;
- runtime PostgreSQL sans fallback mémoire ;
- tests ciblés, PostgreSQL, contrat, architecture, build et suite globale au vert.

### Dette ou amélioration non bloquante

- perte des critères/pages/scroll lors du retour au portefeuille ;
- absence de validation runtime des réponses 2xx côté Web ;
- bundle Web supérieur au seuil Vite de 500 kB ;
- preuve responsive limitée à CSS/jsdom ;
- `README.md` racine conserve des formulations Sprint 0 devenues obsolètes.

### Lacunes bloquant une mise en production

- aucun smoke test actuel avec navigateur, Auth0, PostgreSQL et tenant réels ;
- absence de preuve de déploiement, CSP effectivement servie, sauvegarde/restauration, HA et supervision ;
- absence de preuve de tests de charge ou de volumétrie du portefeuille.

### Capacités fonctionnelles absentes

- annuaire et gestion Web des `PropertyOwner` ;
- découverte d'un propriétaire lors de l'affectation (l'UI exige un UUID connu) ;
- composition Building/Residence/Unit ;
- publication, médias, disponibilité/occupation ;
- onboarding locataire, bail, paiement et facturation.

## Analyse des écarts

Le principal écart utilisateur n'est plus la découverte des biens, mais celle des propriétaires. Le backend sait créer, lire, modifier et persister un `PropertyOwner`, et l'ownership est déjà attachable à une Property. Pourtant le shell affiche encore un écran d'attente sur `/proprietaires`, il n'existe pas de collection API des propriétaires, et l'affectation demande de connaître un identifiant technique. Cette rupture est immédiatement visible et empêche un parcours métier autonome.

La perte des filtres du portefeuille est une amélioration UX justifiée mais contenue ; elle ne constitue pas à elle seule une nouvelle capacité métier. Elle peut être traitée séparément sans retarder TASK-046.

## Readiness par environnement

| Environnement | Verdict | Justification |
|---|---|---|
| Développement local | **READY WITH CONDITIONS** | instructions disponibles ; Docker, PostgreSQL, Auth0 et liaison d'identité doivent être configurés |
| CI | **READY** | tests ciblés, globaux, architecture, contrat et Testcontainers passent dans l'environnement audité |
| Intégration | **READY WITH CONDITIONS** | composition réelle présente ; secrets, issuer/audience, CORS, bootstrap et identité externe restent à provisionner |
| Démonstration | **READY WITH CONDITIONS** | parcours automatisé cohérent, mais smoke manuel Auth0/PostgreSQL/portfolio requis avant démonstration |
| Production | **NO-GO** | preuves opérationnelles, CSP déployée, résilience, sauvegarde/restauration, supervision et smoke réel absents |

Ces verdicts évaluent l'état actuel. Le GO vers une nouvelle capacité de développement ne vaut pas autorisation de mise en production.

## Comparaison des capacités candidates

| Candidate | Valeur utilisateur | Fondations disponibles | Lacunes/risques | Taille probable | Verdict |
|---|---|---|---|---|---|
| Annuaire et gestion Web `PropertyOwner` | Rend l'espace propriétaires utilisable et supprime la dépendance à un UUID connu | aggregate, create/get/update, ownership, PostgreSQL/RLS, auth, patterns portfolio Web/API | ajouter une collection API et définir recherche/ordre ; intégrer une sélection accessible | Moyenne, verticale | **Recommandée** |
| Building/Residence/Unit | Représente les immeubles multi-lots et débloque les niveaux de gestion | aggregate Property et persistence patterns | rôles structurels, cardinalités, héritage, niveau d'ownership et cycle de vie non décidés | Grande | **PREMATURE** |
| Publication/activation | Rendrait un bien visible hors portfolio interne | Property et statut DRAFT | publishability, audience, composition, médias et disponibilité absents | Moyenne à grande | **PREMATURE** |
| Médias/documents | Enrichit les fiches et prépare la publication | UI détail et auth | stockage objet, upload, antivirus, ACL, quotas, ordre et suppression à concevoir | Grande | **PREMATURE** |
| Disponibilité/occupation | Prépare location et exploitation | termes commerciaux | unité de disponibilité, périodes, conflits et distinction occupation/disponibilité non définis | Grande | **PREMATURE** |
| Onboarding locataire | Commence le parcours locatif | identité/tenant techniques | bounded context locataire et consentement/PII non établis ; dépend de l'actif louable | Grande | **NO-GO maintenant** |
| Création d'un bail | Forte valeur transactionnelle | aucune fondation contractuelle dédiée | dépend de parties, unité, disponibilité, règles de bail et documents | Très grande | **NO-GO maintenant** |
| Persistance des critères portfolio | Améliore la continuité de navigation | React Router et page existante | valeur métier limitée ; dette UX, pas une tranche métier suivante | Petite | **Amélioration non bloquante** |

## Recommandation finale

### TASK-046 — Property Owner Directory & Web Management Vertical Slice

**Inférence.** Le dépôt montre un domaine Owner plus mûr que les concepts de composition ou de publication : les invariants essentiels, les opérations individuelles, la persistance, la RLS et l'ownership existent. Le manque est une frontière de découverte et une expérience Web. La tranche peut réutiliser presque exactement les mécanismes prouvés par TASK-042/TASK-044, sans créer de nouveau sous-système.

**Recommandation.** TASK-046 doit livrer un parcours français de bout en bout permettant de trouver, créer, consulter et modifier les propriétaires du tenant, puis de sélectionner un propriétaire existant lors d'une affectation de propriété. La liste doit rester bornée et tenant-scoped ; elle ne doit pas devenir un CRM générique.

### Périmètre proposé

- définir dans OpenAPI un `GET /v1/property-owners` authentifié avec projection minimale, pagination par curseur déterministe et recherche/filtres strictement justifiés ;
- ajouter un grant explicite de listing si le modèle d'autorisation l'exige, sans déduire cette permission des claims OIDC ;
- implémenter query/use case/repository PostgreSQL avec transaction tenant-scoped, prédicat tenant, RLS et index cohérent ;
- remplacer le placeholder `/proprietaires` par un annuaire responsive en français ;
- exposer loading, empty, success, pagination, erreurs initiale/secondaire, 401 et 403 ;
- réutiliser les endpoints existants pour créer, consulter et modifier `INDIVIDUAL` et `LEGAL_ENTITY` ;
- permettre de choisir un propriétaire découvert lors de `assign ownership`, sans saisie obligatoire d'un UUID opaque ;
- conserver les pourcentages et règles d'ownership actuels.

### Hors périmètre proposé

- historique ou mise à jour directe d'une ownership ;
- validation obligatoire à 100 % des parts ;
- CRM, contacts multiples, KYC, bénéficiaire effectif ou documents légaux ;
- fusion/déduplication automatique de propriétaires ;
- Building/Unit, publication, médias, disponibilité, bail ou paiement ;
- refonte générale du shell Web ou de l'authentification.

### Critères d'acceptation suggérés

1. La collection Owner est contractuelle, paginée de manière stable, validée et documentée.
2. Un tenant ne peut jamais observer l'Owner d'un autre tenant, y compris avec un curseur forgé.
3. L'opération exige une autorité authentifiée et un grant explicite ; 401 et 403 restent distincts.
4. `/proprietaires` liste les propriétaires, gère loading/empty/error/retry et la fin de pagination en français.
5. L'utilisateur peut créer puis retrouver un particulier ou une personne morale, ouvrir sa fiche et la modifier.
6. Depuis une Property, l'utilisateur peut découvrir et sélectionner un Owner existant avant d'affecter sa part.
7. Le client conserve le curseur opaque et ne transmet jamais de tenant choisi par le navigateur.
8. Les tests couvrent application, API, OpenAPI, PostgreSQL/RLS, Web, session et non-régression Property.
9. Typecheck, build Web, architecture, tests contractuels/intégration/globaux et `git diff --check` passent.
10. Un smoke test navigateur Auth0/PostgreSQL est exécuté ou le statut reste explicitement conditionnel.

## Risques, dépendances et questions ouvertes

- Définir avant code le nom d'affichage canonique et l'ordre stable entre personnes physiques et morales.
- Déterminer si la recherche couvre seulement les noms ou aussi l'email ; éviter d'exposer plus de PII que nécessaire dans la projection.
- Décider si un grant `LIST_PROPERTY_OWNERS` distinct est requis plutôt que de réutiliser un grant existant ; la décision doit rester côté application/API.
- Ajouter l'index de listing seulement après avoir figé ordre et critères ; éviter un index spéculatif.
- Concevoir la sélection Owner pour rester utilisable au clavier et ne pas charger une collection non bornée.
- Conserver une distinction claire entre propriétaire patrimonial, locataire et utilisateur OIDC.
- Traiter ultérieurement la conservation des critères de portefeuille et la validation runtime des réponses Web.
- Avant Composition, organiser une décision métier sur Building/Residence/Unit, niveau d'ownership et héritage ; l'ancien séquencement n'est plus suffisant comme preuve.

## Décision finale

**GO WITH CONDITIONS** pour passer à **TASK-046 — Property Owner Directory & Web Management Vertical Slice**.

Conditions : figer d'abord le contrat de listing Owner et sa projection minimale, préserver grant explicite/tenant/RLS, livrer ensemble API et UI française, et couvrir le parcours par les mêmes niveaux de tests que le portfolio. Cette décision autorise le développement de la prochaine tranche ; elle ne constitue ni une readiness production ni une autorisation de commencer Building/Units, publication ou un sous-système locatif.
