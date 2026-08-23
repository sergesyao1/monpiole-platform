# Technology decision inventory

- Status: Governed inventory; TD-004 approved testing baseline implemented by TASK-014
- Date: 2026-08-23
- Governing decision: [ADR-0002](../adr/0002-technology-selection-gate.md)
- Accepted baseline reviewed: ADR-0001 through ADR-0006

## Purpose

This inventory identifies decisions that must pass the ADR-0002 gate before
implementation. It records requirements and sequencing, not products,
providers, or accepted choices. Future ADR numbers are intentionally not
assigned: the next available number must be confirmed when each proposal is
created and accepted through repository governance.

## Evidence baseline

- ADR-0001 fixes repository ownership boundaries but does not choose workspace
  tooling.
- ADR-0002 explicitly requires follow-up decisions for monorepo tooling,
  runtime, persistence, API contracts, eventing infrastructure, and deployment.
  It also states that reserved infrastructure areas are not selections.
- ADR-0003 requires explicit versioned API and event contracts, additive
  evolution, compatibility verification, and retry-safe observable consumers.
- ADR-0004 requires tenant and correlation context at API, command, event,
  persistence, logging, and audit boundaries.
- ADR-0005 requires framework-independent domain code, unit, integration,
  architecture, contract, and tenant testing, plus separation of logging,
  metrics, and tracing from domain logic.
- ADR-0006 requires automated dependency and cycle checks that run locally and
  can integrate with CI. Its technology boundary names runtime, framework,
  package manager, analysis, dependency-checking, and CI technology as
  unselected.
- TASK-006-07 is blocked on an approved runtime/module baseline and local
  architecture enforcement. TASK-006-08 is blocked on TASK-006-07, an approved
  technology path, and a deterministic local command.
- The tooling requirements and registry identify capabilities only. Every
  TOOL-001 through TOOL-012 entry remains `NOT_SELECTED` and `NOT_BASELINED`.
- BACKLOG.md contains no candidates. CURRENT_SPRINT.md calls for runtime and
  monorepo decisions before CI, local runtime, or deployment assets.
- The repository has documentation placeholders and a help-only Makefile, but
  no runtime source, dependency manifest or lockfile, architecture checker, CI
  workflow, deployable container, or cloud resource. Infrastructure directory
  names and `.env.example` endpoints are reservations, not approvals.

## Decision inventory

“Blocking” means blocking the named next governed task, not that every decision
must be made immediately.

