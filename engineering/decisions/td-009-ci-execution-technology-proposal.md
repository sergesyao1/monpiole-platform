# TD-009: CI Execution Technology Proposal

- Status: **APPROVED — IMPLEMENTED BY TASK-022**
- Date: 2026-08-25
- Governing decision: [ADR-0002](../adr/0002-technology-selection-gate.md)
- Decision owners: Platform Architecture, Platform Engineering, Security
- Scope: CI validation only; deployment and production operations are excluded

## 1. Status

Architecture and Engineering approved this expanded CI execution baseline on
2026-08-25. Approval does not implement or start TASK-022, configure repository
rules, install software, or modify a workflow.

An earlier, narrower TD-009 decision approved GitHub Actions only for the local
architecture check, and TASK-006-08 subsequently implemented and verified
`.github/workflows/architecture-checks.yml`. That committed workflow is current
repository evidence. It covers frozen installation and architecture enforcement
only; it is not evidence that the TD-004 through TD-008 gates run in CI. This
proposal supersedes the earlier decision's scope for future CI evolution without
retroactively denying its historical approval or modifying its workflow.

## 2. Date

Evidence was reviewed on 2026-08-25. Hosted-runner images, action releases,
commercial entitlements and provider behavior are mutable and must be rechecked
at the TASK-022 implementation gate.

## 3. Context

TD-001 through TD-008 provide executable local baselines for Node/TypeScript,
pnpm workspaces, architecture, tests, NestJS, API contracts, event contracts and
PostgreSQL persistence. TD-009 selects only the mechanism that orchestrates
those repository-owned commands. CI must not redefine quality behavior or move
business, architecture, test or migration policy into provider YAML.

The repository is hosted at `github.com/sergesyao1/monpiole-platform` with
`main` as the primary branch. Hosting reduces GitHub Actions integration cost,
but ADR-0002 still requires alternatives, compatibility, security, cost,
operations, migration and rollback evidence.

## 4. Current repository evidence

- HEAD observed for TASK-021: `3ad20e4 docs(persistence): sync TD-008 implementation status`.
- Runtime: Node `>=24.0.0`; observed and previously verified `24.18.0`.
- Package manager: Corepack and exact `pnpm@11.22.0` with one lockfile.
- TypeScript `6.0.3`, Vitest `4.1.11`, dependency-cruiser `18.2.0`.
- NestJS API typecheck/build and deterministic OpenAPI/contract verification.
- Zod-based Integration Event contract typecheck/build/compatibility checks.
- PostgreSQL 18, Drizzle ORM and `pg` infrastructure baseline.
- Testcontainers `12.1.0` proof against PostgreSQL 18.6 on linux/amd64.
- The persistence test image is pinned by immutable digest in repository tests.
- The existing architecture-only GitHub Actions workflow uses `ubuntu-24.04`,
  read-only contents, no persisted checkout credential, pinned action SHAs and
  the frozen-install/architecture commands.

The TASK-021 assertion that no workflow exists is stale. TASK-021 neither
creates nor changes a workflow.

## 5. Requirements

The selected platform must provide GitHub pull-request and main-branch status,
Linux x64 hosted execution, Node 24, Corepack/pnpm, dependency caching,
parallel jobs and dependencies, Docker for Testcontainers, bounded timeouts,
cancellation, actionable logs, least-privilege tokens, fork isolation, OIDC for
future separately approved use, immutable extension references, and branch
rules capable of blocking merges on a stable aggregate result.

CI must run every governed behavior exactly once per validation graph where
possible. An infrastructure failure is a failure, never a skip or success.

## 6. Constraints

- Preserve ADR-0002 and ADR-0006 and every implemented TD-001–TD-008 baseline.
- Use `corepack pnpm install --frozen-lockfile`; no silent package substitution.
- Important checks remain locally executable through repository scripts.
- No SQLite, mock or in-memory substitute for PostgreSQL semantics.
- No production secrets, data, database credentials, deployment permission or
  privileged network access in baseline CI.
- Provider-specific configuration is a thin adapter.
- Workflow and branch/ruleset implementation require TASK-022 and repository
  owner approval respectively.

## 7. Existing local gates

