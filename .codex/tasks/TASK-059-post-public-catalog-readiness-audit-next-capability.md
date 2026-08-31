# TASK-059 — Post-Public-Catalog Readiness Audit & Next Capability

- **Statut :** DONE — audit et définition uniquement
- **Date :** 2026-08-31
- **Branche auditée :** `main`
- **HEAD audité :** `6910457 feat(property): add tenant-scoped public catalog slice`
- **Référence d'implémentation :** TASK-058
- **Readiness produit :** **READY WITH CONTAINED GAPS**
- **Readiness Internet production :** **NO-GO**
- **Prochaine capability retenue :** **Property Geolocation**
- **Commit/push :** aucun

## 1. Executive Summary

La tranche TASK-058 est une fondation produit cohérente pour poursuivre le
développement. Le chemin public est réellement distinct du chemin privé : un
`Host` exact et allowlisté résout un seul tenant côté serveur, les use cases
reçoivent ce tenant explicitement, un pool PostgreSQL séparé utilise le rôle
`monpiole_public_catalog_reader`, les requêtes portent leurs propres prédicats
tenant et `PUBLISHED`, et la RLS forcée ajoute une défense restrictive. Aucun
`tenantId` client, DTO privé, owner, identité, adresse précise ou trace interne
n'est exposé par les réponses publiques.

Les validations fraîches passent, y compris Docker/PostgreSQL : 65/65 tests
Property Management PostgreSQL, 8/8 HTTP public, 11/11 runtime PostgreSQL,
4/4 OpenAPI public, 7/7 Web public, 170/170 unitaires, 159/159 intégration,
83/83 contrats, 107/107 Web et 611/611 pour la suite complète. Les typechecks,
builds, migrations, génération OpenAPI et contrôles d'architecture passent.

Aucun **BLOCKER** n'empêche la prochaine tranche fonctionnelle. Les gaps
produit principaux sont bornés : absence totale de retrait/dépublication,
absence de géolocalisation structurée malgré une adresse textuelle,
non-réévaluation des biens publiés lorsqu'un standard photo tenant est durci,
mapping imparfait de certaines violations SQL en erreur métier et couverture
multi-tenant complète seulement par composition de couches. OpenAPI décrit les
corps et statuts mais omet plusieurs headers réellement supportés, dont
`If-None-Match`, `ETag`, `Cache-Control` et `Vary`.

Le catalogue ne peut pas être exposé sur Internet en production. La garde
actuelle ferme l'allowlist lorsque `MONPIOLE_ENV` vaut exactement `production`,
mais rate limiting, anti-abus, activation/revue éditoriale, provisioning et
attestation du reader, ingress préservant `Host`, capacité image, charge,
observabilité, procédure d'incident et retrait opérationnel ne sont pas prouvés.
Le verdict Internet reste donc indépendant et explicitement **NO-GO**.

La réévaluation fonctionnelle retient désormais **Property Geolocation**. Le
retrait reste plus petit et plus urgent pour le contrôle opérationnel, mais la
géolocalisation est la fondation commune à la carte, aux recherches par zone ou
rayon, à la proximité, aux quartiers/communes et au tri par distance. Une
tranche provider-neutral, manuelle et privacy-first peut être livrée sans carte
ni géocodeur, tout en fixant avant ces usages le modèle DDD, l'héritage des
`UNIT`, la précision et la projection publique. **Property Catalog Withdrawal**
reste HIGH, obligatoire avant ouverture Internet, et candidat immédiat après
TASK-060. La future TASK-060 ne doit pas devenir un paquet de hardening Internet.

## 2. Git Baseline

Commandes exécutées avant toute modification :

```text
git status
git log -5 --oneline
git branch --show-current
```

Résultat observé :

| Élément | Preuve |
| --- | --- |
| Branche | `main` |
| HEAD | `6910457 feat(property): add tenant-scoped public catalog slice` |
| Historique pertinent | `ed8db4a` TASK-057, `b03501a` permissions photo, `54f05b7` publication/photo |
| Upstream | `main...origin/main [ahead 42]` |
| Worktree initial | propre, aucun fichier staged, modifié ou non suivi |
| Commit automatique | aucun |

La baseline correspond exactement à celle demandée. Le rapport TASK-058
indique comme HEAD de travail `ed8db4a` parce que ses changements n'étaient pas
encore commités au moment de sa rédaction ; le commit courant `6910457` porte
bien le message proposé par TASK-058 et contient la tranche auditée.

## 3. Scope Reviewed

### 3.1 Artefacts de référence

- `.codex/tasks/TASK-057-post-publication-readiness-audit-public-property-catalog-discovery.md` ;
- `.codex/tasks/TASK-058-public-property-catalog-api-web-vertical-slice.md` ;
- `AGENTS.md` ;
- ADR-0003, ADR-0004, ADR-0005, ADR-0006 et ADR-0007 ;
- READMEs Property Management, API et Web.

### 3.2 Domain, Application et persistance

- `services/property-management/src/domain/property.ts` ;
- `services/property-management/src/application/publish-property.ts` ;
- `public-property-catalog.ts` et `public-property-catalog-query.ts` ;
- `manage-property-photos.ts`, mises à jour de détails et d'informations cœur ;
- `postgres-public-property-catalog-query.ts` et repositories Property/photo ;
- migrations `0007` à `0011`, snapshot `0011` et journal Drizzle ;
- helper transactionnel `packages/persistence/src/transaction.ts`.

### 3.3 API, OpenAPI et runtime

- `apps/api/src/configuration/public-catalog.ts` ;
- composition PostgreSQL et pool reader séparé ;
- contrôleur, curseur, DTO, schemas et mappers publics ;
- filtre Problem Details et interceptor de contexte ;
- artefact `engineering/contracts/http/openapi.json`.

### 3.4 Web et tests

- routes, provider OIDC racine et `AuthenticationBoundary` ;
- tous les fichiers `apps/web/src/features/public-catalog/*` ;
- tests unitaires, HTTP, runtime PostgreSQL, PostgreSQL Property, OpenAPI et Web
  directement liés au catalogue ;
- gates globales du monorepo.

### 3.5 Hors scope

Aucune feature, migration, route, policy, dépendance ou optimisation de bundle
n'a été implémentée. L'audit n'a pas corrigé les gaps fonctionnels identifiés et
n'a pas commencé TASK-060.

## 4. Public Boundary Architecture

La boundary respecte les ADR applicables :

1. l'interface HTTP résout le tenant depuis `Host` ;
2. les use cases publics de Property Management reçoivent `tenantId`
   explicitement sans autorité OIDC ;
3. `PublicPropertyCatalogQuery` constitue un port Application dédié ;
4. `PostgresPublicPropertyCatalogQuery` reste un adapter Infrastructure du
   Bounded Context propriétaire de ses données ;
5. l'API mappe vers des DTO publics stricts et distincts ;
6. le Web utilise un client public same-origin sans Bearer ;
7. aucune lecture cross-service, projection externe, outbox ou nouveau service
   Catalog n'a été introduit.

Le choix d'une lecture directe est proportionné à la tranche. Les ports et DTO
forment une frontière remplaçable si une projection dédiée devient nécessaire.
La cohérence est immédiate à l'origine parce qu'il n'existe aucun pipeline
asynchrone entre publication et catalogue.

La frontière a néanmoins deux niveaux de confiance distincts : l'application
applique l'activation `Host → tenant`, tandis que PostgreSQL ne connaît que le
tenant UUID positionné dans `app.tenant_id`. Le rôle reader peut donc lire les
colonnes autorisées des lignes `PUBLISHED` de tout tenant dont l'UUID lui est
fourni. Le code anonyme ne permet pas au client de fournir cet UUID, mais le
credential reader et l'allowlist sont tous deux des actifs de production à
protéger.

## 5. Host Resolution Audit

### 5.1 Propriétés vérifiées

| Sujet | Résultat | Preuve |
| --- | --- | --- |
| Matching exact | PASS | Map exacte dans `public-catalog.ts`; aucun wildcard ni suffix match |
| Fallback | PASS | Aucun ; host absent/invalide/inconnu retourne `undefined`, puis 404 |
| Casse | PASS | Canonicalisation en minuscules, test `CATALOGUE.TEST:8443` |
| Port | PASS avec nuance | Le port non standard appartient à l'identité ; host sans port ne matche pas |
| Host inconnu | PASS | 404 avant tout appel use case dans `api-public-property-catalog.test.ts` |
| `X-Forwarded-Host` | PASS applicatif | Ignoré ; le test envoie un forwarded host valide avec un `Host` inconnu et obtient 404 |
| Injection Host | PASS applicatif | espaces, virgule, `@`, path, slash, query, fragment, wildcard et URL complète refusés |
| Tenant UUID client | PASS | absent des query/path/body ; `X-Tenant-Id` est `not-applicable` et rejeté |
| Activation par défaut | PASS | allowlist vide, tous les catalogues fermés |

`canonicalHost()` utilise le parseur WHATWG puis exige que la forme canonique
soit identique à la valeur normalisée. Cela refuse notamment les formes URL,
userinfo et encodages ambigus. Le port explicite est conservé lorsqu'il est
non standard ; certaines formes de port par défaut peuvent être canonicalisées
par le parseur puis refusées, ce qui est fail-closed.

### 5.2 Limite infrastructure

Un client peut toujours choisir son header `Host` lorsqu'il atteint directement
l'origine. Ce n'est pas un contournement du mapping : il ne sélectionne qu'un
host déjà activé et des données destinées à être publiques. En revanche, DNS,
TLS/SNI, routage, accès direct à l'origine et cache partagé doivent être alignés
par l'ingress. Le dépôt ne prouve pas cet alignement.

