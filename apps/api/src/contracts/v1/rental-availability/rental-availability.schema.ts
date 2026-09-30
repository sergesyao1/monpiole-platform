import { z } from "zod";

const InstantSchema = z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z"));
export const RentalAvailabilityPathSchema = z.object({ propertyId: z.uuid() }).strict();
export const RentalAvailabilityQuerySchema = z.object({
  startsAt: InstantSchema,
  endsAt: InstantSchema,
}).strict().refine((value) => Date.parse(value.startsAt) < Date.parse(value.endsAt), {
  path: ["endsAt"], message: "endsAt must be after startsAt",
});
const RentalAvailabilityResponseShape = {
  propertyId: z.uuid(),
  rentalMode: z.enum(["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL"]),
  availabilityStatus: z.enum(["AVAILABLE", "UNAVAILABLE"]),
  rentableNow: z.boolean(),
  requestedPeriod: z.object({ startsAt: InstantSchema, endsAt: InstantSchema }).strict(),
  requestedPeriodAvailable: z.boolean(),
  nextAvailability: InstantSchema.optional(),
  evaluatedAt: InstantSchema,
  catalogDisposition: z.enum(["AVAILABLE_FOR_INTERVAL", "UNAVAILABLE_FOR_INTERVAL", "REMOVE_FROM_RENTAL_CATALOG"]),
};
export const PublicRentalAvailabilityResponseSchema = z.object(RentalAvailabilityResponseShape).strict();
export const RentalAvailabilityResponseSchema = z.object({
  ...RentalAvailabilityResponseShape,
  conflictTypes: z.array(z.enum(["ALLOCATION", "OPERATIONAL_BLOCK"])).optional(),
}).strict();

export type RentalAvailabilityResponse = z.output<typeof RentalAvailabilityResponseSchema>;
export type PublicRentalAvailabilityResponse = z.output<typeof PublicRentalAvailabilityResponseSchema>;
