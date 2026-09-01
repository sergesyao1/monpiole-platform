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
et restaure la session. TD-015 configure son interface officielle de cache sur
un namespace `sessionStorage` propre à Auth0 : le cache survit au rechargement
dans le même onglet mais disparaît avec la session de cet onglet. MonPiole ne
lit, ne journalise et ne manipule jamais les valeurs de token. Le refresh token
rotatif, lorsqu’il est émis, reste entièrement géré par le SDK.

Ce choix évite la persistance durable et multi-onglets de `localStorage`, mais
une XSS same-origin pourrait lire Web Storage pendant la session. Cette
exposition, les contrôles compensatoires et les alternatives sont documentés
dans TD-015.

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

Le bouton **Tester le refus 403** appelle la sonde non mutante
`GET /v1/authentication/authorization/platform-tenant-creation`. Elle vérifie
le grant interne `CREATE_TENANT` côté API sans créer de tenant. Pour une autorité
TENANT_ADMINISTRATOR, le 403 attendu conserve la session et n’entraîne ni logout
ni redirection Auth0.

## Gestion des biens

La fiche d’un bien permet aussi de corriger son titre, sa description et sa
localisation avec `PUT /v1/properties/{propertyId}`. Le formulaire reste séparé
des détails physiques et des conditions commerciales.

Le vertical slice Property est disponible sur `/properties`. Il utilise le
client HTTP authentifié commun et les routes publiques existantes pour créer un
bien, ouvrir sa fiche par identifiant, modifier ses détails et ses conditions
commerciales, puis consulter, affecter ou retirer ses propriétaires.

La page « Biens immobiliers » consomme le portefeuille privé tenant-scoped de
`GET /v1/properties`. Elle affiche les biens dans l’ordre fourni par l’API,
permet la recherche et les filtres publiés, puis charge explicitement les pages
suivantes avec le curseur opaque retourné par le serveur. Chaque résultat ouvre
la fiche existante et la création reste directement accessible.

L’espace `/proprietaires` consomme `GET /v1/property-owners` et expose l’annuaire,
la recherche, la pagination, la création et la modification des personnes
physiques et morales. La fiche d’un bien utilise ce même annuaire pour
sélectionner un propriétaire existant lors d’une affectation, sans saisie
manuelle d’UUID.

La section « Composition du bien » de la fiche permet de créer, consulter et
modifier les immeubles, puis d’afficher leurs unités, d’en créer et d’en modifier
le code. Les pages suivantes sont chargées explicitement avec les curseurs
opaques fournis par l’API, dédupliquées côté interface et ajoutées aux résultats
déjà visibles. Un échec de pagination conserve les données chargées et propose
une nouvelle tentative. Les validations, confirmations et erreurs 401, 403, 404
et 409 sont présentées en français.

La fiche affiche le rôle structurel avec les libellés « Bien autonome »,
« Ensemble immobilier » et « Unité ». Après la création du premier immeuble,
elle actualise immédiatement le rôle du parent en « Ensemble immobilier » sans
rechargement. Le formulaire Unit préremplit mais laisse modifier pays, ville,
quartier et adresse, ainsi que la description. Chaque Unit rend un résumé
français du code, du titre, du type, du projet commercial et de l’adresse. Les
états de chargement, vide, succès, erreur et nouvelle tentative sont locaux à la
composition, aux immeubles et aux unités ; une erreur locale conserve les
résultats déjà affichés.

La section « Publication » de chaque fiche privée affiche « Brouillon »,
« Publié » ou « Retiré du catalogue » et vérifie visuellement les détails, conditions commerciales et la
photo principale. Une
Property prête peut être publiée après une confirmation explicite. Le client
authentifié commun envoie un `PUT` sans corps, bloque les doubles soumissions et
remplace immédiatement l’état local par la réponse canonique. Les prérequis
manquants, l’attente, le succès, les refus 401/403, le conflit métier et les
erreurs réseau sont rendus en français avec des annonces accessibles.

Une Property publiée dont la réponse porte `canWithdrawFromCatalog: true`
propose « Retirer du catalogue ». Une confirmation précise qu'aucune suppression
n'a lieu, le double clic est neutralisé et la réponse canonique remplace l'état
local. La date de retrait et le succès sont annoncés en français ; un bien
retiré reste accessible dans le portfolio et aucune republication n'est rendue.

La galerie de la fiche affiche toutes les photos disponibles. Chaque photo non
principale propose « Définir comme photo principale » ; la sélection porte le
badge « Photo principale ». Le remplacement reste disponible pour un bien
publié. La suppression de la sélection courante est désactivée avec une aide
explicite et reste protégée par l’API. L’absence de sélection bloque le bouton de
publication avec « Sélectionnez la photo principale qui représentera ce bien
dans les annonces. »

