# TASK-067 — Property Media & Gallery Evolution Web Vertical Slice

## Summary

**DONE** — la notion existante de photo Property a été évoluée en galerie média
ordonnée sans créer de deuxième source de vérité. Le domaine, les use cases,
PostgreSQL, l'API privée et publique, OpenAPI, le Web privé, le catalogue public
et les tests utilisent tous `property_management.property_photos` comme modèle
canonique.

La tranche supporte `IMAGE`, l'ajout binaire existant, la lecture ordonnée, la
sélection atomique de l'image principale, la suppression déterministe, le
réordonnancement transactionnel et idempotent, l'isolation tenant, ainsi que
l'exposition publique des seules galeries de propriétés publiées.

## Initial repository state

- Repository : `C:\Projet\monpiole-platform`.
- Branche : `main`.
- HEAD initial : `23f710e70fb029eefcdc49d7572995aa939ebc25`
  (`feat(property): add advanced pricing`).
- Upstream : `origin/main`, branche locale en avance de 50 commits.
- `git status --short` était vide : aucun changement préexistant n'a été
  attribué à TASK-067.
- `git diff` était vide au début de la tâche.
- `TASK-066-partial-backup.patch` n'existait pas ; aucune suppression n'a été
  effectuée.
- Les rapports et slices utiles de publication, catalogue, retrait,
  disponibilité, UI/UX et pricing ont été inspectés avant l'implémentation.
- Aucun reset, clean, stash, réécriture d'historique, commit ou push n'a été
  effectué.

## Existing media/photo model discovered

Le système possédait déjà une source canonique complète :
`property_management.property_photos` et le modèle de domaine `PropertyPhoto`.

- Identité stable : `photo_id`, `tenant_id`, `property_id`.
- Classification : catégorie et statut `AVAILABLE`.
- Stockage actuel : contenu image base64, content type, taille et SHA-256 ; des
  lignes historiques peuvent ne porter qu'une URL HTTPS.
- Image principale : `is_primary` avec index unique partiel par tenant et
  propriété.
- Sélection principale atomique et auditée.
- RLS forcée et policy tenant existantes.
- Publication : standard tenant/type de propriété, nombre minimal, catégories
  obligatoires et présence d'une image principale.
- Catalogue public : lecture via un rôle PostgreSQL dédié et une policy limitée
  auparavant à l'image principale.
- API et Web privés : ajout, contenu, sélection principale et suppression
  existaient déjà ; l'ordre explicite manquait.

La première photo ne devenait pas automatiquement principale. La suppression de
l'image principale était déjà refusée. Ces deux comportements sont préservés.

## Architectural decisions

1. Faire évoluer `PropertyPhoto`/`property_photos` au lieu de créer
   `PropertyMedia`/`property_media` en parallèle.
2. Conserver les noms publics `photoId`, `photos` et les routes `/photos` pour
   compatibilité, tout en ajoutant `mediaKind: "IMAGE"` et `position`.
3. Considérer comme galerie active uniquement les lignes content-backed dotées
   d'une position. Les anciennes lignes URL-only restent stockées et relisibles
   par les chemins legacy autorisés, avec `gallery_position = NULL`, mais ne
   deviennent pas une seconde projection de galerie.
4. Toute nouvelle image est ajoutée à la fin, non principale, puis peut être
   explicitement sélectionnée comme principale.
5. Une commande de réordonnancement remplace l'ordre complet. Elle exige une
   permutation exacte, non vide et sans doublon de la galerie courante.
6. L'image principale ne peut pas être supprimée : l'utilisateur doit d'abord
   sélectionner son remplacement. Ce choix évite toute promotion implicite et
   respecte les règles de publication existantes.
7. Les cartes publiques continuent à récupérer l'image principale par la route
   compatible existante ; le détail public expose en plus la galerie complète.

## Domain model

- `PropertyPhotoValues` comprend maintenant `mediaKind: "IMAGE"` et une
  `position` entière positive ou nulle.
