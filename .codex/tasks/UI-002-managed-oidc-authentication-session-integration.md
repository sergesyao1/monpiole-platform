# UI-002 — Managed OIDC Authentication & Session Integration

- Status: **DONE**
- Date: 2026-08-26

## Contexte et état initial constaté

L’audit du repository a confirmé ADR-0007 et TASK-033 : Auth0 Public Cloud est
le fournisseur OIDC de référence, l’API valide strictement issuer, audience,
signature RS256, temporalité et subject, puis MonPiole résout `issuer + subject`
vers les grants et tenant scopes internes. TASK-031 sépare déjà authentification
HTTP et autorisation Application.

UI-001 avait créé `apps/web` avec React 19, Vite 8, React Router 8, Vitest, une
configuration publique et un client HTTP acceptant un token optionnel. Aucun
login, callback, session, logout ou route protégée n’existait. Les packages
partagés ne contiennent pas de contrat navigateur applicable. Le Git status
initial était propre.

## Objectif

Établir dans le shell Web une frontière OIDC exploitable : login Auth0,
callback/restauration, session typée, routes protégées, logout et client API
bearer, sans déplacer l’autorité métier ni l’isolation tenant dans le frontend.

## Périmètre

- SDK Auth0 officiel pour SPA React et Authorization Code + PKCE ;
- configuration publique obligatoire et validée ;
- états loading/authenticated/unauthenticated/error ;
- route publique `/connexion` et shell protégé ;
- identité UI minimale, login et logout en français ;
- acquisition silencieuse du token d’audience API ;
- injection bearer centralisée, traitement distinct de 401/403 ;
- tests unitaires/UI sans accès Internet ;
- documentation locale et Technology Decision.

## Hors périmètre

CRUD et écrans métier, RBAC frontend, rôles, grants, tenant management,
administration utilisateur, MFA personnalisé, changement d’IdP, mot de passe,
refresh maison et stockage manuel des tokens.

## Décisions et architecture retenue

TD-014 sélectionne `@auth0/auth0-react` `2.24.1`, exact-pinné et compatible
React 19. Le provider Auth0 est composé au root. `src/auth` traduit ses détails
vers l’interface interne `Session`; le routing et le shell ne dépendentent donc
pas du SDK.

Le SDK traite automatiquement le callback `code/state` et restaure la session.
`onRedirectCallback` ne restaure qu’un chemin local sûr. Après l’échec du cache
`memory` observé pendant UI-002A, TD-015 le supersède par un `ICache` officiel
Auth0 namespacé dans `sessionStorage`. Le SDK reste seul responsable des tokens
et de leur rotation ; le code applicatif ne lit ni ne journalise leur valeur.
Le cache survit au reload du même onglet, disparaît avec sa session et n’utilise
jamais `localStorage` ou IndexedDB. La contrepartie XSS est documentée dans
TD-015.

`createAuthenticatedApiClient` demande le token à la session et ajoute le
header. Après un 401, il force exactement une acquisition hors cache et rejoue
la requête une fois. Un second 401 devient `ApiSessionExpiredError`, sans login
automatique. Un 403 devient `ApiForbiddenError`, sans renouvellement ni logout.
Les messages sont français et aucun token n’est loggé.

OIDC authentifie uniquement. Les claims/scopes ne sont jamais interprétés comme
grants métier ; l’API reste seule responsable des permissions et tenant scopes.

## Fichiers principaux

Créés :

- `.codex/tasks/UI-002-managed-oidc-authentication-session-integration.md` ;
- `engineering/decisions/td-014-web-managed-oidc-client.md` ;
- `apps/web/src/auth/session.ts` ;
- `apps/web/src/auth/Auth0SessionProvider.tsx` et son test ;
- `apps/web/src/auth/AuthenticationBoundary.tsx` ;
- `apps/web/src/auth/LoginPage.tsx`.

Modifiés : configuration/test/env/README Web, composition/routing/shell/CSS,
client HTTP/test, manifests pnpm, inventaire TD et configurations Vitest.
Supprimés : aucun.

## Stratégie de tests

Les tests remplacent le SDK et `fetch` aux frontières. Ils couvrent les quatre
états de session, paramètres provider/login/logout/token, route protégée avec et
sans session, absence de redirection pendant loading, erreur d’initialisation,
configuration valide/invalide, bearer/public, headers, unique retry 401, 403 et
absence de fuite du token.

## Critères d’acceptation

- [x] Auth0 officiel intégré sans secret client ;
- [x] login, callback SDK, restauration et logout intégrés ;
- [x] quatre états de session explicites et routes protégées ;
- [x] access token d’audience API et bearer centralisé ;
- [x] aucun stockage/log manuel du token ;
- [x] 401 explicite, renouvelé une fois et sans boucle ;
- [x] 403 distinct sans déconnexion ;
- [x] aucune autorité métier/tenant côté frontend ;
- [x] interface visible en français ;
- [x] tests frontend principaux ajoutés ;
- [x] build, tests backend et architecture validés ;
- [x] configuration et opérations Auth0 documentées.

## Validations exécutées

- `corepack pnpm install --frozen-lockfile` : PASS ;
- `corepack pnpm --filter @monpiole/web typecheck` : PASS ;
- `corepack pnpm --filter @monpiole/web test` : PASS — 4 fichiers, 24 tests ;
- `corepack pnpm --filter @monpiole/web build` : PASS — 87 modules ;
- `corepack pnpm typecheck:tests` : PASS ;
- `corepack pnpm app:api:typecheck` : PASS ;
- `corepack pnpm app:api:build` : PASS ;
- `corepack pnpm test` : PASS — 43 fichiers, 306 tests ;
- `corepack pnpm architecture:check` : PASS ;
- `corepack pnpm audit --audit-level high` : PASS — aucun high/critical,
  un advisory moderate préexistant dans la chaîne Drizzle Kit/esbuild ;
- `git diff --check` : PASS.

Le repository ne définit pas de script racine `typecheck`; les scripts réels
`typecheck:tests`, Web et API ont été exécutés à sa place.

## Gaps et opérations restantes

Le tenant, l’application SPA et l’API doivent être provisionnés manuellement
dans Auth0. Les callback/logout/web origins exactes, audience, issuer, rotation
des refresh tokens, politiques MFA et liens `issuer + subject` internes doivent
être configurés par environnement. Aucun test n’utilise un tenant Auth0 réel ;
un smoke test d’environnement déployé reste nécessaire avant production.

## Statut final

**DONE** — critères satisfaits, validations réussies et diff revu. La tâche est
prête pour validation propriétaire ; aucun commit n’a été créé.

> Addendum UI-002A : le smoke Auth0 réel a montré que la restauration basée sur
> le cache mémoire et l’iframe silent n’était pas fiable dans le navigateur
> cible. TD-015 supersède uniquement cette stratégie de cache par un `ICache`
> SDK limité à `sessionStorage`; les autres décisions UI-002 restent inchangées.

Le smoke final UI-002A confirme désormais en environnement réel le login PKCE,
le callback, la restauration F5, l’appel API bearer HTTP 200, le logout, le 401
sans redirection et le 403 sans déconnexion suivi d’une session HTTP 200. UI-002
reste donc **DONE**, avec TD-015 comme stratégie de cache effective.
