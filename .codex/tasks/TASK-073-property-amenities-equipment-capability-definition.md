# TASK-073 - Property Amenities & Equipment Capability Definition

## Status

**DONE - capability defined; no implementation performed.**

Future implementation task:

```text
TASK-074 - Property Amenities & Equipment Vertical Slice
```

## Objective

Define a stable, extensible representation of amenities and equipment for furnished long-term rentals, short-term rentals, residences, hotels and aparthotels, while preserving the existing Property characteristics model.

## Current State

`PropertyDetails` currently represents intrinsic characteristics:

- usable surface;
- rooms;
- bedrooms;
- bathrooms;
- furnished status.

The same bounded set is exposed by the private Property contract, edited in `PropertyDetailsForm`, and projected deliberately into the public Property detail. No structured amenity or equipment concept exists today.

Amenities should not be added to `PropertyDetails`: `rooms` and `furnished` describe the Property itself, while Wi-Fi, a generator or a swimming pool are selectable capabilities whose catalog will evolve.

## Model Decision

Use a **canonical global Amenity catalog associated with Properties through tenant-scoped PropertyAmenity records**.

Do not use dedicated boolean columns:

- every new amenity would require domain, schema, migration, DTO and UI changes;
- sparse columns would grow indefinitely;
- grouping, ordering and filtering would remain duplicated across clients.

Do not use free text as the canonical representation:

- spelling, language and synonyms would prevent reliable search;
- values could not be translated consistently;
- public and mobile clients could not depend on stable semantics.

Free-form descriptive text may remain in the existing Property description, but it must not replace structured amenities.

## Canonical Model

### Amenity

Reference data with:

- `code`: immutable, stable, uppercase machine identifier;
- `category`: canonical category code;
- `labelFr`: French presentation label for V1;
- `displayOrder`: stable order inside a category;
- `active`: permits future catalog retirement without invalidating historical associations.

Amenity is a **platform-owned global catalog**, not tenant-managed data. Tenants select supported amenities but cannot create arbitrary codes in V1. This prevents catalog fragmentation and makes public filtering and mobile reuse reliable.

Codes are public compatibility commitments. Labels may evolve or later move to client localization resources; codes must not be renamed or reused.

### PropertyAmenity

Tenant-owned association with:

- `tenantId`;
- `propertyId`;
- `amenityCode`;
- audit fields consistent with Property Management conventions.

Natural identity: `(tenantId, propertyId, amenityCode)`.

V1 semantics are presence/absence only. Absence means “not declared”, not a guarantee that the amenity is unavailable. No quantity, brand, condition, coverage, capacity or monetary value is stored.

### Aggregate Boundary

The Property controls replacement of its amenity selection. A command validates all codes against the active canonical catalog and replaces the selection atomically. `PropertyAmenity` is not an independently managed aggregate and has no standalone public identity.

Units remain Properties and may have their own amenities. V1 should not inherit amenities automatically from a Building or composite parent. Shared facilities can be selected on the publicly advertised Property that legitimately offers them. Any future inheritance model requires a separate decision.

## Categories

Stable category codes:

| Code | French label | Purpose |
| --- | --- | --- |
| `COMFORT` | Confort | In-unit comfort |
| `KITCHEN` | Cuisine | Food preparation and appliances |
| `CONNECTIVITY` | Connectivité | Internet and entertainment connectivity |
| `ENERGY_WATER` | Énergie et eau | Utilities and resilience |
| `SECURITY` | Sécurité | Access and safety |
| `BUILDING` | Immeuble | Shared building infrastructure |
| `OUTDOOR` | Extérieur | Outdoor spaces and leisure |
| `SERVICES` | Services | Operational or hospitality services |

## Initial V1 Catalog

### Comfort

