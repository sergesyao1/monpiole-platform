# TD-008: Persistence and Database Technology Baseline

- Status: **APPROVED — NOT IMPLEMENTED**
- Date: 2026-08-25
- Governing decision: ADR-0002 — Technology Selection Gate
- Decision owners: Architecture, Security, Platform Engineering, bounded-context owners
- Implementation gate: **APPROVED DECISION — SEPARATE TASK-020 REQUIRED**

## 1. Status

TD-008 approves the persistence technology and architecture baseline. Approval
does not itself authorize dependency installation, database startup, schema
creation, migration execution, repository implementation or runtime
configuration; those changes require a separately created and authorized
TASK-020.

## 2. Date

Decision evidence was collected on 2026-08-25 against repository commit
`3db56576e5999da719233d71d4db0dbef76c7322`.

## 3. Context

Tenant Onboarding is the first approved product slice and requires durable,
transactional, tenant-safe state. The repository has no database dependency,
configuration, schema or migration. TD-007 additionally defines a conditional
Transactional Outbox invariant but leaves all persistent Outbox/Inbox details
to TD-008.

The initial workload is assumed to be ordinary transactional service data:
small aggregate writes, indexed point/range reads, uniqueness and referential
constraints, and atomic multi-statement use cases. Analytics, globally
distributed writes, unbounded event storage, search and data-warehouse
workloads are not requirements for this selection.

## 4. Requirements

The baseline must provide ACID transactions, constraints, migrations, explicit
SQL access, connection pooling, real-engine integration tests, tenant defense
in depth, service-owned persistence and a route to Outbox/Inbox storage. It
must preserve strict TypeScript, native ESM/NodeNext, Node 24+, pnpm, Vitest,
NestJS composition and Clean Architecture.

Scaling must permit vertical growth, query/index tuning, connection pooling,
read replicas and later service/database separation. No sharding scheme or
multi-region write topology is selected without measured need.

## 5. Constraints inherited from ADR-0002

Selection is evidence-based and reversible. Exact packages must pass a
separate compatibility, supply-chain, license and lockfile gate before
installation. Reserved `infrastructure/postgres` naming is not evidence of an
implemented database. Implementation remains gated after this proposal.

## 6. Constraints inherited from ADR-0004

Tenant identity is explicit at every repository call and transaction boundary.
Unscoped tenant access is prohibited. Authorization precedes side effects.
Application, adapter, query and database controls must combine as defense in
depth; no hidden global or ambient tenant context is allowed.

## 7. Constraints inherited from ADR-0005

Domain and Application do not import PostgreSQL, Drizzle, `pg`, migration
tools, persistence schemas, rows or database errors. Repository/transaction
ports use plain, technology-neutral values. Infrastructure implements them and
maps explicitly among persistence rows, Domain values and Application values.

## 8. Constraints inherited from ADR-0006

Each bounded context owns its tables, schema definitions, migrations,
repositories and operational data lifecycle. Shared mutable tables and direct
cross-context SQL are forbidden integration mechanisms. Physical co-location
does not weaken logical ownership.

## 9. Constraints inherited from TD-004 through TD-007

- TD-004: Domain/Application unit tests remain database-free; PostgreSQL
  semantics require real-engine integration tests. Testcontainers is
  conditional on this adapter.
- TD-005: NestJS may compose infrastructure but cannot define Domain or
  Application persistence architecture.
- TD-006: HTTP contracts and persistence rows remain different models.
- TD-007: event contracts and persistence rows remain different models;
  Outbox/Inbox implementation remains separate from event transport.

## 10. Candidate comparison

Scores are relative for MonPiole: 5 is strongest. They do not replace the
qualitative restrictions below.

| Candidate | TS safety | SQL/PostgreSQL transparency | Migrations | RLS/raw SQL | Clean Architecture fit | Operational/lock-in risk | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Drizzle ORM + `pg` | 5 | 5 | 4 | 5 | 5 | 3 | **Recommend** |
| Prisma | 5 | 3 | 4 | 3 | 3 | 2 | Reject for baseline |
| TypeORM | 3 | 3 | 4 | 4 | 2 | 3 | Reject |
| Direct `pg`/SQL | 3 | 5 | 2 | 5 | 5 | 4 | Reserve for exceptional SQL; not primary abstraction |

### Drizzle ORM with node-postgres

