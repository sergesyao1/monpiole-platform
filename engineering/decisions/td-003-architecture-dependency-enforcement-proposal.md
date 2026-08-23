# TD-003: Architecture dependency checking and enforcement

- Decision ID: TD-003
- Status: **APPROVED**
- Date: 2026-08-23
- Governing decision: [ADR-0002](../adr/0002-technology-selection-gate.md)
- Decision owner: Architecture owner
- Scope: Decision proposal only; no checker, dependency, manifest, lockfile, or CI workflow is installed or configured

## Problem statement and context

ADR-0005 and ADR-0006 define inward Clean Architecture dependencies, bounded-context
ownership, service-owned data, domain-neutral packages, explicit public contracts,
and reproducible architecture checks. TASK-006-07 and TASK-006-08 remain blocked
because these rules are documented but not technically enforced.

The approved execution baseline is TD-001 (Node.js, strict TypeScript, native ESM)
and TD-002 (pnpm native workspaces, one committed lockfile, frozen CI installation,
and no initial orchestration layer). TD-003 must therefore model the same source,
module, package-export, and workspace semantics rather than accepting a simplified
graph that can disagree with the compiler, Node.js, or pnpm.

The repository currently contains documentation placeholders only: there are no
manifests, lockfiles, runtime sources, architecture-check configuration, or CI
workflows. This proposal recommends a future control stack. It does not approve or
implement it.

## Evidence reviewed

The analysis reviewed:

- ADR-0001 through ADR-0006;
- approved TD-001 and TD-002, including their architecture-owner approvals;
- TASK-006-07 and TASK-006-08;
- the root engineering contract and the `apps/`, `services/`, `packages/`,
  `packages/core`, `packages/shared`, and `tools/quality` guidance;
- the current seven service boundaries and the package/application placeholders;
- TypeScript's official Node module-resolution and package-exports documentation;
- pnpm's official workspace and filtering documentation;
- dependency-cruiser's rules and options documentation;
- ESLint's configuration model and the documented capabilities of import-boundary
  plugins; and
- Madge's documented dependency-graph and cycle-detection capability.

The tool comparisons describe capabilities published by their maintainers. Fit,
complexity, and residual-risk conclusions are engineering assessments against the
MonPiole rules. A future implementation task must pin and validate exact versions;
this decision does not select a version.

## Architecture rules and control mapping

| Rule | Primary future control | Supporting control | Static limit |
| --- | --- | --- | --- |
| Domain must not depend on Infrastructure, Interfaces, frameworks, database drivers, or provider SDKs | Source import graph with forbidden path/package rules | strict TypeScript compilation | Reflection, generated loading, and runtime plugin resolution require tests/review |
| Application must not depend on concrete Infrastructure where a port is required | Source import graph and layer rules | architecture fixtures and code review | Whether an abstraction is semantically required cannot be inferred from paths alone |
| No service may import another service's internals | Source graph path rules | package `exports`, workspace manifest audit | Network or dynamically constructed access is outside an import graph |
| No service may access another service's persistence | Reject imports of another service's persistence/migrations/adapters and reject forbidden manifest edges | integration/security tests and infrastructure review | Shared credentials, connection strings, SQL text, or runtime routing cannot be proved absent by import analysis |
| `packages/core` must not depend on apps, services, or infrastructure adapters | Source and workspace graph rules | package exports and manifest audit | Dynamically loaded code remains outside the static graph |
| `packages/shared` must remain domain-neutral | Reject edges from shared to services and service-owned packages | ownership review and semantic code review | A graph cannot determine whether copied or newly written logic is service-specific business logic |
| Apps compose transports and public contracts but do not own service business logic or persistence | App-to-internal/persistence import rules | architecture tests and ownership review | The business meaning of app-local code is not statically decidable |
| Public packages and contracts expose only approved entry points | Node/TypeScript-compatible `exports` plus deep-import checks | package-content and contract tests | Exports do not prove API/event compatibility or prevent copied models |
| Workspace dependencies must be declared, use approved internal references, and follow ownership rules | pnpm workspace manifest audit | frozen install and source graph | Workspace membership itself is not architectural permission |
| Circular dependencies are forbidden at module, package, service, and layer group levels | Source graph cycle rules and collapsed workspace/group graph tests | compiler build graph | Type-only versus runtime cycles need distinct diagnostics; distributed runtime cycles need integration/operational analysis |

