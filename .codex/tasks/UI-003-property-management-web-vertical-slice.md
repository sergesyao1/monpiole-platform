# UI-003 — Property Management Web Vertical Slice

- Status: **DONE**
- Date: 2026-08-27

## Contexte et audit initial

UI-001 fournit React, Vite, React Router et le shell. UI-002/UI-002A fournissent
la session Auth0 restaurable et le client HTTP centralisé qui obtient le token,
ajoute le bearer, renouvelle une fois après 401 et distingue 403. Le dépôt était
propre au démarrage sur `48fa702`.

L’audit des contrôleurs, schémas Zod, DTO, use cases, contrats OpenAPI et tests
de TASK-034, TASK-035 et TASK-038 a confirmé les capacités HTTP ci-dessous. Il
n’existe ni `GET /v1/properties`, ni port applicatif de listing Property. Les
owners sont consultables individuellement et leurs relations avec un bien sont
exposées, mais aucune liste globale des owners n’existe.

## Objectif

Fournir un premier parcours métier Web réel et français permettant à un
utilisateur authentifié et autorisé de créer, consulter et enrichir un bien,
puis de gérer ses affectations de propriétaires via l’API MonPiole existante.

## Périmètre

- routes protégées `/properties`, `/properties/new` et
  `/properties/:propertyId` ;
- création conforme au schéma Property ;
- consultation par identifiant ;
- détails physiques et conditions LONG_TERM_RENTAL, SHORT_TERM_RENTAL ou SALE ;
- consultation des relations d’ownership et résolution des owners ;
- affectation/retrait d’un owner existant par UUID ;
- états de chargement, succès, 400, 401, 403, 404 et 5xx en français ;
- mappings de présentation centralisés et interface responsive/accessibilité
  de base ;
- tests de comportement du parcours et de l’intégration HTTP bearer.

## Hors périmètre

Listing de biens ou d’owners, création d’owner, publication, marketplace,
recherche publique, médias, bâtiments/unités, cartographie, réservation,
paiement, notification, administration et design system général.

## Contrats API réellement utilisés

- `POST /v1/properties` ;
- `GET /v1/properties/{propertyId}` ;
- `PUT /v1/properties/{propertyId}/details` ;
- `GET /v1/properties/{propertyId}/owners` ;
- `POST /v1/properties/{propertyId}/owners` ;
- `DELETE /v1/properties/{propertyId}/owners/{ownerId}` ;
- `GET /v1/property-owners/{ownerId}`.

La création envoie titre, description optionnelle, type, transaction et adresse.
La mise à jour respecte l’union discriminée des conditions commerciales et les
unités mineures monétaires attendues par le backend.

## Architecture frontend et décisions

`src/features/properties` isole les modèles de transport, le client API, la
traduction sûre des erreurs, les mappings français et les composants/pages. Les
pages acquièrent uniquement le provider de token de la session existante ; elles
ne construisent ni tenant ID, ni permission issue des scopes OIDC. L’API demeure
l’autorité de validation, d’autorisation et d’isolation tenant.

L’absence de listing n’a pas justifié une extension backend : créer lecture,
port, adaptation PostgreSQL, pagination et contrat aurait élargi UI-003. La page
d’entrée expose honnêtement cette limite et permet les deux parcours disponibles :
création et ouverture par UUID. De même, aucun faux sélecteur d’owner n’est créé.

## Fichiers principaux

Créés : modèles/client/erreurs Property, pages workspace/création/fiche,
formulaire de détails, section ownership, feedback accessible et tests sous
`apps/web/src/features/properties/`, plus cette fiche.

Modifiés : routes, navigation, styles, tests du shell et README Web. Supprimés :
aucun.

## Stratégie de tests

Les tests jsdom conduisent le parcours avec Testing Library et remplacent
uniquement `fetch` à la frontière. Ils vérifient mappings, variantes
commerciales, type de bien, payloads, bearer, création, lecture, mise à jour,
ownership et messages sûrs 400/401/403/404/5xx. Les suites repository assurent
les non-régressions backend, contrats et architecture.

## Critères d’acceptation

- [x] parcours protégé et authentification existante réutilisée ;
- [x] création, consultation et mise à jour sur les vraies routes ;
- [x] aucune autorité tenant ou grant OIDC fabriqué côté navigateur ;
- [x] trois variantes commerciales prises en charge ;
- [x] ownership HTTP intégré sans faux listing ;
- [x] absence du listing Property explicitement contenue ;
- [x] contenus utilisateur en français et erreurs sûres ;
- [x] tests et validations finales réussis.

## Validations exécutées

- typecheck Web : PASS ;
- tests Web : PASS ;
- build Web : PASS ;
- tests unitaires repository : PASS ;
- tests d’intégration repository/PostgreSQL : PASS ;
- tests de contrat : PASS ;
- contrôle d’architecture : PASS ;
- suite globale : PASS ;
- `git diff --check` : PASS.

## Gaps contenus

L’API n’expose pas de liste paginée des biens ni des owners. Le parcours exige
donc un UUID connu pour rouvrir un bien ou affecter un owner. Une future tâche
backend API-first devra définir pagination, filtrage, autorisation et contrats
avant qu’une vraie liste ou un sélecteur puisse être ajouté.

## Résultat final

UI-003 livre une tranche métier réelle, sans données runtime fictives ni nouveau
backend : création, lecture, détails/conditions commerciales et ownership sont
utilisables via la session Auth0 et les capacités Property existantes.