Drizzle keeps schemas and queries close to SQL, supports PostgreSQL-specific
types, raw SQL and transaction configuration, and can use an existing `pg`
pool. Generated migrations are readable SQL. This makes infrastructure
mapping, RLS policy review and bounded-context ownership visible.

Risks are material: the selected stable line is `0.45.2`, upstream is moving
toward `1.0`, and npm metadata declares many optional peers but no Node engine.
TASK-020 must prove the exact imports used, TypeScript 6, Node 24, ESM,
transactions, migrations and RLS before adoption.

### Prisma

Prisma provides strong generated-client types and mature migrations. It also
introduces a generated client/model vocabulary, a schema DSL and a larger
toolchain that can easily leak into Application or Domain. PostgreSQL-specific
RLS/session work and advanced SQL tend to require escape hatches. The stable
`7.9.1` line is compatible by declared engines, but the npm `latest` tag points
to an `8.0.0` release candidate at decision time, increasing pinning and
upgrade-governance risk.

### TypeORM

TypeORM is mature and integrates with NestJS, but decorator/entity-centric
usage encourages persistence entities to become application/domain models.
Its broad abstraction reduces PostgreSQL transparency. Exact `1.1.0` requires
Node `^20.19.0 || ^22.13.0 || >=24.11.0`; this does not cover the repository's
declared lower bound `>=24.0.0` even though the current local Node is newer.

### Direct node-postgres and SQL

Direct `pg` maximizes PostgreSQL access and architectural control with minimal
abstraction. It also requires repository-owned result typing, mapping and
migration governance for every query and raises repetitive-code risk. It is
approved as the underlying driver and controlled escape hatch, not as the
default query/schema abstraction.

No additional alternative materially improves the current choice. Kysely is
credible but would duplicate the Drizzle-vs-direct-SQL trade-off without a
repository requirement that favors it.

## 11. Decision

Recommend, subject to approval and TASK-020 compatibility gates:

1. PostgreSQL **major 18**, maintained on the latest approved 18.x security and
   bug-fix release; `18.6` is current evidence, not an immutable deployment pin.
2. `drizzle-orm@0.45.2` as infrastructure-only typed SQL/schema technology.
3. `pg@8.23.0` as the PostgreSQL driver and pool.
4. `@types/pg@8.23.1` as development typing.
5. `drizzle-kit@0.31.10` as development-only migration generator.
6. `testcontainers@12.1.0` as development-only real PostgreSQL integration-test
   mechanism, conditional on container-runtime availability.

The approved Testcontainers candidate updates TD-004's conditional, uninstalled
`12.0.4` evidence to the registry-current `12.1.0`. Installation remains
subject to the exact TASK-020 compatibility gate.

No NestJS ORM module is selected. No global repository base class, shared
persistence package or Active Record pattern is selected.

## 12. Architecture

```text
Interface/composition
        |
        v
Application use case -> repository/transaction ports -> Domain
        ^
        |
Infrastructure PostgreSQL adapter
        |
        +-> mapping -> Drizzle schema/query -> pg pool -> PostgreSQL
```

Application owns ports when a use case needs persistence. Infrastructure owns
database sessions, Drizzle types, SQL, mapping and database-error translation.
Dependencies point inward; runtime composition wires the adapter.

## 13. Repository model

The target convention for an owning context is:

```text
services/<context>/
  application/
    ports/
      <aggregate>-repository.ts
      transaction-manager.ts
  infrastructure/
    persistence/
      postgres/
        connection/
        mappings/
        repositories/
        schema/
        transactions/
        migrations/
        drizzle.config.ts
```

Exact files must be introduced only for an approved product requirement. There
is no central `packages/database`; generic connection composition may be
reconsidered only after proven duplication without moving schemas or business
repositories out of their owner.

## 14. Multi-tenancy model

The initial model is shared PostgreSQL infrastructure with service-owned
schemas/tables and row-per-tenant storage for tenant-scoped data. Every such
table has a non-null native UUID `tenant_id`. Repository methods require an
explicit persistence context containing `tenantId` and correlation metadata.

Prevention of accidental unscoped access is fail-closed:

1. Application supplies an explicit validated tenant identifier.
2. Tenant repositories have no unscoped method signature.
3. Adapters add parameterized `tenant_id` predicates.
4. A transaction sets a transaction-local PostgreSQL tenant setting.
5. RLS independently enforces the same tenant.
6. Constraints and indexes include tenant ownership where required.
7. Tests attempt missing and cross-tenant access.

