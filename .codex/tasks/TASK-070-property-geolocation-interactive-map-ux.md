# TASK-070 - Property Geolocation Interactive Map UX

- **Statut :** DONE

## Objectif

Ajouter à la géolocalisation privée d'un bien une prévisualisation OpenStreetMap interactive, sans modifier le domaine, l'API, la persistance ni les règles de confidentialité.

## Implémentation

- `PropertyGeolocationMap.tsx` affiche une carte React Leaflet responsive, l'attribution OpenStreetMap et un marqueur déplaçable.
- Le formulaire existant reste l'unique source de vérité. Les coordonnées valides déplacent la carte ; le marqueur met immédiatement à jour les champs à six décimales sans déclencher de sauvegarde.
- Les valeurs vides, non finies ou hors limites affichent un état neutre et ne sont jamais transmises à Leaflet.
- Le bouton et le contrat de sauvegarde existants sont inchangés. La visibilité `EXACT`, `APPROXIMATE` ou `HIDDEN` reste gérée par les mécanismes existants.
- L'ancien texte excluant tout service externe est remplacé par une aide de prévisualisation et de déplacement du marqueur.

## Fichiers principaux

- `apps/web/src/features/properties/PropertyGeolocationMap.tsx`
- `apps/web/src/features/properties/PropertyGeolocationSection.tsx`
- `apps/web/src/features/properties/PropertyGeolocationSection.test.tsx`
- `apps/web/src/styles/ui.css`
- `apps/web/package.json`
- `pnpm-lock.yaml`

## Dépendances

- `leaflet@1.9.4`
- `react-leaflet@5.0.0`
- `@types/leaflet@1.9.22` (développement)

## Validation

- Tests Web : PASS, 20 fichiers et 143 tests.
- Typecheck Web : PASS.
- Build Web : PASS, 167 modules transformés.
- Architecture : PASS.

## Limites

La carte utilise directement les tuiles OpenStreetMap. Recherche d'adresse, géocodage, clic de repositionnement, carte publique et géolocalisation du navigateur restent hors périmètre.