| ID | Area | Problem to solve | Source evidence | Status and downstream impact | Dependencies | Decision record required before selection | Sequence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TD-001 | Runtime, language, and module system | Define the executable and module semantics needed to parse a dependency graph, run deterministic checks, and later host application code. Language and module rules may be decided with the runtime when inseparable. | ADR-0002; ADR-0006 technology boundary; TASK-006-07 blocker; CURRENT_SPRINT.md | **Blocking now** for TASK-006-07 and all runtime implementation. | Accepted architecture baseline only. | Runtime/language/module-system ADR compliant with ADR-0002. | 1, in parallel with TD-002. |
| TD-002 | Monorepo, package, and dependency management | Define workspace discovery, dependency declaration, reproducible installation, command execution, and boundary visibility while preserving `apps/`, `services/`, and `packages/` ownership. | ADR-0001; ADR-0002; ADR-0006; TOOL-012; CURRENT_SPRINT.md | **Blocking now** for installing or executing the checker and for later packages. A lockfile remains forbidden until approval. | TD-001 compatibility must be evaluated; neither decision presupposes the other. | Monorepo/package-management ADR compliant with ADR-0002. | 1, coordinated with TD-001. |
| TD-003 | Architecture dependency checking and architecture testing | Make forbidden-edge, cross-context, cycle, and layer rules deterministic, locally runnable, and actionable. Decide whether checking and architecture tests are one capability or coordinated capabilities. | ADR-0005 architecture tests; ADR-0006 sections 27–28; TASK-006-07; TOOL-001 and TOOL-002; `tools/quality/README.md` | **Blocking now** for TASK-006-07; prerequisite to TASK-006-08. | TD-001 and TD-002; documented boundary rules from TASK-006-01 through TASK-006-06. | Architecture-enforcement ADR or scoped technology decision compliant with ADR-0002. | 2; implement locally before CI. |
| TD-004 | Unit, integration, contract, and tenant testing | **APPROVED strategy:** exact-pinned Vitest `4.1.11` and `@vitest/coverage-v8` `4.1.11`; repository-owned controlled fixtures and provider/consumer compatibility tests; tenant isolation mandatory across applicable suites and fixtures. Testcontainers `12.0.4` remains conditional. Static analysis remains TD-003-owned. | ADR-0003; ADR-0004; ADR-0005; ADR-0006; TOOL-003 through TOOL-006; `tests/README.md`; [approved TD-004](td-004-testing-strategy-tooling-proposal.md); TASK-014 | **APPROVED — BASELINE IMPLEMENTED.** Exact dependencies, stable level commands, strict TypeScript/ESM/NodeNext configuration, synthetic fixtures, tenant-isolation smoke evidence, coverage, frozen installation, and TD-003 regression checks passed on the approved Node `24.18.0` baseline. | Concrete API/event representation depends on TD-006/TD-007. Testcontainers installation and baselining depend on TD-008 or another real-adapter decision plus its compatibility gate. Real adapter, product contract, and product tenant-isolation claims require later tests. | Use the implemented baseline for later behavior. Pact, E2E, performance, broker-specific, persistence-specific, Testcontainers, and CI-provider tooling remain deferred or conditional. | 3, executable baseline complete; product implementation remains separately gated. |
| TD-005 | Application framework | Provide interface/application composition without coupling domain logic to framework or infrastructure concerns. | ADR-0002; ADR-0005; ADR-0006 technology boundary | **Deferred**; required before framework installation or application bootstrap, not for a standalone local dependency check. | TD-001, TD-002; API implementation requirements in TD-006 where applicable. | Application-framework ADR compliant with ADR-0002. | 4, when the first approved application slice is scoped. |
| TD-006 | API implementation and contract representation | Implement versioned APIs, authentication/authorisation boundaries, validation, errors, tenant/correlation propagation, lifecycle, and compatibility verification. ADR-0003 defines policy but not implementation technology or schema representation. | ADR-0003; ADR-0004; ADR-0005; AGENTS.md API-first rules | **Deferred**; required before a public API adapter or concrete schema/tool is introduced. | TD-001, TD-002, normally TD-005; TD-004 for contract tests. | API implementation/contract tooling ADR compliant with ADR-0002. | 4, before the first approved API adapter. |
| TD-007 | Eventing and messaging infrastructure | Implement explicit versioned event contracts, tenant/correlation propagation, idempotent retry-safe consumers, delivery semantics, and operability without exposing persistence models. | ADR-0002; ADR-0003; ADR-0004; ADR-0005 | **Deferred**; required before a broker, event client, or consumer runtime is introduced. | TD-001, TD-002; TD-004 for contract/integration tests; TD-012 for telemetry requirements. | Eventing/messaging ADR compliant with ADR-0002. | 5, when the first approved asynchronous flow is scoped. |
| TD-008 | Persistence | Provide tenant-scoped service-owned storage, repositories/adapters, migrations, isolation, security, testing, backup, and rollback without cross-service database access. | ADR-0001; ADR-0002; ADR-0004; ADR-0005; ADR-0006 | **Deferred**; required before a persistence driver, ORM, database configuration, or migration is introduced. Reserved infrastructure names are not selections. | TD-001, TD-002; TD-004 integration testing; an approved service data requirement. | Persistence ADR compliant with ADR-0002. | 5, before the first approved persistence adapter. |
| TD-009 | CI execution | Execute deterministic local checks in automation, define triggers, failure semantics, diagnostics, reports, and governed exceptions. | ADR-0006; TASK-006-08; `scripts/ci/README.md`; CURRENT_SPRINT.md | **Blocking next, not now**: blocks TASK-006-08 but must follow local TASK-006-07 enforcement. | TD-003 implemented locally; TD-001 and TD-002; additional suites from TD-004 as adopted. | CI execution/platform ADR or scoped technology decision compliant with ADR-0002. | 3, after the local architecture command exists. |
| TD-010 | Container and runtime packaging | Produce reproducible, secure runtime artefacts with ownership, configuration, supply-chain, compatibility, and rollback rules. | ADR-0002 prohibition on deployable containers; ADR-0006/TOOL-009; README Docker statement | **Deferred**; not needed for local architecture checks and required only before deployable packaging. | TD-001; application/service bootstrap; relevant security and operational requirements. | Runtime-packaging/container ADR compliant with ADR-0002. | 6, after a deployable unit exists. |
| TD-011 | Deployment platform and orchestration | Define environments, provisioning, workload orchestration, tenancy/security boundaries, release, rollback, recovery, and operational ownership. | ADR-0002; ADR-0006/TOOL-010; README and PROJECT_CONTEXT.md; reserved infrastructure directories | **Deferred**; required before cloud, orchestration, or deployable infrastructure is created. | TD-010; approved deployable topology; TD-012 operational requirements. | Deployment-platform ADR compliant with ADR-0002. | 7, after packaging and topology requirements are known. |
| TD-012 | Observability and monitoring | Define structured logs, metrics, traces, correlation/tenant handling, audit separation, redaction, alerting, retention, and operational verification without domain coupling. | ADR-0003 observable consumers; ADR-0004 logging/audit boundaries; ADR-0005 operational considerations; TOOL-008 and TOOL-011 | **Deferred as platform selection**, but observability requirements must be captured when APIs, consumers, persistence, or deployment are designed. Required before concrete telemetry/monitoring technology is installed. | Workload and operational requirements; informs TD-007, TD-010, and TD-011. | Observability/monitoring ADR compliant with ADR-0002. | Requirements alongside each workload; selection before operational implementation. |

