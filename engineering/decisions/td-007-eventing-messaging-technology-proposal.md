# TD-007: Event Contract Baseline and Messaging Technology Boundary

- Status: **APPROVED**
- Decision date: 2026-08-25
- Governing decision: ADR-0002 — Technology Selection Gate
- Decision owners: Architecture, Integration Engineering, Security, bounded-context owners
- Scope: Integration Event contract representation and broker-independent delivery invariants
- Broker status: **DEFERRED — NOT SELECTED**

## 1. Status

TD-007 approves the executable Integration Event **contract baseline**. It
deliberately does not select a message broker, messaging protocol, Node client,
broker topology, deployment model, or managed provider.

Approval authorizes a separately governed broker-independent implementation
task. It does not authorize dependency installation, event publication,
consumer runtime implementation, persistence, broker infrastructure, or product
behavior.

## 2. Context

ADR-0003 makes Integration Events explicit, versioned compatibility
commitments. ADR-0004 requires tenant and correlation context at event and
asynchronous processing boundaries. ADR-0005 and ADR-0006 keep Domain and
Application independent of infrastructure while allowing bounded contexts to
integrate through owned public contracts.

The approved Tenant Onboarding product contract requires a `TenantCreated`
event after effective tenant creation, and TD-004 requires repository-owned
event schema/provider/consumer compatibility tests. That evidence justifies a
contract representation baseline. It does not yet identify an approved
consumer, fan-out/routing requirement, throughput, latency, retention, replay,
ordering, availability, recovery, or operational ownership requirement.
Selecting RabbitMQ or another broker without those facts would violate the
ADR-0002 requirement to select technology for an evidenced problem.

## 3. Repository evidence

- TD-001 provides Node 24+, strict TypeScript and native ESM/NodeNext.
- TD-002 provides pnpm workspaces and exact dependency governance.
- TD-003 provides automated dependency enforcement.
- TD-004 selects Vitest schema, provider, consumer and compatibility tests for
  events without preselecting event infrastructure.
- TD-005 keeps Domain Events, Integration Events and broker mechanisms distinct
  and does not select a broker.
- TD-006 selects Zod 4 for executable HTTP transport contracts while requiring
  transport contracts to remain separate from Application and Domain models.
- TASK-017 implements Zod 4 and architecture enforcement preventing Zod from
  leaking into Domain or Application.
- ADR-0006 assigns shared event contracts to `packages/events` while each
  bounded context retains ownership of its business semantics and reactions.
- `.codex/tasks/TASK-006-03-inter-service-contracts.md` requires explicit,
  versioned, tenant/correlation-aware and backward-compatible event contracts.
- The current dependency graph contains no selected broker client or messaging
  runtime. A NestJS optional peer is not a technology selection.

## 4. Decision

### 4.1 Event concepts and ownership

1. Domain Events and Integration Events are distinct concepts.
2. Domain Events express facts inside their owning Domain and remain plain,
   framework-independent Domain values.
3. Integration Events are explicit, versioned inter-service contracts governed
   by ADR-0003.
4. Zod 4 is the canonical executable schema technology for Integration Events.
5. HTTP DTO/contracts and Integration Event contracts remain separate even
   when both use Zod. Shape similarity never authorizes reuse across meanings.
6. JSON encoded as UTF-8 is the canonical serialized representation.
7. `packages/events` owns shared event-envelope primitives, executable schemas,
   serialization/parsing helpers and contract fixtures only.
8. Integration Engineering governs shared envelope mechanics; the producing
   bounded context owns the semantic name, version and payload contract.
9. Business/domain implementations, consumer behavior and broker adapters must
   not live in `packages/events`.
10. Application and infrastructure integrate through explicit,
    broker-independent ports such as an owning service's
    `IntegrationEventPublisher`. Ports belong to the bounded context that needs
    them; `packages/events` does not become a service locator or adapter package.

### 4.2 Clean Architecture rules

Domain code must not depend on:

- Zod or another transport schema library;
- RabbitMQ or AMQP abstractions;
- Kafka, NATS, JetStream or Redis Streams;
- `@nestjs/microservices` messaging APIs;
- `amqplib` or another broker client;
- broker topology, delivery tags, acknowledgements or transport headers.

