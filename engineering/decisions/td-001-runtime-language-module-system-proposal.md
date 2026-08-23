# TD-001: Runtime, language, and module system

- Decision ID: TD-001
- Status: **APPROVED**
- Date: 2026-08-23
- Governing decision: [ADR-0002](../adr/0002-technology-selection-gate.md)
- Decision owner: Architecture owner
- Scope: Decision proposal only; no technology is approved, installed, or configured

## Problem statement

MonPiole needs an executable baseline for application code and deterministic
architecture checks. No runtime, primary language, or module system is currently
selected. The choice must preserve the accepted repository boundaries, Clean
Architecture dependency direction, bounded-context ownership, explicit tenant
context, and versioned API and event contracts. It must also remain compatible
with later monorepo/dependency-management (TD-002) and architecture-enforcement
(TD-003) decisions.

This proposal compares realistic candidates and recommends one for architectural
review. It does not approve a runtime, choose a framework, package manager, test
runner, contract format, persistence technology, broker, or deployment platform.

## Evidence baseline and assumptions

The following repository evidence was reviewed:

- ADR-0001 through ADR-0006;
- `engineering/decisions/technology-decision-inventory.md`;
- the root, `apps/`, `services/`, `packages/`, `tests/`, `infrastructure/`, and
  engineering READMEs;
- the application READMEs for web, mobile, admin, API, and API gateway.

That evidence establishes repository ownership and architectural constraints but
contains no approved workload volumes, latency targets, deployment topology,
team-skills profile, mobile implementation strategy, or browser framework. The
comparison therefore addresses platform fit rather than claiming workload-specific
benchmarks or staffing advantages. Directory names such as `postgres`, `redis`,
and `kubernetes`, and package placeholders such as `typescript-config`, are not
treated as selected technology.

External evidence is limited to vendor-maintained language/runtime documentation:

- Node.js documents ECMAScript modules as stable, standards-based modules and
  documents explicit ESM/CommonJS markers and interoperability [1].
- TypeScript documents standard ECMAScript module syntax, Node-aware resolution,
  explicit package exports/imports, and project references for logical separation
  and incremental builds [2][3].
- Microsoft documents cross-platform CLI test execution, platform observability
  APIs with OpenTelemetry integration, and framework-dependent, self-contained,
  single-file, and Native AOT deployment choices [4][5][6].
- Kotlin documents compile-time nullability and coroutine-based asynchronous work;
  the latter requires a separate library above the language's low-level support
  [7][8]. The Java language specification defines named modules and explicit
  module dependencies [9].

These sources establish capabilities, not MonPiole-specific superiority. Ecosystem
fit, cognitive load, and operational trade-offs below are engineering assessments
against the accepted architecture.

## Requirements and comparison criteria

All candidates must support:

1. Framework-independent domain and application code with inward dependencies.
2. Explicit public module surfaces and mechanically inspectable dependency edges.
3. Separate ownership under `apps/`, `services/`, and `packages/`, without shared
   service persistence or leaked internal domain models.
4. Versioned API/event contracts, additive evolution, idempotent consumers, and
   tenant/correlation propagation at synchronous and asynchronous boundaries.
5. Deterministic unit, integration, contract, tenant, architecture, and end-to-end
   testing, locally and later in CI.
6. Strong static checking suitable for refactoring and contract evolution.
7. Mature API, asynchronous processing, security-maintenance, diagnostics, and
   OpenTelemetry-compatible ecosystems.
8. Reproducible container-oriented deployment with reasonable startup, memory,
   throughput, and operational complexity for services and background workers.
9. A staged adoption and rollback path because the repository has no runtime code.
10. Compatibility with, but no premature selection of, TD-002 and TD-003.

The criteria are weighted qualitatively. Architectural fit and enforceability are
primary; type/contract safety, operations/security, testing, productivity, and
ecosystem maturity follow. Raw benchmark performance is not decisive without
approved workload profiles.

## Candidates

### A. Node.js with strict TypeScript and native ECMAScript modules

- Runtime: a supported Node.js release line, exact release policy deferred to an
  approval/implementation record.
- Primary language: TypeScript in strict mode, compiled before production use.
- Module strategy: native ESM only for first-party code; explicit package public
  entry points; no first-party CommonJS; no imports of another service's internals.
- Boundary unit: workspace/package or separately compiled project aligned to an
  owned application, bounded context, or genuinely reusable package.

### B. .NET with C# and assemblies/projects

