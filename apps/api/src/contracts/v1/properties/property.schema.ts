import { z } from "zod";

export const PropertyIdSchema = z.uuid().meta({ id: "PropertyId" });
export const PropertyTypeSchema = z.enum(["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"]);
export const TransactionTypeSchema = z.enum(["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"]);
export const PropertyStructuralRoleSchema = z.enum(["STANDALONE", "COMPOSITE", "UNIT"]);
export const PropertyLocationSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/),
  city: z.string().trim().min(1).max(200),
  district: z.string().trim().min(1).max(200),
  addressLine: z.string().trim().min(1).max(200),
}).strict();

export const PropertyDetailsSchema = z.object({
  usableSurfaceSquareMeters: z.number().positive().finite().optional(),
  rooms: z.number().int().nonnegative().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  furnished: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0).refine(
  (value) => value.rooms === undefined || value.bedrooms === undefined || value.bedrooms <= value.rooms,
);

const CurrencySchema = z.string().regex(/^[A-Z]{3}$/);
const AmountMinorSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const CommercialTermsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("LONG_TERM_RENTAL"), currency: CurrencySchema,
    rentAmountMinor: AmountMinorSchema, rentPeriod: z.literal("MONTH"),
    securityDepositAmountMinor: AmountMinorSchema.optional(), chargesAmountMinor: AmountMinorSchema.optional(),
  }).strict(),
  z.object({
    kind: z.literal("SHORT_TERM_RENTAL"), currency: CurrencySchema,
    rateAmountMinor: AmountMinorSchema, pricingUnit: z.enum(["NIGHT", "WEEK"]),
  }).strict(),
  z.object({ kind: z.literal("SALE"), currency: CurrencySchema, salePriceAmountMinor: AmountMinorSchema }).strict(),
]);

export const CreatePropertyRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5_000).optional(),
  propertyType: PropertyTypeSchema,
  transactionType: TransactionTypeSchema,
  location: PropertyLocationSchema,
}).strict().meta({ id: "CreatePropertyRequest" });

export const UpdatePropertyCoreInformationRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5_000).optional(),
  location: PropertyLocationSchema,
}).strict().meta({ id: "UpdatePropertyCoreInformationRequest" });

export const PropertyResponseSchema = z.object({
  propertyId: PropertyIdSchema,
  title: z.string(), description: z.string().optional(),
  propertyType: PropertyTypeSchema, transactionType: TransactionTypeSchema,
  status: z.literal("DRAFT"), location: PropertyLocationSchema,
  structuralRole: PropertyStructuralRoleSchema,
  createdAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
  updatedAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
  details: PropertyDetailsSchema.optional(),
  commercialTerms: CommercialTermsSchema.optional(),
}).strict().meta({ id: "PropertyResponse" });

export const RetrievePropertyPathSchema = z.object({ propertyId: PropertyIdSchema }).strict().meta({ id: "RetrievePropertyPath" });
export const UpdatePropertyDetailsRequestSchema = z.object({
  details: PropertyDetailsSchema,
  commercialTerms: CommercialTermsSchema,
}).strict().meta({ id: "UpdatePropertyDetailsRequest" });
export const ListPropertiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(512).optional(),
  status: z.literal("DRAFT").optional(),
  type: PropertyTypeSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
}).strict().meta({ id: "ListPropertiesQuery" });
export const PropertyPortfolioItemSchema = z.object({
  propertyId: PropertyIdSchema,
  title: z.string(), description: z.string().optional(),
  propertyType: PropertyTypeSchema, transactionType: TransactionTypeSchema,
  status: z.literal("DRAFT"), location: PropertyLocationSchema,
  structuralRole: PropertyStructuralRoleSchema,
  createdAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
  updatedAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
}).strict().meta({ id: "PropertyPortfolioItem" });
export const PropertyPortfolioResponseSchema = z.object({
  items: z.array(PropertyPortfolioItemSchema),
  pageInfo: z.object({ nextCursor: z.string().nullable(), hasNextPage: z.boolean() }).strict(),
}).strict().meta({ id: "PropertyPortfolioResponse" });
export type CreatePropertyRequest = z.output<typeof CreatePropertyRequestSchema>;
export type UpdatePropertyCoreInformationRequest = z.output<typeof UpdatePropertyCoreInformationRequestSchema>;
export type PropertyResponse = z.output<typeof PropertyResponseSchema>;
export type UpdatePropertyDetailsRequest = z.output<typeof UpdatePropertyDetailsRequestSchema>;
export type ListPropertiesQuery = z.output<typeof ListPropertiesQuerySchema>;
export type PropertyPortfolioResponse = z.output<typeof PropertyPortfolioResponseSchema>;