Platform-scoped data uses separate tables/repositories and cannot silently
reuse tenant-scoped APIs. Privileged operations use explicit administrative
ports, roles, authorization and audit; a magic tenant identifier is forbidden.

## 15. PostgreSQL RLS position

RLS is **required by default** on tables containing tenant-owned rows. A
documented architecture/security review may exempt genuinely platform-scoped
or non-sensitive reference tables. RLS complements, never replaces, explicit
adapter predicates and authorization.

The runtime role must not own protected tables, have `BYPASSRLS`, or be a
superuser. Protected tables use `ENABLE ROW LEVEL SECURITY` and normally
`FORCE ROW LEVEL SECURITY`. Migrations run under a separate owner role.

Within each transaction the adapter sets tenant context using a parameterized,
transaction-local setting such as `set_config('app.tenant_id', $1, true)`.
Policies derive the UUID from `current_setting('app.tenant_id', true)` and fail
closed when missing or invalid. Session-scoped state and leaked pool state are
forbidden. Runtime, migration and audited administration paths each require
tests, including missing context, wrong tenant, pooling reuse and bypass-role
checks.

## 16. Transaction model

The Application transaction port owns the use-case atomic boundary; the
Infrastructure adapter owns the PostgreSQL transaction mechanics. Repositories
participate in the current explicitly supplied transaction scope without
exposing Drizzle or `pg` handles inward.

- Default isolation is PostgreSQL `READ COMMITTED`.
- A use case may request `REPEATABLE READ` or `SERIALIZABLE` only with evidence
  and conflict tests.
- Nested independent transactions are forbidden. An inner operation joins the
  existing unit or is rejected.
- Savepoints are infrastructure-only and require explicit, tested semantics.
- Any exception rolls back the complete unit.
- SQLSTATE/driver errors map to stable application-neutral categories such as
  conflict, unavailable and unexpected; raw errors never cross the adapter.
- Serialization/deadlock retries are bounded, observable and wrap the entire
  transaction only when the operation and external effects are retry-safe.
- Cross-context transactions are forbidden. Reliable state-plus-event writes
  use the context-owned Outbox invariant, not a distributed database
  transaction.

## 17. Data ownership model

Each bounded context owns a PostgreSQL schema namespace, tables, constraints,
indexes, migrations and roles. Names use lowercase `snake_case`; schema names
use stable bounded-context identities with hyphens converted to underscores.
Cross-schema foreign keys and direct reads/writes are forbidden by default.

Reference data is either owned by one context and exposed through a contract,
or explicitly duplicated as a local projection. A shared physical cluster or
database is an operational optimization, not shared data ownership.

## 18. Migration model

Drizzle TypeScript schema declarations are infrastructure source. Drizzle Kit
generates timestamped SQL and snapshots into the owning context's
`infrastructure/persistence/postgres/migrations/` directory. Migration names
use `<UTC timestamp>_<bounded-context>_<imperative-description>`.

Generated SQL is never trusted blindly: it is version-controlled, reviewed by
the context owner and database/security reviewers, checked for locks, tenant
constraints, RLS, indexes, data loss and reversibility, then tested from an
empty database and the previous supported schema. `drizzle-kit push` and
automatic production synchronization are prohibited.

Production uses a separate migration identity and an orchestrated, single-run
release step outside application startup. The default is forward-only
expand/migrate/contract. Recovery uses a forward corrective migration or a
tested restore; destructive changes require backup/restore evidence, explicit
approval, staged compatibility and a data-retention decision. TASK-020 must
define deterministic generate, drift and apply commands.

## 19. Identifier policy

Persistent entity identifiers use UUID syntax and PostgreSQL native `uuid`,
represented inward as plain validated strings or Domain value objects without
database types. UUID v4 is the initial generation convention because
`node:crypto.randomUUID()` satisfies it without another dependency. Generation
occurs before repository invocation through an outer/application-owned
identifier port, not implicitly in Drizzle or the database.

TD-006 correlation/request identifiers and TD-007 event identifiers retain
their own semantics. Similar UUID syntax does not permit reuse of concepts.
UUID v7 may be proposed later if measured index locality justifies changing a
specific identifier contract.

## 20. Timestamp policy

Instants use PostgreSQL `timestamp with time zone` (`timestamptz`) and UTC.
Connections and database defaults operate in UTC; no behavior depends on host
local time. Application/Domain semantic timestamps come from an injected clock
and are explicit. Persistence audit fields use `created_at` and `updated_at`,
non-null where applicable, with update behavior explicit in the adapter or
database and tested. JavaScript `Date`/driver conversions are contained in the
adapter; inward values use the approved plain representation.