- Runtime: a supported .NET release line.
- Primary language: C# with nullable reference types enabled.
- Module strategy: projects and assemblies with explicit project references,
  namespaces, and restricted public APIs; architecture rules enforced by analyzers
  and tests rather than namespaces alone.
- Boundary unit: solution project/assembly aligned to repository ownership.

### C. JVM with Kotlin and Gradle/JPMS-compatible modules

- Runtime: a supported JVM release line.
- Primary language: Kotlin/JVM.
- Module strategy: build modules aligned to ownership; Kotlin visibility and Java
  packages, optionally strengthened by JPMS where library compatibility permits.
- Boundary unit: JVM build module, with named Java modules evaluated during later
  tooling design rather than assumed.

Java rather than Kotlin is a viable variation of Candidate C. Kotlin is evaluated
because its nullability and concise asynchronous model improve application-level
type safety; Java would reduce language/tool layering but is otherwise similar in
runtime, module, deployment, and operational characteristics. Rust and Go were
screened out as primary baselines: both can build reliable services, but selecting
either would provide less direct reuse between the reserved browser/client package
surface and server code, while Rust adds ownership/lifetime learning cost and Go's
structural abstractions are less expressive for the proposed contract-rich shared
type surface. They can be reconsidered for measured specialist components; no such
requirement currently exists.

## Comparative analysis

| Criterion | Node.js + TypeScript + ESM | .NET + C# | JVM + Kotlin |
| --- | --- | --- | --- |
| Clean Architecture / DDD | Strong when packages expose ports and domain code excludes runtime imports; structural typing and easy deep imports require enforcement | Strong nominal typing, interfaces, projects, and analyzers; framework independence still requires discipline | Strong type system, interfaces, build modules, and mature DDD practices; framework independence still requires discipline |
| Monorepo and boundaries | Excellent alignment with existing package-shaped placeholders and likely browser TypeScript consumption; TD-002 must prevent undeclared/deep imports | Good with solution/project references; browser/mobile assets would normally introduce a second toolchain | Good with multi-project builds; browser assets and non-JVM mobile paths normally introduce another toolchain |
| Module semantics | Standards-based ESM is shared with browsers; package exports can define public surfaces. ESM/CJS dependency interop remains a real edge case | Assemblies provide clear compilation boundaries and `internal` visibility; namespaces alone are not boundaries | Build modules are clear; JPMS can strengthen runtime boundaries but adds complexity and library compatibility considerations |
| Type and contract safety | Strong static checking and discriminated unions, but types are erased and untrusted API/event payloads still require runtime validation | Strong nominal types, nullability, reflection/source-generation options; wire payloads still require validation | Strong nullability, sealed types, and JVM reflection/code generation; wire payloads still require validation |
| API and async work | Mature nonblocking I/O ecosystem; event-loop model suits I/O-heavy APIs/workers but CPU-heavy work needs isolation or worker processes | Mature async/await, threading, hosted workers, and high-throughput servers | Mature JVM concurrency; Kotlin coroutines are expressive but add a library and cancellation/context conventions |
| Testing and architecture checks | Broad unit/integration/contract ecosystem and dependency-graph tools; exact tools remain TD-003/TD-004 decisions | Strong CLI testing, analyzers, reflection-based architecture tests, and integration support | Mature test, bytecode/static analysis, and architecture-test ecosystems |
| Tenant/correlation propagation | Async context mechanisms exist, but hidden ambient context would violate ADR-0004; explicit context remains mandatory | Async-local mechanisms exist, but explicit boundary propagation remains mandatory | Coroutine/thread context mechanisms exist, but explicit boundary propagation remains mandatory |
| Observability | Mature OpenTelemetry SDK/instrumentations; event-loop delay and worker saturation need monitoring | Platform diagnostics plus OpenTelemetry integration are strong [5] | Mature OpenTelemetry Java agent/SDK ecosystem; coroutine context needs deliberate propagation |
| Security posture | Small runtime footprint possible, but large and fast-moving package graphs increase supply-chain review burden; runtime validation is essential | Strong platform tooling and central package ecosystem; reflection/dynamic loading and serializer choices require review | Mature platform security and tooling; build/plugin graphs and deserialization/reflection require review |
| Deployment and operations | Small portable containers and fast startup; one runtime can serve tooling, API, workers, and likely web build | Flexible framework-dependent/self-contained/AOT modes [6]; images and memory are commonly higher than Node for small services, though workload measurement is required | Proven containers and throughput; JVM startup/memory tuning and build tooling usually raise baseline operational complexity |
| Performance fit | Strong for concurrent I/O; single event loop is vulnerable to blocking/CPU-heavy work | Strong general-purpose throughput and parallel CPU use; AOT may improve startup/memory with compatibility trade-offs | Strong sustained throughput and parallelism; warm-up and memory behavior need operational tuning |
| Developer productivity | One language/module syntax across server, browser-facing packages, contracts, and architecture tooling; strict configuration is essential | Excellent IDE/compiler experience for backend; likely additional JS/TS toolchain for browser clients | Excellent JVM tooling and expressive language; likely additional JS/TS toolchain for browser clients |
| Long-term maintainability | Web-standard ESM reduces proprietary module coupling; TS/Node release and dependency churn need explicit support policy | Stable runtime and language evolution with strong compatibility; project boundaries are durable | Mature runtime and compatibility record; Kotlin/Java/build-tool layers increase the governed surface |
| Operational complexity | Lowest prospective number of language toolchains for the current repository shape | Moderate: strong unified backend toolchain, plus probable browser toolchain | Moderate/high: JVM/Kotlin/build tooling, plus probable browser toolchain |

