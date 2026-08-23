# TD-004: Testing strategy and tooling

- Status: **APPROVED**
- Decision date: 2026-08-23
- Scope: TOOL-003 through TOOL-006 and deferred assessment of end-to-end and performance testing
- Decision owner: Quality Engineering, with API and Integration Engineering approval for contract testing

## Decision summary

MonPiole will use one TypeScript-native runner for the tests required by the
first Tenant Onboarding slice, add infrastructure tooling only when an owned
adapter needs it, and keep tenant isolation visible in every applicable suite.

| Capability | Decision | Mechanism | Registry outcome |
| --- | --- | --- | --- |
| Unit testing | **SELECTED** | Vitest `4.1.11` | Approved strategy for TOOL-003; executable baseline not implemented |
| Integration test execution | **SELECTED** | Vitest `4.1.11` | Approved runner strategy for TOOL-004; executable baseline not implemented |
| Integration dependencies | **SELECTED CONDITIONALLY** | Repository-owned fixtures by default; Testcontainers `12.0.4` only for a selected real infrastructure adapter | Completes TOOL-004 when TD-008 or another adapter decision identifies the dependency |
| API and event contract testing | **SELECTED** | Repository-owned schema examples and compatibility tests executed by Vitest | Approved strategy for TOOL-005; executable baseline not implemented |
| Consumer-driven contracts | **DEFERRED** | Pact, assessed at `17.1.2` | Reconsider when independently released consumers/providers create a concrete coordination problem |
| Tenant-isolation testing | **SELECTED AS A MANDATORY CROSS-CUTTING CONCERN** | Required assertions and synthetic multi-tenant fixtures across unit, integration, and contract suites | Approved strategy for TOOL-006; no separate framework; executable baseline not implemented |
| Browser end-to-end testing | **DEFERRED** | Playwright preferred over Cypress when an approved UI journey exists | Not required for Tenant Onboarding |
| Performance testing | **DEFERRED** | Re-evaluate k6 and Artillery against an approved workload and environment | Not required for Tenant Onboarding |

This decision does not select a CI provider. It defines stable local commands
that any approved CI adapter may invoke.

## Problem definition

The repository needs deterministic, independently runnable verification for
domain/application behavior, owned infrastructure adapters, public API and
event compatibility, and the non-negotiable tenant boundary. The immediate
Tenant Onboarding slice is backend-only, persists owned state, exposes an API,
and publishes `TenantCreated`. It therefore needs unit, integration, contract,
and tenant-isolation verification now, but it supplies no approved UI journey
or performance workload.

The choice must preserve Clean Architecture: test convenience must not move
framework types into domain or application code, replace explicit ports with
global mocks, or weaken service data ownership. It must also avoid selecting
persistence, API, eventing, or CI technology through a testing decision.

## Requirements and traceability

| Requirement | Repository evidence | Decision response |
| --- | --- | --- |
| Isolated domain/application tests without network or filesystem | AGENTS.md; ADR-0005; `tests/unit/README.md`; REQ-0006, REQ-0013, REQ-0014 | Vitest Node-environment unit projects; dependency injection and in-memory fakes at owned ports |
| Adapter and persistence coverage with controlled dependencies | ADR-0005; ADR-0006; `tests/integration/README.md`; REQ-0015, REQ-0016 | Vitest integration project; repository fixtures first, conditional Testcontainers for real selected infrastructure |
| Clean state between integration tests | `tests/integration/README.md` | Per-test transaction/reset where supported, otherwise unique database/schema plus deterministic teardown; no shared mutable tenant data |
| Provider and consumer compatibility | ADR-0003; `tests/contract/README.md`; REQ-0019 | Canonical versioned schemas/examples, provider conformance, consumer fixture tests, and additive/breaking compatibility checks |
| Explicit tenant isolation | ADR-0004; ADR-0005; SECURITY.md; REQ-0020 | Mandatory positive, missing-context, invalid-context, and cross-tenant negative cases at the lowest meaningful levels |
| Synthetic, owned, lifecycle-aware data | AGENTS.md; `tests/fixtures/README.md` | Deterministic factories require explicit tenant ID/authority and lifecycle; no production or personal data |
| Deterministic automation and diagnostics | `tests/README.md`; `tools/quality/README.md` | Non-watch `run` commands, stable projects, fixed seeds/clocks/IDs, bounded timeouts, repository-relative diagnostics and non-zero failure |
| First slice API and event | Tenant Onboarding product contract; readiness assessment | Contract tests are required now for the backend API and `TenantCreated`; UI E2E remains deferred |
| Frozen, exact dependency management | TD-001/002/003 baseline | Exact direct pins and frozen-lockfile execution; no version ranges for direct test dependencies |

