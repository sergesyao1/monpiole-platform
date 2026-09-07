import { z } from "zod";

const InstantSchema = z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z"));
export const PublicPropertyIdSchema = z.uuid().meta({ id: "PublicPropertyId" });
export const PublicPropertyTypeSchema = z.enum(["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"]);
export const PublicTransactionTypeSchema = z.enum(["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"]);
export const PublicApartmentSubtypeSchema = z.enum(["STUDIO", "MULTI_ROOM"]);
export const PublicPropertyStructuralRoleSchema = z.enum(["STANDALONE", "COMPOSITE", "UNIT"]);
export const PublicPropertyLocationSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/u),
  city: z.string().trim().min(1).max(200),
  district: z.string().trim().min(1).max(200),
}).strict().meta({ id: "PublicPropertyLocation" });
export const PublicPropertyDetailsSchema = z.object({
  usableSurfaceSquareMeters: z.number().positive().finite().optional(),
  rooms: z.number().int().nonnegative().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  furnished: z.boolean().optional(),
}).strict().meta({ id: "PublicPropertyDetails" });
const CurrencySchema = z.string().regex(/^[A-Z]{3}$/u);
const AmountMinorSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const PublicPropertyCommercialTermsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("LONG_TERM_RENTAL"), currency: CurrencySchema,
    rentAmountMinor: AmountMinorSchema, rentPeriod: z.literal("MONTH"),
    securityDepositAmountMinor: AmountMinorSchema.optional(), chargesAmountMinor: AmountMinorSchema.optional(),
    agencyFeeAmountMinor: AmountMinorSchema.optional(),
  }).strict(),
  z.object({
    kind: z.literal("SHORT_TERM_RENTAL"), currency: CurrencySchema,
    rateAmountMinor: AmountMinorSchema, pricingUnit: z.enum(["NIGHT", "WEEK"]),
    cleaningFeeAmountMinor: AmountMinorSchema.optional(), securityDepositAmountMinor: AmountMinorSchema.optional(),
    minimumStayNights: z.number().int().min(1).max(2_147_483_647).optional(),
  }).strict(),
  z.object({
    kind: z.literal("SALE"), currency: CurrencySchema, salePriceAmountMinor: AmountMinorSchema,
    agencyFeeAmountMinor: AmountMinorSchema.optional(),
  }).strict(),
]).meta({ id: "PublicPropertyCommercialTerms" });
export const PublicPropertyPrimaryPhotoSchema = z.object({
  url: z.string().regex(/^\/v1\/public\/properties\/[0-9a-f-]+\/primary-photo$/u),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
}).strict().meta({ id: "PublicPropertyPrimaryPhoto" });

const PublicPropertySummaryShape = {
  publicPropertyId: PublicPropertyIdSchema,
  title: z.string().min(1).max(200),
  propertyType: PublicPropertyTypeSchema,
  transactionType: PublicTransactionTypeSchema,
  apartmentSubtype: PublicApartmentSubtypeSchema.optional(),
  structuralRole: PublicPropertyStructuralRoleSchema,
  location: PublicPropertyLocationSchema,
  commercialTerms: PublicPropertyCommercialTermsSchema,
  primaryPhoto: PublicPropertyPrimaryPhotoSchema.nullable(),
  publishedAt: InstantSchema,
};
export const PublicPropertySummarySchema = z.object(PublicPropertySummaryShape).strict().meta({ id: "PublicPropertySummary" });
export const PublicPropertyDetailSchema = z.object({
  ...PublicPropertySummaryShape,
  description: z.string().max(5_000).nullable(),
  details: PublicPropertyDetailsSchema,
}).strict().meta({ id: "PublicPropertyDetail" });
export const PublicPropertyCatalogResponseSchema = z.object({
  items: z.array(PublicPropertySummarySchema),
  pageInfo: z.object({ nextCursor: z.string().max(512).nullable(), hasNextPage: z.boolean() }).strict(),
}).strict().meta({ id: "PublicPropertyCatalogResponse" });
export const ListPublicPropertiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(512).optional(),
  type: PublicPropertyTypeSchema.optional(),
  transactionType: PublicTransactionTypeSchema.optional(),
}).strict().meta({ id: "ListPublicPropertiesQuery" });
export const PublicPropertyPathSchema = z.object({ publicPropertyId: PublicPropertyIdSchema })
  .strict().meta({ id: "PublicPropertyPath" });

export type PublicPropertySummary = z.output<typeof PublicPropertySummarySchema>;
export type PublicPropertyDetail = z.output<typeof PublicPropertyDetailSchema>;
export type PublicPropertyCatalogResponse = z.output<typeof PublicPropertyCatalogResponseSchema>;
export type ListPublicPropertiesQuery = z.output<typeof ListPublicPropertiesQuerySchema>;
