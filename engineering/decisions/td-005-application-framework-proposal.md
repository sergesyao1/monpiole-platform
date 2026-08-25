# TD-005: Application Framework



* Decision ID: TD-005

* Status: **APPROVED**

* Date: 2026-08-25

* Governing decision: ADR-0002 — Technology Selection Gate

* Decision owner: Architecture owner

* Scope: Application framework selection only



## Problem statement



MonPiole now has approved baselines for:



* Node.js;

* strict TypeScript;

* native ECMAScript modules;

* pnpm workspaces;

* architecture dependency enforcement;

* testing strategy and tooling.



The platform requires an application framework capable of exposing APIs, composing dependencies, integrating cross-cutting concerns, supporting asynchronous workloads, and providing an operational application runtime without violating the existing Clean Architecture and Domain-Driven Design boundaries.



The framework must not become the owner of MonPiole's domain model or business architecture.



## Governing architectural constraints



The framework selection must comply with ADR-0001 through ADR-0006 and the approved TD-001 through TD-004 decisions.



In particular:



1\. Domain code must remain independent from application frameworks.

2\. Domain code must not depend on HTTP, persistence, messaging, telemetry, configuration, or infrastructure implementations.

3\. Application code must expose explicit use cases and ports.

4\. Bounded Contexts remain owned under `services/`.

5\. Applications and interfaces remain separate from service-owned business logic.

6\. Public APIs and events remain explicit versioned contracts.

7\. Tenant and correlation context must remain explicit at architectural boundaries.

8\. Authorization must occur before security-relevant side effects.

9\. Shared packages must remain domain-neutral.

10\. Architecture dependency rules must remain statically enforceable.

11\. Framework selection must remain compatible with pnpm workspaces, native ESM, strict TypeScript, Vitest, and dependency-cruiser.



## Requirements



The application framework must:



* support Node.js and TypeScript;

* operate with native ESM;

* integrate cleanly with pnpm workspaces;

* permit framework-independent Domain and Application layers;

* provide a controlled composition model;

* support dependency injection or equivalent dependency composition;

* support HTTP APIs;

* support validation at external trust boundaries;

* support middleware-like cross-cutting processing;

* support authentication and authorization integration;

* support explicit tenant and correlation propagation;

* support exception/error mapping;

* support application lifecycle management;

* support asynchronous/background workloads;

* support events or event integration without coupling Domain to the framework;

* support logging, tracing and OpenTelemetry integration;

* support unit and integration testing;

* remain compatible with the existing Vitest baseline;

* allow independently evolvable Bounded Contexts;

* avoid imposing a persistence technology;

* avoid imposing an event broker;

* avoid requiring a microservices-first deployment topology.



## Candidates evaluated



The following candidates were evaluated:



1\. NestJS

2\. Fastify

3\. Express



### NestJS



NestJS provides a structured application framework with:



* modules;

* controllers;

* providers;

* dependency injection;

* guards;

* pipes;

* interceptors;

* middleware;

* lifecycle management;

* exception filters;

* application configuration integration;

* asynchronous application patterns;

* background and scheduled processing integration;

* testing utilities;

* transport abstraction.



Its primary architectural risk is framework leakage.



NestJS makes it easy to introduce decorators and framework dependencies throughout application code. Without explicit boundaries, Domain and Application layers could gradually become framework-dependent.



This risk is acceptable only if MonPiole constrains NestJS to composition and external adapter responsibilities.



### Fastify



Fastify provides:



* HTTP routing;

* plugins;

* lifecycle hooks;

* encapsulation;

* schema-based validation;

* TypeScript support;

* strong HTTP performance characteristics.



Fastify provides excellent control over framework independence and has a small application surface.



However, several architectural capabilities required by MonPiole would need to be designed or selected separately, including application-level dependency injection conventions, composition conventions, broader background-processing integration and some cross-cutting application patterns.



This increases MonPiole-owned framework infrastructure.



### Express



Express provides:



* HTTP routing;

* middleware;