No candidate inherently enforces tenant isolation, authorization, contract
compatibility, idempotency, or Clean Architecture. Those remain design rules plus
tests and TD-003/TD-004 enforcement.

## Trade-offs

Candidate A minimizes language and module-system fragmentation across server code,
browser-facing packages, SDK/types/events, and repository quality tooling. Native
ESM also provides a standards-based module vocabulary and TypeScript project/package
edges are statically inspectable. Its costs are erased types at runtime, structural
typing across contracts, ESM/CommonJS interoperability at third-party boundaries,
event-loop sensitivity to blocking work, and a comparatively broad dependency
supply-chain surface.

Candidate B offers stronger compilation units, nominal type conventions, robust
parallel execution, and an integrated diagnostics/test experience. It is arguably
the strongest backend-only baseline. Its principal MonPiole cost is a likely second
language/toolchain for the web and browser-oriented packages, reducing cross-surface
contract reuse and increasing TD-002 complexity.

Candidate C offers strong types, mature JVM operations, and excellent sustained
service performance. Kotlin nullability and coroutines are attractive, but Kotlin,
JVM, build modules, optional JPMS, and a probable browser toolchain create the
largest initial governed surface. JPMS should not be adopted merely to compensate
for boundaries that build modules and architecture tests can enforce more simply.

## Recommendation

**Propose Candidate A: Node.js with strict TypeScript and native ESM as MonPiole's
primary runtime/language/module baseline.**

The recommendation is based on architectural fit, not popularity or an assumed
framework. It best matches the repository's combined server, API, SDK, shared
contract, web, and architecture-tooling surfaces while allowing every bounded
context to retain its own domain and deployment boundary. A single type system and
standards-based module syntax reduce translation points for contract evolution and
make dependency edges available to future TD-003 checks.

Approval should include these constraints:

1. TypeScript strictness and production compilation/type-checking are mandatory;
   runtime execution of unchecked source is not the production contract.
2. First-party modules use native ESM only. CommonJS may exist only behind reviewed
   third-party compatibility boundaries.
3. Each owned unit exposes an explicit public surface. Deep imports across services
   and imports of another service's domain/application/infrastructure internals are
   forbidden.
4. Static types never replace validation of API, event, configuration, persistence,
   or other untrusted data. The validation/contract technology remains undecided.
5. Tenant and correlation context are explicit values at trust boundaries; ambient
   async state may assist adapters but must not become hidden domain state.
6. CPU-bound workloads must be measured and isolated from request/event loops. A
   specialist runtime requires its own approved decision if evidence later demands it.
7. A supported-runtime and security-update policy must be set at implementation time.

This is a **PROPOSED** recommendation. It becomes neither accepted nor authorized
for installation until the architecture owner approves a compliant decision record.

## Compatibility implications

- ADR-0001/0006: workspace/package boundaries can map to owned directories, but
  package convenience must not collapse bounded contexts or permit internal imports.
- ADR-0003: shared TypeScript types may improve authoring, but wire schemas remain
  explicit versioned contracts and require independent runtime validation and
  compatibility tests. Internal persistence/domain models must not be published.
- ADR-0004: tenant and correlation types can be explicit, but enforcement belongs at
  every external boundary and data adapter, not in a global singleton.
