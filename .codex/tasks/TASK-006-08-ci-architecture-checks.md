# TASK-006-08 — CI Architecture Checks

## Status

TODO

## ADR

ADR-0006 — Architecture applicative : Bounded Contexts, Services et Frontières

## Objective

Préparer l'intégration des contrôles architecturaux dans le processus de
qualité et de CI.

## Scope

Définir :

- le moment d'exécution des contrôles ;
- les conditions d'échec ;
- les rapports ;
- les règles de violation ;
- la reproductibilité locale/CI ;
- la stratégie de traitement des exceptions.


## Verification

Verified on 2026-08-10.

### Documentation and structural checks

- ADR-006 explicitly requires architectural controls to be reproducible.
- ADR-006 explicitly requires integration of architectural checks into quality and CI.
- ADR-006 requires deterministic verification results.
- ADR-006 requires violations to be clearly identifiable.
- ADR-006 requires the controls to be executable locally before CI integration.
- ADR-006 requires architectural exceptions to be documented.
- `tools/quality/` exists as the designated quality automation area.
- `tools/quality/README.md` defines deterministic output and actionable diagnostics.
- The repository contains a `Makefile`, but no architecture-check implementation is currently defined.
- No CI architecture-check implementation has been identified.
- No dependency-analysis or architecture-enforcement tool has been selected.
- ADR-0002 explicitly prevents technology selection before the corresponding decision record.

### CI implementation

PENDING.

The repository currently contains the structural placeholder for quality
automation but does not contain an implemented architecture-check command,
CI workflow, dependency-analysis tool, or automated violation reporter.

The following implementation items therefore remain pending:

- local architecture-check command;
- deterministic architecture-check execution;
- CI invocation;
- failure conditions;
- machine-readable or actionable diagnostics;
- exception handling mechanism;
- architecture-check reporting.

### Technology gate

No new CI or architecture-analysis technology is selected by this task.

Any future technology selection must comply with ADR-0002 — Technology
Selection Gate and must be approved before installation or integration.

### Result

DOCUMENTATION / STRUCTURAL BASELINE: PASS.

CI ARCHITECTURE CHECK IMPLEMENTATION: PENDING.

AUTOMATED ENFORCEMENT: PENDING.

## Acceptance Criteria

- [ ] Les contrôles architecturaux peuvent être exécutés en CI.
- [ ] Une violation architecturale peut faire échouer le contrôle.
- [ ] Les résultats sont déterministes.
- [ ] Les diagnostics sont exploitables.
- [ ] Les exceptions sont explicitement documentées.
- [ ] Le mécanisme choisi respecte ADR-0002.

## Constraints

Ne pas installer ni sélectionner de nouvel outil dans cette tâche.

La sélection éventuelle d'un outil doit faire l'objet d'une ADR conforme
à ADR-0002.

## Related

- ADR-0002
- ADR-0006