* request/response handling;

* broad ecosystem compatibility.



Its deliberately minimal design gives complete architectural freedom.



However, MonPiole would need to design or select additional solutions for:



* dependency injection;

* module composition;

* validation conventions;

* authorization structure;

* background application lifecycle;

* structured cross-cutting concerns;

* application-level testing conventions.



This creates a larger custom application framework surface than is justified for the baseline.



## Comparative evaluation



| Criterion                                | Weight | NestJS | Fastify | Express |

| ---------------------------------------- | -----: | -----: | ------: | ------: |

| Clean Architecture / Domain independence |    25% |  4.5/5 |     5/5 |     5/5 |

| Bounded Context modularity               |    15% |    5/5 |     4/5 |     3/5 |

| Dependency composition                   |    10% |    5/5 |   3.5/5 |     2/5 |

| API / validation / security integration  |    10% |    5/5 |   4.5/5 |   3.5/5 |

| Testability                              |    10% |  4.5/5 |     5/5 |     5/5 |

| Tenant / correlation integration         |    10% |    5/5 |   4.5/5 |     4/5 |

| Events / jobs / asynchronous work        |     5% |    5/5 |   3.5/5 |   2.5/5 |

| Observability integration                |     5% |    5/5 |   4.5/5 |     4/5 |

| Node / TypeScript / ESM / pnpm fit       |     5% |  4.5/5 |     5/5 |     5/5 |

| Maintained architecture surface          |     5% |  4.5/5 |     4/5 |     3/5 |



Weighted assessment:



* NestJS: approximately 94/100

* Fastify: approximately 89/100

* Express: approximately 80/100



The scores are engineering assessments against MonPiole's accepted architectural constraints. They are not workload benchmarks.



## Recommendation



Adopt **NestJS as MonPiole's application and composition framework**, subject to architecture-owner approval and a separately governed implementation task.



NestJS must be treated as an external application framework rather than as the architecture of the business domain.



The approved dependency direction remains:



```text

Interfaces

&#x20;   |

&#x20;   v

Application

&#x20;   |

&#x20;   v

Domain



Infrastructure

&#x20;   |

&#x20;   +----> implements ports defined by inner layers

```



NestJS belongs primarily to the composition and interface boundary.



A more explicit representation is:



```text

&#x20;                 NestJS

&#x20;                   |

&#x20;           Composition Root

&#x20;                   |

&#x20;       +-----------+-----------+

&#x20;       |                       |

&#x20; HTTP Interfaces         Event Consumers

&#x20;       |                       |

&#x20;       +-----------+-----------+

&#x20;                   |

&#x20;                   v

&#x20;             Application

&#x20;                   |

&#x20;                   v

&#x20;                Domain





Infrastructure ----> Application / Domain ports

```



## Framework boundary rules



### Domain



The Domain layer must not import:



* `@nestjs/common`;

* `@nestjs/core`;

* NestJS decorators;

* NestJS dependency injection tokens;

* NestJS HTTP abstractions;

* NestJS configuration abstractions;

* NestJS event abstractions;

* NestJS persistence integrations.



Domain entities, Value Objects, Aggregates, Domain Services, Domain Events and policies remain plain TypeScript.



### Application



Application use cases should remain framework-independent wherever practical.



Application code may define:



* commands;

* queries;

* use cases;

* ports;

* application DTOs;

* application results;

* orchestration.



Application services must not require NestJS lifecycle or HTTP abstractions to execute business behavior.



NestJS providers may adapt application components at the composition boundary where needed.



### Interfaces



NestJS-specific components belong naturally in the Interfaces layer.



This includes:



* controllers;

* request DTO adapters;

* guards;

* pipes;

* interceptors;

* exception filters;

* transport consumers;

* framework-specific authentication adapters.



Controllers must remain thin.



They:



1\. accept external input;

2\. validate and adapt that input;

3\. resolve required context;

4\. invoke an application use case;

5\. translate the result to the external contract.



Controllers must not own core business rules.



