import { z } from "zod";

export const PropertyIdSchema = z.uuid().meta({ id: "PropertyId" });
export const PropertyTypeSchema = z.enum(["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OFFICE", "SHOP", "BUILDING", "COMPLEX", "OTHER"]);
export const BuildingCommercializationModeSchema = z.enum(["WHOLE_BUILDING", "INDIVIDUAL_UNITS"]);
export const TransactionTypeSchema = z.enum(["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"]);
export const ApartmentSubtypeSchema = z.enum(["STUDIO", "MULTI_ROOM"]);
export const PropertyStatusSchema = z.enum(["DRAFT", "PUBLISHED", "WITHDRAWN"]);
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
const PositiveAmountMinorSchema = AmountMinorSchema.min(1);
export const CommercialTermsSchema = z.discriminatedUnion("kind", [
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
]);

export const PropertyPricingSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("LONG_TERM_RENTAL"), currency: z.literal("XOF"),
    rentAmountMinor: PositiveAmountMinorSchema, rentPeriod: z.literal("MONTH"),
    securityDepositAmountMinor: AmountMinorSchema.optional(), chargesAmountMinor: AmountMinorSchema.optional(),
    agencyFeeAmountMinor: AmountMinorSchema.optional(),
  }).strict(),
  z.object({
    kind: z.literal("SHORT_TERM_RENTAL"), currency: z.literal("XOF"),
    rateAmountMinor: PositiveAmountMinorSchema, pricingUnit: z.enum(["NIGHT", "WEEK"]),
    cleaningFeeAmountMinor: AmountMinorSchema.optional(), securityDepositAmountMinor: AmountMinorSchema.optional(),
    minimumStayNights: z.number().int().min(1).max(2_147_483_647).optional(),
  }).strict(),
  z.object({
    kind: z.literal("SALE"), currency: z.literal("XOF"), salePriceAmountMinor: PositiveAmountMinorSchema,
    agencyFeeAmountMinor: AmountMinorSchema.optional(),
  }).strict(),
]).meta({ id: "PropertyPricing" });

export const CreatePropertyRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5_000).optional(),
  propertyType: PropertyTypeSchema,
  commercializationMode: BuildingCommercializationModeSchema.optional(),
  transactionType: TransactionTypeSchema,
  apartmentSubtype: ApartmentSubtypeSchema.optional(),
  location: PropertyLocationSchema,
}).strict().superRefine((value, context) => {
  if (value.propertyType === "BUILDING" && value.commercializationMode === undefined) context.addIssue({ code: "custom", path: ["commercializationMode"], message: "Building commercialization mode is required" });
  if (value.propertyType !== "BUILDING" && value.commercializationMode !== undefined) context.addIssue({ code: "custom", path: ["commercializationMode"], message: "Commercialization mode applies only to buildings" });
  const requiresSubtype = value.propertyType === "APARTMENT" && value.transactionType === "LONG_TERM_RENTAL";
  if (requiresSubtype && value.apartmentSubtype === undefined) {
    context.addIssue({ code: "custom", path: ["apartmentSubtype"], message: "Apartment subtype is required" });
  }
  if (!requiresSubtype && value.apartmentSubtype !== undefined) {
    context.addIssue({ code: "custom", path: ["apartmentSubtype"], message: "Apartment subtype is not applicable" });
  }
}).meta({ id: "CreatePropertyRequest" });

export const UpdatePropertyCoreInformationRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5_000).optional(),
  apartmentSubtype: ApartmentSubtypeSchema.optional(),
  location: PropertyLocationSchema,
}).strict().meta({ id: "UpdatePropertyCoreInformationRequest" });

const InstantSchema = z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z"));
export const PropertyPhotoCategorySchema = z.enum([
  "BUILDING_EXTERIOR_OR_ENTRANCE", "MAIN_LIVING_SLEEPING_AREA", "LIVING_ROOM_OR_MAIN_ROOM",
  "KITCHEN_OR_KITCHENETTE", "BEDROOM_OR_SLEEPING_AREA", "BATHROOM_OR_SHOWER_ROOM", "OTHER",
]);
export const PropertyPhotoSchema = z.object({
  photoId: PropertyIdSchema,
  mediaKind: z.literal("IMAGE"),
  position: z.number().int().nonnegative(),
  category: PropertyPhotoCategorySchema,
  status: z.literal("AVAILABLE"),
  contentPath: z.string().regex(/^\/v1\/properties\/[0-9a-f-]+\/photos\/[0-9a-f-]+\/content$/u),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  contentByteSize: z.number().int().positive(),
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/u),
  isPrimary: z.boolean(),
  registeredAt: InstantSchema,
  availableAt: InstantSchema,
}).strict().meta({ id: "PropertyPhoto" });
export const PropertyPhotoGalleryResponseSchema = z.object({ photos: z.array(PropertyPhotoSchema) })
  .strict().meta({ id: "PropertyPhotoGalleryResponse" });
