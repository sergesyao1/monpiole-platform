# TASK-015 — TD-005 Application Framework Baseline Implementation

## Status

DONE

## Objective

Implement the smallest executable NestJS baseline proving that the TD-005
application/composition framework operates with MonPiole's pnpm, native ESM,
strict TypeScript, Node 24+, Vitest, and Clean Architecture baselines.

## Governing decisions

- ADR-0001 through ADR-0006.
- Approved TD-001 through TD-005.
- TD-004 testing baseline implemented by TASK-014.
- TD-005 approval of NestJS as an outer application/composition framework.

## Architectural constraints

- NestJS belongs only to the composition and external interface boundary.
- Domain must not import NestJS, HTTP, persistence, messaging, telemetry, or
  configuration framework implementations.
- Application use cases and ports remain explicit and framework-independent.
- Bounded-context ownership remains under `services/`.
- The health endpoint contains no business behavior and requires no tenant or
  correlation context because it is an operational liveness probe with no
  data access, authorization decision, or side effect.

## Implementation scope

- Add real `apps/*`, `services/*`, and `packages/*` workspace discovery while
  preserving architecture resolver fixtures.
- Exact-pin the minimum NestJS packages and their required runtime peers.
- Establish `apps/api` as a private native-ESM NestJS composition root.
- Expose `GET /health` returning `{ "status": "ok" }`.
- Add root build, start, and typecheck commands for the API.
- Add a Vitest integration test that bootstraps the real application module,
  binds an ephemeral loopback port, and exercises the HTTP endpoint.
- Record TD-005 in the tooling registry.

## Non-goals

- Business entities, use cases, or bounded-context behavior.
- Persistence, ORM, database, migrations, broker, events, queues, or jobs.
- Authentication, authorization, tenant resolution, or correlation plumbing.
- Runtime validation/schema technology, OpenAPI, telemetry, or configuration
  framework selection.
- Fastify or other HTTP adapter selection and performance claims.
- Deployment, container, orchestration, or cloud infrastructure.

## Acceptance criteria

- [x] The actual MonPiole application, service, and package roots are pnpm workspaces.
- [x] NestJS and required peers are exact-pinned at reviewed compatible versions.
- [x] `apps/api` builds and starts as strict TypeScript compiled to native ESM.
- [x] `GET /health` returns HTTP 200 and `{ "status": "ok" }`.
- [x] Vitest proves real NestJS bootstrap and HTTP handling without Jest.
- [x] NestJS imports remain outside Domain and Application layers.
- [x] Existing TD-004 tests and architecture controls still pass.
- [x] Documentation and lockfile accurately record the verified baseline.

## Verification commands

- `node --version`
- `corepack pnpm --version`
- `corepack pnpm install`
- `corepack pnpm app:api:typecheck`
- `corepack pnpm app:api:build`
- `corepack pnpm typecheck:tests`
- `corepack pnpm test`
- `corepack pnpm architecture:check`
- `git diff --check`
- `git status --short`

## Evidence

Completed on 2026-08-25 against Node.js `v24.18.0`, pnpm `11.22.0`,
TypeScript `6.0.3`, and Vitest `4.1.11`.

Exact direct additions:

- `@nestjs/common@11.2.2`;
- `@nestjs/core@11.2.2`;
- `@nestjs/platform-express@11.2.2`;
- `reflect-metadata@0.2.2`;
- `rxjs@7.8.2`;
- development typing dependency `@types/node@26.3.0`.

Verification passed:

- mutable installation regenerated the lockfile, then frozen installation
  confirmed all four workspace projects were already up to date;
- API strict typecheck passed;
- API native-ESM build passed;
- test/configuration TypeScript check passed;
- integration project: 2 files and 2 tests passed, including real NestJS
  bootstrap and `GET /health` over an ephemeral loopback port;
- aggregate Vitest suite: 4 files and 6 tests passed;
- architecture verification passed workspace, exports, resolver, graph,
  boundaries, cycles, and diagnostic controls;
- repository search found NestJS imports only in `apps/api/src`.

The initial sandboxed install and checks could not access Corepack's registry
or local store metadata. The unchanged commands passed with the required
environment permissions. No architecture rule was weakened or changed.
