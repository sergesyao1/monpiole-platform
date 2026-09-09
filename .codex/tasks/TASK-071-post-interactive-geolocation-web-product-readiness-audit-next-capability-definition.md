# TASK-071 - Post-Interactive-Geolocation Web Product Readiness Audit & Next Capability Definition

## Executive Decision

**Status: DONE**

```text
SELECTED NEXT CAPABILITY:
Property Lead / Contact
```

```text
TASK-072 - Public Property Interest & Contact Lead Vertical Slice
```

MonPiole permet déjà de découvrir un bien publié et d'en consulter une vraie fiche détaillée. Le premier maillon absent du parcours produit est la manifestation d'intérêt : un visiteur convaincu ne peut ni contacter le gestionnaire ni laisser une demande traçable.

## Current Product State

TASK-068 établit que le Web privé, la publication et le catalogue forment un produit cohérent, avec une dette de consolidation. TASK-069 a depuis consolidé le Property Workspace et ajouté les clients et contrats privés, sans exposition publique. TASK-070 a ajouté une carte interactive à l'édition privée de la géolocalisation.

État réel ciblé :

- routes publiques `/catalogue` et `/catalogue/:publicPropertyId` ;
- catalogue anonyme Host-scoped avec pagination opaque ;
- filtres réels : type de bien et projet/transaction ;
- cartes avec photo, localisation ville/quartier et prix ;
- détail public avec galerie, description, caractéristiques et conditions financières ;
- aucun formulaire de contact, lead, favori ou shortlist ;
- aucune recherche texte, prix, surface, pièces ou zone ;
- aucune carte publique ou recherche géographique.

## TASK-070 Findings

`PropertyGeolocationMap.tsx` est un composant privé du formulaire gestionnaire. Il prévisualise une latitude/longitude et permet de déplacer un marqueur avant la sauvegarde existante.

Il faut distinguer :

- afficher la localisation d'un bien : TASK-070 le fait dans le workspace privé ;
- naviguer sur une carte : absent du catalogue ;
- rechercher plusieurs biens par emprise cartographique : absent du Web, des contrats publics et des queries.

TASK-070 n'a modifié ni la projection publique ni les règles `EXACT`, `APPROXIMATE` et `HIDDEN`.

## Current Public User Journey

```text
Catalogue             disponible
  -> Discovery        disponible, mais filtres limités
  -> Property Detail disponible et suffisamment riche
  -> Interest         aucun mécanisme
  -> Contact          aucun mécanisme
  -> Conversion       impossible à initier dans MonPiole
```

La recherche peut être améliorée, mais elle n'empêche pas un visiteur ayant trouvé un bien de l'évaluer. En revanche, l'absence totale d'action sur la fiche bloque systématiquement tout passage de la consultation à une relation commerciale.

## Main Product Gap

Le principal gap est l'absence de capture d'intérêt tenant-scoped pour un bien publié. Le visiteur arrive au bout de la fiche sans CTA utile, et le gestionnaire ne reçoit aucune demande exploitable. Le parcours s'arrête avant la conversion.

## Candidate Capabilities

| Capability | Valeur immédiate | Complète le parcours | Fondations | Complexité | Mobile | Conversion |
| --- | --- | --- | --- | --- | --- | --- |
| Property Lead / Contact | Très forte | Très forte | Forte | Raisonnable | Forte | Très forte |
| Advanced Search & Filtering | Forte | Moyenne | Forte | Moyenne | Forte | Moyenne |
| Map-driven Property Discovery | Forte | Moyenne | Faible à moyenne | Élevée | Forte | Moyenne |
| Favorites / Shortlist | Moyenne | Moyenne | Faible | Moyenne | Très forte | Moyenne |
| Richer Public Property Detail | Moyenne | Faible | Très forte | Faible | Forte | Moyenne |

## Selected Capability

**Property Lead / Contact** est retenue.

Pourquoi maintenant :

- la fiche publique détaillée existe déjà et constitue le point naturel du CTA ;
- le bien publié et son tenant sont déjà résolus côté serveur par le catalogue Host-scoped ;
- le modèle privé `PropertyClient` prouve que le domaine connaît les coordonnées de contact, mais ne doit pas être exposé ou réutilisé comme entrée anonyme sans décision explicite ;
- un lead ferme le premier trou bloquant entre intérêt et conversion ;
- le contrat créé sera directement consommable par un futur client mobile public.

## Deferred Capabilities

- Advanced Search attend : utile pour accélérer la découverte, mais un résultat pertinent ne peut toujours pas convertir sans contact.
- Map-driven Discovery attend : TASK-070 ne fournit que l'édition d'un point individuel ; une recherche par emprise demanderait projection publique, confidentialité, query spatiale et UX dédiées.
- Favorites attend : la shortlist améliore la comparaison mais ne crée pas de relation commerciale ; elle pose aussi une décision d'identité ou de stockage local.
- Rich Public Detail attend : le détail actuel couvre déjà photo, galerie, description, caractéristiques et prix. Son manque principal est le CTA.

## Proposed TASK-072

### Goal