| Governed coverage | Repository commands | CI execution position |
| --- | --- | --- |
| Frozen dependency graph | `corepack pnpm install --frozen-lockfile` | Every independent job initially; pnpm store cache may reduce downloads |
| Test TypeScript | `corepack pnpm typecheck:tests` | Static job |
| Architecture | `corepack pnpm architecture:check` | Architecture job |
| Unit behavior | `corepack pnpm test:unit` | Unit job |
| Non-PostgreSQL integration | `corepack pnpm test:integration` | Integration/contract job |
| API/event contracts | `corepack pnpm test:contract` | Integration/contract job; package-specific contract commands are covered here and need not repeat |
| API | `app:api:typecheck`, `app:api:build` | API job; `app:api:contracts:check` is redundant with the contract project |
| Events | `package:events:typecheck`, `package:events:build` | Events job; package-specific contract command is redundant with the contract project |
| Persistence compile/migrations | `package:persistence:typecheck`, `package:persistence:build`, `package:persistence:migration:check` | Persistence job |
| Real PostgreSQL | `package:persistence:test:integration` | Persistence job, once |

`corepack pnpm test` is an aggregate local convenience gate. CI uses explicit
level/project commands so it does not repeat unit, integration, contract and
persistence tests after running them separately. TASK-022 must prove the set is
equivalent before omitting the aggregate command.

## 8. Candidate comparison

| Criterion | GitHub Actions | GitLab CI for GitHub | Azure Pipelines for GitHub | Jenkins |
| --- | --- | --- | --- | --- |
| Current-host integration | Native events, checks and rulesets | External repository, mirror and webhook integration | GitHub App/OAuth service connection | Webhooks and GitHub plugins |
| Fork PR behavior | Native untrusted `pull_request`; secrets withheld | External GitHub integration does not support fork PR pipelines | Supported with hosted-agent/security controls | Plugin/trust-policy dependent |
| Hosted Linux | Ephemeral Ubuntu x64 VM | Ephemeral GitLab.com Linux VM | Ephemeral Microsoft-hosted Ubuntu VM | None without operating agents |
| Docker/Testcontainers | Docker installed on standard `ubuntu-24.04` x64 image | Docker-in-Docker on privileged hosted Linux runners | Docker available on hosted Ubuntu agents; implementation proof still required | Requires operated Docker-capable agents/plugins |
| Node/Corepack/pnpm | First-party Node action plus shell commands | Container image or shell provisioning | Node tool task or shell provisioning | Operator-owned toolchain/image |
| Parallel graph/timeouts | Native jobs, `needs`, matrices, timeouts | Native stages/needs/parallel | Native stages/jobs/dependencies/timeouts | Pipeline/plugin/executor dependent |
| Permissions/OIDC | Per-workflow/job `GITHUB_TOKEN`; GitHub OIDC | Job tokens, protected variables, ID tokens | Build identity/service connections; workload identity federation | Controller/plugin/credential design |
| Branch protection UX | Native checks and rulesets | Status bridge to GitHub rules | Status bridge to GitHub rules | Status plugin/API to GitHub rules |
| Supply-chain surface | Workflow, runner image and actions | Second SaaS, mirror, runners/images | Second SaaS, connection, tasks/images | Controller, OS, agents and plugin fleet |
| Hosted cost | Public standard runners free; private plan quota/overage | External-repository feature is Premium/Ultimate; compute quotas | Parallel-job entitlement/usage | Infrastructure and staff operations |
| Operational burden | Lowest for current host | Moderate, second control plane and mirror | Moderate, second control plane and connection | Highest |
| Portability | Provider YAML coupling; commands portable | Provider YAML/mirror coupling | Provider YAML/organisation coupling | Jenkinsfile/plugin/controller coupling |

All candidates can execute shell commands. GitHub Actions wins on current-host
integration, fork behavior, least additional trust relationships and operating
burden—not popularity. GitLab's external-repository feature adds Premium/Ultimate
and mirroring, currently ignores fork PRs and may create both push and PR
pipelines. Azure adds an Azure DevOps organisation and service connection.
Jenkins adds controller, plugin, agent, isolation, backup and incident ownership
without a demonstrated private-network or specialist-hardware need.

## 9. Decision

**Approve GitHub Actions** for the expanded validation baseline, with repository
commands retained as the portable source of truth. Implementation was reserved
for and completed by the separately authorized TASK-022.

This decision is **APPROVED — IMPLEMENTED BY TASK-022**. TASK-022 retained the
historical workflow path and superseded its architecture-only content with the
expanded graph; architecture enforcement remains present exactly once.