La configuration n'active pas `trust proxy` et ne lit aucun forwarded host.
Cette position est sûre tant que l'ingress préserve le `Host` original. Tout
passage futur à un forwarded host doit introduire une liste de proxies de
confiance et des tests contre les headers forgés.

### 5.3 Garde production

Une allowlist non vide échoue seulement lorsque
`MONPIOLE_ENV === "production"`. `MONPIOLE_ENV` n'est pas validé par un enum
central et une valeur absente ou mal orthographiée ne déclenche pas cette garde.
Cette faiblesse ne rend pas le produit non prêt pour TASK-060, mais elle interdit
de considérer la garde actuelle comme une autorisation production fail-closed.

## 6. PostgreSQL Reader Audit

### 6.1 Séparation effective

`createPostgresApiRuntime()` crée le pool reader uniquement si l'allowlist est
non vide. L'URL publique est remappée vers la configuration PostgreSQL commune
et son username décodé doit être exactement
`monpiole_public_catalog_reader`. Le test runtime observe simultanément deux
sessions distinctes, `monpiole_runtime` et le reader public. Les deux pools sont
fermés au shutdown.

### 6.2 Privilèges observés sur PostgreSQL synthétique réel

- `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOBYPASSRLS` ;
- aucune relation Property Management possédée ;
- absence d'appartenance au rôle owner prouvée ;
- `USAGE`, sans `CREATE`, sur le schema `property_management` ;
- aucun privilège de table complet ;
- exactement 35 grants `SELECT` de colonne : 27 sur `properties`, 8 sur
  `property_photos` ;
- aucun accès à `address_line`, owners, ownerships, Buildings, relations Unit,
  standards ou audits ;
- aucun `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` ou `TRIGGER` ;
- tentative d'`UPDATE`, lecture d'adresse, owner et audit refusées ;
- contexte `SET LOCAL app.tenant_id` vide après retour au pool.

Le reader peut lire en interne `tenant_id` et `status`, nécessaires aux
prédicats/RLS, ainsi que le contenu, type, taille et hash de la photo nécessaires
à la réponse binaire. Ces colonnes ne sont pas exposées dans le JSON.

### 6.3 `search_path`, ownership et droits indirects

Les requêtes applicatives qualifient toutes les relations avec
`property_management`. Le reader ne peut pas créer dans ce schema. Les
fonctions de migration observées sont des fonctions trigger, aucune n'est
`SECURITY DEFINER`. Aucun grant de table à `PUBLIC` n'apparaît dans la chaîne de
migrations.

La preuve a toutefois une limite opérationnelle : `0011` révoque les droits
directs du reader, mais ne neutralise pas un droit qui serait reçu via `PUBLIC`
ou via un rôle auquel le login de production pourrait faire `SET ROLE`. Le test
ne dresse pas la liste exhaustive de toutes les memberships et ne vérifie pas
les privilèges du schema PostgreSQL `public` ni un `search_path` imposé dans la
DSN. Ces points doivent être attestés lors du provisioning réel.

### 6.4 Provisioning et upgrade

Le rôle doit exister avant `0011`. Cela signifie que même un environnement où
l'allowlist reste vide ne peut appliquer la migration sans provisioning du rôle.
Le credential n'est pas versionné, ce qui est correct, mais l'ordre
Operations → migration est une dépendance de déploiement obligatoire.

## 7. RLS Audit

`properties` et `property_photos` ont RLS activée et forcée. Pour le reader :

- la policy permissive tenant, ciblée sur `public`, exige
  `tenant_id = current_setting('app.tenant_id')` ;
- la policy restrictive `properties_public_catalog_published_select` exige
  `status = 'PUBLISHED'` ;
- la policy restrictive photo exige une photo `AVAILABLE`, principale,
  content-backed et rattachée à une Property publiée du même tenant ;
- les repositories répètent encore les prédicats tenant, statut et photo.

PostgreSQL combine au moins une policy permissive avec toutes les policies
restrictives applicables. Le résultat attendu est donc tenant **ET** publié,
pas tenant **OU** publié.

Les tests réels prouvent :

- DRAFT invisible ;
- tenant B invisible depuis le contexte A ;
- absent, DRAFT et autre tenant renvoient la même absence au port public ;
- photo non publique absente ;
- impossibilité d'écrire ;
- policy et rôle cible visibles dans `pg_policies` ;
- remplacement de photo principale publié autorisé et audité ;
- suppression/désélection de la principale publiée refusée ;
- publication legacy sans contenu listée avec `primaryPhoto: null`.

Les jointures ne contournent pas la boundary : RLS s'applique à chaque table et
les clauses de jointure répètent tenant, statut et critères de contenu.

### 7.1 Invariant post-publication manquant

La garde différée de `0009` se déclenche sur une écriture Property ou photo et
relit le standard photo tenant courant. Une mise à jour de
`property_photo_standards` ne déclenche cependant aucune réévaluation des
Properties déjà publiées. Un standard peut donc devenir plus strict, laisser un
bien non conforme visible, puis faire échouer plus tard une mutation sans lien
direct. La sémantique « standard figé à publication » ou « conformité continue »
n'est pas explicitement tranchée.

## 8. Public DTO/Data Exposure Audit

### 8.1 Champs publics exacts

| Projection | Champs |
| --- | --- |
| Liste et détail | `publicPropertyId`, `title`, `propertyType`, `transactionType`, `apartmentSubtype?`, `structuralRole`, `publishedAt` |
| `location` | `country`, `city`, `district` |
| Location longue | `kind`, `currency`, `rentAmountMinor`, `rentPeriod`, `securityDepositAmountMinor?`, `chargesAmountMinor?` |
| Location courte | `kind`, `currency`, `rateAmountMinor`, `pricingUnit` |
| Vente | `kind`, `currency`, `salePriceAmountMinor` |
| `primaryPhoto` | `null` ou `url`, `contentType` |
| Détail seulement | `description`, puis `details.usableSurfaceSquareMeters?`, `rooms?`, `bedrooms?`, `bathrooms?`, `furnished?` |
| Pagination | `pageInfo.nextCursor`, `pageInfo.hasNextPage` |

Les schemas Zod sont stricts et les mappers construisent chaque champ. Aucun DTO
privé n'est importé.

### 8.2 Champs non exposés

- `tenantId`, owner IDs, ownerships, contacts et quotes-parts ;
- identity, membership, grants, rôles internes et OIDC ;
- `addressLine` et coordonnées précises ;
- `actorId`, `authorityId`, correlation de mutation et traces de publication ;
- `createdAt`, `updatedAt`, `publishedByActorId`, `photoStandardVersion` ;
- `photoId`, catégorie, contenu base64, hash, taille et timestamps photo ;
- Building IDs, Unit IDs/codes, parents et relations de composition ;
- standards photo et audits.

### 8.3 Inférences résiduelles

| Canal | Évaluation |
| --- | --- |
| 404 | DRAFT, absent, autre tenant et photo non publique partagent la même 404 ; host inconnu a volontairement un code 404 distinct |
| Pagination | révèle le volume et l'ordre public ; accepté pour un catalogue |
| Curseur | base64url décodable de valeurs déjà publiques (date/UUID), sans tenant ; opaque contractuellement, pas secret |
| Erreurs | structures sûres, sans SQL/tenant/rôle ; causes de validation fermées |
| ETag | SHA-256 déterministe pouvant corréler deux images publiques identiques ; faible risque accepté |
| Temps | host inconnu évite la DB tandis qu'un bien absent l'interroge ; aucune garantie constant-time n'est fournie |
| Taille | reflète les champs et images publics ; descriptions longues et images peuvent faciliter scraping/coût |

Le risque éditorial reste majeur avant Internet : titre, description, ville et
quartier sont des textes tenant libres. Un utilisateur peut y écrire une adresse
précise ou une donnée personnelle même si `addressLine` est techniquement exclu.

## 9. HTTP Audit

### 9.1 Routes et authentification

- `GET /v1/public/properties` ;
- `GET /v1/public/properties/{publicPropertyId}` ;
- `GET /v1/public/properties/{publicPropertyId}/primary-photo`.

Les contrôleurs publics ne résolvent aucune autorité et ne demandent aucun
Bearer. Les contrôleurs privés continuent de résoudre l'autorité OIDC et les
grants métier. La suite globale et les tests privés confirment l'absence de
régression observable.

### 9.2 Comportements vérifiés

| Cas | Résultat |
| --- | --- |
| Liste valide | 200 JSON, ordre stable, filtres et pagination bornés |
| Détail valide | 200 DTO strict |
| Photo valide | 200 JPEG/PNG/WebP, longueur, ETag, `nosniff` |
| `If-None-Match` correspondant, faible ou `*` | 304 sans body |
| UUID invalide | 400 avant use case |
| Curseur/filtre/limit invalide ou champ non autorisé | 400 |
| Host inconnu | 404 avant use case |
| Bien absent/DRAFT/autre tenant | 404 `PUBLIC_PROPERTY_NOT_FOUND` |
| Photo absente/non publique | même 404 publique |
| Page vide | 200, `items: []`, pas de curseur suivant |
| Erreur inattendue | 500 Problem Details sûr |

Liste et détail émettent `Cache-Control: public, max-age=60`; la photo
`public, max-age=300`, `ETag`, `Content-Length`, `Content-Type` et
`X-Content-Type-Options: nosniff`. Les réponses varient sur `Host, Origin`.
Toutes les erreurs passent par `ProblemDetailsFilter` et reçoivent
`Cache-Control: no-store`.