Static checks can prove only relationships represented in parsed imports, exports,
manifests, and declared configuration. Runtime authorization, tenant propagation,
data ownership in deployed credentials, API/event compatibility, idempotence, and
the semantic ownership of business rules require contract, integration, tenant,
security, and review controls governed by later implementation/testing decisions.

## Candidate mechanisms

### A. dependency-cruiser as the graph rule engine

Dependency-cruiser parses JavaScript/TypeScript dependency graphs and supports
configurable forbidden-dependency, unresolved-dependency, package-dependency, and
cycle rules with severity-based diagnostics and multiple report formats. It can
consume a TypeScript configuration, including extended configurations.

Strengths are one graph for cycles and path direction, expressive `from`/`to`
rules, actionable chains, deterministic CLI execution, and visualization for
diagnosis. Rules can address files or grouped folders, which supports both module
cycles and collapsed architectural cycles.

Risks are configuration regex drift, imperfect equivalence with the exact
TypeScript/Node resolver, generated or dynamic imports, and no native proof of
pnpm workspace policy or semantic data ownership. Its resolver must be validated
against native ESM conditional exports, type-only imports, workspace links, and
project references before adoption. It is an additional supply-chain dependency.

### B. ESLint import/boundary rules

ESLint flat configuration supports monorepo-scoped configuration. Rules from
plugins such as `eslint-plugin-boundaries`, `eslint-plugin-import`, or
`eslint-plugin-import-x`, combined with a TypeScript resolver, can report forbidden
imports at the exact source line during normal linting.

This gives excellent developer feedback and can enforce simple layer/path rules.
However, it typically introduces ESLint plus one or more plugins/resolvers, spreads
architecture policy across lint configuration, and depends on resolver alignment.
Cycle detection and whole-workspace graph reasoning are weaker or more expensive
than a dedicated graph engine. ESLint is not yet approved by ADR-0002, despite the
reserved `packages/eslint-config` directory. Selecting it solely for TD-003 would
expand the stack before general lint requirements are decided.

### C. Madge as graph/cycle checker

Madge produces dependency graphs and detects circular dependencies for JavaScript
and TypeScript. It is simple for cycle discovery and visualization.

Its policy vocabulary is substantially narrower than MonPiole's required
forbidden layer, workspace, package-export, and cross-context rules. Custom wrapper
logic would become the real enforcement mechanism, leaving two graph models to
maintain. It is therefore useful as a diagnostic alternative, not the primary
enforcement choice.

### D. Custom architecture tests using approved Node.js and TypeScript APIs

A repository-owned checker could use TypeScript program/module-resolution APIs,
read workspace manifests, construct file/package/group graphs, and assert every
MonPiole rule. It offers the closest possible TypeScript resolution semantics and
can make pnpm/workspace/export policy first-class.

It also transfers parser, graph, cycle, diagnostics, fixture, and maintenance
ownership to MonPiole. Reproducing mature graph behavior is a large bespoke surface,
and TypeScript compiler APIs can change between versions. A fully custom engine is
not the smallest justified baseline. Small targeted architecture tests remain
appropriate for manifest/export assertions a general graph tool cannot express.

### E. Native compiler and package boundaries only

Strict TypeScript project references, Node-compatible `exports`, pnpm's strict
dependency layout, `workspace:` declarations, and frozen installation catch missing,
undeclared, or unexported dependencies when correctly configured.

These are necessary guardrails but do not express forbidden yet resolvable edges,
folder/layer direction, all cycles, service ownership, or `packages/shared` policy.
They cannot satisfy ADR-0006 alone.

### F. Monorepo graph/orchestration platform

Nx-style project graphs can enforce tags and constraints and provide affected-task
analysis. TD-002 explicitly selected no separate orchestration layer initially.
Adding one for architecture checking would combine broader project inference,
execution, caching, plugins, and configuration with a narrower requirement. This
option is incompatible with the smallest approved TD-002 baseline unless a later
superseding decision establishes broader measured needs.

## Comparative analysis

