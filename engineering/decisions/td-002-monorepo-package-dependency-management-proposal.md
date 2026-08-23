# TD-002: Monorepo, package, and dependency management

- Decision ID: TD-002
- Status: **APPROVED**
- Decision area: Monorepo, package, and dependency management
- Governing decision: ADR-0002
- Date: 2026-08-23

## Problem statement

MonPiole needs a deterministic way to discover owned units under `apps/`,
`services/`, and `packages/`; declare and link their dependencies; expose stable
module surfaces; and run package scripts locally and in CI. The mechanism must make
the dependency graph inspectable without weakening the ownership, Clean
Architecture, bounded-context, API/event, or tenant rules established by ADR-0001
through ADR-0006.

The repository currently contains boundary documentation and placeholder
directories only. It has no package manifests, workspace configuration, dependency
lockfile, runtime source, or installed monorepo technology. TD-001 proposes Node.js,
strict TypeScript, and native ESM, but remains PROPOSED. This decision therefore
evaluates that compatibility without treating TD-001 as approved.

## Context and evidence baseline

The analysis reviewed:

- ADR-0001 through ADR-0006;
- `engineering/decisions/technology-decision-inventory.md`;
- the PROPOSED TD-001 runtime/language/module-system decision;
- the root, `apps/`, `services/`, and `packages/` documentation;
- all current first-level directories under those three owned areas; and
- official documentation for the evaluated package managers and orchestrators.

No measured build duration, CI duration, package count under implementation, remote
cache requirement, publishing requirement, team-skill profile, or release-frequency
evidence exists yet. Those omissions rule out claiming that an orchestration layer
or integrated monorepo platform is currently necessary.

## Requirements and comparison criteria

The selected approach must, once separately approved for implementation:

1. discover explicit workspace roots below `apps/`, `services/`, and `packages/`
   without making every directory a package;
2. use one reviewed, committed lockfile and reject drift during CI installation;
3. link internal packages only through declared workspace dependencies;
4. fail rather than silently resolve an intended internal dependency from a public
   registry;
5. support filtered and recursive script execution with dependency-aware ordering;
6. expose a machine-readable workspace dependency graph for TD-003 and CI;
7. support explicit ESM public exports and TypeScript declaration surfaces if TD-001
   is accepted;
8. permit independently owned and deployable services without cross-service deep
   imports or shared persistence models;
9. minimize dependency, plugin, configuration, cache, and credential surface;
10. support controlled dependency updates, auditability, and rollback; and
11. remain replaceable if TD-001 is rejected or operational evidence changes.

The comparison weighs boundary fit, reproducibility, workspace linking, dependency
version alignment, ESM/TypeScript compatibility, graph visibility, script execution,
CI and caching, supply-chain controls, migration/rollback, and operational cost.
Popularity is not a criterion.

## Candidates

Package management and task orchestration are separate decisions:

### Package-manager candidates

- **A. pnpm with native workspaces.** A dedicated workspace definition, one shared
  lockfile by default, strict dependency visibility, the `workspace:` protocol,
  catalogs for centrally declared version ranges, recursive filtering, and frozen
  lockfile installation.
- **B. npm with native workspaces.** The runtime-distributed package manager, root
  workspace discovery, automatic local linking, `package-lock.json`, `npm ci`, and
  workspace-scoped script execution.
- **C. Yarn with native workspaces.** The `workspace:` protocol, immutable installs,
  focused/recursive execution, constraints, and a choice between `node_modules` and
  Plug'n'Play/zero-install operating models.

### Orchestration alternatives

- **O0. No separate orchestrator.** Use native workspace filtering and scripts,
  with TD-003 providing architecture checks.
- **O1. Add a focused task orchestrator such as Turborepo.** Gain an explicit task
  graph, input/output-aware local caching, affected execution, and optional remote
  caching while leaving package management to pnpm/npm/Yarn.
- **O2. Adopt an integrated monorepo platform such as Nx.** Gain project inference,
  a project/task graph, affected execution, caching, generators, and plugins, with a
  larger configuration and governance surface.
- **O3. Adopt an enterprise package/release layer such as Rush.** Gain centrally
  governed projects, dependency policies, phased commands, change/version workflows,
  and pnpm integration, at significant process and configuration cost.

Lerna and Changesets are not package managers. They may later address publishing or
versioning if MonPiole approves a multi-package release requirement; no such
requirement exists today.

## Comparative package-manager analysis

