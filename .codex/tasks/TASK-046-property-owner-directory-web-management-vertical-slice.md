# TASK-046 — Property Owner Directory & Web Management Vertical Slice

- Statut : **DONE**
- Date : 2026-08-28
- Baseline : `e32eafd docs(property): audit post-portfolio web readiness`

## Contexte et problème

TASK-037 avait livré `PropertyOwner` avec création, consultation, modification, PostgreSQL et RLS. TASK-038 avait livré l’affectation, la consultation par Property et le retrait d’ownership. UI-003 utilisait néanmoins un UUID Owner saisi manuellement, car aucune collection Owner n’existait. TASK-045 a confirmé ce gap : `/proprietaires` restait un placeholder alors que le domaine Owner était déjà mature.

TASK-046 ferme ce gap par une tranche API/PostgreSQL/Web complète. Aucun concept Building, Unit, publication ou location n’est introduit.

## Objectifs

- découvrir et rechercher les propriétaires du tenant courant ;
- paginer de manière stable sans exposer le tenant au navigateur ;
- gérer création, consultation et modification depuis le shell Web ;
- sélectionner un Owner existant lors d’une affectation sans saisir son UUID ;
- préserver l’autorité OIDC interne, les grants explicites, PostgreSQL et la RLS.

## Périmètre livré

### API et application

- `GET /v1/property-owners` avec `limit` 1–100, défaut 20, `cursor` opaque et `search` 1–100 caractères ;
- grant métier distinct `LIST_PROPERTY_OWNERS` ;
- `ListPropertyOwners` et port de lecture `PropertyOwnerDirectoryQuery` ;
- projection publique Owner existante, sans `tenantId` ni détail de persistance ;
- curseur Base64URL canonique `{ createdAt, ownerId }` ;
- Problem Details 400/401/403/500 selon les conventions existantes.

### PostgreSQL

- `PostgresPropertyOwnerDirectoryQuery` dans une transaction tenant-scoped ;
- prédicat tenant explicite et forced RLS existante ;
- recherche littérale `ILIKE` paramétrée sur prénom, nom, raison sociale, immatriculation et e-mail ;
- ordre déterministe `createdAt DESC, ownerId DESC` et lecture `limit + 1` ;
- migration 0005 ajoutant l’index `(tenant_id, created_at DESC, owner_id DESC)`.

### Web

- routes protégées `/proprietaires`, `/proprietaires/new` et `/proprietaires/:ownerId` ;
- annuaire français responsive avec recherche, pagination, loading, vide, aucun résultat, erreur et succès ;
- création des variantes `INDIVIDUAL` et `LEGAL_ENTITY` avec les endpoints existants ;
- consultation et modification avec type immuable ;
- sélecteur Owner dans `PropertyOwnershipSection`, recherche bornée, Owner déjà affecté désactivé, cas vide/sans résultat/erreur et retry ;
- réutilisation du client bearer, du renouvellement 401, des erreurs et des composants visuels existants.

## Exclusions

- suppression de `PropertyOwner`, changement de type ou déduplication ;
- historique, mise à jour directe de quote-part ou total obligatoire de 100 % ;
- inverse Owner → Properties ;
- CRM, KYC/KYB, documents ou coordonnées multiples ;
- Building/Residence/Unit, publication, médias, disponibilité, bail et paiement ;
- nouvelle dépendance ou architecture frontend parallèle.

## Décisions d’implémentation

1. Le listing Owner utilise un port de projection distinct du repository d’agrégat, comme le Portfolio Property. Une lecture de collection ne détourne donc pas le store transactionnel create/get/update.
2. L’ordre de création puis UUID fournit une pagination keyset déterministe sans imposer prématurément un nom d’affichage canonique commun aux deux variantes Owner.
3. La recherche couvre les champs d’identité réellement publics et l’e-mail public existant. Le téléphone n’est pas indexé comme critère de découverte.
4. Le Web conserve le curseur opaque et déduplique par `ownerId`. Il ne transmet jamais de tenant.
5. Le sélecteur charge au plus 100 résultats et permet de restreindre la recherche ; il ne charge jamais une collection non bornée.
6. Les actions create/get/update existantes sont exposées sans créer DELETE ni PATCH.
7. Le nouveau grant reste attribué par la résolution d’autorité interne. Les scopes/claims OIDC ne deviennent pas des permissions métier.