TOOL-007 static analysis remains governed by TD-003 and the approved TypeScript
and architecture commands. TD-004 does not duplicate or replace those controls.

## Candidate evaluation: unit and integration runner

### Vitest 4.1.11 — SELECTED

Vitest provides direct TypeScript/ESM execution, test projects, familiar
assertions, spies, module mocks, fake timers, watch mode, parallel execution,
reporters, and optional V8 or Istanbul coverage. The selected release declares
Node `^20.0.0 || ^22.0.0 || >=24.0.0`, so Node `24.18.0` is within its engine
range. Its package is ESM and its Vite-backed transformation is aligned with a
TypeScript/NodeNext repository, although TypeScript compilation remains a
separate `tsc` responsibility.

Risks are additional transitive dependencies and resolution behavior that can
differ from Node itself. TD-003's resolver checks and strict TypeScript command
remain authoritative. Tests must import public package exports, avoid Vite-only
aliases unless an application decision approves them, and avoid relying on
hoisted module mocks where dependency injection is clearer.

Vitest is MIT licensed. The registry metadata observed on 2026-08-23 lists 21
runtime dependencies plus exact internal Vitest packages and a Vite dependency,
which is materially larger than `node:test` but smaller and simpler for this ESM
TypeScript baseline than a Jest transform stack.

### Node.js built-in test runner — REJECTED FOR THIS BASELINE

`node:test` is stable in Node 24 and supplies assertions through `node:assert`,
process/file isolation, reporters, watch mode, spies, timers, snapshots, and
coverage output. It has no third-party runner dependency and is the best
supply-chain option.

It is not selected because Node 24 does not directly execute repository
TypeScript. A compile-first flow or an additional loader/transformer would be
needed, complicating NodeNext source maps and test discovery. More importantly,
Node 24 documents coverage as experimental and ESM module mocking behind the
experimental `--experimental-test-module-mocks` flag. MonPiole can avoid most
module mocking, but the combined TypeScript transform, coverage, and configuration
burden removes the apparent zero-dependency advantage. Reconsider it if native
type-stripping and stable coverage/module mocking satisfy the repository later.

### Jest 30.4.2 — REJECTED

Jest is mature, feature-rich, widely understood, MIT licensed, supports Node 24,
and has extensive mocking, coverage, snapshots, reporters, and ecosystem
integration. Jest 30 requires Node 18+ and TypeScript 5.4+ for its types.

It is rejected because official Jest 30 documentation still describes ESM
support as experimental and requires Node VM-module flags, while TypeScript
source needs a transform. That adds configuration and transformer dependencies
to a repository intentionally standardized on native ESM and NodeNext. Its
isolated module registry and aggressive module mocking can also encourage tests
coupled to implementation rather than ports and observable behavior.

## Determinism, developer experience, and CI suitability

Vitest will use separate projects/configuration for unit, integration, and
contract suites so discovery, timeouts, concurrency, environment setup, and
reports remain explicit. Stable repository commands are:

```text
pnpm test:unit
pnpm test:integration
pnpm test:contract
pnpm test
pnpm test:coverage
```

Their proposed semantics are:

- `test:unit`: `vitest run` for unit projects only, with no network, filesystem,
  container, or real clock dependency;
- `test:integration`: `vitest run` for adapter projects, with controlled setup,
  readiness checks, reset, and teardown;
- `test:contract`: `vitest run` for API/event schema compatibility, provider
  conformance, and consumer fixture suites;
- `test`: run the three required suites in a fixed fail-fast-neutral sequence
  through a repository-owned orchestration script, producing a non-zero result
  when any suite fails;
- `test:coverage`: unit and application coverage using
  `@vitest/coverage-v8`; adapter/contract coverage is informative and must not
  substitute for behavior assertions.

Package scripts will be thin stable interfaces. They will not encode a CI
provider. CI should use a frozen install, non-watch execution, bounded timeouts,
stable text/JUnit-compatible diagnostics as subsequently required, and retain
coverage/diagnostic artifacts only under an approved CI policy. Retries must not
hide deterministic failures; a flaky test is a defect.

Tests must control time, randomness, identifiers, locale, timezone, ports, and
external responses. If randomized order is introduced, the seed must be printed
and replayable. Global mutable fixtures, order dependence, sleeps, live SaaS
calls, and unpinned container image tags are forbidden.

## Coverage strategy

Select `@vitest/coverage-v8` `4.1.11`, exactly matching Vitest. Upstream Vitest
documents native V8 coverage with AST-based remapping and optional Istanbul
coverage. Start with line, function, branch, and statement visibility for domain
and application source. Do not set arbitrary organization-wide thresholds in
this selection record; Quality Engineering must approve thresholds after the
first representative slice establishes a measured baseline. Changed behavior
still requires tests even at high coverage.

Coverage is a diagnostic, not proof of tenant isolation, authorization,
compatibility, or side effects. Generated contracts, fixtures, adapters tested
elsewhere, and unreachable defensive branches need explicit inclusion/exclusion
rules with owner review.

## Mocking policy and risks

Prefer explicit fake implementations of application ports and deterministic
value factories. Use spies to observe a collaborator only when its interaction
is part of behavior. Use fake timers only with explicit cleanup. Module mocking
is permitted narrowly at technical boundaries that cannot reasonably be
injected; it must not mock the unit under test, authorization policy, tenant
resolution, schema validation, or persistence behavior claimed by an
integration test.

Over-mocking can make provider code pass without exercising transport parsing,
authorization-before-side-effect, tenant propagation, serialization, or real
adapter behavior. Integration and contract suites therefore exercise the real
owned adapter/provider boundary and stub only downstream dependencies beyond
that boundary.

## Integration infrastructure and state isolation

### Repository-owned controlled fixtures — SELECTED DEFAULT

In-memory fakes, protocol fakes, temporary directories, deterministic servers,
and seeded datasets owned by the repository are the default when they faithfully
exercise the selected adapter. This gives the smallest, fastest, offline-capable
test with explicit lifecycle ownership.

### Testcontainers 12.0.4 — SELECTED CONDITIONALLY

Use Testcontainers only after TD-008 or another technology decision selects a
real infrastructure dependency whose behavior cannot be represented faithfully
by a repository fixture. The npm package is MIT licensed, includes TypeScript
declarations, and has 15 direct dependencies. Its current package metadata does
not declare a Node engine; therefore Node 24 compatibility is not proven by an
engine range. Installation is gated on a focused smoke verification on Node
`24.18.0`, pnpm `11.22.0`, TypeScript `6.0.3`, ESM/NodeNext, Windows development,
and the approved automation runtime.

Container use also requires a supported Docker-compatible runtime, network/image
availability, pinned image digests or immutable versions, readiness probes,
resource limits, cleanup after failure, and vulnerability/license review of
both npm dependencies and images. No container image or persistence product is
selected here.

