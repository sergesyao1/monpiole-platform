import { z } from "zod";

export const PropertyIdSchema = z.uuid().meta({ id: "PropertyId" });
export const PropertyTypeSchema = z.enum(["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"]);
export const TransactionTypeSchema = z.enum(["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"]);
export const PropertyLocationSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/),
  city: z.string().trim().min(1).max(200),
  district: z.string().trim().min(1).max(200),
  addressLine: z.string().trim().min(1).max(200),
}).strict();

export const CreatePropertyRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5_000).optional(),
  propertyType: PropertyTypeSchema,
  transactionType: TransactionTypeSchema,
  location: PropertyLocationSchema,
}).strict().meta({ id: "CreatePropertyRequest" });

export const PropertyResponseSchema = z.object({
  propertyId: PropertyIdSchema,
  title: z.string(), description: z.string().optional(),
  propertyType: PropertyTypeSchema, transactionType: TransactionTypeSchema,
  status: z.literal("DRAFT"), location: PropertyLocationSchema,
  createdAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
  updatedAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
}).strict().meta({ id: "PropertyResponse" });

export const RetrievePropertyPathSchema = z.object({ propertyId: PropertyIdSchema }).strict().meta({ id: "RetrievePropertyPath" });
export type CreatePropertyRequest = z.output<typeof CreatePropertyRequestSchema>;
export type PropertyResponse = z.output<typeof PropertyResponseSchema>;