## Critères d’acceptation

- [x] contrat OpenAPI 3.1 additif et strict pour la collection Owner ;
- [x] authentification, grant explicite et tenant unique exigés ;
- [x] recherche normalisée, validation et curseur invalide couverts ;
- [x] pagination et ordre stables sur PostgreSQL réel ;
- [x] aucune fuite Owner inter-tenant ;
- [x] annuaire Web français avec états principaux et pagination résiliente ;
- [x] création, consultation et modification des deux variantes supportées ;
- [x] sélection Owner dans une Property sans UUID manuel ;
- [x] cas aucun Owner, aucun résultat, Owner déjà affecté, 403 et erreur serveur couverts ;
- [x] tests Web/API/application/contrat/PostgreSQL/runtime ajoutés ;
- [x] typechecks, builds, architecture, migrations et suite globale réussis ;
- [x] aucune dépendance ajoutée et aucune régression masquée.

## Fichiers principaux créés

- `services/property-management/src/application/list-property-owners.ts`
- `services/property-management/src/application/property-owner-directory-query.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-owner-directory-query.ts`
- `services/property-management/migrations/0005_property_management_baseline.sql`
- `services/property-management/migrations/meta/0005_snapshot.json`
- `apps/api/src/http/properties/list-property-owners.controller.ts`
- `apps/api/src/http/properties/property-owner-directory-cursor.ts`
- `apps/web/src/features/properties/PropertyOwnerDirectoryPage.tsx`
- `apps/web/src/features/properties/CreatePropertyOwnerPage.tsx`
- `apps/web/src/features/properties/PropertyOwnerDetailPage.tsx`
- `apps/web/src/features/properties/PropertyOwnerForm.tsx`
- `apps/web/src/features/properties/PropertyOwnerPages.test.tsx`
- `tests/unit/property-owner-directory.test.ts`
- `tests/integration/api-property-owner-directory.test.ts`
- `tests/contract/property-owner-directory-openapi.test.ts`
- `.codex/tasks/TASK-046-property-owner-directory-web-management-vertical-slice.md`

## Fichiers principaux modifiés

- grants, exports et composition : `property-authority.ts`, `index.ts`, `app.module.ts`, `create-postgres-runtime-composition.ts`, `identity-external-authority.adapter.ts`, `authenticated-authority.ts` ;
- contrats et transport : `property-owner.schema.ts`, `property-owner.dto.ts`, `property-owner.mapper.ts`, `problem-details.filter.ts`, `engineering/contracts/http/openapi.json` ;
- PostgreSQL : `schema.ts`, `_journal.json`, test repository ;
- Web : `routes.tsx`, `property-model.ts`, `property-api.ts`, `property-errors.ts`, `PropertyOwnershipSection.tsx`, tests Property/Portfolio et `global.css` ;
- preuve runtime : `tests/integration/api-identity-postgres-runtime.test.ts` ;
- documentation : README API, Web et Property Management.

Aucun fichier n’a été supprimé.

## Tests ajoutés

- application : valeurs par défaut, recherche normalisée, limite, tenant unique et grant ;
- HTTP : query, curseur round-trip, 400, 401, 403 et absence de tenant client ;
- PostgreSQL : variantes Owner, recherche, ordre UUID à timestamp égal, pagination, index et isolation tenant ;
- OpenAPI : paramètres, sécurité, réponses et schémas stricts ;
- runtime : create Owner puis listing réel par la composition PostgreSQL ;
- Web : loading, vide, aucun résultat, cartes, labels, pagination/déduplication, erreur secondaire, création, modification, bearer et erreur initiale ;
- ownership : aucun Owner, recherche sans résultat, déjà affecté, sélection et affectation, 403 et erreur d’annuaire.