Per-test isolation must use the strongest cheap mechanism supported by the
selected adapter: rollback transactions only if they represent production
semantics, otherwise unique databases/schemas/namespaces plus deterministic
truncate/drop. Parallel workers must never share tenant IDs or mutable state.
Suite setup must wait on observable readiness rather than fixed sleeps and must
fail with the dependency name and lifecycle phase.

### Dedicated external test infrastructure — REJECTED AS DEFAULT

A shared long-lived environment introduces drift, credentials, network
dependence, contention, cleanup races, and cross-tenant leakage risk. It is
allowed later only for capabilities that cannot run locally/ephemerally, through
a separate operational and security decision with isolated credentials, owned
reset, observability, and cost controls. It cannot be the required unit,
integration, or contract feedback path.

## Contract compatibility strategy

### Repository-owned schema and compatibility tests — SELECTED

TD-006 will select the API schema representation and TD-007 will select the
event representation/infrastructure. TD-004 selects the test mechanism without
pre-empting either representation:

1. Store each approved API and event contract as an explicit versioned artifact,
   never as an internal persistence model.
2. Validate canonical valid and invalid synthetic examples against the schema.
3. Run provider conformance through the real boundary parser/serializer and
   authorization/context resolution, with downstream ports controlled.
4. Run each repository-owned consumer's serialization and deserialization
   against the same versioned examples or generated contract fixtures.
5. Compare the proposed contract against the accepted baseline: additive changes
   pass under the documented compatibility policy; removal, narrowing, changed
   required fields, or incompatible semantic changes fail unless explicitly
   approved with versioning and migration guidance.
6. Test `TenantCreated` metadata, tenant/correlation propagation, fact semantics,
   and consumer tolerance of supported additive fields. Retry/idempotency
   behavior remains an integration/application responsibility as well.

Tests must prove both provider and consumer directions. Merely validating a
payload against the current schema is insufficient because it does not detect
compatibility with the previous accepted contract or actual consumer behavior.

### Pact 17.1.2 — DEFERRED

Pact is purpose-built for consumer-driven interaction contracts and provider
verification. Its current npm metadata supports Node `>=22`, is MIT licensed,
and brings a substantial dependency/FFI footprint. A broker can add deployment
coordination but also introduces service operation, credentials, availability,
retention, and data-classification concerns.

The first slice has no evidenced independently released consumer that cannot
share repository-owned versioned schemas and fixtures. Pact would not replace
schema governance, functional provider tests, event semantic tests, or additive
compatibility policy. Select it later only when independently deployed teams or
external consumers demonstrate consumer-expectation drift that schema-based
provider/consumer tests cannot manage economically. That later decision must
cover Pact specification version, broker ownership or offline artifact exchange,
publication security, and `can-i-deploy` lifecycle.

No other contract framework is justified by current requirements.

## Tenant-isolation verification

Tenant isolation is an architectural and security invariant, not a new test
level or framework. TOOL-006 is satisfied by mandatory test design and review
criteria across TOOL-003, TOOL-004, and TOOL-005:

- unit/application: missing, malformed, unauthorized, expired, and mismatched
  pre-tenant/tenant context is rejected before side effects; tenant and
  correlation values are explicit through commands and ports;
- integration: tenant A cannot read, update, delete, enumerate, deduplicate, or
  replay tenant B state; queries and uniqueness/idempotency scope match the
  approved contract; persistence and audit/event records carry the right owner;
- contract: API/event schemas require the applicable context, provider parsing
  rejects unsafe context, consumers preserve it, and diagnostics do not expose
  another tenant's existence or data;
- fixtures: every tenant-owned object names its synthetic tenant and lifecycle;
  multi-tenant scenarios use visibly distinct IDs and data, with cleanup scoped
  to the test namespace.

For Tenant Onboarding specifically, tests must distinguish authorized
pre-tenant authority from the issued post-creation tenant context, prove that a
failed bootstrap administrator does not expose an ACTIVE tenant, and prove that
one authority cannot read, mutate, or replay another onboarding result.

