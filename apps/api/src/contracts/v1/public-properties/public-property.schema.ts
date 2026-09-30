import { z } from "zod";
import { AmenitySchema } from "../properties/property-amenity.schema.js";

const InstantSchema = z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z"));
export const PublicPropertyIdSchema = z.uuid().meta({ id: "PublicPropertyId" });
export const PublicPropertyTypeSchema = z.enum(["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OFFICE", "SHOP", "BUILDING", "COMPLEX", "OTHER"]);
export const PublicTransactionTypeSchema = z.enum(["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"]);
export const PublicApartmentSubtypeSchema = z.enum(["STUDIO", "MULTI_ROOM"]);
export const PublicPropertyStructuralRoleSchema = z.enum(["STANDALONE", "COMPOSITE", "UNIT"]);
export const PublicPropertyLocationSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/u),
  city: z.string().trim().min(1).max(200),
  district: z.string().trim().min(1).max(200),
}).strict().meta({ id: "PublicPropertyLocation" });
export const PublicPropertyMapLocationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  precision: z.enum(["EXACT", "APPROXIMATE"]),
}).strict().meta({ id: "PublicPropertyMapLocation", description: "Privacy-safe effective map position. Null when hidden or unavailable." });
export const PublicPropertyDetailsSchema = z.object({
  usableSurfaceSquareMeters: z.number().positive().finite().optional(),
  rooms: z.number().int().nonnegative().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  furnished: z.boolean().optional(),
}).strict().meta({ id: "PublicPropertyDetails" });
const CurrencySchema = z.string().regex(/^[A-Z]{3}$/u);
const AmountMinorSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const QueryAmountMinorSchema = z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
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
export const PublicPropertyMediaSchema = z.object({
  mediaId: PublicPropertyIdSchema,
  kind: z.literal("IMAGE"),
  category: z.enum([
    "BUILDING_EXTERIOR_OR_ENTRANCE", "MAIN_LIVING_SLEEPING_AREA", "LIVING_ROOM_OR_MAIN_ROOM",
    "KITCHEN_OR_KITCHENETTE", "BEDROOM_OR_SLEEPING_AREA", "BATHROOM_OR_SHOWER_ROOM", "OTHER",
  ]),
  position: z.number().int().nonnegative(),
  isPrimary: z.boolean(),
  url: z.string().regex(/^\/v1\/public\/properties\/[0-9a-f-]+\/media\/[0-9a-f-]+\/content$/u),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
}).strict().meta({ id: "PublicPropertyMedia" });

