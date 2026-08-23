# TD-009: CI execution and platform selection

- Decision ID: TD-009
- Status: **APPROVED**
- Date: 2026-08-23
- Governing decision: [ADR-0002](../adr/0002-technology-selection-gate.md)
- Decision owner: Platform Architecture and Platform Engineering
- Scope: Decision proposal only; no CI platform, workflow, runner, secret, or external service is configured

## Problem statement and context

MonPiole has deterministic local architecture enforcement but no approved CI
execution platform. The repository needs pull-request and branch validation that
runs the existing commands unchanged, reports their real exit status, and can grow
into later build, test, security, and deployment stages without prematurely adding
operational infrastructure.

The source repository is currently hosted on GitHub, as documented by its clone
URL. Source hosting is evidence about integration cost, not an automatic CI
selection. ADR-0002 requires this choice to compare alternatives and remain behind
an explicit approval gate.

## Evidence baseline

The following repository evidence was reviewed:

- accepted ADR-0001 through ADR-0006;
- approved TD-001: Node.js 24 or later, strict TypeScript, and native ESM;
- approved TD-002: pnpm native workspaces, pnpm 11.22.0, one shared lockfile,
  frozen installation, and no separate task orchestrator at baseline;
- approved TD-003: dependency-cruiser plus repository-owned architecture policy
  checks behind one stable command;
- TASK-006-07, whose technical verification records both baseline commands as
  passing;
- TASK-006-08, which permits reuse of the local command but blocks CI integration
  pending TD-009 approval;
- `package.json`, `pnpm-lock.yaml`, `tools/quality/README.md`, and
  `scripts/ci/README.md`.

The executable source of truth is:

```text
corepack pnpm install --frozen-lockfile
corepack pnpm architecture:check
```

The root manifest declares Node.js `>=24.0.0`, Corepack package-manager metadata
for pnpm `11.22.0`, TypeScript `6.0.3`, and dependency-cruiser `18.2.0`. CI must
not wrap, filter, replace, or change the failure semantics of these commands.

Provider capabilities and commercial terms can change. The official documentation
in the references was reviewed on 2026-08-23; prices and entitlement must be
revalidated immediately before approval or activation.

## CI requirements and comparison criteria

The minimum platform must provide:

1. native or supportable integration with the GitHub-hosted repository;
2. pull-request, protected/default-branch push, and manual re-run triggers;
3. Linux execution with a pinned supported Node.js 24 release and Corepack;
4. exact pnpm 11.22.0 activation and frozen lockfile installation;
5. faithful propagation of non-zero command exit codes;
6. readable step logs, commit status/check reporting, and bounded retention;
7. least-privilege repository access with no secrets in untrusted pull requests;
8. safe, optional dependency caching that cannot become a correctness dependency;
9. concurrency controls to cancel superseded work where safe;
10. a path to future test, security, artifact, and deployment stages; and
11. proportionate cost, maintenance, migration, and rollback.

Evaluation also covers hosted and self-hosted runners, operating systems,
supply-chain exposure, permissions, secret management, diagnostics, artifacts,
operational burden, and provider coupling.

## Candidate platforms

### A. GitHub Actions

GitHub Actions provides repository-native events, pull-request checks, Linux,
Windows, and macOS hosted virtual machines, self-hosted runners, job matrices,
parallel jobs, logs, caches, and artifacts. GitHub-hosted jobs use fresh virtual
machines. A per-job `GITHUB_TOKEN` permission model can be reduced explicitly.

This candidate has the smallest integration surface for the current source host:
it needs no repository mirror, cross-provider service connection, or independently
operated controller. Its material coupling is GitHub workflow syntax, marketplace
actions, hosted-runner images, retention, and billing.

### B. GitLab CI/CD connected to GitHub

GitLab documents CI/CD for an external GitHub repository, including repository
mirroring and status integration subject to GitLab tier and configuration. GitLab
offers instance, group, and project runners, including hosted and self-managed
models, plus variables, caches, artifacts, logs, and concurrency controls.

It can run the required shell commands, but the current repository would acquire a
second control plane and cross-provider credentials/integration. That burden may be
justified if GitLab is already an organisational standard; no such requirement or
existing MonPiole service is evidenced in the repository.

### C. Azure Pipelines connected to GitHub

Azure Pipelines supports GitHub repositories through a GitHub App, OAuth, or other
service connection models, pull-request and CI triggers, Microsoft-hosted or
self-hosted agents, caches, artifacts, logs, and parallel jobs. Microsoft-hosted
agents are freshly imaged per job; Microsoft explicitly recommends hosted agents
over internal self-hosted agents for untrusted fork code.