No generic `tenant-test` command is selected because it would encourage a silo
that other suites could omit. Test names/tags and review diagnostics should make
tenant assertions discoverable, while the stable level commands always execute
them.

## Security and supply chain

- Test code and fixtures may not contain production data, credentials, tokens,
  personal data, or confidential payloads. Synthetic responsible-person data
  must use reserved/non-deliverable addresses and numbers.
- Test diagnostics, snapshots, contract examples, coverage, and retained
  artifacts must be reviewed for tenant data and secrets. Snapshot updates
  require semantic review; bulk acceptance is prohibited.
- Tests must verify authorization before persistence, identity, audit, and event
  side effects and verify prohibited sensitive fields are absent from logs and
  events.
- Direct dependencies are exact-pinned. The pnpm lockfile supplies resolved
  transitive versions and integrity. Installation uses `--frozen-lockfile` in
  automation. Registry provenance, advisories, licenses, and package lifecycle
  must be reviewed at adoption and upgrade.
- Vitest and its coverage provider are MIT. Testcontainers, Pact, Jest, and
  Cypress candidates are MIT; Playwright is Apache-2.0; Artillery is MPL-2.0.
  k6 licensing and distribution must be re-verified when performance tooling is
  selected because it is deferred and not an npm dependency in this baseline.
- Container images are separate supply-chain artifacts and require immutable
  references, scanning, minimal privileges, and no host-network or privileged
  mode unless separately approved.

## Operational impact

Unit tests remain fast and infrastructure-free. Contract tests run without a
broker or live external system. Integration tests may become slower and require
a container runtime only after an adapter-specific decision activates
Testcontainers; commands must clearly report this prerequisite and support
resource cleanup. Coverage adds CPU/memory and should be a distinct command.

The root `test` command becomes the local delivery interface. Workspace packages
may expose narrower scripts, but ownership remains with their service/application
and root orchestration must not discover undeclared ad hoc suites. CI-provider
selection, workflow triggers, caches, artifact retention, and hosted runtime
remain outside TD-004.

## Exact-version strategy and compatibility evidence

Proposed direct pins on approval:

| Package | Pin | Evidence available on 2026-08-23 | Gate |
| --- | --- | --- | --- |
| `vitest` | `4.1.11` | npm registry: Node `^20 || ^22 || >=24`, MIT; upstream docs: Vite/ESM runner, mocking and coverage | Required now; verify an implementation smoke test with the approved baseline |
| `@vitest/coverage-v8` | `4.1.11` | npm registry: exact Vitest peer `4.1.11`, MIT | Required now for coverage command; keep exactly aligned with Vitest |
| `testcontainers` | `12.0.4` | npm registry: MIT, 15 dependencies, no declared Node engine; upstream runtime documentation | Do not add until a selected adapter requires it and Node 24/ESM smoke verification passes |

Do not use `latest`, caret, tilde, wildcard, workspace catalog range, or an
unpinned container tag for a selected direct test dependency. Upgrade through a
focused change that reads release/migration notes, refreshes the frozen lockfile,
runs TypeScript/architecture/unit/integration/contract checks, and reviews
license/advisory/transitive changes. Vitest documents that TypeScript definition
changes can occur between minor releases, reinforcing exact pins.

Registry metadata proves declared engine compatibility, not behavioral
compatibility with TypeScript `6.0.3` and NodeNext. Approval therefore authorizes
installation for a focused implementation task, whose acceptance criteria must
include a TypeScript/ESM smoke test and the full repository checks before the
tool is baselined.

## First slice versus deferred capabilities

### Required now for Tenant Onboarding

- Vitest unit tests for lifecycle, duplicate detection, idempotency,
  authorization-before-side-effect, application orchestration, explicit context,
  and safe failures;
- Vitest integration tests for the API adapter and selected persistence/identity/
  audit/event adapters, with real dependencies only where their later decisions
  require them;
- repository-owned API provider/consumer compatibility tests because the
  approved surface is a backend API;