## 21. Constraint policy

- Every owned row has a primary key.
- Required data uses `NOT NULL`.
- Business uniqueness uses `UNIQUE`; tenant-scoped uniqueness normally begins
  with `tenant_id`.
- Foreign keys enforce relationships only inside one bounded context.
- `CHECK` constraints protect stable row-local invariants and enum/range rules.
- Delete/update actions are explicit rather than relying on defaults.

Domain validation provides meaningful business behavior; database constraints
provide race-safe defense in depth. Constraint failures are mapped and tested.

## 22. Indexing policy

Primary keys and unique constraints supply their PostgreSQL indexes. Foreign
key columns are reviewed because PostgreSQL does not automatically index the
referencing side. Tenant queries generally begin composite indexes with
`tenant_id`, followed by evidenced filter/order columns. Unique indexes are
tenant-aware unless uniqueness is intentionally platform-wide.

Every non-constraint index requires a known query, selectivity/order rationale
and write/storage trade-off. Migration review examines lock/build strategy and
production performance evidence; speculative indexes are rejected.

## 23. Concurrency policy

No lost update is acceptable. Optimistic concurrency is the default for
aggregates that can receive concurrent writes, using a non-null integer
`version` checked and incremented atomically. A zero-row update maps to a
conflict. Pessimistic locking (`FOR UPDATE`, advisory locks) is allowed only in
Infrastructure for measured contention and with lock-order, timeout and
deadlock tests.

`READ COMMITTED` is the baseline; stronger isolation is use-case-specific.
Retries for SQLSTATE `40001` or `40P01` are bounded with backoff and only safe
around the whole idempotent transaction. High-contention flows require explicit
load/concurrency evidence before implementation.

## 24. Raw SQL policy

Raw SQL is allowed only inside owning Infrastructure persistence adapters and
reviewed migrations when Drizzle cannot express a PostgreSQL feature clearly
or when measured performance requires it. All dynamic values are parameterized;
identifiers come from closed code-owned allowlists, never user input. SQL is
tenant-scoped, reviewed for injection/RLS/locking/query plans and covered by
real PostgreSQL integration tests. SQL never appears in Domain or Application.

## 25. Connection management

Infrastructure composition builds one bounded `pg.Pool` per deployable runtime
and database identity. Configuration comes from the governed configuration
boundary; secrets come from an external secret source and are never logged or
committed. TLS with server identity verification is required outside explicitly
isolated local testing.

Pool size is derived from database connection budget divided across replicas,
with headroom for migrations and operations; no universal number is selected.
Startup validates configuration and may fail readiness until connectivity is
established without infinite blocking. Shutdown stops new work, drains bounded
in-flight transactions, then closes the pool. Health checks use a short,
low-cost readiness query and never expose credentials. Transient acquisition
failures are bounded and observable.

## 26. Testing model

- Domain unit tests: no database, ORM, filesystem or network.
- Application unit tests: plain repository/transaction fakes focused on use
  case behavior, never pretending to verify PostgreSQL semantics.
- Adapter integration tests: Vitest integration project against real
  PostgreSQL 18 through Testcontainers when a compatible container runtime is
  available.
- Migration tests: empty-to-head, previous-supported-to-head, checksums/drift,
  constraints and safe failure.
- Tenant tests: correct tenant, missing tenant, cross-tenant read/write,
  platform route, RLS, role bypass and pooled-connection reuse.
- Transaction tests: commit, rollback, constraints, isolation conflicts,
  optimistic conflicts and bounded retry.
- Concurrency tests: deterministic barriers rather than timing sleeps.

CI/runtime container provisioning remains TD-009/TD-010-owned. TASK-020 must
pin the PostgreSQL image by immutable digest after supply-chain review and
provide an explicit skip/failure policy when containers are unavailable.

## 27. Security model

Separate least-privilege roles are required for runtime, migrations and audited
administration. The runtime role has only necessary schema/table/sequence
privileges and no owner, superuser, `CREATEROLE`, `CREATEDB` or `BYPASSRLS`
capability. The migration identity is not available to the application.

