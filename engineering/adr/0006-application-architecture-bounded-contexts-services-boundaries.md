# ADR-0006 — Architecture applicative : Bounded Contexts, Services et Frontières

## Status

**ACCEPTED — READY_FOR_IMPLEMENTATION**

## Date

2026-08-09

## Decision Owners

Architecture / Engineering

---

# Context

L'ADR-0005 — Application Architecture: Clean Architecture & DDD définit les
principes fondamentaux d'architecture applicative de Mon Piole.

Elle établit notamment :

- la séparation des responsabilités ;
- l'isolation du domaine métier ;
- l'utilisation de Clean Architecture ;
- l'utilisation des principes DDD lorsque ceux-ci apportent une valeur réelle ;
- la maîtrise de la direction des dépendances ;
- l'indépendance du domaine vis-à-vis de l'infrastructure.

Le repository Mon Piole possède déjà une organisation structurante :

```text
apps/
services/
packages/
infrastructure/
tests/
```

Le répertoire services/ représente les Bounded Contexts métier
indépendamment déployables.

Chaque service :

possède son propre modèle de domaine ;
possède ses propres données ;
possède ses propres règles métier ;
possède son propre ownership ;
peut évoluer et être déployé indépendamment ;
communique avec les autres Bounded Contexts via des contrats explicites ;
peut utiliser des APIs et des événements pour communiquer ;
possède ses propres tests et documentation.

Les Bounded Contexts actuellement identifiés sont :

services/
├── audit/
├── billing/
├── identity/
├── notifications/
├── reporting/
├── tenant-management/
└── workflow/

Les packages partagés sont organisés séparément :

packages/
├── config/
├── core/
├── design-system/
├── design-tokens/
├── eslint-config/
├── events/
├── sdk/
├── shared/
├── testing/
├── types/
├── typescript-config/
├── ui/
└── utils/

Cette organisation doit être gouvernée explicitement afin d'éviter :

les dépendances directes entre bases de données de services ;
le partage de modèles métier internes ;
les dépendances circulaires ;
la fuite de logique métier dans les applications ;
l'utilisation abusive de packages/shared ;
la dépendance du domaine envers l'infrastructure ;
le couplage excessif entre Bounded Contexts ;
la création prématurée de services ;
la transformation du système en Distributed Monolith.
# Decision

Mon Piole adopte une architecture applicative orientée Bounded Contexts.

Chaque répertoire sous services/ représente un périmètre métier cohérent,
possédant ses responsabilités, son modèle de domaine et ses données.

L'architecture globale est organisée comme suit :

                         MON PIOLE
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
        apps              services           packages
          │                  │                  │
          │          ┌───────┼────────┐         │
          │          │       │        │         │
          │       identity billing  audit       │
          │          │       │        │         │
          │          └───────┼────────┘         │
          │                  │                  │
          │             APIs / Events           │
          │                                     │
          └─────────────────────────────────────┤
                                                │
                                         infrastructure

Les responsabilités principales sont :

apps
    Applications et interfaces utilisateur / API

services
    Bounded Contexts et logique métier

packages
    Primitives, contrats et utilitaires réellement partagés

infrastructure
    Capacités techniques de la plateforme

tests
    Vérification des comportements et des contrats
# 1. Bounded Contexts

Chaque service sous services/ représente un Bounded Context.

Un Bounded Context doit posséder :

une responsabilité métier clairement identifiable ;
un modèle de domaine cohérent ;
ses propres règles métier ;
ses propres données ;
un ownership identifiable ;
des frontières explicites ;
des contrats d'intégration définis.

Exemple :

services/billing/

représente le Bounded Context Billing.

Il est propriétaire de son modèle métier de facturation et de son état
financier.

Un autre service ne doit pas modifier directement cet état.

# 2. Service Ownership

Chaque Bounded Context doit avoir un ownership explicite.

L'équipe propriétaire est responsable notamment de :

l'évolution du domaine ;
la qualité du code ;
les données ;
les migrations ;
les contrats ;
les événements publiés ;
les règles de sécurité relevant du service ;
les tests ;
la documentation spécifique.

Exemple :

services/billing/
    Billing Team

services/identity/
    Identity Team

Une modification importante d'un Bounded Context doit respecter son ownership.

# 3. Data Ownership

Chaque Bounded Context est propriétaire de ses données.

