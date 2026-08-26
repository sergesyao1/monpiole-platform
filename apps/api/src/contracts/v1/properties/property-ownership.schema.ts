import { z } from "zod";
import { PropertyIdSchema } from "./property.schema.js";
import { PropertyOwnerIdSchema } from "./property-owner.schema.js";

export const OwnershipShareSchema = z.number().positive().max(100).multipleOf(0.01);

export const AssignPropertyOwnerRequestSchema = z.object({
  ownerId: PropertyOwnerIdSchema,
  ownershipShare: OwnershipShareSchema,
}).strict().meta({ id: "AssignPropertyOwnerRequest" });

export const PropertyOwnershipResponseSchema = z.object({
  propertyId: PropertyIdSchema,
  ownerId: PropertyOwnerIdSchema,
  ownershipShare: OwnershipShareSchema,
  createdAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
}).strict().meta({ id: "PropertyOwnershipResponse" });

export const PropertyOwnershipListResponseSchema = z.array(PropertyOwnershipResponseSchema)
  .meta({ id: "PropertyOwnershipListResponse" });

export const PropertyOwnershipPropertyPathSchema = z.object({ propertyId: PropertyIdSchema }).strict()
  .meta({ id: "PropertyOwnershipPropertyPath" });
export const PropertyOwnershipPathSchema = z.object({
  propertyId: PropertyIdSchema, ownerId: PropertyOwnerIdSchema,
}).strict().meta({ id: "PropertyOwnershipPath" });

export type AssignPropertyOwnerRequest = z.output<typeof AssignPropertyOwnerRequestSchema>;
export type PropertyOwnershipResponse = z.output<typeof PropertyOwnershipResponseSchema>;
