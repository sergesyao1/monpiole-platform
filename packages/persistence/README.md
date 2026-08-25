# `@monpiole/persistence`

Infrastructure-only PostgreSQL 18 baseline approved by TD-008. It provides
validated connection configuration, bounded `pg.Pool` lifecycle, Drizzle-backed
transaction scopes, and transaction-local tenant context. Domain and Application
code must not import this package or its database technologies.

## Structure

```text
src/
  configuration.ts       environment-to-pool configuration
  pool.ts                pool readiness and lifecycle
  transaction.ts         READ COMMITTED callback transactions and SET LOCAL context
  verification-schema.ts synthetic TD-008 schema declaration only
migrations/              generated/reviewed synthetic verification SQL and metadata
tests/                   real PostgreSQL 18 Testcontainers proofs
drizzle.config.ts        deterministic migration-generation configuration
```

The verification table is not a product model, repository, or shared business
table. Product schemas, mappings, repositories and migrations remain owned by
their bounded contexts and require separate approved tasks.

## Commands

- `corepack pnpm package:persistence:typecheck`
- `corepack pnpm package:persistence:build`
- `corepack pnpm package:persistence:migration:check`
- `corepack pnpm package:persistence:test:integration`

`migration:generate` uses Drizzle Kit and creates reviewable SQL; `drizzle-kit
push` is intentionally absent. Tests fail when Docker/PostgreSQL is unavailable
and never substitute an in-memory database. The pinned test image is
`postgres@sha256:1957b2ff3137e4ef7f3bc813e74fff50b1e1ffddc85c8b9d6f14ade972be8687`
(PostgreSQL 18.6, Debian 13, linux/amd64).

Production credentials, pool budgets, deployment, backups, restore and runtime
composition are outside TASK-020. TLS is mandatory except when an isolated test
explicitly selects `NODE_ENV=test` and `DATABASE_TLS=disabled`.
