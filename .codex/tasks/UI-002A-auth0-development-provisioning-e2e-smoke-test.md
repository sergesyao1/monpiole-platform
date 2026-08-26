# UI-002A — Auth0 Development Provisioning & End-to-End Authentication Smoke Test

- Date: 2026-08-26
- Status: **BLOCKED — API OIDC RUNTIME COMPOSITION AND MANUAL AUTH0 ACCESS REQUIRED**

## État initial

Le dépôt est propre au départ et contient UI-002 au commit `4fe631d`. Le Web
compose `@auth0/auth0-react`, protège le shell, traite callback, restauration et
logout, conserve le cache en mémoire et expose un client HTTP bearer. Les tests
utilisent uniquement des coordonnées OIDC synthétiques.

ADR-0007 confirme Auth0 Public Cloud. TASK-033 impose issuer/audience/JWKS
exacts, RS256, `exp`, `iat`, âge maximal et `sub`, puis un mapping interne
`issuer + subject`. E-mail, scopes, claims et rôles Auth0 ne donnent aucun grant
ou tenant scope.

## Audit de faisabilité

Le smoke test réel ne peut pas être exécuté dans l’état actuel :

1. aucun navigateur contrôlable n’est disponible dans cet environnement ;
2. aucun accès/connector Auth0 Management n’est disponible ;
3. `createPostgresApiRuntime` ne compose ni `OidcAccessTokenVerifier` ni
   `OidcAuthenticatedAuthorityProvider` ; le provider fail-closed retourne 401 ;
4. aucun `ExternalIdentityAuthorityResolver` durable ne mappe `issuer + subject` ;
5. l’API n’active aucune politique CORS navigateur ;
6. aucune page Web actuelle ne déclenche un appel métier protégé ;
7. le dépôt ne fournit ni composition PostgreSQL locale ni commande d’application
   des migrations ; le runtime exige TLS hors tests.

Aucun fallback administrateur, mapping par e-mail/scope, ou affaiblissement JWT
n’a été ajouté pour contourner ces gates.

## Contrat attendu

Les exemples suivants ne désignent pas un tenant réellement provisionné.

| Élément | Web | Auth0 | API |
| --- | --- | --- | --- |
| Issuer | `VITE_OIDC_ISSUER=https://<tenant-dev>.eu.auth0.com/` | Domain du tenant et claim `iss` | `AUTHENTICATION_ISSUER`, identique avec slash final |
| Audience | `VITE_OIDC_AUDIENCE=https://api.monpiole.local` | API Identifier | `AUTHENTICATION_AUDIENCE`, identique |
| Client SPA | `VITE_OIDC_CLIENT_ID=<public-client-id>` | Single Page Application | Non utilisé par la resource API |
| Callback | `http://localhost:5173` | Allowed Callback URLs | Sans objet |
| Logout | `http://localhost:5173/connexion` | Allowed Logout URLs | Sans objet |
| Web Origin | `http://localhost:5173` | Allowed Web Origins | future allowlist CORS exacte |
| JWKS | Sans objet | clés publiques | `https://<tenant-dev>.eu.auth0.com/.well-known/jwks.json` |
| JWT | token de l’audience API | RS256 | allowlist RS256 ; `sub`, `iat`, `exp` requis |

L’API applique 30 secondes de tolérance et 900 secondes d’âge maximal par
défaut, bornés respectivement à 0–120 et 60–3600 secondes.

## Configuration réellement utilisée

Aucune. Aucun tenant, client ID réel, subject, token, cookie ou credential Auth0
n’a été accessible. Seules des valeurs d’exemple non sensibles sont consignées.

Les configurations réelles doivent rester dans `apps/web/.env.local` et dans un
mécanisme local d’injection API. `.gitignore` ignore `.env.*`, y compris
`apps/web/.env.local`, `.env.local` et `apps/api/.env.local`. Une SPA ne doit
jamais recevoir de `client_secret`.

## Provisioning Auth0 manuel

Dans un tenant réservé au développement MonPiole :

1. créer une application **Single Page Application** ;
2. autoriser exactement `http://localhost:5173` comme callback ;
3. autoriser exactement `http://localhost:5173/connexion` comme logout ;
4. autoriser exactement `http://localhost:5173` comme Web Origin ;
5. créer une API d’Identifier `https://api.monpiole.local`, avec RS256 ;
6. activer rotation et détection de réutilisation des refresh tokens ;
7. appliquer la MFA aux comptes privilégiés conformément à ADR-0007 ; une
   relaxation de développement ne prouve pas la baseline de production ;
8. créer un utilisateur synthétique et relever son `sub` sans le publier.

## Configuration Web

Créer `apps/web/.env.local` depuis `.env.example`, renseigner le vrai issuer et
client ID public, puis conserver :

```text
VITE_API_BASE_URL=http://localhost:3000
VITE_OIDC_AUDIENCE=https://api.monpiole.local
VITE_OIDC_REDIRECT_URI=http://localhost:5173
VITE_OIDC_LOGOUT_RETURN_URI=http://localhost:5173/connexion
```

