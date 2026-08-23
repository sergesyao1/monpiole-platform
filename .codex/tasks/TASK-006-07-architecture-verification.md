# TASK-006-07 â€” Architecture Verification

## Status

BLOCKED

## ADR

ADR-0006 â€” Architecture applicative : Bounded Contexts, Services et FrontiÃ¨res

## Objective

DÃ©finir les contrÃ´les permettant de vÃ©rifier automatiquement les rÃ¨gles
architecturales d'ADR-006.

## Controls To Define

Les contrÃ´les devront permettre de dÃ©tecter notamment :

- les dÃ©pendances interdites ;
- les dÃ©pendances circulaires ;
- les accÃ¨s directs aux donnÃ©es d'un autre service ;
- les dÃ©pendances de `packages/core` vers les services ;
- les dÃ©pendances mÃ©tier interdites dans `packages/shared` ;
- les violations de frontiÃ¨re des applications.


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

Any future tool selection must comply with ADR-0002 â€” Technology Selection Gate.

### Result

DOCUMENTATION / STRUCTURAL BASELINE: PASS.

AUTOMATED ARCHITECTURAL ENFORCEMENT: PENDING.

RUNTIME / IMPLEMENTATION VERIFICATION: PENDING.

## Acceptance Criteria

- [ ] Chaque rÃ¨gle vÃ©rifiable possÃ¨de un contrÃ´le identifiÃ©.
- [ ] Les contrÃ´les sont reproductibles.
- [ ] Les contrÃ´les produisent des rÃ©sultats dÃ©terministes.
- [ ] Les violations sont clairement identifiables.
- [ ] Les contrÃ´les peuvent Ãªtre exÃ©cutÃ©s localement.
- [ ] La stratÃ©gie d'intÃ©gration CI est dÃ©finie.

## Technology Gate

Cette tÃ¢che ne sÃ©lectionne aucun outil.

Si un outil d'analyse architecturale ou de dÃ©pendances est nÃ©cessaire,
une nouvelle ADR doit Ãªtre crÃ©Ã©e conformÃ©ment Ã  ADR-0002 avant son adoption.

## Blocker

Automated architectural enforcement is blocked pending an approved
technology-selection decision compliant with ADR-0002.

The documentation and structural baseline is verified, but the repository
does not yet contain an approved runtime/module system, dependency-analysis
mechanism, or architecture-check implementation.

Unblock condition:

- required technology decisions are approved under ADR-0002;
- architecture checking can be implemented without violating the technology gate.

## Related

- ADR-0002
- ADR-0005
- ADR-0006
