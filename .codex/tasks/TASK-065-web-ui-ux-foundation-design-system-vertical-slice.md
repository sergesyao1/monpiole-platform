# TASK-065 — Web UI/UX Foundation & Design System Vertical Slice

## 1. Contexte

TASK-065 consolide l’interface React/Vite existante après les vertical slices Property, Owner, géolocalisation, publication, disponibilité/occupation et composition Building/Unit. Le travail reste local à `apps/web` : aucun comportement métier, contrat HTTP, modèle de domaine ou invariant de tenant n’a été modifié.

Verdict obtenu : **DONE**.

## 2. État Git initial

- Branche : `main`.
- HEAD initial : `f72570eb0658572fe5dfb714b8453d86ef8e0c6b` (`feat(property): add availability and occupancy`).
- Upstream : `origin/main` ; branche locale en avance de 48 commits au début de TASK-065.
- Working tree initial : propre (`git status --short` sans sortie).
- Aucun reset, checkout destructif, clean, stash, commit ou push n’a été effectué.

## 3. Audit UI/UX avant modification

L’audit a couvert l’intégralité de `apps/web`, `AGENTS.md`, les ADR et TD applicables, ainsi que les rapports TASK-044, 046, 048, 051, 053, 056, 058, 060, 062, 063 et 064. Le socle fonctionnel était sain : frontières public/privé, libellés français, labels de formulaires et focus visible étaient déjà présents.

La présentation reposait toutefois sur un unique `global.css` de 307 lignes, des classes textuelles répétées et aucune primitive React partagée. Le bundle était monolithique et Vite signalait un chunk supérieur à 500 kB.

## 4. Problèmes identifiés

- couleurs, espacements, rayons et ombres partiellement codés en dur ;
- 22 usages de `primary-action`, 37 de `secondary-action`, 14 structures `form-message` et 9 badges discrets avant migration ;
- formulaires anciens et récents visuellement incohérents ;
- loading, empty, error et success rendus avec plusieurs structures ;
- fiche Property très longue sans navigation contextuelle ;
- composition Building/Unit dense et formulaire d’unité toujours exposé ;
- actions destructrices non uniformes, sans confirmation pour photo et affectation Owner ;
- wording Home obsolète et contexte de topbar statique ;
- navigation mobile dimensionnée implicitement pour trois liens alors qu’elle en contenait quatre ;
- message « tous les biens disponibles » ambigu avec le concept métier Availability ;
- un seul chunk JavaScript de 594,05 kB (171,69 kB gzip).

## 5. Décisions de design

- conserver l’identité MonPiole existante : vert profond, accent doré, fonds chauds et titrage serif ;
- introduire des tokens sémantiques sans framework CSS externe ;
- créer seulement les primitives démontrées par plusieurs écrans ;
- préserver les contrôles HTML natifs et la sémantique React Router ;
- distinguer strictement lifecycle de publication, disponibilité et occupation ;
- rendre les actions destructrices rouges et confirmées ;
- garder les identifiants techniques comme références secondaires, jamais comme titres principaux ;
- appliquer un chargement paresseux par route sans modifier les routes statiques utilisées par les tests.

## 6. Architecture UI retenue

- `styles/tokens.css` : valeurs de référence sémantiques ;
- `styles/base.css` : reset, typographie globale, focus, skip link et réduction des animations ;
- `styles/ui.css` : primitives et compatibilité transitoire des classes historiques ;
- `styles/features.css` : composition des écrans et responsive ;
- `ui/` : composants React réutilisables ;
- `app/managed-routes.tsx` : routes de production paresseuses ;
- `app/routes.tsx` : routes statiques déterministes conservées pour les tests ;
- wrappers Auth0 paresseux séparés pour la connexion et l’espace privé.

Cette architecture reste strictement dans `apps/web`, conformément à ADR-0006 : aucun package partagé prématuré n’a été créé.

## 7. Design tokens

Tokens centralisés pour :

- palette brand/accent et surfaces ;
- texte, bordures et focus ;
- tons success, info, warning et danger ;
- familles et échelles typographiques ;
- poids et hauteurs de ligne ;
- échelle d’espacement ;
- rayons et ombres ;
- largeurs de contenu, sidebar et breakpoints documentés.

## 8. Primitives créées

