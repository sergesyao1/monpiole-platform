# TASK-068 — Major Web Readiness & Product Experience Audit

## 1. Executive Summary

**AUDIT COMPLETE** — audit repository-first réalisé le 8 septembre 2026 sur la
baseline intégrée jusqu'à TASK-067.

MonPiole n'est plus une simple collection de vertical slices. Le parcours privé,
la fiche bien, la publication et le catalogue public commencent à former un
produit Web cohérent. Le socle Domain/API est particulièrement solide : contrats
stricts, séparation command/query, autorisations spécialisées, tenant scoping,
RLS forcée, projection publique explicite, Problem Details et tests PostgreSQL
réels.

La plateforme n'est toutefois pas prête à faire du mobile son prochain axe de
delivery. Le Web reconstruit encore manuellement des DTO et une partie de la
readiness de publication, `packages/sdk` est un placeholder, le workspace bien
est devenu une longue accumulation de sections, et les flux critiques n'ont pas
de test navigateur réel. La stratégie média base64/PostgreSQL convient au pilote
actuel, pas à un client mobile ni à une exposition à l'échelle. Enfin, le
catalogue public est volontairement interdit en production tant que les gates
Internet ne sont pas approuvées.

- **Overall Web Readiness : 3.4 / 5**
- **Overall Mobile Readiness : 2.8 / 5**
- **Mobile verdict : `MOBILE_NOT_READY`**
- **Strategic decision : `WEB_FOUNDATION_READY_WITH_CONSOLIDATION`**
- **Priorité unique proposée : TASK-069 — Property Workspace & Client Contract Consolidation**

Aucun correctif produit n'a été appliqué pendant l'audit. Le seul fichier créé
est ce rapport.

## 2. Starting Repository State

Commandes exécutées avant toute analyse :

```text
git status --short
git branch --show-current
git log -10 --oneline
```

- Repository : `C:\Projet\monpiole-platform`.
- Branche : `main`.
- HEAD initial : `07829355bf7510bcdb81afece1fa4fddd6b53e81`
  (`feat(property): evolve media gallery`).
- Historique immédiatement antérieur : TASK-066 au commit `23f710e`, TASK-065
  au commit `92512e4`, TASK-064 au commit `f72570e`.
- Working tree initial : propre ; `git status --short` et `git diff` vides.
- Fichiers modifiés/non suivis au démarrage : aucun.
- TASK-067 : déjà intégrée dans HEAD ; aucun travail partiel à récupérer.
- Aucun reset, clean, stash, checkout destructif, commit ou push.

## 3. Baseline Reconstruction

La baseline annoncée est confirmée, avec les nuances suivantes.

| Capability | État réel | Preuves principales |
| --- | --- | --- |
| Identity, tenant lifecycle, memberships et OIDC | Disponible et composé au runtime | `services/identity/src`, `services/tenant-management/src`, `apps/api/src/http/authentication`, `apps/web/src/auth` |
| Autorisation et tenant isolation | Disponible, grants filtrés et tenant dérivé de l'autorité | `apps/api/src/http/authenticated-authority/authenticated-authority.ts`, `apps/api/src/composition/identity-external-authority.adapter.ts` |
| Property create/read/update/portfolio | Disponible de bout en bout | `services/property-management/src`, `apps/api/src/http/properties`, `apps/web/src/features/properties` |
| Owners et ownerships | Disponible ; UX annuaire et fiche propriétaire | `services/property-management/src/application`, contrôleurs `property-owners`, `PropertyOwnerDirectoryPage.tsx` |
| Composition standalone/composite/unit | Disponible ; gestion bâtiments et lots | `property-composition.ts`, `property-composition.controller.ts`, `PropertyCompositionSection.tsx` |
| Publication/retrait | Disponible, règles métier et grants dédiés | `publish-property.ts`, `withdraw-property-from-catalog.ts`, `PropertyPublicationSection.tsx` |
| Catalogue public Host-scoped | Disponible hors production ; liste, détail et médias | `public-properties.controller.ts`, `public-catalog.ts`, `apps/web/src/features/public-catalog` |
| Availability/occupancy | Disponible ; agrégation des composites | migration `0014_property_availability_occupancy.sql`, `manage-property-availability.ts`, `PropertyAvailabilitySection.tsx` |
| UI/UX Foundation | Utilisée par les écrans majeurs ; dette CSS limitée mais réelle | `apps/web/src/styles/tokens.css`, `apps/web/src/ui`, `apps/web/src/styles/ui.css` |
| Advanced pricing | Disponible avec modèle legacy compatible et écriture stricte | `Property.ts`, `set-property-pricing.ts`, migration `0015_property_advanced_pricing.sql`, `PropertyPricingSection.tsx` |
| Media/gallery | Source canonique unique, ordre, principale, contenu privé/public | `PropertyPhoto.ts`, `manage-property-photos.ts`, migration `0016_property_media_gallery.sql`, `PropertyPhotoGallery.tsx` |

Les bounded contexts `audit`, `billing`, `notifications`, `reporting` et
`workflow`, ainsi que plusieurs packages de plateforme, restent des squelettes
documentaires. Ils ne doivent pas être comptés comme des capabilities runtime.
`packages/sdk` ne contient pas encore de client ou de types exécutables.

## 4. Functional Capability Map

