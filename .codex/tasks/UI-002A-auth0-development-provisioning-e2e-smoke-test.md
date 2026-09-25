# UI-002A — Auth0 Development Provisioning & End-to-End Authentication Smoke Test

- Date: 2026-08-26
- Status: **DONE**

> Mise à jour du 2026-08-26 après TASK-040 : les sections historiques ci-dessous
> décrivent l’audit antérieur. La section « Reprise après TASK-040 » en fin de
> document constitue l’état final et remplace les anciens gaps repository.

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
3. aucune page Web actuelle ne déclenche un appel métier protégé ;
4. le dépôt ne fournit ni composition PostgreSQL locale ni commande d’application
   des migrations ; le runtime exige TLS hors tests.

TASK-040 a depuis fermé les anciens blockers de composition : verifier/provider
OIDC, resolver PostgreSQL durable et CORS restrictif sont désormais réels.

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
| Web Origin | `http://localhost:5173` | Allowed Web Origins | `API_ALLOWED_BROWSER_ORIGINS`, allowlist exacte |
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

Ces variables sont exemplifiées dans `.env.example` et consommées par le runtime
TASK-040. Aucune validation ne doit être réduite.

## Prérequis repository livrés par TASK-040

TASK-040 a livré :

1. persister et résoudre dans Identity `issuer + subject` vers l’autorité interne ;
2. fournir une procédure auditable de liaison du compte Auth0 de développement ;
3. composer verifier, provider et resolver dans `createPostgresApiRuntime` ;
4. autoriser par CORS uniquement `http://localhost:5173` avec les méthodes et
   headers requis, jamais `*` ;
5. des tests Testcontainers reproductibles pour migrations et reconstruction.

Restent avant le smoke : provisionner Auth0, lier explicitement le compte via
`PostgresExternalIdentityStore.link`, disposer d’un PostgreSQL local migré et
déclencher depuis le Web un appel vers une route protégée existante.

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
ajouté par le code applicatif à Web Storage/IndexedDB, aucun usage de
`localStorage`, aucun token dans URL/log, aucun secret client dans le bundle.
Le cache `sessionStorage` SDK adopté ensuite par TD-015 constitue l’unique
exception encadrée. Ne pas capturer de token.

## Résultats obtenus

| Contrôle | Résultat |
| --- | --- |
| Tenant/SPA/API Auth0 | NON EXÉCUTÉ — accès absent |
| Login/callback/reload/logout | NON EXÉCUTÉ — navigateur absent |
| Token/appel API/JWT | NON EXÉCUTÉ — provisioning Auth0/browser absent |
| Mapping/grants/tenant scope | AUTOMATISÉ par TASK-040 ; smoke réel non exécuté |
| 403 | NON EXÉCUTÉ — comptes de développement non provisionnés |
| 401 réel | AUTOMATISÉ par TASK-040 ; navigateur réel non exécuté |
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

UI-002A est **READY FOR MANUAL AUTH0 PROVISIONING**. Elle passera à
**READY FOR MANUAL SMOKE TEST** après provisioning Auth0, liaison contrôlée et
démarrage local ; `DONE` exige l’observation du parcours navigateur complet.

## Reprise après TASK-040 — état final

### Blockers réévalués

TASK-040 (commit `305b30b`) résout la composition verifier/provider OIDC, la
résolution PostgreSQL durable `(issuer, subject)`, le refus fail-closed et la
CORS restrictive. UI-002A résout les gaps repository restants avec :

- `GET /v1/authentication/session`, endpoint protégé sans effet de bord dont la
  seule réponse est `{ "authenticated": true }` ;
- `/diagnostic-authentification`, page protégée française utilisant le client
  bearer centralisé ;
- `migrations:apply`, runner des migrations des trois bounded contexts ;
- `infrastructure/local/postgres.compose.yaml`, PostgreSQL local loopback ;
- `identity:link-external`, commande opérateur de liaison explicite ;
- une désactivation TLS admise uniquement pour `MONPIOLE_ENV=development` avec
  une `DATABASE_URL` loopback. Une base distante exige toujours TLS vérifié.

Restent manuels/externes : tenant Auth0, SPA, API, compte synthétique,
credentials de test et toutes les observations navigateur. Une identité interne
ACTIVE avec membership doit préexister ; la liaison ne crée pas d’utilisateur et
n’accorde aucun droit. Sur une base vide, l’onboarding interne approuvé reste un
prérequis distinct. Il n’existe aucun `first login = administrator`.

### Contrat et provisioning Auth0 Development