Application code may define and invoke framework-neutral ports and plain
inputs. It must not import broker clients, NestJS messaging APIs or physical
topology. Infrastructure implements publisher adapters. Interfaces implement
consumer adapters that validate/map/invoke/translate and contain no principal
business rules. Integration Event schemas never become Domain Events,
Application commands or persistence models.

## 5. Canonical Integration Event envelope

Every Integration Event has an explicit envelope:

| Field | Requirement |
| --- | --- |
| `eventId` | Required globally unique event identifier. It identifies one logical event and remains stable across redelivery or transport retry. |
| `eventType` | Required stable namespaced contract identifier. It must not be derived from a TypeScript class name, broker routing key, queue, topic or deployment name. |
| `eventVersion` | Required explicit contract version using one repository-approved convention. It identifies the payload/envelope compatibility contract, not a deployment version. |
| `occurredAt` | Required RFC 3339 UTC timestamp for when the represented fact occurred. It is not broker publication time. |
| `correlationId` | Required end-to-end correlation identifier. A new root flow creates one before publication. It is not authority or a credential. |
| `causationId` | Optional identifier of the command/message/event that directly caused this event, propagated when known. Absence must be represented by omission, not fabricated causation. |
| `producer` | Required stable identity of the producing bounded context, never a hostname, process, pod or adapter implementation. |
| `tenantId` | Required for tenant-scoped events. It must be absent, not `null`, for platform-scoped events. It is untrusted on consumption and must be validated/authorized before side effects. |
| `payload` | Required contract-specific value, independently versioned, validated and owned by the producer. It must not expose a Domain entity or persistence record. |

The implementation task must define exact identifier syntax and event version
format before publishing any product contract. Optional envelope members use
absence rather than `null` unless a later product contract explicitly defines
different semantics.

## 6. Serialization and validation

- Canonical wire data is JSON UTF-8. JavaScript classes, prototypes, `Date`,
  `bigint`, functions, buffers and implicit transformations are not wire
  representations.
- Producers validate the complete envelope and payload strictly before handing
  a serialized event to an infrastructure port. Invalid output is a producer
  defect and must not be published.
- Consumers validate untrusted bytes before mapping to a framework-independent
  input or performing authorization and side effects.
- Runtime validation is distinct from TypeScript compile-time typing.
- Broker headers may duplicate selected metadata for routing/operations when a
  later decision approves it, but they are not the canonical event contract.
- Deserialization must be bounded and fail safely. It must not instantiate
  arbitrary classes or execute payload-controlled code.

## 7. Contract evolution and compatibility

- Additive evolution is the default, in accordance with ADR-0003.
- Producer schemas are strict: unknown output fields indicate an unreviewed
  producer contract change.
- Consumers must tolerate approved additive fields. Consumer parsing must not
  reject a compatible event solely because a later producer added an optional
  field permitted by the compatibility policy.
- Removing or renaming fields, making an optional field required, narrowing
  accepted values, changing meaning, or changing identifier/time semantics is
  breaking unless proven otherwise.
- Breaking changes require explicit approval, a new supported contract version,
  migration guidance and provider/consumer compatibility evidence.
- Unknown or incompatible `eventType`/`eventVersion` values fail safely. They
  must not be blindly retried as transient failures.
- Contract tests consume canonical schemas and synthetic examples. They must
  verify the producer, every repository-owned consumer direction, additive
  compatibility and rejection/redaction behavior.

## 8. Delivery invariants

TD-007 assumes **at-least-once delivery** for future messaging designs. It does
not claim platform-wide or end-to-end exactly-once processing.

- Every side-effecting consumer requires a documented and tested idempotency
  strategy.
- Acknowledgement occurs only after contract validation and successful durable
  completion of all effects required before that message may be forgotten.
- A crash or shutdown before that point must leave the delivery unacknowledged
  or otherwise recoverable under the later transport contract.
- Retry is bounded. Infinite immediate or delayed requeue loops are prohibited.
- Retry policy distinguishes transient failures from permanent failures.
- A later flow must define backoff, attempt counting and an attempt limit.
  Attempt state must survive whatever republish/redelivery mechanism is chosen;
  a volatile process counter is insufficient.