Conceptuellement :

billing
    └── Billing data

identity
    └── Identity data

tenant-management
    └── Tenant data

Un service ne doit pas accéder directement aux tables ou structures internes
d'un autre service.

Interdit :

billing ──X──► identity database

Préféré :

billing
    │
    ├──► Identity API
    │
    └──► Identity Event

Le modèle de données interne d'un service ne constitue pas un contrat
inter-services.

# 4. Indépendance des services

Un Bounded Context doit pouvoir évoluer et être déployé indépendamment,
dans la mesure permise par ses contrats et ses contraintes opérationnelles.

L'indépendance implique notamment :

ownership explicite ;
modèle métier local ;
données propriétaires ;
migrations contrôlées ;
contrats explicites ;
tests ;
absence d'accès direct aux données d'un autre service.

L'indépendance ne signifie pas que chaque service doit obligatoirement
posséder une infrastructure physique totalement indépendante.

La séparation logique et contractuelle est obligatoire.

Les décisions relatives à l'infrastructure physique sont gouvernées par les
ADR correspondantes.

# 5. Structure interne d'un service

Chaque service applique les principes définis par ADR-0005.

Une structure cible indicative est :

services/
└── billing/
    ├── domain/
    │   ├── entities/
    │   ├── value_objects/
    │   ├── aggregates/
    │   ├── services/
    │   └── events/
    │
    ├── application/
    │   ├── commands/
    │   ├── queries/
    │   ├── use_cases/
    │   └── dto/
    │
    ├── infrastructure/
    │   ├── persistence/
    │   ├── providers/
    │   └── adapters/
    │
    ├── interfaces/
    │   ├── api/
    │   └── consumers/
    │
    ├── migrations/
    ├── tests/
    └── README.md

Cette structure est une référence architecturale et non une obligation
d'ajouter artificiellement tous les répertoires.

Un service simple peut utiliser une structure plus légère.

# 6. Domain Layer

Le Domain Layer contient les concepts et règles métier du Bounded Context.

Il peut contenir :

Entities ;
Value Objects ;
Aggregates ;
Domain Services ;
Domain Events ;
Domain Policies ;
invariants métier.

Le domaine ne doit pas dépendre directement :

d'une base de données ;
d'un framework d'interface ;
d'une application ;
d'un autre Bounded Context ;
d'une implémentation infrastructurelle ;
d'un fournisseur technique particulier.

Principe :

Le domaine exprime le métier, pas la technologie utilisée pour l'exécuter.

# 7. Application Layer

La couche Application orchestre les cas d'utilisation du Bounded Context.

Elle peut :

recevoir une commande ;
exécuter une requête ;
charger des agrégats ;
invoquer des ports ;
coordonner les composants du domaine ;
contrôler les frontières transactionnelles ;
publier des événements ;
retourner des résultats applicatifs.

Elle ne doit pas devenir un conteneur général de règles métier.

Principe :

Application orchestre ; Domain décide.

# 8. Infrastructure Layer

La couche Infrastructure contient les implémentations techniques nécessaires
au fonctionnement du Bounded Context.

Elle peut notamment contenir :

persistence ;
repositories ;
adapters ;
providers ;
messaging adapters ;
stockage ;
intégrations externes.

Infrastructure implémente les abstractions définies par les couches internes.

Le Domain Layer ne doit pas dépendre directement de ces implémentations.

# 9. Interfaces

Les interfaces permettent au Bounded Context d'interagir avec l'extérieur.

Elles peuvent inclure :

API ;
consumers ;
commandes ;
jobs ;
adaptateurs d'entrée.

Les interfaces ne doivent pas exposer directement les modèles internes du
domaine lorsque cela crée un couplage.

Des DTO et contrats explicites doivent être utilisés lorsque nécessaire.

# 10. Communication inter-services

Les Bounded Contexts communiquent via des contrats explicites.

Les mécanismes principaux sont :

APIs ;
événements ;
autres contrats explicitement approuvés.

Exemple synchrone :

billing
    │
    │ API
    ▼
identity

Exemple asynchrone :

billing
    │
    │ InvoiceCreated
    ▼
events
    │
    ├──► reporting
    └──► notifications

Le mécanisme choisi doit être déterminé par le besoin fonctionnel.

# 11. API Contracts

Les APIs inter-services sont des contrats publics du Bounded Context.