| Criterion | dependency-cruiser | ESLint boundary stack | Madge | Custom TS/Node tests | Native boundaries | Orchestration graph |
| --- | --- | --- | --- | --- | --- | --- |
| Forbidden directions | Strong | Strong for imports | Weak without wrapper | Strong | Weak | Strong |
| Cycles/group graphs | Strong | Moderate | Strong for module cycles | Strong but bespoke | Partial | Strong |
| TS/native ESM accuracy | Good, must validate | Resolver-dependent | Must validate | Highest potential | Authoritative for compilation | Plugin-dependent |
| Package `exports` | Must validate and supplement | Resolver-dependent | Limited evidence | Can use TS resolver and explicit audit | Authoritative at compile/runtime | Plugin-dependent |
| pnpm workspace policy | Supplement required | Supplement required | Weak | Strong if implemented | Manifests/install only | Strong but excessive scope |
| Diagnostics | Actionable graph paths | Excellent source-line feedback | Good cycle reports | Must be built | Compiler/package errors only | Good project-level feedback |
| Configuration/maintenance | Moderate, centralized | High across plugins/resolver | Low tool config, high wrapper cost | High ownership | Low | High |
| False-positive/negative risk | Moderate; fixtures reduce it | Moderate/high if resolver diverges | High for required policy | Low resolution risk, implementation risk | High false-negative policy risk | Moderate |
| Supply-chain surface | One direct tool plus transitives | Several direct tools/plugins | One tool plus wrapper | No graph-tool dependency; internal code burden | No extra checker | Large plugin/tool surface |
| Fit with TD-001/TD-002 | Strong if proven | Deferred lint choice | Incomplete | Strong but costly | Necessary, insufficient | Conflicts with no-orchestrator baseline |

No single candidate proves every rule. The smallest adequate design is a
combination: native compiler/package boundaries, one dedicated graph rule engine,
and narrow repository-owned architecture tests for workspace/export assertions.

## Compatibility implications

### Native ESM and TypeScript

The future implementation must use the approved native-ESM semantics rather than
CommonJS or bundler shortcuts. TypeScript documents that `node16`/`nodenext`
resolution consults package `exports` and `imports`, chooses `import` or `require`
conditions from the emitting module format, and treats `.ts` according to the
nearest package `type`. This makes the manifest, compiler options, and import form
part of the graph's meaning.

The graph engine must receive each relevant strict TypeScript configuration and
must fail on unresolved imports. Acceptance fixtures must cover `.ts` in
`type: module` packages, `.js` specifiers resolving to TypeScript source, type-only
edges, conditional and subpath exports, self-references, project references, and
dynamic imports. Results must be compared with `tsc` and Node resolution. A tool
that silently follows `node_modules`/CommonJS or bundler semantics is not acceptable.

### pnpm workspaces and package exports

Workspace discovery must come from the approved pnpm workspace definition, not a
second manually maintained project list. A targeted manifest test must verify that
every internal dependency is declared with the approved `workspace:` policy, no
source-relative path escapes a workspace, package names are unique, and dependency
directions follow ownership rules.

Every consumed first-party package must expose explicit public entry points.
Source-graph rules must reject `/src`, build-directory, relative cross-workspace,
and unexported-subpath imports. Because a source analyzer can resolve linked source
more permissively than Node, an explicit export-map audit and compiler fixture are
required. pnpm filtering or task graphs are execution aids, not permission models.

## Deterministic local execution and diagnostics strategy

After approval and a separate implementation task, expose one stable local command
owned by `tools/quality`. It should run, in a fixed order:

1. strict TypeScript resolution/type verification for all governed workspaces;
2. manifest, workspace, and export-map architecture assertions;
3. dependency-cruiser forbidden-edge and cycle rules; and
4. deterministic synthetic positive/negative fixtures proving each rule family.

The command must use only lockfile-pinned local executables after a frozen install;
it must not download tools at execution time. Inputs include manifests, the shared
lockfile, workspace definition, TypeScript configurations, export maps, source,
architecture configuration, and fixtures. Normalize paths to repository-relative
forward-slash form, sort violations by rule ID and path, avoid timestamps and
machine-specific absolute paths, and use a stable non-zero exit code for violations
or unresolved inputs.

Each diagnostic should contain a stable rule ID, severity, importer, resolved
target, shortest relevant dependency chain, owning boundary, reason, and remediation
hint. Human-readable output is required locally; a stable machine-readable report
may be added for later CI consumption without replacing console diagnostics.
Exceptions must be explicit, owner-approved, narrowly scoped, justified, and
time-bounded. A generated blanket baseline of ignored violations is prohibited.

## CI integration readiness and operational impact