- Poison, syntactically invalid, unauthorized-tenant, unsupported-contract and
  retry-exhausted messages require a quarantine/dead-letter outcome rather than
  blind retry.
- Dead-letter inspection, redrive and replay are controlled, observable,
  auditable, authorized and tenant-safe. They must not expose sensitive payloads
  or allow cross-tenant action.
- Redelivery and deliberate replay are distinct operational intents. Each
  consumer must define how idempotency history interacts with projection rebuild
  or other approved replay.
- Consumer concurrency, in-flight work and backpressure are bounded and
  configurable. A consumer must not accept unbounded deliveries or side effects.
- Graceful shutdown must stop new work and either complete or safely return
  unacknowledged work according to the later adapter contract.

## 9. Ordering

No global event ordering is assumed or promised. `occurredAt` is not a reliable
total ordering key. Consumers must tolerate concurrent and out-of-order events.

Ordering by aggregate, subject or another key is guaranteed only when an
approved product contract explicitly requires it and defines the key,
producer guarantees, gap/duplicate behavior and recovery semantics. TD-007 does
not add an aggregate or sequence field to every event.

## 10. Transactional Outbox and Inbox

Transactional Outbox is conditionally required when committed persistent
business state must reliably produce an Integration Event. The invariant is:

- committed state must not lose its required event; and
- an event representing rolled-back state must not be published.

TD-007 selects that consistency invariant, not a persistence implementation.
TD-008 owns database technology, schemas, tables, indexes, migrations,
transactions, polling/CDC, leasing, cleanup, retention and recovery details.

Every side-effecting consumer requires idempotency. A durable Inbox or durable
deduplication mechanism is required only when natural idempotency or an owned
business uniqueness constraint cannot safely prevent duplicate effects. The
behavior is mandatory; the storage pattern is conditional. Any persistent
Inbox implementation and its tenant-scoped keys, retention and transaction
semantics belong to TD-008.

## 11. Tenant and security requirements

- Tenant-scoped events require `tenantId`; platform-scoped events omit it.
- A consumer treats `tenantId`, `producer` and all payload data as untrusted.
- Tenant scope and authority are validated before any side effect.
- Credentials, tokens, secrets and private keys are forbidden in envelope and
  payload contracts.
- Personal, confidential and tenant-sensitive data is minimized to what the
  approved consumer contract requires.
- Persistence models, provider exception data, stack traces and infrastructure
  internals are forbidden as contract payloads.
- Logs, metrics, traces, test fixtures, DLQ diagnostics and replay tooling must
  not expose sensitive payloads or credentials.
- Operational transport encryption is required when a broker is selected. Its
  certificate/provider/deployment implementation is deferred.
- Future producer and consumer credentials use least privilege and separate
  publish/consume/topology permissions where supported.
- Event size is bounded by an explicit future flow requirement. Large binary
  payloads are not embedded by default; an approved owned-object reference
  pattern requires its own authorization, lifetime and integrity rules.

## 12. Observability semantics

Consumers and publishers must expose enough safe operational evidence to
identify contract version, producer/consumer, outcome, latency, attempt,
retry/exhaustion, dead-letter outcome and correlation without logging sensitive
payloads. Security-relevant redrive/replay actions are auditable.

TD-007 establishes these semantic requirements only. Logging, metrics, tracing,
telemetry SDK, backend, retention, dashboards and alerting technologies remain
TD-012-owned.

## 13. Broker selection gate

A future broker decision requires an approved measurable flow defining at
minimum:

1. producing bounded context and operation;
2. consuming bounded contexts and their side effects;
3. fan-out and routing behavior;
4. expected and peak throughput;
5. maximum and representative event size;
6. latency objective;
7. retention and expiry;
8. replay/redrive requirements;
9. ordering requirements and key, if any;
10. availability and acceptable data-loss/unavailability bounds;
11. recovery, disaster recovery and failure-mode expectations;
12. security/data classification and network trust boundaries;
13. operational ownership and support expectations;
14. local/integration test needs and runtime/deployment constraints.

That decision must compare candidates against the flow, select exact protocol
and product versions, assess Node client compatibility, licenses, provenance,
advisories, transitive dependencies, lifecycle scripts, operational burden and
rollback/migration. A reserved infrastructure directory or optional framework
peer is not approval.

