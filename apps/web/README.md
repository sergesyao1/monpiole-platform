# apps/web

Application web principale de MonPiole, construite avec React, Vite et React
Router. Elle possède la composition des routes et consomme uniquement les
contrats HTTP publics de la plateforme.

## Commandes

Depuis la racine du dépôt :

```text
corepack pnpm --filter @monpiole/web dev
corepack pnpm --filter @monpiole/web build
corepack pnpm --filter @monpiole/web typecheck
corepack pnpm --filter @monpiole/web test
```

Copier `apps/web/.env.example` vers `apps/web/.env.local` pour personnaliser la
configuration locale. Toutes les variables `VITE_*` sont publiques dans le
navigateur : aucun secret ne doit y être placé.

## Frontières

- `src/app` compose le shell et les routes.
- `src/config` valide la configuration publique.
- `src/infrastructure/http` contient l'adaptateur HTTP générique minimal.
- Les futurs vertical slices restent isolés par feature et ne placent pas de
  logique métier dans le shell.
- L'intégration OIDC utilisateur est différée ; aucune authentification locale
  ou simulée n'est fournie.