Les 404 non révélatrices s'appliquent à l'existence/visibilité d'une Property
au sein d'un catalogue connu. L'existence d'un mapping de host est inférable par
le code Problem Details et le temps de réponse ; cette activation n'est pas
traitée comme un secret.

## 10. OpenAPI Audit

### 10.1 Alignement vérifié

- les trois routes et operation IDs sont présents ;
- chacune déclare `security: []` ;
- aucun 401/403 normal ni request body ;
- seuls `limit`, `cursor`, `type`, `transactionType` sont publiés pour la liste ;
- bornes, enums, statuts 200/304/400/404/500 et contenus image sont présents ;
- composants publics stricts, séparés des DTO privés ;
- l'artefact commité se régénère sans diff.

### 10.2 Divergences documentaires

Le runtime supporte des éléments absents du contrat généré :

- header de requête `If-None-Match` sur la photo ;
- headers de réponse `Cache-Control` et `Vary` ;
- `ETag`, `Content-Length`, `Content-Type` et
  `X-Content-Type-Options` sur la photo ;
- `Cache-Control: no-store` et headers de trace sur les réponses d'erreur.

Les réponses réussies ne documentent actuellement que `X-Correlation-Id` et
`X-Request-Id`. Les paramètres de path publics portent `format: uuid`, mais le
JSON généré n'affiche pas explicitement `type: string`. Le contrat est fidèle
sur les opérations, données et statuts, mais incomplet sur le comportement HTTP
de cache/revalidation.

## 11. Web Audit

### 11.1 Résultats

- `/catalogue` et `/catalogue/:publicPropertyId` sont déclarées avant et hors
  de `AuthenticationBoundary` ;
- client public same-origin, sans `getAccessToken` ni Authorization ;
- filtres en URL, pagination, déduplication, loading, empty, retry et 404 ;
- navigation détail/retour, placeholders, alt, skip link, labels et focus ;
- libellés français et aucune enum technique affichée ;
- grilles responsives à 900 px et 620 px ;
- route React compatible avec une navigation directe au niveau du routeur.

### 11.2 Limites

`App` enveloppe toujours toutes les routes dans `Auth0SessionProvider` et
`routes.tsx` importe statiquement les features privées. Les tests du catalogue
injectent directement un `SessionContext` et prouvent qu'un état
loading/unauthenticated/error ne bloque pas la route ; ils ne constituent pas
un test navigateur de l'initialisation réelle Auth0 sur le catalogue. Le public
reste donc fonctionnellement hors de l'autorisation OIDC, mais pas découplé de
la dépendance, de la configuration ni du bundle Auth0.

Le build produit un chunk JS unique de **579,42 kB** minifié, **168,69 kB** gzip.
Le warning à 500 kB est une dette de performance et un risque UX sur réseau
mobile, pas un blocker de la prochaine tranche. Le code splitting des routes
publiques/privées est recommandé avant une audience Internet mesurable.

Un refresh direct dépend enfin du fallback SPA du serveur statique/ingress ; le
dépôt prouve le routeur et le build, pas cette configuration de déploiement.
L'image n'a pas de fallback `onError` si la route binaire échoue après le rendu
de la carte.

Le texte « Biens disponibles » dépasse le modèle actuel : `PUBLISHED` ne prouve
ni disponibilité locative, ni vacance, ni occupation. La copie doit rester
éditoriale ou être corrigée tant que la capability Availability n'existe pas.

## 12. Publication-to-Catalog Consistency

### 12.1 Flux courant

```text
PUT privé /publication
  → autorité interne + PUBLISH_PROPERTY
  → transaction tenant + SELECT FOR UPDATE
  → validation Domain et relecture photos/standard
  → UPDATE DRAFT vers PUBLISHED
  → garde SQL différée
  → COMMIT
  → nouvelle transaction reader publique
  → projection catalogue
```

À l'origine, la visibilité suit le commit PostgreSQL sans délai asynchrone. Un
appel catalogue commencé après le commit voit la ligne. Un appel concurrent en
`READ COMMITTED` peut naturellement voir l'état correspondant au snapshot de sa
propre statement.

### 12.2 Après modification d'un bien publié

- titre, description, localisation, détails et termes peuvent être mis à jour ;
- la Property reste `PUBLISHED` et la projection suivante voit les valeurs
  commitée ;
- une mutation Property déclenche la garde photo différée pour les publications
  version 1 ;
- un changement de sous-type incompatible peut donc rollbacker au niveau SQL,
  mais l'Application ne prévalide pas ce cas et peut retourner un 500 sûr ;
- le remplacement transactionnel de photo principale est autorisé, audité et
  produit un nouvel ETag au prochain accès ;
- la principale ne peut être supprimée ou désélectionnée sans remplacement ;
- une publication legacy peut rester sans contenu et utiliser le placeholder.

### 12.3 Cache et retrait

Les caches peuvent conserver une ancienne liste/détail 60 secondes et une
ancienne photo 300 secondes. Ce n'est pas une incohérence durable, mais toute
future promesse de retrait doit distinguer « invisible à l'origine après
commit » de « plus aucun cache ne peut servir l'ancienne représentation ».
Aucun mécanisme de purge n'existe.

### 12.4 Invariants absents

- aucune transition inverse ou état `WITHDRAWN` ;
- aucun archivage ;
- aucune décision explicite sur la conformité continue après durcissement du
  standard photo ;
- aucune disponibilité/occupation distincte de la publication ;
- aucune procédure unitaire de retrait Internet ; le retrait du mapping coupe
  tout le tenant ;
- aucune invalidation/purge de cache pour incident ou retrait légal.

## 13. Multi-Tenant Isolation Matrix

### 13.1 Résultat attendu et observé par composition de preuves

| Host / ressource | Tenant A `PUBLISHED` | Tenant A `DRAFT` | Tenant B `PUBLISHED` |
| --- | --- | --- | --- |
| Host A | visible | absent/404 | absent/404 |
| Host B | absent/404 | absent/404 | visible |
| Host inconnu | catalogue 404 avant DB | catalogue 404 avant DB | catalogue 404 avant DB |

Les preuves sont réparties :

- le test PostgreSQL sème A publié, A draft et B publié, puis prouve liste A,
  DRAFT caché et cross-tenant caché ;
- le test HTTP prouve Host A, Host B, Host inconnu, forwarded host ignoré et
  propagation du bon tenant, mais avec des use cases mockés ;
- le test runtime réel prouve un host, un tenant et deux pools distincts ;
- la RLS et les prédicats explicites rendent les résultats de la matrice
  cohérents.

Il n'existe pas un unique test full-stack qui combine deux hosts, les trois
Properties et PostgreSQL réel pour parcourir les neuf cellules. C'est un gap de
preuve ciblé, pas une preuve de fuite.

## 14. Migration/Upgrade Audit

### 14.1 `0011`

La migration :

- crée l'index partiel `(tenant_id, published_at DESC, property_id DESC)` pour
  `PUBLISHED` ;
- crée les deux policies restrictives ;
- rappelle `ENABLE/FORCE RLS` ;
- révoque les privilèges directs schema/tables du reader ;
- redonne `USAGE` et les 35 sélections de colonnes ;
- ne modifie aucune donnée ni aucun statut.

Le snapshot `0011` contient index et policies. Son `prevId` correspond à l'ID
du snapshot `0010`, et le journal contient l'entrée `idx: 11` attendue.

### 14.2 Preuves d'upgrade

- empty-to-head exécuté par la fixture PostgreSQL ;
- upgrade historique vers head couvert par les suites existantes ;
- upgrade `0010 → 0011` avec publication legacy couvert ;
- état de publication historique inchangé ;
- photo legacy nullable ;
- migration check Drizzle : PASS.

### 14.3 Idempotence et rollback

La chaîne est idempotente au niveau du journal : une migration enregistrée
n'est pas rejouée. Le SQL `CREATE INDEX/POLICY` n'est pas conçu pour être lancé
manuellement deux fois hors migrateur. Aucun down migration n'est fourni ; le
modèle du dépôt est append-only. Un rollback applicatif doit donc rester
compatible avec le schema head ou passer par une nouvelle migration corrective.

### 14.4 Hypothèses fragiles

- rôle reader provisionné avant la migration dans chaque environnement ;
- absence de grants `PUBLIC`, memberships ou options de connexion inattendues
  en production ;
- migration exécutée avec un owner capable de créer les policies et grants ;
- ingress et application déployés avec des configurations atomiquement
  compatibles ;
- aucun rollback ancien ne suppose l'absence des policies reader.

## 15. Validation Results

Toutes les commandes ci-dessous ont été réellement exécutées pendant TASK-059.

| Validation | Résultat exact |
| --- | --- |
| `docker version` | PASS — Desktop 4.87.0, client/Engine 29.7.2, API 1.55 |
| `service:property-management:migration:check` | PASS — `Everything's fine` |
| PostgreSQL Property Management | PASS — 3 fichiers, 65/65 |
| Unitaires catalogue ciblés | PASS — 2 fichiers, 13/13 |
| HTTP public ciblé | PASS — 1 fichier, 8/8 |
| Runtime PostgreSQL ciblé | PASS — 1 fichier, 11/11 |
| HTTP + runtime combinés | PASS — 2 fichiers, 19/19 |
| OpenAPI public ciblé | PASS — 1 fichier, 4/4 |
| Web catalogue ciblé | PASS — 1 fichier, 7/7 |
| Web complet | PASS — 15 fichiers, 107/107 |
| `corepack pnpm -r typecheck` | PASS — 9 workspaces applicatifs |
| Typecheck API | PASS |
| Typecheck Web | PASS |
| Typecheck tests | PASS |
| Unitaires complets | PASS — 25 fichiers, 170/170 |
| Intégration complète | PASS — 18 fichiers, 159/159 |
| Contrats complets | PASS — 14 fichiers, 83/83 |
| Suite complète `CI=true corepack pnpm test` | PASS — 78 fichiers, **611/611** |
| Build API | PASS — 6 workspaces construits |
| Build Web | PASS — 112 modules, JS 579,42 kB / gzip 168,69 kB, warning >500 kB |
| Génération OpenAPI | PASS — artefact régénéré sans diff |
| Architecture | PASS — workspace, exports, resolver, graph, boundaries, cycles, diagnostics |
| `git diff --check` avant rapport | PASS — aucune sortie |

