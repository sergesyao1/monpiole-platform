# TASK-017 — TD-006 API Contract Representation Baseline Implementation

## Status

**DONE** — Phase 1 compatibility gate and Phase 2 baseline implementation complete

This result authorizes neither installation nor implementation. Phase 2 still
requires explicit owner approval. The gate is conditional on denying the
transitive `@scarf/scarf` install script before the first mutable installation
and reviewing the resulting lockfile.

Phase 2 was subsequently authorized and completed on 2026-08-25. The paragraph
above remains the historical Phase 1 gate condition; the implementation
evidence is recorded below.

## Objective

Determine whether the exact TD-006 candidates can safely enter the current
MonPiole Node 24, native-ESM, strict-TypeScript, NestJS 11, pnpm and Vitest
baseline, without changing manifests, the lockfile, runtime code or installed
dependencies.

## Governing decisions and constraints

- ADR-0001 through ADR-0006 and approved TD-001 through TD-006 govern this gate.
- Zod schemas are transport contracts, never Application inputs or Domain
  models.
- `nestjs-zod`, `@nestjs/swagger`, NestJS decorators and HTTP abstractions stay
  in `apps/api` or an owning service's explicit interface boundary.
- Domain and Application must not import any of the three selected libraries.
- Tenant/pre-tenant authority, correlation, request ID and idempotency remain
  explicit values; HTTP adapters map them to framework-independent inputs.
- This phase adds documentation only. It does not implement product behavior,
  controllers, schemas, DTOs, OpenAPI, persistence, messaging, authentication,
  telemetry or TD-007.

## Repository evidence

Audit date: 2026-08-25.

| Evidence | Observed baseline |
| --- | --- |
| Git | Clean at `38edd08e1face9237ffd8d312cef06336ef0dfe6` (`docs(api): approve TD-006 contract representation`) before this document was created |
| Runtime/package manager | Node.js `v24.18.0`; Corepack pnpm `11.22.0`; root engine `>=24.0.0` |
| Module/type system | Native ESM; `module`/`moduleResolution: NodeNext`; ES2024; strict TypeScript `6.0.3`; `verbatimModuleSyntax` |
| API composition | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` all `11.2.2` |
| Required Nest peers | `rxjs@7.8.2`; `reflect-metadata@0.2.2` |
| Testing | Vitest `4.1.11`; unit, integration and contract projects; real `/health` bootstrap test |
| Architecture | dependency-cruiser `18.2.0`; Domain already rejects all external npm technology; Application rejects adapter directories but not selected external packages by name |
| Workspace supply-chain settings | `minimumReleaseAge: 1440`; no `allowBuilds` entry yet; pnpm 11 defaults `strictDepBuilds` to true |
| License | Repository MIT; direct candidates MIT; expected transitives are MIT, Apache-2.0, or Python-2.0 |

The current API imports NestJS only in `apps/api/src`. The existing health
baseline contains no Domain or Application code. No `node_modules` directory
was present during the build-script policy inspection, and no install was run.

## Exact compatibility matrix

Registry metadata and published package manifests were inspected for the exact
versions, rather than relying only on framework documentation.

| Candidate | Concrete metadata | Compatibility result |
| --- | --- | --- |
| `zod@4.4.3` | MIT; no dependencies, optional dependencies, peers or engine declaration; explicit dual `import`/`require` exports for root, v3, v4, mini and locales; package is `type: module`; integrity, registry signature and SLSA provenance present; published 2026-05-04 | Compatible with Node 24 and NodeNext at package/export level. It imposes no conflicting NestJS, RxJS, reflection or TypeScript peer. Absence of an engine/TypeScript declaration is not proof of every runtime path, so Phase 2 must compile and execute schema/JSON-Schema smoke tests. |
| `nestjs-zod@5.5.0` | MIT; dual ESM (`.mjs`) and CJS exports plus DTO subpath; peer ranges: Nest common `^10 || ^11`, Swagger `^7.4.2 || ^8 || ^11`, RxJS `^7`, Zod `^3.25 || ^4`; Swagger peer optional; sole runtime dependency `deepmerge@^4.3.1`; no engine declaration; integrity, registry signature and SLSA provenance present; published 2026-07-25 | Exact current Nest `11.2.2`, RxJS `7.8.2`, Zod `4.4.3` and Swagger `11.4.7` satisfy every relevant peer range. NodeNext export shape is compatible. Community ownership and lack of an engine declaration require the focused Phase 2 smoke and golden tests. |
| `@nestjs/swagger@11.4.7` | MIT; CommonJS implementation exposed through an `import`/`default`/`require` export with types; peer ranges: Nest common/core `^11.0.1`, reflect-metadata `^0.1.12 || ^0.2.0`; optional peers class-transformer, class-validator and Fastify static; exact six direct runtime dependencies; integrity and two registry signatures present, but no provenance attestation was exposed by registry metadata; published 2026-08-17 | Nest `11.2.2` and reflect-metadata `0.2.2` satisfy its peers. Optional class validation/transformation and Fastify packages are not needed and must not be added. CJS consumption through the declared export is structurally compatible with NodeNext; Phase 2 must prove import, document creation and native-ESM build behavior. |

None of the three manifests declares a Node engine that excludes Node 24 or a
TypeScript peer that excludes TypeScript 6. Zod itself does not use RxJS or
reflection. `nestjs-zod` consumes the existing RxJS 7 peer. Swagger consumes
the existing reflection peer. These are metadata compatibility findings, not
a substitute for the Phase 2 compile/runtime verification.

## Expected transitive dependency graph

The graph below is the registry-resolution expectation without installation;
the generated lockfile remains authoritative and must be compared to it.

```text
zod@4.4.3
└── no runtime dependency

