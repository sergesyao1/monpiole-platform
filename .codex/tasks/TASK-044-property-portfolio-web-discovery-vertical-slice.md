# TASK-044 — Property Portfolio Web Discovery Vertical Slice

- Statut : **DONE**
- Date : 2026-08-28

## Contexte

TASK-042 a livré `GET /v1/properties`, un portefeuille privé authentifié,
tenant-scoped, filtrable et paginé par curseur keyset. TASK-043 a vérifié cette
capacité et identifié son absence dans le navigateur comme le plus petit gap
cohérent à fermer avant Property Composition.

Avant TASK-044, `/properties` ne consommait pas cette API. La page permettait
seulement de créer un bien ou d’ouvrir une fiche avec un UUID connu et indiquait
à tort que la liste des biens n’était pas disponible.

## Problème

Le portefeuille existait dans le contrat, l’API et PostgreSQL, mais ne formait
pas un parcours utilisateur. Un utilisateur authentifié ne pouvait ni découvrir
les biens de son tenant, ni parcourir les pages, ni rejoindre une fiche sans
connaître son identifiant.

## Objectifs

- faire de `/properties` le point d’entrée réel du portefeuille privé ;
- utiliser le client HTTP authentifié et le contrat exact de TASK-042 ;
- afficher les données disponibles avec les mappings français existants ;
- proposer recherche, type et statut uniquement parce que l’API les publie ;
- charger explicitement la page suivante avec le curseur opaque du serveur ;
- préserver l’ordre serveur et éviter les doublons par `propertyId` ;
- conserver les résultats chargés lorsqu’une page suivante échoue ;
- relier le portefeuille aux parcours existants de création et de détail ;
- couvrir chargement, vide, résultat, fin, erreurs, session et responsive.

## Hors périmètre

- modification du domaine, de l’API ou de la persistance Property ;
- tenant ID, grants ou autorisation dérivés de claims/scopes OIDC côté web ;
- décodage, synthèse ou comparaison du curseur ;
- tri client, compteur total, infinite scroll, cache durable ou données fictives ;
- Building, Residence, Unit, publication, marketplace, médias, disponibilité,
  occupation, bail, paiement, suppression ou changement de statut ;
- listing/création de propriétaires et évolution de l’ownership ;
- refonte générale du frontend ou nouveau design system.

## Décisions d’implémentation

Le modèle web réutilise `Property` et définit l’item de portefeuille avec
`Omit<Property, "details" | "commercialTerms">`, conformément à la projection
publique. La page et les critères restent des types propres à la frontière HTTP
web ; aucun type Domain du service n’est importé.

`PropertyApi.listProperties` construit uniquement `limit`, `cursor`, `status`,
`type` et `search` avec `URLSearchParams`. Il ne transmet jamais de tenant. Le
client HTTP commun acquiert le bearer et conserve son renouvellement unique
après 401.

La page charge 20 éléments, remplace la collection lors d’un changement de
critères et accumule une page suivante dans l’ordre reçu. Elle filtre uniquement
les identifiants déjà présents afin qu’une page chevauchante ne duplique pas une
carte. Elle transmet le curseur comme une chaîne opaque. Une erreur initiale
utilise le feedback Property existant ; une erreur de page suivante reste
locale, garde les cartes et permet une nouvelle tentative.

Le rendu utilise une liste sémantique de cartes, des labels/formulaires
accessibles, `aria-busy`, des régions `status`/`alert`, les focus visibles et le
breakpoint responsive existants. Tous les contenus visibles sont en français et
les mappings d’enums restent centralisés dans `property-model.ts`.

## Critères d’acceptation

- [x] portefeuille intégré à `/properties` dans le shell protégé ;
- [x] appel réel de `GET /v1/properties` avec bearer et sans tenant client ;
- [x] cartes responsive fondées uniquement sur la projection TASK-042 ;
- [x] mappings français Property, transaction et statut réutilisés ;
- [x] navigation vers `/properties/:propertyId` et `/properties/new` ;
- [x] recherche et filtres limités aux paramètres publiés ;
- [x] curseur opaque conservé et page suivante explicitement chargée ;
- [x] accumulation ordonnée sans duplication et fin de pagination explicite ;
- [x] chargement initial, vide, résultat et chargement suivant couverts ;
- [x] erreur initiale et erreur suivante non destructive couvertes ;
- [x] session expirée, renouvellement 401 et absence d’appel avant session
  authentifiée couverts ;