## 10. Runner model

Use ephemeral standard GitHub-hosted `ubuntu-24.04` x64 runners. Current official
image evidence lists 4 vCPU, 16 GB RAM, 14 GB SSD and Docker Client/Server. Do
not use `ubuntu-slim`: its unprivileged container cannot provide the Docker
behavior required by Testcontainers. Do not require `sudo`, privileged job
containers, Docker-in-Docker, host mounts or additional runner permissions.

Self-hosted runners require a later decision justified by private-network access,
special hardware, compliance, capacity or measured economics. Fork code must
never run on a persistent self-hosted runner with internal access or reusable
credentials. Prefer ephemeral one-job runners if self-hosting is later approved.

## 11. Trigger model

- `pull_request` targeting `main`: complete validation of the merge candidate.
- `push` to `main`: complete validation of the committed merge result.
- `workflow_dispatch`: controlled manual diagnosis/revalidation.
- Scheduled execution: deferred until a defined consumer exists.
- Documentation-only changes: initially run the full required graph. Fragile
  path filters are prohibited. A later optimisation needs a proven change-impact
  model and must retain a stable required result.

Never execute untrusted PR code through `pull_request_target` or another
privileged trigger.

## 12. Pull-request model

Fork and same-repository PR code is untrusted. It receives no repository,
organisation, environment or production secret, no OIDC token, no write token,
and no internal network. Use the normal `pull_request` merge candidate. Do not
download and execute artifacts produced by untrusted code in a privileged job.

Every new commit invalidates the previous validation result. Review policy
should dismiss stale approvals or require approval of the most recent reviewable
push. The latest commit and current base relationship must be validated before
merge.

## 13. Branch protection model

Repository rulesets/settings—not YAML—must require pull requests for `main`,
block force pushes and direct pushes except explicitly governed bypass actors,
and require one stable aggregate check such as `CI / required` from the GitHub
Actions App. Prefer strict/up-to-date checks or a merge queue when concurrency
and usage evidence justify it. Required-check names must remain stable.

Administrator/emergency bypass is not default access. It requires an identified
incident, authorized actor, audit record, time bound, risk acceptance and prompt
post-merge execution of all checks. TASK-022 may define checks but may not
configure repository rules without separate authority.

## 14. Execution graph

```text
bootstrap-policy (workflow/toolchain assertions)
        |
        +--> static/type
        +--> architecture
        +--> unit
        +--> integration-contract
        +--> api
        +--> events
        +--> persistence (Docker + PostgreSQL 18)
                      |
all independent jobs +--> required aggregate result
```

Each job checks out, provisions Node/Corepack and performs a frozen install in
its own ephemeral VM. A separate bootstrap job cannot share its filesystem or
`node_modules`; making all jobs depend on one adds latency without providing
dependencies. Bootstrap policy is therefore common reviewed steps or a future
repository-owned reusable workflow, not an installed-modules artifact.

Independent jobs continue collecting diagnostics when an unrelated job fails.
Within a job, commands stop after a prerequisite failure. Matrix fail-fast is
disabled for independent axes. The final aggregate uses all job results and
succeeds only when every required job succeeded; cancellation, unexpected skip
or infrastructure failure fails the aggregate.

## 15. Dependency and cache model

- Provision exact Node `24.18.0` initially and assert `node --version`.
- Use repository `packageManager` and assert Corepack resolves pnpm `11.22.0`.
- Run `corepack pnpm install --frozen-lockfile` in every job.
- Start cold. Then cache only pnpm's content-addressed store, never
  `node_modules`, build output or credentials.
- Key by OS/architecture, Node, pnpm and `pnpm-lock.yaml` hash. A miss or corrupt
  cache falls back to registry installation.
- Low-trust PRs are restore-only if cache scoping cannot prevent influence on
  trusted runs. Trusted main runs may populate caches.
- Cache is an untrusted optimisation and never changes correctness.

The committed lifecycle allow/deny policy remains authoritative. CI must not
use flags that bypass ignored-build enforcement.

## 16. Testcontainers and PostgreSQL model

Testcontainers starts PostgreSQL directly through the runner's Docker Engine.
Do not also configure a GitHub service container: two provisioning paths add
drift. The repository suite owns startup, random port mapping, readiness,
lifecycle and cleanup.

