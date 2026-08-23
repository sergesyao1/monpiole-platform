# TASK-006-01 — Bounded Contexts & Ownership

## Status

DONE

## Verification

Verified on 2026-08-10.

Checks performed:

- All 7 Bounded Contexts have a Purpose section.
- All 7 Bounded Contexts have explicit Ownership.
- All 7 Bounded Contexts have documented Responsibilities.
- All 7 Bounded Contexts have documented Data Ownership.
- All 7 Bounded Contexts have documented Boundaries.
- All 7 Bounded Contexts have documented Conventions.
- Ownership is explicitly identified for all 7 services.

Result: PASS.
## ADR

ADR-0006 — Architecture applicative : Bounded Contexts, Services et Frontières

## Objective

Formaliser les Bounded Contexts de Mon Piole ainsi que leur ownership,
leurs responsabilités principales et leurs frontières métier.

## Scope

- Identifier les Bounded Contexts existants sous `services/`.
- Documenter la responsabilité métier de chaque contexte.
- Documenter l'équipe propriétaire de chaque contexte.
- Identifier les responsabilités qui ne doivent pas être transférées aux applications.
- Maintenir une correspondance claire entre service et Bounded Context.

## Existing Bounded Contexts

- audit
- billing
- identity
- notifications
- reporting
- tenant-management
- workflow

## Acceptance Criteria

- [ ] Chaque Bounded Context possède un ownership explicite.
- [ ] Chaque Bounded Context possède une responsabilité métier identifiable.
- [ ] Les responsabilités principales sont documentées.
- [ ] Les frontières métier sont documentées.
- [ ] Les applications ne possèdent pas de responsabilités métier appartenant aux services.
- [ ] Toute exception est documentée.

## Constraints

Ne sélectionner ni framework, ni runtime, ni outil d'architecture dans cette tâche.

Les décisions technologiques restent soumises à ADR-0002.

## Related

- ADR-0001
- ADR-0002
- ADR-0005
- ADR-0006