Un consommateur ne doit pas dépendre des détails internes du fournisseur.

Les contrats doivent :

être explicitement définis ;
être versionnables ;
être testables ;
préserver la compatibilité lorsque nécessaire ;
suivre les règles d'ADR-0003.

Les changements incompatibles doivent être gérés explicitement.

# 12. Events

Les événements représentent des faits significatifs du système.

Exemples :

PatientRegistered
InvoiceCreated
PaymentReceived
TenantCreated
UserProvisioned
WorkflowCompleted

Un producteur d'événement ne doit pas dépendre des implémentations internes
des consommateurs.

Les contrats événementiels doivent respecter ADR-0003.

Les événements doivent pouvoir évoluer de manière contrôlée.

# 13. Packages/Core

packages/core contient les primitives et abstractions architecturales
stables.

Il peut contenir notamment :

Result types
Domain primitives
Ports
Cross-cutting interfaces
Identifiers
Common errors

packages/core :

ne dépend pas des applications ;
ne dépend pas des services ;
ne dépend pas des adaptateurs d'infrastructure ;
doit rester faiblement couplé ;
doit exposer des abstractions petites et stables.

Il ne doit pas contenir de logique métier spécifique à un Bounded Context.

# 14. Packages/Events

packages/events contient les contrats nécessaires aux événements partagés.

Il ne doit pas contenir les implémentations métier des consommateurs.

Principe :

packages/events
       │
       └── contrats
              │
              ├──► service A
              ├──► service B
              └──► service C

Chaque service reste propriétaire de sa réaction à l'événement.

# 15. Packages/Types

packages/types peut contenir des types réellement partagés lorsqu'ils
constituent des contrats stables.

Un modèle métier interne doit rester dans son Bounded Context.

Interdit :

packages/types/
    billing/
        Invoice

si Invoice représente le modèle métier interne de Billing.

Préféré :

services/billing/
    domain/
        invoice

avec un contrat externe distinct si nécessaire.

# 16. Packages/Shared

packages/shared est réservé aux composants réellement transverses.

Ils doivent être :

largement réutilisables ;
faiblement dépendants ;
stables ;
testés ;
indépendants du métier d'un service particulier.

packages/shared ne doit pas devenir un emplacement générique pour du
code dont la propriété est incertaine.

Principe :

En cas de doute, le code reste dans son Bounded Context jusqu'à ce que sa
réutilisabilité soit démontrée.

# 17. Applications

Les répertoires sous apps/ représentent les applications et interfaces
du système.

Exemples :

apps/
├── admin/
├── api/
├── api-gateway/
├── mobile/
└── web/

Les applications :

présentent les interfaces ;
reçoivent les entrées externes ;
consomment les contrats des services ;
adaptent les entrées et sorties ;
ne possèdent pas les règles métier principales des Bounded Contexts.

Une application ne doit pas devenir un second emplacement pour le domaine
métier.

# 18. API Gateway

apps/api-gateway constitue une frontière d'entrée du système lorsqu'elle
est utilisée.

Elle peut notamment assurer :

routage ;
contrôle d'accès technique ;
rate limiting ;
observabilité ;
politiques transverses ;
agrégation technique contrôlée.

Elle ne doit pas devenir le propriétaire des règles métier des services.

# 19. Infrastructure

infrastructure/ contient les capacités techniques nécessaires à
l'exécution de la plateforme.

Exemples actuels :

infrastructure/
├── docker/
├── helm/
├── kubernetes/
├── minio/
├── monitoring/
├── nginx/
├── observability/
├── postgres/
├── redis/
├── security/
└── terraform/

Infrastructure fournit les capacités techniques.

Elle ne devient pas propriétaire des règles métier des Bounded Contexts.

Les choix technologiques et d'infrastructure sont gouvernés par les ADR
correspondantes et par ADR-0002.

# 20. Direction des dépendances

La direction générale des dépendances est :

Interfaces
    │
    ▼
Application
    │
    ▼
Domain
    ▲
    │
Infrastructure

Les dépendances internes doivent rester orientées vers des abstractions
stables.

Un Bounded Context ne doit pas dépendre directement des détails internes
d'un autre Bounded Context.

# 21. Dépendances interdites

Les dépendances suivantes sont interdites.

