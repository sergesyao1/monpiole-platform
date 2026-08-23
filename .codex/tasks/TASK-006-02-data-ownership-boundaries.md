# TASK-006-02 â€” Data Ownership & Boundaries

## Status

DONE

## ADR

ADR-0006 â€” Architecture applicative : Bounded Contexts, Services et FrontiÃ¨res

## Objective

Formaliser la propriÃ©tÃ© des donnÃ©es par Bounded Context et interdire les
accÃ¨s directs aux donnÃ©es internes d'un autre service.

## Scope

- Identifier les donnÃ©es appartenant Ã  chaque Bounded Context.
- Documenter les frontiÃ¨res de donnÃ©es.
- DÃ©finir les rÃ¨gles d'accÃ¨s inter-services.
- Interdire le partage direct des bases ou structures internes.
- Identifier les mÃ©canismes contractuels nÃ©cessaires pour accÃ©der Ã  des
  donnÃ©es appartenant Ã  un autre contexte.

## Rules

Un service est propriÃ©taire de ses donnÃ©es.

Un service ne doit pas :

- accÃ©der directement aux tables d'un autre service ;
- modifier directement les donnÃ©es d'un autre service ;
- partager son modÃ¨le de persistance interne comme contrat ;
- dÃ©pendre du schÃ©ma interne d'un autre service.

Les Ã©changes doivent utiliser des contrats explicites.

## Verification

Verified on 2026-08-10.

### Documentation checks

- All 7 Bounded Contexts document their Data Ownership.
- All 7 Bounded Contexts document their Boundaries.
- Direct modification of another service's business data is explicitly prohibited.
- Direct access to another service's operational data is explicitly prohibited.
- Internal persistence structures are explicitly excluded from inter-service contracts.
- Explicit APIs and events are identified as the communication mechanisms.
- No persistence technology has been selected or introduced.

### Verification Result

DOCUMENTATION PASS / TECHNICAL ENFORCEMENT PENDING.

The documentation requirements are verified across all 7 Bounded Contexts.
Technical enforcement remains pending until application and persistence
implementation exists.
### Technical enforcement

PENDING.

The repository currently contains no application implementation,
persistence implementation, or dependency configuration under `services/`,
so direct database access and cross-service persistence violations cannot
yet be mechanically verified.

Result: DOCUMENTATION PASS / TECHNICAL ENFORCEMENT PENDING.

## Acceptance Criteria

- [x] Les frontiÃ¨res de donnÃ©es sont documentÃ©es.
- [x] Chaque Bounded Context possÃ¨de une responsabilitÃ© sur ses donnÃ©es.
- [x] Les accÃ¨s directs inter-services sont explicitement interdits.
- [x] Les modÃ¨les internes de persistance ne sont pas considÃ©rÃ©s comme contrats.
- [x] Les exceptions Ã©ventuelles sont documentÃ©es.

## Constraints

Aucune technologie de persistance n'est sÃ©lectionnÃ©e dans cette tÃ¢che.

## Related

- ADR-0003
- ADR-0004
- ADR-0005
- ADR-0006