La recherche `rg` des formes `it/test/describe.skip` et `it/test.todo` dans le périmètre n’a trouvé aucun test ignoré ou TODO.

## Commandes exécutées et résultats exacts

| Commande | Résultat |
|---|---|
| `corepack pnpm --filter @monpiole/property-management migration:generate` | PASS — migration 0005 générée |
| `corepack pnpm service:property-management:migration:check` | PASS |
| `corepack pnpm service:property-management:typecheck` | PASS |
| `corepack pnpm app:api:typecheck` | PASS |
| `corepack pnpm --filter @monpiole/web typecheck` | PASS |
| `corepack pnpm typecheck:tests` | PASS |
| `corepack pnpm -r typecheck` | PASS — 9 workspaces applicables |
| `corepack pnpm app:api:openapi` | PASS — contrat généré |
| `corepack pnpm app:api:build` | PASS |
| `corepack pnpm --filter @monpiole/web build` | PASS — 103 modules ; warning chunk JS 538,92 kB, 159,35 kB gzip |
| `corepack pnpm architecture:check` | PASS |
| `corepack pnpm --filter @monpiole/web test` | PASS — 10 fichiers, 60 tests |
| `corepack pnpm test:unit tests/unit/property-owner-directory.test.ts` | PASS — 1 fichier, 8 tests |
| `corepack pnpm test:integration tests/integration/api-property-owner-directory.test.ts` | PASS — 1 fichier, 11 tests |
| `corepack pnpm test:contract tests/contract/property-owner-directory-openapi.test.ts` | PASS — 1 fichier, 2 tests |
| `corepack pnpm service:property-management:test:integration` | PASS — 1 fichier, 23 tests PostgreSQL/Testcontainers |
| `corepack pnpm test:integration tests/integration/api-identity-postgres-runtime.test.ts` | PASS — 1 fichier, 8 tests |
| `corepack pnpm test:unit` | PASS — 21 fichiers, 140 tests |
| `corepack pnpm test:integration` | PASS — 15 fichiers, 126 tests |
| `corepack pnpm test:contract` | PASS — 12 fichiers, 67 tests |
| `corepack pnpm app:api:contracts:check` | PASS — 12 fichiers, 67 tests |
| `corepack pnpm test` | PASS final — 62 fichiers, 443 tests |

Les premières exécutions ciblées Vitest dans le sandbox ont échoué avant chargement avec `spawn EPERM`; elles ont été relancées hors sandbox. Une première suite globale lancée sous charge concurrente avec le build API a dépassé le hook Testcontainers de 10 secondes : 61 fichiers/435 tests passaient et la suite runtime avait huit tests skipped à cause du hook. La relance isolée a ensuite révélé que l’autorité synthétique du test runtime devait recevoir le nouveau grant explicite ; après correction, ses 8 tests ont passé et la suite globale seule a passé avec 443/443 tests. Aucun skip ne subsiste dans le résultat final.

Le dépôt ne définit aucune commande `lint` dans les `package.json`; les contrôles statiques disponibles exécutés sont les typechecks stricts, `architecture:check`, les contrats et `git diff --check`.

## Risques et gaps résiduels

- le sélecteur ne déroule pas automatiquement au-delà de 100 Owners ; une recherche plus précise permet d’atteindre les résultats suivants sans collection non bornée ;
- les critères de l’annuaire ne sont pas persistés dans l’URL après navigation ;
- le client Web continue de faire confiance aux réponses 2xx conformes au contrat, sans validation runtime du JSON ;
- le bundle Web dépasse le seuil Vite de 500 kB ; aucune nouvelle dépendance n’a été ajoutée ;
- aucun smoke test navigateur réel Auth0/PostgreSQL n’est revendiqué pour TASK-046 ;
- Building/Units, publication et les capacités locatives restent explicitement différés.

## Statut final

**DONE.** La collection Owner tenant-scoped, le runtime PostgreSQL, l’annuaire Web, les parcours create/get/update et le sélecteur d’ownership sont livrés et couverts par les validations disponibles. La tranche ne revendique pas une readiness production opérationnelle.