Configurer une SPA avec callback `http://localhost:5173`, logout
`http://localhost:5173/connexion` et Web Origin `http://localhost:5173`. Créer
une API Identifier `https://api.monpiole.local`, RS256, puis un compte
synthétique. Relever son `sub` sans le publier. Appliquer la MFA aux comptes
privilégiés selon ADR-0007 et conserver la rotation/détection de réutilisation
des refresh tokens. TD-015 supersède le cache mémoire de TD-014 par le cache
SDK limité à la session de l’onglet décrit ci-dessous.

Les égalités obligatoires sont :

- `VITE_OIDC_ISSUER` = `AUTHENTICATION_ISSUER` = claim `iss`, slash final ;
- `VITE_OIDC_AUDIENCE` = `AUTHENTICATION_AUDIENCE` = API Identifier ;
- `VITE_OIDC_CLIENT_ID` = client public de la SPA, sans client secret ;
- `AUTHENTICATION_JWKS_URI` = JWKS du même tenant.

### Variables et démarrage local

Créer `.env.local` racine et `apps/web/.env.local`, tous deux ignorés par Git.
API/opérations :

```text
MONPIOLE_ENV=development
DATABASE_URL=postgresql://monpiole:monpiole@localhost:5432/monpiole
DATABASE_TLS=disabled
DATABASE_MIGRATION_URL=postgresql://monpiole:monpiole@localhost:5432/monpiole
DATABASE_MIGRATION_TLS=disabled
AUTHENTICATION_ISSUER=https://<tenant-dev>.eu.auth0.com/
AUTHENTICATION_AUDIENCE=https://api.monpiole.local
AUTHENTICATION_JWKS_URI=https://<tenant-dev>.eu.auth0.com/.well-known/jwks.json
AUTHENTICATION_JWT_ALGORITHM=RS256
AUTHENTICATION_CLOCK_TOLERANCE_SECONDS=30
AUTHENTICATION_MAX_TOKEN_AGE_SECONDS=900
API_ALLOWED_BROWSER_ORIGINS=http://localhost:5173
```

Web :

```text
VITE_API_BASE_URL=http://localhost:3000
VITE_OIDC_ISSUER=https://<tenant-dev>.eu.auth0.com/
VITE_OIDC_CLIENT_ID=<public-spa-client-id>
VITE_OIDC_AUDIENCE=https://api.monpiole.local
VITE_OIDC_REDIRECT_URI=http://localhost:5173
VITE_OIDC_LOGOUT_RETURN_URI=http://localhost:5173/connexion
```

Commandes PowerShell :

```powershell
docker compose -f infrastructure/local/postgres.compose.yaml up -d --wait
Get-Content .env.local | Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' } | ForEach-Object { $pair = $_ -split '=', 2; Set-Item -Path "Env:$($pair[0])" -Value $pair[1] }
corepack pnpm --filter @monpiole/api migrations:apply
corepack pnpm app:api:build
corepack pnpm app:api:start
```

Dans un second terminal :

```powershell
corepack pnpm --filter @monpiole/web dev
```

### Liaison opérateur durable

Après onboarding approuvé de l’identité interne ACTIVE :

```powershell
$env:EXTERNAL_IDENTITY_ISSUER=$env:AUTHENTICATION_ISSUER
$env:EXTERNAL_IDENTITY_SUBJECT='<subject Auth0 réel>'
$env:EXTERNAL_IDENTITY_INTERNAL_ID='<UUID identité MonPiole ACTIVE>'
$env:EXTERNAL_IDENTITY_TENANT_ID='<UUID tenant du membership>'
corepack pnpm --filter @monpiole/api identity:link-external
Remove-Item Env:EXTERNAL_IDENTITY_SUBJECT,Env:EXTERNAL_IDENTITY_INTERNAL_ID,Env:EXTERNAL_IDENTITY_TENANT_ID
```

La commande valide le modèle `ExternalIdentity` puis persiste via
`PostgresExternalIdentityStore`. L’e-mail n’est jamais utilisé ; grants et
tenant IDs proviennent du membership interne.

### Smoke test positif attendu

1. ouvrir `/biens`, constater la connexion, puis cliquer **Se connecter** ;
2. contrôler le domaine Auth0, s’authentifier et vérifier le callback ;
3. confirmer l’absence de `code`, `state` ou token dans l’URL finale ;
4. recharger : session restaurée sans flash `/connexion` ni interaction ;
5. ouvrir `/diagnostic-authentification` et cliquer **Vérifier ma session API** ;
6. confirmer seulement la présence du bearer dans Network, sans le copier, et
   attendre le message français de succès ;
7. confirmer côté API signature, issuer, audience, `exp`, `iat`, âge, `sub` et
   résolution durable ; redémarrer l’API puis répéter ;
8. cliquer **Se déconnecter**, vérifier le retour `/connexion` et la protection
   d’une route du shell.

### Cas négatifs et sécurité navigateur

- sans bearer ou identité valide non liée : 401, aucun droit implicite et
  aucune boucle de login ;