| Capability | Command / write | Query / read | HTTP / contract | Authorization | Persistence / tests | Web consumer |
| --- | --- | --- | --- | --- | --- | --- |
| Authentication | Bootstrap/activation tenant-admin | Session et probe | `/v1/authentication/*`, `/api/v1/tenants*` | OIDC + platform/tenant authority | Identity/Tenant PostgreSQL + RLS tests | `Auth0SessionProvider`, login, diagnostic |
| Property core | Create, update core/details | Retrieve, keyset list | `/v1/properties`, `/:id`, `/:id/details` | `CREATE_PROPERTY`, `UPDATE_*`, `RETRIEVE/LIST_PROPERTY` | `Property`, repository PostgreSQL, unit/integration/contract tests | Portfolio, création, fiche bien |
| Owners | Create/update, assign/remove | Directory/detail/ownerships | `/v1/property-owners*`, `/v1/properties/:id/owners*` | Grants owner/ownership spécialisés | Tables tenant-scoped et tests RLS | Annuaire, détail, section ownership |
| Composition | Create/update building/unit | Keyset buildings/units | `/v1/properties/:id/buildings*` | Grants composition spécialisés | Repository transactionnel et tests PostgreSQL | `PropertyCompositionSection` |
| Pricing | `SetPropertyPricing` | Inclus dans Property | `PUT /v1/properties/:id/pricing` | `UPDATE_PROPERTY_PRICING` | Migration 0015, contraintes v1/v2, tests legacy/stricts | `PropertyPricingSection` |
| Availability | Set availability | Retrieve availability + occupancy agrégée | `GET/PUT /v1/properties/:id/availability` | `RETRIEVE/UPDATE_PROPERTY_AVAILABILITY` | Migration 0014, repository et tests réels | `PropertyAvailabilitySection` |
| Geolocation | Update/remove | Retrieve | `GET/PUT/DELETE /v1/properties/:id/geolocation` | Trois grants dédiés | Repository, migration et tests | `PropertyGeolocationSection` |
| Publication | Publish/withdraw | Statut et readiness distribuée | `PUT/DELETE /v1/properties/:id/publication` | `PUBLISH_PROPERTY`, `WITHDRAW_PROPERTY_FROM_CATALOG` | Verrouillage, règles Domain et tests | `PropertyPublicationSection` |
| Media | Add, primary, reorder, delete | List/content | `/v1/properties/:id/photos*` | Cinq grants spécialisés dont `REORDER_PROPERTY_PHOTOS` | Migration 0016, RLS forcée, ordre/index et 4 suites Property PostgreSQL | `PropertyPhotoGallery` |
| Public catalog | Aucun write public | List/detail/primary/gallery content | `/v1/public/properties*` | Anonyme + résolution Host allowlist | Reader PostgreSQL column-granted et RLS restrictive | Catalogue et détail publics |

### Routes Web réellement composées

Routes publiques : `/connexion`, `/catalogue`,
`/catalogue/:publicPropertyId`.

Routes privées : `/`, `/biens` (redirection), `/properties`,
`/properties/new`, `/properties/:propertyId`, `/proprietaires`,
`/proprietaires/new`, `/proprietaires/:ownerId` et
`/diagnostic-authentification`.

Le shell privé, la boundary d'authentification et les lazy routes de production
sont dans `apps/web/src/app/managed-routes.tsx`. Les tests utilisent une seconde
définition eager dans `apps/web/src/app/routes.tsx`, ce qui crée un risque de
drift documenté en dette WR-03.

### Routes API réellement composées

- Auth/tenant : `GET /v1/authentication/session`, `GET
  /v1/authentication/authorization/platform-tenant-creation`, `POST
  /api/v1/tenants`, `POST /api/v1/tenants/:tenantId/activate`, `POST
  /v1/tenants/:tenantId/administrators/bootstrap` et `POST
  /v1/tenants/:tenantId/administrators/:administratorId/activate`.
- Property : `POST/GET /v1/properties`, `GET/PUT /v1/properties/:propertyId`,
  `PUT /details`, `PUT /pricing`, `GET/PUT /availability`, `GET/PUT/DELETE
  /geolocation` et `PUT/DELETE /publication` sous le même bien.
- Owners : `POST/GET /v1/property-owners`, `GET/PUT
  /v1/property-owners/:ownerId`, `POST/GET
  /v1/properties/:propertyId/owners` et `DELETE
  /v1/properties/:propertyId/owners/:ownerId`.
- Composition : `POST/GET /v1/properties/:propertyId/buildings`, `PUT
  /buildings/:buildingId`, `POST/GET /buildings/:buildingId/units` et `PUT
  /buildings/:buildingId/units/:unitPropertyId`.
- Photo standard/media : `GET/PUT /v1/property-photo-standard`, `GET/POST
  /v1/properties/:propertyId/photos`, `GET /photos/:photoId/content`, `PUT
  /photos/:photoId/primary`, `PUT /photos/order` et `DELETE /photos/:photoId`.
- Public : `GET /v1/public/properties`, `GET
  /v1/public/properties/:publicPropertyId`, `GET /primary-photo` et `GET
  /media/:mediaId/content` sous le détail public.

Availability et occupancy partagent volontairement le read model
`/availability`; l'occupation composite est calculée, pas mutée par une route
publique distincte.

### Contrat HTTP

L'OpenAPI généré contient 33 paths et 62 schemas. La majorité des routes est
versionnée sous `/v1`, mais tenant creation/activation et contract baseline
restent sous `/api/v1`. Cette dualité n'est pas bloquante aujourd'hui mais doit
être normalisée avant de publier un SDK multi-client.

## 5. Private User Journey Audit

Parcours reconstitué :

```text
Login → Portfolio → Create property → Property workspace
      → Details / Owner / Composition / Pricing / Availability / Media
      → Publication → Public catalog
```

### Ce qui fonctionne

- Le shell fournit une navigation stable vers Accueil, Biens et Propriétaires,
  un contexte de route, une déconnexion et un skip link.
- Le portfolio propose recherche, filtres type/statut, pagination keyset,
  création, loading, erreur, retry et empty state.
- La création envoie directement vers la fiche du bien créé.
- Chaque grande capability est accessible depuis la fiche par navigation
  d'ancrage ; mutations, validations, erreurs et succès sont visibles.
- Les badges rendent publication, disponibilité et occupation lisibles.
- L'annuaire propriétaires possède recherche, pagination, fiche et création.
- La publication demande une confirmation et affiche une checklist.

### Frictions produit

- L'accueil est une vitrine statique, pas un tableau de bord : aucun KPI de
  portefeuille, bien récent, tâche incomplète ou publication à finaliser.
- Le portfolio n'expose ni prix, ni photo, ni disponibilité, ni readiness ; il
  faut ouvrir chaque bien pour prendre une décision opérationnelle.
- Le parcours n'est pas guidé. Après création, l'utilisateur reçoit neuf
  sections sans étape suivante canonique ni synthèse de complétude.
