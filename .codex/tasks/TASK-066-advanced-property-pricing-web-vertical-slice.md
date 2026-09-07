# TASK-066 — Advanced Property Pricing Web Vertical Slice

## 1. Verdict

**DONE** — la tarification avancée est livrée du domaine au catalogue public,
avec compatibilité explicite des lignes legacy, écritures et publications
strictes, migration PostgreSQL réelle, RLS/grants, contrat OpenAPI, écran Web
privé et tests de régression.

## 2. Reprise et état initial audité

- Branche : `main`.
- HEAD : `92512e489a0a4111ea6b35c865a7fb9ef490c83c`
  (`feat(web): establish ui ux foundation`).
- Upstream : `origin/main`, branche locale en avance de 49 commits.
- Le working tree contenait un travail TASK-066 partiel et un fichier de
  sauvegarde non suivi `TASK-066-partial-backup.patch`.
- `git status`, `git diff`, les fichiers modifiés et la sauvegarde ont été lus
  avant toute correction. Aucun reset, clean, stash, checkout destructif,
  commit ou push n'a été effectué.

### État initial par lot

| Lot | État à la reprise | Constat |
| --- | --- | --- |
| Domaine/application | PARTIAL | variantes enrichies, validation legacy/stricte, grant et use case commencés |
| Migration 0015 | PARTIAL/BLOCKED | SQL non validé ; backfill `UPDATE` incompatible avec les triggers différés |
| Repository/schema | PARTIAL | colonnes/version commencées ; caractéristiques couplées par erreur au prix à la réhydratation |
| RLS/grants | PARTIAL | intentions présentes mais sans preuve PostgreSQL |
| API/Zod/OpenAPI | MISSING | aucune route dédiée ni contrat généré |
| Web privé | MISSING | aucun formulaire de tarification dédié |
| Catalogue public | PARTIAL | modèle application amorcé, transport et rendu incomplets |
| Tests | MISSING/PARTIAL | aucune couverture verticale TASK-066 dédiée |
| Documentation | MISSING | aucun rapport TASK-066 |

## 3. Politique de compatibilité retenue

La frontière est la version de tarification persistée :

- v1 représente les lignes créées avant 0015 ; elle accepte une devise ISO 4217
  syntaxique différente de XOF et un prix principal nul ;
- v1 n'accepte pas les nouveaux champs avancés, afin de ne pas faire passer une
  nouvelle donnée pour un historique ;
- v2 représente toute nouvelle tarification ou modification financière ; elle
  impose XOF, un prix principal strictement positif, des montants facultatifs
  positifs ou nuls et une durée minimale entière d'au moins une nuit ;
- toute transition vers `PUBLISHED` force v2 au niveau PostgreSQL ; le domaine
  réapplique en plus la validation stricte avant publication ;
- une publication legacy déjà existante reste lisible, modifiable sur des champs
  non financiers et retirable sans conversion forcée ;
- une mise à jour de caractéristiques seule conserve la tarification courante.

Cette politique est cohérente sur les cinq frontières : domaine, publication,
repository, CHECK/trigger PostgreSQL et schémas de réponse legacy-readable.

## 4. Domaine et application

- `CommercialTerms` porte désormais :
  - location longue : `agencyFeeAmountMinor` ;
  - location courte : `cleaningFeeAmountMinor`,
    `securityDepositAmountMinor`, `minimumStayNights` ;
  - vente : `agencyFeeAmountMinor`.
- `validateCommercialTerms` est la validation stricte de toute nouvelle écriture.
- `validatePersistedCommercialTerms(..., allowLegacyPricing)` est réservé à la
  réhydratation des lignes v1.
- `Property.setPricing` remplace une variante complète.
- `Property.publish` refuse une tarification legacy non conforme.
- `UpdatePropertyDetails` accepte encore un payload commercial strict optionnel
  pour compatibilité, mais les caractéristiques seules sont autonomes.
- `SetPropertyPricing` possède son propre command handler, son grant
  `UPDATE_PROPERTY_PRICING`, le verrou repository tenant-scoped et un replay
  sans horloge ni écriture.

## 5. Migration finale 0015

`0015_property_advanced_pricing.sql` :

- ajoute `agency_fee_amount_minor`, `cleaning_fee_amount_minor`,
  `minimum_stay_nights` et `pricing_version` ;
- initialise les lignes préexistantes avec un `DEFAULT 1` temporaire puis retire
  immédiatement ce défaut, sans `UPDATE` de backfill ;
- remplace `properties_commercial_terms_check` par une contrainte v1/v2 et par
  variante, bornée à `Number.MAX_SAFE_INTEGER` ;
- ajoute `mark_property_pricing_version` et son trigger `BEFORE INSERT OR UPDATE` ;
- conserve la chaîne append-only, le journal et le snapshot Drizzle ;
- ne modifie ni ne désactive la RLS ou les policies tenant/public existantes.

Le backfill DML commencé avant l'interruption a été retiré parce qu'il créait des
événements de constraint triggers différés et faisait échouer un `ALTER TABLE`
suivant avec PostgreSQL `55006`. Le marquage par défaut de colonne produit le
même résultat legacy sans événement DML.

## 6. PostgreSQL, RLS et privilèges

- `properties` conserve `ENABLE ROW LEVEL SECURITY` et
  `FORCE ROW LEVEL SECURITY`.
- `monpiole_runtime` : `SELECT`, `INSERT`, `UPDATE` sur les quatre nouvelles
  colonnes, dont `pricing_version`.