- repository-owned `TenantCreated` schema, provider, and consumer-direction
  compatibility tests because the product contract requires the event;
- tenant-isolation and pre-tenant/post-tenant negative cases in all applicable
  suites;
- synthetic tenant-owned fixtures and stable root commands.

### Deferred until concrete requirements exist

- Testcontainers installation and any container image until persistence or
  another adapter is selected;
- Pact until independently released consumer/provider coordination justifies it;
- Playwright/Cypress until an approved public UI journey exists;
- k6/Artillery until workload, thresholds, target environment, data model,
  tenant safety, and operational ownership are approved;
- event broker integration tests until TD-007 selects eventing infrastructure;
- persistence-specific reset/migration tooling until TD-008;
- CI adapter changes and CI-provider selection.

## Deferred E2E assessment

### Playwright — PREFERRED WHEN NEEDED, DEFERRED

Playwright Test provides TypeScript support, isolated browser contexts,
auto-waiting locators, tracing, parallelization, and Chromium/WebKit/Firefox.
The assessed npm release `1.62.1` declares Node `>=20` and Apache-2.0; current
official system requirements explicitly support Node 24. Its browser binaries
and OS dependencies create a significant download/cache and patching footprint.
It is preferred for a future approved web journey because cross-browser
coverage, isolation, and trace diagnostics fit CI and tenant-boundary journeys.

### Cypress — REJECTED FOR THE FIRST SLICE, DEFERRED ALTERNATIVE

Cypress `15.21.0` declares Node 24 support and MIT licensing and offers strong
interactive debugging and automatic waiting. It also downloads a substantial
desktop/browser test binary and uses a different browser execution model.
There is no UI to test, so selecting either tool now is unjustified. When a UI
slice exists, compare its real cross-browser, multi-context, authentication,
trace, and team-debugging needs against Playwright before final selection.

## Deferred performance assessment

### k6 — DEFERRED LEADING CANDIDATE

k6 provides a standalone/containerized load generator, JavaScript test scripts,
thresholds, and a strong metrics model. It is not governed by Node/pnpm runtime
compatibility in the same way as repository TypeScript tools, which can improve
load-generator isolation but adds binary/image distribution and a separate
JavaScript runtime. Exact version, license, extension model, output backend, and
image provenance require verification at selection time.

### Artillery — DEFERRED ALTERNATIVE

Artillery `2.0.34` is Node-based, declares Node `>=22.18.0` (compatible with
Node `24.18.0`), and is MPL-2.0. It integrates naturally with JavaScript/TypeScript
hooks but adds a large Node dependency and plugin footprint. Neither candidate
can be selected without approved workloads, thresholds, environment capacity,
tenant-safe data, rate limits, observability, and ownership.

## Migration and rollback

### Adoption

1. Obtain decision-owner approval.
2. Add exact Vitest and coverage pins through pnpm; update the shared lockfile in
   the implementation change, not this proposal.
3. Add minimal Node-environment projects and stable root commands.
4. Add deterministic synthetic factories with explicit tenant ownership.
5. Implement unit, contract, and adapter tests at the lowest meaningful level.
6. Add Testcontainers only through the adapter decision and smoke gate described
   above.
7. Run strict TypeScript, architecture checks, all test commands, frozen install,
   and dependency/license/advisory review before baselining.

### Rollback

Keep tests on standard `describe`/`test`/`expect` usage and isolate Vitest-specific
configuration/helpers. If Vitest fails the Node 24/TypeScript 6/NodeNext smoke
gate, remove its unbaselined dependencies/configuration and implement the same
stable commands using compiled `node:test`; no production/domain contract
changes are required. If conditional Testcontainers is unreliable, retain the
runner and replace only the adapter lifecycle with repository fixtures or a
separately approved ephemeral environment. Pact, E2E, and performance deferral
requires no rollback because they are not installed.

## Consequences and risks

