# ADR-005 — Architecture Applicative, Clean Architecture & Domain-Driven Design

## Status

Accepted

## Date

2026-08-09

## Decision Type

Architecture

## Context

Mon Piole est conçu comme une plateforme applicative modulaire et multi-tenant.

Les ADR-0001 à ADR-0004 ont établi les fondations suivantes :

- monorepo et frontières de composants explicites ;
- contrôle des décisions technologiques structurantes ;
- contrats API et événements versionnés ;
- contexte tenant explicite et propagé de manière contrôlée.

Ces décisions nécessitent une architecture applicative permettant de préserver
l'indépendance du domaine métier vis-à-vis des frameworks, infrastructures et
interfaces externes.

## Problem Statement

Sans règles explicites concernant la structure applicative et les dépendances,
le monorepo risque de devenir fortement couplé.

Les principaux risques sont :

- logique métier dépendante de frameworks ;
- accès aux bases de données depuis le domaine ;
- dépendance du domaine aux APIs HTTP ;
- dépendance directe à des implémentations techniques ;
- duplication des règles métier ;
- difficulté à tester les composants indépendamment ;
- propagation incontrôlée du contexte tenant ;
- dépendances circulaires ;
- difficulté à remplacer une technologie d'infrastructure.

## Decision

Mon Piole adopte une architecture applicative basée sur les principes de
Clean Architecture et Domain-Driven Design (DDD).

Les responsabilités sont séparées en couches logiques :

```text
Interfaces
    |
    v
Application
    |
    v
Domain
    ^
    |
Infrastructure
@'

## Layer Responsibilities

### Domain

Le Domain contient notamment :

- Entities ;
- Value Objects ;
- Aggregates ;
- Domain Services ;
- Domain Policies ;
- Domain Events ;
- invariants métier.

Le Domain ne contient pas :

- contrôleurs HTTP ;
- ORM ;
- drivers de base de données ;
- appels réseau ;
- configuration d'infrastructure ;
- dépendances directes à un fournisseur cloud.

### Application

L'Application contient notamment :

- Use Cases ;
- Commands ;
- Queries ;
- orchestration métier ;
- ports ;
- coordination des services du domaine.

L'Application ne doit pas dépendre directement des implémentations
d'infrastructure concrètes lorsque l'abstraction est nécessaire.

### Infrastructure

L'Infrastructure fournit les implémentations techniques :

- persistence ;
- repositories ;
- messaging ;
- clients externes ;
- stockage ;
- intégrations techniques ;
- adapters techniques.

### Interfaces

Les Interfaces exposent les fonctionnalités :

- API HTTP ;
- consumers d'événements ;
- CLI ;
- adapters d'entrée ;
- interfaces externes.

Les interfaces ne doivent pas contenir les règles métier principales.

## Bounded Contexts

Les bounded contexts constituent les principales frontières du modèle métier.

Chaque bounded context doit :

- posséder son propre modèle métier ;
- contrôler ses invariants ;
- définir ses interfaces publiques ;
- éviter les dépendances directes vers les détails internes d'un autre contexte ;
- communiquer avec les autres contextes par des contrats explicites.

Un bounded context ne devient pas automatiquement un microservice.

La distribution physique fera l'objet d'une décision spécifique lorsque
cela sera nécessaire.

## Dependency Rules

Les dépendances attendues sont :

```text
Interface
    |
    v
Application
    |
    v
Domain

Infrastructure
    |
    +-- implements application/domain abstractions

## Technical Requirements

L'implémentation doit permettre :

1. l'identification claire des bounded contexts ;
2. l'isolation du domaine métier ;
3. des use cases explicites ;
4. l'utilisation de ports et adapters lorsque nécessaire ;
5. la séparation des contrats et des implémentations ;
6. la vérification automatisée des dépendances ;
7. les tests unitaires indépendants de l'infrastructure ;
8. l'intégration du tenant context conformément à ADR-0004 ;
9. l'intégration des contrats API et événements conformément à ADR-0003.

## Components Impacted

Cette décision impacte principalement :

- applications backend ;
- services métier ;
- packages partagés ;
- API ;
- consumers d'événements ;
- repositories ;
- adapters ;
- tests ;
- documentation DDD ;
- diagrammes d'architecture.

Les choix technologiques structurants restent soumis à ADR-0002.

### Shared Packages

Les packages situés sous `packages/` doivent rester domain-neutral.

