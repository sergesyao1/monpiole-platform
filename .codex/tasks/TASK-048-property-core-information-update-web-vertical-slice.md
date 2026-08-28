# TASK-048 — Property Core Information Update Web Vertical Slice

- Statut : **DONE**
- Date : 2026-08-28
- Baseline : `0175c14 docs(property): audit post-owner-directory readiness`
- Origine : recommandation de TASK-047

## Contexte et problème

Après TASK-046, un utilisateur pouvait créer, découvrir et consulter un bien, définir ses détails et conditions commerciales, et gérer ses propriétaires. Il ne pouvait toutefois pas corriger le titre, la description ou la localisation saisis à la création. Sans suppression de Property, la seule alternative aurait été la création d’un doublon polluant immédiatement le portefeuille.

TASK-048 ferme ce gap par une mutation bornée de l’agrégat Property, exposée de bout en bout jusqu’à sa fiche Web.

## Objectifs

- corriger `title`, `description` et `location` d’une Property existante ;
- réutiliser les invariants de création et la persistance atomique existante ;
- préserver tous les champs autoritatifs ou couverts par d’autres capacités ;
- maintenir l’authentification OIDC, un grant métier explicite et l’isolation tenant ;
- offrir un formulaire accessible et entièrement français dans la fiche du bien.

## Périmètre livré

- `Property.updateCoreInformation` normalise et valide les informations fondamentales ;
- `UpdatePropertyCoreInformation` exige `UPDATE_PROPERTY_CORE_INFORMATION` et un tenant unique ;
- `PostgresPropertyRepository.updateAtomically` persiste titre, description, pays, ville, quartier et adresse dans la transaction tenant-scoped existante ;
- `PUT /v1/properties/{propertyId}` expose un contrat Zod strict et documenté dans OpenAPI 3.1 ;
- la composition PostgreSQL réelle et la résolution d’autorité TENANT_ADMINISTRATOR incluent la nouvelle opération ;
- la fiche `/properties/:propertyId` contient un formulaire dédié et conserve les valeurs saisies si la sauvegarde échoue ;
- le résumé de la fiche est actualisé immédiatement après succès et le portefeuille retrouve les valeurs persistées lors de son prochain chargement.

## Hors périmètre

- modification de `propertyType`, `transactionType` ou `status` ;
- modification des détails physiques ou conditions commerciales par ce nouvel endpoint ;
- suppression, duplication, fusion ou historique de Property ;
- géocodage, coordonnées GPS ou cadastre ;
- Building, Residence, Unit, publication, médias, disponibilité ou occupation ;
- refonte du portefeuille, du shell ou du design system.

## Décisions d’implémentation

1. La mutation utilise `PUT /v1/properties/{propertyId}` car elle remplace l’ensemble borné des informations fondamentales. L’objet strict interdit tout champ autoritatif fourni par le client.
2. Le grant `UPDATE_PROPERTY_CORE_INFORMATION` reste distinct de `UPDATE_PROPERTY_DETAILS`; une permission sur les conditions commerciales n’accorde pas implicitement la modification de l’identité du bien.
3. Le domaine réutilise les bornes de création : titre requis sur 200 caractères, description optionnelle sur 5 000 caractères, pays ISO alpha-2 et localisation requise sur 200 caractères par champ.
4. Une description absente supprime la description précédente. Le formulaire omet donc une valeur vide au lieu de stocker une chaîne vide.
5. `updateAtomically` persiste maintenant toute projection mutable de l’agrégat. Les détails et conditions déjà présents sont conservés pendant une mutation fondamentale.
6. Aucune migration n’est créée : toutes les colonnes et politiques forced RLS nécessaires existent déjà.
7. Le Web réutilise le client bearer et la gestion 401 existants. Il ne transmet jamais de tenant et n’interprète aucun scope OIDC comme grant métier.

## Critères d’acceptation

- [x] un utilisateur authentifié et autorisé peut modifier titre, description et localisation ;
- [x] les bornes et normalisations correspondent à la création ;
- [x] les champs non concernés, détails, termes et ownerships restent inchangés ;
- [x] une Property absente ou cross-tenant reçoit le même 404 non révélateur ;
- [x] 401 et 403 sont distingués avant mutation ;
- [x] PostgreSQL exécute la mutation atomiquement sous tenant scope et forced RLS ;
- [x] le contrat HTTP est additif, strict et aligné avec OpenAPI ;
- [x] la fiche Web propose un formulaire français avec états saving, success et erreur ;
- [x] une erreur conserve les informations saisies et la Property affichée ;
- [x] la réponse réussie actualise immédiatement le résumé de la fiche ;
- [x] aucun nouveau concept métier, dépendance ou migration n’est introduit ;
- [x] les validations ciblées et globales passent.

