# apps/web

Application Web MonPiole, construite avec React, Vite et React Router. Elle
possède la composition des routes, consomme uniquement les contrats HTTP publics
et délègue l’authentification à Auth0 conformément à ADR-0007 et TD-014.

## Lancement local

Copier `.env.example` vers `.env.local`, renseigner les coordonnées publiques de
l’application Auth0 SPA, puis lancer depuis la racine :

```text
corepack pnpm --filter @monpiole/web dev
corepack pnpm --filter @monpiole/web typecheck
corepack pnpm --filter @monpiole/web test
corepack pnpm --filter @monpiole/web build
```

## Configuration publique

Toutes les variables `VITE_*` sont intégrées au bundle navigateur. Elles ne
doivent jamais contenir de client secret, token ou credential.

| Variable | Rôle |
| --- | --- |
| `VITE_API_BASE_URL` | Origine de l’API MonPiole. |
| `VITE_OIDC_ISSUER` | Issuer HTTPS Auth0, identique à celui validé par l’API. |
| `VITE_OIDC_CLIENT_ID` | Identifiant public de l’application Auth0 de type SPA. |
| `VITE_OIDC_AUDIENCE` | Identifiant de l’API Auth0, identique à l’audience attendue par l’API MonPiole. |
| `VITE_OIDC_REDIRECT_URI` | URL de callback SPA après connexion. |
| `VITE_OIDC_LOGOUT_RETURN_URI` | URL de retour autorisée après déconnexion. |

Une valeur obligatoire absente, un issuer non HTTPS ou une URL invalide produit
une erreur de configuration déterministe au démarrage.

## Configuration manuelle Auth0

Créer/configurer une **Single Page Application** et une API dans le tenant Auth0
de l’environnement. Dans les paramètres de l’application, autoriser exactement :

- `http://localhost:5173` dans **Allowed Callback URLs** ;
- `http://localhost:5173/connexion` dans **Allowed Logout URLs** ;
- `http://localhost:5173` dans **Allowed Web Origins**.

Configurer l’audience de l’API et l’issuer avec les mêmes valeurs que
`AUTHENTICATION_AUDIENCE` et `AUTHENTICATION_ISSUER` côté API. Activer la
rotation des refresh tokens conformément à ADR-0007. Répéter avec les URLs
exactes de chaque environnement ; aucun credential réel n’est documenté ici.

## Comportement d’authentification

Le SDK officiel Auth0 utilise Authorization Code avec PKCE, traite le callback
et restaure la session. Son cache est en mémoire ; MonPiole ne persiste jamais
manuellement de bearer token. Le refresh token rotatif, lorsqu’il est émis, est
entièrement géré par le SDK. Après rechargement, le SDK peut utiliser la session
Auth0 via son fallback silencieux pour repeupler le cache mémoire.

Toutes les routes du shell sont protégées ; `/connexion` reste publique. Pendant
l’initialisation, une page de chargement empêche les redirections et appels
prématurés. `src/auth` expose une abstraction `Session` afin que le shell et les
features ne dépendent pas directement d’Auth0.

Le client HTTP authentifié ajoute le bearer, retente une seule fois avec un token
renouvelé après 401, puis signale une session expirée sans déclencher de boucle
de login. Un 403 signale un refus d’autorisation distinct sans déconnecter.

OIDC authentifie l’utilisateur. Les scopes et claims ne sont pas des grants
métier : l’API reste l’unique autorité pour les permissions et l’isolation tenant.

## Smoke test UI-002A

La route protégée `/diagnostic-authentification` propose **Vérifier ma session
API**. Elle obtient un access token via la session et appelle
`GET /v1/authentication/session` via le client centralisé. Elle n’affiche ni
token, ni grants, ni tenant scope. Un succès confirme la vérification OIDC et la
résolution interne ; 401 et 403 conservent leurs messages français distincts.

## Frontières

- `src/app` compose le shell et les routes ;
- `src/auth` adapte Auth0 vers la session frontend ;
- `src/config` valide la configuration publique ;
- `src/infrastructure/http` centralise transport, bearer et erreurs HTTP ;
- les vertical slices métier restent isolés par feature.