| Criterion | pnpm workspaces | npm workspaces | Yarn workspaces |
| --- | --- | --- | --- |
| Reproducible install | One shared YAML lockfile by default; frozen install rejects drift | Committed `package-lock.json`; `npm ci` performs clean lockfile-based installs | Committed lockfile; immutable install rejects changes; optional checked-in cache |
| Internal linking | `workspace:` can require local resolution and prevent registry fallback | Auto-links declared workspaces, generally using ordinary version ranges | `workspace:` requires a workspace reference and is converted for publication |
| Dependency visibility | Strict linked layout exposes only declared dependencies by default | Familiar hoisted `node_modules` can allow undeclared access unless separately checked | Plug'n'Play is strict; `node_modules` mode is more compatible but less intrinsically strict |
| Version alignment | Catalogs centralize common ranges; policy checks can be added | Overrides and review/automation are available, but no equally direct native workspace catalog | Constraints can enforce shared ranges and manifest policy |
| Workspace execution | Recursive commands and expressive dependency/dependent/path filters | Workspace selection and script execution, with less graph-oriented filtering | `workspaces foreach`, topological/parallel/changed selection, and focused installs |
| ESM and TypeScript | Compatible with Node resolution; strict layout reveals undeclared imports early | Maximum default ecosystem compatibility | Compatible, but Plug'n'Play can require editor/tool integration and compatibility work |
| Operational surface | One package manager plus a workspace file; content-addressed shared store | Smallest adoption delta when Node ships npm | More policy power, but linker/cache choices add decisions and onboarding |
| Main risk | Symlink/strict-layout assumptions can expose incompatible dependencies or tools | Hoisting can hide missing declarations; weaker internal-local intent signal | Plug'n'Play and zero-install choices can expand compatibility and repository complexity |

### Package-manager recommendation

**Propose pnpm with native workspaces if and only if TD-001 is accepted.** Its
explicit `workspace:` references and strict dependency visibility best support the
existing ownership boundaries, while a shared lockfile, frozen installation,
filters, and catalogs cover the present reproducibility and version-alignment needs
without another platform.

npm is the preferred low-complexity fallback if implementation trials show that a
required tool cannot operate correctly with pnpm's linked layout and the exception
cannot be isolated. Yarn remains credible where built-in manifest constraints are
more valuable than the additional linker/cache policy surface. Neither alternative
currently provides enough net benefit to displace pnpm for the proposed TD-001
baseline.

If TD-001 is rejected, this recommendation is automatically returned to PROPOSED
review. A .NET or JVM baseline should use its native project/build dependency model;
pnpm may still be evaluated independently for browser-only work, but must not become
the repository-wide manager by implication.

## Workspace analysis

Workspace membership should be explicit and limited to implemented units. The root
patterns may cover immediate children of `apps/`, `services/`, and `packages/`, but
a placeholder README directory must not become a package until an approved
implementation task gives it a manifest, owner, purpose, and public surface.

Each workspace must declare a unique scoped name, ownership, package manager/runtime
compatibility, scripts it actually implements, and every direct dependency. Internal
package dependencies must use the `workspace:` protocol. File-path aliases and
undeclared source-relative imports across workspace roots are prohibited.

Workspace membership is not architectural permission. In particular:

- an app may compose stable package surfaces and service APIs;
- a service may not import another service's domain, application, infrastructure,
  persistence, or private source;
- shared packages must remain domain-neutral and must not become a shared domain or
  persistence layer;
- API and event packages expose versioned wire contracts, not internal models; and
- each service keeps its data and deployability boundary.

## Monorepo orchestration analysis

**A separate monorepo orchestration technology is not necessary for the initial
baseline. Select O0: package manager with native workspace support only.** Native
pnpm filtering and recursive scripts are sufficient for the current documented
repository, and there are no task-duration or cache measurements demonstrating a
need for another execution engine.

TD-003 is not replaced by orchestration. It must analyze manifests, public exports,
resolved ESM/TypeScript imports, cycles, layers, and forbidden cross-context edges.
A task graph shows declared execution relationships; it does not prove Clean
Architecture, ownership, tenant isolation, or contract compatibility.

Reconsider O1 only when measurements show repeated multi-package tasks materially
dominate local or CI time, and when task inputs/outputs are deterministic enough for
safe caching. A focused orchestrator is preferable to O2 or O3 for that isolated
need. Reconsider Nx only if project inference, generators, and an integrated graph
are approved requirements that outweigh plugin/configuration coupling. Reconsider
Rush only if coordinated publishing, change files, or enterprise dependency policy
becomes an approved requirement. Each addition requires a new or superseding
ADR-0002-compliant decision.