Ils peuvent contenir des primitives techniques ou transversales, des contrats,
des types génériques, des utilitaires ou des composants réutilisables.

Ils ne doivent pas contenir les règles métier propriétaires d'un bounded context.

Un besoin partagé entre plusieurs bounded contexts ne doit pas automatiquement
conduire à la création d'un domaine partagé.

Toute exception nécessite une décision architecturale explicite.

## Implementation Requirements

L'implémentation devra fournir :

- une séparation explicite des responsabilités ;
- des modules de domaine indépendants ;
- des use cases explicites ;
- des ports pour les dépendances externes lorsque nécessaire ;
- des adapters d'infrastructure ;
- des adapters d'entrée ;
- des tests unitaires du domaine ;
- des tests d'intégration des adapters ;
- des contrôles empêchant les dépendances interdites.

Les règles d'architecture doivent être vérifiables automatiquement lorsque
cela est techniquement possible.

## Security Considerations

La séparation architecturale doit contribuer à éviter :

- les accès directs non contrôlés aux données ;
- le contournement des règles d'autorisation ;
- la propagation implicite du tenant ;
- l'exposition de détails d'infrastructure ;
- les accès privilégiés non audités.

L'autorisation doit être vérifiée avant les opérations produisant des effets
de bord.

Les secrets et credentials ne doivent jamais être placés dans les modules
du domaine ou versionnés dans le repository.

## Operational Considerations

L'architecture doit permettre l'évolution des composants techniques sans
réécriture des règles métier.

Les mécanismes de logging, métriques, tracing et configuration doivent rester
séparés des règles métier.

Les décisions opérationnelles détaillées seront couvertes par les ADR
correspondantes.

## Testing & Verification

### Unit Tests

Les règles métier doivent être testables sans infrastructure externe.

### Integration Tests

Les adapters doivent être testés avec leurs dépendances techniques.

### Architecture Tests

Des contrôles doivent vérifier notamment :

- Domain ne dépend pas d'Infrastructure ;
- Domain ne dépend pas d'un framework HTTP ;
- Domain ne dépend pas d'un driver de base de données ;
- absence de dépendances circulaires ;
- dépendances inter-contextes contrôlées.

### Contract Tests

Les interfaces API et événements doivent respecter ADR-0003.

### Tenant Tests

Les use cases concernés doivent respecter le contexte tenant défini
par ADR-0004.

## Consequences

### Positive

- meilleure séparation des responsabilités ;
- domaine métier plus testable ;
- réduction du couplage technologique ;
- meilleure évolutivité ;
- remplacement facilité des infrastructures ;
- meilleure maîtrise des bounded contexts ;
- réduction des dépendances circulaires ;
- architecture plus facilement auditable.

### Negative

- coût initial de conception supérieur ;
- nombre de modules et abstractions potentiellement supérieur ;
- nécessité de maintenir les frontières ;
- risque de sur-abstraction.

### Risks

L'équipe doit éviter :

- l'application mécanique de Clean Architecture sans valeur métier ;
- la multiplication inutile des couches ;
- les abstractions prématurées ;
- les packages partagés contenant des règles métier spécifiques ;
- les dépendances cachées entre bounded contexts.

## Alternatives Considered

### Monolithic Layered Architecture

Rejetée comme architecture principale car elle fournit moins de garanties
sur l'isolation du domaine et les frontières des contextes.

### Framework-Centric Architecture

Rejetée car elle rendrait le domaine fortement dépendant des technologies
d'implémentation.

### Microservices-First Architecture

Non retenue comme principe architectural.

Les bounded contexts peuvent rester regroupés physiquement lorsque cela
est pertinent.

La distribution physique fera l'objet d'une décision dédiée lorsque
nécessaire.

## Dependencies

Cette ADR dépend de :

- ADR-0001 — Monorepo Boundaries ;
- ADR-0002 — Technology Selection Gate ;
- ADR-0003 — API and Event Contracts ;
- ADR-0004 — Multi-Tenant Context.

Les décisions ultérieures doivent respecter cette architecture ou documenter
explicitement toute exception par une nouvelle décision architecturale.

## Related ADRs

- ADR-0001 — Monorepo Boundaries
- ADR-0002 — Technology Selection Gate
- ADR-0003 — API and Event Contracts
- ADR-0004 — Multi-Tenant Context
- ADR-006
- ADR-007

## Implementation Status

READY_FOR_IMPLEMENTATION

## Verification Status

NOT_VERIFIED

## Baseline Status

NOT_BASELINED