It is technically compatible but introduces an Azure DevOps organisation, a
cross-provider connection, and a second permissions and billing boundary. It may
be preferable if Azure DevOps governance or future Azure delivery requirements are
approved later; neither is an approved baseline today.

### D. Jenkins with self-hosted agents

Jenkins Pipeline and Multibranch Pipeline can discover branches and pull requests,
allocate agents, archive basic reports, and integrate with GitHub through plugins.
It can run Node/Corepack/pnpm on Linux, Windows, or macOS hosts under operator
control.

Jenkins avoids per-minute managed-runner dependency and offers maximum environment
control, but MonPiole would own controller availability, TLS, backups, upgrades,
plugins, agents, isolation, scaling, logs, credentials, and incident response.
Jenkins documentation also warns that users or pull-request code able to influence
a Pipeline may capture credentials available to that Pipeline. There is no current
requirement for private-network access or specialist hardware to justify this
surface.

## Comparative analysis

| Criterion | GitHub Actions | GitLab CI/CD for GitHub | Azure Pipelines for GitHub | Jenkins self-hosted |
| --- | --- | --- | --- | --- |
| Repository integration | Native events, checks, and branch controls | External-repository integration/mirroring and cross-provider setup | GitHub App/OAuth/service connection | Webhooks plus SCM/branch-source plugins and credentials |
| Execution model | Managed service; hosted fresh VMs or self-hosted runners | Managed or self-managed GitLab; hosted or owned runners | Azure DevOps service/server; hosted or owned agents | Operator-owned controller and agents |
| OS support | Hosted Linux, Windows, macOS; custom self-hosted | Runner/executor dependent; custom self-managed | Hosted Linux, Windows, macOS plus self-hosted | Whatever the operator provisions |
| Node/Corepack/pnpm fit | Direct shell execution; pin Node and package-manager version | Direct shell execution; image/runner must be governed | Direct shell execution; tool/image version must be governed | Direct shell execution; operator maintains toolchain/image |
| PR and branch triggers | Native | Supported through external repository integration | Supported through GitHub integration | Supported by Multibranch/SCM plugins |
| Least privilege | Explicit job/workflow token permissions | Project/access tokens and protected/scoped variables | Service-connection and pipeline/job authorization controls | RBAC and credential scopes depend on core/plugin configuration |
| Isolation for untrusted code | Fresh hosted VM; fork secret restrictions | Hosted-runner isolation depends on offering; owned runners require hardening | Fresh hosted agent; official guidance favors it for forks | Entirely operator-designed; highest exposure to internal network and credentials |
| Cache/artifacts | Native cache and artifact services | Native cache and artifacts | Native cache and pipeline artifacts | Plugin/filesystem/object-store dependent; operator retains capacity |
| Diagnostics | Repository-native logs, annotations/check status, re-runs | GitLab job logs/status mirrored to GitHub | Azure logs/status surfaced to GitHub | Jenkins console/status; plugin-dependent GitHub UX |
| Concurrency | Parallel jobs, matrices, concurrency groups | Runner capacity and pipeline concurrency controls | Parallel-job entitlement and agent pools | Agent/executor capacity owned by operator |
| Operational burden | Lowest for current host with hosted runners | Moderate: second SaaS/control plane and sync/integration | Moderate: second SaaS/control plane and service connection | Highest: controller, plugins, agents, security, backup, scaling |
| Migration/provider coupling | Workflow syntax and GitHub services | GitLab YAML, project, runner, and mirror coupling | Azure YAML, organisation, agent, and connection coupling | Jenkinsfile, plugin set, controller state, and agent image coupling |
| Cost evidence | Entitlement/minutes/storage depend on repository visibility and GitHub plan | Compute quota/tier and external-repository features depend on GitLab plan | Hosted parallel-job entitlement and minutes depend on Azure DevOps plan | Software is open source; infrastructure and engineering operations are borne directly |

All four candidates can execute the two commands. Compatibility therefore does
not differentiate them materially; integration surface, isolation, permissions,
and operational ownership do.

## Runner model

The proposed baseline is an ephemeral GitHub-hosted Linux runner. Linux is enough
for the current architecture checks, has the smallest billed multiplier in common
managed-CI pricing models, and avoids maintaining a privileged long-lived host.
The implementation must pin an explicit supported runner image policy and Node.js
24 patch line; an unreviewed floating toolchain must not silently redefine the
baseline.