- La publication est placée avant des prérequis visuellement situés plus bas
  (photos, informations et détails).
- L'ajout d'un propriétaire pendant l'assignation impose une sortie vers
  l'annuaire ; l'empty state ne fournit pas de CTA de création contextuel.
- Les permissions sont surtout découvertes au moment du refus. Seule la
  disponibilité projette explicitement une capability `canUpdateAvailability`.
- Le composant ownership effectue un chargement N+1 des propriétaires assignés.

**Conclusion parcours :** un gestionnaire peut accomplir le parcours principal
sans connaître les endpoints ou les services internes, mais doit comprendre les
prérequis métier par essais et lecture des sections. Le produit est utilisable,
pas encore fluide ou auto-explicatif.

## 6. Property Workspace Audit

`apps/web/src/features/properties/PropertyDetailPage.tsx` constitue bien le point
central du bien. Il affiche identité, statut, localisation, owner, composition,
availability/occupancy, pricing, galerie et publication. Ce n'est plus une fiche
technique isolée.

Il reste cependant un **workspace accumulé plutôt qu'orchestré** :

- neuf sections longues se suivent dans une page unique ;
- l'ordre `overview → availability → pricing → publication → photos →
  information → details → location → owners → composition` ne reflète ni le
  chemin de complétude ni la priorité opérationnelle ;
- aucun résumé serveur de readiness, CTA « prochaine action » ou progression ;
- la page agrège de nombreuses requêtes indépendantes ;
- un échec de `retrievePropertyPhotoStandard()` est absorbé et remplace le
  standard par un minimum local de 1, pouvant désynchroniser la checklist du
  refus backend ;
- la logique `propertyPhotoRequirements` duplique catégories, seuils et
  décisions déjà détenus par le domaine ;
- `PropertyCompositionSection.tsx` concentre formulaires bâtiment/lot,
  pagination, maps de state et disponibilité sur environ 365 lignes ;
- le formulaire de lot expose encore le subtype appartement même lorsque le
  type/projet rend le choix sans pertinence ;
- les feedbacks core/details/pricing partagent un état haut de page qui peut les
  détacher de l'action ayant abouti.

La fiche est donc un vrai workspace fonctionnel, mais pas encore le cockpit
métier qu'un second client devrait reproduire.

## 7. Public Catalog Audit

### Expérience disponible

- Catalogue Host-scoped avec filtres type et transaction synchronisés à l'URL.
- Pagination keyset « Afficher plus », loading, erreur/retry et zéro résultat.
- Cards avec photo principale/fallback, type, rôle structurel, projet, ville,
  quartier et prix formaté.
- Détail public avec image principale, galerie ordonnée, description,
  caractéristiques physiques et pricing.
- Les biens `DRAFT` et `WITHDRAWN` ainsi que la PII owner sont exclus par la
  query publique, la RLS et le DTO.

### Limites observées

- Pas de recherche texte/localisation, filtre prix/surface/pièces, tri ou
  compteur de résultats.
- Les cards n'affichent pas surface, pièces ou chambres alors que le détail les
  connaît.
- Pas de CTA contact/lead, agence, favoris, partage, carte ou signaux de
  confiance.
- Pas de SEO/meta/structured data ni URL slug stable.
- Le retour aux filtres depuis le détail dépend de `location.state` React ; un
  partage ou reload perd ce contexte.
- Galerie simple sans lightbox, thumbnails, `srcset` ou lazy loading explicite.
- Le CSS cible `.public-gallery .ui-status-badge` alors que `StatusBadge` rend
  `.ui-badge`; le badge « principale » risque donc d'être mal positionné et
  clippé. Les tests jsdom ne peuvent pas voir ce défaut visuel.
- `publicCatalogHostAllowlistFromEnvironment` refuse toute allowlist non vide
  lorsque `MONPIOLE_ENV=production`. Ce garde-fou volontaire signifie que le
  catalogue n'est pas encore déployable publiquement.

**Verdict :** le catalogue dépasse la projection JSON technique et commence à
ressembler à une vitrine immobilière, mais il ne constitue pas encore une
expérience de recherche/conversion exploitable en production.

Priorités catalogue : (1) gates Internet/production, (2) contact/lead, (3)
recherche et filtres de décision, (4) SEO/URLs stables, puis (5) favoris,
partage, carte et galerie enrichie.

## 8. UI/UX Foundation Audit

TASK-065 tient globalement après TASK-066 et TASK-067.

### Points solides

- Tokens de couleur, spacing, rayon, ombre et typographie centralisés dans
  `apps/web/src/styles/tokens.css`.
- Primitives réutilisées : Button, Field, Alert, Loading, EmptyState,
  StatusBadge, PageHeader et Breadcrumbs dans `apps/web/src/ui`.
- États loading/empty/error cohérents sur portfolio, owners, catalogue et fiche.
- Focus visible, skip links, live regions et `prefers-reduced-motion` présents.
- Aucun inline style trouvé ; les slices récentes réutilisent la fondation.

### Dette restante

- **Important :** les confirmations de publication/retrait utilisent un
  `alertdialog` inline sans primitive de dialog, focus initial, trap ou
  restauration de focus.
- **Important :** aucun test visuel, navigateur ou a11y ne valide réellement le
  CSS et les interactions responsives.
- **Amélioration :** couleurs hexadécimales ad hoc subsistent dans `ui.css` et
  `features.css`.
- **Amélioration :** `.ui-alert h3` référence le token inexistant
  `--font-family-sans` au lieu du token body existant.
- **Amélioration :** anciens sélecteurs `.primary-action`, `.secondary-action`
  et `.form-message` coexistent avec les primitives `.ui-*`.
- **Amélioration :** la composition utilise encore de nombreux labels/inputs
  bruts plutôt que `Field`.

## 9. Responsive Audit

Le CSS prévoit des ruptures à environ 64 rem, 56.25 rem, 48 rem et 38.75 rem.
Le shell transforme la sidebar en navigation horizontale tablette, les grilles
portfolio/catalogue/formulaires/galerie se réduisent progressivement, puis les
actions et cards passent sur une colonne smartphone. Les boutons ont des cibles
confortables et les champs ne reposent pas sur un tableau fixe.

| Surface | Desktop | Tablet | Smartphone | Risque résiduel |
| --- | --- | --- | --- | --- |
| Navigation | Sidebar claire | Barre horizontale scrollable | Utilisable mais dense | Pas de menu mobile dédié ni test viewport |
| Portfolio/cards | Grille efficace | Colonnes réduites | Une colonne | Manque d'information opérationnelle, pas défaut CSS |
| Fiche bien | Sommaire sticky + sections | Sommaire et contenu plus serrés | Long scroll | Hiérarchie et volume, pas rupture structurelle |
| Forms/pricing/owners | Grilles fluides | Reflow | Une colonne | Dialogues et focus non validés en browser |
| Composition | Fonctionnelle | Dense | Très longue | Composant/state complexe, sélecteurs parfois non pertinents |
| Galerie | Grille ordonnée | Réduction colonnes | Une colonne | Base64 mémoire, pas variantes image |
| Catalogue public | Hero/cards/détail cohérents | Reflow | Une colonne | Bug possible du badge principale et aucune QA visuelle |

La readiness responsive est **probable par inspection**, pas prouvée par une
suite navigateur. Tous les 19 fichiers Web utilisent jsdom ; aucun Playwright,
Cypress, axe, Lighthouse ou snapshot visuel n'est configuré. Il serait donc
abusif de déclarer une readiness smartphone complète sur la seule base du CSS.

## 10. Web Architecture Audit

### Forces

- Découpage lisible `app / auth / config / http / features / ui`.
- Transport HTTP et gestion Problem Details centralisés.
- Features propriétaires, properties et catalogue clairement isolées.
- Auth0 Authorization Code + PKCE, refresh token rotation et boundary privée.
- Lazy loading des pages de production ; build Vite code-splitté.
- Bonne testabilité composant avec API injectée dans les pages/sections.

### Findings

1. **Contrats dupliqués.** `property-model.ts` reproduit manuellement les types
   Zod/OpenAPI et `property-api.ts` caste des JSON `unknown` sans validation
   runtime. `packages/sdk` est vide. Un mobile reproduirait cette dette.
2. **Règles métier côté React.** `propertyPhotoRequirements` et une partie de la
   checklist de publication interprètent localement le standard photo au lieu de
   consommer un verdict canonique du serveur.
3. **Routing en double.** `managed-routes.tsx` alimente l'application réelle,
   tandis que les tests importent `routes.tsx`. Les tests peuvent rester verts
   avec une route de production cassée ou absente.
4. **Data fetching artisanal.** Les composants répètent `useEffect`, flags
   `active`, pagination et états réseau. Les requêtes ne sont pas annulées par
   `AbortController` ; les réponses sont seulement ignorées après unmount.
5. **Hotspots.** `PropertyCompositionSection.tsx` (~365 lignes),
   `property-model.ts` (~302) et le chunk détail (54.84 kB, 13.13 kB gzip) portent
   une forte concentration de responsabilités.
6. **N+1 owner.** La fiche charge les ownerships puis chaque owner avec
   `Promise.all(retrievePropertyOwner)` au lieu d'un read model agrégé.
7. **Capabilities incomplètes.** Les droits d'action ne sont pas projetés de
   manière homogène ; afficher puis refuser une action au submit reste fréquent.

Il n'existe pas de dépendance circulaire détectée : le contrôle d'architecture a
validé workspace, exports, resolver, graph, boundaries, cycles et diagnostics.

## 11. API & Contract Audit

La chaîne `Domain → Application → Persistence → API → Zod/OpenAPI → Web` est
structurellement saine côté serveur.

### Points confirmés

- Le domaine Property garde les invariants sans dépendance NestJS/React/DB.
- Les commandes et queries passent par des use cases et ports explicites.
- Le tenant d'une opération privée est dérivé de l'autorité, pas d'un header
  client libre.
- Les writes PostgreSQL sensibles utilisent transactions/verrous ; la lecture
  publique utilise une composition et un rôle dédiés.
- Validation Zod stricte globale et sérialisation Zod sont enregistrées via
  `APP_PIPE`/`APP_INTERCEPTOR` dans `apps/api/src/app.module.ts`.
- Les erreurs sont normalisées en Problem Details avec request/correlation IDs.
- Les listes portfolio, owner, composition et catalogue ont une pagination
  keyset bornée.
- Les schemas v1 sont additifs et la régénération OpenAPI correspond au runtime.

### Dettes à ne pas propager

- L'OpenAPI n'a pas de `servers` et mélange les préfixes `/api/v1` et `/v1`.
- Aucun SDK/client TypeScript contract-derived n'est réellement publié.
- Le Web ne parse pas les réponses à la frontière réseau.
- Seule la création tenant possède une idempotence HTTP durable. Plusieurs PUT
  sont des no-op/replays sémantiques, mais les POST property/owner/building/unit/
  photo ne proposent pas d'`Idempotency-Key` durable pour retries mobile.
- Le read model Property ne fournit pas un objet workspace agrégé avec readiness,
  capabilities et summaries. Le client orchestre de multiples endpoints.
- `apps/api/src/app.module.ts`, le filtre Problem Details, le schema Property et
  les repositories composition/public sont des hotspots, sans enfreindre pour
  autant les boundaries.

## 12. Security Boundary Audit

### Garanties présentes

- OIDC vérifie issuer, audience, RS256, `iat`, `exp`, âge maximal, JWKS HTTPS et
  tolérance bornée.
- Auth0 Web utilise Authorization Code + PKCE, refresh rotation et un return path
  same-origin validé.
- Les grants Property sont explicitement allowlistés de l'autorité externe vers
  `PropertyAuthority`.
- RLS `ENABLE` + `FORCE` et transactions tenant-scoped couvrent les tables
  sensibles ; les tests réels exercent cross-tenant read/write denial.
- Le reader public est `NOBYPASSRLS`, sans droit d'écriture ni grant table-level
  général sur les médias ; il ne reçoit que les colonnes utiles.
- L'allowlist Host exige un host canonique exact et un UUID tenant ; les inconnus
  produisent un 404 sans fuite.
- DTO et queries publics excluent owner PII, données internes et disponibilités
  non prévues pour exposition.
- Les médias publics joignent une propriété `PUBLISHED`, le tenant Host-scoped et
  un média disponible/positionné ; contenu type allowlisté, signature magique,
  ETag, `nosniff`, cache court et `Vary: Host, Origin`.
- CORS repose sur une allowlist explicite, sans wildcard/credentials ; aucune URL
  legacy n'est proxyfiée, donc aucune surface SSRF évidente.
- Le filtre Problem Details ne renvoie pas les détails/messages internes.

### Gates manquantes

- Pas de rate limiting applicatif trouvé.
- Pas de politique CSP/Helmet/security headers déployée dans le runtime ; les
  répertoires nginx/Kubernetes ne contiennent que des README.
- La session Auth0 est mise en cache dans `sessionStorage`; le risque XSS est
  connu et rend CSP/assurance frontend importante avant Internet.
- Pas d'observabilité, alerte, runbook ou déploiement production concret.
- Le cache média public de 300 s peut encore servir une image brièvement après
  retrait ; comportement acceptable s'il est explicitement assumé.

Aucun défaut Critical d'isolation ou fuite PII n'a été trouvé. Le blocage
production du catalogue est une protection correcte, mais prouve que les gates
opérationnelles restent à construire.

## 13. Media/CDN Readiness

### État actuel

- Source canonique : `property_management.property_photos`.
- Kind supporté : `IMAGE` ; ordre explicite et index unique par propriété.
- Une seule principale atomique ; suppression principale refusée jusqu'au
  remplacement.
- Contenu JPEG/PNG/WebP encodé base64 dans la requête JSON, stocké en bytes avec
  type, taille et SHA-256 dans PostgreSQL.
- Lignes HTTPS URL-only legacy conservées mais exclues de la galerie active.
- Lecture privée authentifiée et lecture publique Host/RLS/PUBLISHED-scoped.
- Validation de content type et magic bytes ; pas de contrôle dimensions,
  decompression bomb ou transformation.
- Limite globale JSON Nest d'environ 20 MB, mais pas de limite métier explicite
  d'image. Le navigateur lit le fichier entier en mémoire puis l'encode en base64.

### Verdict

Cette architecture est suffisante pour développement, démonstration et pilote à
faible volume. Elle n'est pas suffisante pour une phase mobile/media-intensive ou
une exposition publique à l'échelle : overhead base64, mémoire client, pression
DB, absence de thumbnails/variants et impossibilité d'upload direct.

### Cible recommandée

Une future capability doit introduire un port de stockage objet, upload direct
borné et autorisé, clé objet opaque, checksum, traitement asynchrone, dimensions
maximales, variants thumbnail/card/detail, WebP/AVIF avec fallback, CDN cache
versionné et lifecycle de suppression. Les URLs publiques peuvent être stables
ou signées selon la confidentialité ; l'autorité métier et les métadonnées
restent en PostgreSQL. Ce chantier est TASK-072 indicatif, après la consolidation
du contrat workspace mais avant un client mobile riche en photos.

## 14. Mobile Readiness

### Verdict : `MOBILE_NOT_READY`

L'API est bien découplée du rendu Web et possède auth, pagination, erreurs,
versioning, séparation publique/privée et OpenAPI. Le verdict négatif ne signifie
donc pas « refaire l'API ». Il signifie qu'ouvrir maintenant un client mobile
dupliquerait quatre dettes coûteuses :

1. modèles TypeScript copiés et réponses non validées faute de SDK ;
2. orchestration cliente d'un workspace dispersé, readiness et capabilities
   partielles ;
3. retries offline sans stratégie d'idempotence homogène ;
4. upload photo base64/mémoire sans limite métier ni delivery optimisée.

La production publique n'a par ailleurs ni gates Internet approuvées, ni
observabilité/déploiement concret. Après TASK-069, la readiness mobile pourra
être réévaluée ; la fondation média peut avancer avant ou avec le premier vrai
flux photo mobile.

## 15. Database & Migration Review

Ordre journal vérifié : 0014, 0015 puis 0016, avec indices Drizzle séquentiels et
snapshots correspondants. Aucun conflit de nom, trou d'ordre ou migration non
journalisée observé.

### 0014 — availability/occupancy

- Ajoute le tuple availability/occupancy et ses contraintes cohérentes.
- Préserve l'agrégation applicative des composites.
- RLS/grants runtime et tests cross-tenant présents.

### 0015 — advanced pricing

- Schéma v1/v2 compatible : les anciennes lignes peuvent rester lisibles avec
  montant principal zéro ou devise historique.
- Les nouvelles écritures passent par les invariants stricts du domaine/use case
  et les contraintes applicables à la forme v2.
- Une nouvelle publication exige une tarification strictement publiable ; le
  legacy n'est donc pas silencieusement promu.
- Grants runtime et RLS restent bornés au schéma Property.

### 0016 — media gallery

- Ajoute `media_kind` et `gallery_position`, backfill déterministe et index
  unique partiel.
- Les lignes URL-only legacy gardent une position nulle ; les contenus actifs
  sont ordonnés.
- Check constraint corrigée pour refuser explicitement une image active sans
  position.
- Policy publique limitée aux médias complets de biens `PUBLISHED`, RLS forcée
  et grants colonne par colonne du reader public.

Les quatre commandes `migration:check` ont renvoyé `Everything's fine`. Les
7 fichiers / 116 tests PostgreSQL Docker confirment le comportement runtime des
migrations, contraintes, RLS et privileges.