nestjs-zod@5.5.0
├── peers: @nestjs/common@11.2.2, rxjs@7.8.2, zod@4.4.3
├── optional peer: @nestjs/swagger@11.4.7
└── deepmerge@4.3.1

@nestjs/swagger@11.4.7
├── peers: @nestjs/common@11.2.2, @nestjs/core@11.2.2,
│            reflect-metadata@0.2.2
├── optional peers (must remain absent): class-transformer,
│            class-validator, @fastify/static
├── @microsoft/tsdoc@0.16.0
├── @nestjs/mapped-types@2.1.1
├── js-yaml@5.3.0
│   └── argparse@2.0.1
├── lodash@4.18.1
├── path-to-regexp@8.4.2
└── swagger-ui-dist@5.32.13
    └── @scarf/scarf@1.4.0
```

Findings:

- There is one Zod version and no second validation/schema implementation.
- No incompatible NestJS major is expected; mapped-types accepts Nest 10/11.
- No native addon or platform binary is declared in this graph.
- No direct candidate declares an install lifecycle script in its published
  manifest. Source-development `prepare`, build and test scripts are not
  registry-consumer install hooks.
- `@scarf/scarf@1.4.0` does declare `postinstall: node ./report.js` for install
  analytics. It is unexpected for deterministic OpenAPI generation and is the
  only dependency lifecycle script identified.
- `swagger-ui-dist` contributes about 11.8 MB unpacked and interactive UI assets
  even though TD-006 requires JSON publication, not interactive Swagger UI.
  Removing it by an override is not proposed because it is a required declared
  dependency of the exact Swagger candidate and an unproven graph mutation.

## Supply-chain findings

### Policy application

The candidates are older than the repository's 24-hour minimum release age and
need no age exclusion. pnpm 11.22 defaults `strictDepBuilds` to true: an
unreviewed lifecycle script fails installation. Phase 2 must first add this
explicit repository policy:

```yaml
allowBuilds:
  "@scarf/scarf": false
