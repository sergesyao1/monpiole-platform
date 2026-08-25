# TASK-022 — TD-009 CI Execution Baseline Implementation

## Status

DONE

## Objective

Implement the approved TD-009 GitHub Actions validation baseline as a thin
adapter over existing repository-owned commands. This task does not reopen the
technology decision, configure repository rulesets, or introduce deployment/CD.

Baseline commit: `3c7ccfc docs(ci): approve TD-009 CI execution baseline`.

## Implemented scope

- Expand the historical architecture-only workflow into the TD-009 graph while
  retaining architecture enforcement exactly once.
- Run seven independent validation jobs on `ubuntu-24.04`, followed by the
  stable `CI / required` aggregate result.
- Pin Node 24.18.0 and assert Corepack resolves repository pnpm 11.22.0.
- Perform a frozen install in every validation job.
- Cache only the pnpm content-addressed store with an exact OS, architecture,
  Node, pnpm and lockfile key; caching remains optional to correctness.
- Keep PostgreSQL provisioning in the existing Testcontainers suite using the
  repository-pinned immutable image digest.
- Preserve least-privilege, untrusted-PR, timeout and concurrency constraints.

## CI graph and governed commands

| Job | Commands |
| --- | --- |
| `static/type` | `corepack pnpm typecheck:tests` |
| `architecture` | `corepack pnpm architecture:check` |
| `unit` | `corepack pnpm test:unit` |
| `integration/contract` | `corepack pnpm test:integration`; `corepack pnpm test:contract` |
| `api` | `corepack pnpm app:api:typecheck`; `corepack pnpm app:api:build` |
| `events` | `corepack pnpm package:events:typecheck`; `corepack pnpm package:events:build` |
| `persistence/PostgreSQL` | persistence typecheck, build, migration check and Testcontainers integration test |
| `required` | fails unless every preceding job result is `success` |

Each validation job first runs
`corepack pnpm install --frozen-lockfile` in its own ephemeral VM.

## Duplicate-execution proof

`corepack pnpm test` maps to unfiltered `vitest run`. The committed Vitest
configuration contains exactly the `unit`, `integration`, `contract`, and
`persistence-integration` projects. The four explicit CI test commands select
each project exactly once. Therefore the aggregate command is equivalent in
project coverage and is omitted to prevent duplicate execution. API and event
package contract aliases are also omitted because the root contract project
already discovers both suites.

The TASK-006-08 workflow path is retained and its content superseded rather than
running a second workflow. Its frozen-install and `architecture:check` behavior
is preserved, so architecture validation has one execution position.

## PostgreSQL and security position

The persistence job reports Docker client/server versions, then runs the
repository Testcontainers command. Testcontainers alone starts the digest-pinned
PostgreSQL image, maps a random port, waits for readiness and cleans it up. The
test asserts PostgreSQL 18.6 and real transaction, migration, role and RLS
semantics. Container failure fails the job; no substitute or service container
is configured.

Workflow permissions default to none. Checkout jobs receive only
`contents: read`, and checkout does not persist credentials. All external
actions use reviewed full commit SHAs. No secrets, OIDC, write/deployment
permissions, production data, artifacts, privileged containers or production
network access are configured.

## Evidence rechecked on 2026-08-25

- repository branch/HEAD and clean pre-implementation worktree;
- root and package scripts, Vitest projects, persistence image digest and
  historical workflow;
- official tag refs: `actions/checkout@v7`
  `3d3c42e5aac5ba805825da76410c181273ba90b1`, `actions/setup-node@v7`
  `820762786026740c76f36085b0efc47a31fe5020`, and `actions/cache@v5`
  `caa296126883cff596d87d8935842f9db880ef25`.

Repository visibility, plan and billing entitlement are not encoded in the
repository and remain an owner confirmation before relying on hosted execution.

## Required validation

Run every governed command listed in TD-009, followed by `git diff --check`,
diff review, `git diff --stat`, and `git status --short`. Hosted positive,
intentional-negative, fork, cancellation and ruleset verification require a
GitHub run after owner review; local execution cannot prove provider behavior.

## Completion criteria

Mark DONE only after all required local gates pass, the diff is reviewed, and
remaining hosted/owner actions are explicitly recorded. Do not commit.

## Completion evidence

All required local gates passed on 2026-08-25:

- frozen install with pnpm 11.22.0;
- test TypeScript and architecture validation;
- 7 unit, 8 integration, 41 contract and 7 PostgreSQL persistence tests;
- API, events and persistence typechecks/builds;
- deterministic migration check;
- PostgreSQL 18.6 through the pinned image digest on Docker Linux/amd64;
- final whitespace and Git diff review.

The first sandboxed architecture/Vitest attempts were blocked by Windows process
creation policy and were rerun successfully outside the sandbox. The first
persistence attempt correctly failed because the Docker daemon was stopped; it
passed unchanged after Docker Desktop started. No test was weakened or skipped.

No branch protection/ruleset was configured and no commit was created. The
repository owner must review the workflow, run hosted positive/negative/fork and
cancellation acceptance checks, confirm plan/billing, then separately configure
`CI / required` as the required main-branch result.