Self-hosted runners are not proposed initially. They should require a later,
evidence-backed review for private-network access, specialist hardware, compliance,
or measured cost/performance need. If introduced, pull-request code from forks must
not run on a persistent runner with internal network access or reusable credentials;
prefer ephemeral, one-job runners with controlled egress and immutable images.

Windows and macOS jobs are deferred until a supported product journey requires
them. The architecture check itself is designed to normalize paths, but a future
cross-platform matrix must be justified by compatibility requirements rather than
used as the initial CI baseline.

## Trigger strategy

After approval, a separate implementation task should configure one required
quality job for:

- pull requests targeting protected/default branches, using the pull-request head
  code in an unprivileged context;
- pushes to the protected/default branch, to verify the merged commit; and
- manual dispatch for controlled diagnosis and re-runs.

Do not use a privileged pull-request-target-style trigger to execute untrusted
checkout code. Do not expose secrets to fork pull requests. Branch/path filtering
must not allow architecture-relevant changes to bypass the required check. Start
with a full-repository check; changed-only optimisation requires separate proof.

Use a concurrency group per pull request or branch and cancel superseded in-progress
validation, except where retaining every run is required for audit. A later branch
protection task may make the stable job name a required check; this proposal does
not change repository settings.

## Permissions and security model

The architecture validation job requires source checkout and status reporting, not
write access to repository contents, packages, pull requests, issues, deployments,
identity tokens, or environments. The future workflow must declare least privilege
explicitly, with repository contents read-only and all unnecessary token scopes
disabled. Provider and checkout mechanisms must be pinned and reviewed.

Third-party reusable actions are executable supply-chain dependencies. Prefer
small shell steps and provider-maintained actions only where they materially reduce
risk or complexity. Pin every action to an immutable full commit SHA, review its
source and transitive behavior, and use an approved update process. Runner image,
Node distribution, Corepack shims, npm registry packages, actions, and cache inputs
are all part of the CI supply chain.

The job must have no production credentials, tenant data, deployment permissions,
cloud identity federation, or access to private service networks. Logs and reports
must not contain environment dumps, tokens, source payloads, customer data, or
machine-specific secrets.

## Secrets strategy

No secret is required for frozen installation of public dependencies and the local
architecture check under the current baseline. The future job must therefore define
no repository, organisation, or environment secret and must not pass the automatic
CI token to arbitrary commands.

If private registries or later deployment stages are approved, isolate them into
separate jobs and trust contexts. Use short-lived, narrowly scoped identities where
available, protected environments and human approval for privileged effects, and
never expose them to fork-generated code. That later need requires focused security
review and does not broaden this decision.

## Caching strategy

Begin with a cold frozen install to prove correctness. After reproducibility is
measured, cache only the pnpm content-addressed store, never `node_modules`, build
outputs, credentials, or generated policy results. Key the cache at least by runner
OS, Node major/approved patch policy, pnpm version, and the hash of
`pnpm-lock.yaml`. A cache miss or restore failure must fall back to normal frozen
installation and cannot change pass/fail semantics.

Treat restored cache content as untrusted. Do not place secrets in caches, do not
permit low-trust runs to publish a cache that a privileged job executes without
isolation, and use provider scope controls. GitHub explicitly distinguishes caches
from artifacts and warns that poisoned or sensitive caches can affect other runs.

## Diagnostics, failure, and reporting strategy

Run the two baseline commands as separate, plainly named steps in their documented
order. Preserve stdout, stderr, and the exact non-zero exit status. Do not pipe
output through a command that masks failure, retry deterministic violations, or
convert architecture failures into warnings.

The repository-owned text diagnostics remain authoritative. The provider log and
commit check should identify which step failed. Upload a report only when the
repository later emits a stable machine-readable report or when a short-lived text
artifact materially improves investigation. Logs are not release artifacts;
retention should be the shortest period compatible with review and audit needs.
Never upload the pnpm store, `node_modules`, the full workspace, environment dumps,
or secrets as diagnostics.

## Compatibility implications

The recommendation changes no application, service, package, API, event, tenant,
or architecture boundary. It consumes the root quality interface and preserves
TD-001, TD-002, and TD-003 semantics. The selected runner must fail closed if it
cannot provision the approved Node/Corepack/pnpm versions or if frozen installation
detects lockfile drift.

Provider YAML is an execution adapter, not a second quality implementation. Future
build, test, security, and deployment jobs must call separately approved repository
commands and must not embed bounded-context logic in CI configuration.

## Operational considerations

GitHub-hosted execution delegates VM lifecycle, patching, capacity, and base-image
maintenance to the provider, leaving MonPiole responsible for workflow review,
tool/action pinning, usage monitoring, retention, and incident response. Hosted
image changes remain an external risk, so the job must print or otherwise expose
the effective Node and pnpm versions and fail version assertions before validation.