- opération hors grant/tenant scope : 403, session conservée, message français.
  Un tenant administrator doit notamment recevoir 403 sur `POST /api/v1/tenants`
  car son autorité interne n’a pas `CREATE_TENANT` ;
- origin inconnue : aucun accès CORS ; preflight autorisé avec `Authorization`
  et `Content-Type` ;
- issuer/audience erronés, token invalide ou expiré : 401.

Inspecter Application, Network, URL et Console : aucun bearer persisté par du
code applicatif dans Web Storage ou IndexedDB, aucun usage de `localStorage`,
aucun token dans URL/log, aucun client secret dans le bundle. Le contenu
`sessionStorage` namespacé est exclusivement géré par le SDK conformément à
TD-015. Ne jamais capturer le token complet.

### Résultats

Les validations automatisées sont consignées dans le rapport final. Le tenant
Auth0, login, callback, reload, appel bearer réel, 403 réel, logout et contrôles
navigateur restent **NON EXÉCUTÉS** faute d’accès externe et d’authentification
interactive.

Validations exécutées le 2026-08-26 :

- typecheck API, Web, Persistence et tests : PASS ;
- build API et Web : PASS (warning Vite non bloquant sur un chunk > 500 kB) ;
- tests Web : 4 fichiers, 26 tests PASS ;
- tests unitaires : 16 fichiers, 103 tests PASS ;
- tests d’intégration : 13 fichiers, 99 tests PASS ;
- tests de contrat : 11 fichiers, 63 tests PASS ;
- suite globale : 48 fichiers, 339 tests PASS ;
- architecture check : PASS ; OpenAPI régénéré : PASS ;
- compose PostgreSQL : healthy ; migrations réelles : PASS ;
- démarrage API compilée : PASS ; health 200, diagnostic sans bearer 401,
  preflight autorisé 204 avec origin et headers attendus.

Le premier démarrage du compose a révélé le changement de mount PostgreSQL 18 ;
le mount a été corrigé vers `/var/lib/postgresql`, puis le volume vide issu de
l’échec a été supprimé et recréé. Le test runtime a aussi révélé des exports
workspace pointant sur les sources ; ils pointent désormais sur `dist` et les
scripts API construisent leurs dépendances avant exécution.

Statut final : **READY FOR MANUAL E2E**. `DONE` exige la preuve réelle Auth0.

## Prérequis initial résolu par TASK-041

L’inspection de la base locale a révélé une installation vide et le deadlock de
première autorité. TASK-041 ajoute la commande operator-only
`platform:bootstrap-initial-authority`. Elle compose les quatre use cases
d’onboarding existants, refuse tout état déjà initialisé et produit un tenant
ACTIVE avec une identité ACTIVE/TENANT_ADMINISTRATOR.

Cette étape précède `identity:link-external`. Elle ne traite aucun token ou
identifiant Auth0 et ne modifie pas l’autorisation HTTP. Les UUID et preuves de
l’exécution locale sont ajoutés après validation finale.

Exécution réelle TASK-041 : PASS. Tenant
`4a4a66d1-c55f-49e3-a50f-ccb2a21afbe8` ACTIVE, identité interne
`bebcbce1-3140-46c7-8049-bc2f6ca04f75` ACTIVE, membership
TENANT_ADMINISTRATOR, zéro lien externe. UI-002A est désormais prête pour la
commande explicite `identity:link-external` avec l’issuer et le subject Auth0 de
développement, puis pour le smoke navigateur.

## Smoke Auth0 réel — session après reload

Observations réelles communiquées le 2026-08-26 :

- Auth0 Universal Login : PASS ;
- Authorization Code + PKCE : PASS ;
- callback `http://localhost:5173` : PASS ;
- shell MonPiole authentifié : PASS ;
- access token réel vers `GET /v1/authentication/session` : PASS ;
- résolution durable vers l’autorité MonPiole ACTIVE : PASS ;
- message français de succès : PASS ;
- reload complet sur `/diagnostic-authentification` : FAIL, retour `/connexion`.

Cause : le cache `memory` de TD-014 perdait tokens et refresh token au reload.
La restauration dépendait alors du cookie indicateur SDK et de l’iframe silent
Auth0, chemin non fiable dans le navigateur réel. `useRefreshTokensFallback`
retombait sur ce même chemin en l’absence du refresh token perdu.

TD-015 remplace uniquement ce choix par un cache officiel `ICache` namespacé
dans `sessionStorage`. Il survit au reload du même onglet, disparaît à la fin de
la session de l’onglet et évite `localStorage`. La contrepartie XSS est explicite
dans TD-015 ; le SDK conserve seul la gestion et rotation des tokens.