Commande existante : `corepack pnpm --filter @monpiole/web dev`.

## Configuration API attendue

Injecter localement, sans commit :

```text
AUTHENTICATION_ISSUER=https://<tenant-dev>.eu.auth0.com/
AUTHENTICATION_AUDIENCE=https://api.monpiole.local
AUTHENTICATION_JWKS_URI=https://<tenant-dev>.eu.auth0.com/.well-known/jwks.json
AUTHENTICATION_JWT_ALGORITHM=RS256
AUTHENTICATION_CLOCK_TOLERANCE_SECONDS=30
AUTHENTICATION_MAX_TOKEN_AGE_SECONDS=900
```

Ces variables sont exemplifiées dans `.env.example`. Le runtime ne les consomme
pas encore : la composition OIDC manque. Aucune validation ne doit être réduite.

## Prérequis repository avant smoke test

Une tâche backend approuvée doit :

1. persister et résoudre dans Identity `issuer + subject` vers l’autorité interne ;
2. fournir une procédure auditable de liaison du compte Auth0 de développement ;
3. composer verifier, provider et resolver dans `createPostgresApiRuntime` ;
4. autoriser par CORS uniquement `http://localhost:5173` avec les méthodes et
   headers requis, jamais `*` ;
5. fournir un démarrage PostgreSQL/migrations local reproductible ;
6. fournir un parcours Web protégé sans effet dangereux pour la preuve API.

La liaison doit affecter explicitement grants et tenant IDs internes. Un second
utilisateur lié sans le grant ciblé est recommandé pour le 403. Auth0 ne doit
pas être la source de ces droits.

## Procédure de smoke test après prérequis

### Login, callback et session

1. lancer PostgreSQL/migrations via la future procédure, puis API et Web ;
2. ouvrir `http://localhost:5173/biens` ; constater `/connexion` sans flash ;
3. cliquer **Se connecter**, vérifier le domaine Auth0 et s’authentifier ;
4. vérifier le callback, l’absence de `code/state` dans l’URL finale, le retour
   à `/biens` et l’identité minimale ;
5. recharger complètement et vérifier restauration silencieuse, absence de
   flash et absence de nouvelle interaction.

### Token, API et authority

Déclencher le parcours protégé. Dans Network, confirmer uniquement la présence
du bearer, sans copier sa valeur. Confirmer une réponse non-401 et la réussite
de signature, issuer, audience, `exp`, `iat`, âge et `sub`. Vérifier que le
resolver a utilisé la liaison exacte et que grants/tenants viennent de MonPiole.

### 403 et 401

Avec un compte lié sans le grant, attendre 403, conserver la session, ne pas
relancer le login et observer le message français. Effectuer aussi une requête
contrôlée sans bearer : attendre 401 sans effet métier. Si l’expiration réelle
est impraticable, conserver comme preuve limitée les tests UI-002 du retry unique
et de l’absence de boucle ; ne pas fabriquer de JWT.

### Logout et sécurité navigateur

Cliquer **Se déconnecter**, vérifier Auth0, le retour `/connexion` et la
protection de `/biens`. Inspecter Application/Network/Console : aucun bearer
ajouté manuellement à localStorage/sessionStorage/IndexedDB, aucun token dans
URL/log, aucun secret client dans le bundle. Ne pas capturer de token.

## Résultats obtenus

| Contrôle | Résultat |
| --- | --- |
| Tenant/SPA/API Auth0 | NON EXÉCUTÉ — accès absent |
| Login/callback/reload/logout | NON EXÉCUTÉ — navigateur absent |
| Token/appel API/JWT | BLOQUÉ — composition OIDC runtime absente |
| Mapping/grants/tenant scope | BLOQUÉ — resolver durable absent |
| 403 | BLOQUÉ — autorité de développement non provisionnable |
| 401 réel | BLOQUÉ — runtime fail-closed uniquement ; tests existants disponibles |
| Sécurité navigateur | NON EXÉCUTÉ ; garanties statiques UI-002 seulement |

## Corrections et contrôles

Aucune logique applicative n’a été modifiée. La documentation API expose le gap
runtime et `.env.example` documente les coordonnées OIDC publiques de l’API.

- `git check-ignore` confirme les fichiers locaux ignorés ;
- aucun secret, token, cookie ou credential n’a été créé ou lu ;
- tests applicatifs non requis pour ces changements documentaires ;
- `git diff --check` : PASS ;
- `git diff --stat` : deux fichiers suivis modifiés, 23 insertions ; le présent
  livrable non suivi n’est pas inclus par Git dans ce décompte ;
- `git status --short` : `.env.example` et `apps/api/README.md` modifiés, présent
  livrable créé ; aucun `.env` réel ou artefact sensible candidat au commit.

Fichiers créés : ce livrable. Fichiers modifiés : `.env.example` et
`apps/api/README.md`. Fichiers supprimés : aucun.

UI-002A reste **BLOCKED**. Elle pourra passer à **READY FOR MANUAL SMOKE TEST**
après la tranche backend et le provisioning Auth0 ; `DONE` exige l’observation
du parcours navigateur réel complet.
