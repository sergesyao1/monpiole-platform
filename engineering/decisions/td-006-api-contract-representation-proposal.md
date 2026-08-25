# TD-006: API Implementation and Contract Representation

- Decision ID: TD-006
- Status: **APPROVED — NOT IMPLEMENTED**
- Date: 2026-08-25
- Governing decision: ADR-0002 — Technology Selection Gate
- Decision owners: Architecture owner, API Platform, Security, Tenant Platform
- Scope: HTTP API and transport-contract representation technology only

## 1. Status

This document records the approved technology direction. Approval does not
approve installation or implementation. No runtime dependency, controller,
DTO, schema, endpoint, or product behavior is introduced by TASK-016.

The decision is **APPROVED / NOT IMPLEMENTED**. Installation and implementation
remain subject to a separate governed task and the compatibility and
supply-chain gates defined below.

## 2. Context

MonPiole has approved and executable baselines for Node 24+, strict TypeScript,
native ESM/NodeNext, pnpm workspaces, dependency-cruiser, Vitest, and NestJS as
an outer application/composition framework. Tenant Onboarding is the approved
first product slice and the backend API is its first implementation surface.

ADR-0003 requires explicit, versioned API contracts, additive evolution by
default, migration guidance for breaking changes, and compatibility
verification. ADR-0004 requires explicit tenant and correlation context at
every API, command, persistence, logging, and audit boundary. ADR-0005 and
ADR-0006 prohibit transport/framework representations from becoming Domain or
Application models.

TD-005 deliberately did not select API schema, runtime validation, OpenAPI, or
serialization technology. TD-006 must close that gate before a public Tenant
Onboarding controller or concrete request/response contract is implemented.

## 3. Repository evidence

The proposal is primarily based on these repository facts:

- `package.json` pins Node `>=24.0.0`, TypeScript `6.0.3`, Vitest `4.1.11`, and
  uses native ESM.
- `apps/api/package.json` pins NestJS `11.2.2` and the Express platform adapter;
  it contains only the TD-005 health baseline.
- `apps/api/README.md` assigns API routing and OpenAPI delivery to API Platform
  and requires versioned contracts plus tenant/correlation propagation.
- TD-004 requires repository-owned provider/consumer compatibility tests and
  explicit tenant-isolation tests; Pact remains deferred.
- TD-005 confines NestJS to composition/interfaces, requires thin controllers,
  and distinguishes HTTP representations, application inputs, Domain models,
  persistence representations, and public responses.
- `engineering/product/tenant-onboarding-product-contract.md` approves an
  administrator-driven, privileged onboarding operation owned by
  `services/tenant-management`, an explicit pre-tenant authority, correlation,
  auditing, and caller-supplied idempotency behavior.
- The product contract forbids fabricating a normal tenant context before the
  tenant exists and requires authorization before side effects.
- The product contract requires stable observable failures, including
  validation, unauthorized/forbidden access, duplicate intent, idempotency
  conflict, dependency failure, and safe internal failure.
- The existing synthetic test fixtures already treat tenant and correlation
  identifiers as explicit values rather than ambient globals.
- ADR-0003 is policy, not a concrete schema or runtime-validation selection;
  TD-006 is therefore still required despite the NestJS baseline.

The technology-decision inventory still describes TD-005 and TD-006 as
deferred. For TD-005, the later approved decision and implemented TASK-015 are
the more recent evidence. This proposal does not rewrite that inventory or
falsely mark TD-006 implemented.

## 4. Requirements

The selected approach must:

1. represent request bodies, path/query parameters, headers, successful
   responses, and errors as explicit transport contracts;
2. infer useful strict TypeScript input/output types without treating static
   types as runtime validation;
3. validate every untrusted HTTP input at runtime before invoking an
   application use case;
4. validate or deterministically serialize public responses so internal fields
   cannot leak accidentally;
5. generate a deterministic OpenAPI document with sufficient fidelity for
   consumers and compatibility checking;
6. preserve separate transport, application, Domain, and persistence models;
7. integrate with NestJS 11 only in `apps/api` or service interface adapters;
8. support Node 24, ESM/NodeNext, strict TypeScript, pnpm, and Vitest;
9. define URI versioning, errors, tenant/correlation/request identifiers,
   authentication/authorization boundaries, and idempotency headers;
10. allow contract tests to consume the same schema representation used at
    runtime;
