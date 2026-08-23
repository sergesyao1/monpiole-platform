# tools/quality

## Purpose

Quality automation tools.

## Ownership

Quality Engineering owns this area and approves changes affecting its responsibilities.

## Conventions

Produce deterministic output suitable for CI and clear actionable diagnostics.

## Expected contents

Static analysis, dependency checks, and quality-report tooling.

## Architecture verification

The repository uses the approved TD-003 control model: native strict TypeScript
and ESM resolution, pnpm workspace and export-map checks, dependency-cruiser for
the import graph and cycles, and repository-owned policy diagnostics.

Exact versions assessed on 2026-08-23 and pinned before installation:

- Node.js: local supported release `24.18.0` (minimum declared: Node.js 24);
- pnpm: `11.22.0`;
- TypeScript: `6.0.3` (latest stable release within dependency-cruiser's
  supported `<7.0.0` compiler API range);
- dependency-cruiser: `18.2.0`.

The direct tools are exact-pinned, use compatible Node.js engine ranges, and are
published under Apache-2.0 (TypeScript) and MIT (dependency-cruiser) licenses.
The shared lockfile records integrity hashes. Dependency-cruiser 18.2.0 does not
support TypeScript 7.0.x; the checker fails closed if its TypeScript transpiler is
unavailable or incompatible. Advisory and provenance automation remains outside
this task and must be selected through the applicable technology gate.

Run locally from the repository root:

```text
corepack pnpm install --frozen-lockfile
corepack pnpm architecture:check
```

The command checks workspace declarations, exact internal `workspace:` edges,
public export targets, Node/TypeScript/dependency-cruiser resolver agreement,
forbidden imports, Clean Architecture layer direction, cycles, service internals,
core/shared restrictions, and application boundaries. Synthetic fixtures prove
both an allowed package-export import and deterministic diagnostics for every
static rule category.

| ADR-0005/0006 rule | Deterministic control |
| --- | --- |
| Domain and application dependency direction | `domain-does-not-depend-on-outer-layers`, `domain-does-not-depend-on-external-technology`, and `application-does-not-depend-on-adapters` |
| Circular dependencies | `no-circular-dependencies` over the complete source graph |
| Cross-service internals and owned data | Per-service `no-*-to-other-service-internals` and `no-*-to-other-service-data` rules |
| `packages/core` and reusable package boundaries | Core/owned-boundary rules plus rejection of relative package-source imports |
| `packages/shared` domain neutrality | Service-edge rejection plus mandatory semantic owner review |
| Application composition boundaries | Service-internal and relative package-source import rejection |
| Workspace and public surface integrity | Manifest identity, membership, `workspace:`, explicit recursive export-target, TypeScript, Node, and resolver-equivalence checks |
| Actionable deterministic failures | Stable rule IDs, repository-relative sorted paths, owner boundary, reason, dependency chain when available, and remediation hint |

No blanket exception baseline is supported. Any future exception must be narrowly
scoped, owner-approved, justified, time-bounded, and reviewed as a
security-sensitive rule change.

Static imports cannot prove semantic ownership or runtime behaviour. Review and
later integration/runtime tests must still detect business logic merely copied
into `packages/shared`, dynamically constructed access, network calls, and direct
database access that is not represented by an import edge.

## CI integration strategy

The local command is the stable CI entry point. TASK-006-08 may run a frozen
installation followed by `pnpm architecture:check`, fail on any non-zero exit,
and retain the text diagnostics. Selecting or configuring a CI technology remains
outside this task and gated by TD-009.
