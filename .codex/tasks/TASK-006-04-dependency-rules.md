# TASK-006-04 â€” Dependency Rules

## Status

DONE

## ADR

ADR-0006 â€” Architecture applicative : Bounded Contexts, Services et FrontiÃ¨res

## Objective

Formaliser la direction des dÃ©pendances autorisÃ©es et interdites.

## Allowed Direction

La direction architecturale cible est :

apps
  -> services
  -> packages

avec les dÃ©pendances transverses autorisÃ©es uniquement lorsqu'elles
respectent les responsabilitÃ©s dÃ©finies par ADR-0006.

## Forbidden Dependencies

Les rÃ¨gles suivantes doivent Ãªtre interdites :

- service A -> donnÃ©es internes de service B ;
- `packages/core` -> service ;
- `packages/core` -> infrastructure adapter ;
- application -> base de donnÃ©es mÃ©tier interne ;
- partage de modÃ¨les mÃ©tier internes entre services ;
- dÃ©pendances circulaires entre Bounded Contexts ;
- dÃ©placement de logique mÃ©tier de service vers application ;
- utilisation abusive de `packages/shared`.

## Verification

Verified on 2026-08-10.

### Documentation checks

- The target dependency direction is explicitly documented.
- `apps` may consume services through explicit interfaces and stable packages.
- Services own their domain model and data.
- Packages remain reusable and domain-neutral according to their defined responsibility.
- Direct access from one service to another service's internal data is prohibited.
- Service-to-service internal implementation dependencies are prohibited.
- `packages/core` must not depend on services.
- `packages/core` must not depend on infrastructure adapters.
- Domain code must not depend on infrastructure details.
- Domain code must not depend directly on framework or technical adapters.
- Applications must not own business persistence belonging to services.
- Sharing internal business models between services is prohibited.
- Circular dependencies between Bounded Contexts are prohibited.
- Business logic must not be moved from services into applications.
- `packages/shared` must not become a container for service-specific business logic.
- The rules are consistent with ADR-0002 and ADR-0005.
- No dependency-analysis technology has been selected.

### Technical enforcement

PENDING.

The repository currently contains documentation-only service and package
boundaries without implemented application dependency graphs or runtime
code. Therefore dependency violations cannot yet be mechanically detected.

Future automation must be selected and governed according to ADR-0002.

Result: DOCUMENTATION PASS / AUTOMATION PENDING.

## Acceptance Criteria

- [x] Les dÃ©pendances autorisÃ©es sont documentÃ©es.
- [x] Les dÃ©pendances interdites sont documentÃ©es.
- [x] La direction des dÃ©pendances est explicite.
- [x] Les dÃ©pendances circulaires sont considÃ©rÃ©es comme interdites.
- [x] Les rÃ¨gles peuvent ultÃ©rieurement Ãªtre automatisÃ©es.
- [x] Les exceptions sont documentÃ©es.

## Constraints

Aucun outil d'analyse de dÃ©pendances n'est sÃ©lectionnÃ© dans cette tÃ¢che.

Toute sÃ©lection d'outil devra respecter ADR-0002.

## Related

- ADR-0002
- ADR-0005
- ADR-0006