- [x] parcours Property UI-003 sans régression ;
- [x] typecheck, build, tests ciblés et gates globales réussis.

## Fichiers principaux

Créés :

- `apps/web/src/features/properties/PropertyPortfolioPage.test.tsx` ;
- `.codex/tasks/TASK-044-property-portfolio-web-discovery-vertical-slice.md`.

Modifiés :

- `apps/web/src/features/properties/property-model.ts` ;
- `apps/web/src/features/properties/property-api.ts` ;
- `apps/web/src/features/properties/PropertyWorkspacePage.tsx` ;
- `apps/web/src/styles/global.css` ;
- `apps/web/src/app/App.test.tsx` ;
- `apps/web/README.md`.

Supprimés : aucun.

## Tests et validations exécutés

| Commande | Résultat réel |
|---|---|
| `corepack pnpm --filter @monpiole/web exec vitest run src/features/properties/PropertyPortfolioPage.test.tsx` | PASS — 1 fichier, 10 tests. |
| `corepack pnpm --filter @monpiole/web test` | PASS — 9 fichiers, 52 tests. Une première exécution a détecté l’ancien titre attendu par `App.test.tsx`; l’assertion et son mock ont été alignés sur le nouveau parcours, puis la suite a passé. |
| `corepack pnpm --filter @monpiole/web typecheck` | PASS. |
| `corepack pnpm --filter @monpiole/web build` | PASS — 100 modules transformés. Warning non bloquant : chunk JS minifié de 527,34 kB, supérieur au seuil Vite de 500 kB. |
| `corepack pnpm -r typecheck` | PASS — tous les workspaces applicables. |
| `corepack pnpm typecheck:tests` | PASS. |
| `corepack pnpm architecture:check` | PASS — workspace, exports, resolver, graph, frontières, cycles et diagnostics. |
| `corepack pnpm test:unit` | PASS — 20 fichiers, 132 tests. |
| `corepack pnpm test:integration` | PASS — 14 fichiers, 115 tests. La première tentative a été bloquée par Docker arrêté ; après `docker desktop start`, la relance complète a passé. |
| `corepack pnpm service:property-management:test:integration` | PASS — 1 fichier, 22 tests PostgreSQL. |
| `corepack pnpm test:contract` | PASS — 11 fichiers, 65 tests. |
| `corepack pnpm test` | PASS — 58 fichiers, 413 tests. La première tentative sans moteur Docker avait 53 fichiers/356 tests exécutés et cinq suites Testcontainers bloquées ; la relance avec Docker a intégralement passé. |

Le serveur Vite local a démarré correctement pour une vérification navigateur,
mais aucun navigateur contrôlable n’était connecté à la session. Aucun contrôle
visuel manuel n’est donc revendiqué. Le rendu reste vérifié par les tests jsdom,
le build de production et les règles CSS responsive inspectées.

## Limites et gaps résiduels

- l’API n’expose qu’un statut `DRAFT`, donc le filtre de statut a actuellement
  une seule valeur métier utile ;
- la recherche privée reste la recherche littérale PostgreSQL bornée de
  TASK-042, sans ranking ni full-text ;
- le client suppose, conformément au contrat, des réponses serveur valides et
  ne duplique pas les schémas Zod backend dans le bundle ;
- le warning de taille de chunk Vite mérite une mesure future mais ne provient
  pas d’une dépendance ajoutée par TASK-044 ;
- la liste des propriétaires et Property Composition restent hors périmètre.

## Résultat final

TASK-044 transforme le listing TASK-042 en parcours web authentifié utilisable,
français et tenant-safe sans étendre le backend. Le portefeuille permet la
découverte, le filtrage, la pagination résiliente, l’ouverture d’une fiche et la
création d’un bien. Toutes les validations obligatoires exécutables du workflow
ont passé après démarrage de Docker.

**Statut final : DONE.**
