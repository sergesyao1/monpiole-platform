export const AMENITY_CATEGORIES = ["COMFORT", "KITCHEN", "CONNECTIVITY", "ENERGY_WATER", "SECURITY", "BUILDING", "OUTDOOR", "SERVICES"] as const;
export type AmenityCategory = typeof AMENITY_CATEGORIES[number];

export const AMENITIES = [
  ["AIR_CONDITIONING", "COMFORT", "Climatisation"], ["FAN", "COMFORT", "Ventilateur"], ["HOT_WATER", "COMFORT", "Eau chaude"], ["WATER_HEATER", "COMFORT", "Chauffe-eau"], ["WASHING_MACHINE", "COMFORT", "Lave-linge"], ["IRON", "COMFORT", "Fer à repasser"], ["TELEVISION", "COMFORT", "Télévision"],
  ["EQUIPPED_KITCHEN", "KITCHEN", "Cuisine équipée"], ["REFRIGERATOR", "KITCHEN", "Réfrigérateur"], ["FREEZER", "KITCHEN", "Congélateur"], ["MICROWAVE", "KITCHEN", "Four à micro-ondes"], ["OVEN", "KITCHEN", "Four"], ["COOKTOP", "KITCHEN", "Plaque de cuisson"], ["KITCHENWARE", "KITCHEN", "Ustensiles de cuisine"],
  ["WIFI", "CONNECTIVITY", "Wi-Fi"], ["ETHERNET", "CONNECTIVITY", "Connexion Ethernet"], ["SATELLITE_TV", "CONNECTIVITY", "Télévision par satellite"],
  ["GENERATOR", "ENERGY_WATER", "Groupe électrogène"], ["BACKUP_POWER", "ENERGY_WATER", "Alimentation électrique de secours"], ["WATER_TANK", "ENERGY_WATER", "Réservoir d'eau"], ["BOREHOLE", "ENERGY_WATER", "Forage"], ["SOLAR_POWER", "ENERGY_WATER", "Énergie solaire"],
  ["SECURITY_GUARD", "SECURITY", "Gardiennage"], ["CCTV", "SECURITY", "Vidéosurveillance"], ["CONTROLLED_ACCESS", "SECURITY", "Accès contrôlé"], ["SMOKE_DETECTOR", "SECURITY", "Détecteur de fumée"], ["FIRE_EXTINGUISHER", "SECURITY", "Extincteur"],
  ["ELEVATOR", "BUILDING", "Ascenseur"], ["PARKING", "BUILDING", "Parking"], ["COVERED_PARKING", "BUILDING", "Parking couvert"], ["RECEPTION", "BUILDING", "Réception"], ["ACCESSIBLE_ACCESS", "BUILDING", "Accès adapté"],
  ["BALCONY", "OUTDOOR", "Balcon"], ["TERRACE", "OUTDOOR", "Terrasse"], ["GARDEN", "OUTDOOR", "Jardin"], ["SWIMMING_POOL", "OUTDOOR", "Piscine"], ["CHILDREN_PLAY_AREA", "OUTDOOR", "Aire de jeux pour enfants"],
  ["HOUSEKEEPING", "SERVICES", "Service de ménage"], ["LAUNDRY_SERVICE", "SERVICES", "Service de blanchisserie"], ["ROOM_SERVICE", "SERVICES", "Service en chambre"], ["BREAKFAST", "SERVICES", "Petit-déjeuner"], ["CONCIERGE", "SERVICES", "Conciergerie"],
] as const satisfies readonly (readonly [string, AmenityCategory, string])[];
export type AmenityCode = typeof AMENITIES[number][0];
export interface Amenity { readonly code: AmenityCode; readonly category: AmenityCategory; readonly labelFr: string; readonly displayOrder: number; }
export const AMENITY_CODES = AMENITIES.map(([code]) => code);
export function amenityCatalog(): readonly Amenity[] { return AMENITIES.map(([code, category, labelFr], displayOrder) => ({ code, category, labelFr, displayOrder })); }
export function validateAmenityCodes(codes: readonly string[]): readonly AmenityCode[] {
  if (codes.length > AMENITIES.length || new Set(codes).size !== codes.length || codes.some((code) => !AMENITY_CODES.includes(code as AmenityCode))) throw new InvalidPropertyAmenitiesError();
  return codes as readonly AmenityCode[];
}
export class InvalidPropertyAmenitiesError extends Error { readonly code = "INVALID_PROPERTY_AMENITIES"; }
