# scripts/ci

## Purpose

Continuous-integration helpers.

## Ownership

Platform Engineering owns this area and approves changes affecting its responsibilities.

## Conventions

Keep commands non-interactive and deterministic, with clear exit codes.

## Expected contents

Validation, build, test, and release-support scripts.

## GitHub Actions baseline

`.github/workflows/architecture-checks.yml` is the thin GitHub Actions adapter
approved by TD-009. The historical path is retained, while its architecture-only
content is superseded by the complete CI graph. Seven independent validation
jobs run repository-owned commands, and the stable `CI / required` job succeeds
only when every validation job succeeds.

Every validation job uses Ubuntu 24.04, Node 24.18.0, Corepack-resolved pnpm
11.22.0, an exact-key cache of pnpm's content-addressed store, and
`corepack pnpm install --frozen-lockfile`. The cache never contains
`node_modules` or build output and never replaces the frozen installation.
The architecture command is preserved in the single `architecture` job.

## Test execution equivalence

The root `corepack pnpm test` command invokes `vitest run`. `vitest.config.ts`
defines exactly four projects: `unit`, `integration`, `contract`, and
`persistence-integration`. CI invokes those same projects once through:

- `corepack pnpm test:unit`;
- `corepack pnpm test:integration`;
- `corepack pnpm test:contract`;
- `corepack pnpm package:persistence:test:integration`.

Consequently, CI omits the aggregate convenience command and the package-specific
API/event contract aliases: their projects are already covered by
`test:contract`. No governed test project is omitted or repeated.

## PostgreSQL execution

The persistence job uses the standard runner Docker Engine and lets the existing
Testcontainers suite exclusively provision PostgreSQL. The repository test pins
PostgreSQL by digest and asserts PostgreSQL 18.6. No service container, SQLite,
mock database, production credential, or production network is configured.