Le reload doit être retesté manuellement après correction. Restent également à
consigner avant `DONE` : logout Auth0 réel, 401 sans boucle, 403 avec session
conservée et inspection finale URL/Console/Storage/bundle. Statut maintenu :
**READY FOR MANUAL E2E RETEST**.

Validation automatisée de la correction : Web typecheck PASS ; Web tests 5
fichiers / 29 tests PASS ; Web build PASS (91 modules, warning chunk-size non
bloquant) ; architecture check PASS. Le test du cache reconstruit prouve la
persistance dans le même onglet sans utiliser le service Auth0 réel.

## Smoke Auth0 réel — preuves complémentaires et sonde 403

Preuves manuelles communiquées après TD-015 : reload F5 avec session conservée
PASS ; logout Auth0 PASS ; route protégée après logout exigeant une nouvelle
authentification PASS ; `GET /v1/authentication/session` sans Authorization
retournant réellement 401 PASS.

Pour le dernier 403, UI-002A ajoute la sonde GET non mutante
`/v1/authentication/authorization/platform-tenant-creation`. Elle résout
l’autorité OIDC réelle puis appelle exactement l’authorizer backend de
`CREATE_TENANT`. Le rôle interne `TENANT_ADMINISTRATOR` n’inclut pas ce grant et
doit donc recevoir 403. Aucun tenant n’est créé : une autorité autorisée reçoit
seulement 204.

La page expose **Tester le refus 403** et affiche : « Votre session reste
authentifiée, mais cette opération est interdite. » Le client bearer existant
est réutilisé ; aucun token n’est affiché ou journalisé, et
`ApiForbiddenError` ne déclenche aucun logout ou redirect Auth0.

Validation : Web 5 fichiers / 29 tests PASS ; unit 19 fichiers / 122 tests PASS ;
integration 13 fichiers / 100 tests PASS ; contrats 11 fichiers / 63 tests PASS ;
typechecks Web/API/tests PASS ; builds API/Web PASS ; OpenAPI PASS ; architecture
PASS. Le 403 Auth0 réel et l’inspection finale navigateur restent manuels.
Statut : **READY FOR MANUAL 403 E2E**.

## Clôture E2E finale

Preuves manuelles finales communiquées le 2026-08-26 :

- Auth0 Universal Login réel : PASS ;
- Authorization Code + PKCE et callback vers MonPiole : PASS ;
- `GET /v1/authentication/session` avec bearer réel : HTTP 200 ;
- résolution exacte `(issuer, subject)` vers l’autorité MonPiole ACTIVE liée :
  PASS ;
- reload complet F5 d’une route protégée : PASS dans le même onglet, sans
  reconnexion interactive, puis appel API HTTP 200 ;
- logout Auth0 réel : PASS, retour `/connexion`, puis nouvelle authentification
  exigée pour accéder à une route protégée ;
- `GET /v1/authentication/session` sans `Authorization` : HTTP 401 Problem
  Details `UNAUTHORIZED`, sans redirection Auth0 ;
- sonde réelle
  `GET /v1/authentication/authorization/platform-tenant-creation` avec une
  autorité TENANT_ADMINISTRATOR sans `CREATE_TENANT` : HTTP 403, aucun tenant
  créé, aucun logout ni redirection, message français attendu ;
- immédiatement après le 403, `GET /v1/authentication/session` : HTTP 200,
  message de succès attendu, shell toujours authentifié et session sécurisée.

La séquence critique **403 → session conservée → 200** est donc confirmée dans
le navigateur réel. La restauration F5 confirme la stratégie TD-015 : le cache
officiel Auth0 est namespacé dans `sessionStorage`, limité au même onglet et
jamais déplacé vers `localStorage`. La sonde 403 reste non mutante et réutilise
l’authorizer `CREATE_TENANT` existant.

### Critères d’acceptation finaux

- [x] tenant Auth0 Development, SPA publique et API RS256 utilisables ;
- [x] login Auth0 réel, Authorization Code + PKCE et callback ;
- [x] bearer réel accepté par l’API et mapping interne durable confirmé ;
- [x] reload F5 restauré sans interaction dans le même onglet ;
- [x] logout réel et reprotection des routes ;
- [x] 401 Problem Details sans bearer, sans boucle ni redirection Auth0 ;
- [x] 403 réel sans effet de bord, sans logout et avec message UI distinct ;
- [x] session toujours valide immédiatement après le 403 ;
- [x] absence de secret client frontend et de stockage Auth0 dans
  `localStorage` ;
- [x] stratégie `sessionStorage` et contrepartie XSS documentées dans TD-015 ;
- [x] validations automatisées et inspection finale consignées dans le rapport
  de clôture.

Statut final : **DONE**. Les observations Auth0 réelles requises et tous les
critères d’acceptation sont satisfaits ; aucun token, subject Auth0, mot de
passe, client secret ou autre credential réel n’est consigné dans ce document.
