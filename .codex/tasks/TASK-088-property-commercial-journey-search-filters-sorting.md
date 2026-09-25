# TASK-088 — Property Commercial Journey Search, Filters & Sorting

## Statut

DONE

## Contexte et objectif

TASK-087 a créé l’espace authentifié global `/demandes`, destiné à repérer les parcours commerciaux d’un tenant et à ouvrir leur section détaillée dans le Property Workspace.

TASK-088 rend cette collection exploitable à volume croissant avec une recherche rapide, des filtres canoniques, un tri déterministe, un compteur exact et un état URL partageable. Les mutations métier restent exclusivement dans le Property Workspace.

## Décision UX

- Les critères sont saisis dans une barre de filtres puis appliqués ensemble avec `Filtrer`.
- La saisie ne provoque donc aucun appel réseau avant validation.
- `Réinitialiser les filtres` efface la saisie, les critères appliqués et le curseur.
- Les critères appliqués sont encodés dans la query string de `/demandes`.
- La page distingue l’absence totale de demandes de l’absence de résultat filtré.
- Les contrôles passent de cinq colonnes à deux colonnes, puis une colonne sur mobile.

## Recherche

Le paramètre optionnel `q` est limité à 200 caractères, normalisé par trim et recherché sans distinction de casse avec PostgreSQL `ILIKE`.

Champs recherchés :

- nom du prospect (`PropertyInquiry.contactName`) ;
- téléphone (`PropertyInquiry.phoneNumber`) ;
- email (`PropertyInquiry.email`) ;
- titre du bien (`Property.title`).

Les caractères `%`, `_` et `\` sont échappés avant construction du motif. Les UUID techniques ne font pas partie de la recherche.

## Filtres

- `propertyId` limite les demandes au bien tenant-scoped correspondant.
- `stage` utilise exclusivement `PropertyCommercialStage`, dérivé des états Inquiry, Viewing, Outcome, Application, Client et Contract.
- `nextAction` utilise exclusivement `PropertyCommercialNextAction`, dérivé de la même chaîne canonique.
- Aucun statut ou prochaine action n’est persisté pour TASK-088.
- Un identifiant de bien appartenant à un autre tenant ne peut produire aucun résultat grâce au prédicat tenant et à RLS.

## Tri et pagination

- `RECENT` est le tri par défaut : `created_at DESC, inquiry_id DESC`.
- `OLDEST` utilise `created_at ASC, inquiry_id ASC`.
- Le curseur opaque conserve la paire `relevantAt/inquiryId`.
- La comparaison du curseur suit le sens du tri.
- Tout changement de critères par l’interface repart sans curseur.
- Les pages suivantes sont dédupliquées par `inquiryId` et une erreur conserve les éléments déjà chargés.

## Comptage et facette Bien

`totalCount` est le nombre exact de parcours correspondant aux critères, sans frontière de curseur. Il est calculé dans la même transaction tenant-scoped avec les mêmes jointures et prédicats que la collection.

La réponse contient aussi `properties`, liste ordonnée des biens accessibles au tenant. Cette facette évite un N+1 et évite de tronquer le sélecteur à une page arbitraire du portefeuille.

Le coût d’un `COUNT(*)` relationnel supplémentaire est accepté pour cette collection opérationnelle V1. Aucun index spéculatif n’est ajouté ; la volumétrie et les plans réels devront guider une optimisation future.

## Contrat HTTP

`GET /v1/property-commercial-journeys`

Paramètres optionnels :

- `q` ;
- `propertyId` ;
- `stage` ;
- `nextAction` ;
- `sort` (`RECENT`, `OLDEST`) ;
- `limit` ;
- `cursor`.

Réponse :

- `items` ;
- `totalCount` ;
- `properties` ;
- `pageInfo.hasNextPage` ;
- `pageInfo.nextCursor`.

Les valeurs d’enum ou UUID invalides produisent un Problem Details HTTP 400 via Zod.

## État URL

Exemple :

`/demandes?q=traore&propertyId=<uuid>&stage=SUBMITTED_APPLICATION&nextAction=DECIDE_APPLICATION&sort=OLDEST`

Le tri `RECENT` et les critères vides sont omis de l’URL. Aucun `tenantId` n’est accepté ou exposé.

## PostgreSQL et sécurité

- La requête existante est étendue ; aucun second read model n’est créé.
- Les jointures aval restent des `LEFT JOIN` afin de conserver les parcours incomplets.
- Les expressions SQL `CASE` de stage et prochaine action servent à la projection et aux filtres.
- L’ordre ajoute toujours `inquiry_id` comme départage déterministe.
- La transaction positionne `app.tenant_id` et les politiques RLS restent actives.
- Le grant applicatif demeure `LIST_PROPERTY_INQUIRIES`.
- Aucun `tenantId` client n’est utilisé.
- Aucune migration n’est nécessaire.

## Validation

- recherche insensible à la casse sur candidat et bien ;
- filtres combinés bien/stage/prochaine action ;
- résultat filtré vide ;
- tri récent et ancien ;
- pagination curseur dans les deux sens ;
- isolation inter-tenant et RLS ;
- validation HTTP des enums, UUID et curseurs ;
- état URL, compteur, reset et destinations `Ouvrir` Web ;
- OpenAPI régénéré et vérifié.

Résultats finaux :

- tests ciblés HTTP/Web : 9 tests réussis sur 9 ;
- test OpenAPI ciblé : 1 test réussi sur 1 ;
- suite d’intégration API : 225 tests réussis sur 225, 30 fichiers ;
- suite PostgreSQL Property Management : 96 tests réussis sur 96, 5 fichiers ;
- suite Web : 165 tests réussis sur 165, 29 fichiers ;
- contrats : 106 tests réussis sur 106, 24 fichiers ;
- typecheck global : 9 projets réussis ;
- typecheck des tests : réussi ;
- build Web : réussi, 175 modules transformés ;
- architecture : réussie ;
- `git diff --check` : réussi.

## Capacités différées

- tris alphabétiques ;
- filtres enregistrés ;
- attribution de files de traitement ;
- moteur de recherche plein texte ;
- analytique commerciale ;
- notifications et relances automatiques.

## Suite recommandée

TASK-089 — Post-Commercial-Journey Search Product Readiness Audit & Next Commercial Capability Definition