- La réhydratation rejette identifiants, classification, type de contenu, taille,
  hash, timestamps, kind ou position corrompus.
- `validatePropertyPhotoOrder` valide la permutation exacte des médias de la
  propriété et refuse liste vide, doublon, UUID invalide, média manquant,
  inconnu ou appartenant à une autre propriété.
- `InvalidPropertyPhotoOrderError` représente un ordre métier invalide.
- `PropertyPublishedPhotoMutationForbiddenError` protège les standards photo
  des publications v1 existantes après une mutation destructive.
- La disponibilité future d'autres kinds est préparée par le discriminant, sans
  implémenter vidéo, plan ou document.

## Application commands/use cases

Les use cases existants restent la façade métier :

- `RegisterPropertyPhoto` : ajoute une image à la fin ;
- `ListPropertyPhotos` : renvoie l'ordre canonique ;
- `RetrievePropertyPhotoContent` : lit le contenu privé ;
- `SelectPropertyPrimaryPhoto` : remplace atomiquement la principale ;
- `DeletePropertyPhoto` : refuse la principale, vérifie la publication puis
  compacte l'ordre ;
- `ReorderPropertyPhotos` : nouveau use case de permutation complète.

Sémantique de replay : sélectionner de nouveau la même image et réenvoyer le
même ordre sont sans écriture supplémentaire ; supprimer deux fois produit un
404 au second appel ; l'ajout conserve la sémantique POST existante et n'est pas
présenté comme idempotent.

## Authorization

- Les grants existants restent spécialisés pour créer, lire, sélectionner la
  principale et supprimer.
- Le seul grant ajouté est `REORDER_PROPERTY_PHOTOS`.
- Il est transmis par l'adapter d'autorité externe, filtré par
  `toPropertyAuthority` et exigé dans le use case.
- Tous les endpoints privés exigent l'identité authentifiée et une autorité
  tenant-scoped.

## Persistence

Le repository PostgreSQL :

- verrouille la propriété avant ajout, suppression ou réorganisation ;
- calcule la position d'ajout à partir de la galerie active verrouillée ;
- charge toujours la galerie par `gallery_position, photo_id` ;
- filtre les lignes legacy sans contenu ou position des nouvelles opérations ;
- déplace temporairement les positions hors de leur plage avant leur
  réaffectation, afin de respecter l'index unique pendant toute la transaction ;
- compacte toutes les positions supérieures après suppression ;
- ne modifie rien lors d'un replay du même ordre ;
- utilise le même modèle de galerie dans la réhydratation Property et les règles
  de publication.

La liste publique garde une jointure vers la principale dans une requête unique.
Le détail effectue deux requêtes bornées : propriété puis galerie complète. Aucun
N+1 par média ou par propriété n'a été introduit.

## Migration strategy

Migration créée : `0016_property_media_gallery.sql`, avec snapshot Drizzle
`0016_snapshot.json` et journal append-only mis à jour.

La migration :

1. ajoute `media_kind TEXT NOT NULL DEFAULT 'IMAGE'` ;
2. ajoute `gallery_position INTEGER NULL` ;
3. contraint le kind à `IMAGE` ;
4. impose qu'une ligne content-backed possède une position non négative, et
   qu'une ligne legacy sans contenu conserve une position nulle ;
5. ajoute l'index unique partiel
   `(tenant_id, property_id, gallery_position) WHERE gallery_position IS NOT NULL` ;
6. backfille les contenus existants par
   `row_number() over (partition by tenant_id, property_id order by registered_at, photo_id) - 1` ;
7. force l'évaluation des triggers différés avant validation de la nouvelle
   contrainte ;
8. valide la contrainte après backfill ;
9. remplace la policy publique principale-only par la policy galerie ;
10. réaffirme `ENABLE/FORCE ROW LEVEL SECURITY` ;
11. ajoute au lecteur public les colonnes de métadonnées strictement requises.