- `Button` et `buttonClassName` : variantes primary, secondary, subtle, ghost et danger, plus état loading accessible ;
- `Field` : association label/control, aide, erreur et `aria-describedby`/`aria-invalid` ;
- `Alert` : info, success, warning et danger ;
- `LoadingState` et `EmptyState` ;
- `StatusBadge` : neutral, info, success, warning et danger ;
- `Breadcrumbs`, `PageHeader` et `SectionHeader` ;
- barrel `ui/index.ts` ;
- 3 tests ciblés des primitives.

## 9. Shell/navigation

- navigation groupée entre espace de travail et assistance ;
- libellé de topbar calculé depuis la route courante ;
- bouton de déconnexion migré vers la primitive commune ;
- navigation mobile horizontale, scrollable et sans hypothèse sur le nombre de liens ;
- wording Home actualisé pour refléter les fonctions réellement livrées ;
- skip link et identité de session conservés.

## 10. Formulaires

Les formulaires de création Property, informations fondamentales, Owner, filtres Portfolio/Owner/catalogue, Availability, géolocalisation, photo et affectation Owner utilisent les contrôles et actions communs. Les champs facultatifs sont visibles sans altérer le nom accessible exact du label. Les formulaires métier complexes conservent leurs fieldsets, legends, contraintes natives et validation existante.

## 11. États applicatifs

Loading, empty, error et success reposent désormais sur des primitives cohérentes. Les erreurs de session gardent l’action de reconnexion ; les erreurs de pagination n’effacent pas les données déjà affichées. Le client public refuse explicitement une réponse HTTP 2xx vide au lieu de laisser une mise à jour React échouer hors du `try/catch`.

## 12. Status/badges

Les statuts Property, Owner, Publication, Availability et Occupancy utilisent les mêmes tons et la même géométrie. La couleur complète le texte mais ne le remplace jamais.

## 13. Property portfolio

- filtres harmonisés ;
- CTA communs ;
- états vide, chargement et erreur cohérents ;
- badges Brouillon/Publié/Retiré ;
- wording final « Tous les biens sont affichés » pour ne pas confondre pagination et disponibilité métier ;
- cartes, métadonnées et grille responsive harmonisées.

## 14. Property detail

- `PageHeader` avec fil d’Ariane, statut et référence interne secondaire ;
- navigation sticky entre vue d’ensemble, disponibilité, publication, photos, informations, localisation, propriétaires et composition ;
- ordre clarifié sans fusion des concepts ;
- breadcrumb enrichi lors de l’ouverture d’une Unit depuis sa composition parent ;
- succès, erreurs, badges et CTA harmonisés ;
- formulaires existants et invariants métier conservés.

## 15. Owner

Annuaire, création, détail et affectation utilisent les mêmes champs, badges, états et CTA que Property. Les types personne physique/morale restent explicites. Le retrait d’une affectation demande désormais confirmation.

## 16. Building/Unit

- chaque Building est une carte structurée avec code, nom et action de chargement des unités ;
- création et modification utilisent une grille de formulaire cohérente ;
- la création d’une Unit est placée dans un panneau `details` de divulgation progressive ;
- chaque Unit est une carte avec résumé, modification du code, accès à la fiche et disponibilité compacte ;
- les états vides, erreurs partielles et paginations restent locaux ;
- le lien Unit transmet le contexte parent pour le fil d’Ariane.

## 17. Publication/withdrawal

Publication et retrait conservent leurs prérequis, confirmations et requêtes bodyless. Le retrait est présenté comme action danger. Les statuts Brouillon/Publié/Retiré sont cohérents et la copie rappelle que le bien reste dans le portefeuille après retrait.

## 18. Availability/Occupancy

Les deux valeurs restent affichées et modifiées ensemble, mais distinctement. Les ensembles composites restent dérivés des Units et non modifiables directement. L’aide pour la courte durée rappelle qu’une disponibilité globale ne garantit pas une date précise. Aucun état de publication n’est utilisé comme disponibilité.

## 19. Catalogue public

- hero et hiérarchie éditoriale conservés puis harmonisés avec les tokens ;
- filtres, alertes, chargement, état vide, badges et CTA migrés ;
- cartes et détail public responsives ;
- aucune donnée privée, Availability/Occupancy ou identifiant interne exposé ;
- Auth0 n’est pas chargé par la route catalogue ;
- la page connexion reçoit son propre provider Auth0 paresseux.