Service vers la base d'un autre service
billing ──X──► identity database
Service vers les internals d'un autre service
billing ──X──► identity/internal/...
Domain vers Infrastructure
domain ──X──► infrastructure
Domain vers une technologie spécifique
domain ──X──► framework / adapter technique
Core vers un service
packages/core ──X──► services/billing
Shared vers la logique métier
packages/shared ──X──► billing business rules
Dépendance circulaire
billing ──► reporting
    ▲           │
    └───────────┘
# 22. Création d'un nouveau Bounded Context

Un nouveau service ne doit être créé que lorsqu'un périmètre métier cohérent
est identifié.

Les critères comprennent :

responsabilité métier claire ;
modèle métier identifiable ;
données propriétaires ;
ownership identifiable ;
frontières explicites ;
besoin réel d'évolution indépendante.

La création d'un service uniquement pour obtenir une granularité technique
plus fine est déconseillée.

# 23. Séparation d'un Bounded Context

Un service existant doit être réévalué lorsqu'il devient :

trop large ;
responsable de plusieurs domaines métier distincts ;
fortement couplé ;
difficile à tester ;
difficile à faire évoluer ;
dépendant d'un nombre excessif de Bounded Contexts.

La séparation doit être précédée d'une analyse des responsabilités,
données et dépendances.

# 24. Transactions inter-services

Les transactions métier doivent rester autant que possible à l'intérieur
d'un Bounded Context.

Une opération impliquant plusieurs services ne doit pas supposer une
transaction ACID globale.

Lorsque nécessaire, l'architecture peut utiliser :

événements ;
orchestration ;
compensation ;
idempotence ;
retry ;
mécanismes de cohérence distribuée.

Le choix précis doit être adapté au cas d'utilisation.

# 25. Idempotence

Les contrats inter-services critiques doivent être conçus pour supporter
l'idempotence lorsque les opérations peuvent être rejouées.

Cette règle est particulièrement importante pour :

facturation ;
paiements ;
provisioning ;
notifications ;
workflows ;
traitements asynchrones.
# 26. Tests

Chaque Bounded Context doit disposer de tests adaptés à ses responsabilités.

Les catégories peuvent inclure :

services/<context>/
    tests/
        unit/
        integration/
        contract/

Les tests doivent notamment couvrir :

Domain

Règles métier et invariants.

Application

Cas d'utilisation et orchestration.

Infrastructure

Intégrations techniques.

Contracts

APIs et événements.

Integration

Interaction avec les dépendances externes.

# 27. Vérification architecturale

Les règles de cette ADR doivent être vérifiables de manière déterministe et
reproductible.

Les contrôles devront notamment permettre de détecter :

dépendances interdites ;
dépendances circulaires ;
accès inter-services aux internals ;
accès inter-services aux données ;
dépendances Domain → Infrastructure ;
dépendances packages/core → services ;
logique métier spécifique dans packages/shared.

La vérification devra être intégrable dans le processus de qualité et de CI.

Technology Selection Boundary

Cette ADR ne sélectionne aucun :

runtime ;
framework ;
package manager ;
outil d'analyse ;
outil de dependency checking ;
technologie CI spécifique.

Le choix de ces technologies doit respecter ADR-0002 — Technology Selection
Gate.

Toute sélection technologique nécessaire à l'implémentation des contrôles
architecturaux doit faire l'objet de la décision architecturale ou
technologique appropriée avant installation ou intégration.

# 28. Vérification documentaire et structurelle initiale

Avant l'implémentation des contrôles automatisés, le repository doit pouvoir
être vérifié manuellement sur les points suivants :

chaque Bounded Context possède un README ;
chaque Bounded Context possède un ownership identifiable ;
les responsabilités de chaque Bounded Context sont documentées ;
packages/core ne dépend pas des services ;
packages/shared est réservé aux composants transverses ;
les applications sont séparées des services métier ;
les données sont déclarées comme propriétaires des services ;
les contrats inter-services sont explicitement identifiés.

Cette vérification constitue la baseline structurelle initiale.

# 29. Stratégie de migration

L'implémentation de cette ADR est progressive.

Aucune réécriture globale n'est imposée.

Pour chaque Bounded Context :

1. Identifier le périmètre métier
        ↓
2. Identifier le modèle métier
        ↓
3. Identifier les données propriétaires
        ↓
4. Identifier les contrats
        ↓
5. Identifier les événements
        ↓
