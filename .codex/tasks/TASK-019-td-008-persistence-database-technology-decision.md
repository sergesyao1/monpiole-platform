# TASK-019 — TD-008 Persistence / Database Technology Baseline Decision

## Status

DONE

## Objective

Produce the governed TD-008 Persistence / Database Technology Baseline decision for MonPiole.

This task is decision-only.

Do not install dependencies and do not implement persistence.

The objective is to evaluate the persistence/database technology candidates, define the architectural persistence baseline, document the decision, and prepare the implementation gate for the subsequent TD-008 implementation task.

## Current governed baseline

The repository currently includes the following governed technology baselines:

- TD-001 runtime/language/module baseline implemented.
- TD-002 pnpm/workspace baseline implemented.
- TD-003 architecture enforcement baseline implemented.
- TD-004 testing baseline implemented.
- TD-005 NestJS application framework baseline implemented.
- TD-006 API contract baseline implemented.
- TD-007 event contract baseline implemented.

Expected current baseline commit:

3db5657 feat(eventing): implement TD-007 event contract baseline

TD-008 must extend this baseline without weakening any previously accepted architecture or governance rule.

## Architecture constraints

The TD-008 decision must preserve all existing architecture and governance constraints.

### ADR-0002 — Technology selection governance

Technology selections must pass the governed technology-selection process before implementation.

No persistence technology may be introduced merely because it is convenient, popular, familiar, or already used elsewhere.

The decision must be supported by explicit requirements, comparison criteria, compatibility analysis, risks, and evidence.

### ADR-0004 — Multi-Tenant Context

Multi-tenant context must propagate to persistence boundaries.

Persistence adapters must not permit accidental unscoped access to tenant-owned data.

Tenant isolation must use defense in depth rather than relying on a single application or database control.

The persistence baseline must explicitly define how tenant context reaches repository and database operations.

### ADR-0005 — Clean Architecture / DDD

Clean Architecture and DDD boundaries must be preserved.

Domain and application layers must remain independent from:

- PostgreSQL;
- database drivers;
- ORM libraries;
- query builders;
- migration frameworks;
- database-specific persistence models;
- database-specific exceptions.

Repository interfaces or equivalent persistence ports belong inside the architecture boundary.

Database implementations belong in infrastructure adapters.

ORM entities, generated database models, or persistence schemas must not become domain entities.

### ADR-0006 — Bounded Contexts & Services

Bounded-context ownership must remain explicit.

Each bounded context owns its data and persistence implementation.

A bounded context must not use direct table access to another bounded context as its integration mechanism.

Cross-context communication must continue to use governed APIs, events, or other approved contracts.

Shared mutable database tables across bounded contexts are not permitted by default.

## Constraints inherited from TD-004 through TD-007

### TD-004 — Testing Strategy & Tooling

Persistence integration tests must support testing against the real selected database engine where database behavior matters.

Evaluate Testcontainers as the integration-test mechanism for PostgreSQL.

Unit tests must remain possible without requiring a running database.

### TD-005 — Application Framework

Persistence integration must remain compatible with the NestJS application baseline without making NestJS a dependency of the domain layer.

Infrastructure adapters may use framework integration where appropriate.

### TD-006 — API Contract Baseline

Persistence models must not leak into public API contracts.

Mapping between persistence representation, domain representation, and transport representation must remain explicit.

### TD-007 — Event Contract Baseline

Persistence models must not leak into integration-event contracts.

Database identifiers and transaction behavior must remain compatible with the governed event envelope and identifier strategy.

## Technologies to evaluate

Evaluate at minimum:

1. PostgreSQL as the primary transactional database.
2. Drizzle ORM with a PostgreSQL driver.
3. Prisma.
4. TypeORM.
5. Direct PostgreSQL driver / SQL without an ORM.

Additional candidates may be evaluated only when they materially improve the decision.

## Candidate comparison criteria

Compare candidates using criteria including:

- TypeScript compatibility;
- Node.js compatibility;
- PostgreSQL support;
- SQL transparency;
- type safety;
- schema definition capabilities;
- migration tooling;
- transaction support;
- raw SQL support;
- PostgreSQL feature access;
- Row-Level Security compatibility;
- multi-tenancy suitability;
- performance characteristics;
- connection pooling;
- testability;
- Testcontainers compatibility;
- Clean Architecture compatibility;
- DDD compatibility;
- repository abstraction compatibility;
- risk of ORM leakage into domain/application;
- operational complexity;
- migration governance;
- maturity;
- ecosystem health;
- maintainability;
- vendor/tool lock-in;
- long-term sustainability.

Do not select a technology based only on popularity.

## Required decisions

The TD-008 proposal must explicitly decide or define:

### Primary database

- primary transactional database;
- rationale;
- workload assumptions;
- transactional guarantees;
- multi-tenancy compatibility;
- scaling compatibility;
- bounded-context ownership compatibility.

PostgreSQL must be evaluated as the primary candidate.

### Data-access technology

Define:

- selected ORM, query builder, or database driver;
- reason for selection;
- PostgreSQL integration;
- repository-port interaction;
- transaction capabilities;
- migration capabilities;
- raw SQL capabilities;
- restrictions on technology-specific types.

Using an ORM must not replace repository ports.

ORM entities, generated clients, or generated models must not become domain entities.

Persistence-specific types must not leak into application or domain contracts.

### Repository architecture

Expected dependency direction:

Domain / Application
  -> Persistence Port / Repository Contract
  -> Infrastructure Persistence Adapter
  -> Database Access Technology
  -> PostgreSQL

Define where the following belong:

- repository interfaces;
- persistence adapters;
- persistence mappings;
- database schemas;
- transaction adapters;
- migration assets.

Domain and application code must not import the selected ORM or PostgreSQL driver.

### Transaction model

Define:

- transaction ownership;
- transaction boundaries;
- application/use-case transaction policy;
- repository participation;
- unit-of-work considerations;
- nested transaction policy;
- savepoint policy if applicable;
- rollback expectations;
- retry expectations;
- error mapping.

Transactions must not silently span bounded-context ownership boundaries.

Cross-bounded-context consistency must not be implemented through uncontrolled distributed database transactions.

### Data ownership

Define:

- bounded-context ownership of data;
- table ownership;
- schema ownership conventions if applicable;
- rules for cross-context data access;
- restrictions on shared mutable tables;
- reference-data considerations;
- integration boundaries.

Direct database access to another bounded context's owned tables must not become an integration mechanism.

### Multi-tenancy model

Define:

- initial tenant storage model;
- tenant identifier strategy;
- tenant context propagation;
- tenant filtering enforcement;
- persistence-adapter safeguards;
- database-level safeguards;
- administrative/system operations;
- tenant-aware constraints;
- tenant-aware indexing.

Evaluate PostgreSQL Row-Level Security.

RLS must not be considered the only tenant-isolation mechanism.

Tenant isolation must use defense in depth:

Request/Application tenant context
  -> repository/persistence adapter enforcement
  -> parameterized tenant-scoped query
  -> database controls/RLS where appropriate

The proposal must explain how accidental unscoped tenant queries are prevented.

### PostgreSQL Row-Level Security

Explicitly evaluate:

- where RLS should apply;
- where RLS may not be necessary;
- application role behavior;
- migration role behavior;
- administrative access;
- tenant context/session propagation;
- testing requirements;
- operational risks;
- bypass risks.

RLS must complement application and adapter-level tenant enforcement rather than replace them.

### Migration strategy

Define:

- migration technology;
- migration file location;
- versioning rules;
- naming conventions;
- generation policy;
- review requirements;
- execution ownership;
- CI validation;
- production migration governance;
- forward migration policy;
- rollback/recovery strategy;
- destructive migration safeguards.

Generated migrations must remain reviewable and version-controlled.

Automatic uncontrolled schema synchronization in production must not be accepted.

### Identifier strategy

Define:

- UUID strategy;
- generation ownership;
- database representation;
- application representation;
- compatibility with TD-006 API identifiers;
- compatibility with TD-007 event identifiers.

Avoid introducing persistence-specific identifier types into domain contracts.

### Timestamp policy

Define:

- UTC storage policy;
- PostgreSQL timestamp type;
- creation timestamp convention;
- update timestamp convention;
- application timezone handling;
- database timezone expectations.