Le formulaire de galerie enregistre le contenu JPEG, PNG ou WebP et sa catégorie
avant de rafraîchir la représentation privée. Pour un appartement en location
longue durée, le sous-type explicite « Studio » ou « Plusieurs pièces » pilote
la checklist des six photos et de ses vues obligatoires. Le minimum éventuel de
l'organisation et ses vues supplémentaires durcissent cette checklist sans
réduire le socle MonPiole.

La section privée « Géolocalisation et confidentialité » gère séparément la
latitude, la longitude et la visibilité publique souhaitée. Elle rend en
français les états de chargement, absence, validation, sauvegarde, suppression,
succès et erreur. Les virgules décimales sont normalisées et les valeurs restent
bornées à six décimales. Le choix « Position exacte » exige une confirmation ;
la suppression est également confirmée.

Pour une Unit, la section est en lecture seule : elle affiche la position
effective héritée et propose un lien vers l'ensemble immobilier parent. Aucun
sélecteur cartographique, géocodeur ou appel provider n'est exécuté. Le formulaire
est conçu pour qu'un futur sélecteur puisse fournir les deux coordonnées sans
changer le contrat métier.

La section privée « Disponibilité et occupation » charge le contrat dédié de la
Property et traduit les états en « Disponible / Indisponible » et « Libre /
Occupé ». Une valeur directe absente est affichée « Non renseignée ». Le
formulaire n’est rendu que lorsque `canUpdateAvailability` l’autorise ; après
enregistrement, la réponse persistée remplace immédiatement l’état local. Les
chargements, refus, erreurs réseau et nouvelles tentatives restent locaux à la
section.

Pour un ensemble immobilier, la fiche affiche la synthèse et les compteurs de
ses Units sans proposer d’édition parent. Les Units chargées dans la composition
exposent chacune leur propre lecture et formulaire. Après le premier immeuble,
le message de succès explique que la disponibilité est désormais gérée unité
par unité. En location courte durée, l’aide précise que « Disponible » accepte
globalement des demandes sans garantir une date.

Le catalogue anonyme emploie « Biens publiés ». Il n’affiche ni badge ni filtre
de disponibilité et ne reçoit aucun champ availability/occupancy dans ses DTO.

Les champs monétaires utilisent les décimales de la devise à la saisie comme au
préremplissage : XOF n'est pas divisé par 100, EUR et USD le sont. L'affichage
rend notamment `125000 XOF` sous la forme « 125 000 FCFA » et n'expose plus le
libellé technique « unité mineure ».

Une Property publiée affiche sa date et sa visibilité dans le catalogue public.
Une Property retirée affiche ses dates de publication et de retrait ainsi que
la conservation dans le portfolio privé. Le portfolio propose les filtres
« Brouillon », « Publié » et « Retiré du catalogue » sans afficher les valeurs
techniques de statut.

## Frontières

- `src/app` compose le shell et les routes ;
- `src/auth` adapte Auth0 vers la session frontend ;
- `src/config` valide la configuration publique ;
- `src/infrastructure/http` centralise transport, bearer et erreurs HTTP ;
- `src/features/properties` contient le client, les modèles de transport, les
  mappings français, les pages et composants du vertical slice Property ;
- les vertical slices métier restent isolés par feature.

## Catalogue public

`/catalogue` et `/catalogue/:publicPropertyId` sont placées hors de
`AuthenticationBoundary`. Elles rendent pendant les états OIDC `loading`,
`unauthenticated` et `error`, n’appellent jamais `getAccessToken` et ne
redirigent pas vers `/connexion`.

La feature `src/features/public-catalog` possède ses modèles et son client de
lecture propres. Les appels `/v1/public/*` et les images restent same-origin :
cette contrainte préserve l’hôte public utilisé côté API pour résoudre le tenant
et pour isoler les caches. Le reverse proxy de l’environnement contrôlé doit
router ces chemins sans réécrire `Host`. `VITE_API_BASE_URL` continue de servir
les parcours privés mais ne sélectionne aucun tenant public.

Le catalogue français couvre les deux filtres approuvés, la pagination keyset,
le chargement, l’état vide, l’erreur avec nouvelle tentative, la fiche 404 et
le placeholder des publications historiques sans contenu photo. Aucun lien de
création, donnée owner, adresse exacte ou valeur enum technique n’y est rendu.

TASK-058 n’autorise aucune exposition Internet de production. L’activation d’un
tenant réel, la revue de ses données publiées et un rate limiting approuvé
restent des portes opérationnelles obligatoires.