- ADR-0005: domain/application modules must import no framework, transport,
  persistence, messaging, telemetry, or environment adapter implementation.
- Existing repository content requires no migration because it contains no runtime
  implementation. Placeholder names do not pre-approve TypeScript configuration.
- Public package exports become compatibility commitments and must evolve additively
  or through approved breaking-change procedures.

## Testing and tooling implications

The proposed baseline can support all required test levels, but selects none of
their tools. TD-003 must demonstrate deterministic parsing of actual ESM/TypeScript
resolution, public export maps, workspace edges, cycles, forbidden layer imports,
and cross-service internal imports. TD-004 must separately select unit, integration,
contract, tenant, and static testing capabilities. Architecture checks must analyze
both source-level imports and package/workspace declarations; documentation-only
boundaries are insufficient.

Contract and tenant tests must use synthetic data. Integration tests must isolate
adapters and controlled dependencies. Event tests must cover idempotency, retry,
tenant/correlation propagation, and additive schema evolution.

## Security considerations

- Establish a supported Node.js release/update policy and emergency patch process.
- Pin and verify dependencies only after TD-002 approval; review transitive packages,
  lifecycle scripts, provenance, licenses, advisories, and least-privilege CI tokens.
- Minimize dependencies, especially in domain/application modules; standard-library
  or small internal code is preferable when it remains maintainable.
- Validate all external values at trust boundaries and reject missing/invalid tenant
  context before authorization or side effects.
- Keep secrets out of source and domain modules; constrain filesystem, network,
  process, and environment access to adapters.
- Prevent prototype-pollution, unsafe deserialization, command/path injection, SSRF,
  and denial-of-service through validation, limits, safe APIs, and focused review.
- Avoid logging tenant payloads, credentials, personal data, or confidential events;
  make privileged actions auditable.
- Treat source maps and diagnostic artifacts as potentially sensitive deployment
  outputs and govern their access.

The recommendation does not claim that Node.js is intrinsically more secure than
.NET or the JVM. Its risk is manageable only with dependency governance, prompt
runtime updates, runtime validation, least privilege, and automated checks.

## Operational considerations

- APIs and event consumers should use nonblocking I/O; synchronous CPU or I/O work
  must not block the event loop.
- Observe request/event latency, event-loop delay, memory, garbage collection,
  queue lag, retry/dead-letter behavior, and worker saturation in addition to logs,
  metrics, and traces.
- Propagate correlation and tenant identifiers through telemetry without recording
  sensitive payloads or creating uncontrolled high-cardinality labels.
- Prefer one process responsibility per deployable unit. Independent service
  deployment remains an architectural capability, not a mandate to distribute every
  bounded context immediately.
- Container base, build strategy, deployment topology, resource limits, health
  checks, and scaling policy remain future governed decisions.
- Performance acceptance requires representative benchmarks after approved workload
  and SLO definitions; no comparative throughput claim here substitutes for them.

## Migration strategy

There is no runtime code to migrate. After explicit architecture-owner approval:

1. TD-002 selects workspace/package management and reproducible installation in a
   manner compatible with ESM and explicit package exports.
2. TD-003 selects and proves local architecture enforcement against a minimal,
   non-business fixture before CI integration.
3. A governed implementation task pins the supported runtime/language versions and
   compiler/module rules, creates only the minimum manifests/configuration, and
   records deterministic commands.
4. TD-004 selects test tooling before behavior or adapters are introduced.
5. Introduce one thin vertical application/service slice with explicit ports,
   validation, tenant/correlation propagation, telemetry, and contract tests.
6. Measure build, startup, memory, I/O concurrency, and CPU-heavy paths before
   expanding the baseline or choosing deployment resources.

Each step must be separately reviewable and must not introduce a framework or
infrastructure technology without its own ADR-0002-compliant approval.

## Rollback strategy

Before runtime implementation, rollback is rejection or withdrawal of this proposal;
the current documentation-only repository remains unchanged. After approval but
before business code, revert the isolated manifests/configuration and architecture
fixture through a normal reviewed change, then return TD-001/TD-002/TD-003 to review.

After production behavior exists, rollback must be incremental: preserve versioned
wire contracts, run old and replacement implementations behind the same public
contract where necessary, migrate consumers additively, and remove the old runtime
only after compatibility and operational evidence. Do not rewrite all bounded
contexts simultaneously. Data/event rollback belongs to their future governed
decisions and cannot be inferred here.

## Major risks and mitigations

