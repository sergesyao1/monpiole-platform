\# TASK-021 — TD-009 CI Execution Technology Decision



\## Status



DONE



\## Objective



Produce the governed TD-009 CI Execution technology proposal for MonPiole.



This task is decision-only.



Do not create CI workflows.

Do not install dependencies.

Do not modify runtime/application source.

Do not implement TD-009 yet.



The objective is to select and govern the CI execution platform and execution

model that will automate the deterministic local quality gates already

implemented in the repository.



\## Current governed baseline



Current expected HEAD:



3ad20e4 docs(persistence): sync TD-008 implementation status



Implemented technology baselines:



\- TD-001 runtime/language/module baseline

\- TD-002 pnpm/workspace baseline

\- TD-003 architecture enforcement baseline

\- TD-004 testing baseline

\- TD-005 NestJS application framework baseline

\- TD-006 API contract baseline

\- TD-007 event contract baseline

\- TD-008 PostgreSQL/Drizzle persistence baseline



TD-009 must automate these governed checks without weakening or redefining them.



\## Repository hosting evidence



Current Git remote:



origin https://github.com/sergesyao1/monpiole-platform.git



Current primary branch:



main



No CI workflow is currently implemented.



Repository hosting is evidence for platform selection, but must not by itself

replace the ADR-0002 technology-selection process.



\## Governed runtime/tooling baseline



Current repository baseline includes:



\- Node.js >=24.0.0

\- observed Node.js 24.18.0

\- pnpm 11.22.0

\- Corepack

\- TypeScript 6

\- Vitest 4

\- dependency-cruiser architecture verification

\- NestJS application build/typecheck

\- API/OpenAPI contract verification

\- event-contract verification

\- PostgreSQL 18 persistence integration

\- Testcontainers

\- Drizzle migration verification



CI must preserve exact governed package-manager behavior.



Dependency installation must use the committed lockfile and frozen installation.



\## Existing deterministic gates



TD-009 must account for at least:



\- corepack pnpm install --frozen-lockfile

\- corepack pnpm typecheck:tests

\- corepack pnpm test

\- corepack pnpm test:unit

\- corepack pnpm test:integration

\- corepack pnpm test:contract

\- corepack pnpm architecture:check

\- corepack pnpm app:api:typecheck

\- corepack pnpm app:api:build

\- corepack pnpm app:api:contracts:check

\- corepack pnpm package:events:typecheck

\- corepack pnpm package:events:build

\- corepack pnpm package:events:contracts:check

\- corepack pnpm package:persistence:typecheck

\- corepack pnpm package:persistence:build

\- corepack pnpm package:persistence:migration:check

\- corepack pnpm package:persistence:test:integration



The decision may rationalize execution grouping and remove redundant execution

from CI, but it must not silently remove governed verification coverage.



\## PostgreSQL/Testcontainers requirement



TD-008 requires PostgreSQL-specific behavior to be verified against real

PostgreSQL 18.



CI must support:



\- Linux containers

\- Docker-compatible container execution

\- Testcontainers for Node.js

\- PostgreSQL 18

\- pinned/controlled container-image policy

\- RLS tests

\- migration tests

\- role/permission tests

\- transaction tests

\- pooled-connection isolation tests



Do not propose replacing these tests with SQLite, mocks, or an in-memory

database.



The proposal must explicitly determine whether PostgreSQL is started directly

by Testcontainers or through CI service-container functionality.



Avoid running two competing PostgreSQL provisioning models without need.



\## Architecture/governance constraints



Respect ADR-0002 technology selection governance.



Respect ADR-0006 ownership and architecture verification requirements.



CI is an execution mechanism for governed checks.



CI configuration must not become a substitute for repository-local scripts.



Developers must remain able to execute the important quality gates locally.



CI-provider-specific behavior must be kept as thin as practical.



\## Candidates to evaluate



Evaluate at minimum:



1\. GitHub Actions

2\. GitLab CI

3\. Azure Pipelines

4\. Jenkins



Additional candidates may be included only when materially justified.



\## Candidate comparison criteria



Compare candidates using at least:



\- compatibility with current Git hosting;

\- pull-request integration;

\- branch protection / required checks;

\- Linux runner availability;

\- Node 24 support;

\- Corepack/pnpm support;

\- dependency caching;

\- Docker/Testcontainers support;

\- PostgreSQL container support;

\- matrix/parallel execution;

\- job dependencies;

\- artifact/report handling;

\- logs and diagnostics;

\- timeout controls;

\- cancellation/concurrency controls;

\- secrets handling;

\- permissions model;

\- OpenID Connect capability where relevant;

\- supply-chain security;

\- third-party action/plugin risk;

\- self-hosted runner requirement;

\- hosted-runner availability;

\- operational burden;

\- maintenance burden;

\- vendor lock-in;

\- cost considerations;

\- ecosystem maturity;

\- repository portability.



Do not select a platform only because it is popular.



\## Required decisions



The proposal must explicitly decide or define the following.



\### CI platform



Select the CI execution platform.



Define why it is appropriate for the current repository and governance model.



