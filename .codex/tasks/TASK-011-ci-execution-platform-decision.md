# TASK-011 — TD-009 CI Execution & Platform Decision

## Status

Completed.

## ADR

ADR-0002 — Technology Selection Gate

## Objective

Evaluate CI execution and platform alternatives for MonPiole and produce an
evidence-backed recommendation for running the existing deterministic quality
and architecture checks.

This task may recommend a CI platform, but must not configure or activate one.

## Decision Area

TD-009 — CI Execution & Platform Selection

## Existing Technical Baseline

The following local commands are already implemented and verified:

- corepack pnpm install --frozen-lockfile
- corepack pnpm architecture:check

TD-009 must select a CI execution environment capable of running these commands
without changing their semantics.

## Scope

Evaluate CI execution/platform approaches capable of supporting:

- repository-triggered validation;
- pull-request validation;
- branch validation;
- frozen dependency installation;
- Node.js and Corepack execution;
- pnpm 11.22.0;
- TypeScript and dependency-cruiser architecture checks;
- deterministic failure semantics;
- actionable logs and diagnostics;
- controlled secrets and permissions;
- dependency caching where safe;
- artifact/report retention where justified;
- future build, test, security, and deployment stages.

## Required Analysis

At minimum compare realistic alternatives relevant to the repository.

Evaluate:

- repository integration;
- execution model;
- hosted versus self-hosted runners;
- operating-system support;
- Node/Corepack/pnpm compatibility;
- pull-request and branch triggers;
- secret-management model;
- least-privilege permissions;
- supply-chain controls;
- dependency caching;
- diagnostics;
- artifact retention;
- concurrency;
- maintainability;
- operational burden;
- security implications;
- migration;
- rollback;
- cost considerations where evidence is available.

Do not assume GitHub Actions or another platform is selected merely because the
repository is hosted on a particular source-control provider.

## Candidate Evaluation Rules

- Compare multiple realistic alternatives.
- Separate source hosting from CI platform selection.
- Prefer the smallest operational surface that satisfies requirements.
- Preserve the existing local architecture commands unchanged.
- Do not create CI workflows during this task.
- Do not create secrets.
- Do not enable external services.
- Do not modify accepted ADRs.
- Do not weaken existing quality gates.

## ADR-0002 Requirements

The proposal must document:

- problem statement;
- alternatives considered;
- compatibility implications;
- operational impact;
- security considerations;
- migration approach;
- rollback approach;
- major risks;
- consequences;
- recommendation.

## Expected Output

Create a decision proposal under:

engineering/decisions/

The proposal must contain:

- Decision ID: TD-009;
- Status: PROPOSED;
- context;
- CI requirements;
- candidate platforms;
- comparison criteria;
- comparative analysis;
- runner model;
- trigger strategy;
- permissions/security model;
- secrets strategy;
- caching strategy;
- diagnostics/reporting strategy;
- compatibility with existing pnpm architecture checks;
- operational considerations;
- cost considerations where supported;
- migration strategy;
- rollback strategy;
- risks;
- consequences;
- recommendation;
- approval gate.

## Verification

Verify that:

- ADR-0001 through ADR-0006 were reviewed;
- approved TD-001, TD-002, and TD-003 were reviewed;
- TASK-006-08 was reviewed;
- existing local architecture commands were reviewed;
- multiple CI alternatives were compared;
- security and permission implications were analysed;
- no CI workflow was created;
- no external service was enabled;
- no secrets were introduced;
- final Git diff was reviewed.

## Acceptance Criteria

- [ ] Multiple realistic CI alternatives are evaluated.
- [ ] Existing local checks remain the source of truth.
- [ ] Trigger strategy is analysed.
- [ ] Runner model is analysed.
- [ ] Permissions and secret handling are analysed.
- [ ] Supply-chain implications are analysed.
- [ ] Diagnostics and failure semantics are analysed.
- [ ] Operational burden is analysed.
- [ ] Migration and rollback are documented.
- [ ] An evidence-backed recommendation is produced.
- [ ] Recommendation remains PROPOSED pending human approval.
- [ ] No CI platform is configured by this task.

## Constraints

Decision analysis only.

No CI technology becomes approved through this task.

## Related

- ADR-0002
- TD-001
- TD-002
- TD-003
- TD-009
- TASK-006-07
- TASK-006-08
