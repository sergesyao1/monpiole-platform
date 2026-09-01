import { z } from "zod";

import { PropertyIdSchema } from "./property.schema.js";

export const PropertyGeolocationPublicVisibilitySchema = z.enum(["EXACT", "APPROXIMATE", "HIDDEN"]);

const LatitudeSchema = z.number().finite().min(-90).max(90).multipleOf(0.000001);
const LongitudeSchema = z.number().finite().min(-180).max(180).multipleOf(0.000001);

export const UpdatePropertyGeolocationRequestSchema = z.object({
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  publicVisibility: PropertyGeolocationPublicVisibilitySchema,
}).strict().meta({ id: "UpdatePropertyGeolocationRequest" });

const ConfiguredPropertyGeolocationShape = {
  configured: z.literal(true),
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  publicVisibility: PropertyGeolocationPublicVisibilitySchema,
};

export const PropertyGeolocationResponseSchema = z.union([
  z.object({ configured: z.literal(false), source: z.literal("OWN") }).strict(),
  z.object({
    configured: z.literal(false),
    source: z.literal("INHERITED"),
    inheritedFromPropertyId: PropertyIdSchema,
  }).strict(),
  z.object({ ...ConfiguredPropertyGeolocationShape, source: z.literal("OWN") }).strict(),
  z.object({
    ...ConfiguredPropertyGeolocationShape,
    source: z.literal("INHERITED"),
    inheritedFromPropertyId: PropertyIdSchema,
  }).strict(),
]).meta({ id: "PropertyGeolocationResponse" });

export const PropertyGeolocationPathSchema = z.object({ propertyId: PropertyIdSchema })
  .strict().meta({ id: "PropertyGeolocationPath" });

export type UpdatePropertyGeolocationRequest = z.output<typeof UpdatePropertyGeolocationRequestSchema>;
export type PropertyGeolocationResponse = z.output<typeof PropertyGeolocationResponseSchema>;
