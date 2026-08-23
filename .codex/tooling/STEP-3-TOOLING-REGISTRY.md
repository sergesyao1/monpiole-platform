# STEP 3 — TOOLING REGISTRY

> Initial tooling registry derived from the currently available ADRs.
> Current source scope: ADR-0005 and ADR-0006.
> Project ADR scope is ADR-0001 → ADR-0006. No ADR beyond ADR-0006 is part of the current repository baseline.
> TOOL-* identifies a tooling requirement/capability, NOT a selected technology.

## Registry Status

- Status: INITIAL
- Source ADRs available: ADR-0005, ADR-0006
- Project ADR scope: ADR-0001 → ADR-0006
- Technology selection performed: NO
- Technology installation performed: NO

## TOOL Registry

| TOOL-ID | Name | Purpose | ADR-REF | Requirement-REF | Selection | Baseline | Gate |
|---|---|---|---|---|---|---|---|
| TOOL-001 | Architecture Dependency Checking | Detect forbidden dependencies, circular dependencies and architectural boundary violations. | ADR-0005, ADR-0006 | REQ-0005, REQ-0017, REQ-0018, REQ-0051 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-002 | Architecture Testing | Verify Clean Architecture, domain independence and architectural rules. | ADR-0005, ADR-0006 | REQ-0017, REQ-0018, REQ-0040 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-003 | Unit Testing | Execute isolated tests of business rules without external infrastructure. | ADR-0005, ADR-0006 | REQ-0006, REQ-0013, REQ-0014 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-004 | Integration Testing | Verify technical adapters and their infrastructure dependencies. | ADR-0005, ADR-0006 | REQ-0015, REQ-0016 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-005 | Contract Testing | Verify explicit contracts between independently bounded components. | ADR-0005, ADR-0006 | REQ-0019 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-006 | Tenant Isolation Testing | Verify tenant isolation and tenant-aware application behavior. | ADR-0005 | REQ-0020 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-007 | Static Analysis | Identify code-level violations and support deterministic quality checks. | ADR-0005, ADR-0006 | REQ-0001, REQ-0002, REQ-0049 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-008 | Observability Tooling | Support logging, metrics and tracing without coupling domain code to infrastructure. | ADR-0005, ADR-0006 | REQ-0011, REQ-0038, REQ-0039 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-009 | Container Tooling | Provide the tooling capability required for container-oriented architecture. | ADR-0006 | REQ-0036 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-010 | Orchestration Tooling | Provide tooling capability for service orchestration. | ADR-0006 | REQ-0037 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-011 | Monitoring Tooling | Support monitoring and operational verification. | ADR-0006 | REQ-0038 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |
| TOOL-012 | Package and Dependency Management | Manage project packages and dependency boundaries. | ADR-0006 | REQ-0050, REQ-0057 | NOT_SELECTED | NOT_BASELINED | ADR-0002 |

## Tooling Decision Rules

- No concrete technology is selected by this registry.
- No package or dependency is installed by this registry.
- Candidate technologies require evaluation against ADR-0002.
- Selection requires problem definition, alternatives, compatibility analysis, operational impact, security analysis, and migration/rollback considerations.
- Selected technologies must be baselined before implementation.

## STEP 3 Gate

- [x] TOOL identifiers are distinct from concrete technology names.
- [x] No technology is considered selected.
- [x] Each initial TOOL has an ADR source.
- [x] Initial TOOLs have requirement references.
- [x] Current project ADR scope is explicitly ADR-0001 → ADR-0006.
- [ ] Final tooling baseline is established.
- [ ] Technology selections have passed ADR-0002.
