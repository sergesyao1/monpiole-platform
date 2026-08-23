# TASK-008 — TD-001 Runtime, Language & Module System Decision

## Status

Completed.

## ADR

ADR-0002 — Technology Selection Gate

## Objective

Evaluate candidate runtime, language, and module-system options for MonPiole
and produce an evidence-backed recommendation suitable for architectural
review and approval.

This task may recommend a technology, but it must not accept, install, or
configure the selected technology.

## Decision Area

TD-001 — Runtime, Language & Module System

## Scope

Evaluate the runtime, primary implementation language, and module-system
strategy required to move MonPiole from its architecture baseline toward
implementation.

The analysis must consider the current repository architecture, bounded
contexts, applications, packages, APIs, events, testing, tenant isolation,
security, operations, and future deployment needs.

## Required analysis

At minimum, evaluate:

- candidate runtimes;
- candidate primary languages;
- module-system implications;
- compatibility with Clean Architecture and DDD;
- compatibility with monorepo organisation;
- support for APIs and asynchronous processing;
- support for unit, integration, contract, tenant, and architecture tests;
- type-safety and contract evolution;
- developer productivity;
- ecosystem maturity;
- long-term maintainability;
- observability integration;
- security posture;
- deployment implications;
- operational complexity;
- performance characteristics relevant to MonPiole;
- migration and rollback implications;
- compatibility with future TD-002 and TD-003 decisions.

## Candidate evaluation rules

- Evaluate multiple realistic candidates.
- Do not select a candidate before comparison is complete.
- Distinguish evidence from preference.
- Document trade-offs.
- Avoid framework-first reasoning.
- Prefer architectural fit over popularity.
- Do not infer product requirements that are not approved.
- Do not modify accepted ADRs.
- Do not install runtimes, SDKs, package managers, dependencies, or frameworks.
- Do not create lockfiles.
- Do not introduce runtime source code.

## ADR-0002 requirements

The final decision proposal must explicitly cover:

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

## Expected output

Create a decision proposal under:

engineering/decisions/

The proposal must include:

- Decision ID: TD-001;
- current status: PROPOSED;
- context;
- requirements;
- candidates;
- comparison criteria;
- comparative analysis;
- trade-offs;
- recommendation;
- rationale;
- compatibility implications;
- security considerations;
- operational considerations;
- migration strategy;
- rollback strategy;
- risks;
- consequences;
- dependencies on TD-002 and TD-003;
- approval gate.

The recommendation must remain a proposal until explicitly approved by the
architecture owner.

## Verification

The audit must verify:

- ADR-0001 through ADR-0006 were reviewed;
- technology-decision-inventory.md was reviewed;
- repository architecture and application/service/package boundaries were reviewed;
- multiple candidates were compared;
- ADR-0002 decision requirements were addressed;
- no technology was installed;
- no dependency or lockfile was introduced;
- no runtime source code was introduced;
- final Git diff was reviewed.

## Acceptance Criteria

- [ ] Multiple realistic runtime/language candidates are evaluated.
- [ ] Evaluation criteria are explicit.
- [ ] Architecture compatibility is analysed.
- [ ] Security implications are analysed.
- [ ] Operational implications are analysed.
- [ ] Testing and tooling implications are analysed.
- [ ] Migration and rollback are documented.
- [ ] Trade-offs are explicit.
- [ ] An evidence-backed recommendation is produced.
- [ ] Recommendation remains PROPOSED pending human approval.
- [ ] No technology is installed or configured.
- [ ] No runtime implementation is introduced.

## Constraints

Decision analysis only.

No technology becomes approved through this task.

## Decision verification

Verified on 2026-08-23.

Codex decision analysis confirmed:

- multiple realistic candidates evaluated: PASS;
- Node.js / strict TypeScript / native ESM analysed: PASS;
- .NET / C# alternative analysed: PASS;
- JVM / Kotlin alternative analysed: PASS;
- architecture compatibility analysed: PASS;
- security implications analysed: PASS;
- operational implications analysed: PASS;
- testing and tooling implications analysed: PASS;
- migration strategy documented: PASS;
- rollback strategy documented: PASS;
- trade-offs documented: PASS;
- dependencies on TD-002 and TD-003 documented: PASS;
- no technology installed or configured: PASS;
- no runtime code, manifest, dependency, or lockfile introduced: PASS.

Recommendation:

Node.js with strict TypeScript and native ESM.

Decision status:

PROPOSED — pending explicit Architecture Owner approval.

Result: READY_FOR_ARCHITECTURE_REVIEW.
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