TD-003 defines CI readiness, not a CI platform or workflow. TASK-006-08 and TD-009
remain responsible for automation. The exact local command and lockfile-frozen
environment must run unchanged in CI. CI should fail on error-severity violations,
unresolved inputs, configuration errors, or fixture regressions; warning policy
must be explicit. Full checks should run before any changed-only optimization.

Operationally, the recommendation adds one future graph tool plus small owned
policy tests. Developers gain one command and actionable paths but must maintain
rules as contexts and exports evolve. The graph can later produce review artifacts,
but visualization is diagnostic output, not a separate source of truth. Performance
must be measured before adding caching, daemons, or orchestration.

## Security and supply-chain considerations

- Pin the graph tool and all transitives in the single reviewed lockfile; install
  with the approved frozen process and never execute via network-fetching shortcuts.
- Review maintainer activity, provenance/integrity, licenses, advisories, lifecycle
  scripts, transitive growth, and Node/TypeScript compatibility before adoption and
  on upgrades.
- Treat configuration and exception changes as security-sensitive because a rule
  downgrade can enable cross-service data or authorization bypasses.
- Run with read-only source access and no registry, production credentials, tenant
  data, network, or deployment permissions. Reports must contain paths and rule
  metadata only, never source payloads, secrets, or customer data.
- A clean graph is not evidence of tenant isolation, authorization, safe credentials,
  or runtime data ownership. Those controls require focused tests and deployment
  review.
- Repository-owned tests reduce external dependency surface but are executable code;
  protect them with ownership, review, deterministic fixtures, and least privilege.

## Migration strategy

There is no implementation baseline to migrate. After human approval, use a
separate governed implementation task to:

1. confirm the implemented TD-001/TD-002 versions and workspace/export conventions;
2. evaluate and pin an exact dependency-cruiser version after supply-chain review;
3. create minimal synthetic ESM/TypeScript/pnpm fixtures, including allowed and
   forbidden examples for every statically enforceable rule;
4. prove resolver equivalence against TypeScript and Node before scanning product
   source;
5. add centralized rules and targeted manifest/export tests under the designated
   quality area;
6. inventory existing violations without weakening rules, then remediate or approve
   narrowly governed temporary exceptions;
7. document the stable local command and obtain TASK-006-07 technical verification;
8. only then pursue TD-009/TASK-006-08 CI integration; and
9. periodically test rule mutation or negative fixtures so a configuration that
   stops detecting violations fails verification.

Each step must be independently reviewable. No framework, general linter, test
runner, CI provider, orchestrator, or runtime behavior is implied.

## Rollback strategy

Before approval, rollback is rejection or revision of this proposal. During the
isolated implementation, remove the graph dependency, configuration, scripts, and
synthetic fixtures in a reviewed change; native compiler, package, export, and
workspace boundaries remain intact.

After adoption, first freeze rule/configuration changes and retain violation reports.
Replace the engine behind the stable local command only after the replacement passes
the same positive/negative fixtures and resolution-equivalence suite. Switch local
and CI consumers together, then remove the old dependency and lockfile entries last.
Do not disable checks or maintain two divergent rule sources during migration.

## Major risks and mitigations

| Risk | Mitigation / gate |
| --- | --- |
| Tool resolution differs from TypeScript/Node | Resolver-equivalence fixtures are an implementation gate; unresolved or divergent cases fail closed |
| Regex/path rules drift as contexts grow | Stable rule IDs, centralized ownership, grouped boundary metadata, and negative fixtures |
| Static success is mistaken for data/security proof | Report non-static controls separately; retain integration, contract, tenant, security, and infrastructure review |
| Shared business logic is invisible to the graph | Ownership and semantic review; graph only rejects service edges and suspicious placement |
| Exceptions become permanent bypasses | Narrow scope, owner, rationale, expiry, review, and diagnostics; no blanket generated baseline |
| Graph tool becomes abandoned or compromised | Exact-version review, minimal permissions, lockfile review, replacement fixtures, and stable command abstraction |
| Targeted tests grow into an unmaintainable custom analyzer | Limit owned tests to manifest/export/workspace gaps; keep graph traversal in the selected engine |
| ESLint or an orchestrator is introduced indirectly | Treat each as a separate ADR-0002 selection; reserved directories are not approvals |
| Approved TD records contain stale proposal wording | Use explicit owner-approval sections as current evidence; clarify status editorially in a separately governed documentation task |