11. make OpenAPI drift and breaking changes visible in review;
12. minimize dependencies and repository-owned framework glue;
13. avoid logging or returning credentials, personal data, tenant-sensitive
    payloads, validation input values, or implementation details.

## 5. Constraints

- NestJS is an external composition/interface framework, not the architecture.
- Domain and Application code must not import NestJS, Zod, Swagger,
  `class-validator`, `class-transformer`, TypeBox, Ajv, HTTP types, or generated
  transport DTOs.
- Public schemas must never be Domain entities, aggregates, ORM entities, or
  persistence records.
- TypeScript types are erased; a type annotation or generic is not validation.
- Runtime validation cannot replace business invariants or authorization.
- OpenAPI generation cannot infer all runtime semantics or operation metadata
  without explicit input.
- DTO/schema reuse is allowed only within one transport-contract meaning;
  superficial shape similarity is not a reason to merge distinct contracts.
- No persistence, broker, telemetry platform, authentication provider, or
  deployment technology is selected here.
- ADR-0003 remains unchanged and authoritative.

## 6. Options evaluated

### Option A — NestJS DTO classes, class-validator, class-transformer, Swagger

Candidate stack:

- `class-validator@0.15.1`;
- `class-transformer@0.5.1`;
- `@nestjs/swagger@11.4.7`.

Strengths:

- first-class NestJS `ValidationPipe`, decorator, mapped-type, reflection, and
  Swagger integration;
- familiar NestJS conventions and mature examples;
- low custom adapter burden;
- good controller ergonomics and adequate Vitest testability.

Weaknesses:

- one contract is distributed across class property types, validation
  decorators, transformation decorators, Swagger decorators, and operation
  decorators;
- TypeScript reflection cannot recover unions, refinements, conditional rules,
  or erased generic semantics reliably;
- Swagger properties need explicit decorators or a compiler plugin; plugin
  inference adds build coupling and still cannot guarantee runtime/doc parity;
- `class-transformer` can perform implicit coercion or expose fields unless it
  is configured very carefully;
- classes are easily reused as application or Domain models, increasing
  framework leakage risk;
- request and response variants tend to produce decorator-heavy mapped DTO
  hierarchies and DTO/schema duplication.

OpenAPI drift risk is **high without strict conventions**: runtime validation
and published schemas derive from related but distinct decorator systems.
Contract tests can validate the generated document and actual HTTP responses,
but they do not naturally execute the same object as `class-validator`.

### Option B — Zod 4 schemas with NestJS and OpenAPI integration

Candidate stack:

- `zod@4.4.3`;
- `nestjs-zod@5.5.0`;
- `@nestjs/swagger@11.4.7`.

`nestjs-zod@5.5.0` declares compatibility with NestJS 10/11, Swagger 7/8/11,
RxJS 7, and Zod 3.25/4. Zod 4 has first-party JSON Schema conversion;
`nestjs-zod` uses that conversion for Zod 4 and supplies NestJS validation,
response serialization, DTO wrappers, response decorators, and Swagger
post-processing.

Strengths:

- one executable schema can provide runtime parsing, input/output inference,
  response filtering, test assertions, and JSON Schema generation;
- request and response schemas are plain values and can be composed without
  TypeScript decorator metadata;
- strong support for discriminated unions and precise parse errors;
- excellent direct Vitest testability without bootstrapping NestJS;
- smaller DTO/schema duplication risk than Option A;
- NestJS-specific DTO wrappers remain in the interface boundary while raw Zod
  schemas can remain transport-contract values;
- native ESM and current Node support are compatible with the repository.

Weaknesses:

- NestJS integration is community-maintained rather than owned by NestJS;
- route, method, status, security, header, and response metadata still require
  explicit NestJS/OpenAPI declarations;
- not every Zod construct maps faithfully to JSON Schema/OpenAPI. Zod effects,
  arbitrary refinements, transforms, `Date`, `Map`, `Set`, `bigint`, custom
  predicates, and input/output divergence can be unrepresentable or surprising;
- Swagger output requires the documented cleanup step, creating an integration
  seam that must be locked by tests;
- schema reuse can still accidentally merge transport semantics if ownership
  and naming are weak.

OpenAPI drift risk is **medium and controllable**. Structural constraints come
from the runtime schema, but operation metadata remains separate. MonPiole must
restrict public Zod schemas to OpenAPI-representable constructs and test the
fully assembled document plus real responses.

