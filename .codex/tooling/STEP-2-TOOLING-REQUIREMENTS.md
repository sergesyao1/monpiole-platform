# STEP 2 — TOOLING REQUIREMENTS REPOSITORY

> Candidate tooling requirements extracted from ADR-005 and ADR-006.
> Project ADR scope: ADR-0001 → ADR-0006.
> Tooling extraction source in this register: ADR-0005 and ADR-0006.
> This is an extraction register, not a technology selection.
> Concrete tools MUST NOT be selected at this stage.

## ADR Inventory

- 0005-application-architecture-clean-architecture-ddd.md
- 0006-application-architecture-bounded-contexts-services-boundaries.md

## Extracted Candidate Requirements

| ID | ADR | Line | Evidence |
|---|---|---:|---|
| REQ-0001 | 0005-application-architecture-clean-architecture-ddd | 27 | l'indépendance du domaine métier vis-à-vis des frameworks, infrastructures et |
| REQ-0002 | 0005-application-architecture-clean-architecture-ddd | 37 | - logique métier dépendante de frameworks ; |
| REQ-0003 | 0005-application-architecture-clean-architecture-ddd | 42 | - difficulté à tester les composants indépendamment ; |
| REQ-0004 | 0005-application-architecture-clean-architecture-ddd | 97 | - orchestration métier ; |
| REQ-0005 | 0005-application-architecture-clean-architecture-ddd | 145 | ## Dependency Rules |
| REQ-0006 | 0005-application-architecture-clean-architecture-ddd | 172 | 7. les tests unitaires indépendants de l'infrastructure ; |
| REQ-0007 | 0005-application-architecture-clean-architecture-ddd | 187 | - tests ; |
| REQ-0008 | 0005-application-architecture-clean-architecture-ddd | 217 | - des tests unitaires du domaine ; |
| REQ-0009 | 0005-application-architecture-clean-architecture-ddd | 218 | - des tests d'intégration des adapters ; |
| REQ-0010 | 0005-application-architecture-clean-architecture-ddd | 237 | Les secrets et credentials ne doivent jamais être placés dans les modules |
| REQ-0011 | 0005-application-architecture-clean-architecture-ddd | 245 | Les mécanismes de logging, métriques, tracing et configuration doivent rester |
| REQ-0012 | 0005-application-architecture-clean-architecture-ddd | 251 | ## Testing & Verification |
| REQ-0013 | 0005-application-architecture-clean-architecture-ddd | 253 | ### Unit Tests |
| REQ-0014 | 0005-application-architecture-clean-architecture-ddd | 255 | Les règles métier doivent être testables sans infrastructure externe. |
| REQ-0015 | 0005-application-architecture-clean-architecture-ddd | 257 | ### Integration Tests |
| REQ-0016 | 0005-application-architecture-clean-architecture-ddd | 259 | Les adapters doivent être testés avec leurs dépendances techniques. |
| REQ-0017 | 0005-application-architecture-clean-architecture-ddd | 261 | ### Architecture Tests |
| REQ-0018 | 0005-application-architecture-clean-architecture-ddd | 266 | - Domain ne dépend pas d'un framework HTTP ; |
| REQ-0019 | 0005-application-architecture-clean-architecture-ddd | 271 | ### Contract Tests |
| REQ-0020 | 0005-application-architecture-clean-architecture-ddd | 275 | ### Tenant Tests |
| REQ-0021 | 0005-application-architecture-clean-architecture-ddd | 285 | - domaine métier plus testable ; |
| REQ-0022 | 0005-application-architecture-clean-architecture-ddd | 317 | ### Framework-Centric Architecture |
| REQ-0023 | 0005-application-architecture-clean-architecture-ddd | 332 | ## Dependencies |
| REQ-0024 | 0006-application-architecture-bounded-contexts-services-boundaries | 38 | tests/ |
| REQ-0025 | 0006-application-architecture-bounded-contexts-services-boundaries | 53 | possède ses propres tests et documentation. |
| REQ-0026 | 0006-application-architecture-bounded-contexts-services-boundaries | 73 | ├── eslint-config/ |
| REQ-0027 | 0006-application-architecture-bounded-contexts-services-boundaries | 77 | ├── testing/ |
| REQ-0028 | 0006-application-architecture-bounded-contexts-services-boundaries | 93 | la transformation du système en Distributed Monolith. |
| REQ-0029 | 0006-application-architecture-bounded-contexts-services-boundaries | 135 | tests |
| REQ-0030 | 0006-application-architecture-bounded-contexts-services-boundaries | 175 | les tests ; |
| REQ-0031 | 0006-application-architecture-bounded-contexts-services-boundaries | 233 | tests ; |
| REQ-0032 | 0006-application-architecture-bounded-contexts-services-boundaries | 275 | ├── tests/ |
| REQ-0033 | 0006-application-architecture-bounded-contexts-services-boundaries | 300 | d'un framework d'interface ; |
| REQ-0034 | 0006-application-architecture-bounded-contexts-services-boundaries | 408 | être testables ; |
| REQ-0035 | 0006-application-architecture-bounded-contexts-services-boundaries | 508 | testés ; |
| REQ-0036 | 0006-application-architecture-bounded-contexts-services-boundaries | 568 | ├── docker/ |
| REQ-0037 | 0006-application-architecture-bounded-contexts-services-boundaries | 570 | ├── kubernetes/ |
| REQ-0038 | 0006-application-architecture-bounded-contexts-services-boundaries | 572 | ├── monitoring/ |
| REQ-0039 | 0006-application-architecture-bounded-contexts-services-boundaries | 574 | ├── observability/ |
| REQ-0040 | 0006-application-architecture-bounded-contexts-services-boundaries | 619 | domain ──X──► framework / adapter technique |
| REQ-0041 | 0006-application-architecture-bounded-contexts-services-boundaries | 652 | difficile à tester ; |
| REQ-0042 | 0006-application-architecture-bounded-contexts-services-boundaries | 670 | orchestration ; |
| REQ-0043 | 0006-application-architecture-bounded-contexts-services-boundaries | 691 | # 26. Tests |
| REQ-0044 | 0006-application-architecture-bounded-contexts-services-boundaries | 693 | Chaque Bounded Context doit disposer de tests adaptés à ses responsabilités. |
| REQ-0045 | 0006-application-architecture-bounded-contexts-services-boundaries | 698 | tests/ |
| REQ-0046 | 0006-application-architecture-bounded-contexts-services-boundaries | 703 | Les tests doivent notamment couvrir : |
| REQ-0047 | 0006-application-architecture-bounded-contexts-services-boundaries | 711 | Cas d'utilisation et orchestration. |
| REQ-0048 | 0006-application-architecture-bounded-contexts-services-boundaries | 746 | runtime ; |
| REQ-0049 | 0006-application-architecture-bounded-contexts-services-boundaries | 747 | framework ; |
| REQ-0050 | 0006-application-architecture-bounded-contexts-services-boundaries | 748 | package manager ; |
| REQ-0051 | 0006-application-architecture-bounded-contexts-services-boundaries | 750 | outil de dependency checking ; |
| REQ-0052 | 0006-application-architecture-bounded-contexts-services-boundaries | 796 | 7. Ajouter les tests |
| REQ-0053 | 0006-application-architecture-bounded-contexts-services-boundaries | 811 | meilleure testabilité ; |
| REQ-0054 | 0006-application-architecture-bounded-contexts-services-boundaries | 828 | davantage de tests ; |
| REQ-0055 | 0006-application-architecture-bounded-contexts-services-boundaries | 870 | testée ; |
| REQ-0056 | 0006-application-architecture-bounded-contexts-services-boundaries | 912 | les tests concernés passent ; |
| REQ-0057 | 0006-application-architecture-bounded-contexts-services-boundaries | 915 | # Dependencies |

## Statistics

- ADR analysées : 2
- Occurrences candidates : 57

## STEP 2 Gate

- [ ] Toutes les ADR du périmètre sont présentes
- [ ] Chaque occurrence possède une ADR source
- [ ] Chaque occurrence possède une ligne source
- [ ] Les occurrences sont ensuite qualifiées en exigences
- [ ] Aucun outil concret n'est considéré comme retenu
- [ ] Les exigences qualifiées peuvent être regroupées en TOOL-*