\### Runner model



Define:



\- hosted versus self-hosted runner baseline;

\- operating system;

\- architecture;

\- Docker availability;

\- privilege assumptions;

\- future self-hosted runner conditions.



Do not require a self-hosted runner without a demonstrated need.



\### Trigger model



Define expected behavior for:



\- pull requests targeting main;

\- pushes to main;

\- manual execution;

\- optional scheduled execution;

\- documentation-only changes if optimization is proposed.



The correctness baseline must not depend on fragile path filtering.



\### Pull-request and branch protection model



Define:



\- required checks;

\- merge blocking behavior;

\- stale approval/check behavior where applicable;

\- direct push expectations;

\- administrator/emergency exception governance.



Do not assume repository settings can be implemented from workflow YAML alone.



\### CI execution graph



Define logical jobs/stages.



At minimum consider:



1\. bootstrap / dependency installation

2\. static/type verification

3\. architecture verification

4\. unit tests

5\. integration/contract tests

6\. API build/contracts

7\. Events build/contracts

8\. Persistence build/migration/PostgreSQL tests



Determine which checks may safely run in parallel.



Avoid unnecessary duplicate full test execution.



\### Fail-fast semantics



Define:



\- whether independent jobs continue after another independent job fails;

\- job dependency semantics;

\- when fail-fast is appropriate;

\- final required-check semantics.



Diagnostics should not be unnecessarily lost because an unrelated job failed.



\### Dependency installation



Define:



\- Node setup;

\- Corepack behavior;

\- exact pnpm version;

\- frozen lockfile;

\- pnpm store caching;

\- cache key inputs;

\- cache poisoning considerations.



Do not cache node\_modules unless explicitly justified.



\### Testcontainers execution



Define:



\- Docker availability requirements;

\- PostgreSQL 18 image policy;

\- immutable digest position;

\- Testcontainers startup behavior;

\- cleanup;

\- timeout;

\- diagnostic behavior;

\- CI resource considerations.



\### Supply-chain controls



Define baseline controls for:



\- third-party CI actions/plugins;

\- immutable action references;

\- package lockfile;

\- dependency install scripts;

\- container image references;

\- credentials;

\- least-privilege workflow permissions.



Evaluate pinning third-party GitHub Actions by immutable commit SHA if GitHub

Actions is selected.



\### Permissions/security



Define:



\- default workflow permissions;

\- read-only repository permissions where possible;

\- when write permissions are allowed;

\- secret exposure rules;

\- fork pull-request behavior;

\- untrusted code considerations;

\- production credentials prohibition for baseline CI.



CI tests must not require production database credentials.



\### Concurrency/cancellation



Define whether superseded pull-request runs should be cancelled.



Define concurrency grouping expectations.



Main-branch verification must not be accidentally cancelled by unrelated runs.



\### Timeouts



Define job/workflow timeout expectations.



Container/integration tests must fail clearly rather than hang indefinitely.



\### Diagnostics and reporting



Define minimum diagnostics for failures:



\- failing command;

\- test output;

\- architecture diagnostics;

\- migration diagnostics;

\- container startup failure;

\- PostgreSQL/Testcontainers logs where safe;

\- dependency/install failures.



Sensitive information must not be emitted.



\### Artifacts



Decide whether baseline CI requires:



\- test reports;

\- coverage reports;

\- OpenAPI artifacts;

\- architecture reports;

\- build artifacts;

\- logs.



Do not persist artifacts without a defined consumer or retention purpose.



\### Coverage



TD-004 owns testing strategy.



TD-009 must determine whether coverage is:



\- informational;

\- required;

\- deferred.



Do not invent a coverage threshold unless governed evidence supports it.



\### Exceptions



Define how CI exceptions are governed.



Examples:



\- emergency merge;

\- temporary failing check;

\- runner outage;

\- Testcontainers infrastructure outage.



Exceptions must be explicit, auditable, time-bounded, and must not silently

disable repository-local checks.



\### Failure semantics



Define the difference between:



\- product/code failure;

\- test failure;

\- architecture violation;

\- dependency failure;

\- CI infrastructure failure;

\- container infrastructure failure.



Do not treat infrastructure failure as successful verification.



\### Portability



Keep important verification logic in repository scripts.



CI workflow should orchestrate repository commands rather than duplicate their

implementation in provider-specific YAML.



\## GitHub Actions-specific evaluation



Because the repository is currently hosted on GitHub, explicitly evaluate:



\- pull\_request and push events;

\- workflow\_dispatch;

\- GitHub-hosted Ubuntu runners;

\- Docker/Testcontainers compatibility;

\- dependency caching;

\- concurrency groups;

\- job-level permissions;

\- branch protection / rulesets;

\- required status checks;

\- action SHA pinning;

\- fork PR security;

\- GitHub artifact/report capabilities.



This section is evaluation, not pre-selection.



\## CI version governance



Research exact current supported major versions/references for any selected

first-party or third-party CI actions.



Do not invent action versions.



If GitHub Actions is selected, evaluate at minimum the current supported

versions/references for actions such as:



\- checkout

\- setup-node



Determine whether governance should pin by immutable commit SHA rather than

floating tags.



Do not create workflow YAML during TASK-021.



\## Cost/operational considerations



Document:



\- expected hosted-runner usage;

\- public/private repository implications where relevant;

\- future scaling considerations;

\- Testcontainers runtime cost;

\- parallel-job trade-offs;

\- when self-hosted runners might become justified.



Do not introduce paid infrastructure as a hidden requirement.



\## Deferred concerns



Explicitly identify concerns outside the TD-009 baseline, potentially including:



\- deployment/CD;

\- production credentials;

\- container image publishing;

\- environment promotion;

\- release orchestration;

\- production database migrations;

\- deployment approvals;

\- observability backend;

\- self-hosted runner fleet;

\- performance/load-test infrastructure.



TD-010 and TD-011 remain separately governed.



\## Expected decision artifact



Create:



engineering/decisions/td-009-ci-execution-technology-proposal.md



The document must include at minimum:



1\. Status

2\. Date

3\. Context

4\. Current repository evidence

5\. Requirements

6\. Constraints

7\. Existing local gates

8\. Candidate comparison

9\. Decision

10\. Runner model

11\. Trigger model

12\. Pull-request model

13\. Branch protection model

14\. Execution graph

15\. Dependency/cache model

16\. Testcontainers/PostgreSQL model

17\. Security/permissions model

18\. Supply-chain model

19\. Concurrency/cancellation model

20\. Timeout model

21\. Failure semantics

22\. Diagnostics/reporting

23\. Artifact policy

24\. Coverage position

25\. Exception governance

26\. Cost/operations

27\. Portability

28\. Rejected alternatives

29\. Consequences

30\. Risks and mitigations

31\. Deferred decisions

32\. Compatibility/evidence matrix

33\. Implementation gate

34\. Verification commands

35\. Evidence



\## Allowed changes



Create:



engineering/decisions/td-009-ci-execution-technology-proposal.md



Update only when governance requires:



engineering/decisions/technology-decision-inventory.md

.codex/tooling/STEP-3-TOOLING-REGISTRY.md

.codex/tasks/TASK-021-td-009-ci-execution-technology-decision.md



\## Forbidden changes



Do not create or modify:



\- .github/workflows/\*

\- .gitlab-ci.yml

\- Jenkinsfile

\- azure-pipelines.yml

\- application source

\- service source

\- package runtime source

\- Dockerfiles

\- deployment infrastructure

\- production configuration



Do not:



\- install dependencies;

\- change package.json;

\- change pnpm-lock.yaml;

\- implement CI;

\- configure GitHub repository branch protection;

\- create deployment/CD workflows;

\- commit changes.



TASK-021 is strictly a decision/governance task.



\## Implementation gate



TD-009 was approved by Architecture and Engineering on 2026-08-25. Expanded CI

implementation remains separately governed and has not started.



Expected sequence:



TASK-021

&#x20; -> TD-009 CI Execution Decision

&#x20; -> Architecture/Engineering Review

&#x20; -> TD-009 Approval

&#x20; -> Documentation Commit

&#x20; -> TASK-022 CI Execution Baseline Implementation



TASK-022 must not begin during TASK-021.



\## Verification



Before completion:



1\. Verify only allowed documentation/governance files changed.

2\. Run documentation consistency checks available in the repository.

3\. Run:



git diff --check

git diff --stat

git status --short



No workflow implementation may exist at completion.



\## Completion evidence



Report:



\- files created;

\- files modified;

\- CI candidates compared;

\- recommended platform;

\- runner recommendation;

\- trigger model;

\- branch protection recommendation;

\- execution graph;

\- Testcontainers/PostgreSQL execution model;

\- caching model;

\- security/permissions model;

\- supply-chain controls;

\- failure semantics;

\- diagnostics/reporting;

\- exception governance;

\- compatibility/version evidence;

\- deferred concerns;

\- verification results;

\- git diff --stat;

\- git status --short.



Do not commit.



\## Completion criteria



TASK-021 is complete when:



\- current repository evidence is documented;

\- at least GitHub Actions, GitLab CI, Azure Pipelines and Jenkins are compared;

\- a CI platform is recommended;

\- runner model is defined;

\- triggers are defined;

\- PR/main behavior is defined;

\- branch protection requirements are defined;

\- local governed gates are mapped to CI execution;

\- redundant execution is considered explicitly;

\- PostgreSQL/Testcontainers CI behavior is defined;

\- dependency caching is governed;

\- permissions and fork security are defined;

\- supply-chain controls are defined;

\- action/plugin version governance is evidence-based;

\- concurrency and cancellation are defined;

\- timeouts are defined;

\- failure semantics are explicit;

\- diagnostics are defined;

\- artifact policy is explicit;

\- coverage position is explicit;

\- exception governance is explicit;

\- deferred CD/deployment concerns remain deferred;

\- no CI workflow has been implemented;

\- repository documentation verification passes;

\- TD-009 approval is recorded; TASK-022 remains separately governed and not started.

