# TASK-080 — Property Viewing Outcome & Follow-up Vertical Slice

## Statut

DONE.

## Contexte et état initial

TASK-079, commitée sous `c62babe`, établit le résultat de visite comme prochaine capability. TASK-078 est commitée sous `e83ec8e`. Le worktree initial était propre et la dernière migration était `0020`.

## Architecture retenue

`PropertyViewingOutcome` est un agrégat indépendant de Property Management. Il référence une Viewing mais ne duplique ni l’Inquiry ni ses coordonnées. Le tenant vient uniquement de l’autorité et le Property est vérifié via la Viewing tenant-scoped.

## Domaine et invariants

- création exclusivement depuis une Viewing `COMPLETED`;
- état initial imposé `FOLLOW_UP_REQUIRED`;
- transitions `FOLLOW_UP_REQUIRED -> PROCEED | DECLINED`;
- replay de la même décision terminale idempotent;
- décision terminale différente interdite;
- un Outcome logique par Viewing;
- note interne optionnelle, normalisée et limitée à 2 000 caractères;
- aucun Client, Contract, Offer, Application ou Reservation créé.

## Persistence et migration

La migration additive `0021_property_management_baseline.sql` crée `property_management.property_viewing_outcomes`. Elle ajoute aussi la candidate key `(tenant_id, property_id, viewing_id)` requise par la FK composite Outcome→Viewing. Unicité tenant/Viewing, checks note/lifecycle, RLS activée et forcée, et grants `SELECT, INSERT, UPDATE` à `monpiole_runtime` sont explicites.

La création verrouille la Viewing `FOR UPDATE`, revalide `COMPLETED`, puis insère dans la même transaction. Les décisions verrouillent l’Outcome. La contrainte unique arbitre les doubles créations concurrentes et le rollback préserve l’état terminal.

## Grants

- `RETRIEVE_PROPERTY_VIEWING_OUTCOMES`;
- `MANAGE_PROPERTY_VIEWING_OUTCOMES`.

Ils sont filtrés à la frontière authentifiée et accordés à l’administrateur tenant runtime.

## API et OpenAPI

- `POST /v1/properties/{propertyId}/viewings/{viewingId}/outcome`;
- `GET /v1/properties/{propertyId}/viewings/{viewingId}/outcome`;
- `POST /v1/properties/{propertyId}/viewings/{viewingId}/outcome/proceed`;
- `POST /v1/properties/{propertyId}/viewings/{viewingId}/outcome/decline`.

Les schémas Zod stricts excluent `tenantId` et l’audit. Problem Details distingue validation 400, autorisation 403, absence 404 et éligibilité/conflit/transition 409. OpenAPI est régénéré.

## Web

La section de visite du Property Workspace affiche « Résultat de la visite » uniquement après une visite effectuée. L’utilisateur peut « Consigner le résultat », puis « Poursuivre » ou « Décliner ». Les statuts français sont « Suivi requis », « Souhaite poursuivre » et « Ne souhaite pas poursuivre ». Les actions disparaissent après une décision terminale et les erreurs conservent le résultat chargé.

## SDK

`packages/sdk` contient uniquement un README placeholder et aucun package exécutable, export ou convention de génération. Aucun changement SDK artificiel n’est introduit; l’OpenAPI reste le contrat stable pour un futur SDK.

## Tests

- domaine/application: création, état initial, note, éligibilité et transitions;
- HTTP: création, lecture, proceed, decline, validation, grants et conflits;
- contrat: routes OpenAPI et absence de tenant;
- PostgreSQL: migration, FK composite, unicité concurrente, RLS, transition et rollback;
- Web: création, poursuite, déclin, terminalité et erreur API.

## Limitations volontaires

Pas de CRM, scoring, rappel, notification, calendrier, conversion Client, Contract, offre, application, réservation, paiement, signature ou analytics.

## Validation finale

- typecheck global: réussi sur 9 projets exécutables;
- typecheck des tests: réussi;
- migration check Property Management: réussi, `Everything's fine`;
- tests unitaires: 34 fichiers, 247 tests réussis;
- test HTTP Outcome ciblé: 1 fichier, 5 tests réussis;
- tests de contrat: 22 fichiers, 104 tests réussis;
- tests PostgreSQL Property Management: 5 fichiers, 96 tests réussis;
- tests Web: 25 fichiers, 152 tests réussis;
- build Web: réussi, 172 modules transformés;
- architecture: réussie;
- suite globale finale: 115 fichiers, 837 tests réussis;
- `git diff --check`: réussi;
- aucun script lint n’existe dans le dépôt.

## Fichiers

Le diff final couvre le domaine/application/persistence Property Management, la migration `0021`, la composition/API/OpenAPI, l’intégration Web, les tests et les README concernés. Aucun fichier SDK runtime n’existe à modifier.

## Travaux futurs

Un nouvel audit produit doit déterminer si la prochaine étape après `PROCEED` est une conversion Client, une application locative ou une offre selon le type de transaction.