export const PropertyPhotoPathSchema = z.object({ propertyId: PropertyIdSchema, photoId: PropertyIdSchema })
  .strict().meta({ id: "PropertyPhotoPath" });
export const RegisterPropertyPhotoRequestSchema = z.object({
  category: PropertyPhotoCategorySchema,
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  contentBase64: z.string().min(1),
}).strict().meta({ id: "RegisterPropertyPhotoRequest" });
export const ReorderPropertyPhotosRequestSchema = z.object({
  photoIds: z.array(PropertyIdSchema).min(1).superRefine((photoIds, context) => {
    if (new Set(photoIds).size !== photoIds.length) {
      context.addIssue({ code: "custom", message: "Photo identifiers must be unique" });
    }
  }),
}).strict().meta({ id: "ReorderPropertyPhotosRequest" });
export const PropertyPhotoStandardSchema = z.object({
  minimumCount: z.number().int().min(1),
  additionalRequiredCategories: z.array(PropertyPhotoCategorySchema),
}).strict().meta({ id: "PropertyPhotoStandard" });
const PropertyResponseBaseShape = {
  propertyId: PropertyIdSchema,
  title: z.string(), description: z.string().optional(),
  propertyType: PropertyTypeSchema, transactionType: TransactionTypeSchema,
  commercializationMode: BuildingCommercializationModeSchema.optional(),
  apartmentSubtype: ApartmentSubtypeSchema.optional(),
  location: PropertyLocationSchema,
  structuralRole: PropertyStructuralRoleSchema,
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
  details: PropertyDetailsSchema.optional(),
  commercialTerms: CommercialTermsSchema.optional(),
  photos: z.array(PropertyPhotoSchema),
  primaryPhoto: PropertyPhotoSchema.optional(),
};
export const PropertyResponseSchema = z.discriminatedUnion("status", [
  z.object({ ...PropertyResponseBaseShape, status: z.literal("DRAFT"), canWithdrawFromCatalog: z.literal(false) }).strict(),
  z.object({ ...PropertyResponseBaseShape, status: z.literal("PUBLISHED"), publishedAt: InstantSchema, canWithdrawFromCatalog: z.boolean() }).strict(),
  z.object({ ...PropertyResponseBaseShape, status: z.literal("WITHDRAWN"), publishedAt: InstantSchema, withdrawnAt: InstantSchema, canWithdrawFromCatalog: z.literal(false) }).strict(),
]).meta({ id: "PropertyResponse" });

export const RetrievePropertyPathSchema = z.object({ propertyId: PropertyIdSchema }).strict().meta({ id: "RetrievePropertyPath" });
export const UpdatePropertyDetailsRequestSchema = z.object({
  details: PropertyDetailsSchema,
  commercialTerms: PropertyPricingSchema.optional(),
}).strict().meta({ id: "UpdatePropertyDetailsRequest" });
export const SetPropertyPricingRequestSchema = PropertyPricingSchema.meta({ id: "SetPropertyPricingRequest" });
export const ListPropertiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(512).optional(),
  status: PropertyStatusSchema.optional(),
  type: PropertyTypeSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  ownerId: PropertyIdSchema.optional(),
}).strict().meta({ id: "ListPropertiesQuery" });
const PropertyPortfolioFeaturedPhotoSchema = z.object({
  photoId: PropertyIdSchema,
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  contentBase64: z.string().min(1),
}).strict();
const PropertyPortfolioOwnerSchema = z.object({
  ownerId: PropertyIdSchema,
  displayName: z.string().min(1),
  phoneNumber: z.string().min(1).optional(),
  email: z.email().optional(),
  additionalOwnerCount: z.number().int().nonnegative(),
  inheritedFrom: z.object({ propertyId: z.uuid(), title: z.string() }).strict().optional(),
}).strict();