`@asteasolutions/zod-to-openapi@9.1.0` is a viable alternative Zod OpenAPI
generator. It is not recommended for the initial NestJS baseline because a
separate route registry would duplicate NestJS route and operation metadata.
It remains a rollback option if the `nestjs-zod` Swagger bridge proves
insufficient.

### Option C — TypeBox with Ajv and explicit OpenAPI integration

Candidate stack:

- `@sinclair/typebox@0.34.52`;
- `ajv@8.20.0`;
- `ajv-formats@3.0.1`;
- `@nestjs/swagger@11.4.7`.

Strengths:

- TypeBox schemas are JSON Schema objects, giving the strongest direct schema
  fidelity of the three library-based options;
- Ajv provides mature compiled runtime validation;
- TypeScript types are inferred from the same JSON Schema builder;
- the schema can be consumed directly by independent compatibility tooling;
- JSON Schema constraints encourage wire-safe representations.

Weaknesses:

- NestJS has no first-party TypeBox/Ajv validation and serialization pipeline;
- MonPiole would own pipes, error mapping, response validation/serialization,
  schema registration, and Swagger decorators/bridging;
- Ajv formats and coercion/unknown-property behavior require centralized,
  security-sensitive configuration;
- TypeBox's JSON-Schema-centric API is less idiomatic for application teams
  accustomed to TypeScript parsing libraries;
- more dependencies and more repository-owned integration code than Option B.

OpenAPI drift risk is **low for component schemas but medium for complete
operations**. The schema objects are already JSON Schema, yet NestJS route,
status, parameter, header, and security metadata remain separate.

This is the strongest fallback if OpenAPI/JSON Schema fidelity becomes more
important than NestJS integration cost or if Zod conversion limitations become
material in measured contracts.

### Option D — OpenAPI-first source document with generated TypeScript and Ajv

Candidate stack for evaluation:

- `openapi-typescript@7.13.0`;
- `@apidevtools/swagger-parser@12.1.0`;
- `ajv@8.20.0` and `ajv-formats@3.0.1`;
- repository-owned NestJS adapters.

Strengths:

- the published OpenAPI document is literally the source of truth;
- strongest contract-first review surface and compatibility-tool
  interoperability;
- no schema-generation drift because schemas are authored in the publication
  format;
- consumers can generate clients independently of server code.

Weaknesses:

- generated types and runtime validators introduce a generation pipeline and
  stale-artifact risk;
- substantial NestJS adapter and mapping burden;
- authoring complex OpenAPI YAML/JSON is less type-safe and less ergonomic than
  TypeScript schema builders;
- `openapi-typescript@7.13.0` declares a TypeScript `^5.x` peer requirement and
  therefore is not compatible with the repository's exact TypeScript `6.0.3`
  baseline without unsupported peer overrides;
- generated source/artifact policy and deterministic regeneration would need a
  separately proven convention.

This alternative is materially strong in API-first fidelity, but the current
TypeScript incompatibility and implementation burden disqualify it from the
initial baseline.

## 7. Comparative decision matrix

Scores are engineering assessments from 1 (poor) to 5 (strong) against the
current MonPiole repository, not universal product rankings.

| Criterion | Weight | A: Nest classes | B: Zod | C: TypeBox/Ajv | D: OpenAPI-first |
| --- | ---: | ---: | ---: | ---: | ---: |
| NestJS integration quality | 12% | 5.0 | 4.5 | 2.5 | 2.0 |
| TypeScript type safety | 8% | 3.5 | 4.5 | 4.5 | 3.0 |
| Runtime validation | 10% | 4.0 | 5.0 | 5.0 | 4.0 |
| OpenAPI fidelity/stability | 10% | 3.0 | 4.0 | 5.0 | 5.0 |
| DTO/Domain separation | 10% | 3.0 | 4.5 | 4.5 | 5.0 |
| Contract-first/API-first fit | 8% | 3.0 | 4.5 | 5.0 | 5.0 |
| Vitest and contract testing | 8% | 4.0 | 5.0 | 4.5 | 4.0 |
| Compatibility verification | 8% | 3.5 | 4.5 | 5.0 | 5.0 |
| Maintenance burden | 8% | 4.5 | 4.0 | 2.5 | 2.0 |
| Ecosystem maturity | 5% | 4.5 | 4.5 | 4.5 | 4.5 |
| Dependency footprint | 4% | 3.5 | 4.0 | 3.0 | 2.5 |
| ESM/NodeNext/Node 24 fit | 4% | 4.0 | 5.0 | 4.5 | 2.0 |
| Clean Architecture fit | 3% | 3.0 | 4.5 | 4.5 | 5.0 |
| Multi-tenant safety support | 2% | 3.5 | 4.5 | 4.5 | 4.5 |
| **Weighted result** | **100%** | **3.80** | **4.55** | **4.12** | **3.62** |

