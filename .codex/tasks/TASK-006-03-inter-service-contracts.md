# TASK-006-03 â€” Inter-Service Contracts

## Status

DONE

## ADR

ADR-0006 â€” Architecture applicative : Bounded Contexts, Services et FrontiÃ¨res

## Objective

Formaliser les rÃ¨gles de communication entre Bounded Contexts.

## Scope

DÃ©finir les principes applicables aux :

- APIs ;
- Ã©vÃ©nements ;
- contrats de donnÃ©es ;
- versionnement ;
- idempotence ;
- tenant context ;
- correlation context.

## Rules

Les communications inter-services doivent utiliser des contrats explicites.

Les dÃ©tails internes d'un service ne constituent pas un contrat.

Les Ã©vÃ©nements doivent respecter ADR-0003.

Les contrats doivent Ãªtre versionnables et compatibles avec les contraintes
de migration dÃ©finies par les ADR applicables.

## Verification

Verified on 2026-08-10.

### Documentation checks

- Inter-service communication is explicitly defined as contract-driven.
- APIs and events are treated as explicit integration mechanisms.
- Internal service implementation details are not considered contracts.
- `packages/events` documents additive event versioning.
- `packages/events` requires tenant and correlation metadata.
- `packages/events` requires backward-compatible event schemas.
- `packages/sdk` is maintained from versioned contracts.
- Semantic-version compatibility is explicitly documented for SDK contracts.
- Idempotent communication or event handling is documented where relevant.
- Tenant context is explicitly addressed.
- Correlation context is explicitly addressed.

### Technical implementation

PENDING.

The repository currently contains no implemented APIs, event schemas,
SDK implementation, or contract test suite under the relevant application
and service areas. Therefore contract compatibility and runtime contract
compliance cannot yet be mechanically verified.

Result: DOCUMENTATION PASS / TECHNICAL IMPLEMENTATION PENDING.

## Acceptance Criteria

- [x] Les communications inter-services sont explicitement dÃ©finies comme contractuelles.
- [x] Les APIs et Ã©vÃ©nements sont distinguÃ©s des modÃ¨les internes.
- [x] Les rÃ¨gles de versionnement sont documentÃ©es.
- [x] Les rÃ¨gles d'idempotence sont documentÃ©es lorsque nÃ©cessaires.
- [x] Le contexte tenant et correlation est pris en compte.
- [x] Les exceptions sont documentÃ©es.

## Constraints

Ne sÃ©lectionner aucune technologie d'API ou d'eventing dans cette tÃ¢che.

## Related

- ADR-0003
- ADR-0004
- ADR-0006
