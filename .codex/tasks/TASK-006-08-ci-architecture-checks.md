# TASK-006-08 â€” CI Architecture Checks

## Status

BLOCKED

## ADR

ADR-0006 â€” Architecture applicative : Bounded Contexts, Services et FrontiÃ¨res

## Objective

PrÃ©parer l'intÃ©gration des contrÃ´les architecturaux dans le processus de
qualitÃ© et de CI.

## Scope

DÃ©finir :

- le moment d'exÃ©cution des contrÃ´les ;
- les conditions d'Ã©chec ;
- les rapports ;
- les rÃ¨gles de violation ;
- la reproductibilitÃ© locale/CI ;
- la stratÃ©gie de traitement des exceptions.


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

Any future technology selection must comply with ADR-0002 â€” Technology
Selection Gate and must be approved before installation or integration.

### Result

DOCUMENTATION / STRUCTURAL BASELINE: PASS.

CI ARCHITECTURE CHECK IMPLEMENTATION: PENDING.

AUTOMATED ENFORCEMENT: PENDING.

## Acceptance Criteria

- [ ] Les contrÃ´les architecturaux peuvent Ãªtre exÃ©cutÃ©s en CI.
- [ ] Une violation architecturale peut faire Ã©chouer le contrÃ´le.
- [ ] Les rÃ©sultats sont dÃ©terministes.
- [ ] Les diagnostics sont exploitables.
- [ ] Les exceptions sont explicitement documentÃ©es.
- [ ] Le mÃ©canisme choisi respecte ADR-0002.

## Constraints

Ne pas installer ni sÃ©lectionner de nouvel outil dans cette tÃ¢che.

La sÃ©lection Ã©ventuelle d'un outil doit faire l'objet d'une ADR conforme
Ã  ADR-0002.

## Blocker

CI architecture-check implementation is blocked pending completion of the
local architecture-verification mechanism and the required technology
selection compliant with ADR-0002.

CI must not integrate a checker that has not first been approved and made
reproducible locally.

Unblock condition:

- TASK-006-07 automated enforcement is implementable;
- required technology decisions are approved under ADR-0002;
- a deterministic local architecture-check command exists.

## Related

- ADR-0002
- ADR-0006