Multi-tenant safety is not supplied by any schema library. The scores reflect
how reliably each option can make context headers explicit and testable; actual
authorization and isolation remain MonPiole responsibilities.

## 8. Recommended technology

Adopt **Zod 4 schemas as the canonical executable
transport-contract representation**, with:

- `nestjs-zod` only in the NestJS interface/composition boundary for validation,
  DTO adaptation, output serialization, and Swagger integration;
- `@nestjs/swagger` for operation discovery, security/header/response metadata,
  OpenAPI document assembly, and publication;
- OpenAPI **3.1** as the publication format;
- Vitest contract tests consuming the same Zod schemas and the generated
  OpenAPI document.

This selection is not made merely because NestJS supports it. It is selected
because the executable schema reduces runtime/type/document duplication while
retaining adequate NestJS integration and lower maintenance than a custom
TypeBox/Ajv bridge.

The canonical direction is:

```text
Zod transport schema
  +--> inferred transport input/output types
  +--> runtime request parsing
  +--> runtime response filtering/verification
  +--> OpenAPI component schema
  +--> direct Vitest contract assertions

NestJS route metadata
  +--> path, method, status, security, headers, media types
  +--> assembled OpenAPI operation
```

Because two sources still participate in a complete operation, generation and
compatibility tests are mandatory. The recommendation reduces drift; it does
not pretend to eliminate it.

## 9. Exact dependency candidates and versions

Versions were read from the npm registry on 2026-08-25. They are candidates,
not installed or approved dependencies.

### Recommended implementation candidates

| Package | Exact candidate | Purpose | Status |
| --- | --- | --- | --- |
| `zod` | `4.4.3` | Canonical transport schemas, parsing, inferred types, JSON Schema conversion | Proposed |
| `nestjs-zod` | `5.5.0` | NestJS validation/serialization/Swagger bridge | Proposed, focused supply-chain review required |
| `@nestjs/swagger` | `11.4.7` | OpenAPI operation assembly and publication | Proposed |

No `class-validator`, `class-transformer`, TypeBox, Ajv,
`@asteasolutions/zod-to-openapi`, code generator, or Swagger UI alternative is
part of the recommended initial install.

Before implementation, the exact candidates must be rechecked against the then
current lockfile, NestJS `11.2.2`, TypeScript `6.0.3`, Node `24.18.0`, pnpm
policy, licenses, provenance, vulnerabilities, transitive graph, and ESM build.
Approval does not authorize floating ranges in MonPiole manifests.

## 10. API representation conventions

### Media and JSON model

- JSON request/response media type: `application/json`.
- Problem responses: `application/problem+json`.
- Public schemas use JSON-wire values only: objects, arrays, strings, finite
  numbers, booleans, and null when explicitly meaningful.
- Dates/times are RFC 3339 strings, never JavaScript `Date` objects on the wire.
- UUIDs and exact decimal/money values are strings when their precision or
  identity semantics must not depend on JSON number behavior.
- Public object schemas are strict by default; unexpected input properties are
  rejected rather than silently accepted.
- Transport names use documented lower camel case. Internal renaming happens
  in an explicit mapper, not hidden transformer decorators.

### Contract ownership and names

- Endpoint contracts belong to the owning public interface under an explicit
  version, not to `packages/shared` by convenience.
- Request and response schemas are distinct even when initially identical.
- Schema identifiers are stable, unique, and version-aware, for example
  `TenantOnboardingV1Request` and `TenantOnboardingV1Response`.
- HTTP request, application command, Domain aggregate, persistence record, and
  HTTP response are separate types with explicit mapping.

### API versioning

- Public API versioning uses URI major versions: `/api/v1/...`.
- NestJS URI versioning and the `/api` global prefix may implement this only in
  the composition/interface layer.
- The OpenAPI document has an independent semantic `info.version`; it must not
  be confused with the OpenAPI specification version.
- Additive compatible changes remain within a major API version. Breaking
  changes require a new URI major version, approval, migration guidance,
  parallel support/deprecation dates, and compatibility tests.
