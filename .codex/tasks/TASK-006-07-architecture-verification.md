# TASK-006-07 — Architecture Verification

## Status

TODO

## ADR

ADR-0006 — Architecture applicative : Bounded Contexts, Services et Frontières

## Objective

Définir les contrôles permettant de vérifier automatiquement les règles
architecturales d'ADR-006.

## Controls To Define

Les contrôles devront permettre de détecter notamment :

- les dépendances interdites ;
- les dépendances circulaires ;
- les accès directs aux données d'un autre service ;
- les dépendances de `packages/core` vers les services ;
- les dépendances métier interdites dans `packages/shared` ;
- les violations de frontière des applications.


## Verification

Verified on 2026-08-10.

### Documentation and structural checks

- ADR-006 identifies the required architectural controls.
- The repository contains all 7 currently identified Bounded Contexts.
- Each Bounded Context has documented ownership.
- Each Bounded Context has documented responsibilities.
- Each Bounded Context has documented Data Ownership.
- Each Bounded Context has documented boundaries.
- `packages/core` documents that it must not depend on services.
- `packages/shared` documents that it must remain domain-neutral and broadly reusable.
- Applications document that they must not contain service-owned business logic.
- Applications document that they must not access internal business data directly.
- `packages/events` documents event contract ownership and compatibility rules.
- `packages/types` documents that service-internal models must remain inside their Bounded Context.
- `tests/` exists with dedicated unit, integration, contract, e2e, fixtures, and performance areas.
- `tools/quality/` exists as the designated quality automation area.

### Automated enforcement

PENDING.

The repository currently contains documentation and structural placeholders,
but no implemented architecture dependency checker, dependency graph,
cycle detector, or automated boundary enforcement mechanism was identified.

The following controls therefore remain to be implemented:

- forbidden dependency detection;
- circular dependency detection;
- cross-service internal access detection;
- cross-service data access detection;
- `packages/core` -> services detection;
- service-specific business logic detection in `packages/shared`;
- application boundary violation detection.

### Technology gate

No architecture analysis or dependency checking tool has been selected.

Any future tool selection must comply with ADR-0002 — Technology Selection Gate.

### Result

DOCUMENTATION / STRUCTURAL BASELINE: PASS.

AUTOMATED ARCHITECTURAL ENFORCEMENT: PENDING.

RUNTIME / IMPLEMENTATION VERIFICATION: PENDING.

## Acceptance Criteria

- [ ] Chaque règle vérifiable possède un contrôle identifié.
- [ ] Les contrôles sont reproductibles.
- [ ] Les contrôles produisent des résultats déterministes.
- [ ] Les violations sont clairement identifiables.
- [ ] Les contrôles peuvent être exécutés localement.
- [ ] La stratégie d'intégration CI est définie.

## Technology Gate

Cette tâche ne sélectionne aucun outil.

Si un outil d'analyse architecturale ou de dépendances est nécessaire,
une nouvelle ADR doit être créée conformément à ADR-0002 avant son adoption.

## Related

- ADR-0002
- ADR-0005
- ADR-0006