## 16. Test & Validation Results

Environnement : Docker client **29.7.2**, serveur **29.7.2**.

| Validation | Résultat exact | Statut |
| --- | --- | --- |
| `corepack pnpm -r typecheck` | 9/10 projets workspace terminés, exit 0 | PASS |
| `corepack pnpm typecheck:tests` | TypeScript tests, exit 0 | PASS |
| `corepack pnpm test` | 93 fichiers, 763 tests passés, 321.11 s | PASS |
| `corepack pnpm test:unit` | 29 fichiers, 221 tests passés, 86.30 s | PASS |
| `corepack pnpm test:integration` | Relance isolée : 21 fichiers, 194 tests passés, 102.86 s | PASS |
| `corepack pnpm --filter @monpiole/web test` | 19 fichiers, 136 tests passés, 56.06 s | PASS |
| `corepack pnpm app:api:contracts:check` | 17 fichiers, 96 tests passés, 31.51 s | PASS |
| `corepack pnpm package:persistence:test:integration` | 7 fichiers, 116 tests PostgreSQL passés, 56.71 s | PASS |
| `corepack pnpm app:api:openapi` | API rebâtie, OpenAPI régénéré, aucun diff | PASS |
| `corepack pnpm app:api:build` | dépendances + API TypeScript, exit 0 | PASS |
| `corepack pnpm --filter @monpiole/web build` | 123 modules, build Vite 2.47 s | PASS |
| `corepack pnpm architecture:check` | workspace/exports/resolver/graph/boundaries/cycles/diagnostics validés | PASS |
| 4 commandes `*:migration:check` | persistence, tenant, identity, property : `Everything's fine` | PASS |