## Fichiers principaux créés

- `services/property-management/src/application/update-property-core-information.ts`
- `apps/api/src/http/properties/update-property-core-information.controller.ts`
- `apps/web/src/features/properties/PropertyCoreInformationForm.tsx`
- `apps/web/src/features/properties/PropertyCoreInformationForm.test.ts`
- `.codex/tasks/TASK-048-property-core-information-update-web-vertical-slice.md`

## Fichiers principaux modifiés

- domaine, grant, exports et PostgreSQL : `property.ts`, `property-authority.ts`, `index.ts`, `postgres-property-repository.ts` ;
- API et runtime : `property.schema.ts`, `property.dto.ts`, `property.mapper.ts`, `app.module.ts`, `create-postgres-runtime-composition.ts`, `identity-external-authority.adapter.ts`, `authenticated-authority.ts` ;
- Web : `property-model.ts`, `property-api.ts`, `PropertyDetailPage.tsx`, `PropertyPages.test.tsx` ;
- preuves : tests unitaires, HTTP, OpenAPI, PostgreSQL et runtime ;
- documentation : README API, Web et Property Management, contrat OpenAPI généré.

Aucun fichier n’est supprimé et aucune dépendance n’est ajoutée.

## Tests et validations exécutés

| Commande | Résultat réel |
|---|---|
| `corepack pnpm -r typecheck` | PASS — 9 workspaces applicables |
| `corepack pnpm typecheck:tests` | PASS |
| `corepack pnpm app:api:openapi` | PASS — contrat régénéré |
| `corepack pnpm --filter @monpiole/web test` | PASS — 11 fichiers, 63 tests |
| `corepack pnpm test:unit tests/unit/property-management.test.ts` | PASS — 1 fichier, 11 tests |
| `corepack pnpm test:integration tests/integration/api-properties.test.ts` | PASS — 1 fichier, 12 tests |
| `corepack pnpm test:contract tests/contract/property-openapi.test.ts` | PASS — 1 fichier, 7 tests |
| `corepack pnpm service:property-management:test:integration` | PASS — 1 fichier, 25 tests PostgreSQL/Testcontainers |
| `corepack pnpm test:integration tests/integration/api-identity-postgres-runtime.test.ts` | PASS — 1 fichier, 8 tests |
| `corepack pnpm service:property-management:migration:check` | PASS — `Everything's fine` |
| `corepack pnpm app:api:build` | PASS |
| `corepack pnpm --filter @monpiole/web build` | PASS — 104 modules |
| `corepack pnpm architecture:check` | PASS |
| `corepack pnpm app:api:contracts:check` | PASS — 12 fichiers, 69 tests |
| `corepack pnpm test` | PASS — 63 fichiers, 454 tests |

Les premières exécutions Vitest et certains builds dans le sandbox Windows ont échoué avant chargement avec `spawn EPERM`; ils ont été relancés hors sandbox et les résultats finaux ci-dessus sont ceux des relances réussies. Une première commande Web ciblée utilisait `pnpm exec vitest`, non exposé directement par le package ; le script officiel `pnpm --filter @monpiole/web test` a ensuite passé.

Le build Web émet l’avertissement existant de chunk supérieur à 500 kB : JavaScript 541,36 kB, 159,68 kB gzip. Ce warning n’empêche pas le build.

## Risques et gaps résiduels

- aucune gestion de concurrence optimiste/version utilisateur n’est introduite ; les mises à jour atomiques restent sérialisées par verrou de ligne et la dernière écriture validée gagne ;
- le client Web continue de faire confiance aux réponses 2xx conformes au contrat sans parsing runtime ;
- aucun smoke test navigateur avec Auth0 et PostgreSQL réels n’est revendiqué ;
- le bundle Web reste au-dessus du seuil Vite ;
- la composition Building/Units, la publication et les capacités locatives restent explicitement différées.

## Statut final

**DONE.** La correction des informations fondamentales d’une Property est livrée de bout en bout, tenant-safe, autorisée explicitement, persistée sous PostgreSQL/RLS et accessible en français depuis la fiche Web. Toutes les validations requises exécutées passent.