Les lignes URL-only, leur URL et leur indicateur principal ne sont ni supprimés
ni réécrits. Elles reçoivent `media_kind = IMAGE` par défaut et conservent une
position nulle. Les anciennes images content-backed sont ordonnées de manière
stable ; leur principale existante est préservée.

Un premier essai PostgreSQL a révélé qu'un `CHECK` SQL sans
`gallery_position IS NOT NULL` pouvait retourner `UNKNOWN` et accepter une
nouvelle image sans position. La contrainte, le schéma et le snapshot ont été
corrigés, puis toutes les suites PostgreSQL ont été relancées avec succès.

## RLS

- `property_photos` conserve `ENABLE ROW LEVEL SECURITY` et
  `FORCE ROW LEVEL SECURITY`.
- La policy `property_photos_tenant_isolation` continue à couvrir SELECT,
  INSERT, UPDATE et DELETE via `app.tenant_id`.
- Les tests réels prouvent qu'un tenant ne peut ni lire, ni modifier, ni
  supprimer, ni insérer les médias d'un autre tenant.
- La policy restrictive
  `property_photos_public_catalog_media_select` exige une image complète,
  disponible, positionnée, de kind `IMAGE`, appartenant à une propriété
  `PUBLISHED` du tenant résolu.
- Une propriété `DRAFT` ou `WITHDRAWN` ne peut donc pas être atteinte par une
  route média alternative.

Privilèges :

- `monpiole_runtime` conserve le grant table-level `SELECT, INSERT, UPDATE,
  DELETE` sur `property_photos`, donc les deux nouvelles colonnes sont
  disponibles sans élargissement à d'autres tables ou opérations ;
- `monpiole_public_catalog_reader` n'a aucun grant table-level ni droit
  d'écriture. Il possède les colonnes historiques nécessaires au read model et
  reçoit uniquement `photo_id`, `category`, `media_kind`, `gallery_position`
  supplémentaires ;
- le rôle public reste `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`
  et `NOBYPASSRLS`.

## API

Routes privées conservées :

- `GET /v1/properties/{propertyId}/photos` ;
- `POST /v1/properties/{propertyId}/photos` ;
- `GET /v1/properties/{propertyId}/photos/{photoId}/content` ;
- `PUT /v1/properties/{propertyId}/photos/{photoId}/primary` ;
- `DELETE /v1/properties/{propertyId}/photos/{photoId}`.

Route privée ajoutée :

- `PUT /v1/properties/{propertyId}/photos/order`, corps strict
  `{ "photoIds": [uuid, ...] }`, réponse 200 avec la galerie serveur.

La projection privée ajoute `mediaKind` et `position` à chaque photo. Les erreurs
400/401/403/404/409/500 suivent les Problem Details existants. Un ordre invalide
devient `INVALID_REQUEST`; une suppression qui casserait le standard publié
devient 409 `PROPERTY_PUBLISHED_PHOTO_MUTATION_FORBIDDEN`.

Routes publiques :

- `GET /v1/public/properties` conserve la principale sans N+1 ;
- `GET /v1/public/properties/{publicPropertyId}` renvoie maintenant `gallery` ;
- `GET /v1/public/properties/{publicPropertyId}/primary-photo` est conservée ;
- `GET /v1/public/properties/{publicPropertyId}/media/{mediaId}/content` est
  ajoutée, anonyme, Host-scoped, avec ETag, 304, cache public court, `Vary:
  Host, Origin` et `X-Content-Type-Options: nosniff`.

Un identifiant invalide produit 400. Une propriété non publiée, retirée, d'un
autre tenant ou un média inconnu produit le même 404 sûr sans fuite d'existence.

## OpenAPI

`engineering/contracts/http/openapi.json` a été régénéré depuis le runtime.
Il documente :