Connections require encryption outside isolated local tests; credential
rotation must not require source changes. Queries are parameterized. Sensitive,
personal and tenant data, bind values and connection URLs are excluded from
logs. Authorization remains an Application/interface responsibility before
side effects; tenant context is revalidated by the adapter and RLS.

## 28. Observability requirements

Without selecting TD-012 technology, persistence adapters must make available
safe signals for query latency by stable operation name, transaction duration,
pool utilization/wait/exhaustion, connection failures, SQLSTATE category,
deadlocks, serialization failures, optimistic conflicts, slow-query counts and
migration results. Correlation identifiers may be attached; raw SQL, bind
values, credentials and tenant/personal payloads must not be logged. Thresholds
and telemetry SDK/backend remain TD-012 decisions.

## 29. Operational considerations

PostgreSQL minor security releases must be reviewed and applied within an
owned patch process. Major upgrades require compatibility tests, migration
planning and rollback/restore rehearsal. Capacity planning includes storage,
WAL, connections, autovacuum, transaction age and index growth. Backup,
point-in-time recovery, retention, high availability, replicas and managed
provider remain deployment decisions, but TASK-020 must not claim production
readiness without owned backup/restore objectives.

Failed migrations stop rollout and are never ignored. Restore compatibility
and recovery runbooks must be tested before destructive production changes.

## 30. Rejected alternatives

- Prisma: rejected for the baseline because generated-client/model coupling,
  tooling footprint and PostgreSQL escape-hatch requirements outweigh its
  convenience under MonPiole's explicit repository/mapping architecture.
- TypeORM: rejected because entity/decorator leakage risk, lower SQL
  transparency and an engine range narrower than the repository Node contract.
- Direct `pg` only: rejected as the default because schema/query typing and
  migration generation would become repository-owned boilerplate; retained as
  the underlying driver and controlled escape hatch.
- Database-per-tenant/schema-per-tenant: deferred; they add provisioning,
  migration fan-out and pool complexity without current scale/regulatory
  evidence.
- Shared tables across bounded contexts: rejected by ADR-0006.
- Automatic schema synchronization: rejected as uncontrolled production state.

## 31. Consequences

Positive consequences are transparent SQL, strong TypeScript inference in
Infrastructure, native PostgreSQL capabilities, explicit migrations, robust
constraints/RLS and replaceable inner layers. Costs include mappings,
transaction/context plumbing, PostgreSQL operational ownership, containerized
integration tests and careful Drizzle upgrade governance.

## 32. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Drizzle stable remains 0.x while 1.0 is RC | Exact pin; TASK-020 compile/runtime/migration spike; no RC substitution |
| ORM types leak inward | Named dependency rules, fixtures, explicit row/domain/application mappings |
| Missing tenant predicate | Tenant-specific repository APIs, parameterized predicate, transaction-local context, forced RLS, negative tests |
| RLS bypass through owner/admin role | Separate non-owner runtime role, no `BYPASSRLS`, role tests and audited administration |
| Pooled tenant state leaks | `SET LOCAL` inside every transaction; no session setting; reuse tests |
| Migration causes lock/data loss | Reviewed SQL, expand/contract, real upgrade test, explicit destructive gate and recovery evidence |
| Connection exhaustion | Budgeted bounded pool, acquisition timeout, pool metrics/readiness |
| Retry duplicates external effects | Retry entire idempotent unit only; use Outbox for required event publication |
| Testcontainers unavailable | Clear prerequisite/failure policy; do not replace PostgreSQL-specific proof with an in-memory database |
| PostgreSQL/driver major drift | Exact package pins and supported PostgreSQL-major policy with compatibility matrix |

## 33. Deferred decisions

- Approval and implementation in TASK-020.
- Exact PostgreSQL container image/digest and production provider.
- Deployment, clustering, replicas, backups, PITR, RPO/RTO and regional model.
- Pool sizes, timeouts and slow-query thresholds from measured workloads.
- Product tables, Tenant Onboarding repository and migrations.
- Persistent Outbox/Inbox schemas, poller/CDC and retention.
- Telemetry SDK/backend.
- UUID v7, partitioning, sharding and tenant-dedicated storage.

## 34. Compatibility matrix

Evidence date is 2026-08-25. Versions are candidates for TASK-020, not installed
dependencies.