- The operational `/health` endpoint is outside the public product API contract
  and remains unversioned unless a later operational decision changes it.

## 11. Validation strategy

Validation occurs in ordered layers:

1. HTTP adapter limits content type and payload size before expensive parsing.
2. Boundary schemas validate path, query, header, and body values independently.
3. Authentication adapters validate credentials and create a framework-neutral
   principal; schemas never authenticate.
4. Tenant/pre-tenant context resolution validates representation and authority.
5. The controller maps validated transport values to an explicit application
   command/context.
6. Application and Domain code enforce authorization-relevant rules, business
   invariants, uniqueness intent, and lifecycle decisions.

Conventions:

- Input starts as `unknown`; only successful Zod parsing produces a transport
  value.
- No implicit coercion for JSON bodies. Path/query coercion is explicit per
  field and documented in OpenAPI.
- Public schemas must use Zod constructs that map faithfully to OpenAPI 3.1.
- Arbitrary transforms, custom predicates, `Date`, `bigint`, `Map`, `Set`, and
  other unrepresentable constructs are forbidden in published schemas.
- A refinement that cannot be represented in OpenAPI is a business/application
  rule or requires an explicit documented contract rule plus tests; it must not
  silently claim schema parity.
- Validation errors expose stable field locations and public error codes, not
  raw Zod issues, input values, stack traces, or library names.
- Successful responses are parsed through their output schema. Output mismatch
  is a server defect mapped to a redacted 500 problem and observable internally.

## 12. OpenAPI strategy

- Generate OpenAPI **3.1** deterministically from the running NestJS composition
  metadata and Zod component schemas.
- Use `nestjs-zod`'s required OpenAPI cleanup for Zod 4 integration.
- Explicitly document every operation's method, path, version, tags, security,
  request media/schema, response status/media/schema, tenant/correlation,
  idempotency headers, and all supported problem responses.
- Do not depend on reflection alone. Missing response or header schemas fail a
  contract completeness test.
- Normalize nondeterministic ordering before snapshots/diffs.
- Validate the assembled document against the selected OpenAPI 3.1 schema.
- Publish a JSON artifact named `openapi.json`; YAML may be derived for humans
  but is not a second source of truth.
- Publish the approved artifact through the delivery pipeline and, if an HTTP
  documentation route is enabled, apply environment/access policy explicitly.
  Interactive Swagger UI is not required by this decision.

### Drift controls

OpenAPI drift can occur when:

- a Zod schema changes but the operation references the wrong schema;
- a controller path/status/header/security decorator changes independently;
- Zod input and output types diverge through defaults/coercion/transforms;
- the integration bridge changes generated JSON Schema semantics;
- a response is documented but runtime code returns a different shape.

Required controls are:

1. normalized OpenAPI snapshot review;
2. structural validation of the generated document;
3. tests matching actual successful and error HTTP responses to their schemas;
4. a completeness test for operation responses and required headers;
5. compatibility comparison against the last approved published artifact;
6. exact-version upgrades with golden-contract review.

## 13. Error contract strategy

Adopt RFC 9457 Problem Details with `application/problem+json`.

Common representation:

| Member | Convention |
| --- | --- |
| `type` | Stable HTTPS URI identifying a documented public problem type |
| `title` | Stable short public title, not a stack/error message |
| `status` | HTTP status repeated as a number |
| `detail` | Optional safe occurrence detail; never implementation internals |
| `instance` | Optional non-secret occurrence URI/reference |
| `code` | Stable MonPiole machine code extension |
| `correlationId` | Correlation identifier returned for support/traceability |
| `errors` | Optional validation issue array with stable `path` and `code` only |

Required initial categories include invalid request, unauthenticated,
forbidden, tenant/pre-tenant context invalid, conflict/duplicate,
idempotency-key conflict, dependency unavailable, and internal error. Exact
Tenant Onboarding mappings require the implementation contract and product
semantics; TD-006 defines the representation, not new business behavior.

Exception filters are HTTP adapters. They map typed application failures to
public problems and must not expose exception class names, SQL/provider errors,
credentials, payloads, tenant-sensitive data, or Zod internals.

## 14. Tenant/correlation propagation strategy

### Tenant and pre-tenant authority

- Normal tenant-scoped APIs use the `X-Tenant-Id` request header as an explicit
  routing/context claim.