### Incident de validation non masqué

Une première exécution ciblée de `test:integration`, lancée en parallèle des
suites unitaires et Web, a échoué : hook Testcontainers > 10 s dans
`api-identity-postgres-runtime.test.ts`, soit 1 suite failed, 20 passed,
183 tests passed et 11 skipped. Cette même cible a ensuite été relancée seule et
a passé 21/21 fichiers et 194/194 tests. La suite globale et la cible PostgreSQL
dédiée avaient aussi passé.

Conclusion : aucune régression fonctionnelle reproductible, aucun test DB marqué
PASS après skip, mais un risque de flakiness sous contention Docker existe. Le
timeout de setup mérite d'être rendu plus robuste dans une tâche qualité.

### Limite de confiance

Les tests sont nombreux et multi-couches, mais la couverture configurée cible
surtout des fixtures et n'impose pas de seuil produit significatif. L'absence de
test navigateur/a11y/visuel empêche de transformer 136 tests jsdom en preuve de
responsive ou de parcours réel.

## 17. Web/Product Debt Register

| ID | Area | Severity | Evidence | Impact | Recommendation | Blocking mobile | Suggested task |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WR-01 | Contracts / Web | High | `packages/sdk/README.md`, `property-model.ts`, `property-api.ts`, OpenAPI | DTO copiés, cast `unknown`, drift possible dans chaque client | Générer ou dériver un client typé et valider les réponses à la frontière | Yes | TASK-069 |
| WR-02 | UX / API | High | `PropertyPublicationSection.tsx`, `property-photo-requirements.ts`, `publish-property.ts` | Readiness et standard photo interprétés côté React ; erreur de standard absorbée | Read model serveur canonique de readiness, raisons manquantes et capabilities | Yes | TASK-069 |
| WR-03 | Web / Tests | High | `managed-routes.tsx`, `routes.tsx`, tests de pages | Production et tests n'utilisent pas la même table de routes ; aucun browser E2E | Une source de routes et smoke E2E desktop/tablet/mobile avec a11y | Yes | TASK-069 |
| WR-04 | Security / Operations | High | `public-catalog.ts`, `infrastructure/nginx/README.md`, `infrastructure/kubernetes/README.md` | Catalogue volontairement indisponible en production ; pas de rate limit/headers/deploy | Gate Internet explicite : rate limiting, CSP/headers, ingress, logs, alerting et runbook | No | TASK-070 |
| WR-05 | Media | High | `PropertyPhotoGallery.tsx`, `bootstrap.ts`, photo repository/migration 0016 | Upload base64 complet en mémoire/DB, pas de taille métier, variants ou CDN | Limite immédiate documentée puis object storage, direct upload et image pipeline | Yes | TASK-072 |
| WR-06 | Private UX | Medium | `PropertyDetailPage.tsx`, `PropertyCompositionSection.tsx`, `HomePage.tsx` | Workspace long, ordre des prérequis faible, aucun next action/dashboard opérationnel | Workspace guidé par stages, summary/progress et CTA suivant | Yes | TASK-069 |
| WR-07 | Public UX | High | `PublicPropertyCatalogPage.tsx`, `PublicPropertyDetailPage.tsx` | Découverte limitée et aucune conversion/contact ; MVP public incomplet | Lead/contact puis recherche localisation/prix/surface, tri et SEO | No | TASK-071/073 |
| WR-08 | Web / API | Medium | `PropertyOwnershipSection.tsx`, `PropertyDetailPage.tsx` | N+1 owner et nombreuses requêtes indépendantes ; latence amplifiée sur mobile | Agréger summaries ownership/workspace et éviter les cascades | Yes | TASK-069 |
| WR-09 | UI | Medium | `features.css`, `ui.css`, `PropertyCompositionSection.tsx` | Badge principale mal ciblé, token inexistant, couleurs/selects ad hoc | Corriger le défaut visuel et solder les écarts de primitives/tokens | No | TASK-069 ou UI maintenance |
| WR-10 | API / Contracts | High | routes POST property/owner/building/unit/photo, préfixes controllers | Retries mobiles peuvent créer des doublons ; surface v1 incohérente | Politique d'idempotence et base URL/versioning documentées avant SDK stable | Yes | TASK-069/074 |
| WR-11 | Operations / Tests | High | `.github/workflows/architecture-checks.yml`, dossiers `infrastructure/*`, absence observability runtime | CI solide mais aucune preuve de déploiement, SLO, alerting ou recovery | Environnement staging reproductible, métriques/traces/logs, sauvegarde et runbooks | No | TASK-070 |
| WR-12 | Tests | Low | `api-identity-postgres-runtime.test.ts` hook 10 s | Flakiness quand plusieurs suites démarrent Docker en concurrence | Timeout/setup Testcontainers explicite et CI non concurrente pour la DB | No | Quality maintenance |
| WR-13 | UI / Accessibility | Medium | confirmations `alertdialog`, absence Playwright/axe | Focus clavier et responsive ne sont pas prouvés | Primitive Dialog accessible + assertions focus/axe en browser | Yes | TASK-069 |
| WR-14 | Documentation | Low | `.github/README.md`, workflow pnpm cache | README prétend encore qu'aucun cache dépendance n'est utilisé | Aligner la documentation CI | No | Maintenance |

