# TASK-014 — TD-004 Testing Baseline Implementation

## Status

DONE

## Objective

Implement the executable testing baseline approved by TD-004 without adding
Tenant Onboarding business behavior or selecting deferred infrastructure.

## Scope

- Install exact development dependencies `vitest@4.1.11` and
  `@vitest/coverage-v8@4.1.11`.
- Preserve the unit, integration, contract, and fixture taxonomy under `tests/`.
- Add minimal deterministic Vitest configuration and stable root commands.
- Prove TypeScript, ESM, Node, NodeNext, strict TypeScript, workspace resolution,
  suite discovery, coverage, and tenant-aware fixture/isolation patterns.
- Preserve TD-003 architecture enforcement.
- Update TD-004 governance status only after all required verification passes.

## Out of scope

- Tenant Onboarding production behavior.
- Testcontainers installation or infrastructure adapters.
- Pact, browser E2E, performance, persistence, API framework, event broker, or
  CI-provider tooling.
- Organization-wide coverage thresholds.

## Dependencies

- Approved TD-004 testing strategy.
- Node.js `24.18.0`, pnpm `11.22.0`, TypeScript `6.0.3`, ESM and NodeNext baseline.
- Existing TD-003 architecture verification.

## Security and tenant constraints

- Use synthetic non-sensitive fixtures only.
- Require explicit tenant ownership and context.
- Do not use production data, customer data, credentials, live SaaS calls, or
  cross-tenant mutable global state.
- Tenant isolation remains a cross-cutting test concern, not a framework.

## Verification

- `node --version`
- `corepack pnpm --version`
- `corepack pnpm install --frozen-lockfile`
- `corepack pnpm test:unit`
- `corepack pnpm test:integration`
- `corepack pnpm test:contract`
- `corepack pnpm test`
- `corepack pnpm test:coverage`
- TypeScript verification for test/configuration files
- `corepack pnpm architecture:check`
- `corepack pnpm architecture:graph`
- `corepack pnpm typecheck:architecture-fixtures`
- `git diff --check`

## Acceptance criteria

- [x] Only the two TD-004-approved direct dependencies are exact-pinned.
- [x] Stable non-watch root test commands select the intended levels.
- [x] Infrastructure-free unit, integration, and contract smoke tests pass.
- [x] TypeScript, ESM, Node, strict NodeNext, and workspace compatibility pass.
- [x] Synthetic tenant fixtures require explicit ownership and are deterministic.
- [x] A smoke assertion demonstrates cross-tenant denial without business logic.
- [x] Coverage executes without invented thresholds.
- [x] Existing architecture commands continue to pass.
- [x] Governance reflects only the executable evidence actually proven.
- [x] No deferred tooling or product implementation is introduced.

## Execution result

Completed on 2026-08-23 against the exact approved local baseline:

- Node.js `v24.18.0`;
- pnpm `11.22.0`;
- TypeScript `6.0.3` with strict ESM/NodeNext configuration;
- Vitest and `@vitest/coverage-v8` `4.1.11` exact-pinned.

Verification passed:

- frozen workspace installation across all three declared workspace projects;
- unit: 1 file, 3 tests;
- integration: 1 file, 1 test;
- contract: 1 file, 1 test;
- aggregate: 3 files, 5 tests;
- V8 fixture coverage: 60% statements, 75% branches, 100% functions, 60% lines;
- test/configuration TypeScript check;
- architecture check, dependency graph, and architecture-fixture typecheck.

The Windows execution sandbox initially denied Vitest/Vite and architecture
child-process probes with `EPERM`; the unchanged commands passed outside that
sandbox. No approved constraint was weakened. Coverage is smoke evidence only,
and no organization-wide threshold was established.

## Related

- ADR-0002 through ADR-0006
- TD-004
- TOOL-003 through TOOL-006
- TASK-012
- TASK-013
