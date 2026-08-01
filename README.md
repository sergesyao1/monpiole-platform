# MonPiole Platform

MonPiole Platform is the enterprise foundation for a modular, API-first, multi-tenant SaaS platform. This repository is a scalable monorepo for applications, bounded contexts, shared contracts, and infrastructure.

Sprint 0 establishes the repository foundation only. It contains no business features or domain workflows.

## Vision

Provide a dependable platform where teams can deliver tenant-aware capabilities without compromising domain boundaries, security, operability, or delivery speed.

## Objectives

- Maintain clear ownership boundaries for applications, packages, services, and infrastructure.
- Treat APIs and events as versioned integration contracts.
- Support incremental, tenant-aware delivery without shared service databases.
- Make architecture, security, operational guidance, and decisions discoverable in version control.

## Architecture overview

Applications compose client and transport concerns. Services represent independently owned bounded contexts and own their data. Shared packages contain domain-neutral capabilities. Services integrate through versioned APIs and events; direct cross-service database access is prohibited.

Clean Architecture dependency direction is mandatory: adapters depend on application and domain layers, never the reverse. Tenant and correlation context remain explicit at API, command, event, persistence, and audit boundaries.

## Technology stack

No runtime, framework, package manager, or cloud provider has been selected. This foundation deliberately keeps these choices open until they are recorded in Architecture Decision Records. The repository reserves operational areas for PostgreSQL, Redis, MinIO, Docker, Kubernetes, Terraform, Nginx, and monitoring; this does not represent deployed infrastructure.

## Monorepo structure

    apps/            Deployable API, web, mobile, and administration applications
    packages/        Shared libraries, contracts, design assets, and test utilities
    services/        Independently deployable bounded contexts
    infrastructure/  Runtime, storage, ingress, provisioning, and observability assets
    engineering/     ADRs, architecture, DDD, security, standards, and runbooks
    docs/            Published API, architecture, product, security, and operations documentation
    tests/           Unit, integration, contract, E2E, and performance test assets
    scripts/         Developer, CI, database, deployment, and maintenance automation
    tools/           Internal generators, migration helpers, quality, and local-development tools
    .codex/          Repository task, sprint, prompt, playbook, and checklist records

## Development workflow

1. Read [AGENTS.md](AGENTS.md), local guidance, and applicable engineering documentation.
2. Inspect existing decisions before designing a change; document durable decisions in [engineering/adr/](engineering/adr/).
3. Keep changes focused on the owning application, service, package, or infrastructure area.
4. Add appropriate verification and update contracts, documentation, and runbooks with the change.
5. Review the Git diff for scope, secrets, and unintended files before requesting review.

## Local setup

There is no runnable application in Sprint 0. Prepare a local copy with:

    git clone https://github.com/sergesyao1/monpiole-platform.git
    cd monpiole-platform
    cp .env.example .env
    make help

On PowerShell, use `Copy-Item .env.example .env`. The .env file is local-only and must never be committed.

## Docker usage

Docker is not configured in Sprint 0: no Dockerfile or Compose definition exists yet. [infrastructure/docker/](infrastructure/docker/) is reserved for reproducible container builds and local runtime assets after the runtime decision is approved.

## Sprint workflow

Sprint goals are captured in [.codex/CURRENT_SPRINT.md](.codex/CURRENT_SPRINT.md). Scoped work is recorded in [.codex/tasks/](.codex/tasks/). Each task defines its objective, constraints, acceptance criteria, verification, risks, and next action. Delivery proceeds through small reviewable pull requests with documented decisions and verification evidence.

## Documentation structure

| Area | Responsibility |
| --- | --- |
| [engineering/](engineering/) | Internal architecture, DDD, security, ADRs, standards, and runbooks |
| [docs/api/](docs/api/) | API references, examples, versioning, and lifecycle guidance |
| [docs/architecture/](docs/architecture/) | System boundaries and integration narratives |
| [docs/guides/](docs/guides/) | Contributor and integration guides |
| [docs/operations/](docs/operations/) | Deployment, recovery, support, and maintenance guidance |
| [docs/security/](docs/security/) | Stakeholder-facing security information |
| [docs/product/](docs/product/) | Approved product documentation |

## Engineering standards

Standards are maintained in [engineering/standards/](engineering/standards/). Contributions must preserve DDD boundaries, Clean Architecture dependencies, API and event compatibility, tenant isolation, input validation, authorisation, idempotent asynchronous processing, deterministic tests, and documented operational impact.

## Contribution workflow

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [AGENTS.md](AGENTS.md) before contributing. Use a focused pull request that states scope, architecture impact, tenant and security implications, verification performed, and follow-up work. Changes affecting contracts, security controls, or infrastructure require relevant owner review.

## Repository roadmap

The high-level sequence is maintained in [ROADMAP.md](ROADMAP.md):

1. Establish tooling, CI, standards, and local development infrastructure.
2. Decide and record the runtime, monorepo tooling, API contract, event contract, and tenancy model.
3. Bootstrap platform capabilities such as identity, tenant management, observability, and deployment controls.
4. Introduce product bounded contexts through documented, independently testable increments.

## Governance

- [Architecture decisions](engineering/adr/)
- [Engineering standards](engineering/standards/)
- [Security policy](SECURITY.md)
- [Contribution guide](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [License](LICENSE)