Aucun finding Critical n'a été observé. Les findings High décrivent des gates de
maturité et d'industrialisation, pas une violation démontrée de tenant isolation
ou une corruption de données.

## 18. Maturity Scorecard

| Dimension | Score /5 | Justification repository-first |
| --- | ---: | --- |
| Domain maturity | 4.1 | Domaine Property riche, invariants et legacy explicites ; plusieurs autres bounded contexts restent placeholders |
| API maturity | 4.0 | Use cases/ports, validation stricte, Problem Details, pagination et OpenAPI ; read model workspace/idempotence restent incomplets |
| Web architecture | 3.3 | Features et boundary propres ; contrats/routing dupliqués et data fetching artisanal |
| Private product UX | 3.3 | Parcours complet et feedback correct ; cockpit, priorisation et discoverability à consolider |
| Public catalog UX | 2.5 | Liste/détail/prix/galerie réels ; recherche, conversion, SEO et production manquent |
| UI consistency | 3.8 | Fondation TASK-065 largement tenue ; écarts CSS/dialog/composition bornés |
| Responsive readiness | 3.4 | Breakpoints et reflow cohérents par inspection ; aucune preuve navigateur/viewport |
| Mobile API readiness | 2.8 | API découplée et versionnée, mais pas de SDK/read model/idempotence/media adapté |
| Security boundaries | 4.1 | OIDC, grants, RLS forcée et projections publiques fortes ; gates HTTP/ops Internet absentes |
| Media architecture | 2.6 | Galerie canonique sûre et testée ; stockage/upload/delivery non scalables |
| Test coverage/confidence | 4.1 | 93 fichiers/763 tests, 116 PostgreSQL ; pas d'E2E browser/a11y ni métrique de couverture utile |
| Operational readiness | 2.1 | CI complète ; catalogue production désactivé et infrastructure/observabilité au stade README |

