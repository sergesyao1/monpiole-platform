\# TASK-020 — TD-008 Persistence / Database Baseline Implementation



\## Status



DONE



\## Objective



Implement the approved TD-008 Persistence / Database Technology Baseline.



Approved decision:



engineering/decisions/td-008-persistence-database-technology-proposal.md



Baseline commit:



3779bdc docs(persistence): approve TD-008 database baseline



This task implements infrastructure capability only.



It MUST NOT invent or implement Tenant Onboarding product persistence.



\## Approved technology baseline



Use the exact approved candidates, subject to installation-time compatibility verification:



\- PostgreSQL major 18

\- drizzle-orm 0.45.2

\- pg 8.23.0

\- @types/pg 8.23.1

\- drizzle-kit 0.31.10

\- testcontainers 12.1.0



Do not substitute RC, beta or alternative ORM versions.



\## Architecture requirements



Preserve Clean Architecture and DDD boundaries.



Domain and Application must not depend on:



\- PostgreSQL

\- Drizzle

\- pg

\- database schemas

\- migrations

\- SQL

\- database errors



Persistence implementation belongs to Infrastructure.



Do not create a generic business Repository base class.



Do not introduce shared mutable business tables.



Do not create cross-bounded-context database access.



\## Implementation scope



Implement the minimum reusable PostgreSQL infrastructure baseline needed to prove TD-008.



\### Persistence package



Create an appropriate infrastructure package, expected to be:



packages/persistence



The package may contain infrastructure-only primitives for:



\- PostgreSQL pool creation and lifecycle

\- typed connection configuration

\- transaction execution

\- tenant transaction context

\- PostgreSQL error translation where justified

\- infrastructure exports



Do not expose Drizzle or pg handles through inward-facing application/domain contracts.



\### PostgreSQL connection



Implement:



\- environment/config-derived connection configuration

\- pg Pool creation

\- explicit pool lifecycle

\- safe shutdown

\- no committed credentials

\- no hard-coded production connection strings



Do not log credentials or connection URLs.



\### Transaction baseline



Implement and prove:



\- explicit transaction start

\- COMMIT

\- ROLLBACK

\- READ COMMITTED default

\- callback/use-case transaction scope

\- transaction-local tenant context

\- no session-global tenant state



Use PostgreSQL transaction-local tenant context consistent with TD-008, such as parameterized:



set\_config('app.tenant\_id', ..., true)



Do not expose pg Client or Drizzle transaction objects to Domain/Application.



\### Tenant isolation proof



TASK-020 must prove the approved defense-in-depth mechanism without inventing a MonPiole product table.



Use synthetic integration-test fixtures only.



A synthetic tenant-owned test table/schema may be created exclusively by integration-test setup or test migration assets.



It must not be presented as a production product model.



Prove:



1\. tenant context is mandatory for tenant-scoped operations;

2\. explicit tenant predicate behavior;

3\. PostgreSQL RLS behavior;

4\. FORCE ROW LEVEL SECURITY where required by the approved decision;

5\. tenant A cannot read tenant B rows;

6\. tenant A cannot mutate tenant B rows;

7\. missing tenant context fails closed;

8\. pooled connection reuse does not leak tenant context;

9\. runtime role cannot bypass RLS.



\### Database roles



For integration proof, model distinct responsibilities where practical:



\- owner/migration role

\- runtime non-owner role



Runtime role must not have:



\- SUPERUSER

\- BYPASSRLS

\- table ownership



Production credentials are outside TASK-020.



\### Drizzle baseline



Prove Drizzle compatibility with:



\- Node >=24 repository baseline

\- TypeScript 6

\- NodeNext/ESM

\- pg

\- PostgreSQL 18

\- schema declaration

\- parameterized query execution

\- transaction integration



Drizzle-specific types remain infrastructure-only.



\### Migration baseline



Introduce the minimum Drizzle migration configuration required to prove the approved migration workflow.



Migrations must be:



\- generated/reviewable SQL

\- version controlled

\- deterministic

\- applicable to an empty PostgreSQL 18 database

\- verifiable in integration tests



Do not use uncontrolled drizzle-kit push.



