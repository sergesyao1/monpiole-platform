# TD-014 — Client OIDC managé du Web

- Status: **APPROVED — BASELINE IMPLEMENTED BY UI-002**
- Date: 2026-08-26
- Governing decisions: [ADR-0007](../adr/0007-managed-oidc-authentication.md), [TD-013](td-013-web-frontend-foundation.md)
- Decision owner: Web Engineering / Security

## Context

TD-013 a établi la SPA React mais a explicitement reporté le choix du client
OIDC. UI-002 doit intégrer Auth0 sans réimplémenter OAuth/OIDC, exposer une
session stable aux features et conserver l’API comme autorité métier.

## Decision

Utiliser le SDK officiel `@auth0/auth0-react` `2.24.1`, exact-pinné. Le SDK
exécute Authorization Code Flow avec PKCE pour la SPA, traite le callback,
restaure la session Auth0 et acquiert les access tokens destinés à l’audience
API configurée.

Le cache SDK est `memory`. Les refresh tokens rotatifs sont demandés au
fournisseur et restent gérés par le SDK ; aucun bearer ou refresh token n’est
persisté manuellement par MonPiole dans Web Storage ou IndexedDB. Après un
rechargement qui vide ce cache, le fallback silencieux du SDK peut utiliser la
session Auth0 pour restaurer l’utilisateur ; il ne persiste aucun bearer.

`apps/web/src/auth` adapte le SDK vers une interface `Session` appartenant à
l’application. Le routing, le shell et les futurs composants métier ne
dépendent pas directement d’Auth0. Le client HTTP authentifié obtient un token
par cette interface, renouvelle au plus une fois après un 401, puis retourne une
erreur de session expirée. Un 403 reste une erreur d’autorisation distincte.

## Security boundary

Les claims et scopes OIDC ne deviennent jamais des grants MonPiole. Le frontend
peut afficher le nom ou l’e-mail standard, mais l’API continue seule à résoudre
`issuer + subject`, les grants, les memberships et les tenant scopes.

Les seules valeurs `VITE_*` sont des coordonnées publiques : issuer, client ID,
audience et URLs de redirection. Aucun client secret n’est autorisé dans la SPA.

## Consequences

- Une restauration après rechargement dépend de la session Auth0 et du
  renouvellement géré par le SDK ; le cache de tokens en mémoire repart vide.
- Auth0 doit autoriser exactement les callback, logout et web origins de chaque
  environnement.
- Les déploiements doivent injecter toute la configuration publique obligatoire.
- Un stockage persistant ou un changement de fournisseur exigerait une nouvelle
  revue de sécurité et de décision.