## 20. Responsive

Breakpoints traités à 64 rem, 56,25 rem, 48 rem et 38,75 rem selon les composants. Grilles Portfolio/catalogue/détail, formulaires, shell, navigation et actions se replient progressivement. Revue navigateur réelle :

- catalogue à 1440 × 900 : pas de débordement horizontal ;
- catalogue à 390 × 844 : `scrollWidth` inférieur à `innerWidth`, filtres sur une colonne, header replié ;
- connexion à 1280 × 800 : carte centrée, hiérarchie et CTA lisibles ;
- viewport navigateur réinitialisé après validation.

## 21. Accessibilité

- focus visible global renforcé ;
- skip links privés et publics conservés ;
- labels exacts reliés à leurs contrôles ;
- aides et erreurs reliées par `aria-describedby` ;
- `aria-invalid` sur erreur ;
- loading avec `role=status` et `aria-busy` ;
- erreurs danger avec `role=alert` ;
- titres d’états navigables comme headings ;
- `aria-current` sur breadcrumbs et navigation ;
- réduction des animations avec `prefers-reduced-motion` ;
- actions destructrices textuelles et confirmées.

## 22. Français

Les libellés fonctionnels restent français. Les textes obsolètes ont été remplacés et les termes techniques sont relégués aux références internes. Les enums métier continuent d’être traduits dans le modèle de présentation.

## 23. Performance

Les pages de fonctionnalités et les wrappers Auth0 sont chargés avec les routes `lazy` de React Router. Les routes statiques de test ne sont pas importées par le point d’entrée de production. Aucun préchargement massif, framework CSS ou dépendance runtime n’a été ajouté.

## 24. Bundle avant/après

Avant :

- CSS : 22,20 kB, 5,11 kB gzip ;
- JavaScript unique : 594,05 kB, 171,69 kB gzip ;
- avertissement Vite au-dessus de 500 kB.

Après :

- CSS : 38,57 kB, 7,38 kB gzip ;
- chunk d’entrée : 293,95 kB, 93,18 kB gzip ;
- Auth0 isolé : 209,18 kB, 60,03 kB gzip ;
- Property Detail : 51,49 kB, 12,30 kB gzip ;
- autres routes : 0,92 à 6,79 kB hors dépendances partagées ;
- aucun avertissement Vite de chunk supérieur à 500 kB.

Le CSS augmente de 16,37 kB pour couvrir le socle UI complet ; le JavaScript initial diminue de 300,10 kB, soit environ 50,5 %.

## 25. Dépendances

Aucune dépendance ajoutée, supprimée ou mise à jour. `package.json`, `pnpm-lock.yaml` et les manifests workspace restent inchangés.

## 26. Sécurité

- aucune frontière Auth0, bearer token, autorisation ou tenant isolation contournée ;
- catalogue public toujours sans bearer ni donnée privée ;
- confirmation ajoutée aux suppressions de photo et retraits d’affectation Owner ;
- `pnpm audit --audit-level high` : PASS, 0 high, 0 critical ;
- dette connue inchangée : 1 moderate dev-only, `esbuild@0.18.20` via `drizzle-kit`/`@esbuild-kit`, GHSA-67mh-4wv8-2f99 ;
- aucune mise à jour forcée hors scope.

## 27. Tests

Tests créés ou adaptés :

- `ui/ui.test.tsx` : variantes/chargement Button, associations Field, feedback, badge, breadcrumb et page header ;
- Availability : assertion sur le badge sémantique plutôt que sur une structure `dd` plate ;
- Portfolio : wording sans confusion Availability ;
- Photo : confirmation destructrice vérifiée ;
- Property : nouveau statut contextuel pris en compte après retrait.

Les assertions métier n’ont pas été réduites.

## 28. Résultats exacts des validations