Do not create MonPiole product tables.



A synthetic persistence verification migration is permitted only when clearly test/baseline scoped.



\### Testcontainers



Install and configure Testcontainers as approved by TD-008.



Integration tests must use real PostgreSQL 18.



Do not replace PostgreSQL behavior tests with:



\- SQLite

\- in-memory databases

\- mocked SQL engines



Container image/tag/digest handling must follow the approved TD-008 supply-chain position as far as repository evidence permits.



If the local environment cannot run containers, fail transparently rather than silently substituting another database.



\## Architecture enforcement



Extend architecture verification where necessary to prevent:



\- Domain importing @monpiole/persistence

\- Application importing infrastructure database technology where prohibited

\- services directly importing pg

\- services directly importing drizzle-orm unless explicitly infrastructure-owned

\- database technology leaking into governed contract packages



Do not weaken existing architecture checks.



\## Dependencies



Install only approved dependencies required by TD-008.



Expected runtime dependencies:



\- drizzle-orm@0.45.2

\- pg@8.23.0



Expected development dependencies:



\- @types/pg@8.23.1

\- drizzle-kit@0.31.10

\- testcontainers@12.1.0



Before installation, verify registry metadata and compatibility again.



Use pnpm/corepack according to the repository baseline.



The lockfile must remain compliant with repository supply-chain policies.



\## Product-scope prohibition



TASK-020 MUST NOT implement:



\- Tenant aggregate persistence

\- Tenant Onboarding repository

\- Tenant Onboarding production schema

\- billing persistence

\- identity persistence

\- listing/property persistence

\- subscription persistence

\- advertisement persistence

\- production Outbox/Inbox tables



Those belong to later product/bounded-context tasks.



\## Testing requirements



Add integration tests proving at minimum:



\- PostgreSQL container startup

\- connectivity

\- migration application

\- Drizzle query compatibility

\- commit

\- rollback

\- READ COMMITTED baseline

\- tenant-local set\_config behavior

\- RLS tenant isolation

\- missing-context fail-closed behavior

\- pooled connection reuse safety

\- role/bypass assumptions



Add unit tests where infrastructure behavior can be meaningfully tested without pretending to verify PostgreSQL semantics.



\## Documentation



Update documentation/tooling registry only where required to record the implemented baseline.



Update TD-008 implementation status only after all implementation gates pass.



TASK-020 should end as DONE only if the baseline is actually verified.



\## Required verification



Run the repository's existing gates plus persistence-specific gates.



At minimum:



corepack pnpm install

corepack pnpm typecheck:tests

corepack pnpm test

corepack pnpm architecture:check

corepack pnpm app:api:typecheck

corepack pnpm app:api:build

corepack pnpm package:events:typecheck

corepack pnpm package:events:build



Also run any new persistence:



\- typecheck

\- build

\- unit tests

\- PostgreSQL integration tests

\- migration verification

\- tenant/RLS verification



Run:



git diff --check

git diff --stat

git status --short



\## Completion evidence



Report:



\- dependencies installed

\- files created

\- files modified

\- package structure

\- connection baseline

\- transaction implementation

\- tenant context mechanism

\- RLS proof

\- migration proof

\- Testcontainers/PostgreSQL version used

\- architecture enforcement changes

\- test results

\- typecheck/build results

\- migration results

\- git diff --check

\- git diff --stat

\- git status --short



Do not commit.



\## Completion criteria



TASK-020 is complete only when:



\- approved dependencies are installed with verified compatible versions;

\- PostgreSQL 18 integration is proven;

\- Drizzle + pg compatibility is proven;

\- persistence technology remains infrastructure-only;

\- transactions commit and rollback correctly;

\- READ COMMITTED baseline is verified;

\- tenant transaction context is transaction-local;

\- RLS isolation is proven against real PostgreSQL;

\- missing tenant context fails closed;

\- pooled connections do not leak tenant identity;

\- runtime test role cannot bypass RLS;

\- migration workflow is proven;

\- Testcontainers integration is operational;

\- architecture checks remain passing;

\- existing TD-004 through TD-007 tests remain passing;

\- no product persistence has been invented;

\- repository verification gates pass.

