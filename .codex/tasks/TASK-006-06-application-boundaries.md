# TASK-006-06 â€” Application Boundaries

## Status

DONE

## ADR

ADR-0006 â€” Architecture applicative : Bounded Contexts, Services et FrontiÃ¨res

## Objective

Formaliser la frontiÃ¨re entre les applications et les Bounded Contexts.

## Applications

- admin
- api
- api-gateway
- mobile
- web

## Rules

Les applications :

- composent l'expÃ©rience utilisateur ou la couche edge ;
- consomment des APIs et packages stables ;
- ne possÃ¨dent pas la logique mÃ©tier interne des services ;
- ne doivent pas accÃ©der directement aux donnÃ©es mÃ©tier internes ;
- ne doivent pas dupliquer les rÃ¨gles mÃ©tier serveur.

`apps/api-gateway` reste une frontiÃ¨re de composition et ne prend pas de
dÃ©cisions mÃ©tier.

## Verification

Verified on 2026-08-10.

### Documentation checks

- All 5 applications are explicitly identified.
- Each application has a documented Purpose.
- Each application has an explicit Ownership.
- Application responsibilities are separated from Bounded Context responsibilities.
- Applications consume stable APIs and packages.
- Applications must not own internal service business logic.
- Applications must not directly access internal business data.
- Applications must not duplicate server-side business rules.
- `apps/api-gateway` is explicitly defined as a composition boundary.
- `apps/api-gateway` must not become the owner of service business rules.
- Tenant and correlation context propagation is documented where applicable.
- The application boundary is consistent with ADR-0005 and ADR-0006.

### Technical enforcement

PENDING.

The repository currently contains application documentation but no
implemented application source code or dependency graph sufficient to
mechanically verify the absence of duplicated business logic or direct
business-data access.

Future application-boundary checks must be implemented without selecting
technology outside the applicable ADRs.

Result: DOCUMENTATION PASS / TECHNICAL ENFORCEMENT PENDING.

## Acceptance Criteria

- [x] Les responsabilitÃ©s des applications sont documentÃ©es.
- [x] Les frontiÃ¨res avec les services sont documentÃ©es.
- [x] L'accÃ¨s direct aux donnÃ©es mÃ©tier est interdit.
- [x] La duplication des rÃ¨gles mÃ©tier est interdite.
- [x] Les exceptions sont documentÃ©es.

## Related

- ADR-0005
- ADR-0006