6. Séparer Domain / Application / Infrastructure
        ↓
7. Ajouter les tests
        ↓
8. Ajouter les contrôles architecturaux

Les fonctionnalités existantes doivent continuer à fonctionner pendant la
migration.

# 30. Conséquences positives

Cette décision apporte :

frontières métier explicites ;
ownership clair ;
isolation des données ;
réduction du couplage ;
meilleure testabilité ;
meilleure évolutivité ;
possibilité de déploiement indépendant ;
gouvernance plus claire ;
préparation à une architecture distribuée.

Elle fournit également une règle simple :

Le métier appartient à un Bounded Context ; les contrats permettent la
communication ; les packages fournissent uniquement ce qui est réellement
partagé.

# 31. Conséquences négatives

Cette architecture introduit :

davantage de contrats ;
davantage de tests ;
une gestion explicite des dépendances ;
un coût opérationnel supérieur ;
une complexité potentielle des communications distribuées ;
la nécessité de gérer l'idempotence et les évolutions de contrats.

La création de nouveaux services doit donc rester justifiée.

# 32. Risques
Microservices prématurés

Créer un service pour une fonctionnalité trop petite.

Shared Kernel excessif

Déplacer progressivement le métier dans packages/shared.

Contrats trop couplés

Exposer les modèles internes comme contrats publics.

Distributed Monolith

Créer plusieurs services mais conserver des dépendances synchrones fortes
et permanentes.

Base de données partagée

Créer des dépendances directes entre services via une base commune.

God Service

Créer un Bounded Context contenant plusieurs domaines métier sans frontière
claire.

# 33. Gouvernance

Toute nouvelle dépendance significative entre Bounded Contexts doit être :

identifiée ;
justifiée ;
revue ;
testée ;
documentée lorsque nécessaire.

Toute violation importante de cette ADR doit être documentée par une nouvelle
décision architecturale.

Les décisions ultérieures doivent respecter :

ADR-0001 — Monorepo Boundaries ;
ADR-0002 — Technology Selection Gate ;
ADR-0003 — API and Event Contracts ;
ADR-0004 — Multi-Tenant Context ;
ADR-0005 — Application Architecture: Clean Architecture & DDD ;
ADR-0006 — Bounded Contexts, Services & Boundaries.
# 34. Verification Criteria

ADR-0006 pourra être considérée comme vérifiée lorsque :

chaque service possède une frontière métier identifiable ;
chaque service possède un ownership ;
les données sont propriétaires du service concerné ;
aucun service n'accède directement aux données d'un autre ;
les communications inter-services utilisent des contrats explicites ;
les événements respectent ADR-0003 ;
packages/core reste indépendant des services ;
packages/shared reste limité aux composants réellement transverses ;
les applications ne contiennent pas de logique métier appartenant aux services ;
les dépendances interdites sont détectables ;
les dépendances circulaires sont détectables ;
les contrôles architecturaux sont reproductibles ;
les contrôles sont intégrables au processus de qualité et de CI.
# 35. Baseline Criteria

ADR-0006 pourra passer à BASELINED lorsque :

la structure des Bounded Contexts est matérialisée ;
les ownerships sont documentés ;
les responsabilités principales sont documentées ;
les frontières de données sont définies ;
les contrats principaux sont identifiés ;
les règles de dépendance sont vérifiables ;
les contrôles architecturaux nécessaires sont implémentés ;
les tests concernés passent ;
les exceptions sont documentées ;
ADR-007 est alignée sur cette architecture.
# Dependencies

Cette ADR dépend de :

ADR-0001 — Monorepo Boundaries ;
ADR-0002 — Technology Selection Gate ;
ADR-0003 — API and Event Contracts ;
ADR-0004 — Multi-Tenant Context ;
ADR-0005 — Application Architecture: Clean Architecture & DDD.
# Related ADRs
ADR-0001 — Monorepo Boundaries
ADR-0002 — Technology Selection Gate
ADR-0003 — API and Event Contracts
ADR-0004 — Multi-Tenant Context
ADR-0005 — Application Architecture: Clean Architecture & DDD
ADR-0007 — Modularité et découpage détaillé des Bounded Contexts
# Implementation Status

READY_FOR_IMPLEMENTATION

# Verification Status

NOT_VERIFIED

# Baseline Status

NOT_BASELINED