| Component | Candidate | Evidence and compatibility position |
| --- | --- | --- |
| PostgreSQL | 18; current patch 18.6 | Current supported major; protocol 3.0 remains supported; RLS, UUID and transaction capabilities satisfy requirements |
| Node.js | repository `>=24.0.0`; observed 24.18.0 | `pg` requires >=16; Testcontainers >=22.22; Prisma 7.9.1 includes >=24.0; Drizzle declares no engine |
| TypeScript | 6.0.3 | `@types/pg` publishes `ts6.0` tag at 8.23.1; Drizzle requires compile smoke because it declares no TS peer baseline |
| Drizzle ORM | 0.45.2 | npm stable/latest, Apache-2.0, ESM import exports and `pg >=8` peer; published 2026-03-27 |
| Drizzle Kit | 0.31.10 | npm stable/latest, MIT; published 2026-03-17; build dependencies/install behavior require supply-chain review |
| node-postgres | 8.23.0 | npm stable/latest, MIT, Node >=16; published 2026-08-08 |
| `@types/pg` | 8.23.1 | npm stable/latest and `ts6.0`, MIT; published 2026-08-17 |
| Testcontainers | 12.1.0 | npm stable/latest, MIT, Node >=22.22; published 2026-08-04; container runtime required |
| NestJS/Vitest | 11.2.2 / 4.1.11 | Persistence remains Infrastructure; Vitest runs integration tests without Jest |

The versions must not be copied into manifests until registry provenance,
integrity, advisories, license, peer graph, install scripts, native binaries,
NodeNext imports and pnpm lockfile behavior are rechecked. PostgreSQL 18.6 must
be tested using the exact future image digest. No silent version substitution
is permitted.

## 35. Implementation gate

TD-008 is **APPROVED — NOT IMPLEMENTED**. A separate TASK-020 must be created
and authorized before implementation. TASK-020 must start with an audit-only
compatibility/supply-chain phase and stop with
`REVISION_REQUIRED` if any exact candidate fails Node 24, TypeScript 6,
NodeNext, pnpm, PostgreSQL 18 or policy checks.

Only a later approved implementation phase may install dependencies. Its
smallest proof must be a synthetic, non-product, single-context adapter showing
explicit mapping, tenant-scoped repository access, transaction-local RLS,
migrations, constraints, rollback, pooling and real PostgreSQL tests. It must
add architecture rules before product persistence. It must not implement
Tenant Onboarding, cross-context access, Outbox/Inbox, production configuration
or deployment.

## 36. Verification commands

Decision-task verification:

```text
git diff --check
git diff --stat
git status --short
```

Future TASK-020 gates must include existing repository checks plus exact
package metadata/audit, frozen installation, typecheck, build, architecture,
unit/integration tests, migration drift/apply checks and repeated tenant/RLS
isolation tests against PostgreSQL 18.

## 37. Evidence

Repository evidence:

- [ADR-0002](../adr/0002-technology-selection-gate.md)
- [ADR-0004](../adr/0004-multi-tenant-context.md)
- [ADR-0005](../adr/0005-application-architecture-clean-architecture-ddd.md)
- [ADR-0006](../adr/0006-application-architecture-bounded-contexts-services-boundaries.md)
- [TD-004](td-004-testing-strategy-tooling-proposal.md)
- [TD-006](td-006-api-contract-representation-proposal.md)
- [TD-007](td-007-eventing-messaging-technology-proposal.md)
- dependency-cruiser currently enforces inward layers and cross-service
  persistence ownership; runtime database behavior remains a documented
  residual control.

Primary upstream evidence:

- [PostgreSQL 18.6 documentation](https://www.postgresql.org/docs/18/)
- [PostgreSQL row security policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
- [Drizzle PostgreSQL/node-postgres support](https://orm.drizzle.team/docs/get-started-postgresql)
- [Drizzle migration generation](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [Drizzle transactions](https://orm.drizzle.team/docs/transactions)
- [node-postgres pooling](https://node-postgres.com/features/pooling)
- [node-postgres transactions](https://node-postgres.com/features/transactions)
- [Testcontainers for Node.js](https://node.testcontainers.org/)
- npm registry metadata for every exact package and publication date in the
  compatibility matrix, queried without installation on 2026-08-25.

## Decision gate

**APPROVED — NOT IMPLEMENTED — TASK-020 NOT YET CREATED OR AUTHORIZED.**

Architecture review approved PostgreSQL 18, Drizzle plus `pg`, the RLS default,
row-per-tenant model, migration governance, exact compatibility gate and
TASK-020 non-goals on 2026-08-25. This documentation approval creates no
runtime rollback obligation because no persistence implementation exists.