### Overall Web Readiness

**3.4 / 5** — produit Web cohérent pour développement/pilote contrôlé, pas encore
MVP public opérable.

### Overall Mobile Readiness

**2.8 / 5** — fondation API prometteuse mais consolidation obligatoire avant de
créer un second client.

## 19. Product Gaps

### A. Must fix before mobile

1. Publier un contrat client canonique : SDK/types dérivés OpenAPI, parsing des
   réponses et conventions base URL/versioning.
2. Exposer un read model workspace serveur avec readiness de publication,
   missing reasons, capabilities et summaries ; supprimer les règles dupliquées
   du Web.
3. Unifier les routes production/tests et prouver le parcours critique dans un
   vrai navigateur aux viewports desktop/tablet/smartphone, avec smoke a11y.
4. Définir l'idempotence des créations/retries importantes et le comportement
   offline/replay attendu.
5. Borner explicitement les uploads et arrêter une trajectoire object storage/
   variants/direct upload avant tout flux photo mobile riche.
6. Réduire le N+1 owner et l'orchestration réseau excessive du workspace.

### B. Should improve before/alongside mobile

- Transformer accueil/portfolio en surface opérationnelle : récents, readiness,
  statuts, prix, photo et prochaines actions.
- Terminer les gates Internet : rate limit, CSP/security headers, staging,
  observabilité et runbooks.
- Ajouter lead/contact et identité d'agence au catalogue.
- Enrichir la découverte publique : localisation, prix, surface/pièces, tri,
  résultats et conservation complète des filtres.
- Corriger les écarts UI/a11y identifiés et introduire un Dialog accessible.

### C. Can wait

- Favoris, partage avancé et carte interactive.
- Vidéo, documents, plans et signed URLs généralisées.
- Analytics avancées, recommandations et personnalisation.
- Implémentation des bounded contexts billing/reporting/workflow non requis par
  le premier MVP transactionnel.

## 20. Strategic Readiness Decision

### `WEB_FOUNDATION_READY_WITH_CONSOLIDATION`

Le choix A serait trop optimiste : il transporterait immédiatement dans le
mobile les DTO copiés, la readiness locale, l'orchestration fragmentée et le
modèle média actuel. Le choix C serait trop sévère : Domain/API, RLS, contrats,
Web privé et catalogue sont fonctionnels, cohérents et très bien testés.

Une courte phase de consolidation ciblée est donc le meilleur investissement.
Elle ne doit ni réécrire le domaine ni lancer une refonte générale. Elle doit
stabiliser la surface client et transformer la fiche bien en modèle produit
réutilisable avant le second client.

## 21. Recommended TASK-069

### TASK-069 — Property Workspace & Client Contract Consolidation

#### Problème

La capacité métier est riche, mais chaque client doit encore recomposer la fiche
bien depuis plusieurs endpoints, recopier les DTO, interpréter les prérequis de
publication et découvrir ses droits au moment d'agir. Le Web réel et ses tests
n'utilisent pas la même définition de routes. Démarrer le mobile maintenant
créerait deux implémentations divergentes de ce même contrat implicite.

#### Objectif

Fournir une surface client canonique et validée pour le workspace Property, puis
faire du Web la première preuve de son usage : readiness/capabilities détenues
par le serveur, types contract-derived, navigation guidée et tests navigateur.

#### Justification

Cette tâche traite simultanément WR-01, WR-02, WR-03, WR-06, WR-08 et WR-13 sans
ajouter une nouvelle capability métier. Elle réduit le coût du futur mobile plus
fortement qu'une nouvelle feature catalogue ou qu'une refonte esthétique.

#### Scope

- Query/read model tenant-scoped `PropertyWorkspace` avec summary du bien,
  sections disponibles, owner summaries, publication readiness/missing reasons
  et capabilities d'action calculées côté serveur.
- Schemas Zod et OpenAPI correspondants, sans changer les invariants Domain.
- Client TypeScript dans `packages/sdk` ou génération contract-derived
  reproductible ; validation des payloads réseau et adoption dans le Web.