Persistence must not depend on server-local timezone assumptions.

### Database constraints

Define baseline expectations for:

- PRIMARY KEY;
- FOREIGN KEY;
- UNIQUE;
- CHECK;
- NOT NULL;
- referential integrity;
- tenant-aware uniqueness.

Business invariants must not be delegated blindly either only to application code or only to the database.

### Indexing baseline

Define:

- primary-key indexes;
- foreign-key indexing considerations;
- tenant-aware indexes;
- composite indexes;
- unique indexes;
- query-driven indexing;
- migration review expectations;
- performance review expectations.

Avoid speculative indexing without query evidence.

### Concurrency strategy

Define:

- optimistic locking applicability;
- pessimistic locking applicability;
- version-column strategy if applicable;
- conflict handling;
- transaction isolation expectations;
- retry policy;
- high-contention operation considerations.

The strategy should avoid silently losing concurrent updates.

### Raw SQL policy

Define:

- whether raw SQL is allowed;
- permitted architectural layer;
- review requirements;
- parameterization requirements;
- security requirements;
- testing requirements.

Raw SQL must never leak into domain or application business logic.

All dynamic values must use safe parameterization.

### Connection configuration

Define:

- environment-based configuration;
- connection URL handling;
- secret handling;
- connection pooling;
- pool sizing considerations;
- startup behavior;
- shutdown behavior;
- health-check considerations;
- transient failure behavior.

No database secrets may be committed to the repository.

### Database security

Define:

- least-privilege database roles;
- runtime application role;
- migration role separation if applicable;
- administrative role considerations;
- tenant isolation controls;
- secure connection expectations;
- credential rotation considerations.

The runtime application must not operate using database superuser privileges.

### Persistence observability

Define minimum persistence observability requirements:

- database latency;
- transaction duration;
- connection-pool behavior;
- connection exhaustion;
- database errors;
- deadlocks;
- serialization failures;
- slow queries;
- migration failures;
- correlation context where appropriate.

Sensitive values, credentials, and personal data must not be written into logs.

### Testing model

Align persistence testing with TD-004.

Define:

- domain unit-test approach;
- application unit-test approach;
- repository fake/stub usage;
- persistence adapter integration tests;
- real PostgreSQL testing;
- Testcontainers applicability;
- migration verification;
- tenant-isolation verification;
- RLS verification where applicable;
- transaction behavior tests;
- constraint verification;
- concurrency testing considerations.

Integration tests should exercise the real PostgreSQL engine where PostgreSQL-specific behavior matters.

### Recovery considerations

Define baseline expectations for:

- migration recovery;
- failed migration handling;
- backup compatibility;
- restore considerations;
- destructive migration controls;
- data-preserving deployment strategies.

Detailed backup infrastructure may remain deferred if outside TD-008 scope.

## Version verification

Research exact currently compatible package versions before recommending version pins.

Do not invent package versions.

Version recommendations must be supported by evidence available at decision time.

Where relevant, verify compatibility between:

- Node.js baseline;
- TypeScript baseline;
- NestJS baseline;
- PostgreSQL;
- selected data-access technology;
- migration tooling;
- PostgreSQL driver;
- Vitest;
- Testcontainers.

No dependency installation is permitted during TASK-019.

## Expected decision artifact

Create:

engineering/decisions/td-008-persistence-database-technology-proposal.md

The decision document must include at minimum:

1. Status
2. Date
3. Context
4. Requirements
5. Constraints inherited from ADR-0002
6. Constraints inherited from ADR-0004
7. Constraints inherited from ADR-0005
8. Constraints inherited from ADR-0006
9. Constraints inherited from TD-004 through TD-007
10. Candidate comparison
11. Decision
12. Architecture
13. Repository model
14. Multi-tenancy model
15. PostgreSQL RLS position
16. Transaction model
17. Data ownership model
18. Migration model
19. Identifier policy
20. Timestamp policy
21. Constraint policy
22. Indexing policy
23. Concurrency policy
24. Raw SQL policy
25. Connection management
26. Testing model
27. Security model
28. Observability requirements
29. Operational considerations
30. Rejected alternatives
31. Consequences
32. Risks and mitigations
33. Deferred decisions
34. Compatibility matrix
35. Implementation gate
36. Verification commands
37. Evidence

