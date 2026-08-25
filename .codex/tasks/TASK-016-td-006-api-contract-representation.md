# TASK-016 — TD-006 API Contract Representation Decision

## Status

DONE

## Objective

Evaluate and approve the concrete technology and conventions for MonPiole HTTP
API representation, runtime validation, serialization, OpenAPI publication,
errors, explicit request context, idempotency, and compatibility verification
without implementing an API or changing runtime dependencies.

## Governing decisions and evidence

- ADR-0002 through ADR-0006.
- Approved and implemented TD-001 through TD-005 baselines.
- Approved Tenant Onboarding product contract.
- Backend API as the first implementation surface.
- Architecture approval recorded on 2026-08-25.

## Completed scope

- Evaluated NestJS DTO classes with `class-validator`/`class-transformer`, Zod,
  TypeBox/Ajv, OpenAPI-first generation, and materially relevant alternatives.
- Compared NestJS integration, type safety, runtime validation, OpenAPI
  fidelity/drift, DTO/Domain separation, testability, compatibility,
  maintenance, dependency footprint, ESM/Node compatibility, Clean
  Architecture, and multi-tenant implications.
- Approved Zod 4 as the canonical executable transport-contract schema.
- Approved `nestjs-zod` only at the NestJS interface/composition boundary and
  `@nestjs/swagger` for OpenAPI 3.1 assembly/publication.
- Approved RFC 9457 errors, URI major versioning, tenant/pre-tenant authority,
  correlation/request IDs, authentication/authorization adapter boundaries,
  idempotency representation, and Vitest contract verification conventions.
- Updated the governed technology-decision inventory.

## Constraints preserved

- No dependency was installed and no manifest or lockfile was changed.
- No runtime source, controller, DTO, schema, or OpenAPI generator was created.
- Domain and Application remain independent from transport/framework tooling.
- Persistence, messaging, authentication-provider, telemetry, and deployment
  technologies remain deferred.
- TD-007 was not started.

## Deliverables

- `engineering/decisions/td-006-api-contract-representation-proposal.md`
- `engineering/decisions/technology-decision-inventory.md`
- `.codex/tasks/TASK-016-td-006-api-contract-representation.md`

## Verification

- `git diff --check` passed with exit code 0.
- `git diff --stat` passed and reported only the tracked inventory change;
  the two new untracked documents were reviewed separately with
  `git diff --no-index`.
- `git status --short` reported one modified governance document and two new
  governance documents only.
- The complete tracked and untracked diff was reviewed.

## Outcome

TD-006 is **APPROVED — NOT IMPLEMENTED**. A separate governed implementation
task must revalidate exact dependency compatibility, supply chain, licenses,
provenance, and lockfile impact before installing or implementing anything.