const PropertyPortfolioTypeCountSchema = z.object({
  propertyType: PropertyTypeSchema,
  totalCount: z.number().int().nonnegative(),
}).strict();

const PropertyPortfolioAvailabilityTypeSummarySchema = z.object({
  propertyType: PropertyTypeSchema,
  totalCount: z.number().int().nonnegative(),
  configuredCount: z.number().int().nonnegative(),
  availableCount: z.number().int().nonnegative(),
  unavailableCount: z.number().int().nonnegative(),
  vacantCount: z.number().int().nonnegative(),
  occupiedCount: z.number().int().nonnegative(),
}).strict();

const PropertyPortfolioContentSummarySchema = z.object({
  buildingCount: z.number().int().nonnegative(),
  composition: z.object({
    totalUnitCount: z.number().int().nonnegative(),
    unitsByType: z.array(PropertyPortfolioTypeCountSchema),
  }).strict(),
  availability: z.object({
    totalCount: z.number().int().nonnegative(),
    configuredCount: z.number().int().nonnegative(),
    availableCount: z.number().int().nonnegative(),
    unavailableCount: z.number().int().nonnegative(),
    vacantCount: z.number().int().nonnegative(),
    occupiedCount: z.number().int().nonnegative(),
    byType: z.array(PropertyPortfolioAvailabilityTypeSummarySchema),
  }).strict(),
  contracts: z.object({
    totalCount: z.number().int().nonnegative(),
    activeCount: z.number().int().nonnegative(),
  }).strict(),
}).strict();
const PropertyPortfolioItemBaseShape = {
  parent: z.object({ propertyId: z.uuid(), title: z.string() }).strict().optional(),
  propertyId: PropertyIdSchema,
  title: z.string(), description: z.string().optional(),
  propertyType: PropertyTypeSchema, transactionType: TransactionTypeSchema,
  apartmentSubtype: ApartmentSubtypeSchema.optional(),
  location: PropertyLocationSchema,
  structuralRole: PropertyStructuralRoleSchema,
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
  featuredPhoto: PropertyPortfolioFeaturedPhotoSchema.optional(),
  photoCount: z.number().int().nonnegative(),
  owner: PropertyPortfolioOwnerSchema.optional(),
  contentSummary: PropertyPortfolioContentSummarySchema.optional(),
};
export const PropertyPortfolioItemSchema = z.discriminatedUnion("status", [
  z.object({ ...PropertyPortfolioItemBaseShape, status: z.literal("DRAFT") }).strict(),
  z.object({ ...PropertyPortfolioItemBaseShape, status: z.literal("PUBLISHED"), publishedAt: InstantSchema }).strict(),
  z.object({ ...PropertyPortfolioItemBaseShape, status: z.literal("WITHDRAWN"), publishedAt: InstantSchema, withdrawnAt: InstantSchema }).strict(),
]).meta({ id: "PropertyPortfolioItem" });
export const PropertyPortfolioResponseSchema = z.object({
  items: z.array(PropertyPortfolioItemSchema),
  pageInfo: z.object({ nextCursor: z.string().nullable(), hasNextPage: z.boolean() }).strict(),
}).strict().meta({ id: "PropertyPortfolioResponse" });
export type CreatePropertyRequest = z.output<typeof CreatePropertyRequestSchema>;
export type UpdatePropertyCoreInformationRequest = z.output<typeof UpdatePropertyCoreInformationRequestSchema>;
export type PropertyResponse = z.output<typeof PropertyResponseSchema>;
export type UpdatePropertyDetailsRequest = z.output<typeof UpdatePropertyDetailsRequestSchema>;
export type SetPropertyPricingRequest = z.output<typeof SetPropertyPricingRequestSchema>;
export type ListPropertiesQuery = z.output<typeof ListPropertiesQuerySchema>;
export type PropertyPortfolioResponse = z.output<typeof PropertyPortfolioResponseSchema>;
export type PropertyPhoto = z.output<typeof PropertyPhotoSchema>;
export type PropertyPhotoGalleryResponse = z.output<typeof PropertyPhotoGalleryResponseSchema>;
export type RegisterPropertyPhotoRequest = z.output<typeof RegisterPropertyPhotoRequestSchema>;
export type ReorderPropertyPhotosRequest = z.output<typeof ReorderPropertyPhotosRequestSchema>;
export type PropertyPhotoStandard = z.output<typeof PropertyPhotoStandardSchema>;