## Allowed repository changes

Create:

engineering/decisions/td-008-persistence-database-technology-proposal.md

Update only if governance requires it:

engineering/decisions/technology-decision-inventory.md
.codex/tooling/STEP-3-TOOLING-REGISTRY.md
.codex/tasks/TASK-019-td-008-persistence-database-technology-decision.md

## Forbidden changes

Do not modify:

- package.json;
- pnpm-lock.yaml;
- application runtime source code;
- package runtime source code;
- database configuration;
- Docker assets;
- CI infrastructure;
- production infrastructure;
- runtime environment configuration.

Do not:

- install PostgreSQL-related dependencies;
- install an ORM;
- install a database driver;
- create migrations;
- implement repository adapters;
- implement database schemas;
- start a PostgreSQL container;
- introduce runtime database configuration;
- commit changes.

TASK-019 is strictly a technology-decision and governance task.

## Implementation gate

TD-008 implementation must remain blocked until the technology proposal has been reviewed and approved.

The next implementation task must be created separately after approval.

Expected sequence:

TASK-019
  -> TD-008 Persistence Technology Decision
  -> Architecture Review
  -> TD-008 Approval
  -> Documentation Commit
  -> TASK-020 Persistence / Database Baseline Implementation

TASK-020 must not begin during TASK-019.

## Verification

Before completing this task, run documentation consistency checks appropriate to the repository.

Then run:

git diff --check
git diff --stat
git status --short

Review the resulting changes and confirm that no implementation dependency, migration, database configuration, or runtime source code was introduced.

If repository documentation checks already exist, run the appropriate governed commands as well.

## Completion evidence

Provide:

- files created;
- files modified;
- candidate comparison summary;
- selected primary database recommendation;
- selected data-access technology recommendation;
- major architecture decisions;
- repository architecture;
- transaction model;
- bounded-context data ownership model;
- tenant-isolation model;
- RLS position;
- migration strategy;
- testing approach;
- security baseline;
- observability baseline;
- version compatibility evidence;
- verification command results;
- git diff --stat;
- git status --short.

Do not commit.

## Completion criteria

TASK-019 is complete when:

- TD-008 has a documented technology proposal;
- PostgreSQL suitability has been evaluated;
- data-access candidates have been compared;
- a preferred data-access technology has been recommended;
- Clean Architecture boundaries are preserved;
- ORM/database types are prevented from leaking into domain/application;
- bounded-context data ownership rules are explicit;
- multi-tenancy persistence rules are explicit;
- prevention of unscoped tenant access is defined;
- PostgreSQL RLS has an explicit position;
- repository boundaries are explicit;
- transaction boundaries are explicit;
- migration governance is explicit;
- identifier and timestamp policies are explicit;
- database constraint and indexing policies are explicit;
- concurrency expectations are explicit;
- raw SQL policy is explicit;
- database security baseline is defined;
- persistence observability baseline is defined;
- testing strategy is aligned with TD-004;
- Testcontainers applicability is defined;
- exact dependency versions are evidence-based;
- no persistence implementation has been performed;
- repository verification checks pass;
- TD-008 remains gated for architecture review before TASK-020.

## Completion record — 2026-08-25

- Created `engineering/decisions/td-008-persistence-database-technology-proposal.md`
  with every required decision section; architecture review subsequently set
  its status to `APPROVED — NOT IMPLEMENTED` on 2026-08-25.
- Recommended PostgreSQL 18 with exact candidate versions
  `drizzle-orm@0.45.2`, `pg@8.23.0`, `@types/pg@8.23.1`,
  `drizzle-kit@0.31.10` and conditional `testcontainers@12.1.0`.
- Updated the technology decision inventory to record the proposal and retain
  the architecture-approval/TASK-020 gate.
- Verified repository and official upstream evidence, exact registry metadata,
  local documentation links, whitespace and Git scope.
- Installed no dependency, changed no lockfile/runtime/configuration, started
  no database/container, created no schema/migration/adapter and did not begin
  TASK-020.