Aucune suite n'a été skipped. Aucun résultat historique n'est présenté comme
une exécution courante.

## 16. Gap Register

### 16.1 Blockers

**Aucun BLOCKER produit observé.** Les points bloquant Internet sont classés
séparément `PRODUCTION GATE`.

### 16.2 Gaps produit et techniques

| ID | Classe | Description / preuve | Risque | Recommandation | Impact TASK-060 |
| --- | --- | --- | --- | --- | --- |
| G-01 | HIGH | Aucun retrait, dépublication ou archivage ; `PropertyStatus` vaut seulement DRAFT/PUBLISHED | Un tenant ne peut retirer un seul bien ; kill switch seulement global au host | Livrer un état WITHDRAWN et une transition privée explicite | Hors TASK-060 ; priorité immédiate après, obligatoire avant Internet |
| G-02 | HIGH | `PropertyLocation` ne contient que country/city/district/addressLine ; aucune coordonnée, précision, confidentialité ou règle d'héritage | Impossible de construire proprement carte, rayon, proximité ou tri par distance ; risque de fuite si l'adresse métier devient une position publique implicite | Introduire une géolocalisation WGS84 provider-neutral et une projection publique explicite | Objet principal de TASK-060 |
| G-03 | HIGH | `property_photo_standards` peut être durci sans trigger vers les Properties publiées | Bien visible mais non conforme ; échecs tardifs de mutations | Décider conformité figée vs continue, puis preflight/trigger ou job de remédiation | Ne doit pas être masqué ; follow-up dédié |
| G-04 | MEDIUM | Changement de sous-type publié peut être rejeté par la garde SQL et remonter en 500 | UX et contrat d'erreur imprécis, rollback toutefois sûr | Prévalider avec photos/standard ou mapper la contrainte vers 409 | Non bloquant ; la tranche géolocalisation ne doit pas modifier ce flux |
| G-05 | MEDIUM | OpenAPI omet If-None-Match, ETag, cache/Vary/nosniff/longueur et type explicite du path | Consommateurs et caches ne voient pas le contrat réel | Compléter annotations et tests de contrat | Documenter parfaitement les nouveaux champs ; correction globale séparée |
| G-06 | MEDIUM | Matrice A/B/unknown prouvée par couches, pas par un test full-stack unique | Régression de câblage host + pool + RLS moins directement détectée | Ajouter un test runtime réel à deux hosts et neuf cellules | Obligatoire pour les coordonnées privées/publiques de TASK-060 |
| G-07 | MEDIUM | Cache public sans purge : staleness 60 s JSON, 300 s photo | Une baisse de précision pourrait laisser une ancienne position en cache | Ne pas mettre en cache une réponse publique contenant des coordonnées avant purge fiable | TASK-060 impose `no-store` au détail géolocalisé |
| G-08 | LOW | Web dit « Biens disponibles » sans modèle d'occupation/disponibilité | Promesse produit ambiguë | Employer « biens publiés » jusqu'à Availability | Hors périmètre géolocalisation |
| G-09 | LOW | Pas de fallback après erreur `<img>` et refresh direct non testé sur serveur statique | Image cassée ou 404 de déploiement | Fallback image et smoke test de hosting | Non bloquant |
| TD-01 | TECH DEBT | Chunk unique 579,42 kB ; Auth0 et privé statiquement chargés pour le public | Temps de chargement et dépendance OIDC inutile | Lazy routes/code splitting, mesure Web Vitals | Ne pas mélanger à TASK-060 sauf changement local minime |
| TD-02 | TECH DEBT | Client Web caste le JSON sans validation runtime | Une divergence amont peut casser le rendu | Générer/partager un client ou valider à la boundary Web | Non bloquant |

### 16.3 Gates Internet production

| ID | Classe | Preuve manquante / risque | Recommandation | Impact TASK-060 |
| --- | --- | --- | --- | --- |
| PG-01 | PRODUCTION GATE | Garde allowlist dépend de la chaîne exacte `MONPIOLE_ENV=production` | Config environnement typée, fail-closed, flag d'activation explicite | Ne pas lever le NO-GO dans TASK-060 |
| PG-02 | PRODUCTION GATE | Aucun tenant réel activé ni revue de titres/descriptions/quartiers | Workflow d'opt-in et checklist éditoriale signée | Withdrawal reste nécessaire mais insuffisant |
| PG-03 | PRODUCTION GATE | Login/credential reader et rôle réel non provisionnés/attestés ; memberships, PUBLIC, search_path non contrôlés sur cible | Runbook + requêtes d'attestation + rotation + secret manager | TASK-060 ne doit pas créer de credential |
| PG-04 | PRODUCTION GATE | Préservation Host, TLS/SNI, accès direct origine et clé de cache ingress non testés | Test de déploiement avec proxy de confiance explicite | Aucun changement forwarded host dans TASK-060 |
| PG-05 | PRODUCTION GATE | Aucun rate limiting/anti-scraping/quotas | Limites par host/IP, réponses 429, tests de burst et bypass | Capability séparée |
| PG-06 | PRODUCTION GATE | Images base64 bufferisées, limite fonctionnelle/capacité/CDN/load non prouvées | Limite de taille, streaming/objet, cache/CDN et tests de charge | Capability séparée |
| PG-07 | PRODUCTION GATE | Monitoring, SLO, logs sûrs, alertes, runbook incident et retrait légal non prouvés | Observabilité et exercice incident | La géolocalisation accroît la sensibilité ; TASK-060 ne remplace pas ces preuves |
| PG-08 | PRODUCTION GATE | HA, backup/restore et migration/rollback opérationnel non validés | Revue production et exercice de restauration | Hors TASK-060 |
| PG-09 | PRODUCTION GATE | Fallback SPA direct-refresh et performance mobile non testés en cible | Smoke/E2E de l'artefact déployé | Hors TASK-060 |

## 17. Product Readiness Verdict

**READY WITH CONTAINED GAPS.**

Oui, MonPiole peut poursuivre son développement fonctionnel sur cette base.
Les frontières de tenant, données et architecture sont explicites, les défenses
PostgreSQL sont réelles et les validations sont vertes. Les gaps G-02 à G-09 ne
démontrent ni fuite cross-tenant, ni DRAFT publique, ni corruption durable.

Le verdict n'est pas `READY` absolu parce que le lifecycle ne possède aucun
retrait, que la conformité post-publication n'est pas entièrement définie et que
le contrat HTTP/cache et la preuve full-stack multi-host sont incomplets.

## 18. Internet Production Verdict

**NO-GO.**

Non, le catalogue ne peut pas être exposé sur Internet en production. La garde
production actuelle est un verrou utile, pas une preuve de readiness. Les gates
PG-01 à PG-09 doivent être traités avec preuves sur l'environnement réel. Le
passage de la suite de tests ne couvre ni ingress, ni secrets, ni anti-abus, ni
capacité, ni contenu réel, ni exploitation.

L'absence de rate limiting et d'observabilité n'est pas un blocker pour la
prochaine tranche métier ; elle reste en revanche bloquante pour Internet.

## 19. Property Geolocation Roadmap Reassessment

### 19.1 Constat vérifié

La plateforme possède une **adresse métier textuelle**, pas une géolocalisation
exploitable. `PropertyLocation` contient exactement `country`, `city`, `district`
et `addressLine`. L'API publique retire déjà `addressLine` et expose seulement
pays, ville et quartier, ce qui constitue une bonne réduction de données mais
ne permet ni carte, ni calcul de distance, ni requête spatiale. Aucun champ
latitude/longitude, système de référence, niveau de précision, source de
coordonnée, politique de visibilité ou port de géocodage n'existe.

Le terme « localisation » doit donc être séparé en trois concepts :

| Concept | Contenu | Audience | Règle |
| --- | --- | --- | --- |
| Adresse métier | pays, ville, quartier, adresse/repère saisi | privée ; pays/ville/quartier projetés publiquement aujourd'hui | Reste utile à la gestion et ne devient jamais implicitement une coordonnée |
| Position privée précise | point WGS84 latitude/longitude, précision et provenance | autorités privées tenant-scoped seulement | Source canonique pour les traitements internes ; jamais lisible par le reader public |
| Position publique | `EXACT`, `APPROXIMATE` ou `HIDDEN`, avec point public distinct si approximatif | catalogue public | Projection explicite, minimale et révocable ; défaut `HIDDEN` |

Une adresse textuelle et une coordonnée ne sont pas interchangeables : une
adresse peut être ambiguë ou décrire un repère commercial, tandis qu'un point
peut révéler une entrée, un logement occupé ou un site sensible. La cohérence
entre les deux ne peut être garantie qu'avec une validation humaine ou un
géocodeur, jamais par simple présence simultanée des champs.