Monitor queue time, execution duration, failure rate, flaky/re-run rate, cache hit
rate, and billed usage. Add parallel jobs only when stages are independently useful;
the current install and architecture check should remain one ordered job so they
share one workspace and failure trail.

## Cost considerations

No repository evidence states visibility, GitHub plan, organisation policy, monthly
run count, duration, retention, or regional tax; therefore a defensible currency
forecast cannot be produced. GitHub, GitLab, and Azure publish plan-dependent hosted
compute and storage entitlements. Jenkins has no managed-runner licence fee in this
comparison but shifts infrastructure, availability, security, upgrade, and staff
cost to MonPiole.

Before activation, Platform Engineering must record repository visibility and plan,
measure a cold and warm local duration, estimate pull-request/push volume, apply the
then-current official hosted-runner and storage rates, and set a usage alert. This
is an approval/implementation prerequisite, not a reason to invent present cost.

## Migration strategy

There is no CI workflow to migrate. After explicit approval and a separately
authorized TASK-006-08 implementation:

1. confirm repository visibility, plan entitlement, billing owner, and branch model;
2. choose and document an explicit hosted Linux image and Node.js 24 patch policy;
3. create one unprivileged validation job containing only checkout/toolchain setup
   and the two unchanged baseline commands;
4. pin reviewed action dependencies to immutable SHAs and declare minimum token
   permissions;
5. run it manually or on a non-required branch and compare output/exit status with
   a fresh local frozen installation;
6. test an intentional violation in a disposable review branch to prove failure;
7. test pull-request and merged-branch triggers, fork behavior, concurrency, logs,
   and absence of secrets;
8. measure cold execution before optionally adding the bounded pnpm-store cache;
9. obtain security and owner review; and
10. only then make the stable check required through a separately authorized
    repository-governance change.

Future stages should be added incrementally after their own commands and technology
choices are approved. Deployment credentials and environments must remain separate
from pull-request validation.

## Rollback strategy

Before approval, rollback is rejection or revision of this proposal. During a
future isolated implementation, rollback means disabling the required-check setting
first if it blocks repository recovery, then removing the workflow in a reviewed,
reversible change. The local commands, lockfile, and architecture enforcement stay
intact and continue to be required locally.

If migrating to another provider, implement the replacement as a thin adapter for
the same two commands, compare success and intentional-failure evidence in parallel,
switch the required status only after equivalence is proven, and then remove the old
workflow and integration. Never weaken the local quality gate to ease migration.

## Major risks and mitigations

| Risk | Mitigation / decision gate |
| --- | --- |
| Proposal is mistaken for approval | Keep TD-009 PROPOSED; require explicit owner acceptance and separate implementation scope |
| Floating runner or tool version changes results | Pin image/tool policy, assert effective versions, keep the lockfile frozen |
| Third-party action compromise | Minimize actions, pin full SHAs, review source/updates, grant least privilege |
| Fork code steals a token or secret | No secrets, read-only token, unprivileged PR trigger, no internal self-hosted runner |
| Cache poisoning changes execution | Cache only pnpm store, key tightly, treat as untrusted, prove cold fallback |
| Provider outage or lock-in blocks merges | Local command remains authoritative; documented manual evidence and adapter-based migration |
| Path filters or changed-only mode miss violations | Full check on every governed PR/default-branch push until equivalence is proven |
| Logs/artifacts leak data | No production data/credentials; bounded retention; upload only explicit safe reports |
| Hosted costs grow unexpectedly | Measure duration/volume, validate current plan/rates, alerts and concurrency cancellation |
| Self-hosting is introduced for convenience | Require separate evidence and security/operations review before persistent runners |

## Consequences

Positive consequences are repository-native feedback, a small managed operational
surface, fresh isolated Linux runners, explicit least privilege, unchanged local
quality semantics, and a straightforward path to additional independently governed
jobs.

Negative consequences are dependency on GitHub availability, pricing, workflow
syntax, runner images, retention, and action ecosystem. Hosted execution may have
queue and cold-install latency. MonPiole must maintain pinning, permission review,
usage monitoring, and a tested migration path.

GitLab CI/CD, Azure Pipelines, and Jenkins remain viable alternatives if future
organisation standards, network placement, compliance, capacity, or cost evidence
outweighs the current integration and operational advantages. No source-hosting
decision is made or made irreversible here.

## Recommendation