| Risk | Mitigation / decision gate |
| --- | --- |
| Recommendation mistaken for approval | Keep status PROPOSED; require architecture-owner approval and a separately authorized implementation task |
| Type erasure permits invalid external data | Select schema/runtime validation later; test every trust boundary |
| Structural types or deep imports erode ownership | Explicit exports plus TD-003 source/package dependency checks |
| ESM/CommonJS ambiguity | Native ESM for first-party code; reviewed adapters for dependencies; test compiled artifacts |
| Event-loop blocking or CPU-heavy workloads | Static review, event-loop metrics, representative benchmarks, workers/process isolation |
| Dependency supply-chain exposure | TD-002 reproducibility/provenance controls, minimal dependencies, automated advisory review |
| Shared TypeScript contracts become shared domain models | Publish wire contracts only; keep domain models in owning services |
| One language becomes a distributed monolith | Preserve service ownership/data boundaries and communicate only through explicit APIs/events |
| Unknown team skills or workload SLOs invalidate productivity/performance assumptions | Architecture-owner review; collect evidence before implementation and re-open the decision if material |
| TD-002 or TD-003 cannot enforce the proposed module model | Do not implement runtime source; revise or reject TD-001 through governance |

## Consequences

Positive consequences are a consistent language/module vocabulary across much of
the repository, strong compile-time feedback, direct alignment with browser ESM,
inspectable dependency graphs, and relatively low prospective toolchain count.

Negative consequences are mandatory compilation and runtime validation, careful
ESM interoperability management, increased exposure to package ecosystem churn,
and the need to isolate CPU-heavy work. Static TypeScript boundaries alone do not
provide runtime isolation, security, tenant enforcement, or contract compatibility.

Candidate B remains the preferred fallback if architecture ownership prioritizes a
backend-only nominal type/module boundary and accepts a separate browser toolchain.
Candidate C remains viable if JVM operational expertise or measured sustained-load
requirements outweigh initial toolchain complexity.

## Dependencies on TD-002 and TD-003

TD-001 and TD-002 must be reviewed together for compatibility, but neither proposal
may silently approve the other. TD-002 must decide workspace discovery, package
manager, lockfile/reproducibility, script execution, dependency declaration, public
exports, and version alignment. No manifest or lockfile is authorized by this text.

TD-003 depends on approved TD-001 and TD-002 outcomes. It must select deterministic,
locally runnable architecture analysis capable of following the chosen compiler and
runtime resolution semantics. If the selected tool cannot model ESM, TypeScript,
workspace exports, and forbidden edges accurately, TD-003 must block implementation
rather than weaken ADR-0005/0006.

## Approval gate

The architecture owner must explicitly accept, reject, or request revision of this
proposal. Acceptance must confirm:

- the Node.js/strict TypeScript/native ESM recommendation and constraints;
- whether missing team-skill and workload evidence is acceptable for the baseline;
- coordination requirements for TD-002 and TD-003;
- that no framework, package manager, dependency, test tool, contract technology,
  runtime version, or deployment platform is approved implicitly.

Until then, status remains **PROPOSED** and runtime installation, configuration,
source code, manifests, dependencies, and lockfiles remain blocked by ADR-0002.

## References

1. Node.js, [ECMAScript modules](https://nodejs.org/api/esm.html).
2. TypeScript, [Modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference).
3. TypeScript, [Project references](https://www.typescriptlang.org/docs/handbook/project-references).
4. Microsoft, [Testing in .NET](https://learn.microsoft.com/en-us/dotnet/core/testing/).
5. Microsoft, [.NET observability with OpenTelemetry](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/observability-with-otel).
6. Microsoft, [.NET application publishing overview](https://learn.microsoft.com/en-us/dotnet/core/deploying/).
7. Kotlin, [Null safety](https://kotlinlang.org/docs/null-safety.html).
8. Kotlin, [Coroutines guide](https://kotlinlang.org/docs/coroutines-guide.html).
9. Oracle, [Java Language Specification, Java SE 26](https://docs.oracle.com/javase/specs/jls/se26/html/jls-7.html#jls-7.7).
## Architecture owner approval

Approved on 2026-08-23.

The architecture owner explicitly approves this technology decision after
coordinated review of TD-001 and TD-002.

Approval authorizes this decision as an architectural baseline subject to the
constraints, dependencies, security controls, migration strategy, rollback
strategy, and implementation gates documented above.

Approval does not by itself authorize uncontrolled repository initialization or
bypass TD-003 architecture-enforcement requirements.