## 14. Explicitly deferred and not selected

TD-007 does **not** select or authorize:

- RabbitMQ;
- AMQP or AMQP 0-9-1;
- `amqplib`;
- `@nestjs/microservices` for messaging;
- Kafka;
- NATS or JetStream;
- Redis Streams;
- any broker topology;
- exchanges, queues, topics, bindings or routing keys;
- physical DLQ/DLX resources;
- broker deployment, clustering or managed messaging provider;
- broker credentials, certificates or network policy;
- Outbox/Inbox persistence technology;
- telemetry technology.

These are not rejected permanently. They remain candidates subject to their
own evidenced ADR-0002 gate.

## 15. Testing and verification strategy

TD-004 remains authoritative. A broker-independent baseline must use Vitest to
prove:

- valid and invalid envelopes and payloads;
- tenant-scoped versus platform-scoped `tenantId` behavior;
- required correlation and optional causation;
- RFC 3339 UTC and identifier syntax;
- strict producer validation;
- consumer tolerance of approved additive changes;
- rejection of incompatible versions and unsafe values;
- deterministic JSON UTF-8 round trips;
- absence of persistence/domain objects and sensitive fields;
- provider and consumer compatibility fixtures;
- architecture rules preventing Zod/event-contract technology from entering
  Domain/Application and preventing broker technology from entering inward
  layers.

Broker delivery, acknowledgement, retry, backpressure, DLQ and reconnection
integration tests remain deferred until a broker and client are selected.

## 16. Implementation boundary

The separately governed TASK-018 may implement only the broker-independent
executable event-contract baseline: a `packages/events` workspace, Zod schemas,
the envelope, JSON helpers, synthetic fixtures, Vitest contract/compatibility
tests, tenant/correlation invariants and architecture enforcement.

It must not implement a network publisher/consumer, topology, physical DLQ,
Outbox/Inbox persistence, product event behavior, database, telemetry SDK,
container or deployment infrastructure.

`TenantCreated` is required by the product contract, but its exact payload and
publication behavior require separately approved product-contract scope. The
technology fixture must not invent them.

## 17. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Zod schemas become Domain models | Contract-only package, explicit mapping and architecture rules |
| Shared package centralizes business ownership | Envelope governance by Integration Engineering; semantic payload ownership stays with producer |
| Strict consumers break additive evolution | Separate strict producer and additive-tolerant consumer parsing plus compatibility tests |
| At-least-once creates duplicate effects | Mandatory idempotency strategy; conditional durable Inbox/equivalent |
| State commits without event | Conditional Transactional Outbox invariant; persistence deferred to TD-008 |
| Poison message loops forever | Failure classification, bounded retry and quarantine outcome |
| Replay crosses tenant or repeats privileged effects | Authorized, audited, tenant-safe replay with explicit idempotency interaction |
| Premature broker selection | Measurable product-flow gate before product/protocol/client selection |
| Sensitive data leaks into events or DLQ | Data minimization, schema tests, redacted diagnostics and access controls |
| No concrete telemetry selected | Require observable semantics now; defer SDK/backend to TD-012 |

## 18. Rollback and replacement

Before a product event is published, rollback removes the broker-independent
schemas/helpers/fixtures while leaving Domain/Application unchanged.

After an Integration Event becomes a compatibility commitment, replacement may
change Zod or serialization internals only after proving byte/semantic parity
against every supported artifact and consumer. Published event meanings and
versions cannot be silently rewritten. A future broker/client can be replaced
behind ports without changing Domain logic or canonical contracts.

## 19. Approval record

Approved on 2026-08-25:

- executable Integration Event contracts use Zod 4 and canonical JSON UTF-8;
- the envelope, versioning, tenant/correlation, compatibility, security and
  delivery invariants in this decision govern future event work;
- Clean Architecture and bounded-context ownership remain authoritative;
- TASK-018 may implement only the broker-independent baseline;
- broker, protocol, client, topology, persistence, telemetry and deployment
  selections remain deferred.

Final decision state:

> **TD-007 APPROVED — EVENT CONTRACT BASELINE; MESSAGE BROKER DEFERRED / NOT SELECTED.**