- Suppression de `propertyPhotoRequirements` comme source de décision client et
  absence de fallback silencieux du standard photo.
- Réorganisation de la fiche en étapes logiques, résumé de complétude et CTA
  « prochaine action », avec actions cachées/désactivées selon capabilities.
- Suppression du N+1 owner dans la fiche.
- Source unique des routes production/test.
- Browser E2E du parcours create → complete → price → media → publish → catalog
  sur desktop et smartphone, plus smoke a11y/focus des dialogs.

#### Out of scope

- Nouvelle application mobile.
- Recherche publique avancée, lead/contact, favoris, carte ou SEO complet.
- Migration object storage/CDN et support vidéo/document.
- Refonte globale du design system ou changement des règles métier Property.
- Déploiement production Internet.

#### Dépendances

- Baseline TASK-065, TASK-066 et TASK-067.
- OpenAPI actuel et grants Property existants.
- Aucun nouveau bounded context requis.

#### Critères d'acceptation principaux

1. Un endpoint/read model documenté renvoie readiness canonique, raisons
   manquantes, capabilities et owner summaries sous tenant isolation.
2. Aucun composant Web ne recalcule les règles de publication/photo.
3. Le Web consomme des schemas/types contract-derived et valide les réponses ;
   `packages/sdk` n'est plus un placeholder.
4. La fiche présente une progression et une prochaine action compréhensibles
   sans connaissance de l'architecture.
5. Les actions non autorisées sont représentées avant submit.
6. Aucune cascade N+1 owner n'est émise pour afficher le workspace.
7. Production et tests importent une définition de routes unique.
8. Le parcours critique passe dans un vrai navigateur aux viewports convenus,
   avec assertions clavier/dialog/a11y essentielles.
9. Typecheck, tests, PostgreSQL, contracts/OpenAPI, Web/API builds, architecture,
   migrations et `git diff --check` restent verts.

## 22. Indicative TASK-070+

- **TASK-070 — Public Catalog Production Security & Operations Gates** : rate
  limiting, CSP/headers, ingress TLS, staging, logs/metrics/traces, alerting,
  onboarding Host et runbooks ; lever le garde-fou production seulement après
  validation.
- **TASK-071 — Public Leads & Contact Vertical Slice** : conversion, consent,
  anti-abus et routing tenant d'une demande.
- **TASK-072 — Property Media Delivery Foundation** : limites métier, object
  storage, direct upload, variants, image processing, CDN et lifecycle.
- **TASK-073 — Public Catalog Discovery, Search & SEO** : recherche, filtres,
  tri, URLs stables et metadata.
- **TASK-074 — Mobile Readiness Reassessment / First Mobile Shell** : seulement
  après consommation réelle du contrat consolidé et décision média.

Cet ordre est indicatif après TASK-069. TASK-070 et TASK-072 peuvent avancer en
parallèle selon la priorité go-to-market, mais aucun ne justifie de copier les
contrats Web actuels dans une application mobile.

## 23. Files Changed During Audit

Fichier créé :

- `.codex/tasks/TASK-068-major-web-readiness-product-experience-audit.md`

Aucun fichier source, test, migration, lockfile ou contrat généré n'a été
modifié. La génération OpenAPI a produit un fichier byte-for-byte identique à la
version suivie.

## 24. Final Repository State

- Branche : `main`.
- Starting HEAD et final HEAD :
  `07829355bf7510bcdb81afece1fa4fddd6b53e81`.
- Working tree attendu : uniquement le nouveau rapport TASK-068 non suivi.
- `git diff --check` : PASS (exit 0) ; le rapport non suivi est contrôlé
  séparément avec `git diff --no-index --check`.
- Contrôle whitespace du rapport non suivi : aucun diagnostic ; l'exit 1 du
  mode `--no-index` signifie seulement que le fichier diffère de `NUL`.
- Commit créé : **NO**.
- Push effectué : **NO**.
- Reset/clean/stash : **NO**.

## 25. Conclusion

### Réponses obligatoires

1. **Produit cohérent ou collection de slices ?** Un produit Web commence
   clairement à émerger ; ses slices partagent domaine, shell, fiche, publication
   et catalogue, mais l'orchestration produit doit être consolidée.
2. **Le gestionnaire accomplit-il le parcours sans connaître l'architecture ?**
   Oui fonctionnellement, avec frictions : ordre des sections, owner contextuel,
   readiness et prochaine action ne sont pas assez guidés.
3. **La fiche bien est-elle un workspace cohérent ?** Oui comme point central,
   non encore comme cockpit : elle accumule neuf sections et trop de requêtes/
   décisions clientes.
4. **Catalogue exploitable ?** Plus qu'une projection technique grâce aux cards,
   détail, prix et galerie ; encore insuffisant pour recherche/conversion et
   volontairement indisponible en production.
5. **Le design system tient-il ?** Oui globalement ; dette limitée sur dialogs,
   composition, tokens/couleurs et un sélecteur de badge.
6. **Contrats prêts pour mobile ?** Le serveur est mature, la surface client ne
   l'est pas : pas de SDK, DTO copiés, readiness dispersée et idempotence inégale.
7. **Dettes coûteuses à transporter ?** Oui : WR-01, WR-02, WR-03, WR-05,
   WR-06, WR-08, WR-10 et WR-13.
8. **Média suffisant ?** Suffisant pour pilote ; object storage/CDN/processing et
   upload direct doivent être préparés avant une phase mobile photo-intensive.
9. **Gaps MVP immobilier crédible ?** Gates production, contact/lead,
   observabilité, découverte publique plus riche et cockpit opérationnel.
10. **Commencer le mobile ?** Non. Exécuter d'abord TASK-069, puis réévaluer avec
    les gates production et média planifiées.
11. **Priorité unique TASK-069 ?** Property Workspace & Client Contract
    Consolidation.

Le repository démontre une excellente maturité de vertical slice et de sécurité
des données. La prochaine valeur ne vient pas d'une capability supplémentaire,
mais de la réduction du contrat implicite entre ces capabilities. Une fois ce
contrat rendu canonique et prouvé dans le navigateur, MonPiole pourra aborder le
mobile sans dupliquer sa dette Web.