### Infrastructure



Infrastructure adapters may integrate with NestJS when needed for lifecycle and composition.



Persistence, messaging, external providers and technical integrations remain adapters implementing inner-layer ports.



The Domain must never resolve dependencies through the NestJS container.



## Dependency injection strategy



NestJS dependency injection is approved only for application composition.



Dependency injection must not force framework types into Domain contracts.



Preferred pattern:



```text

NestJS Module

&#x20;     |

&#x20;     +--> creates infrastructure adapter

&#x20;     |

&#x20;     +--> binds adapter to application port

&#x20;     |

&#x20;     +--> creates application use case

&#x20;     |

&#x20;     +--> exposes interface adapter

```



Ports should remain ordinary TypeScript interfaces, abstract contracts or equivalent framework-neutral abstractions.



Framework-specific provider tokens belong to the outer composition layer.



## Bounded Context strategy



NestJS modules must not redefine MonPiole Bounded Contexts.



The source of truth remains:



```text

services/

├── audit/

├── billing/

├── identity/

├── notifications/

├── reporting/

├── tenant-management/

└── workflow/

```



A NestJS module may compose components belonging to a Bounded Context, but the module itself does not become the ownership boundary.



Cross-context imports remain governed by ADR-0006 and TD-003.



NestJS module imports must never be used as justification for direct access to another service's Domain, Application, Infrastructure or persistence internals.



## API strategy



NestJS controllers may expose HTTP APIs.



Public API DTOs and schemas remain explicit contracts governed by ADR-0003.



The following must remain distinct when their semantics differ:



* HTTP request representation;

* application input;

* domain model;

* persistence representation;

* public response contract.



An ORM entity, domain entity or internal aggregate must not automatically become an HTTP contract.



## Runtime validation



TypeScript types are erased at runtime and cannot validate external data.



All external trust boundaries must perform runtime validation.



This includes:



* HTTP requests;

* events;

* external provider payloads;

* configuration;

* untrusted serialized data.



TD-005 does not select the final validation/schema technology unless separately approved.



## Tenant and correlation context



ADR-0004 remains authoritative.



NestJS request-scoped mechanisms, asynchronous context mechanisms, middleware or interceptors may assist propagation but must not create hidden global tenant state.



Tenant and correlation identifiers must remain explicit at trust boundaries.



Missing or invalid tenant context must be rejected before authorization-sensitive or data-changing operations.



The Domain must not resolve tenant state from the NestJS container.



## Authorization



Guards may provide interface-level authorization controls.



However, transport-level authorization does not replace business authorization.



Application use cases must continue to enforce authorization requirements relevant to business side effects.



Privileged and security-relevant operations must remain auditable.



## Events and asynchronous processing



NestJS may provide composition and adapters for:



* event consumers;

* jobs;

* queues;

* scheduled processing;

* asynchronous handlers.



Domain Events remain Domain concepts and must not depend directly on NestJS event APIs.



Integration Events remain versioned external contracts governed by ADR-0003.



Handlers must support the required:



* tenant context;

* correlation context;

* idempotence;

* retry safety;

* observability.



No broker or queue technology is selected by TD-005.



## Persistence



TD-005 does not select an ORM, database client or persistence technology.



NestJS persistence integrations must not create framework dependencies inside Domain.



Repository and persistence adapters remain Infrastructure concerns.



## Observability



NestJS may provide integration points for:



* logging;

* metrics;

* tracing;

* correlation;

* OpenTelemetry instrumentation.



Observability concerns remain outside Domain rules.



Logging must avoid leaking:



* secrets;

* credentials;

* tenant-sensitive payloads;

* personal or confidential information.



## Testing implications



The existing Vitest baseline remains authoritative.



Framework-independent Domain and Application tests must execute without starting a NestJS application where practical.



Expected testing layers include:



### Unit



Plain TypeScript Domain and Application behavior.



### Integration



NestJS composition and technical adapters.



### Contract



Public APIs and integration events.



### Tenant



