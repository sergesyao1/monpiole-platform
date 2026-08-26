# TD-013 — Web frontend foundation

- Status: **APPROVED — BASELINE IMPLEMENTED BY UI-001**
- Date: 2026-08-26
- Governing decision: [ADR-0002](../adr/0002-technology-selection-gate.md)
- Decision owner: Web Engineering

## Context

`apps/web` était un placeholder sans runtime. MonPiole a besoin d'une application
métier navigateur maintenable, compatible avec TypeScript strict, pnpm, Vitest,
les contrats HTTP `/v1` et la future authentification Managed OIDC. Aucun ADR ou
TD existant ne sélectionnait de framework frontend.

## Decision

Adopter une Single Page Application composée de :

- React `19.2.8` pour les composants ;
- Vite `8.2.2` et `@vitejs/plugin-react` `6.1.0` pour le développement et le
  build statique ;
- React Router `8.3.0` en mode déclaratif pour la navigation côté client ;
- CSS natif local à l'application pour la fondation visuelle ;
- Vitest `4.1.11`, jsdom et Testing Library pour les tests centrés utilisateur.

Les versions sont exactes conformément à TD-002. Node `24.18.0` satisfait les
contraintes déclarées par Vite, React Router et jsdom.

Le mode déclaratif de React Router est suffisant pour le shell et conserve la
composition sous le contrôle de l'application. Aucun serveur frontend, SSR,
framework full-stack, state manager ou bibliothèque UI n'est sélectionné.

## Architecture

`apps/web` possède la composition, le routing, la configuration publique et les
adaptateurs navigateur. Les futurs vertical slices UI seront structurés par
feature. Ils consommeront les APIs versionnées sans importer les sources privées
de `apps/api` ou les internals des services.

Le client HTTP minimal comprend la base URL, la corrélation, le JSON, le bearer
token optionnel et la reconnaissance structurelle de Problem Details. Il ne
constitue pas encore un SDK et ne duplique aucun modèle métier.

## Security and authentication boundary

Les variables `VITE_*` sont publiques par définition et ne doivent contenir
aucun secret. Les paramètres publics OIDC sont réservés, mais UI-001 n'implémente
ni login local, ni stockage de token, ni décision d'autorisation côté client.
L'autorisation métier reste exclusivement serveur.

## Alternatives considered

- Next.js : capacités serveur, SSR et conventions full-stack non démontrées pour
  ce premier shell ; coût et surface opérationnelle prématurés.
- Vue ou Svelte : options viables, mais sans avantage démontré qui justifierait
  de s'écarter de React et de son écosystème de bibliothèques métier et OIDC.
- HTML/TypeScript sans framework : dépendances minimales, mais composition et
  évolution des futurs écrans métier moins structurées.
- Bibliothèque UI complète : différée jusqu'à des besoins de composants répétés
  et mesurables.

## Consequences

Le build produit des actifs statiques et l'hébergement devra rediriger les URLs
SPA vers `index.html`. Une future tâche doit sélectionner et intégrer le client
OIDC public approprié. L'évolution vers un design system ou un SDK partagé reste
conditionnée par une réutilisation démontrée avec `apps/admin` ou `apps/mobile`.