| Validation | Résultat |
| --- | --- |
| UI ciblé (`vitest run src/ui/ui.test.tsx`) | PASS — 1 fichier, 3 tests |
| Web complet (`pnpm --filter @monpiole/web test`) | PASS — 18 fichiers, 132 tests |
| Unit (`pnpm test:unit`) | PASS — 27 fichiers, 205 tests |
| Contract (`pnpm test:contract`) | PASS — 16 fichiers, 92 tests |
| Integration (`vitest --project integration`) | PASS — 40 fichiers, 183 tests |
| PostgreSQL/Testcontainers (`vitest --project persistence-integration`) | PASS — 19 fichiers, 108 tests |
| Matrice Vitest complète configurée | PASS — 120 fichiers, 720 tests, 0 échec, 0 ignoré |
| Docker | PASS — client/server 29.7.2 ; PostgreSQL Testcontainers réel exécuté |
| Typecheck Web | PASS |
| Typecheck récursif, 9 projets | PASS |
| Typecheck tests | PASS |
| Build Web | PASS — 122 modules, sans warning chunk |
| Architecture check | PASS — workspace, exports, resolver, graph, boundaries, cycles, diagnostics |
| Audit sécurité high | PASS — 0 high, 0 critical, 1 moderate connue |
| `git diff --check` | PASS |

La commande agrégée `pnpm test` a été tentée, mais sous Windows son parent a rendu la main en laissant les workers multi-projets orphelins et sans résumé capturable. Ces workers temporaires précis ont été arrêtés, puis chacun des cinq projets déclarés dans `vitest.config.ts` a été exécuté séparément et intégralement. Les deux projets d’intégration ont produit des rapports JSON temporaires hors repository. Une invocation intermédiaire avec un reporter Vitest inexistant (`basic`) a échoué au démarrage ; elle ne constitue pas un échec de test et a été remplacée par les scripts du repository.

Build API et OpenAPI non exécutés : aucune dépendance commune, API, DTO, schéma ou contrat n’a été touché. Les contracts ont été validés par le projet Contract complet.

## 29. Fichiers principaux modifiés

Ajoutés :

- `apps/web/src/styles/{tokens,base,ui,features}.css` ;
- `apps/web/src/ui/Button.tsx`, `Field.tsx`, `Feedback.tsx`, `StatusBadge.tsx`, `Layout.tsx`, `index.ts` et `ui.test.tsx` ;
- `apps/web/src/app/managed-routes.tsx` ;
- `apps/web/src/auth/ManagedAuthenticationBoundary.tsx` ;
- `apps/web/src/auth/ManagedLoginPage.tsx` ;
- ce rapport.

Corrigés/harmonisés : shell, pages génériques, authentification, Portfolio, création/détail Property, formulaires Property, Owner, Ownership, Availability, Publication, géolocalisation, photos, composition Building/Unit, catalogue public et tests associés. `global.css` devient uniquement le point d’import des quatre couches CSS.

Conservés intacts : backend, services, packages, migrations, OpenAPI, contrats HTTP, modèles de domaine, manifests et lockfile.

## 30. Éventuels écarts

- Aucun changement hors TASK-065 trouvé dans le working tree initial, qui était propre.
- La commande agrégée globale a été remplacée par l’exécution exacte de ses cinq projets à cause du détachement de workers Windows documenté ci-dessus.
- Le build API et OpenAPI étaient conditionnels et n’étaient pas nécessaires dans ce scope Web-only.

## 31. Dette résiduelle

- le design system reste volontairement local à `apps/web` jusqu’à preuve d’un second consommateur ;
- certaines formes très spécialisées, notamment les détails commerciaux denses, utilisent encore leur markup métier local tout en héritant des tokens et contrôles communs ;
- la revue visuelle authentifiée complète nécessite une session Auth0 réelle ; elle est couverte ici par tests DOM/route et la revue navigateur publique/connexion ;
- vulnérabilité modérée transitive `esbuild` dev-only inchangée ;
- pas de dark mode complet ni d’i18n, explicitement hors scope.

## 32. Exclusions

Aucune tarification avancée, calendrier, promotion, upload/CDN, recherche avancée, favoris, leads, messagerie, réservation, paiement, notification temps réel, moteur cartographique, application mobile, migration de framework, refonte API/DDD/PostgreSQL ou redesign complet de marque n’a été introduit.

## 33. Verdict final

**DONE** — le Web dispose d’un socle UI centralisé et réutilisé, les principaux parcours existants sont harmonisés, les concepts métier restent séparés, le responsive et l’accessibilité de base sont renforcés, le bundle initial est réduit de moitié et l’ensemble des quality gates exécutés est vert. Aucun commit ni push n’a été créé.