Tenant resolution, propagation and isolation behavior.



### Architecture



Dependency-cruiser and repository-owned architecture tests must verify framework boundaries.



At minimum, architecture enforcement should be able to reject imports such as:



```text

services/*/domain/** -> @nestjs/**

```



and equivalent framework leakage.



## HTTP adapter



NestJS supports different HTTP platform adapters.



TD-005 selects the application framework, not the final HTTP engine.



The initial baseline may use the lowest-complexity supported adapter.



Selecting or switching to Fastify as the NestJS HTTP adapter may be evaluated separately based on:



* compatibility;

* measured performance;

* plugin requirements;

* operational evidence.



No performance claim justifies selecting an HTTP adapter without representative workload evidence.



## Security considerations



Adopting NestJS increases the dependency and framework surface of the platform.



Implementation must therefore:



* pin exact approved versions through the existing pnpm baseline;

* review transitive dependencies;

* use frozen installations;

* monitor security advisories;

* minimize optional NestJS packages;

* avoid importing large framework modules without demonstrated need;

* validate all external input;

* preserve authorization before side effects;

* prevent hidden tenant state;

* keep secrets outside source code;

* ensure exception responses do not expose internals;

* avoid sensitive-data leakage through logs and tracing.



Framework guards, validation and interceptors are supporting controls and do not replace application and domain security rules.



## Operational considerations



NestJS adds an application container and lifecycle model.



Implementation must measure rather than assume:



* startup time;

* memory consumption;

* request latency;

* throughput;

* event-loop delay;

* graceful shutdown behavior;

* background worker behavior.



CPU-heavy operations must remain isolated from request/event-loop execution when evidence demonstrates the need.



## Migration strategy



There is currently no competing production application framework baseline to migrate.



Implementation should therefore proceed incrementally.



1\. Approve TD-005.

2\. Create a separately governed implementation task.

3\. Pin the selected NestJS version.

4\. Add only the minimum required NestJS packages.

5\. Create one minimal non-business bootstrap.

6\. Prove native ESM and pnpm compatibility.

7\. Prove Vitest integration.

8\. Prove dependency-cruiser detects Domain → NestJS violations.

9\. Prove one framework-independent application use case.

10\. Prove one thin controller adapter.

11\. Prove explicit tenant and correlation propagation.

12\. Only then apply the baseline to the first product slice.



The implementation spike must not introduce persistence, authentication providers, brokers, deployment infrastructure or business functionality unless separately governed.



## Rollback strategy



Before product behavior depends on NestJS, rollback consists of removing:



* NestJS dependencies;

* bootstrap source;

* composition modules;

* NestJS-specific test fixtures;

* related configuration.



Domain and Application fixtures must remain usable because they are framework-independent.



After business functionality exists, framework replacement must occur at outer boundaries while preserving:



* application use cases;

* Domain behavior;

* public contracts;

* integration events;

* persistence ports;

* tenant/context contracts.



Framework independence is therefore both an architectural requirement and the primary rollback mechanism.



## Major risks and mitigations



| Risk                                                   | Mitigation                                                            |

| ------------------------------------------------------ | --------------------------------------------------------------------- |

| NestJS becomes the architecture                        | Keep ADR-0005/0006 as architectural source of truth                   |

| Decorators leak into Domain                            | TD-003 forbidden-import rules and architecture fixtures               |

| Application use cases depend on NestJS DI              | Compose plain use cases from outer NestJS providers                   |

| Bounded Contexts become Nest modules                   | Keep repository/service ownership independent from framework modules  |

| Request-scoped DI becomes hidden tenant state          | Explicit tenant/context values at architectural boundaries            |

| Controllers accumulate business logic                  | Thin-controller convention plus tests/review                          |

| NestJS DTOs become Domain models                       | Separate external contracts, application input and Domain concepts    |

| Framework event API replaces Domain/Integration Events | Keep Domain Events framework-neutral and Integration Events versioned |

| ORM integration leaks into Domain                      | Infrastructure adapters only                                          |