Use the repository's immutable PostgreSQL 18 image digest. TASK-022 must verify
the digest still resolves to the approved linux/amd64 release, print safe
Docker/PostgreSQL versions, bound startup/test time, and rely on Testcontainers
cleanup plus runner disposal. Container unavailability, pull failure, readiness
timeout or cleanup failure is infrastructure failure, never a skip. Emit safe
container status/startup logs without URLs, passwords, bind values or payloads.

The job needs standard Docker socket access only. Production database credentials
and a CI service database are prohibited.

## 17. Security and permissions model

Declare workflow default `permissions: {}` and grant only `contents: read` to
checkout jobs. Check publication does not justify repository write scopes.
`id-token: write`, packages, actions, deployments, pull requests, issues and
contents write remain disabled.

Checkout must not persist credentials. Shell commands must not interpolate
untrusted event fields. No environment dump, debug secret logging, production
data or tenant payload is allowed. Write permission or OIDC is allowed only in a
separate, later approved trusted workflow/job with a defined effect and audience.

## 18. Supply-chain model

- Pin every external action to a reviewed full 40-character commit SHA; a major
  tag is documentation only. GitHub identifies full SHA pinning as the only
  immutable action reference.
- Prefer GitHub-owned actions and repository shell commands; additional actions
  require owner, license, provenance, permissions and update review.
- TASK-022 reverified official tag refs: `actions/checkout` v7 resolves to
  `3d3c42e5aac5ba805825da76410c181273ba90b1`; `actions/setup-node` v7 resolves
  to `820762786026740c76f36085b0efc47a31fe5020`; and `actions/cache` v5 resolves
  to `caa296126883cff596d87d8935842f9db880ef25`. The workflow pins these full
  SHAs rather than floating tags.
- Pin `ubuntu-24.04`, Node and pnpm policies and log effective versions. Runner
  image patching remains provider-managed and visible in metadata.
- Preserve lockfile, frozen installation and lifecycle-script policy.
- Keep PostgreSQL pinned by immutable digest and review digest updates.
- Artifact/cache actions, if justified, require their own exact reviewed SHAs.

## 19. Concurrency and cancellation model

Group by workflow identity plus PR number for PRs, or full ref for branches.
Cancel superseded PR and same-ref manual runs. Do not let a PR cancel a main run,
or one branch cancel another. Main verification normally completes; if same-main
cancellation is enabled, only a newer main commit may supersede it and the latest
commit must retain a complete result.

## 20. Timeout model

Set an overall expectation of 30 minutes and explicit job limits: 15 minutes for
static, architecture, unit, API and events; 20 minutes for integration/contract;
25 minutes for persistence. Testcontainers startup is independently bounded.
These are safety ceilings, not objectives; TASK-022 measures and tunes them
without infinite retry or masking slowness.

## 21. Failure semantics

| Failure class | Meaning and outcome |
| --- | --- |
| Product/code/build | Compilation or governed behavior fails; required result fails |
| Test | Assertion, contract or tenant proof fails; required result fails |
| Architecture | Forbidden dependency/cycle/policy fails; required result fails |
| Dependency | Frozen drift, registry, integrity, lifecycle or version failure; required result fails |
| CI infrastructure | Runner/provider/network failure; unverified result fails and may be rerun |
| Container infrastructure | Docker/image/startup/cleanup failure; persistence is unverified and result fails |

Only evidenced transient infrastructure failures may be rerun. Deterministic
failures are not retried automatically. A rerun does not erase original evidence.

## 22. Diagnostics and reporting

Every job exposes the failing named command, stdout/stderr and exit code.
Architecture diagnostics remain repository-owned. API/event contract and
migration commands retain native output. Persistence failures include safe Docker
version, Testcontainers status and sanitized container logs. Install failures
include Node/pnpm versions and the frozen-lockfile error, never tokens or dumps.

Use step summaries only for a concise safe result table. No third-party reporter
is required. Logs are the baseline diagnostic record.

## 23. Artifact policy

Baseline CI uploads no build output, workspace, `node_modules`, pnpm store,
OpenAPI, architecture graph, coverage or routine logs. Current outputs are
reproducible and have no downstream artifact consumer. A later approved safe
failure report may use the shortest useful retention, initially at most seven
days. Sanitized container diagnostics belong in job logs by default.

## 24. Coverage position