- The header is untrusted input. Its syntax is validated, then its authority is
  checked against the authenticated principal before side effects.
- Controllers pass a framework-neutral explicit tenant context to application
  use cases. Domain code never reads HTTP headers, NestJS request scope, or
  asynchronous global state.
- Tenant Onboarding occurs before the tenant exists. It must not accept or
  fabricate a normal `X-Tenant-Id`; it receives an authenticated, authorized
  pre-tenant platform authority from the authentication/authorization adapter.
- The issued tenant identifier becomes an explicit output and subsequent
  tenant context only after successful establishment.

### Correlation and request identifiers

- `X-Correlation-Id` is an end-to-end identifier. A caller may supply a valid
  UUID; otherwise the API creates one. The response always returns it.
- `X-Request-Id` is generated by MonPiole for each HTTP request, is not accepted
  as caller authority, and is always returned in the response.
- Correlation ID is propagated explicitly into application commands, ports,
  persistence/audit metadata, and later event contracts.
- Request ID remains an interface/operational identifier unless a specific
  audit contract requires it.
- Neither identifier is a credential or authorization input. Invalid values are
  rejected or replaced according to the published header contract; they are
  never interpolated unsafely into logs.

### Authentication and authorization adapter boundaries

- NestJS guards/adapters parse the `Authorization: Bearer` credential and call
  an Identity-owned verification port; no provider is selected here.
- The adapter returns a framework-neutral authenticated principal and explicit
  authority/claims, never the raw token.
- Interface-level guards reject missing/invalid authentication and broad route
  access before controller execution.
- Application use cases still enforce business authorization before any
  security-relevant side effect.
- Domain code receives only the business-relevant actor/authority values needed
  for its decision; it never imports guard, request, token, or NestJS types.
- Credentials are never included in commands, errors, schemas, logs, audit
  payloads, snapshots, or test fixtures.

## 15. Idempotency representation

- Mutating operations that declare idempotency, including Tenant Onboarding,
  require the `Idempotency-Key` HTTP request header.
- The key is an opaque, non-secret, case-sensitive ASCII string of 1–255
  characters using the published safe character set. It is validated before
  the use case and never interpreted as business data.
- Scope is at least authenticated actor/pre-tenant authority, operation, and
  API major version; persistence details are deferred to TD-008.
- The application command receives a framework-neutral idempotency key value.
- Same key plus same normalized intent returns the recorded semantic result;
  same key plus different intent returns the stable idempotency-conflict
  problem with no mutation.
- Logs/audit may record a safe fingerprint, not necessarily the raw key.
- The IETF `Idempotency-Key` document is still an expired Internet-Draft as of
  this proposal, so MonPiole treats the header name and semantics as an explicit
  versioned contract rather than claiming an RFC standard.

## 16. Contract testing strategy

The existing TD-004 Vitest baseline remains authoritative. No Jest or Pact is
introduced.

### Schema-level tests

- table-driven valid/invalid request examples execute the canonical Zod schema;
- strict unknown-property behavior, boundaries, formats, nullability, and
  input/output differences are asserted;
- no NestJS bootstrap is required.

### HTTP integration tests

- bootstrap the real NestJS composition root on an ephemeral loopback port;
- assert status, media type, headers, success body, and RFC 9457 errors;
- validate observed request/response bodies with the same canonical schemas;
- cover missing/invalid authentication, pre-tenant/tenant context,
  correlation, request ID, and idempotency representation before side effects.

### OpenAPI contract tests

- generate and normalize the complete OpenAPI document in memory;
- validate it structurally as OpenAPI 3.1;
- snapshot the approved normalized surface;
- assert every public operation declares security, context headers, success
  responses, and applicable problem responses;
- verify component names and references are stable and no internal model is
  exposed.

### Compatibility tests

- compare the candidate document with the last approved published OpenAPI
  artifact;
- fail on removed paths/operations, removed or newly required input fields,
  narrowed accepted values, widened response obligations that break consumers,
  changed status/media types, or removed headers/security schemes;
- allow additive optional fields only when consumers are tested to tolerate
  them;
- require explicit approval, a new major version, and migration guidance for
  breaking changes.

Consumers use the published OpenAPI artifact, not Domain types or server source.
Provider tests use both the generated document and canonical Zod schemas. This
preserves consumer independence while checking runtime/schema parity.

## 17. Clean Architecture boundary rules

Allowed dependency direction:

```text
NestJS controller / pipe / guard / filter / serializer
                    |
                    +--> versioned transport Zod schema
                    |
                    +--> explicit mapper
                              |
                              v
                    Application command/use case
                              |
                              v
                           Domain
```

Rules:

- Zod, `nestjs-zod`, Swagger, NestJS decorators, HTTP headers/status codes, and
  Problem Details adapters stay in `apps/api` or an owning service's explicit
  interface/contract boundary.
- Application inputs may be structurally similar but are plain framework- and
  schema-library-independent TypeScript values.
- Domain entities, Value Objects, Aggregates, Domain Events, and policies never
  implement or extend transport DTOs.
- Controllers validate/adapt/invoke/translate only; they do not decide business
  invariants, authorization outcomes, lifecycle, idempotency semantics, or data
  ownership.
- OpenAPI schemas never expose persistence records or cross-service internals.
- Architecture checks should add fixtures rejecting Domain/Application imports
  of the selected API/schema libraries during the separately approved
  implementation task; existing rules must not be weakened.

## 18. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Zod schema becomes a Domain model | Keep schemas in versioned transport ownership; explicit mappers and forbidden-import rules |
| OpenAPI operation metadata drifts from runtime | Generated-document snapshot, completeness checks, response validation, compatibility diff |
| Zod feature cannot map to OpenAPI | Restrict public schemas to representable constructs; fail generation; model wire-safe strings |
| DTO/schema duplication returns through wrappers | Canonical raw schema; wrappers contain no repeated fields/validation rules |
| `nestjs-zod` community bridge changes behavior | Exact pin, focused source/supply-chain review, golden OpenAPI and HTTP tests |
| Swagger reflection omits properties or responses | Explicit response/headers/security declarations and completeness tests |
| Output validation leaks input in errors/logs | Redacted filter; never report payloads or raw validation issues |
| Unknown fields enable mass assignment | Strict input objects and explicit application mapping |
| Coercion changes caller intent | No implicit body coercion; explicit documented path/query parsing |
| Client-supplied tenant ID is trusted | Authenticate, validate, authorize membership/authority, then create explicit context |
| Hidden request scope becomes tenant state | Pass tenant/pre-tenant and correlation values explicitly to use cases/ports |
| Idempotency key is treated as authentication | Keep opaque/non-secret; scope by verified principal and operation |
| Breaking schema ships as additive | Automated compatibility comparison plus owner approval gate |
| Dependency footprint grows | Install only three approved exact candidates after a separate implementation task |
| OpenAPI publication exposes privileged surface | Define environment/access policy and publish only intentional public metadata |

## 19. Rejected alternatives

### NestJS DTO classes as the canonical contract

Rejected as the preferred baseline. It has the best native NestJS ergonomics,
but distributes one contract across TypeScript, validation, transformation, and
Swagger metadata. That drift and decorator leakage risk conflicts with
MonPiole's API-first and replaceable-boundary goals.

### TypeBox/Ajv as the initial baseline

Not selected initially. Its JSON Schema fidelity is excellent, but MonPiole
would own materially more NestJS validation, serialization, error, and OpenAPI
integration. Retain it as the primary fallback if Zod-to-OpenAPI fidelity fails
representative contract tests.

### Hand-authored OpenAPI as the source of truth

Not selected initially. It is the strongest pure contract-first representation,
but requires code generation and custom runtime wiring. The current
`openapi-typescript@7.13.0` peer range excludes TypeScript 6, making the
evaluated toolchain incompatible with the approved baseline.

### ts-rest

Not selected. `@ts-rest/core@3.52.1` and `@ts-rest/nest@3.52.1` provide a strong
contract-first Zod abstraction and NestJS integration, but currently declare
Zod 3 peer compatibility rather than the recommended Zod 4 baseline. They also
introduce a second routing/contract framework above NestJS without a repository
requirement that justifies that additional abstraction.

### Separate Zod schemas and hand-written OpenAPI schemas

Rejected because it creates guaranteed schema duplication and the highest drift
surface without compensating repository value.

## 20. Implementation plan

Implementation requires a separate approved task. The smallest safe sequence is:

1. create and approve a separate TD-006 implementation task with Architecture,
   API Platform, Security, and Tenant Platform ownership;
2. recheck exact versions, licenses, advisories, provenance, transitive graph,
   ESM/Node/TypeScript/Nest peer compatibility, and pnpm age policy;
