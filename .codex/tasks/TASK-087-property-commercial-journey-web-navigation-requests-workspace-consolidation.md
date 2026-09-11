# TASK-087 — Property Commercial Journey Web Navigation & Requests Workspace Consolidation

## Statut

DONE.

## Contexte et écart initial

Le parcours commercial canonique est déjà couvert de la demande au contrat par les slices TASK-076 à TASK-086.
Les actions détaillées existent dans le Property Workspace, mais leur découverte imposait de connaître et d’ouvrir le bien au préalable.
Les candidatures, conversions et contrats étaient donc difficiles à repérer dans un portefeuille comportant plusieurs biens.
La navigation authentifiée ne proposait que Tableau de bord, Biens immobiliers et Propriétaires.

## Décision produit

Une entrée globale « Demandes » est ajoutée immédiatement après « Biens immobiliers » et avant « Propriétaires ».
Cette page est une boîte de réception opérationnelle et un point d’orientation.
Elle présente le parcours courant, l’action attendue et le bien concerné.
Elle ne possède aucune mutation commerciale.
Le Property Workspace reste le contexte canonique d’exécution.

## Responsabilités

La vue globale assure découverte, contexte, progression et orientation.
Le Property Workspace conserve la prise en compte, la planification et réalisation de visite, le résultat, la candidature, la conversion et le contrat.
Les agrégats PropertyInquiry, PropertyViewing, PropertyViewingOutcome, PropertyApplication, PropertyClient et PropertyContract restent les sources de vérité.
Aucun statut « attention requise » n’est persisté.

## Architecture réutilisée

- Sidebar et routes authentifiées existantes.
- Client HTTP authentifié Web existant.
- composants PageHeader, Alert, EmptyState, LoadingState, StatusBadge et Button.
- autorité Property et grant `LIST_PROPERTY_INQUIRIES` existants.
- transactions tenant-scoped et RLS PostgreSQL existantes.
- tables et relations canoniques du parcours commercial.

## Read model minimal

L’API property-scoped existante aurait nécessité une liste des biens puis plusieurs appels par bien et par étape.
TASK-087 ajoute donc une seule projection de lecture tenant-scoped :

`GET /v1/property-commercial-journeys?limit=20&cursor=<opaque>`

Le serveur déduit le tenant de l’autorité authentifiée.
Aucun `tenantId` n’est accepté depuis le navigateur.
Le cas d’usage exige `LIST_PROPERTY_INQUIRIES`.
La requête PostgreSQL s’exécute dans une transaction dotée du contexte RLS du tenant.
Les jointures portent aussi sur les clés tenant-scoped.
L’ordre est déterministe : date de création de demande décroissante, puis identifiant décroissant.
Le curseur est opaque pour le Web et validé par l’API.
La projection ne crée aucune table et aucune migration.

## Représentation du parcours

Les libellés Web sont dérivés des états canoniques :

- NEW : Nouvelle demande / Prendre en compte.
- ACKNOWLEDGED sans visite : Demande prise en compte / Planifier une visite.
- visite SCHEDULED : Visite planifiée / Effectuer la visite.
- visite COMPLETED sans résultat : Visite effectuée / Renseigner le résultat.
- résultat FOLLOW_UP_REQUIRED : À relancer / Relancer ou décider.
- résultat PROCEED sans candidature : Suite favorable / Créer la candidature.
- résultat DECLINED : Sans suite.
- candidature SUBMITTED : Candidature soumise / Étudier la candidature.
- candidature APPROVED sans conversion : Candidature approuvée / Créer le client.
- candidature REJECTED ou WITHDRAWN : état terminal correspondant.
- conversion sans contrat : Client créé / Préparer le contrat.
- contrat DRAFT : Contrat en préparation / Finaliser ou activer.
- contrat ACTIVE, ENDED ou CANCELLED : état correspondant sans action globale.
- demande CLOSED sans étape ultérieure : Demande close.

Ces valeurs sont des codes de projection et des libellés de présentation, jamais de nouveaux états métier persistés.

## Candidatures

Une candidature liée au parcours prend priorité sur la demande, la visite et son résultat dans l’étape affichée.
Les états soumis, approuvé, rejeté et retiré sont visibles dans la liste globale.
L’action « Ouvrir » cible l’ancre `property-applications` du bien concerné.
La décision et la conversion continuent d’utiliser les composants et endpoints property-scoped existants.

## Navigation Web

La route authentifiée `/demandes` est disponible dans les routeurs statique et lazy-managed.
Chaque ligne ou carte présente le demandeur, le bien, la date, l’étape et l’action attendue.
« Ouvrir » navigue vers `/properties/:propertyId` avec l’ancre commerciale appropriée.
La page charge les pages suivantes avec le curseur opaque renvoyé par l’API.
Elle déduplique les demandes par `inquiryId`.
Une erreur de page suivante conserve les résultats déjà affichés et produit un message français.

## États UX et responsive

Le chargement initial, l’absence de demandes, l’erreur initiale et l’erreur de pagination sont traités.
Les erreurs d’authentification et d’autorisation passent par le composant PropertyFeedback commun.
L’état vide explique que les demandes reçues pour les biens apparaîtront sur cette page.
La liste réutilise le pattern responsive existant : disposition horizontale sur grand écran et empilement sur écran étroit.
La sidebar responsive existante reçoit la nouvelle entrée sans système de navigation parallèle.

## Fichiers et composants

- domaine applicatif : port de projection et cas d’usage de liste.
- infrastructure : requête PostgreSQL de projection.
- API : schémas Zod, contrôleur GET, composition Nest et runtime PostgreSQL.
- Web : modèles, méthode du client, page, routes et navigation.
- tests : HTTP, Web et assertions PostgreSQL/RLS.

## Autorisation et isolation tenant

Le navigateur ne fournit jamais le tenant.
L’autorité authentifiée est convertie en autorité Property par le contrôleur.
Le cas d’usage sélectionne le tenant autorisé et vérifie le grant de lecture.
Le port ne reçoit que le tenant ainsi résolu.
La transaction PostgreSQL active la politique RLS et filtre explicitement le tenant.
Les références composites dans les jointures empêchent tout rattachement transversal.
Le test PostgreSQL vérifie qu’un second tenant reçoit une page vide.

## Tests

Les tests Web couvrent l’affichage d’une candidature, l’action attendue, le lien profond, le curseur opaque et la conservation après échec.
Les tests HTTP couvrent le succès, le contrat paginé, la validation de limite, le curseur invalide et l’absence de grant.
Le test PostgreSQL couvre la création/lecture d’une demande dans la projection et l’isolation RLS inter-tenant.
Les suites globales protègent les fonctionnalités property-scoped existantes.

## Capacités différées

- compteurs ou badges d’attention dans la navigation.
- vues séparées À traiter, Visites, Candidatures et Contrats.
- filtres, recherche et tri configurables.
- notifications, messagerie ou automatisation de relance.
- CRM ou moteur générique de pipeline.

## Validation finale

Les résultats exacts des commandes finales sont consignés dans le compte rendu de livraison.

## Recommandation TASK-088

`TASK-088 — Property Commercial Journey Attention Filters & Navigation Badge Capability Definition`

Cette tâche future doit commencer par une définition produit et mesurer le besoin réel avant toute persistance ou infrastructure de notification.
