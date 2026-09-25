# TASK-078 — Property Viewing Scheduling & Management Vertical Slice

## Statut

DONE.

## Contexte et objectif

Le suivi des demandes publiques existe depuis TASK-076. Ce vertical slice ajoute la planification et le suivi privé d’une visite liée à une demande prise en compte, sans introduire de calendrier générique.

## Périmètre fonctionnel

- planifier une visite depuis une demande `ACKNOWLEDGED`;
- consulter la visite d’une demande ou une visite par identifiant;
- replanifier une visite encore planifiée;
- marquer la visite effectuée ou l’annuler;
- afficher et piloter ces actions dans les demandes du Property Workspace.

## Décisions métier

- `PropertyViewing` est un concept autonome du bounded context Property Management;
- le tenant vient exclusivement de l’autorité authentifiée;
- le bien est dérivé de la demande et le chemin doit désigner ce même bien;
- V1 autorise une seule visite logique par demande;
- les états sont `SCHEDULED`, `COMPLETED`, `CANCELLED`;
- les états terminaux ne peuvent plus être modifiés;
- le début est futur, la fin postérieure et la durée maximale de quatre heures;
- le fuseau horaire est un identifiant IANA valide.

## API et autorisations

- `POST /v1/properties/{propertyId}/inquiries/{inquiryId}/viewing`;
- `GET /v1/properties/{propertyId}/inquiries/{inquiryId}/viewing`;
- `GET /v1/properties/{propertyId}/viewings/{viewingId}`;
- `PUT /v1/properties/{propertyId}/viewings/{viewingId}/schedule`;
- `PUT /v1/properties/{propertyId}/viewings/{viewingId}/completion`;
- `PUT /v1/properties/{propertyId}/viewings/{viewingId}/cancellation`.

Les lectures exigent `RETRIEVE_PROPERTY_VIEWINGS`; les mutations exigent `MANAGE_PROPERTY_VIEWINGS`. Les DTO stricts n’exposent pas le tenant.

## Persistance et concurrence

La migration additive `0020` crée `property_viewings`, ses références composites tenant-scoped, son unicité `(tenant_id, inquiry_id)`, ses checks temporels et de cycle de vie, sa politique RLS forcée et ses grants runtime. La création reverrouille la demande avec `FOR UPDATE`, revalide `ACKNOWLEDGED` puis insère dans la même transaction. Les transitions verrouillent la visite et bénéficient du rollback transactionnel.

## Web

La section « Demandes reçues » charge la visite d’une demande prise en compte. Les formulaires de planification et replanification, les états de chargement, les confirmations, les erreurs et les actions terminales sont en français. Les erreurs 401, 403, 404 et 409 reçoivent un message spécialisé.

## Tests et acceptation

- domaine et application: temps, fuseau, durée, transitions et éligibilité;
- HTTP: six opérations, validation, autorisation et absence;
- contrat: chemins OpenAPI et absence de `tenantId`;
- PostgreSQL: création/lecture, unicité, isolation RLS, verrou et rollback;
- Web: planification, replanification, achèvement, validation française et conservation après erreur.

## Exclusions

Pas de créneaux multiples, participants, rappels, notes, assignation d’agent, synchronisation calendrier, recherche publique ou calendrier transversal.

## Validation finale

- typecheck global: réussi, 9 projets sur 10 exécutés;
- typecheck des tests: réussi;
- migration check Property Management: réussi, `Everything's fine`;
- tests unitaires: 33 fichiers, 242 tests réussis;
- tests HTTP/intégration: 25 fichiers, 206 tests réussis;
- tests de contrat: 21 fichiers, 103 tests réussis;
- tests PostgreSQL/RLS/concurrence Property: 5 fichiers, 96 tests réussis;
- tests Web: 24 fichiers, 149 tests réussis;
- build Web: réussi, 171 modules transformés;
- architecture: réussie;
- suite globale: 111 fichiers, 823 tests réussis;
- `git diff --check`: réussi;
- aucun script `lint` n’existe dans les `package.json`; aucun substitut artificiel n’a été ajouté.