### 19.2 Précision et confidentialité

Les trois comportements publics requis sont :

- `EXACT` : le point public est une copie transactionnelle du point privé ;
- `APPROXIMATE` : un centre public séparé et un rayon d'incertitude sont
  enregistrés ; le point privé doit se trouver dans ce rayon ;
- `HIDDEN` : aucune coordonnée publique n'est conservée ni retournée.

Le défaut est `HIDDEN`. Une classification privée `STANDARD | SENSITIVE` est
nécessaire ; `SENSITIVE` force `HIDDEN`. En l'absence actuelle de modèle
d'occupation, la plateforme ne peut pas détecter automatiquement un bien occupé :
le Web doit demander une confirmation explicite et recommander `HIDDEN` pour
tout bien occupé ou sensible. Un futur signal d'occupation devra réduire la
visibilité effective, jamais l'augmenter. La publication exacte doit demander
une confirmation dédiée et ne doit pas être déduite de la publication du bien.

Une baisse de précision (`EXACT → APPROXIMATE/HIDDEN`) est une opération de
confidentialité. Tant qu'aucune purge de cache fiable n'existe, une réponse
publique contenant des coordonnées doit utiliser `Cache-Control: no-store` ;
les TTL actuels de 60 secondes ne sont pas acceptables pour une donnée que le
tenant vient de masquer.

### 19.3 Compatibilité structurelle

| Rôle | Coordonnée canonique | Règle TASK-060 |
| --- | --- | --- |
| `STANDALONE` | propre point privé | configurable ; politique publique EXACT/APPROXIMATE/HIDDEN |
| `COMPOSITE` | point du site parent | configurable ; politique publique EXACT/APPROXIMATE/HIDDEN |
| `UNIT` | point effectif hérité de la `COMPOSITE` reliée via bâtiment | aucune copie du point ; politique `INHERIT_PARENT` ou réduction à `HIDDEN` |

La `UNIT` possède actuellement sa propre adresse textuelle lors de sa création,
mais sa relation `property_building_units → property_buildings → properties`
désigne un parent unique. TASK-060 ne doit pas dupliquer les coordonnées dans
l'unité : un changement du parent serait sinon susceptible de créer une dérive.
Une Unit hérite du point et du niveau public effectif du parent, peut se masquer
si elle est occupée/sensible, mais ne peut jamais augmenter la précision du
parent. Parent sans point, parent `HIDDEN` ou relation incohérente implique un
résultat fail-closed `HIDDEN`. Les coordonnées propres à un bâtiment ou à une
Unit de campus sont un besoin futur, pas une exception silencieuse.

### 19.4 Validation, géocodage et fournisseur