| NestJS testing utilities replace plain unit tests      | Domain/Application unit tests remain framework-independent            |

| Framework dependencies grow uncontrolled               | Minimal package adoption and supply-chain review                      |

| HTTP adapter choice is prematurely optimized           | Defer until measured workload evidence exists                         |

| Framework replacement becomes expensive                | Restrict framework dependencies to external layers                    |



## Alternatives



### Fastify as the primary application framework



Not selected as the preferred baseline.



Fastify is technically strong and provides excellent HTTP performance, plugin encapsulation and low framework coupling.



However, MonPiole would need to own more application-level composition and convention infrastructure.



Fastify remains a candidate HTTP adapter beneath NestJS if separately justified.



### Express as the primary application framework



Not selected.



Express provides excellent flexibility and ecosystem maturity, but too many application-level concerns would need separate technologies or repository-owned conventions.



Its minimalism does not provide enough net benefit for the current MonPiole architecture.



### Custom framework



Rejected.



Building a MonPiole-specific application framework would add unnecessary maintenance and security surface with no demonstrated requirement.



## Consequences



### Positive



* structured application composition;

* mature dependency injection;

* strong HTTP integration;

* explicit cross-cutting extension points;

* reduced need for custom application infrastructure;

* support for asynchronous application workloads;

* strong TypeScript ecosystem fit;

* compatibility with MonPiole's existing runtime baseline.



### Negative



* additional dependency surface;

* framework lifecycle and DI concepts to govern;

* risk of decorator/framework leakage;

* more architectural discipline required to keep Domain independent;

* possibility of overusing NestJS modules as business boundaries.



## Recommendation



**Recommend NestJS as MonPiole's application and composition framework.**



The recommendation is conditional on one invariant:



> NestJS is an outer application framework. It does not own MonPiole's Domain, Bounded Context model, business rules or architectural dependency direction.



The framework must remain replaceable at external boundaries.



## Implementation gate



No NestJS dependency may be installed solely because this document recommends it.



Implementation requires:



1\. architecture-owner approval of TD-005;

2\. a separate implementation task;

3\. exact-version review;

4\. supply-chain review;

5\. minimal dependency selection;

6\. native ESM verification;

7\. pnpm workspace verification;

8\. Vitest verification;

9\. architecture-rule verification;

10\. rollback evidence.



## Approval gate



The architecture owner must explicitly:



* approve;

* reject; or

* request revision.



Approval must confirm:



* NestJS as the application/composition framework;

* framework-independent Domain;

* framework-independent Application where practical;

* NestJS-specific code limited to appropriate outer layers;

* continued authority of ADR-0005 and ADR-0006;

* explicit tenant/correlation propagation;

* separation of Domain Events and Integration Events from framework mechanisms;

* deferred persistence technology;

* deferred broker technology;

* deferred HTTP-adapter optimization;

* compatibility with TD-001 through TD-004;

* implementation and rollback gates.



TD-005 is APPROVED. NestJS implementation remains subject to the separately governed implementation gate defined below.



## Architecture owner approval

Approved on 2026-08-25.

The architecture owner explicitly approves NestJS as MonPiole's application and composition framework, subject to the architectural constraints, security controls, implementation gates, migration strategy, rollback strategy, and dependency-boundary rules documented in TD-005.

Approval confirms that:

- NestJS is an outer application/composition framework;
- Domain remains framework-independent;
- Application remains framework-independent where practical;
- NestJS-specific code is restricted to appropriate outer layers;
- ADR-0005 and ADR-0006 remain authoritative for architectural boundaries;
- tenant and correlation context remain explicit;
- Domain Events and Integration Events remain independent from framework-specific event mechanisms;
- persistence technology remains undecided;
- broker/event transport technology remains undecided;
- HTTP adapter optimization remains deferred until justified by evidence;
- TD-001 through TD-004 remain authoritative dependencies;
- implementation requires a separately governed implementation task.

Approval does not authorize uncontrolled dependency installation or business-feature implementation.