- `monpiole_public_catalog_reader` : `SELECT` sur
  `agency_fee_amount_minor`, `cleaning_fee_amount_minor` et
  `minimum_stay_nights`.
- Le lecteur public n'a aucun `SELECT` sur `pricing_version` et aucun droit
  d'écriture ajouté.
- Les tests réels vérifient l'isolation tenant, les contraintes v2, les privilèges
  par colonne et la lecture publique d'une publication legacy.

## 7. API, Zod et OpenAPI

Route ajoutée :

- `PUT /v1/properties/{propertyId}/pricing` — authentifiée, grant
  `UPDATE_PROPERTY_PRICING`, corps strict discriminé, réponses
  `200/400/401/403/404/500`.

Routes existantes enrichies ou conservées :

- `PUT /v1/properties/{propertyId}/details` accepte les caractéristiques seules
  et garde un payload de prix strict optionnel de compatibilité ;
- `GET /v1/properties/{propertyId}` renvoie les champs avancés et reste capable
  de sérialiser une tarification legacy ;
- `GET /v1/public/properties` et
  `GET /v1/public/properties/{publicPropertyId}` exposent les champs financiers
  avancés autorisés.

`PropertyPricing` et `SetPropertyPricingRequest` sont publiés dans
`engineering/contracts/http/openapi.json`. Les écritures n'acceptent que XOF et
des prix principaux positifs ; les réponses restent compatibles avec les
anciennes devises et valeurs nulles de prix principal.

## 8. Web privé

- La fiche Property sépare maintenant « Caractéristiques du bien » et
  « Tarification du bien ».
- Le formulaire choisit les champs selon le type de transaction.
- XOF/FCFA est non modifiable ; le prix principal est obligatoire et positif.
- Les montants facultatifs, la durée minimale et les bornes d'entiers sont
  validés avant l'appel.
- Une tarification legacy est affichée comme historique et n'est jamais convertie
  silencieusement : l'utilisateur doit saisir puis enregistrer une valeur v2.
- L'API Web utilise la route dédiée et remplace le snapshot affiché par la
  réponse serveur.

## 9. Catalogue public

Les projections application, PostgreSQL, Zod et React exposent les frais
d'agence, frais de ménage, dépôt courte durée et durée minimale lorsqu'ils sont
présents. Le détail public affiche une section « Conditions financières » avec
formatage de la devise historique ou XOF. Ni `pricing_version`, ni adresse
exacte, ni traces d'autorité, ni données de disponibilité ne sont exposées.

## 10. Tests ajoutés ou complétés

- unitaires domaine/use case : trois variantes, bornes, XOF, incompatibilité,
  legacy, publication stricte, autorisation et replay ;
- intégration HTTP : succès, replay, validation Zod, variante incompatible,
  authentification, grant, tenant et compatibilité du endpoint details ;
- contrats : route, statuts, sécurité, schémas discriminés, champs avancés,
  lecture legacy et écriture stricte ;
- Web : champs conditionnels, conversion FCFA, validation et avertissement
  legacy ;
- PostgreSQL : upgrade 0014→0015, publication legacy, v2, replay,
  caractéristique indépendante, disponibilité après pricing, CHECK, RLS et
  privilèges ;
- catalogue public : projection et rendu des nouveaux champs.

## 11. Résultats exacts

| Validation | Résultat |
| --- | --- |
| Unit (`pnpm test:unit`) | PASS — 28 fichiers, 216 tests |
| Web (`pnpm --filter @monpiole/web test`) | PASS — 19 fichiers, 134 tests |
| Contract/API (`pnpm app:api:contracts:check`) | PASS — 17 fichiers, 96 tests |
| Integration (`pnpm test:integration`) | PASS — 21 fichiers, 192 tests |
| PostgreSQL Property/Testcontainers | PASS — 4 fichiers, 84 tests |
| Typecheck récursif | PASS — 9 projets |
| Typecheck tests | PASS |
| Migration check | PASS — `Everything's fine` |
| Build API et dépendances | PASS — 6 projets |
| Génération OpenAPI | PASS |
| Build Web | PASS — 123 modules transformés |
| Architecture check | PASS |
| `git diff --check` | PASS |

PostgreSQL a été exécuté dans un conteneur réel basé sur l'image épinglée
`postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687`.

## 12. Limitations et exclusions

- Pas de calendrier de disponibilité par nuit, promotion, réservation, paiement,
  fiscalité, commission calculée ou conversion de devises.
- Pas de migration automatique des montants legacy vers XOF : la conversion
  nécessite une décision utilisateur explicite.
- `minimumStayNights` décrit une règle commerciale ; il ne remplace pas la
  disponibilité/occupation TASK-064.
- La version de tarification est un détail de persistence et n'est volontairement
  pas exposée par l'API.

## 13. Fichiers et artefacts

Les changements couvrent le domaine/application Property, l'adapter PostgreSQL,
la migration et son snapshot, la composition et les contrats API, l'OpenAPI,
les modèles/formulaires/pages Web privés, le catalogue public, les tests unitaires,
intégration, contrat, Web et PostgreSQL, ce rapport et le README du service.
Le fichier de sauvegarde partielle trouvé à la reprise est conservé tel quel.

## 14. Confirmation Git

Aucun commit et aucun push n'ont été effectués pour TASK-066. Les changements
restent dans le working tree pour revue.