- `PropertyPhoto.mediaKind` et `PropertyPhoto.position` ;
- `ReorderPropertyPhotosRequest` et la route d'ordre ;
- `PublicPropertyMedia` et `PublicPropertyDetail.gallery` ;
- la route binaire publique et ses types JPEG/PNG/WebP ;
- sécurité, réponses, Problem Details et contraintes des payloads.

Les tests de contrat vérifient les nouvelles routes et les projections ; le
contrat généré correspond au runtime.

## Private Web UX

La galerie privée :

- affiche toutes les images dans l'ordre serveur ;
- rend la principale immédiatement visible et désactive sa suppression ;
- conserve l'ajout, la consultation, la sélection principale et la suppression ;
- ajoute des boutons accessibles « Monter la photo » / « Descendre la photo » ;
- considère la réponse serveur comme autorité après réorganisation ;
- compacte immédiatement l'état local après une suppression réussie ;
- expose les états galerie vide, erreur, validation, mutation en cours, succès,
  action interdite et principale ;
- utilise les primitives et tokens existants, avec adaptation responsive mobile
  et tablette.

## Public catalog integration

- Les cartes continuent à afficher la principale issue de la même table et le
  fallback existant lorsqu'aucune image publique n'est disponible.
- Le détail affiche la galerie ordonnée et marque l'image principale.
- La projection publique contient seulement `mediaId`, kind, catégorie,
  position, statut principal, content type et URL API sûre.
- Aucun `tenantId`, contenu base64, hash, storage credential, adresse exacte ou
  trace d'autorité n'est exposé dans le JSON public.
- La résolution Host → tenant et les restrictions `PUBLISHED` restent
  obligatoires pour la galerie comme pour la principale.

## Publication integration

La publication continue d'utiliser `Property.photos`, désormais rechargé depuis
la galerie active ordonnée. Les règles historiques sont inchangées :

- présence d'une principale ;
- nombre minimal tenant/type ;
- catégories exigées selon le type de bien ;
- contenu disponible et métadonnées valides.

Après publication standard v1 :

- ajout, réorganisation et changement de principale restent possibles ;
- la principale ne peut pas être supprimée ;
- la suppression d'une secondaire est refusée si le nombre minimal, une
  catégorie obligatoire ou la principale deviendrait invalide ;
- aucune dépublication implicite n'est effectuée.

Les publications historiques dont `photo_standard_version IS NULL` conservent
l'exception de compatibilité déjà définie par TASK-056 : elles restent lisibles
et retirable sans conversion forcée. Toute nouvelle publication applique le
standard v1 strict et les mutations suivantes sont protégées.

## Storage/CDN boundary

TASK-067 conserve le stockage binaire PostgreSQL existant et n'introduit aucun
fournisseur cloud. Les clients reçoivent des URLs d'API et non le contenu base64
ou des détails de persistence. Le domain model porte un kind et les métadonnées
de contenu mais ne dépend ni de PostgreSQL, ni de Drizzle, NestJS, React, AWS,
Azure ou Cloudflare.

Une évolution future peut remplacer l'adapter de contenu par object storage,
CDN, thumbnails ou variantes responsive sans changer les commandes Property ni
les projections métier. Transcoding, vidéo, AVIF distribué et provisioning CDN
restent hors scope.

## Tests executed

Couverture ajoutée ou étendue :

- domaine/application : réhydratation média, permutation exacte, inconnus,
  doublons, autorisation et protection d'une publication ;
- unitaires Property/public catalog : ajout, plusieurs médias, ordre,
  principale/replacement, suppression secondaire/principale, idempotence et
  média public ;
- HTTP : succès, 400, 401, 403, 404, 409, tenant, ordre rejoué, payload dupliqué
  ou incomplet et projections ;
- PostgreSQL : upgrade 0015→0016, préservation legacy, backfill stable, insert,
  ordre, replay, suppression/compaction, unicité, contrainte de position,
  concurrence, publication et RLS cross-tenant ;
- catalogue public PostgreSQL/HTTP/Web : galerie ordonnée, contenu, retrait,
  isolation Host/tenant et absence de données privées ;
