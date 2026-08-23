# STEP 3 — TOOLING REGISTRY

> Initial tooling registry derived from the currently available ADRs.
> Current source scope: ADR-0005 and ADR-0006.
> Project ADR scope is ADR-0001 → ADR-0006. No ADR beyond ADR-0006 is part of the current repository baseline.
> TOOL-* identifies a tooling requirement/capability, NOT a selected technology.

## Registry Status

- Status: PARTIALLY_BASELINED
- Source ADRs available: ADR-0005, ADR-0006
- Project ADR scope: ADR-0001 → ADR-0006
- Technology selection performed: YES — TD-004 scope only in this registry update
- Technology installation performed: YES — Vitest baseline only through TASK-014

## TOOL Registry

| TOOL-ID | Name | Purpose | ADR-REF | Requirement-REF | Selection | Baseline | Gate |
|---|---|---|---|---|---|---|---|
| TOOL-001 | Architecture Dependency Checking | Detect forbidden dependencies, circular dependencies and architectural boundary violations. | ADR-0005, ADR-0006 | REQ-0005, REQ-0017, REQ-0018, REQ-0051 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-002 | Architecture Testing | Verify Clean Architecture, domain independence and architectural rules. | ADR-0005, ADR-0006 | REQ-0017, REQ-0018, REQ-0040 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-003 | Unit Testing | Execute isolated tests of business rules without external infrastructure. | ADR-0005, ADR-0006 | REQ-0006, REQ-0013, REQ-0014 | VITEST_4.1.11 | RUNNER_BASELINED_TASK-014 | TD-004 APPROVED |
| TOOL-004 | Integration Testing | Verify technical adapters and their infrastructure dependencies. | ADR-0005, ADR-0006 | REQ-0015, REQ-0016 | VITEST_4.1.11_WITH_REPOSITORY_FIXTURES | RUNNER_AND_DISCOVERY_BASELINED; REAL_ADAPTERS_PENDING; TESTCONTAINERS_CONDITIONAL | TD-004 APPROVED |
| TOOL-005 | Contract Testing | Verify explicit contracts between independently bounded components. | ADR-0005, ADR-0006 | REQ-0019 | REPOSITORY_COMPATIBILITY_TESTS_WITH_VITEST_4.1.11 | RUNNER_AND_PATTERN_BASELINED; API_EVENT_CONTRACTS_PENDING | TD-004 APPROVED |
| TOOL-006 | Tenant Isolation Testing | Verify tenant isolation and tenant-aware application behavior. | ADR-0005 | REQ-0020 | CROSS_CUTTING_VITEST_FIXTURE_ASSERTION_CONCERN | FIXTURE_AND_ASSERTION_PATTERN_BASELINED; PRODUCT_ISOLATION_PENDING | TD-004 APPROVED |
| TOOL-007 | Static Analysis | Identify code-level violations and support deterministic quality checks. | ADR-0005, ADR-0006 | REQ-0001, REQ-0002, REQ-0049 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-008 | Observability Tooling | Support logging, metrics and tracing without coupling domain code to infrastructure. | ADR-0005, ADR-0006 | REQ-0011, REQ-0038, REQ-0039 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-009 | Container Tooling | Provide the tooling capability required for container-oriented architecture. | ADR-0006 | REQ-0036 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-010 | Orchestration Tooling | Provide tooling capability for service orchestration. | ADR-0006 | REQ-0037 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-011 | Monitoring Tooling | Support monitoring and operational verification. | ADR-0006 | REQ-0038 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-012 | Package and Dependency Management | Manage project packages and dependency boundaries. | ADR-0006 | REQ-0050, REQ-0057 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |

## Tooling Decision Rules

- Concrete technology may appear only after an ADR-0002-compliant decision and
  verified implementation; TD-004/TASK-014 provide that evidence for TOOL-003
  through TOOL-006 only.
- Registry status does not authorize additional package installation.
- Candidate technologies require evaluation against ADR-0002.
- Selection requires problem definition, alternatives, compatibility analysis, operational impact, security analysis, and migration/rollback considerations.
- Selected technologies must be baselined before implementation.

## STEP 3 Gate

- [x] TOOL identifiers are distinct from concrete technology names.
- [x] Selected technology is linked to an approved ADR-0002 decision and
  executable evidence.
- [x] Each initial TOOL has an ADR source.
- [x] Initial TOOLs have requirement references.
- [x] Current project ADR scope is explicitly ADR-0001 → ADR-0006.
- [ ] Final tooling baseline is established.
- [x] Recorded TD-004 technology selections have passed ADR-0002.
