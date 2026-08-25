# TASK-025 — Tenant Onboarding Vertical Slice — Activate Tenant Administrator

## Status

DONE

## Scope

- Activate an existing bootstrapped tenant administrator.
- Extend Identity status with `ACTIVE` only.
- Preserve tenant isolation and not-found semantics.
- Reuse the TASK-024 in-memory Identity and membership data set.
- Expose `POST /v1/tenants/{tenantId}/administrators/{administratorId}/activate`.
- Preserve correlation/request context, Problem Details, OpenAPI, and architecture baselines.

## Acceptance criteria

- `Identity.activate()` performs `PENDING_ACTIVATION -> ACTIVE` and is idempotent for `ACTIVE`.
- Membership and identity must resolve within the requested tenant.
- Unknown or cross-tenant administrators return not-found semantics.
- The shared store reflects `ACTIVE` after successful activation.
- HTTP returns `200`, with `400` for invalid paths and `404` for unresolved administrators.
- TASK-023 and TASK-024 remain green.

## Architecture constraints

- Domain and Application remain independent of NestJS, HTTP, and infrastructure.
- Infrastructure implements activation ports using the existing in-memory data set.
- HTTP composition remains in `apps/api`.
- No database, broker, credentials, or speculative identity states are added.

## Tests and evidence

- Targeted Domain/Application activation tests: 5 passed.
- Targeted HTTP activation tests: 6 passed.
- Targeted API/OpenAPI contract tests: 16 passed.
- Unit project: 27 passed.
- Integration project: 29 passed.
- Contract project: 50 passed.
- Complete repository graph: 20 files and 120 tests passed.
- Identity typecheck/build, API typecheck/build/OpenAPI, test typecheck, and
  architecture verification passed.
- `git diff --check` passed before completion review.

## Completion gate

Set `DONE` only after all targeted and repository quality gates pass.