Coverage remains informational and locally available through TD-004's
`test:coverage`. No threshold or required coverage job is selected because no
governed threshold or consumer exists. That change belongs to testing governance.

## 25. Exception governance

Emergency merge, temporary failing check, provider outage and Testcontainers
outage exceptions require a named owner/approver, incident reference, scope,
reason, risk, start/expiry, compensating local evidence, bypass audit and prompt
post-merge full run. Exceptions cannot make a failing command return success,
cannot treat infrastructure failure as pass, and cannot become permanent by
repetition. Extension requires new approval.

## 26. Cost and operations

Use standard hosted Linux runners; no paid larger runner or self-hosted fleet is
required. Public repositories receive standard hosted minutes free. Private
repositories consume plan-specific included minutes/storage and then usage rates;
visibility, plan and billing authority are not repository evidence and must be
confirmed before TASK-022 activation.

Parallel jobs reduce latency but repeat checkout/install and consume more minutes.
Begin with the logical jobs because diagnostics and the PostgreSQL resource
boundary are useful; measure and consolidate only with evidence. Cancel
superseded PRs, avoid routine artifacts, monitor budget/cache effectiveness.
Testcontainers adds required image-pull/startup/database resource cost.

Self-hosting becomes eligible only when measured cost, capacity, private access,
hardware or compliance needs outweigh fleet security and operations.

## 27. Portability

Provider YAML performs checkout, toolchain setup, orchestration and aggregation
only. Repository scripts own installation, checks, builds, tests, contracts and
migrations. Another provider must run the same commands and prove successful and
intentional-failure parity before required checks switch.

## 28. Rejected alternatives

- **GitLab CI/CD:** external-repo Premium/Ultimate mirroring, missing fork PR
  support and duplicate pipeline risk add cost/complexity without a requirement.
- **Azure Pipelines:** Azure DevOps organisation, GitHub App connection and a
  second permission/billing plane add no current capability gain.
- **Jenkins:** controller, plugins, credentials, agents, Docker, patching,
  isolation, backup and availability become MonPiole-owned.
- **GitHub service-container PostgreSQL:** Testcontainers already owns the real
  PostgreSQL lifecycle and must prove its own path.
- **One monolithic full-test job:** loses parallel diagnostics and repeats
  aggregate tests when explicit suites are mapped.
- **Self-hosted baseline:** lacks private-network, compliance, hardware,
  capacity or measured cost evidence.

## 29. Consequences

Positive: native PR feedback, least additional integration, ephemeral isolation,
Docker-compatible PostgreSQL proof, parallel diagnostics, stable branch gate and
portable local commands.

Negative: GitHub service/image/action availability and pricing dependencies;
repeated installation; pin maintenance; and required Testcontainers cost.

## 30. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Decision approval confused with implementation | NOT IMPLEMENTED status; separate TASK-022 gate; no workflow change |
| Existing narrow workflow mistaken for full coverage | Document two-command scope; expanded aggregate waits for TASK-022 |
| Action compromise/tag movement | Full reviewed SHA pins and controlled updates |
| Runner drift | Explicit image, version logs, tool assertions, hosted smoke proof |
| Fork exfiltration | Normal `pull_request`, no secrets/OIDC/write token, ephemeral VM |
| Cache poisoning | Cold baseline, store-only, tight keys, low-trust restore-only |
| Path filter skips required check | No correctness filters; stable aggregate |
| Failure hides diagnostics | Independent jobs continue; aggregate evaluates all |
| Docker/Testcontainers flakes | Timeouts, safe logs, infrastructure failure, controlled rerun |
| Parallel cost growth | Measure, cancel superseded PRs, budgets, no routine artifacts |
| Provider lock-in | Repository commands and parity-tested migration |

## 31. Deferred decisions

Deployment/CD, production credentials, cloud OIDC audiences, container publishing,
environment promotion, releases, production migrations, deployment approvals,
telemetry backend, self-hosted fleet, Windows/macOS matrices, load infrastructure,
coverage thresholds, scanners and dependency bots remain separately governed.
TD-010 and TD-011 are unchanged.

## 32. Compatibility and evidence matrix