- `AIR_CONDITIONING` - Climatisation
- `FAN` - Ventilateur
- `HOT_WATER` - Eau chaude
- `WATER_HEATER` - Chauffe-eau
- `WASHING_MACHINE` - Lave-linge
- `IRON` - Fer à repasser
- `TELEVISION` - Télévision

### Kitchen

- `EQUIPPED_KITCHEN` - Cuisine équipée
- `REFRIGERATOR` - Réfrigérateur
- `FREEZER` - Congélateur
- `MICROWAVE` - Four à micro-ondes
- `OVEN` - Four
- `COOKTOP` - Plaque de cuisson
- `KITCHENWARE` - Ustensiles de cuisine

### Connectivity

- `WIFI` - Wi-Fi
- `ETHERNET` - Connexion Ethernet
- `SATELLITE_TV` - Télévision par satellite

### Energy and Water

- `GENERATOR` - Groupe électrogène
- `BACKUP_POWER` - Alimentation électrique de secours
- `WATER_TANK` - Réservoir d'eau
- `BOREHOLE` - Forage
- `SOLAR_POWER` - Énergie solaire

### Security

- `SECURITY_GUARD` - Gardiennage
- `CCTV` - Vidéosurveillance
- `CONTROLLED_ACCESS` - Accès contrôlé
- `SMOKE_DETECTOR` - Détecteur de fumée
- `FIRE_EXTINGUISHER` - Extincteur

### Building

- `ELEVATOR` - Ascenseur
- `PARKING` - Parking
- `COVERED_PARKING` - Parking couvert
- `RECEPTION` - Réception
- `ACCESSIBLE_ACCESS` - Accès adapté

### Outdoor

- `BALCONY` - Balcon
- `TERRACE` - Terrasse
- `GARDEN` - Jardin
- `SWIMMING_POOL` - Piscine
- `CHILDREN_PLAY_AREA` - Aire de jeux pour enfants

### Services

- `HOUSEKEEPING` - Service de ménage
- `LAUNDRY_SERVICE` - Service de blanchisserie
- `ROOM_SERVICE` - Service en chambre
- `BREAKFAST` - Petit-déjeuner
- `CONCIERGE` - Conciergerie

The implementation task should review terminology with product stakeholders before freezing this seed catalog. It should remove synonyms with indistinguishable semantics, but must not introduce tenant-created values in V1.

## V1 Commands and Queries

Recommended private operations:

- retrieve the canonical active Amenity catalog;
- retrieve amenities selected for one tenant-owned Property;
- atomically replace that Property's selected amenity codes.

Replacement is preferable to individual add/remove endpoints for the first UI: one form submission represents one complete selection and avoids partial multi-request updates.

Recommended public projection:

- include selected active amenities as `{ code, category }` or stable codes grouped by category;
- presentation labels may be carried by the contract only if the API owns French localization; otherwise Web/mobile map stable codes to localized labels;
- never expose `tenantId`, audit fields or inactive catalog metadata.

## Domain Impact

- add `AmenityCode` and `AmenityCategory` closed V1 value sets;
- add canonical Amenity definitions and Property selection validation;
- add replace/retrieve use cases and dedicated authority grants;
- keep amenity rules outside React and outside public controllers;
- do not change `furnished`: a furnished Property can have zero declared amenities, and selecting equipment does not automatically set `furnished`.

## PostgreSQL Impact

- global reference table such as `property_management.amenities`, seeded additively;
- tenant-scoped join table `property_management.property_amenities`;
- composite FK `(tenant_id, property_id)` to Property and FK to amenity code;
- composite primary key preventing duplicates;
- forced RLS on Property associations and explicit runtime grants;
- transaction and Property row lock for atomic replacement;
- no JSON blob and no amenity boolean columns on `properties`.

The global catalog should be runtime read-only. Catalog evolution occurs through reviewed migrations so all environments and clients share the same codes.

## API and Contract Impact