## Dependency resolution and reproducibility

After approval, implementation should establish:

- one exact package-manager version mediated by the runtime's supported manager
  launcher or another explicitly approved bootstrap mechanism;
- one root shared lockfile, committed and reviewed with every dependency change;
- frozen-lockfile installation in CI, builds, and release jobs;
- no mixed package-manager lockfiles and no unreviewed lockfile regeneration;
- `workspace:` for all internal package edges and failure on missing/mismatched local
  packages;
- centrally aligned ranges for common tooling through catalogs where alignment is
  necessary, without forcing runtime libraries to share versions without reason;
- explicit registry configuration and no dependency names that can be confused with
  public packages; and
- caches treated only as accelerators: a cold install from the lockfile remains the
  reproducibility test.

Lockfiles pin resolution but do not guarantee identical runtime behavior across
operating systems, CPU architectures, native binaries, runtime versions, registry
mutation, or lifecycle scripts. CI must pin the execution environment separately,
record supported platforms, and verify produced artifacts. Offline or mirrored
installation may later reduce registry availability risk, but selecting a registry
mirror or artifact service is outside TD-002.

## Package and public-export strategy

If TD-001 is accepted, every consumed first-party workspace should expose an
explicit `exports` map and, where applicable, a declaration surface. Consumers use
the package name and exported subpaths only. They must not import `src/`, build
directories, relative paths outside their workspace, or unexported internals.

Public surfaces should be deliberately small, condition names should match the
approved native-ESM runtime/build model, and runtime and type entry points must agree.
Published packages require an explicit files/artifact policy and a package-content
inspection before release. Public APIs, SDKs, and event schemas are compatibility
commitments under ADR-0003; changes are additive by default, and breaking changes
need versioning, migration guidance, and contract verification.

Package exports provide encapsulation but are not a complete security or
architecture boundary. TD-003 must reject deep imports, forbidden workspace edges,
cycles, cross-service internals, and outward Clean Architecture dependencies by
resolving the same module semantics used by the approved compiler and runtime.

## Security and supply-chain considerations

The implementation and update policy must:

- minimize direct and transitive dependencies and justify new packages;
- use least-privilege, short-lived registry credentials and never persist secrets in
  manifests, lockfiles, configuration, logs, or caches;
- review lockfile changes, package provenance/integrity metadata, maintainers,
  licenses, advisories, abandonment, and transitive growth;
- disable or tightly control dependency lifecycle scripts during acquisition, then
  allow-list documented packages that demonstrably require builds;
- prevent dependency confusion with a controlled internal scope and explicit
  registry routing;
- run advisory, license, secret, and provenance checks selected by later governed
  tasks; no specific scanner is approved here;
- protect update automation with minimal permissions, review, tests, and bounded
  grouping rather than automatic merge; and
- treat caches and build outputs as untrusted inputs across trust boundaries.

The package manager reduces accidental undeclared dependencies; it does not validate
package intent, eliminate malicious releases, or enforce tenant and authorization
rules. A frozen compromised lockfile remains compromised.

## Dependency update strategy

Routine updates should be small, reviewed, and grouped only where packages share a
real compatibility constraint. Security updates receive expedited review but still
run deterministic install, type/build, architecture, test, and artifact checks that
exist at that time. Major updates require migration notes and rollback evidence.

Catalogs should align shared tooling and deliberately singleton libraries. They
must not create repository-wide coupling between independently deployable services.
Public/internal library versions follow compatibility needs; applications and
private services need not be published merely because they are workspaces.

## Local development and CI implications

The baseline should expose a small set of stable root commands that delegate to
workspace-owned scripts. Developers can filter by unit and include its dependency
closure. Scripts must be deterministic, independently runnable, and fail when a
requested target is missing where CI expects it.

CI should start with a cold, frozen install and full required checks. Filtered or
changed-only execution is an optimization only after the dependency/change model is
verified; periodic full runs must detect missed edges. Cache keys must include the
lockfile, package-manager/runtime versions, relevant manifests/configuration,
platform, command, and declared inputs. Security-sensitive or nondeterministic tasks
must not restore untrusted outputs. Remote caching is not selected by this proposal.

## Architecture-enforcement implications and TD-003 dependency