- Web privé : affichage, vide, ajout, principale, suppression, réorganisation,
  validation, erreurs et succès ;
- contrats OpenAPI et non-régression TASK-056 à TASK-066.

## Commands executed

Principales commandes de validation réellement exécutées :

- `docker version --format "Client={{.Client.Version}} Server={{.Server.Version}}"`
- `corepack pnpm -r typecheck`
- `corepack pnpm typecheck:tests`
- `corepack pnpm test:unit`
- `corepack pnpm test:integration`
- `corepack pnpm test:contract`
- `corepack pnpm exec vitest run --project persistence-integration`
- `corepack pnpm service:property-management:test:integration`
- `corepack pnpm app:web:test`
- `corepack pnpm app:api:openapi`
- `corepack pnpm app:api:contracts:check`
- `corepack pnpm app:api:build`
- `corepack pnpm app:web:build`
- `corepack pnpm architecture:check`
- `corepack pnpm service:property-management:migration:check`
- `git diff --check`
- `git status --short`

Drizzle a d'abord été lancé sans TTY et a demandé une décision interactive de
renommage de policy ; la génération a été relancée avec TTY, le renommage a été
choisi, puis le SQL a été revu manuellement pour obtenir un DROP/CREATE explicite
de policy et le backfill compatible.

Aucun script lint/format dédié n'est configuré dans le `package.json` racine ;
la validation disponible correspondante est `git diff --check`.

## Results

| Validation | Résultat exact |
| --- | --- |
| Docker | PASS — Client 29.7.2, Server 29.7.2 |
| Unit complet | PASS — 29 fichiers, 221 tests |
| Integration HTTP/runtime complet | PASS — 21 fichiers, 194 tests |
| Contract/OpenAPI complet | PASS — 17 fichiers, 96 tests |
| Web complet | PASS — 19 fichiers, 136 tests |
| Persistence PostgreSQL complet | PASS — 7 fichiers, 116 tests |
| PostgreSQL Property ciblé | PASS — 4 fichiers, 89 tests |
| PostgreSQL galerie/catalogue ciblé | PASS — 2 fichiers, 29 tests |
| Unit TASK-067 ciblé | PASS — 3 fichiers, 36 tests |
| HTTP TASK-067 ciblé | PASS — 3 fichiers, 37 tests |
| OpenAPI TASK-067 ciblé | PASS — 2 fichiers, 17 tests |
| Typecheck récursif | PASS — 9 projets |
| Typecheck tests | PASS |
| Migration Drizzle | PASS — `Everything's fine` |
| Génération OpenAPI | PASS |
| Build API + dépendances | PASS — 6 projets |
| Build Web | PASS — 123 modules transformés, 5.50 s |
| Architecture | PASS |
| `git diff --check` | PASS |

Les tests PostgreSQL ont réellement utilisé Docker/Testcontainers avec l'image
épinglée `postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687`.

## Known limitations

- Seul le kind `IMAGE` est implémenté.
- Le stockage reste base64/PostgreSQL, adapté au socle actuel mais pas à une
  plateforme média à fort volume.
- Les lignes URL-only legacy restent conservées mais sont hors galerie active ;
  aucun nouveau writer ne crée ce format.
- Pas de drag-and-drop : les contrôles monter/descendre sont volontairement
  privilégiés pour l'accessibilité et la robustesse.
- La base garantit positions uniques et non négatives ; la contiguïté est
  maintenue transactionnellement par le repository, pas par un trigger SQL
  complexe.

## Deferred work

- Object storage et CDN ;
- thumbnails, `srcset`, WebP/AVIF dérivés et optimisation asynchrone ;
- vidéo, visite virtuelle, plan et document ;
- migration ou retrait définitif du champ legacy `url` après disparition des
  données historiques ;
- éventuel drag-and-drop accessible si une dépendance déjà adoptée le justifie.

## Files changed

### API et contrats