Le stockage canonique utilise WGS84/EPSG:4326 en degrés décimaux, sans identifiant
Google, Mapbox, Here, OpenStreetMap/Nominatim ou autre fournisseur. Latitude doit
être finie dans `[-90, 90]`, longitude finie dans `[-180, 180]`, les deux présentes
ensemble et limitées à six décimales. Cette précision de stockage (environ 11 cm
à l'équateur) ne prétend pas décrire la qualité de mesure : `accuracyMeters`
porte cette information séparément. Une position approximative publique est
limitée à quatre décimales, exige un rayon entre 100 et 5 000 mètres et doit
contenir le point privé selon la distance géodésique.

Le géocodage adresse → point et le reverse geocoding point → adresse sont utiles,
mais non requis pour la fondation. TASK-060 reste livrable par saisie manuelle :
aucun appel réseau, clé API, quota, licence ou disponibilité fournisseur. Une
future intégration passera par des ports applicatifs et conservera uniquement le
résultat canonique, la provenance et la précision ; les payloads et place IDs
fournisseur ne deviennent pas le modèle de domaine. Le reverse geocoding doit
proposer une adresse à confirmer, jamais écraser automatiquement l'adresse métier.

### 19.5 Impact catalogue et usages futurs

La liste publique ne reçoit pas de coordonnées dans TASK-060. Le détail peut
recevoir une `publicPosition` sanitizée ou `null`, sans adresse précise, point
privé, provenance, classification ni identifiant parent. Ce premier contrat
rend la politique observable sans préjuger de l'API de recherche spatiale.

| Usage futur | Fondation apportée | Travail encore requis |
| --- | --- | --- |
| Carte | point public et précision explicite | UI cartographique, clustering, provider de tuiles |
| Recherche par zone | coordonnées canoniques | bounding box/polygone et index spatial |
| Recherche par rayon | point WGS84 | calcul géodésique, PostGIS ou décision équivalente |
| Proximité | point et précision | référentiel de lieux, règles de distance |
| Quartiers / communes | adresse textuelle existante seulement partielle | identifiants administratifs canoniques et polygones |
| Tri par distance | point public | origine de recherche, index et pagination stable |

Les décimaux WGS84 permettent une migration ultérieure vers `geography(Point,
4326)` sans imposer PostGIS à la première tranche. En revanche, quartiers et
communes ne doivent pas être déduits durablement de chaînes libres : un futur
référentiel administratif reste nécessaire.

## 20. Next Capability Options

### 20.1 Comparaison décisive

| Critère | Property Unpublication / Catalog Withdrawal | Property Geolocation |
| --- | --- | --- |
| Valeur métier | Contrôle immédiat d'incident, fin de commercialisation et correction | Rend possibles carte, zone, rayon, proximité et expérience locale |
| Dépendances | Très faibles ; statut, grant, route et projection existent déjà | Adresse et composition existent ; aucun provider requis si saisie manuelle |
| Capacité fondationnelle | Ferme un lifecycle et sécurise l'exploitation | Socle transverse de découverte, recherche et classement futurs |
| Risque | Faible à moyen ; cache et transition d'état | Moyen à élevé ; vie privée, héritage et précision |
| Complexité | Faible à moyenne, tranche courte | Moyenne, maîtrisable avec carte/géocodage/recherche exclus |
| Cohérence DDD | Extension naturelle de l'agrégat Property | Nouveau value object/politique du même BC ; clarifie adresse, point et projection |
| Impact Web privé | Bouton, confirmation et statut | Formulaire de coordonnées, confidentialité et héritage Unit |
| Impact catalogue public | Retire liste/détail/photo | Ajoute uniquement une projection sanitizée au détail |
| Persistence / migration | État et traces de retrait sur `properties` | Table optionnelle, contraintes de coordonnées, héritage sans backfill |
| Sécurité / confidentialité | Réduit l'exposition ; risque principal de cache stale | Donnée sensible ; défaut caché, colonnes privées non grantées, `no-store` public |
| Tranche verticale indépendante | Excellente | Bonne si manuelle/provider-neutral, sans carte ni recherche |

Withdrawal gagne sur l'urgence opérationnelle, la simplicité et la réduction de
risque. Geolocation gagne nettement sur la capacité fondationnelle et la valeur
cumulée des prochaines capabilities. Comme l'exposition Internet reste de toute
façon **NO-GO**, TASK-060 doit fixer maintenant le modèle géographique avant que
carte et recherche ne cristallisent un contrat ad hoc. Withdrawal demeure la
capability suivante recommandée et un prérequis non négociable avant Internet.

### 20.2 Autres candidats

| Option | Décision après réévaluation |
| --- | --- |
| Archivage de Property | Après withdrawal ; effets rétention/ownership/composition à décider |
| Disponibilité / occupation | Après les primitives de confidentialité ; modèle temporel encore immature |
| Pricing avancé | Différé ; règles marché/devises/périodes plus larges |
| Médias supplémentaires | Différé ; ne fonde pas la découverte spatiale |
| Recherche publique enrichie | Après géolocalisation et référentiel administratif |
| Favoris | Différé ; identité/session/consentement |
| Leads/contact | Différé ; PII, anti-spam et notifications |
| Validation éditoriale / back-office | Après primitives de retrait et gouvernance |
| Observabilité, rate limiting, image/CDN | Gates techniques séparés, pas capability métier TASK-060 |

## 21. Selected Capability

### Property Geolocation

La capability sélectionnée change. Il ne s'agit pas encore de « mettre une
carte », mais de créer la vérité métier provider-neutral dont dépendront toutes
les fonctions spatiales. La tranche doit séparer l'adresse métier, le point
privé et la projection publique ; elle doit être utilisable sans service tiers
et ne publier aucune coordonnée par défaut.

Ce choix ne diminue pas G-01. **Property Catalog Withdrawal** conserve une
priorité opérationnelle HIGH, doit suivre immédiatement cette fondation et reste
obligatoire avant toute activation Internet. Il n'est simplement plus considéré
comme la prochaine capability par automatisme de séquence après publication.

## 22. TASK-060 Proposed Definition

# TASK-060 — Property Geolocation Web Vertical Slice

### 22.1 Objectif

Permettre à une autorité privée tenant-scoped de configurer une position WGS84
et sa confidentialité pour une Property, puis exposer au détail public seulement
la projection explicitement autorisée. La tranche doit fonctionner par saisie
manuelle, sans carte, géocodeur, reverse geocoder, PostGIS ni dépendance à un
fournisseur.

### 22.2 Périmètre fonctionnel

- value objects Domain pour point, précision et politique publique ;
- géolocalisation propre pour `STANDALONE` et `COMPOSITE` ;
- héritage du parent pour `UNIT`, avec possibilité de masquer l'unité ;
- endpoints privés de lecture, remplacement et suppression ;
- grants dédiés et autorité tenant-scoped existante ;
- stockage privé provider-neutral et projection publique séparée ;
- migration append-only `0012` sans backfill inventé ;
- RLS forcée et grants par colonnes/tables minimaux ;
- Web privé de configuration et visualisation de l'héritage ;
- détail du catalogue public enrichi d'une position sanitizée ;
- OpenAPI et tests Domain/Application/PostgreSQL/HTTP/Web/contrat ;
- politique de cache empêchant une ancienne position de survivre à un masquage.

### 22.3 Modèle de domaine et champs canoniques

`PropertyLocation` doit être traité comme **adresse métier** ; le JSON `location`
peut rester compatible, mais le code Domain devrait nommer explicitement ce
concept `PropertyBusinessAddress`. La géolocalisation est un objet distinct du
même Bounded Context Property Management.

| Champ Domain | Type / valeurs | Sens |
| --- | --- | --- |
| `propertyId`, `tenantId` | UUID v4 | identité et boundary tenant |
| `resolution` | `OWN | INHERITED` | coordonnée propre ou héritée du parent |
| `privatePoint` | `{ latitude, longitude }` nullable | vérité précise, privée ; requise seulement pour `OWN` |
| `accuracyMeters` | entier nullable | qualité estimée de la mesure, distincte des décimales |
| `captureSource` | `MANUAL | GEOCODED | IMPORTED` nullable | provenance canonique, jamais un nom/provider ID |
| `privacyClassification` | `STANDARD | SENSITIVE` | `SENSITIVE` force la position publique cachée |
| `publicMode` | `EXACT | APPROXIMATE | HIDDEN | INHERIT_PARENT` | politique demandée selon le rôle |
| `publicPoint` | point nullable | copie autorisée de l'exact ou centre public explicite |
| `publicRadiusMeters` | entier nullable | incertitude publique, seulement pour `APPROXIMATE` |
| `updatedAt`, `actorId`, `correlationId` | trace privée | audit de la dernière décision |

`privatePoint` est canonique. `publicPoint` est une projection déclassifiée et
transactionnelle : égal au privé pour `EXACT`, choisi séparément pour
`APPROXIMATE`, absent pour `HIDDEN`. Aucun payload brut, place ID, URL, style de
carte ou identifiant de fournisseur n'entre dans le modèle.

### 22.4 Validation et précision

1. Le système de référence est WGS84/EPSG:4326, en degrés décimaux.
2. Latitude et longitude sont toutes deux présentes ou toutes deux absentes.
3. Les valeurs non numériques, `NaN`, infinies ou chaînes permissives sont
   rejetées avant le Domain.
4. Latitude appartient à `[-90, 90]` et longitude à `[-180, 180]`.
5. La précision canonique maximale est six décimales ; l'API refuse l'excès au
   lieu d'arrondir silencieusement.
6. `accuracyMeters`, si présent, est un entier de 1 à 100 000.
7. `EXACT` exige un point privé et produit le même point public.
8. `APPROXIMATE` exige un centre public à quatre décimales maximum et un rayon
   entier de 100 à 5 000 mètres.
9. La distance géodésique entre point privé et centre approximatif doit être
   inférieure ou égale au rayon déclaré.
10. `HIDDEN` implique point et rayon publics nulls.
11. `SENSITIVE` implique mode effectif `HIDDEN` et effacement de la projection
    publique, même si le client envoie une autre préférence.
12. Une écriture identique est idempotente : aucune nouvelle horloge ni trace.

La base stocke latitude privée en `numeric(8,6)` et longitude privée en
`numeric(9,6)` ; les mêmes bornes valent pour la projection. Six décimales
décrivent le stockage, pas la précision terrain, qui reste portée séparément.

### 22.5 Politique de confidentialité

- toute Property existante ou nouvellement créée est implicitement `HIDDEN`
  tant qu'aucune configuration explicite n'existe ;
- la publication de la Property ne publie jamais automatiquement sa position ;
- `EXACT` exige une confirmation Web spécifique rappelant le risque d'identifier
  une entrée ou un occupant ; `APPROXIMATE` est l'option recommandée ;
- une adresse précise, un point privé, une provenance, une classification et
  une trace d'acteur ne sont jamais inclus dans un DTO public ;
- un bien occupé ou sensible doit être classé `SENSITIVE` et donc caché ; faute
  de modèle d'occupation actuel, cette décision est explicite et humaine ;
- lorsqu'un futur contexte d'occupation fournira un signal fiable, la règle
  effective sera `occupied OR sensitive => HIDDEN`, sans promotion automatique ;
- les coordonnées et bodies associés ne doivent pas être journalisés ; erreurs
  et Problem Details ne répètent jamais les valeurs reçues ;
- tout détail public contenant une position utilise `Cache-Control: no-store`
  jusqu'à l'existence d'une purge prouvée.

### 22.6 Règles `STANDALONE`, `COMPOSITE` et `UNIT`

1. `STANDALONE` et `COMPOSITE` utilisent `resolution = OWN`, possèdent un point
   privé et choisissent `EXACT`, `APPROXIMATE` ou `HIDDEN`.
2. `UNIT` utilise `resolution = INHERITED`, ne stocke jamais de point privé et
   désigne son parent effectif par la composition existante.
3. Une Unit choisit seulement `INHERIT_PARENT` ou `HIDDEN` ; elle ne peut pas
   passer un parent approximatif à exact ni fournir une coordonnée divergente.
4. En héritage, le point privé effectif vient de la `COMPOSITE`; la projection
   publique effective reprend celle du parent, sauf si Unit `SENSITIVE/HIDDEN`.
5. Parent non configuré, parent caché, parent non `COMPOSITE`, relation absente
   ou multiple : résultat public fail-closed, sans coordonnée.
6. Une modification du parent recalcule/supprime dans la même transaction les
   projections publiques de ses Units héritières.
7. L'adresse métier propre de la Unit reste inchangée et ne crée aucune
   dérogation géographique implicite.
8. Coordonnées par bâtiment ou override propre de Unit sont exclus de la tranche
   et nécessiteront un modèle explicite ultérieur.

### 22.7 API privée

Ajouter :

```text
GET    /v1/properties/{propertyId}/geolocation
PUT    /v1/properties/{propertyId}/geolocation
DELETE /v1/properties/{propertyId}/geolocation
```

Le GET retourne l'état canonique privé : résolution, point privé/effectif,
précision, provenance, classification, politique, position publique effective
et, pour une Unit, `inheritedFromPropertyId`. Aucun de ces champs n'est ajouté
par défaut aux listes privées.

Le PUT remplace atomiquement la configuration. Pour `STANDALONE/COMPOSITE`, le
body contient `privatePosition`, `accuracyMeters?`, `privacyClassification` et
une union stricte `publicPosition` : `{ mode: "HIDDEN" }`, `{ mode: "EXACT" }`
ou `{ mode: "APPROXIMATE", latitude, longitude, radiusMeters }`. Le serveur fixe
`captureSource = MANUAL`. Pour `UNIT`, le body n'accepte que classification et
`{ mode: "INHERIT_PARENT" | "HIDDEN" }`.

Le DELETE supprime le point propre et la projection, ou rétablit une Unit à
l'héritage caché par défaut ; il est idempotent et retourne 204. Contrats : 200
GET/PUT, 204 DELETE, 400 UUID/body/coordonnées invalides, 401, 403, 404
absent/cross-tenant, 409 rôle/composition incohérent, 500 sûr. Le tenant, la
provenance, l'acteur et les timestamps ne sont jamais acceptés du client.

### 22.8 Grants et autorité

- ajouter `RETRIEVE_PROPERTY_GEOLOCATION` et `MANAGE_PROPERTY_GEOLOCATION` à
  `PropertyGrant` et `AuthorityGrant` ;
- les mapper depuis `TENANT_ADMINISTRATOR`, jamais depuis un claim OIDC ;
- conserver `authorizedTenant()` et l'exigence d'exactement un tenant ;
- vérifier le grant avant tout accès repository ;
- garder absent et cross-tenant indistinguables en 404 ;
- aucun grant public : le catalogue passe uniquement par son reader technique
  et sa projection sanitizée.

### 22.9 Persistence et migration

Créer `0012_property_geolocation.sql` et son snapshot, sans modifier `0011` :

1. `property_management.property_geolocations`, clé `(tenant_id, property_id)`,
   FK tenant/property, résolution, point privé, accuracy, capture source,
   classification, public mode et traces privées ;
2. `property_management.property_public_positions`, clé
   `(tenant_id, property_id)`, contenant uniquement mode effectif, latitude,
   longitude et rayon publics plus `updated_at` ;
3. checks SQL de bornes, paires null/non-null, enums, rôle de chaque mode et
   cohérence EXACT/APPROXIMATE/HIDDEN ;
4. l'invariant géodésique « point privé dans le rayon » est validé dans le
   Domain/Application puis prouvé par tests repository ; aucun PostGIS requis ;
5. index privé tenant/property et index public tenant/property ; aucun index
   spatial prématuré ;
6. projection propre et projections des Units mises à jour atomiquement avec la
   configuration parent ; rollback total en cas d'échec ;
7. aucune ligne existante n'est géocodée ou approximée : absence de ligne vaut
   `HIDDEN` ;
8. migrations empty-to-head, upgrade `0011 → 0012`, contraintes, données
   historiques et replay idempotent testés.

La séparation physique garantit que le reader public ne peut pas sélectionner
le point privé, même pour une Property ayant choisi `EXACT`. Cette duplication
de l'exact dans la projection est volontaire et déclassifiée, pas une seconde
source canonique.

### 22.10 RLS et accès SQL

- activer et forcer RLS sur les deux tables ;
- policy privée tenant-scoped par `app.tenant_id` avec `USING` et `WITH CHECK` ;
- révoquer `PUBLIC` et ne donner aucun droit au reader sur
  `property_geolocations` ;
- sur `property_public_positions`, donner au reader seulement `SELECT` sur les
  colonnes publiques requises ;
- policy restrictive reader exigeant l'existence de la Property du même tenant
  avec `status = 'PUBLISHED'` ;
- le repository public joint seulement la projection publique et ne reçoit
  jamais un fallback vers la table privée ;
- tests SQL directs : tenant A/B, DRAFT/PUBLISHED, absence de row, HIDDEN,
  sensible, Unit héritée et révocation des colonnes privées.

### 22.11 Web privé

- ajouter une section « Géolocalisation et confidentialité » à la fiche ;
- pour `STANDALONE/COMPOSITE`, champs latitude/longitude, précision optionnelle,
  modes cachée/approximative/exacte et centre/rayon conditionnels ;
- afficher les erreurs de bornes, décimales et rayon avant envoi puis relayer les
  Problem Details sûrs en français ;
- confirmation dédiée pour `EXACT` et avertissement « bien occupé ou sensible » ;
- option de classification sensible qui force visuellement `HIDDEN` ;
- pour `UNIT`, vue read-only du point hérité, lien vers le parent et choix limité
  à hériter/masquer ;
- succès accessible, blocage double soumission, suppression idempotente ;
- aucune bibliothèque de carte ni requête vers un provider dans cette tranche.

### 22.12 Catalogue public et OpenAPI

La liste publique reste inchangée. `PublicPropertyDetail` ajoute :

```text
publicPosition:
  null
  | { mode: "EXACT", latitude, longitude }
  | { mode: "APPROXIMATE", latitude, longitude, radiusMeters }
```

`null` couvre non configuré, caché et sensible sans en révéler le motif. Les
coordonnées privées, `accuracyMeters`, `captureSource`, classification,
`inheritedFromPropertyId` et traces sont absentes. L'UI publique affiche une
formulation exacte/approximative/non communiquée ; aucune carte, adresse exacte
ou lien provider. Le détail portant une position est `no-store`; liste et photo
conservent leurs contrats actuels.

OpenAPI doit documenter les trois routes privées, Bearer, unions strictes,
bornes, exemples non réels, statuts/Problem Details, et le nouveau champ public
avec `security: []`. L'artefact généré et commité doit être identique ; les tests
vérifient qu'aucun schéma public ne référence les champs privés.

### 22.13 Géocodage, reverse geocoding et provider

TASK-060 n'installe aucun provider. Une future capability pourra définir
`GeocodeBusinessAddress` et `ReverseGeocodePoint` derrière des ports
applicatifs : timeout, quota, consentement, licence, cache et stratégie de
fallback resteront alors des décisions d'infrastructure. Le résultat accepté
sera converti en WGS84 canonique avec précision/provenance. Le reverse geocoding
ne modifiera l'adresse métier qu'après confirmation explicite. Le choix futur
du provider de tuiles pour une carte est indépendant de celui d'un géocodeur.

### 22.14 Tests obligatoires

- Domain : bornes, paires, décimales, accuracy, modes, sensible, rayon/Haversine,
  idempotence et rehydrate corrompu ;
- Application : grants, tenant unique, 404 cross-tenant, rôles et héritage ;
- composition : parent changé, Unit masquée, parent manquant et aucune promotion
  de précision ;
- PostgreSQL : checks, transactions, concurrence, projections, upgrade, grants,
  RLS forcée et accès direct reader ;
- HTTP privé : GET/PUT/DELETE, 200/204/400/401/403/404/409/500 et body strict ;
- HTTP public : exact/approximatif/null, DRAFT absent, A/B/host inconnu et
  `no-store` quand une coordonnée est présente ;
- Web privé : saisie, erreurs, confirmation exacte, sensible, Unit, suppression,
  double clic et accessibilité ;
- Web public : trois rendus, aucune adresse précise et aucune requête provider ;
- OpenAPI : unions, bornes, sécurité et absence de champs privés ;
- non-régression des migrations, architectures, typechecks, builds et 611 tests
  existants, avec PostgreSQL réel pour les invariants de sécurité.

### 22.15 Exclusions

- carte, tuiles, marqueurs, clustering ou sélection visuelle d'un point ;
- recherche par bounding box, zone, polygone ou rayon ;
- proximité, quartiers/communes canoniques et tri par distance ;
- PostGIS, index spatial ou moteur de recherche ;
- géocodage, reverse geocoding, clé API ou contrat fournisseur ;
- coordonnées propres par bâtiment ou override précis de Unit ;
- détection automatique d'occupation ;
- Property Catalog Withdrawal, archivage ou disponibilité ;
- activation Internet, rate limiting, observabilité, CDN ou purge globale ;
- migration automatique des adresses existantes ;
- implémentation de la capability dans TASK-059.

### 22.16 Conditions d'entrée et risques

Conditions : accepter WGS84, six décimales, défaut `HIDDEN`, modèle d'héritage
Unit, tables privée/publique séparées, saisie manuelle et `no-store` public.
Docker/Testcontainers doit être disponible et aucun changement concurrent ne
doit chevaucher composition, contrat Property ou migration `0012`.

Risques principaux : publication exacte involontaire, cache stale, fuite par
logs/Problem Details, incohérence projection/parent, approximation trop petite,
supposition erronée qu'une adresse géocodée est vraie, fan-out des Units et
scope creep vers une carte/provider. Les defaults cachés, la séparation SQL,
l'atomicité et les exclusions ci-dessus sont obligatoires, pas optionnels.

### 22.17 Critères DONE

TASK-060 est DONE seulement si :

1. les trois concepts adresse/point privé/position publique sont distincts ;
2. bornes, précision, accuracy et modes sont imposés Domain, API et SQL ;
3. toute donnée existante et toute absence de configuration reste cachée ;
4. `STANDALONE` et `COMPOSITE` gèrent un point propre ;
5. `UNIT` hérite sans point privé dupliqué et peut seulement réduire la visibilité ;
6. sensible force HIDDEN et efface toute projection publique ;
7. exact, approximatif et caché sont prouvés dans le détail public ;
8. le reader public n'a aucun droit sur la table/colonnes privées ;
9. les projections parent/Units sont atomiques et tenant-safe ;
10. un masquage n'est pas contredit par un cache de coordonnées (`no-store`) ;
11. Web privé et public couvrent rôles, modes, erreurs et accessibilité ;
12. OpenAPI généré décrit exactement les contrats sans champ privé ;
13. migration `0011 → 0012`, tests PostgreSQL réels et matrice A/B/unknown passent ;
14. typechecks, builds, architecture, suites ciblées et suite globale passent ;
15. aucun provider, carte, recherche spatiale, withdrawal, commit ou push n'est
    introduit par la tranche hors de son rapport final.

## 23. Deferred Capability Definition — Property Catalog Withdrawal

### Property Catalog Withdrawal Lifecycle & Web Vertical Slice (deferred)

### 23.1 Objectif

Permettre à une autorité privée tenant-scoped de retirer explicitement et
idempotemment une Property `PUBLISHED` du catalogue public, en conservant une
trace durable, sans détruire la Property ni exposer de nouvelle donnée publique.

### 23.2 Périmètre fonctionnel

- état Domain `WITHDRAWN` ;
- use case `WithdrawPropertyFromCatalog` ;
- grant interne dédié `WITHDRAW_PROPERTY_FROM_CATALOG` ;
- endpoint privé bodyless symétrique de la publication ;
- persistance et migration append-only suivante (attendue `0013`) ;
- disparition à l'origine des liste, détail et photo publics ;
- Web privé : statut, confirmation, feedback et refresh local ;
- Web public : 404 sûre sur lien stale, aucune distinction de motif ;
- OpenAPI, tests Domain/Application/PostgreSQL/HTTP/Web/contrat ;
- contrat explicite du délai de cache.

### 23.3 Invariants métier

1. Seule une Property `PUBLISHED` peut effectuer la première transition vers
   `WITHDRAWN`.
2. Une Property DRAFT ne peut pas être retirée du catalogue.
3. Un replay sur WITHDRAWN retourne l'état canonique sans lire l'horloge, sans
   changer acteur/corrélation/date et sans nouvelle écriture.
4. Le tenant provient uniquement de l'autorité interne et doit être unique.
5. Le grant exact `WITHDRAW_PROPERTY_FROM_CATALOG` est requis avant l'accès au
   repository.
6. Manquant et cross-tenant partagent la même 404 privée.
7. La transition conserve `publishedAt`, `publishedByActorId` et la corrélation
   de publication.
8. Elle enregistre `withdrawnAt`, `withdrawnByActorId` et
   `withdrawalCorrelationId`.
9. Une ligne WITHDRAWN n'est jamais visible au reader public, y compris sa photo.
10. Aucun owner, motif interne ou trace de retrait n'entre dans un DTO public.
11. L'opération ne supprime ni photo, owner, composition ou historique.
12. La visibilité origin est retirée après commit ; la staleness cache maximale
    reste explicitement bornée par les headers publiés.

### 23.4 API privée

Ajouter :

```text
DELETE /v1/properties/{propertyId}/publication
```

Contrat proposé :

- body interdit ;
- Bearer + autorité interne ;
- 200 avec `PropertyResponse` canonique `WITHDRAWN` pour première transition et
  replay ;
- 400 UUID/body invalide ;
- 401 non authentifié ;
- 403 grant/tenant invalide ;
- 404 absent/cross-tenant ;
- 409 si la Property est DRAFT (`PROPERTY_NOT_PUBLISHED`) ;
- 500 sûr ;
- Problem Details et headers de trace cohérents avec les routes privées.

Le `DELETE` vise la ressource publication et reste idempotent. Aucun
`tenantId`, status, acteur, date ou raison libre n'est accepté du client.

### 23.5 Grants et autorité

- ajouter `WITHDRAW_PROPERTY_FROM_CATALOG` à `PropertyGrant` et à
  `AuthorityGrant` ;
- mapper ce grant depuis le rôle interne `TENANT_ADMINISTRATOR`, jamais depuis
  un scope/claim OIDC ;
- conserver `authorizedTenant()` et exactement un tenant ;
- tests sans grant, plusieurs tenants, autre tenant et autorité inconnue.

### 23.6 Domain et Application

- étendre `PROPERTY_STATUSES` avec `WITHDRAWN` ;
- ajouter les champs de retrait au modèle réhydraté et à la vue privée ;
- ajouter `Property.withdraw(withdrawnAt)` ou une valeur de trace dédiée ;
- ajouter `WithdrawPropertyFromCatalog` sur `PropertyRepository.updateAtomically` ;
- conserver le verrou `SELECT ... FOR UPDATE` ;
- retourner un outcome interne `WITHDRAWN | ALREADY_WITHDRAWN` pour les tests,
  même si la réponse HTTP reste la Property canonique ;
- mapper explicitement le conflit DRAFT en 409.

### 23.7 Persistence et migration

Créer la migration suivante, attendue
`0013_property_catalog_withdrawal.sql`, et son snapshot :

- étendre la contrainte de statut à `DRAFT | PUBLISHED | WITHDRAWN` ;
- ajouter `withdrawn_at timestamptz`, `withdrawn_by_actor_id text` et
  `withdrawal_correlation_id uuid` ;
- contrainte d'état :
  - DRAFT : publication/retrait null ;
  - PUBLISHED : publication complète, retrait null ;
  - WITHDRAWN : publication complète et retrait complet ;
- conserver l'index public partiel limité à `status = 'PUBLISHED'` ;
- ne modifier aucune ligne existante ;
- aucun grant reader sur les nouvelles colonnes ;
- runtime privé autorisé à écrire les colonnes via sa boundary existante ;
- upgrade depuis la migration géolocalisation, empty-to-head et données
  historiques testés ;
- aucun down migration ni réécriture d'une migration appliquée.

La contrainte doit empêcher un retour SQL direct vers DRAFT ou une ligne
WITHDRAWN sans traces. La mise à jour doit préserver les traces de première
publication.

### 23.8 RLS et catalogue public

Les policies restrictives actuelles `status = 'PUBLISHED'` doivent cacher
WITHDRAWN sans élargissement de grant. Tests obligatoires :

- A publié visible avant retrait puis absent en liste/détail/photo après commit ;
- A draft toujours absent ;
- B publié inchangé sur Host B ;
- Host A ne voit jamais B ;
- Host B ne voit jamais A ;
- host inconnu 404 avant DB ;
- requête directe reader avec tenant A ne voit pas WITHDRAWN ;
- aucune colonne de retrait accessible au reader ;
- private runtime peut encore relire WITHDRAWN.

Ajouter un test full-stack à deux hosts couvrant la matrice TASK-059, avant et
après la transition.

### 23.9 Cache et cohérence

La future tranche withdrawal doit fixer le contrat suivant :

- l'origine ne liste plus le bien et retourne 404 détail/photo après commit ;
- une réponse déjà fraîche peut rester servie au maximum 60 secondes pour
  liste/détail et 300 secondes pour la photo avec les headers actuels ;
- la page publique sait déjà transformer un détail stale en 404 sûre ;
- OpenAPI documente `Cache-Control`, `Vary`, `If-None-Match`, `ETag`,
  `Content-Length`, `Content-Type` et `nosniff` ;
- son rapport rappelle qu'une purge CDN/incident reste un gate Internet.

Si le Product Owner exige un retrait public en moins de cinq minutes, les TTL
doivent être réduits ou une revalidation/purge doit entrer explicitement dans le
périmètre avant implémentation.

### 23.10 Web privé

- afficher « Retirer du catalogue » seulement pour PUBLISHED ;
- confirmation claire sur l'effet public et le délai de cache borné ;
- bloquer la double soumission ;
- succès accessible « Le bien a été retiré du catalogue » ;
- afficher statut français « Retiré du catalogue » et date de retrait ;
- ajouter WITHDRAWN aux filtres du portfolio privé ;
- erreurs 401/403/404/409/réseau en français ;
- aucun bouton de republication ;
- ne jamais afficher acteur/corrélation dans le Web.

### 23.11 Web public

- aucun nouveau CTA privé ;
- une carte stale ouvrant un bien retiré arrive sur « Bien introuvable » ;
- une photo stale qui reçoit 404 utilise un placeholder accessible ;
- remplacer la copie « Biens disponibles » par une formulation ne promettant
  pas l'occupation/disponibilité ;
- routes toujours hors `AuthenticationBoundary`.

### 23.12 OpenAPI

- étendre `PropertyResponse` avec le variant WITHDRAWN et les seuls champs
  privés de retrait nécessaires ;
- documenter le DELETE, Bearer, absence de body, statuts et Problem Details ;
- conserver `security: []` sur le public ;
- corriger les headers publics incomplets relevés en G-04 ;
- vérifier l'artefact commité contre le document généré.

### 23.13 Tests obligatoires

- Domain : première transition, DRAFT refusé, replay sans horloge, rehydrate ;
- Application : grant, tenant unique, absent/cross-tenant, outcome ;
- PostgreSQL : contraintes, lock/concurrence, replay sans update, upgrade,
  grants, RLS et matrice complète ;
- concurrence : retrait/retrait et retrait/mise à jour sérialisés ;
- HTTP privé : 200/400/401/403/404/409/500, body interdit ;
- HTTP public : liste/détail/photo avant/après, cache et 404 ;
- OpenAPI : variant, route, headers, sécurité ;
- Web privé : confirmation, double clic, succès, erreurs, statut et filtre ;
- Web public : lien stale, photo 404/placeholder, routes sans Bearer ;
- non-régression des routes privées et des 611 tests existants.

### 23.14 Conditions d'entrée

1. acceptation de `WITHDRAWN` comme état terminal de la tranche ;
2. acceptation du `DELETE /publication` bodyless ;
3. acceptation du SLA de cache actuel ou décision explicite de le réduire ;
4. Docker/Testcontainers disponible ;
5. aucune activation de tenant Internet ;
6. aucun changement concurrent chevauchant statut/contrat/migration Property.

### 23.15 Risques

- oubli d'un variant WITHDRAWN dans un mapper/schema Web ou API ;
- contrainte SQL cassant une publication historique ;
- cache donnant une impression de retrait non immédiat ;
- confusion entre withdrawal, archive et disponibilité ;
- tentative d'inclure republication, purge CDN ou workflow éditorial dans la
  même tâche ;
- changement de policy qui élargirait accidentellement le reader.

### 23.16 Critères DONE

La future capability withdrawal est DONE seulement si :

1. PUBLISHED devient WITHDRAWN avec grant et tenant exacts ;
2. DRAFT ne peut pas être retiré ;
3. replay sans horloge ni écriture est prouvé ;
4. traces de publication sont conservées et traces de retrait durables ;
5. liste/détail/photo publics cachent WITHDRAWN à l'origine ;
6. reader ne lit ni colonnes de retrait ni tables privées ;
7. matrice deux hosts/tenants/unknown passe sur PostgreSQL réel ;
8. Web privé et public couvrent tous les états requis ;
9. OpenAPI décrit route, variant et headers de cache/revalidation ;
10. upgrade, migrations, typechecks, builds, architecture et suites ciblées
    passent ;
11. suite globale passe sans skip ;
12. NO-GO Internet reste explicite ;
13. aucun commit/push automatique ;
14. rapport final cite les résultats exacts et le diff.

## 24. Deferred Withdrawal Non-Goals

La future capability withdrawal ne doit pas inclure :

- republication/réactivation d'une Property WITHDRAWN ;
- retour implicite vers DRAFT ;
- archivage, suppression ou restauration ;
- disponibilité, occupation, bail ou réservation ;
- pricing avancé ;
- galerie publique complète ou optimisation image ;
- recherche enrichie, favoris, leads ou contact ;
- validation éditoriale ou back-office catalogue ;
- activation d'un tenant réel ;
- rate limiting, observabilité, CDN, purge distribuée ou test de charge ;
- événement/outbox ou nouveau Bounded Context ;
- correction générale du bundle ;
- correction automatique de tous les biens rendus non conformes par un nouveau
  standard photo.

## 25. Final Recommendation

Accepter TASK-058 comme **READY WITH CONTAINED GAPS** pour la poursuite produit,
maintenir **NO-GO Internet production**, puis lancer :

**TASK-060 — Property Geolocation Web Vertical Slice**.

La priorité fonctionnelle devient la création d'une vérité géographique
provider-neutral, privacy-first et compatible composition avant carte ou
recherche spatiale. La tranche withdrawal détaillée ci-dessus doit suivre sans
être absorbée dans TASK-060 et demeure obligatoire avant Internet. En parallèle,
dans des tâches séparées, préparer les gates production : config fail-closed,
attestation du reader, ingress Host, revue éditoriale, rate limit, capacité image,
observabilité et incident response.

Message de commit proposé pour TASK-059, non exécuté :

```text
docs(property): reassess catalog roadmap with geolocation
```