TD-003 depends on the approved TD-001/TD-002 module and workspace semantics. It must
prove, locally before CI integration, that it can:

- discover the same workspace set as the package manager;
- inspect declared production, development, optional, and peer dependency edges;
- resolve native ESM exports and TypeScript source/build mappings accurately;
- reject undeclared dependencies, deep imports, forbidden layer directions,
  cross-service internals, cross-service persistence, and cycles;
- distinguish allowed versioned contract consumption from shared domain coupling;
- provide actionable paths and owners for violations; and
- detect graph/config drift deterministically.

pnpm's graph and strict layout are useful evidence but not sufficient enforcement.
If TD-003 cannot model the approved pnpm/ESM/TypeScript resolution exactly, runtime
bootstrap remains blocked until TD-001/TD-002 are revised or the architecture-check
approach is changed through governance.

## Operational impact

The proposal adds one future package-manager executable, one workspace definition,
one root lockfile, and per-unit manifests. A shared content-addressed store can reduce
local disk/network duplication. Strict dependency visibility may initially reveal
incorrect third-party assumptions, which is useful but can require isolated fixes.

Without an orchestrator, teams avoid a second task DSL, daemon, remote-cache service,
credential flow, plugin lifecycle, and cache debugging. The trade-off is less
cross-task caching and visualization until evidence justifies them. Native commands
and a simple manifest graph remain portable and easier to replace.

## Migration strategy

There is no technical baseline to migrate. After architecture-owner approval of
compatible TD-001 and TD-002 decisions, a separate governed implementation task
should:

1. pin the approved runtime and package-manager versions;
2. create the minimum root manifest, workspace definition, and shared lockfile;
3. convert only approved, implemented units into workspaces;
4. prove frozen installation from a clean environment;
5. add one synthetic, non-business workspace dependency fixture with explicit ESM
   exports and declarations;
6. complete TD-003 and prove allowed/forbidden edges against that fixture;
7. document stable local commands, update/security ownership, and CI prerequisites;
8. introduce CI execution only through its separately approved decision/task; and
9. review measured install/task performance before considering orchestration.

Every step must be independently reviewable. No framework, test tool, scanner,
registry service, release tool, remote cache, or runtime source is implied.

## Rollback strategy

Before implementation, rollback is rejection or withdrawal of this proposal; the
documentation-only repository remains unchanged. During the isolated bootstrap,
rollback is a normal reviewed removal of the newly introduced manifests, workspace
definition, lockfile, and synthetic fixture, returning to the documentation-only
baseline.

After real workspaces exist, migration to npm or Yarn should be staged: freeze
dependency changes, inventory workspace edges and package-manager-specific features,
generate the replacement lockfile in an isolated reviewed change, validate clean
installs and all available checks on supported platforms, switch CI only after
equivalence, and remove old configuration last. Preserve manifests, public exports,
versions, and wire contracts. Never maintain two authoritative lockfiles.

## Major risks and mitigations

| Risk | Mitigation / decision gate |
| --- | --- |
| PROPOSED recommendation mistaken for approval | Require architecture-owner acceptance and a separate implementation task |
| TD-001 is rejected or changed | Return TD-002 to review; use the selected runtime's native dependency model |
| Workspace convenience erodes service ownership | Explicit exports plus TD-003 manifest/import checks; prohibit cross-service internals |
| Strict linked layout breaks a required tool | Prove with a minimal fixture; isolate or reconsider npm rather than disabling boundary checks globally |
| Lockfile is treated as a security guarantee | Review provenance, scripts, advisories, licenses, registries, and artifacts independently |
| Central version alignment couples services | Align only tooling/singletons with demonstrated compatibility needs |
| Filtered CI misses affected work | Begin with full checks; validate change detection and retain periodic full runs |
| Caching returns stale or hostile outputs | Cache only deterministic declared outputs; complete cold checks; scope trust and credentials |
| Orchestration is added prematurely | Require measured task-time/cache evidence and a superseding ADR-0002 decision |
| Publishing requirements emerge later | Decide release/version tooling separately; do not preinstall it |
| Team skills and supported platforms are unknown | Validate during implementation planning and block rollout where evidence is absent |

## Consequences

Positive consequences are explicit local dependency intent, strict declared
dependency visibility, one deterministic resolution record, efficient filtered
workspace commands, and a small initial tool surface compatible with proposed native
ESM/TypeScript. The approach preserves standard package manifests and can later feed
TD-003 or a justified task orchestrator.

