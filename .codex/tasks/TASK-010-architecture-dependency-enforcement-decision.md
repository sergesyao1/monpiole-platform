# TASK-010 — TD-003 Architecture Dependency Enforcement Decision

## Status

Completed.

## ADR

ADR-0002 — Technology Selection Gate

## Objective

Evaluate architecture dependency-analysis and enforcement approaches compatible
with the approved TD-001 and TD-002 decisions and produce an evidence-backed
recommendation for deterministic local architectural verification.

This task may recommend technology, but must not install, configure, or integrate
an architecture-analysis tool.

## Decision Area

TD-003 — Architecture Dependency Checking & Enforcement

## Approved Baseline

TD-001 approved baseline:

- Node.js;
- strict TypeScript;
- native ESM.

TD-002 approved baseline:

- pnpm;
- native workspaces;
- one shared committed lockfile;
- frozen CI installation;
- no separate monorepo orchestration layer initially.

## Problem Statement

TASK-006-07 and TASK-006-08 remain blocked because MonPiole has documented
architecture boundaries but no deterministic mechanism capable of verifying
them automatically.

The selected approach must support the approved runtime/module/workspace model
without weakening ADR-0005 or ADR-0006.

## Scope

Evaluate mechanisms capable of detecting or enforcing:

- forbidden dependency directions;
- circular dependencies;
- service-to-service internal imports;
- cross-service persistence access;
- Domain -> Infrastructure dependencies;
- packages/core -> services dependencies;
- service-specific business logic leaking into packages/shared;
- application boundary violations;
- public package/export boundaries;
- workspace dependency violations.

## Required Analysis

At minimum evaluate:

- static dependency-analysis tools;
- architecture-test approaches;
- lint/import-boundary approaches;
- graph-based dependency analysis;
- TypeScript/ESM resolution accuracy;
- pnpm workspace awareness;
- package exports awareness;
- deterministic local execution;
- actionable diagnostics;
- CI suitability;
- configuration complexity;
- false-positive/false-negative risk;
- security and supply-chain implications;
- maintenance burden;
- extensibility as bounded contexts grow;
- migration and rollback.

Determine whether MonPiole requires:

1. one architecture-enforcement mechanism;
2. a combination of complementary mechanisms;
3. native compiler/package boundaries plus targeted architecture tests.

Do not assume that one tool must enforce every rule.

## Candidate Evaluation Rules

- Compare multiple realistic alternatives.
- Evaluate architectural accuracy over popularity.
- Do not weaken architecture rules to fit a tool.
- Prefer deterministic and locally reproducible checks.
- Prefer the smallest enforcement stack that covers required rules.
- Distinguish static import dependency checks from runtime/data-access guarantees.
- Identify rules that cannot be proven statically.
- Preserve TD-001 native ESM semantics.
- Preserve TD-002 pnpm workspace semantics.
- Do not modify accepted ADRs.
- Do not install dependencies.
- Do not create package manifests.
- Do not create lockfiles.
- Do not create CI workflows.
- Do not implement architecture checks during this decision task.

## ADR-0002 Requirements

The proposal must explicitly document:

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

- Decision ID: TD-003;
- Status: PROPOSED;
- context;
- architecture rules to enforce;
- candidate mechanisms;
- comparison criteria;
- comparative analysis;
- ESM compatibility;
- TypeScript compatibility;
- pnpm workspace compatibility;
- deterministic execution analysis;
- diagnostics strategy;
- local execution strategy;
- CI integration readiness;
- rules enforceable statically;
- rules requiring other verification mechanisms;
- security considerations;
- migration strategy;
- rollback strategy;
- risks;
- consequences;
- recommendation;
- rationale;
- dependencies;
- implementation gate;
- approval gate.

## Verification

The audit must verify:

- ADR-0001 through ADR-0006 were reviewed;
- approved TD-001 was reviewed;
- approved TD-002 was reviewed;
- TASK-006-07 requirements were reviewed;
- TASK-006-08 requirements were reviewed;
- packages/apps/services boundaries were reviewed;
- multiple realistic candidates were compared;
- ESM and pnpm resolution implications were analysed;
- deterministic local execution was analysed;
- no dependency was installed;
- no manifest or lockfile was introduced;
- no architecture checker was configured;
- no CI workflow was introduced;
- final Git diff was reviewed.

## Acceptance Criteria

- [ ] Multiple realistic enforcement approaches are evaluated.
- [ ] Required architecture rules are mapped to enforceable controls.
- [ ] Static and non-static verification limits are explicit.
- [ ] TypeScript and native ESM compatibility is analysed.
- [ ] pnpm workspace compatibility is analysed.
- [ ] Deterministic local execution is addressed.
- [ ] Diagnostics and violation reporting are addressed.
- [ ] CI integration readiness is analysed.
- [ ] Security and supply-chain implications are analysed.
- [ ] Migration and rollback are documented.
- [ ] Trade-offs are explicit.
- [ ] An evidence-backed recommendation is produced.
- [ ] Recommendation remains PROPOSED pending human approval.
- [ ] No enforcement technology is installed or configured.

## Constraints

Decision analysis only.

No architecture-enforcement technology becomes approved through this task.

## Related

- ADR-0001
- ADR-0002
- ADR-0003
- ADR-0004
- ADR-0005
- ADR-0006
- TD-001
- TD-002
- TD-003
- TASK-006-07
- TASK-006-08
- engineering/decisions/technology-decision-inventory.md
- engineering/decisions/td-001-runtime-language-module-system-proposal.md
- engineering/decisions/td-002-monorepo-package-dependency-management-proposal.md
