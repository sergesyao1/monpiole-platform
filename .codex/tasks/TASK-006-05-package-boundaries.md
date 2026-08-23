# TASK-006-05 â€” Package Boundaries

## Status

DONE

## ADR

ADR-0006 â€” Architecture applicative : Bounded Contexts, Services et FrontiÃ¨res

## Objective

Formaliser les responsabilitÃ©s et frontiÃ¨res des packages partagÃ©s.

## Scope

Les packages concernÃ©s comprennent notamment :

- `packages/core`
- `packages/events`
- `packages/types`
- `packages/shared`
- `packages/testing`

## Rules

### packages/core

Expose des primitives architecturales stables et ne dÃ©pend pas des
applications, services ou adapters d'infrastructure.

### packages/events

Contient les contrats et Ã©lÃ©ments communs liÃ©s aux Ã©vÃ©nements.

### packages/types

Ne contient pas les modÃ¨les internes propres aux services.

### packages/shared

Contient uniquement du code rÃ©ellement transversal et faiblement couplÃ©.

### packages/testing

Contient les utilitaires de test gÃ©nÃ©riques et rÃ©utilisables.

## Verification

Verified on 2026-08-10.

### Documentation checks

- `packages/core` is documented as a stable architectural primitive layer.
- `packages/core` must not depend on applications, services, or infrastructure adapters.
- `packages/events` is documented as the shared event contract boundary.
- Event consumers retain ownership of their business behavior.
- `packages/types` is restricted to stable shared contract types.
- Service-internal business models must remain inside their Bounded Context.
- `packages/shared` is restricted to broadly reusable, dependency-light utilities.
- `packages/shared` must not contain service-specific business logic.
- `packages/testing` is documented as a generic testing utility boundary.
- `packages/testing` must remain independent from a specific application or service.
- `packages/sdk` is based on versioned contracts and semantic-version compatibility.
- Package responsibilities are documented consistently with ADR-0006.
- No package contains documented ownership of another service's internal domain model.
- No package technology or dependency-management strategy has been selected by this task.

### Technical enforcement

PENDING.

The repository currently contains package documentation but no implemented
package dependency graph or package manifests sufficient to mechanically
verify all dependency-boundary rules.

Future dependency checks must be selected and governed according to ADR-0002.

Result: DOCUMENTATION PASS / TECHNICAL ENFORCEMENT PENDING.

## Acceptance Criteria

- [x] Les responsabilitÃ©s de chaque package sont documentÃ©es.
- [x] Les modÃ¨les mÃ©tier internes ne sont pas placÃ©s dans `packages/types`.
- [x] `packages/shared` ne devient pas un dÃ©pÃ´t de logique mÃ©tier.
- [x] `packages/core` reste indÃ©pendant des services.
- [x] Les exceptions sont documentÃ©es.

## Related

- ADR-0005
- ADR-0006