3. install only the three approved exact dependencies in `apps/api`;
4. add architecture fixtures forbidding selected transport/framework libraries
   from Domain and Application layers;
5. implement a non-business contract fixture proving Zod input/output parsing,
   NestJS validation/serialization, and OpenAPI 3.1 generation;
6. implement deterministic OpenAPI normalization, structural validation,
   publication artifact generation, and Vitest snapshots;
7. prove RFC 9457 error mapping and required context/idempotency header schemas
   without product logic;
8. define the versioned Tenant Onboarding HTTP contract from the already
   approved product contract before its controller;
9. add schema, HTTP, OpenAPI completeness, tenant/security, and compatibility
   tests;
10. only then implement the thin controller and framework-independent use case
    under their owning boundaries.

TD-008 persistence, authentication provider selection, and audit/event
infrastructure remain separately governed.

## 21. Verification commands

Proposal verification for TASK-016:

```text
git diff --check
git diff --stat
git diff -- engineering/decisions/td-006-api-contract-representation-proposal.md
```

Expected later implementation verification, not executed by TASK-016:

```text
corepack pnpm install --frozen-lockfile
corepack pnpm app:api:typecheck
corepack pnpm app:api:build
corepack pnpm typecheck:tests
corepack pnpm test
corepack pnpm architecture:check
git diff --check
```

The implementation task must also add stable commands for OpenAPI generation,
structural validation, snapshot/compatibility verification, and supply-chain
review before claiming the API contract baseline complete.

## 22. Rollback strategy

Before product API implementation, rollback removes the proposed schema,
Swagger, validation/serialization bridge, configuration, and contract fixtures;
the TD-005 health baseline remains executable.

After product contracts exist, rollback or replacement must preserve the
published OpenAPI behavior, versioned request/response/error semantics,
application use cases, Domain behavior, tenant/correlation/idempotency values,
and compatibility history. Replace only the outer schema and NestJS adapters,
then prove parity against the last approved contract artifact before removal.

If `nestjs-zod` becomes incompatible while Zod remains suitable, replace the
bridge with a small repository-owned NestJS pipe/interceptor and
`@asteasolutions/zod-to-openapi`, or reassess TypeBox/Ajv. Do not move Zod into
Application or Domain to avoid adapter replacement.

## 23. Decision gate

### Architecture approval

**Approved by the architecture owner on 2026-08-25.**

The architecture owner approves:

- Zod 4 as the canonical transport-contract schema representation;
- `nestjs-zod` and `@nestjs/swagger` limited to the outer interface/composition
  boundary;
- OpenAPI 3.1 generation/publication and mandatory drift controls;
- RFC 9457 errors;
- URI major versioning;
- explicit tenant/pre-tenant, correlation, request ID, authentication,
  authorization, and idempotency conventions;
- strict separation between transport contracts, application inputs, Domain
  models, and persistence models;
- Vitest schema/HTTP/OpenAPI/compatibility testing strategy;
- exact-version and supply-chain review before installation;
- continued authority of ADR-0003 through ADR-0006 and TD-001 through TD-005;
- persistence, messaging, authentication-provider, telemetry, and deployment
  selections remain out of scope.

Approval records the technology and conventions only. It does not authorize
dependency installation or API implementation. Candidate dependency versions
remain subject to exact compatibility, supply-chain, license, provenance, and
lockfile verification before installation.

Until a separate implementation task is approved:

> TD-006 remains **APPROVED — NOT IMPLEMENTED**. No candidate dependency may be
> installed and no public API contract/controller may be implemented from this
> decision alone.

## External technical evidence consulted

- NestJS validation documentation: <https://docs.nestjs.com/techniques/validation>
- NestJS OpenAPI types/parameters: <https://docs.nestjs.com/openapi/types-and-parameters>
- NestJS URI versioning: <https://docs.nestjs.com/techniques/versioning>
- Zod 4 JSON Schema conversion: <https://zod.dev/json-schema>
- `nestjs-zod` integration: <https://github.com/BenLorantfy/nestjs-zod>
- TypeBox JSON Schema/Ajv integration: <https://github.com/sinclairzx81/typebox>
- OpenAPI 3.1 specification: <https://spec.openapis.org/oas/v3.1.0.html>
- RFC 9457 Problem Details: <https://www.rfc-editor.org/rfc/rfc9457.html>
- IETF Idempotency-Key draft status:
  <https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/>