Negative consequences are adoption of a package manager not bundled as Node's
historical default, symlink/layout compatibility work for some tools, a dedicated
workspace configuration file, and the continued absence of task-output caching.
Catalog and filter conventions need governance. Package boundaries and exports still
require active architecture enforcement.

Choosing no orchestrator keeps current operations simple but deliberately postpones
remote caching, advanced affected analysis, and integrated project visualization.
That is an acceptable consequence until repository scale and measurements establish
their value.

## Recommendation and rationale

Subject to acceptance of TD-001, **adopt option 1: pnpm as the package manager with
native workspace support, and do not adopt a separate monorepo orchestration layer
at baseline**.

This is the smallest approach that meets current requirements. pnpm supplies strict
declared dependency access, explicit internal-only workspace references, one shared
lockfile, deterministic frozen installation, version catalogs, and graph-aware
filtering. A second task engine would add operational and supply-chain surface
without evidenced need. Nx/Rush-style integration would additionally combine
concerns that MonPiole can presently keep separate.

The recommendation remains **PROPOSED**. It approves no technology, installation,
configuration, manifest, lockfile, or runtime code.

## Compatibility with proposed TD-001

pnpm manages Node package manifests and is compatible with native ESM package
exports and TypeScript build/declaration workflows. Its strict layout helps expose
undeclared imports that would undermine TD-001 and ADR-0005/0006. The package manager
does not choose TypeScript compiler settings, runtime versions, ESM conditions,
frameworks, build tools, test tools, or runtime validation.

TD-001 and TD-002 must be accepted together or revised together for implementation.
Neither proposal silently approves the other. If the final runtime/module decision
is not Node/TypeScript/ESM, TD-002's package-manager recommendation must be
re-evaluated before any repository-wide initialization.

## Dependencies on TD-003

TD-002 defines the proposed dependency declarations and resolution surface that
TD-003 must analyze. TD-003 remains blocked until compatible TD-001 and TD-002
outcomes are approved. Conversely, runtime/package bootstrap must remain limited to
a synthetic fixture until TD-003 proves that accepted architecture rules are
technically enforceable. Documentation acceptance is not technical enforcement.

## Approval gate

The architecture owner must explicitly accept, reject, or request revision. Approval
must confirm:

- pnpm as the package manager if TD-001 is accepted;
- one shared committed lockfile and frozen CI installation;
- explicit `workspace:` internal edges and explicit ESM public exports;
- no separate orchestration layer at baseline;
- the evidence threshold for reconsidering Turborepo, Nx, Rush, or release tooling;
- supply-chain, update, migration, and rollback controls; and
- coordination with TD-001 and TD-003.

Until that approval and a separately authorized implementation task, ADR-0002
continues to block installation, manifests, workspace configuration, lockfiles,
dependencies, runtime source, and technical enforcement claims.

## References

1. pnpm, [Workspace](https://pnpm.io/workspaces).
2. pnpm, [Install](https://pnpm.io/cli/install).
3. pnpm, [Catalogs](https://pnpm.io/catalogs).
4. npm, [Workspaces](https://docs.npmjs.com/cli/using-npm/workspaces/).
5. npm, [`package-lock.json`](https://docs.npmjs.com/cli/configuring-npm/package-lock-json/).
6. npm, [`npm ci`](https://docs.npmjs.com/cli/commands/npm-ci/).
7. Yarn, [Workspaces](https://yarnpkg.com/features/workspaces).
8. Yarn, [Constraints](https://yarnpkg.com/features/constraints).
9. Yarn, [`yarn install`](https://yarnpkg.com/cli/install).
10. Turborepo, [Running tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks).
11. Nx, [Run tasks](https://nx.dev/docs/features/run-tasks).
12. Rush, [Introduction](https://rushjs.io/pages/intro/welcome/).
13. Node.js, [Package entry points](https://nodejs.org/api/packages.html#package-entry-points).
14. TypeScript, [Modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference).
## Architecture owner approval

Approved on 2026-08-23.

The architecture owner explicitly approves this technology decision after
coordinated review of TD-001 and TD-002.

Approval authorizes this decision as an architectural baseline subject to the
constraints, dependencies, security controls, migration strategy, rollback
strategy, and implementation gates documented above.

Approval does not by itself authorize uncontrolled repository initialization or
bypass TD-003 architecture-enforcement requirements.