## Minimum unblock set

The smallest decision set that permits the next implementation step is
TD-001, TD-002, and TD-003, in that order of dependency. Together they permit
a deterministic local architecture-check command for TASK-006-07. They do not
approve application runtime code, a framework, CI, persistence, deployment, or
any other deferred platform technology.

TASK-006-08 remains pending until the local mechanism is implemented and
verified. TD-009 can then decide how that existing command runs in CI; combining
CI selection into the minimum set would decide more than TASK-006-07 requires.

## Governance sequence

1. Prepare and approve TD-001 and TD-002 decision records with ADR-0002's
   alternatives, compatibility, operations, security, and rollback analysis.
2. Prepare and approve TD-003 against the resulting module and workspace model.
3. Implement and verify TASK-006-07 locally without adding application runtime
   behavior.
4. Decide TD-009 and complete TASK-006-08 using the proven local command.
5. Use the TASK-014 implementation of the approved TD-004 strategy for later
   behavior changes, then evaluate TD-005 through TD-012 only when an approved
   downstream scope makes each choice necessary.

## Audit conclusion

All current task statuses and all six accepted ADRs were reviewed. TD-004
approves the TOOL-003 through TOOL-006 strategy, and TASK-014 implements the
runner/configuration baseline with exact-pinned Vitest and its V8 coverage
provider. Smoke evidence covers execution, level discovery, deterministic
synthetic fixtures, a tenant-isolation assertion pattern, coverage, strict
TypeScript/ESM/NodeNext compatibility, frozen workspace installation, and TD-003
regression checks. It does not prove real adapters, product contracts, or
Tenant Onboarding behavior. Conditional and deferred technologies remain
unselected for installation as recorded in TD-004.