- `apps/api/src/app.module.ts`
- `apps/api/src/composition/create-postgres-runtime-composition.ts`
- `apps/api/src/composition/identity-external-authority.adapter.ts`
- `apps/api/src/contracts/v1/properties/property.schema.ts`
- `apps/api/src/contracts/v1/public-properties/public-property.schema.ts`
- `apps/api/src/http/authenticated-authority/authenticated-authority.ts`
- `apps/api/src/http/errors/problem-details.filter.ts`
- `apps/api/src/http/properties/property-photos.controller.ts`
- `apps/api/src/http/properties/property.dto.ts`
- `apps/api/src/http/properties/property.mapper.ts`
- `apps/api/src/http/public-properties/public-properties.controller.ts`
- `apps/api/src/http/public-properties/public-property.dto.ts`
- `apps/api/src/http/public-properties/public-property.mapper.ts`
- `engineering/contracts/http/openapi.json`

### Web

- `apps/web/src/features/properties/PropertyCompositionSection.test.tsx`
- `apps/web/src/features/properties/PropertyPages.test.tsx`
- `apps/web/src/features/properties/PropertyPhotoGallery.test.tsx`
- `apps/web/src/features/properties/PropertyPhotoGallery.tsx`
- `apps/web/src/features/properties/PropertyPublicationSection.test.tsx`
- `apps/web/src/features/properties/property-api.ts`
- `apps/web/src/features/properties/property-errors.ts`
- `apps/web/src/features/properties/property-model.ts`
- `apps/web/src/features/public-catalog/PublicCatalogPages.test.tsx`
- `apps/web/src/features/public-catalog/PublicPropertyDetailPage.tsx`
- `apps/web/src/features/public-catalog/public-property-api.ts`
- `apps/web/src/features/public-catalog/public-property-model.ts`
- `apps/web/src/styles/features.css`

### Property Management, migration et persistence

- `services/property-management/migrations/0016_property_media_gallery.sql`
- `services/property-management/migrations/meta/0016_snapshot.json`
- `services/property-management/migrations/meta/_journal.json`
- `services/property-management/src/application/manage-property-photos.ts`
- `services/property-management/src/application/property-authority.ts`
- `services/property-management/src/application/property-photo-repository.ts`
- `services/property-management/src/application/public-property-catalog-query.ts`
- `services/property-management/src/application/public-property-catalog.ts`
- `services/property-management/src/domain/property-photo.ts`
- `services/property-management/src/index.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-photo-repository.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-property-repository.ts`
- `services/property-management/src/infrastructure/persistence/postgres/postgres-public-property-catalog-query.ts`
- `services/property-management/src/infrastructure/persistence/postgres/schema.ts`

### Tests

- `services/property-management/tests/postgres-property-primary-photo.test.ts`
- `services/property-management/tests/postgres-property-repository.test.ts`
- `services/property-management/tests/postgres-public-property-catalog.test.ts`
- `tests/contract/property-openapi.test.ts`
- `tests/contract/public-property-catalog-openapi.test.ts`
- `tests/integration/api-identity-postgres-runtime.test.ts`
- `tests/integration/api-properties.test.ts`
- `tests/integration/api-property-photos.test.ts`
- `tests/integration/api-public-property-catalog.test.ts`
- `tests/unit/property-management.test.ts`
- `tests/unit/property-media-gallery.test.ts`
- `tests/unit/public-property-catalog.test.ts`

### Documentation

- `.codex/tasks/TASK-067-property-media-gallery-evolution-web-vertical-slice.md`

## Final status

**DONE** — les 22 critères de DONE de TASK-067 sont satisfaits. La migration
0016, la galerie ordonnée privée/publique, les invariants de principale et de
publication, l'autorisation, la RLS, les grants, OpenAPI, les interfaces Web et
les tests PostgreSQL réels sont validés. Aucun commit et aucun push n'ont été
effectués ; tous les changements restent disponibles dans le working tree pour
revue.