Permettre à un visiteur anonyme de manifester son intérêt depuis la fiche d'un bien publié, et permettre au gestionnaire autorisé de consulter ces demandes dans l'espace privé.

### Scope

- CTA visible sur la fiche publique ;
- formulaire français minimal : nom, moyen de contact, message et consentement explicite ;
- création d'un lead rattaché au `publicPropertyId` et au tenant résolu par le Host ;
- accusé de réception sans divulgation interne ;
- liste paginée et détail minimal des leads dans le Property Workspace ;
- statut initial unique ou cycle minimal explicitement défini par TASK-072.

### Non-goals

- compte visiteur, messagerie temps réel, notifications email/SMS ;
- conversion automatique en `PropertyClient` ou contrat ;
- CRM générique, campagne marketing, favoris ;
- recherche avancée, carte publique, géocodage ;
- exposition de coordonnées du propriétaire ou du gestionnaire.

### Domain/API impact

- introduire un concept explicite `PropertyLead`, distinct de `PropertyClient`, avec identité, contact, message, consentement, timestamps et rattachement au bien publié ;
- endpoint public de création sous le bien publié ;
- endpoints privés tenant-scoped de liste et lecture ;
- DTO Zod stricts, Problem Details, pagination opaque et OpenAPI ;
- ne jamais accepter de `tenantId` public et ne jamais exposer clients, contrats ou données owner.

### Web impact

- formulaire accessible et responsive sur `PublicPropertyDetailPage` ;
- états validation, envoi, succès, erreur et anti-double soumission en français ;
- section privée compacte dans le workspace ou route dédiée si la volumétrie l'exige ;
- retour catalogue et fiche publique inchangés.

### Persistence impact

- table additive tenant-scoped pour les leads ;
- référence composite au bien, index de consultation déterministe, traces et RLS forcée ;
- pas de modification des tables clients/contrats ;
- politique de rétention à décider explicitement avant implémentation.

### Security / tenant impact

- tenant dérivé exclusivement du Host public puis du contexte authentifié privé ;
- création possible uniquement pour une Property actuellement publiée et visible dans ce catalogue ;
- lecture privée protégée par grants dédiés ;
- limites de taille, validation, rate limiting/anti-abus et minimisation des données personnelles ;
- réponse publique non révélatrice pour les biens absents, retirés ou appartenant à un autre tenant.

### Tests required

- domaine/application : invariants, publication requise, consentement et tenant ;
- HTTP/contrat : succès, validation stricte, host inconnu, bien absent/retiré, rate limit, non-divulgation et OpenAPI ;
- PostgreSQL : RLS, références tenant-scoped, rollback et pagination ;
- Web public : formulaire, validation, succès, erreurs et double soumission ;
- Web privé : permissions, liste, pagination et états vides/erreur.

### Acceptance criteria

1. Un visiteur peut envoyer une demande depuis une fiche publique publiée.
2. Aucun `tenantId`, client privé, contrat ou owner n'entre dans le contrat public.
3. Le serveur résout tenant et Property depuis le Host et le `publicPropertyId`.
4. Un bien absent, retiré ou cross-tenant ne reçoit aucun lead et ne divulgue rien.
5. Les données sont strictement validées, minimisées et protégées contre l'abus.
6. Le succès public est clair et une soumission répétée involontaire est empêchée.
7. Un gestionnaire autorisé consulte uniquement les leads de son tenant et du bien concerné.
8. Les listes privées utilisent une pagination opaque déterministe.
9. RLS, grants, OpenAPI et tests des frontières publique/privée passent.
10. Le parcours `Discovery -> Detail -> Interest -> Contact` est fonctionnel sur Web responsive.

## Architecture Impact

La capability appartient au bounded context Property Management si le lead est défini comme intérêt porté à une Property. Elle doit rester distincte de l'identité SaaS, du propriétaire juridique, du `PropertyClient` contractuel et des contrats. La conversion éventuelle d'un lead en client sera une future commande explicite, pas un effet de la création publique.

## Mobile Leverage

L'endpoint public de création et les contrats de lecture privés pourront être réutilisés par une application mobile locataire/acheteur et par une application gestionnaire. Aucun comportement mobile spécifique n'est requis dans TASK-072.

## Risks / Guardrails

- PII et consentement imposent rétention, suppression et accès minimal explicites.
- Un endpoint anonyme exige une protection anti-spam réaliste avant exposition Internet.
- La création d'un lead ne doit pas contourner le garde-fou actuel d'activation du catalogue en production.
- Ne pas confondre lead anonyme, client contractualisé et identité authentifiée.

## Validation

- Lecture ciblée de TASK-068, TASK-069 et TASK-070.
- Vérification ciblée des routes, pages, client Web et schémas du catalogue public.
- Tests TASK-070 non rejoués : son commit `76a2b46` est présent et le working tree initial était propre.
- `git diff --check` exécuté après création du rapport.

## Git State

État initial : working tree propre, HEAD `76a2b46 feat(web): add interactive property geolocation map`.

Seul ce rapport est créé par TASK-071. Aucun commit ni push.