```

This is a fail-closed denial, not a weakening or bypass. `ignoreScripts: true`
and `dangerouslyAllowAllBuilds` must not be used. The first install must then
prove that no other lifecycle package appears.

### Provenance, maintainership, age and footprint

- Zod and `nestjs-zod` expose integrity, registry signature and SLSA provenance
  metadata. `@nestjs/swagger` exposes integrity and registry signatures but no
  registry provenance attestation in the inspected metadata.
- Zod and `nestjs-zod` each expose one npm maintainer in the inspected registry
  metadata. The latter is a community bridge and remains the focused ownership
  and account-compromise risk. Exact pinning plus HTTP/OpenAPI golden tests are
  mandatory for every upgrade.
- Swagger is maintained in the official Nest repository and exposes multiple
  Nest maintainers. All three candidates have recent, non-deprecated releases.
- Approximate unpacked sizes are Zod 4.56 MB, `nestjs-zod` 1.18 MB and Swagger
  0.45 MB; Swagger's UI transitive adds approximately 11.8 MB.
- Licenses are compatible permissive licenses: MIT for direct packages and most
  transitives, Apache-2.0 for Swagger UI/Scarf, and Python-2.0 for argparse.
  Phase 2 must preserve required notices and run the repository-selected
  license check if one exists by then.

### Advisory review

- GitHub's reviewed high-severity `GHSA-pm4m-ph32-ghv5` affects `js-yaml`
  `>=5.0.0 <=5.2.1` and is patched in `5.2.2`; expected `5.3.0` is outside the
  affected range.
- GitHub lists unreviewed `GHSA-hprg-jrj6-qhrw` against Zod up to `4.3.6`, with
  no supported package mapping or fixed-version metadata. Candidate `4.4.3` is
  later than the alleged affected range. Independently, successful syntactic
  validation must never be treated as SQL escaping or authorization.
- No reviewed advisory identified in the registry/GitHub metadata inspected
  blocks the expected exact graph as of 2026-08-25. This is a point-in-time
  review; Phase 2 must run an audit against the actual lockfile.

## Architecture impact and required enforcement

The current `domain-does-not-depend-on-external-technology` rule already rejects
all external npm imports from `services/*/domain` and should remain unchanged.
Application currently rejects adapter-directory imports, but does not reject
arbitrary external libraries. Phase 2 must add a narrow rule, for example
`application-does-not-depend-on-api-contract-technology`, matching imports of:

```text
zod
zod/**
nestjs-zod
nestjs-zod/**
@nestjs/swagger
@nestjs/swagger/**
```

The rule must apply to `services/*/application/**` and forbid only those module
families. It must not forbid framework-neutral internal application ports or
weaken existing rules. Deterministic violation fixtures are required for both
Domain and Application. Domain fixtures should prove each selected family is
rejected even though the generic rule already covers them; Application fixtures
must prove the new rule. Allowed fixtures must prove imports from the API
contract/interface boundary remain accepted.

Canonical schemas must not be placed in `packages/core`, `packages/shared`,
Domain or Application. A schema becomes a public transport compatibility
commitment, not a reusable business model. Nest-specific wrapper classes must
contain no duplicated fields or business rules and must not cross the mapper
into an Application use case.

## Smallest proposed implementation surface

Phase 2 should use the existing health application plus test-only technical
fixtures; it must not add a fake public business endpoint.

| Concern | Proposed location |
| --- | --- |
| Canonical wire schemas and header/problem primitives | `apps/api/src/contracts/v1/common/*.schema.ts` and `apps/api/src/contracts/v1/health/*.schema.ts` |
| NestJS Zod DTO wrappers | `apps/api/src/interfaces/http/v1/health/*.dto.ts`; thin wrappers only |
| Validation and response serialization | `apps/api/src/interfaces/http/validation/` and `apps/api/src/interfaces/http/serialization/`, composed in `app.module.ts` |
| RFC 9457 representation and exception mapping | `apps/api/src/contracts/v1/common/problem-details.schema.ts` and `apps/api/src/interfaces/http/errors/problem-details.filter.ts` |
| Correlation/request IDs | schemas in `contracts/v1/common`; extraction/generation adapter in `interfaces/http/context/`; explicit framework-neutral mapped value at the use-case boundary |
| Tenant/pre-tenant authority | transport syntax in `contracts/v1/common`; authenticated/authorized adapter in `interfaces/http/context/`; never fabricated by the technology fixture |
| Idempotency header | syntax/schema in `contracts/v1/common`; adapter in `interfaces/http/context/`; no storage or business semantics in this baseline |
| OpenAPI 3.1 bootstrap | `apps/api/src/openapi/create-openapi-document.ts` called from composition only |
| Deterministic JSON generation | `apps/api/src/openapi/normalize-openapi-document.ts` and `apps/api/src/openapi/generate-openapi.ts`; root `app:api:openapi` script |
| Published review artifact | `engineering/contracts/http/openapi.json`, generated deterministically and reviewed as a compatibility commitment |
| Structural verification | `tests/contract/openapi-structure.test.ts`; use a separately reviewed OpenAPI 3.1 validator only if native assertions are insufficient—no undeclared dependency is approved by this gate |
| Schema tests | `tests/contract/api-schema-baseline.test.ts` |
| HTTP contract tests | extend `tests/integration/api-health.test.ts` for media type, response schema and safe context headers; test-only Nest module/route fixtures under `tests/fixtures/api-contract/` for invalid input and Problem Details |
| OpenAPI completeness/golden tests | `tests/contract/openapi-completeness.test.ts` and normalized artifact comparison |
| Compatibility tests | `tests/contract/openapi-compatibility.test.ts` consuming the last approved `engineering/contracts/http/openapi.json`; start with explicit repository-owned checks, and gate any third-party comparator separately |
| Architecture fixtures | selected-library violations and allowed interface imports under `tools/quality/fixtures/` plus expected rule IDs in `architecture-check.mjs` |

The health endpoint remains an unversioned operational liveness probe. Public
product APIs will use `/v1/...`; the baseline should demonstrate version
metadata using a test-only fixture rather than changing health semantics.
OpenAPI normalization must sort object keys and semantic arrays, remove no
contract information, use a stable title/version/server policy, and produce
byte-stable UTF-8 JSON with a final newline. Generation and `git diff --exit-code`
against the committed artifact must be independently runnable.

## Exact proposed Phase 2 changes

Subject to separate approval, Phase 2 is expected to:

1. modify `apps/api/package.json` with exact runtime dependencies
   `zod@4.4.3`, `nestjs-zod@5.5.0`, and `@nestjs/swagger@11.4.7` only;
2. modify `pnpm-workspace.yaml` first to set `allowBuilds["@scarf/scarf"]` to
   `false`, without an age-policy exclusion;
3. regenerate and review `pnpm-lock.yaml`, verifying the expected graph and no
   unexpected optional peers, duplicate Zod, native binary or lifecycle script;
4. add the contract/interface/OpenAPI files, tests and generated artifact
   listed above;
5. modify the dependency-cruiser configuration, deterministic fixtures and
   architecture checker for explicit Domain/Application enforcement;
6. add only justified root scripts for deterministic OpenAPI generation and
   verification; preserve all TD-004 and TD-005 scripts;
7. update the API README, tooling registry and this task's evidence/status.

`class-validator`, `class-transformer`, Fastify, Pact, persistence, messaging,
authentication-provider and telemetry packages are expressly excluded.

## Verification plan for Phase 2

Before claiming implementation complete:

```text
node --version
corepack pnpm --version
corepack pnpm install --no-frozen-lockfile
corepack pnpm ignored-builds
corepack pnpm install --frozen-lockfile
corepack pnpm app:api:typecheck
corepack pnpm app:api:build
corepack pnpm app:api:openapi
corepack pnpm typecheck:tests
corepack pnpm test
corepack pnpm architecture:check
corepack pnpm audit --prod
git diff --check
git diff --stat
git status --short
```

Additional assertions must prove NodeNext imports, Zod parsing/serialization,
Zod 4 Swagger cleanup, OpenAPI version `3.1.x`, byte-stable generation,
structural completeness, actual HTTP/schema parity, RFC 9457 media/body shape,
context/idempotency header representation and backward compatibility. The
mutable install must stop if Scarf executes, any other build script appears,
or the lockfile differs materially from the expected graph.

## Rollback plan

Before product contracts exist, remove the three exact direct dependencies,
their reviewed lockfile nodes, the explicit Scarf denial only if no remaining
dependency needs it, the technical contract/OpenAPI files, generated artifact,
tests, scripts and selected-library architecture fixtures. Restore the TD-005
health baseline and rerun frozen install plus all baseline checks.

After any public contract is approved, do not delete or rewrite its artifact.
Replace only outer transport adapters and prove behavior/schema parity against
the last approved OpenAPI document before removing this stack. Domain and
Application require no rollback because they never depend on it.

## Phase 1 verification evidence

Executed on 2026-08-25:

| Command | Result |
| --- | --- |
| `corepack pnpm typecheck:tests` | PASS, exit 0; TypeScript emitted no diagnostic |
| `corepack pnpm test` | PASS, exit 0; Vitest 4.1.11: 4 files passed, 6 tests passed, duration 3.81 s |
| `corepack pnpm architecture:check` | PASS, exit 0; workspace, exports, resolver, graph, boundaries, cycles and diagnostics passed |
| `corepack pnpm app:api:typecheck` | PASS, exit 0; API strict TypeScript emitted no diagnostic |
| `corepack pnpm app:api:build` | PASS, exit 0; API native-ESM TypeScript build completed |

Before each script pnpm verified the existing lockfile supply-chain policy,
reported that the lockfile was current and that installed dependencies were
already up to date; no package was added and no resolution occurred. `test` and
`app:api:build` emitted non-fatal Windows `ENOENT` warnings while trying to
create missing dependency-cruiser `.bin` shims. The invoked tests/builds still
exited 0. This local link-state warning is an environment constraint to recheck
during the separately authorized frozen install in Phase 2.

Final Git evidence:

- `git diff --check`: PASS, exit 0;
- `git diff --stat`: no tracked diff, because this task document is new and
  untracked;
- `git status --short`: only
  `?? .codex/tasks/TASK-017-td-006-api-contract-baseline-implementation.md`.

No manifest, lockfile, runtime source, dependency selection, staging area or
commit was changed by Phase 1.

## Gate result

**READY_FOR_IMPLEMENTATION**

The exact direct candidates have mutually compatible peer ranges and compatible
published ESM/CJS export shapes for the approved baseline. No reviewed advisory
blocks the expected resolved versions. The only material entry risk is the
transitive Scarf analytics `postinstall`; pnpm's fail-closed policy can and must
deny it explicitly before installation. Failure to add that denial, an actual
lockfile that resolves outside the graph above, a new advisory, an unexpected
script/native binary, or failure of the NodeNext/runtime smoke tests changes
this result to **BLOCKED** or **REVISION_REQUIRED**—never to a silent version
substitution.

## Phase 2 implementation outcome

### Exact dependencies installed

Installed as exact `apps/api` runtime dependencies, with no substitution:

- `zod@4.4.3`;
- `nestjs-zod@5.5.0`;
- `@nestjs/swagger@11.4.7`.

The lockfile resolved the peer graph against NestJS `11.2.2`, RxJS `7.8.2`,
reflect-metadata `0.2.2` and the single Zod `4.4.3` instance. Optional
`class-validator`, `class-transformer` and Fastify peers were not installed.
No fourth direct dependency was added.

### Supply-chain outcome

`pnpm-workspace.yaml` now records the fail-closed decision:

```yaml
allowBuilds:
  "@scarf/scarf": false
```

The frozen installation passed with the lockfile current. `pnpm config get
allowBuilds` returned `{ "@scarf/scarf": false }`, and `pnpm ignored-builds`
listed Scarf as explicitly ignored. Its telemetry `postinstall` did not run.
The lockfile contains exactly the expected Swagger/Zod bridge graph reviewed in
Phase 1, including `swagger-ui-dist@5.32.13` and denied
`@scarf/scarf@1.4.0`.

### Baseline design implemented

- Canonical, strict, version-owned Zod schemas represent the technical request,
  response, context headers and RFC 9457 problem body under
  `apps/api/src/contracts/v1`.
- `POST /api/v1/contract-baseline` is a deliberately non-business technology
  fixture. It maps its validated DTO to a plain `ContractBaselineInput`; it
  creates no Domain entity, Application use case, persistence or side effect.
- The global strict `nestjs-zod` pipe validates request DTOs before controller
  execution. The global serializer interceptor parses every decorated response
  through the independent strict output schema and fails closed on divergence.
- `X-Tenant-Id` and `Idempotency-Key` are required and syntax-validated for the
  fixture. `X-Correlation-Id` is accepted only as a UUID or generated when
  absent. `X-Request-Id` is always server-generated. Both identifiers are
  returned. No request ID is accepted as authority.
- `@TenantContext("not-applicable")` provides an explicit pre-tenant route
  representation without creating Tenant Onboarding behavior or fabricating a
  tenant. No AsyncLocalStorage or hidden tenant state was introduced.
- The catch-all HTTP-boundary filter emits redacted
  `application/problem+json` with stable `type`, `title`, `status`, `code`,
  `correlationId`, and safe optional `{ path, code }` errors. Tests prove that
  raw input and Zod implementation names do not leak.
- Authentication/provider implementation remains absent. The OpenAPI builder
  defines a future bearer scheme, while this technical fixture explicitly
  declares `security: []` so documentation does not falsely claim enforcement.

### OpenAPI artifact strategy

`@nestjs/swagger` assembles route/operation/header metadata and `nestjs-zod`
contributes Zod 4 component schemas. `cleanupOpenApiDoc(..., { version: "3.1"
})` is mandatory. Repository-owned normalization sorts object keys and stable
string sets while preserving order-sensitive schema arrays.

`corepack pnpm app:api:openapi` compiles the native-ESM API and writes the sole
canonical artifact to `engineering/contracts/http/openapi.json`. No YAML copy
or public Swagger UI route exists. The artifact reports OpenAPI `3.1.0`, the
versioned operation, request/response schemas, RFC 9457 media type and required
headers. Two consecutive generations produced the identical SHA-256:

```text
D629B7586CC1834117308C9886FA6EA23E1B9071177D2B50FFB962BA0F2CF2B1
```

No fourth validation dependency was added. Structural validation is therefore
repository-owned and dependency-free: Vitest checks the OpenAPI version,
operation, media/schema references, stable components, response headers,
security declaration and obvious internal-name leakage. This is not a complete
OpenAPI meta-schema validator; selecting one remains a separately reviewed
future improvement.

### Architecture enforcement

Two narrow dependency-cruiser rules reject `zod`, `zod/*`, `nestjs-zod`,
`nestjs-zod/*`, `@nestjs/swagger` and `@nestjs/swagger/*` from both Application
and Domain. The existing generic Domain external-technology rule remains
unchanged. Separate violation fixtures import all three package families from
Application and Domain, and the repository-owned checker asserts all six edges
are reported. The rules match module names independently of pnpm hoisting and
do not weaken any existing boundary.

### Tests added

- `tests/contract/api-schema-baseline.test.ts`: strict request, invalid and
  unknown inputs, independent response schema, Problem Details, and explicit
  pre-tenant declaration;
- `tests/integration/api-contract-baseline.test.ts`: versioned HTTP route,
  request/response validation, context/idempotency behavior, generated IDs,
  RFC 9457 content type and redaction;
- `tests/contract/openapi-baseline.test.ts`: OpenAPI 3.1 structure,
  request/response/problem components and media, headers, stable naming,
  internal-name exclusion and repeat-generation determinism;
- two architecture violation fixtures covering six forbidden import edges.

Final aggregate result: **7 test files and 21 tests passed**. The contract-only
command reports **3 files and 10 tests passed**; integration reports **3 files
and 8 tests passed**. The remaining 3 tests are the unchanged unit baseline.

### Files created

- `.codex/tasks/TASK-017-td-006-api-contract-baseline-implementation.md`;
- `apps/api/src/contracts/v1/common/context.schema.ts`;
- `apps/api/src/contracts/v1/common/problem-details.schema.ts`;
- `apps/api/src/contracts/v1/contract-baseline/contract-baseline.schema.ts`;
- `apps/api/src/http/contract-baseline/contract-baseline.controller.ts`;
- `apps/api/src/http/contract-baseline/contract-baseline.dto.ts`;
- `apps/api/src/http/contract-baseline/contract-baseline.mapper.ts`;
- `apps/api/src/http/errors/problem-details.filter.ts`;
- `apps/api/src/http/errors/transport-validation.exception.ts`;
- `apps/api/src/http/request-context/request-context.decorator.ts`;
- `apps/api/src/http/request-context/request-context.interceptor.ts`;
- `apps/api/src/http/request-context/request-context.ts`;
- `apps/api/src/openapi/create-openapi-document.ts`;
- `apps/api/src/openapi/generate-openapi.ts`;
- `apps/api/src/openapi/normalize-openapi-document.ts`;
- `engineering/contracts/http/openapi.json`;
- `tests/contract/api-schema-baseline.test.ts`;
- `tests/contract/openapi-baseline.test.ts`;
- `tests/integration/api-contract-baseline.test.ts`;
- `tools/quality/fixtures/violations/services/billing/application/api-contract-technology.ts`;
- `tools/quality/fixtures/violations/services/billing/domain/api-contract-technology.ts`.

### Files modified

- `.codex/tooling/STEP-3-TOOLING-REGISTRY.md`;
- `apps/api/README.md`;
- `apps/api/package.json`;
- `apps/api/src/app.module.ts`;
- `package.json`;
- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml`;
- `tools/quality/architecture-check.mjs`;
- `tools/quality/dependency-cruiser.config.mjs`.

No file was deleted. Generated `apps/api/dist` output remains ignored and is
not part of the review surface.

### Final verification evidence

| Command | Exit/result |
| --- | --- |
| `corepack pnpm install --frozen-lockfile` | 0; policy passed, lockfile current, already up to date |
| `corepack pnpm typecheck:tests` | 0; no diagnostic |
| `corepack pnpm test` | 0; 7 files, 21 tests passed |
| `corepack pnpm architecture:check` | 0; workspace, exports, resolver, graph, boundaries, cycles and fixtures passed |
| `corepack pnpm app:api:typecheck` | 0; no diagnostic |
| `corepack pnpm app:api:build` | 0; native-ESM build passed |
| `corepack pnpm app:api:openapi` | 0; canonical JSON generated |
| `corepack pnpm app:api:contracts:check` | 0; 3 files, 10 tests passed |
| repeated OpenAPI generation and SHA-256 comparison | 0; byte-identical |

Final Git checks after implementation and documentation:

- `git diff --check`: exit 0; Git emitted only the existing working-tree line
  ending notice for the tooling registry;
- `git diff --stat`: exit 0; 9 tracked files, 208 insertions and 9 deletions
  (Git does not include new untracked files in this statistic);
- `git status --short`: 9 modified tracked files plus the new TASK-017,
  contract/HTTP/OpenAPI/test/fixture paths listed above;
- `git diff --cached --stat`: empty—nothing staged.

No file under `services/` or `engineering/decisions/` changed. A focused secret
scan found only the synthetic string `must-not-leak` used to prove validation
redaction and the documented word “bearer”; no credential or secret was added.
Nothing was committed.

### Limitations and residual risks

- Repository-owned structural assertions are strong for this surface but are
  not a full OpenAPI 3.1 meta-schema validator.
- `nestjs-zod` remains a single-maintainer community bridge and must stay exact
  pinned with golden contract review on upgrade.
- Swagger UI assets and Scarf remain transitive footprint even though no UI is
  exposed and Scarf execution is denied.
- The technical fixture is explicitly unauthenticated (`security: []`). Real
  public product operations must not copy that declaration; their separately
  selected authentication adapter and authorization policy must precede side
  effects.
- No prior approved product OpenAPI artifact exists yet, so compatibility tests
  establish the deterministic baseline but cannot compare product history.
- Tenant authorization, idempotency persistence/replay, telemetry, messaging,
  persistence, Tenant Onboarding and TD-007 remain non-goals.

## Final status

**DONE**

Every mandatory Phase 2 condition is proven without implementing Tenant
Onboarding, persistence, messaging, authentication-provider behavior or
TD-007.
