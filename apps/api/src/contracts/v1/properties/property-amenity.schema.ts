import { z } from "zod";
import { AMENITIES, AMENITY_CATEGORIES } from "@monpiole/property-management";
import { PropertyIdSchema } from "./property.schema.js";

export const AmenityCodeSchema = z.enum(AMENITIES.map(([code]) => code) as [typeof AMENITIES[number][0], ...typeof AMENITIES[number][0][]]);
export const AmenityCategorySchema = z.enum(AMENITY_CATEGORIES);
export const AmenitySchema = z.object({ code: AmenityCodeSchema, category: AmenityCategorySchema, labelFr: z.string().min(1).max(100), displayOrder: z.number().int().nonnegative() }).strict();
export const AmenityCatalogResponseSchema = z.object({ items: z.array(AmenitySchema) }).strict().meta({ id: "AmenityCatalogResponse" });
export const PropertyAmenitiesResponseSchema = z.object({ amenityCodes: z.array(AmenityCodeSchema).max(AMENITIES.length) }).strict().meta({ id: "PropertyAmenitiesResponse" });
export const ReplacePropertyAmenitiesRequestSchema = PropertyAmenitiesResponseSchema.meta({ id: "ReplacePropertyAmenitiesRequest" });
export const PropertyAmenitiesPathSchema = z.object({ propertyId: PropertyIdSchema }).strict();
export type AmenityCatalogResponse = z.output<typeof AmenityCatalogResponseSchema>;
export type PropertyAmenitiesResponse = z.output<typeof PropertyAmenitiesResponseSchema>;
