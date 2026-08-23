# TASK-009 — TD-002 Monorepo, Package & Dependency Management Decision

## Status

Completed.

## ADR

ADR-0002 — Technology Selection Gate

## Objective

Evaluate candidate monorepo, workspace, package-management, and dependency-
management approaches for MonPiole and produce an evidence-backed recommendation
compatible with the proposed TD-001 runtime baseline.

This task may recommend technology, but it must not approve, install, configure,
or initialize that technology.

## Decision Area

TD-002 — Monorepo, Package & Dependency Management

## Context

TD-001 currently proposes Node.js with strict TypeScript and native ESM.

TD-001 remains PROPOSED and must not be treated as accepted technology.

TD-002 must evaluate approaches compatible with that proposal while preserving
the possibility that architecture review rejects or changes TD-001.

## Scope

Evaluate the repository tooling needed to manage MonPiole's:

- apps;
- services;
- packages;
- shared contracts;
- SDKs;
- dependency graph;
- workspace boundaries;
- reproducible dependency installation;
- package scripts;
- public module surfaces;
- internal package relationships.

## Required analysis

At minimum, evaluate:

- package-manager candidates;
- workspace capabilities;
- monorepo orchestration where justified;
- dependency resolution;
- deterministic lockfiles;
- reproducible installation;
- dependency version alignment;
- workspace package discovery;
- internal package linking;
- package exports;
- ESM compatibility;
- TypeScript compatibility under proposed TD-001;
- dependency graph visibility;
- architecture-check compatibility with future TD-003;
- local development workflow;
- CI compatibility;
- caching implications;
- security and supply-chain controls;
- dependency update strategy;
- operational complexity;
- migration and rollback.

Explicitly determine whether MonPiole needs:

1. only a package manager with native workspace support;
2. a package manager plus a separate monorepo orchestration layer;
3. a more integrated monorepo tool.

Do not assume that an orchestration layer is required.

## Candidate evaluation rules

- Compare multiple realistic alternatives.
- Separate package management from monorepo orchestration.
- Do not choose tools merely because they are popular.
- Prefer the smallest tooling surface that satisfies the requirements.
- Evaluate compatibility with TD-001 without treating TD-001 as accepted.
- Evaluate implications for TD-003 architecture enforcement.
- Preserve apps / services / packages ownership boundaries.
- Do not modify accepted ADRs.
- Do not install or initialize any package manager or monorepo tool.
- Do not create package manifests.
- Do not create workspace configuration.
- Do not create dependency lockfiles.
- Do not introduce runtime source code.

## ADR-0002 requirements

The proposal must explicitly document:

- problem statement;
- alternatives considered;
- compatibility implications;
- operational impact;
- security and supply-chain considerations;
- migration approach;
- rollback approach;
- major risks;
- consequences;
- recommendation.

## Expected output

Create a decision proposal under:

engineering/decisions/

The proposal must contain:

- Decision ID: TD-002;
- Status: PROPOSED;
- context;
- requirements;
- candidates;
- comparison criteria;
- comparative analysis;
- package-manager analysis;
- workspace analysis;
- monorepo orchestration analysis;
- dependency reproducibility analysis;
- package/public-export strategy;
- security and supply-chain considerations;
- CI implications;
- architecture-enforcement implications;
- migration strategy;
- rollback strategy;
- risks;
- consequences;
- recommendation;
- rationale;
- compatibility with proposed TD-001;
- dependencies on TD-003;
- approval gate.

The recommendation must explicitly state whether a separate monorepo
orchestration technology is necessary.

## Verification

The audit must verify:

- ADR-0001 through ADR-0006 were reviewed;
- technology-decision-inventory.md was reviewed;
- TD-001 proposal was reviewed;
- repository apps/services/packages structure was reviewed;
- multiple realistic candidates were compared;
- package management and orchestration were evaluated separately;
- ADR-0002 requirements were addressed;
- no technology was installed;
- no manifest was introduced;
- no workspace configuration was introduced;
- no lockfile was introduced;
- no runtime source code was introduced;
- final Git diff was reviewed.

## Acceptance Criteria

- [ ] Multiple realistic package-management candidates are evaluated.
- [ ] Workspace requirements are explicit.
- [ ] Package management and monorepo orchestration are separated conceptually.
- [ ] Reproducibility and lockfile strategy are analysed.
- [ ] Public package/export boundaries are analysed.
- [ ] Security and supply-chain implications are analysed.
- [ ] CI implications are analysed.
- [ ] TD-003 compatibility is analysed.
- [ ] Migration and rollback are documented.
- [ ] Trade-offs are explicit.
- [ ] An evidence-backed recommendation is produced.
- [ ] Need for a separate orchestration layer is explicitly decided.
- [ ] Recommendation remains PROPOSED pending human approval.
- [ ] No technology is installed or configured.

## Constraints

Decision analysis only.

No technology becomes approved through this task.

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
- engineering/decisions/technology-decision-inventory.md
- engineering/decisions/td-001-runtime-language-module-system-proposal.md