const PublicPropertySummaryShape = {
  publicPropertyId: PublicPropertyIdSchema,
  title: z.string().min(1).max(200),
  propertyType: PublicPropertyTypeSchema,
  transactionType: PublicTransactionTypeSchema,
  apartmentSubtype: PublicApartmentSubtypeSchema.optional(),
  structuralRole: PublicPropertyStructuralRoleSchema,
  location: PublicPropertyLocationSchema,
  publicLocation: PublicPropertyMapLocationSchema.nullable(),
  commercialTerms: PublicPropertyCommercialTermsSchema,
  primaryPhoto: PublicPropertyPrimaryPhotoSchema.nullable(),
  publishedAt: InstantSchema,
};
export const PublicPropertySummarySchema = z.object(PublicPropertySummaryShape).strict().meta({ id: "PublicPropertySummary" });
export const PublicPropertyDetailSchema = z.object({
  ...PublicPropertySummaryShape,
  description: z.string().max(5_000).nullable(),
  details: PublicPropertyDetailsSchema,
  gallery: z.array(PublicPropertyMediaSchema),
  amenities: z.array(AmenitySchema),
}).strict().meta({ id: "PublicPropertyDetail" });
export const PublicPropertyCatalogResponseSchema = z.object({
  items: z.array(PublicPropertySummarySchema),
  pageInfo: z.object({ nextCursor: z.string().max(512).nullable(), hasNextPage: z.boolean() }).strict(),
}).strict().meta({ id: "PublicPropertyCatalogResponse" });
const listValue = <T extends z.ZodTypeAny>(item: T) => z.preprocess((value) => {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((entry) => typeof entry === "string" ? entry.split(",") : [entry]).filter((entry) => entry !== undefined && entry !== "");
}, z.array(item).min(1).max(20).transform((values) => [...new Set(values)]));
const optionalTrimmed = (max: number) => z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).max(max).optional());
export const PublicCatalogSortSchema = z.enum(["NEWEST", "PRICE_ASC", "PRICE_DESC", "NEXT_AVAILABLE"]);
export const ListPublicPropertiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(512).optional(),
  type: listValue(PublicPropertyTypeSchema).optional(),
  transactionType: listValue(PublicTransactionTypeSchema).optional(),
  structuralRole: listValue(PublicPropertyStructuralRoleSchema).optional(),
  countryCode: z.preprocess((value) => typeof value === "string" ? value.trim().toUpperCase() : value, z.string().regex(/^[A-Z]{2}$/u).optional()),
  city: optionalTrimmed(200), commune: optionalTrimmed(200), quartier: optionalTrimmed(200),
  minPriceAmountMinor: QueryAmountMinorSchema.optional(), maxPriceAmountMinor: QueryAmountMinorSchema.optional(),
  currencyCode: z.preprocess((value) => typeof value === "string" ? value.trim().toUpperCase() : value, z.string().regex(/^[A-Z]{3}$/u).optional()),
  minBedrooms: z.coerce.number().int().nonnegative().max(100).optional(), maxBedrooms: z.coerce.number().int().nonnegative().max(100).optional(),
  availableFrom: InstantSchema.optional(), availableTo: InstantSchema.optional(), q: optionalTrimmed(200),
  sort: PublicCatalogSortSchema.default("NEWEST"),
}).strict().superRefine((query, context) => {
  if (query.minPriceAmountMinor !== undefined && query.maxPriceAmountMinor !== undefined && query.minPriceAmountMinor > query.maxPriceAmountMinor) context.addIssue({ code: "custom", path: ["minPriceAmountMinor"], message: "Le prix minimum doit être inférieur ou égal au prix maximum." });
  if ((query.minPriceAmountMinor !== undefined || query.maxPriceAmountMinor !== undefined) && query.currencyCode === undefined) context.addIssue({ code: "custom", path: ["currencyCode"], message: "La devise est obligatoire pour filtrer les prix." });
  if (query.minBedrooms !== undefined && query.maxBedrooms !== undefined && query.minBedrooms > query.maxBedrooms) context.addIssue({ code: "custom", path: ["minBedrooms"], message: "Le minimum de chambres doit être inférieur ou égal au maximum." });
  if ((query.availableFrom === undefined) !== (query.availableTo === undefined)) context.addIssue({ code: "custom", path: [query.availableFrom === undefined ? "availableFrom" : "availableTo"], message: "Les deux limites de disponibilité sont obligatoires." });
  if (query.availableFrom !== undefined && query.availableTo !== undefined && Date.parse(query.availableFrom) >= Date.parse(query.availableTo)) context.addIssue({ code: "custom", path: ["availableFrom"], message: "La date de début doit précéder la date de fin." });
  if (query.availableFrom !== undefined && query.transactionType !== undefined && (query.transactionType.length !== 1 || query.transactionType[0] !== "SHORT_TERM_RENTAL")) context.addIssue({ code: "custom", path: ["transactionType"], message: "Une période de disponibilité s’applique uniquement à la location courte durée." });
}).meta({ id: "PublicCatalogSearchQuery" });
export const PublicPropertyPathSchema = z.object({ publicPropertyId: PublicPropertyIdSchema })
  .strict().meta({ id: "PublicPropertyPath" });
export const PublicPropertyMediaPathSchema = z.object({
  publicPropertyId: PublicPropertyIdSchema, mediaId: PublicPropertyIdSchema,
}).strict().meta({ id: "PublicPropertyMediaPath" });

export type PublicPropertySummary = z.output<typeof PublicPropertySummarySchema>;
export type PublicPropertyDetail = z.output<typeof PublicPropertyDetailSchema>;
export type PublicPropertyCatalogResponse = z.output<typeof PublicPropertyCatalogResponseSchema>;
export type ListPublicPropertiesQuery = z.output<typeof ListPublicPropertiesQuerySchema>;
