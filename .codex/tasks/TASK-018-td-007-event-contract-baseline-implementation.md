# TASK-018 — TD-007 Event Contract Baseline Implementation

## Status

TODO

## Objective

Implement the smallest executable, broker-independent Integration Event
contract baseline approved by TD-007. Prove canonical Zod schemas, JSON UTF-8
serialization, envelope and tenant/correlation invariants, additive
compatibility, contract testing and architecture boundaries without selecting
or introducing messaging infrastructure or product behavior.

## Governing decisions

- ADR-0002 — Technology Selection Gate.
- ADR-0003 — API and Event Contracts.
- ADR-0004 — Multi-Tenant Context.
- ADR-0005 — Clean Architecture and DDD.
- ADR-0006 — Bounded Contexts, Services and Boundaries.
- TD-001 through TD-007.
- TD-004 Vitest testing baseline.
- TD-006/TASK-017 Zod 4 compatibility and inward-layer restrictions.
- `engineering/decisions/td-007-eventing-messaging-technology-proposal.md`.

## Authorization boundary

TASK-018 is authorized only after an implementation pre-flight confirms the
working tree, approved TD-007, exact Zod version compatibility, package
ownership and pnpm supply-chain policy. TD-007 approval does not itself
authorize an unreviewed dependency or unrelated product implementation.

The implementation is limited to an executable **contract** baseline. Broker,
delivery adapter, persistence, telemetry, runtime packaging and deployment
decisions remain deferred.

## Permitted implementation scope

TASK-018 may:

1. establish `packages/events` as a private native-ESM pnpm workspace package;
2. use the repository-approved exact Zod 4 version after a focused compatibility
   and supply-chain pre-flight;
3. implement canonical Integration Event envelope schemas;
4. implement distinct tenant-scoped and platform-scoped envelope invariants;
5. implement exact identifier, version and RFC 3339 UTC validation conventions
   required by TD-007;
6. implement deterministic JSON UTF-8 serialization and parsing helpers;
7. implement separate strict producer validation and additive-tolerant consumer
   parsing without hiding incompatible versions;
8. add valid and invalid synthetic event fixtures containing no production,
   personal, credential or confidential data;
9. add Vitest schema, serialization, provider, consumer and additive
   compatibility tests;
10. test required correlation, optional causation and conditional tenant
    context;
11. add architecture rules and deterministic fixtures preventing Zod/event
    contract technology from leaking into Domain or Application and preventing
    broker/framework messaging technology from entering inward layers;
12. document shared-envelope governance by Integration Engineering and semantic
    event ownership by each producing bounded context;
13. add only stable root/package commands needed to typecheck and verify the
    broker-independent contract baseline;
14. update the tooling registry and this task with verified evidence.

The technology fixture must use neutral synthetic names and semantics. It must
not invent a product event, bounded-context rule, consumer reaction or delivery
guarantee.

## Explicit non-goals and forbidden implementation

TASK-018 must not implement, install, configure or select:

- RabbitMQ;
- AMQP or AMQP 0-9-1;
- `amqplib` or its types;
- `@nestjs/microservices` messaging support;
- Kafka or a Kafka client;
- NATS or JetStream;
- Redis Streams;
- any real network publisher or consumer;
- production queues, exchanges, topics, subscriptions, bindings or routing
  keys;
- physical DLQ/DLX resources, redrive or replay tooling;
- broker topology, credentials, TLS, clustering or managed provider;
- Outbox or Inbox persistence;
- database, ORM, schemas, indexes, migrations, transactions, polling or CDC;
- Tenant Onboarding or `TenantCreated` product behavior/payload unless a
  separate approved product-contract task supplies the missing semantics;
- Audit, Notifications, Reporting or Workflow consumer behavior;
- telemetry SDK, logging provider, metrics backend or tracing technology;
- container images, runtime packaging, deployment or infrastructure automation;
- a platform-wide exactly-once or global ordering guarantee.

## Required architecture boundaries

- Domain Events stay in their owning service Domain and do not import
  `packages/events` or Zod.
- Application ports and values remain broker- and Zod-independent.
- `packages/events` exposes only public event contract primitives, schemas,
  parsing/serialization helpers and synthetic fixtures through explicit package
  exports.
- `packages/events` must not import services, applications, persistence,
  messaging clients, NestJS or infrastructure.
- Product event semantics remain owned by their producing bounded context even
  if an approved public schema is published through `packages/events` later.
- HTTP and event schemas remain separate despite their common Zod technology.

## Acceptance criteria

- [ ] Pre-flight confirms TD-007 approval and no material repository drift.
- [ ] `packages/events` is a valid private ESM workspace with explicit exports.
- [ ] Any direct dependency is exact-pinned and passes compatibility,
      supply-chain, license, provenance and lockfile review.
- [ ] Event envelope schemas implement every TD-007 required/optional field.
- [ ] Tenant-scoped events require `tenantId`; platform-scoped events reject or
      omit it according to the approved contract rather than using `null`.
- [ ] Producer validation is strict and consumer parsing tolerates only approved
      additive evolution.
- [ ] Unknown/incompatible event versions fail safely.
- [ ] JSON serialization is deterministic UTF-8 and round-trip tested.
- [ ] Synthetic fixtures contain no production, personal or secret data.
- [ ] Provider and consumer compatibility tests use the TD-004 Vitest baseline.
- [ ] Architecture fixtures prove Domain/Application and package boundaries.
- [ ] No broker, client, network consumer/publisher, persistence or product
      behavior exists in the diff.
- [ ] Existing typecheck, tests, architecture checks and API baseline remain
      green.
- [ ] Documentation and rollback evidence are complete.

## Proposed verification commands

Exact stable event-package commands may be added only when justified by the
implementation. At minimum run:

```text
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck:tests
corepack pnpm test
corepack pnpm test:contract
corepack pnpm architecture:check
corepack pnpm app:api:typecheck
corepack pnpm app:api:build
git diff --check
git diff --stat
git status --short
```

Also run the new `packages/events` typecheck/build/contract verification
commands and prove deterministic serialization twice. Report exact file/test
counts and every unavailable check without fabrication.

## Rollback

Before any product event contract exists, rollback removes the
`packages/events` executable files, its reviewed manifest/lockfile edges,
contract fixtures/tests/scripts and event-specific architecture fixtures while
preserving TD-004, TD-006 and TASK-017 baselines.

After an event contract becomes public, rollback must preserve its supported
JSON semantics and compatibility history. Replace schema/serialization internals
only after provider and every owned consumer prove parity against the last
approved artifacts.

## Completion gate

Status may become `DONE` only when every acceptance criterion passes. If exact
Zod compatibility, supply chain, additive consumer semantics or architecture
enforcement cannot be proven, use `BLOCKED` or `REVISION_REQUIRED`; do not
weaken TD-007 and do not silently introduce a broker or replacement technology.