## Consequences

Positive consequences are deterministic graph rules, module and group cycle
detection, workspace/export policy coverage, one local entry point, actionable
diagnostics, and a reusable fixture contract for changing tools. The stack preserves
native ESM and pnpm semantics without selecting a broader orchestrator or linter.

Negative consequences are one additional third-party dependency, centralized rule
maintenance, custom targeted policy tests, resolver-equivalence work, and residual
manual/runtime verification. Developers must update architectural metadata when
adding contexts or public exports. Full-repository analysis may eventually require
measured performance work.

## Recommendation and rationale

Subject to architecture-owner approval, adopt a **complementary three-part control
model**:

1. native strict TypeScript, Node package `exports`, pnpm manifests/workspaces, and
   frozen installation as necessary compiler/package guardrails;
2. dependency-cruiser as the single dedicated static import graph, forbidden-edge,
   and cycle engine; and
3. small repository-owned Node/TypeScript architecture tests for pnpm workspace,
   manifest, export-map, and graph-tool resolution-equivalence rules.

Do not adopt ESLint solely for architecture enforcement, Madge as a second graph,
a fully custom graph analyzer, or a monorepo orchestration platform at baseline.
Reconsider ESLint integration if a later accepted lint decision can reuse the same
boundary metadata for faster editor feedback. Reconsider the graph engine if the
implementation fixtures expose material ESM, TypeScript, exports, or pnpm resolution
divergence.

This is the smallest stack that covers the required static rules without pretending
that imports prove semantic ownership or runtime data isolation. One graph tool
handles graph knowledge; native mechanisms enforce actual compilation/package
surfaces; targeted tests close policy gaps without rebuilding a graph engine.

## Dependencies and gates

### Dependencies

- ADR-0001 through ADR-0006;
- approved TD-001 and TD-002;
- documented `apps/`, `services/`, and `packages/` ownership boundaries;
- TASK-006-07 for local implementation and verification;
- TD-009/TASK-006-08 only after local enforcement is proven; and
- later testing/security decisions for non-static guarantees.

### Implementation gate

No implementation is authorized until this proposal is explicitly approved and a
separate task authorizes exact-version review, dependency installation,
configuration, manifests/lockfile changes, fixtures, and local command creation.
Implementation must prove every static rule with an allowed and forbidden fixture,
prove TypeScript/Node/pnpm/export resolution alignment, and report residual
non-static rules as pending. Documentation review is not technical enforcement.

### Approval gate

The architecture owner must explicitly accept, reject, or request revision. Approval
must confirm the three-part control model, dependency-cruiser selection, exact
static/non-static boundary, exception policy, supply-chain controls, migration and
rollback, resolver-equivalence gate, and separation of local enforcement from CI
selection. Until approval, TD-003 remains **PROPOSED**, TASK-006-07 remains blocked,
and TASK-006-08 remains blocked/pending.

## References

1. TypeScript, [Modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference).
2. TypeScript, [`resolvePackageJsonExports`](https://www.typescriptlang.org/tsconfig/resolvePackageJsonExports.html).
3. Node.js, [Packages](https://nodejs.org/api/packages.html).
4. pnpm, [Workspaces](https://pnpm.io/workspaces).
5. pnpm, [Filtering](https://pnpm.io/filtering).
6. dependency-cruiser, [Rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md).
7. dependency-cruiser, [Options reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md).
8. ESLint, [Configuration files](https://eslint.org/docs/latest/use/configure/configuration-files).
9. `eslint-plugin-boundaries`, [documentation](https://github.com/javierbrea/eslint-plugin-boundaries).
10. `eslint-plugin-import-x`, [documentation](https://github.com/un-ts/eslint-plugin-import-x).
11. Madge, [documentation](https://github.com/pahen/madge).
## Architecture owner approval

Approved on 2026-08-23.

The architecture owner approves the TD-003 recommendation:

- native TypeScript/ESM and pnpm package boundaries;
- dependency-cruiser for dependency graph and cycle analysis;
- repository-owned architecture tests for workspace, manifest, export-map,
  and resolver-equivalence checks.

This approval authorizes a separate implementation task for deterministic local
architecture enforcement. It does not authorize CI integration yet.

TASK-006-08 remains blocked until local enforcement under TASK-006-07 is
implemented and reproducible.