| Component/capability | Evidence on 2026-08-25 | Position |
| --- | --- | --- |
| GitHub-hosted Ubuntu | `ubuntu-24.04` x64 supported; standard image lists Docker Server | Selected policy; reverify in TASK-022 |
| Node | Repository >=24; observed 24.18.0 | Provision/assert exact 24.18.0 initially |
| Corepack/pnpm | `packageManager: pnpm@11.22.0`; frozen lockfile | Use unchanged in every job |
| checkout | Official v7 tag SHA `3d3c42e5aac5ba805825da76410c181273ba90b1` | Implemented immutable pin |
| setup-node | Official v7 SHA `820762786026740c76f36085b0efc47a31fe5020`; Node 24 runtime | Implemented immutable pin |
| cache | Official v5 SHA `caa296126883cff596d87d8935842f9db880ef25` | Implemented immutable pin; pnpm store only |
| Docker/Testcontainers | Ubuntu x64 lists Docker; Testcontainers 12.1.0 passed locally | Hosted proof required before merge gating |
| PostgreSQL | TASK-020 digest proved PostgreSQL 18.6 linux/amd64 | Testcontainers provisioning; digest retained |
| Branch controls | Rulesets support checks, PR rules, stale approvals and bypass | Repository setting, not workflow scope |
| GitLab external CI | Premium/Ultimate, mirror, fork limitation, duplicate pipelines | Compatible but rejected |
| Azure Pipelines | GitHub integration, hosted isolation, fork protection, WIF | Compatible but rejected |
| Jenkins | Pipeline/Multibranch/Docker plugins; operator-owned runtime | Compatible but rejected |

Exact action SHAs were verified against official repository tag refs. No action
or dependency was installed.

## 33. Implementation gate

TD-009 is **APPROVED — IMPLEMENTED BY TASK-022**. Architecture and Engineering approved
the platform, runner, repository-command model, Testcontainers provisioning,
trigger and branch-protection positions, security and permissions, immutable
action references, conservative caching, failure aggregation, diagnostics,
artifact and coverage positions, exception governance and deferred concerns on
2026-08-25.

TASK-022 rechecked repository evidence and immutable action refs, implemented the
smallest adapter, and reviewed triggers, permissions, pins, caching and secret
exposure. All mapped gates were proven locally. Hosted Ubuntu positive and
intentional-negative runs, fork isolation, cancellation and provider diagnostics
remain acceptance evidence to collect after owner review. Repository visibility,
plan/billing and ruleset configuration also remain owner actions under separate
repository-setting authority.

## 34. Verification commands

```text
git diff --check
git diff --stat
git status --short
```

TASK-022 must additionally run all governed gates and hosted positive, negative,
fork, concurrency and Testcontainers verification.

## 35. Evidence

Repository evidence:

- [ADR-0002](../adr/0002-technology-selection-gate.md)
- [ADR-0006](../adr/0006-application-architecture-bounded-contexts-services-boundaries.md)
- [technology decision inventory](technology-decision-inventory.md)
- [TD-008](td-008-persistence-database-technology-proposal.md)
- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- `.github/workflows/architecture-checks.yml` (pre-existing; unchanged)
- `scripts/ci/README.md`

Primary upstream evidence:

- [GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Ubuntu 24.04 image](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub cache security](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
- [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [actions/checkout releases](https://github.com/actions/checkout/releases)
- [actions/setup-node releases](https://github.com/actions/setup-node/releases)
- [GitLab external repositories](https://docs.gitlab.com/ci/ci_cd_for_external_repos/)
- [GitLab-hosted Linux runners](https://docs.gitlab.com/ci/runners/hosted_runners/linux/)
- [Azure Pipelines security](https://learn.microsoft.com/en-us/azure/devops/pipelines/security/overview?view=azure-devops)
- [Azure pipeline caching](https://learn.microsoft.com/en-us/azure/devops/pipelines/release/caching?view=azure-devops)
- [Jenkins Pipeline](https://www.jenkins.io/doc/book/pipeline/)
- [Jenkins Docker Pipeline](https://www.jenkins.io/doc/book/pipeline/docker/)
- [Jenkins credential security](https://www.jenkins.io/doc/book/security/securing-org-folders-and-multibranch-pipelines/)

## Decision gate

**APPROVED — IMPLEMENTED BY TASK-022.**

Architecture and Engineering approved TD-009 on 2026-08-25. TASK-022 subsequently
implemented the validation workflow without changing the approved technology
choice. Repository ruleset changes, deployment behavior and production
credentials remain outside the implementation authority.
