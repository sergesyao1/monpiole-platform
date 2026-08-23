# TASK-006-08 â€” CI Architecture Checks

## Status

DONE

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
## Unblock verification

Unblocked on 2026-08-23.

TASK-006-07 local architecture enforcement is now implemented and verified.

Local deterministic controls are available through:

corepack pnpm architecture:check

Verified prerequisites:

- frozen dependency installation: PASS;
- shared lockfile present;
- architecture dependency rules executable;
- violation fixtures executable;
- deterministic local result: PASS.

TASK-006-08 may now integrate the existing local architecture command into CI.

Result: READY_FOR_IMPLEMENTATION.
## CI platform blocker

Blocked on 2026-08-23.

TASK-006-07 local architecture enforcement is implemented and verified.

CI integration remains blocked because no CI execution/platform technology has
yet been approved under ADR-0002.

Required decision:

- TD-009 — CI Execution & Platform Selection.

TASK-006-08 must not select GitHub Actions, Azure DevOps, GitLab CI, Jenkins,
or another CI platform before TD-009 is reviewed and approved.

The CI implementation must reuse the existing local commands without creating
a competing architecture-check implementation:

- corepack pnpm install --frozen-lockfile
- corepack pnpm architecture:check

Result: BLOCKED pending TD-009.
## TD-009 approval

TD-009 was approved on 2026-08-23.

TASK-006-08 is authorized to implement the minimal GitHub Actions CI adapter
using an ephemeral GitHub-hosted Linux runner.

The implementation must reuse the existing commands unchanged:

- corepack pnpm install --frozen-lockfile
- corepack pnpm architecture:check

The architecture validation job must remain unprivileged and require no secrets.

Result: READY_FOR_IMPLEMENTATION.
## CI implementation verification

Verified locally on 2026-08-23.

Implemented CI adapter:

- GitHub Actions;
- ephemeral GitHub-hosted Ubuntu 24.04 runner;
- Node.js 24.18.0;
- pnpm 11.22.0 through Corepack;
- immutable action SHA pins;
- read-only repository permissions;
- no secrets;
- no persisted checkout credentials;
- pull-request validation on main;
- push validation on main;
- manual workflow dispatch;
- concurrency cancellation.

The workflow reuses the existing repository commands unchanged:

- corepack pnpm install --frozen-lockfile
- corepack pnpm architecture:check

Local verification:

- frozen install: PASS;
- architecture check: PASS;
- workflow static policy checks: PASS;
- Git diff check: PASS.

Remaining verification:

- actual GitHub-hosted execution;
- pull-request trigger;
- intentional architecture-violation failure;
- GitHub logs and diagnostics;
- concurrency behaviour.

Result: READY_FOR_REVIEW.
## GitHub-hosted verification

Verified on 2026-08-23 through Pull Request #1.

Workflow:

- GitHub Actions;
- ephemeral GitHub-hosted Ubuntu 24.04 runner;
- Node.js 24.18.0;
- pnpm 11.22.0 through Corepack;
- immutable action SHA pins;
- read-only repository permissions;
- no CI secrets;
- frozen dependency installation;
- existing repository architecture command reused unchanged.

Positive verification:

- corepack pnpm install --frozen-lockfile: PASS;
- corepack pnpm architecture:check: PASS;
- GitHub pull-request workflow: PASS.

Negative enforcement verification:

An intentional Domain -> Infrastructure dependency was introduced on the
validation branch.

Expected result:

- local architecture validation: FAIL;
- GitHub Actions architecture validation: FAIL.

Observed result:

- local violation detection: PASS;
- GitHub Actions rejected the architecture violation: PASS.

Recovery verification:

The intentional violation was reverted.

Observed result:

- local architecture validation returned to PASS;
- GitHub Actions returned to PASS.

This proves both successful execution and deterministic failure propagation.

Residual controls such as runtime authorization, tenant isolation, dynamic
network/database access, and semantic business ownership remain outside static
dependency-graph enforcement and require their dedicated verification layers.

Result: PASS.