The selection gives one coherent developer API, direct TypeScript/ESM execution,
good diagnostics, and low-level-to-contract reuse without making the first
slice depend on UI or performance infrastructure. The costs are Vitest/Vite
transitives, careful separation from Node's production resolver, and discipline
against mock-heavy tests.

Remaining risks are explicit:

- behavioral compatibility of Vitest `4.1.11` with TypeScript `6.0.3` and the
  repository's exact NodeNext configuration needs an installation-time smoke
  test; no dependency was installed during this decision;
- Testcontainers `12.0.4` declares no Node engine, and no selected persistence or
  container image exists, so it cannot be baselined now;
- TD-006 must define API schema representation and compatibility rules in
  executable detail; TD-007 must do the same for event representation and
  delivery; TD-008 must define persistence lifecycle/reset semantics;
- coverage thresholds, performance workloads, and a UI journey have no approved
  evidence and are intentionally not invented;
- the readiness document retains historical discovery text before its appended
  product approval; this proposal treats the dated product-owner approval and
  current BACKLOG entry as the controlling evidence.

## Approval and implementation gate

Quality Engineering, API and Integration Engineering, Security, and the Tenant
Management owner approve the TOOL-003 through TOOL-006 mapping and the
cross-cutting tenant policy recorded here on 2026-08-23.

The technology strategy is approved, but the executable baseline is **NOT
IMPLEMENTED**. This approval authorizes a later, separately reviewed
implementation task to install exact pins for `vitest@4.1.11` and
`@vitest/coverage-v8@4.1.11` and to add the repository configuration, stable
commands, fixtures, and tests needed to pass the documented smoke and
verification gates. It does not itself authorize or perform implementation.

Testcontainers remains conditional and is not approved for installation or
baselining until a selected real infrastructure adapter requires it and its
compatibility gate passes. Pact, browser tooling, performance tooling,
persistence-specific testing infrastructure, event-broker-specific tooling,
and CI-provider configuration remain deferred and outside this approval.

## Evidence reviewed

Repository evidence:

- ADR-0002 through ADR-0006;
- technology decision inventory and TOOL-003 through TOOL-006 registry entries;
- testing and quality README files named in the task;
- first-product-slice readiness assessment and approved Tenant Onboarding
  product contract;
- AGENTS.md, SECURITY.md, BACKLOG.md, TD-001 through TD-003 baseline.

Authoritative upstream evidence, accessed 2026-08-23:

- [Vitest 4 documentation](https://v4.vitest.dev/guide/) for installation,
  features, mocking, coverage, migration, and releases; the
  [Vitest repository](https://github.com/vitest-dev/vitest) for license and
  releases;
- [npm registry](https://www.npmjs.com/) metadata for `vitest@4.1.11`,
  `@vitest/coverage-v8@4.1.11`, `testcontainers@12.0.4`,
  `jest@30.4.2`, `@pact-foundation/pact@17.1.2`,
  `@playwright/test@1.62.1`, `cypress@15.21.0`, and
  `artillery@2.0.34`;
- [Node.js 24 `node:test` documentation](https://nodejs.org/download/release/v24.15.0/docs/api/test.html);
- [Jest 30 ESM](https://jestjs.io/docs/30.0/ecmascript-modules),
  [transformation](https://jestjs.io/docs/30.0/code-transformation),
  [configuration](https://jestjs.io/docs/30.0/configuration), and
  [upgrade](https://jestjs.io/docs/30.0/upgrading-to-jest30) documentation;
- [Testcontainers for Node.js](https://node.testcontainers.org/) container and
  runtime documentation;
- Pact [consumer](https://docs.pact.io/consumer),
  [provider](https://docs.pact.io/provider), and
  [specification](https://docs.pact.io/implementation_guides/pact_specification)
  documentation;
- [Playwright installation and system requirements](https://playwright.dev/docs/intro);
- [Cypress system requirements](https://docs.cypress.io/app/references/requirements);
- [Grafana k6 installation documentation](https://grafana.com/docs/k6/latest/set-up/install-k6/).