- additive private catalog and Property-selection endpoints under `/v1`;
- strict Zod schemas with bounded unique code arrays;
- tenant derived only from authenticated authority;
- 400 for malformed/unknown/inactive codes, 403 for missing grant, non-revealing 404 for missing or cross-tenant Property;
- additive amenity projection on public Property detail;
- regenerate OpenAPI and add compatibility tests.

The catalog list can initially be non-paginated because the canonical V1 set is small and bounded. Property selections should also have an explicit reasonable maximum.

## Property Workspace Impact

- add an “Équipements et services” section to the existing Property Workspace;
- group checkboxes by category using canonical labels and stable codes;
- preserve saved selections during errors and show loading, empty, success, validation, forbidden and retry states in French;
- allow keyboard operation and responsive reflow;
- do not use free-text tags as the primary editor.

## Public Detail Impact

- show only declared active amenities, grouped by category;
- omit empty categories;
- use clear text/icon pairs where the existing icon library provides appropriate icons;
- do not imply certification, availability guarantees or quantities;
- keep private audit and tenant data excluded.

## Search and Filtering

Do not add amenity filtering automatically with the first persistence slice unless explicitly included in TASK-074 scope. The model makes later filtering reliable through stable codes and indexed associations.

A future catalog search may accept a bounded list of codes with documented `match=all|any` semantics. Only high-value amenities should be promoted as quick filters; exposing forty checkboxes in discovery would degrade the public UX.

## Mobile Reuse

Stable codes, categories and a global catalog allow mobile clients to cache reference data, localize labels and submit the same selection contract. The absence of Web-specific identifiers or free text avoids a second mobile taxonomy.

## Future Extensibility

Later capabilities may introduce explicitly typed attributes such as:

- parking-space count;
- air-conditioning coverage;
- internet connection type or measured speed;
- generator capacity;
- pool access type;
- service availability schedule.

These must not be anticipated through an untyped `value` column in V1. Add typed, amenity-specific facts only when a real use case and validation contract exist.

## TASK-074 Recommended Scope

Implement the canonical catalog, tenant-scoped associations, replace/retrieve use cases, PostgreSQL migration/RLS, private API, Property Workspace selection UI, public detail projection, OpenAPI and focused domain/application/HTTP/PostgreSQL/Web tests.

Non-goals for TASK-074:

- tenant-created amenities;
- quantities or arbitrary metadata;
- amenity-based public search unless separately approved;
- inheritance between composite Properties and Units;
- translations beyond the established Web language;
- hotel inventory, room-service ordering or availability logic.

## Acceptance Direction for TASK-074

1. Canonical stable codes are shared by private and public contracts.
2. A tenant can replace amenities only for its own Property with a dedicated grant.
3. Unknown, inactive and duplicate codes cannot create inconsistent associations.
4. Replacement is atomic and rollback-safe.
5. RLS and composite references prevent cross-tenant access.
6. Historical Properties remain valid with an empty selection.
7. Workspace selections are grouped, accessible, responsive and French-labelled.
8. Public detail exposes only selected active amenities and no private fields.
9. `furnished` and existing Property details retain their current meaning and contracts.
10. Domain, HTTP, contract, PostgreSQL and Web tests prove the slice.

## Risks and Guardrails

- Catalog codes become long-lived compatibility commitments; seed review is required before release.
- Similar amenities such as hot water and water heater must remain distinct only if product semantics justify both.
- Shared-residence amenities must not create implicit inheritance rules.
- Public filters can become expensive without dedicated query indexes and explicit matching semantics.
- Do not allow arbitrary tenant labels to leak into public search taxonomy.

## Validation

- Targeted inspection only: Property details domain, private/public schemas, Workspace form and public detail.
- TASK-068 through TASK-071 conclusions reused where relevant.
- `git diff --check` is the only required command for this documentary task.
- No tests, builds, migrations or generators executed.

## Git Safety

The pre-existing untracked TASK-071 report was preserved. TASK-073 creates only this report. No commit, push or destructive Git command was performed.