Subject to explicit human approval, select **GitHub Actions with an ephemeral
GitHub-hosted Linux runner** as the initial CI execution platform for MonPiole.
Use one unprivileged quality job for pull requests and protected/default-branch
pushes, plus manual dispatch, and execute exactly:

```text
corepack pnpm install --frozen-lockfile
corepack pnpm architecture:check
```

This is the smallest operational surface supported by current evidence. It avoids
a second SaaS control plane and cross-provider credential, and it avoids operating
a Jenkins controller or persistent runner before private-network, hardware, or
measured economics require one. The recommendation is about CI execution only; it
does not approve deployment infrastructure, cloud provider, containers,
orchestration, security scanners, secrets, or any other platform technology.

## Approval gate

TD-009 remains **PROPOSED** until Platform Architecture, Platform Engineering, and
the security owner explicitly accept, reject, or request revision. Approval must
confirm:

- GitHub Actions and ephemeral hosted Linux as the initial platform/runner model;
- the unchanged command and deterministic failure contract;
- pull-request, default/protected-branch, manual, fork, and concurrency behavior;
- explicit least-privilege permissions and a no-secret architecture job;
- action/tool pinning, cache boundaries, diagnostics, and retention;
- current plan, entitlement, billing owner, cost estimate, and usage alert;
- migration and rollback; and
- that TASK-006-08 is the only next implementation authority.

Until that approval, no workflow may be created, no external service enabled, no
secret configured, no runner registered, and no required status check activated.

## References

1. GitHub, [Understanding GitHub Actions](https://docs.github.com/en/actions/get-started/understand-github-actions).
2. GitHub, [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
3. GitHub, [Use `GITHUB_TOKEN` for authentication in workflows](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token).
4. GitHub, [Dependency caching](https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching).
5. GitHub, [Billing for GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
6. GitLab, [Using GitLab CI/CD with a GitHub repository](https://docs.gitlab.com/ci/ci_cd_for_external_repos/github_integration/).
7. GitLab, [Runners](https://docs.gitlab.com/ci/runners/).
8. GitLab, [CI/CD variables](https://docs.gitlab.com/ci/variables/).
9. GitLab, [Compute usage and cost](https://docs.gitlab.com/ci/pipelines/compute_minutes/).
10. Microsoft, [Build GitHub repositories](https://learn.microsoft.com/en-us/azure/devops/pipelines/repos/github?view=azure-devops).
11. Microsoft, [Azure Pipelines agents](https://learn.microsoft.com/en-us/azure/devops/pipelines/agents/agents?view=azure-devops).
12. Microsoft, [Microsoft-hosted agents](https://learn.microsoft.com/en-us/azure/devops/pipelines/agents/hosted?view=azure-devops).
13. Microsoft, [Pipeline caching](https://learn.microsoft.com/en-us/azure/devops/pipelines/release/caching?view=azure-devops).
14. Microsoft, [Azure Pipelines pricing](https://azure.microsoft.com/pricing/details/devops/azure-devops-services/).
15. Jenkins, [Pipeline as Code](https://www.jenkins.io/doc/book/pipeline/pipeline-as-code/).
16. Jenkins, [Using a Jenkinsfile](https://www.jenkins.io/doc/book/pipeline/jenkinsfile/).
17. Jenkins, [Credentials](https://www.jenkins.io/doc/book/security/credentials/).
18. Jenkins, [Securing SCM credentials for Organization Folders and Multibranch Pipelines](https://www.jenkins.io/doc/book/security/securing-org-folders-and-multibranch-pipelines/).
## Architecture owner approval

Approved on 2026-08-23.

The architecture owner approves GitHub Actions with an ephemeral
GitHub-hosted Linux runner as the initial MonPiole CI execution platform.

The approved CI baseline requires:

- pull-request validation;
- protected/default-branch validation;
- controlled manual execution;
- explicit least-privilege permissions;
- no secrets for architecture validation;
- ephemeral hosted execution;
- immutable pinning of reviewed action dependencies;
- frozen pnpm dependency installation;
- deterministic failure propagation;
- reuse of the existing repository architecture command.

The CI implementation must execute the existing local source-of-truth commands:

- corepack pnpm install --frozen-lockfile
- corepack pnpm architecture:check

TASK-006-08 is authorized to implement the minimal CI adapter for this baseline.

Before CI is made a required repository check, Platform Engineering must confirm
the applicable GitHub plan, billing ownership, expected usage, retention policy,
and cost monitoring.

Approval does not authorize deployment infrastructure, production credentials,
self-hosted runners, cloud federation, or unrelated CI/CD technologies.

Result: APPROVED.
