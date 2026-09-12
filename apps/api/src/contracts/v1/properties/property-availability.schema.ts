import { z } from "zod";

import { PropertyIdSchema } from "./property.schema.js";

export const PropertyAvailabilityStatusSchema = z.enum(["AVAILABLE", "UNAVAILABLE"]);
export const PropertyOccupancyStatusSchema = z.enum(["VACANT", "OCCUPIED"]);
export const PropertyAvailabilityPathSchema = z.object({ propertyId: PropertyIdSchema })
  .strict().meta({ id: "PropertyAvailabilityPath" });
export const UpdatePropertyAvailabilityRequestSchema = z.object({
  availabilityStatus: PropertyAvailabilityStatusSchema,
  occupancyStatus: PropertyOccupancyStatusSchema,
}).strict().meta({ id: "UpdatePropertyAvailabilityRequest" });

const DirectBase = {
  propertyId: PropertyIdSchema,
  source: z.literal("DIRECT"),
  structuralRole: z.enum(["STANDALONE", "UNIT", "COMPOSITE"]),
  canUpdateAvailability: z.boolean(),
};
export const UnconfiguredDirectPropertyAvailabilitySchema = z.object({
  ...DirectBase,
  configured: z.literal(false),
}).strict().meta({ id: "UnconfiguredDirectPropertyAvailability" });
export const ConfiguredDirectPropertyAvailabilitySchema = z.object({
  ...DirectBase,
  configured: z.literal(true),
  availabilityStatus: PropertyAvailabilityStatusSchema,
  occupancyStatus: PropertyOccupancyStatusSchema,
  updatedAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
}).strict().meta({ id: "ConfiguredDirectPropertyAvailability" });
export const CompositePropertyAvailabilitySchema = z.object({
  propertyId: PropertyIdSchema,
  source: z.literal("DERIVED_FROM_UNITS"),
  structuralRole: z.literal("COMPOSITE"),
  availabilityStatus: z.enum(["AVAILABLE", "UNAVAILABLE", "NOT_CONFIGURED"]),
  totalUnitCount: z.number().int().nonnegative(),
  configuredUnitCount: z.number().int().nonnegative(),
  availableUnitCount: z.number().int().nonnegative(),
  unavailableUnitCount: z.number().int().nonnegative(),
  vacantUnitCount: z.number().int().nonnegative(),
  occupiedUnitCount: z.number().int().nonnegative(),
  unconfiguredUnitCount: z.number().int().nonnegative(),
  canUpdateAvailability: z.literal(false),
}).strict().meta({ id: "CompositePropertyAvailability" });
export const PropertyAvailabilityResponseSchema = z.union([
  UnconfiguredDirectPropertyAvailabilitySchema,
  ConfiguredDirectPropertyAvailabilitySchema,
  CompositePropertyAvailabilitySchema,
]).meta({ id: "PropertyAvailabilityResponse" });

export type UpdatePropertyAvailabilityRequest = z.infer<typeof UpdatePropertyAvailabilityRequestSchema>;
export type PropertyAvailabilityResponse = z.infer<typeof PropertyAvailabilityResponseSchema>;
