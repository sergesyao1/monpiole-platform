# apps/api

## Purpose

Public API edge application.

## Ownership

API Platform owns this area and approves changes affecting its responsibilities.

## Conventions

Version external contracts, propagate tenant and correlation context, and keep business logic in services or packages.

## Expected contents

API routing, authentication adapters, OpenAPI delivery assets, and edge tests.

## TD-005 executable baseline

This workspace is the reference NestJS composition root. NestJS dependencies,
decorators, and HTTP abstractions stay within this outer application boundary;
service-owned Domain and Application layers remain framework-independent.

TASK-015 initially exposed only the operational `GET /health` endpoint and did
not select the later TD-006 transport-contract baseline.

## TD-006 executable contract baseline

TASK-017 adds a deliberately non-business `POST /api/v1/contract-baseline`
fixture. Canonical Zod schemas live under `src/contracts`; NestJS wrappers,
validation, response serialization, request-context transport handling, and
RFC 9457 adaptation live under `src/http`; OpenAPI 3.1 assembly and
normalization live under `src/openapi`.

`engineering/contracts/http/openapi.json` is the single generated JSON review
artifact. Run `corepack pnpm app:api:openapi` to reproduce it and
`corepack pnpm app:api:contracts:check` to verify schema and OpenAPI behavior.
No Swagger UI route is exposed.

This technical fixture does not authenticate or authorize callers, implement
Tenant Onboarding, create tenant authority, persist idempotency state, or add
business behavior. Transport values are explicitly mapped to plain values;
Domain and Application layers remain independent of Zod and NestJS tooling.
