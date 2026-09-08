import { z } from "zod";

import { PropertyAvailabilityResponseSchema } from "./property-availability.schema.js";
import { PropertyIdSchema, PropertyResponseSchema } from "./property.schema.js";

const InstantSchema = z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z"));
const CalendarDateSchema = z.iso.date();

export const PropertyClientIdSchema = z.uuid().meta({ id: "PropertyClientId" });
export const PropertyContractIdSchema = z.uuid().meta({ id: "PropertyContractId" });
export const PropertyContractTypeSchema = z.enum(["LEASE", "MANAGEMENT", "OTHER"]);
export const PropertyContractStatusSchema = z.enum(["DRAFT", "ACTIVE", "ENDED", "CANCELLED"]);
const PropertyContractReferenceSchema = z.string().trim().min(1).max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/ -]{0,99}$/u);

export const CreatePropertyClientRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  email: z.email().max(320).transform((value) => value.toLowerCase()).optional(),
  phoneNumber: z.string().trim().min(1).max(100).optional(),
}).strict().meta({ id: "CreatePropertyClientRequest" });

export const PropertyClientResponseSchema = CreatePropertyClientRequestSchema.extend({
  clientId: PropertyClientIdSchema,
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
}).strict().meta({ id: "PropertyClientResponse" });

export const PropertyClientPathSchema = z.object({ clientId: PropertyClientIdSchema })
  .strict().meta({ id: "PropertyClientPath" });
export const ListPropertyClientsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(512).optional(),
  search: z.string().trim().min(1).max(100).optional(),
}).strict().meta({ id: "ListPropertyClientsQuery" });
export const PropertyClientDirectoryResponseSchema = z.object({
  items: z.array(PropertyClientResponseSchema),
  pageInfo: z.object({ nextCursor: z.string().nullable(), hasNextPage: z.boolean() }).strict(),
  canCreateClient: z.boolean(),
}).strict().meta({ id: "PropertyClientDirectoryResponse" });

const PropertyContractTermsShape = {
  clientId: PropertyClientIdSchema,
  contractType: PropertyContractTypeSchema,
  reference: PropertyContractReferenceSchema,
  startDate: CalendarDateSchema.optional(),
  endDate: CalendarDateSchema.optional(),
  notes: z.string().trim().min(1).max(5_000).optional(),
};

export const CreatePropertyContractRequestSchema = z.object(PropertyContractTermsShape).strict()
  .refine((value) => value.startDate === undefined || value.endDate === undefined || value.endDate >= value.startDate, {
    path: ["endDate"], message: "End date must not precede start date",
  }).meta({ id: "CreatePropertyContractRequest" });
export const UpdatePropertyContractRequestSchema = z.object(PropertyContractTermsShape).strict()
  .refine((value) => value.startDate === undefined || value.endDate === undefined || value.endDate >= value.startDate, {
    path: ["endDate"], message: "End date must not precede start date",
  }).meta({ id: "UpdatePropertyContractRequest" });
export const EndPropertyContractRequestSchema = z.object({ endDate: CalendarDateSchema }).strict()
  .meta({ id: "EndPropertyContractRequest" });

export const PropertyContractsPathSchema = z.object({ propertyId: PropertyIdSchema })
  .strict().meta({ id: "PropertyContractsPath" });
export const PropertyContractPathSchema = z.object({
  propertyId: PropertyIdSchema,
  contractId: PropertyContractIdSchema,
}).strict().meta({ id: "PropertyContractPath" });
export const ListPropertyContractsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(512).optional(),
}).strict().meta({ id: "ListPropertyContractsQuery" });

export const PropertyContractResponseSchema = z.object({
  contractId: PropertyContractIdSchema,
  propertyId: PropertyIdSchema,
  contractType: PropertyContractTypeSchema,
  status: PropertyContractStatusSchema,
  reference: z.string(),
  startDate: CalendarDateSchema.optional(),
  endDate: CalendarDateSchema.optional(),
  notes: z.string().optional(),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
  activatedAt: InstantSchema.optional(),
  endedAt: InstantSchema.optional(),
  cancelledAt: InstantSchema.optional(),
  client: z.object({
    clientId: PropertyClientIdSchema,
    displayName: z.string(),
    email: z.string().optional(),
    phoneNumber: z.string().optional(),
  }).strict(),
  capabilities: z.object({
    canUpdate: z.boolean(), canActivate: z.boolean(), canEnd: z.boolean(), canCancel: z.boolean(),
  }).strict(),
}).strict().meta({ id: "PropertyContractResponse" });

export const PropertyContractDirectoryResponseSchema = z.object({
  items: z.array(PropertyContractResponseSchema),
  pageInfo: z.object({ nextCursor: z.string().nullable(), hasNextPage: z.boolean() }).strict(),
  canCreateContract: z.boolean(),
}).strict().meta({ id: "PropertyContractDirectoryResponse" });

const NonNegativeCountSchema = z.number().int().nonnegative();
export const PropertyWorkspaceResponseSchema = z.object({
  property: PropertyResponseSchema,
  availability: PropertyAvailabilityResponseSchema,
  publicationReadiness: z.object({
    ready: z.boolean(),
    missingRequirements: z.array(z.enum([
      "DETAILS", "COMMERCIAL_TERMS", "APARTMENT_SUBTYPE", "PRIMARY_PHOTO", "PHOTO_MINIMUM", "PHOTO_REQUIRED_VIEWS",
    ])),
  }).strict(),
  owners: z.array(z.object({
    ownerId: z.uuid(), displayName: z.string(), ownershipShare: z.number().positive().max(100),
  }).strict()),
  composition: z.object({ buildingCount: NonNegativeCountSchema, unitCount: NonNegativeCountSchema }).strict(),
  contracts: z.object({
    totalCount: NonNegativeCountSchema, draftCount: NonNegativeCountSchema, activeCount: NonNegativeCountSchema,
    endedCount: NonNegativeCountSchema, cancelledCount: NonNegativeCountSchema,
  }).strict(),
  capabilities: z.object({
    canUpdateCoreInformation: z.boolean(), canUpdateDetails: z.boolean(), canUpdatePricing: z.boolean(),
    canUpdateAvailability: z.boolean(), canManagePhotos: z.boolean(), canPublish: z.boolean(),
    canWithdrawFromCatalog: z.boolean(), canManageOwners: z.boolean(), canManageComposition: z.boolean(),
    canViewContracts: z.boolean(), canCreateContract: z.boolean(),
  }).strict(),
}).strict().meta({ id: "PropertyWorkspaceResponse" });

export type CreatePropertyClientRequest = z.output<typeof CreatePropertyClientRequestSchema>;
export type PropertyClientResponse = z.output<typeof PropertyClientResponseSchema>;
export type ListPropertyClientsQuery = z.output<typeof ListPropertyClientsQuerySchema>;
export type PropertyClientDirectoryResponse = z.output<typeof PropertyClientDirectoryResponseSchema>;
export type CreatePropertyContractRequest = z.output<typeof CreatePropertyContractRequestSchema>;
export type UpdatePropertyContractRequest = z.output<typeof UpdatePropertyContractRequestSchema>;
export type EndPropertyContractRequest = z.output<typeof EndPropertyContractRequestSchema>;
export type ListPropertyContractsQuery = z.output<typeof ListPropertyContractsQuerySchema>;
export type PropertyContractResponse = z.output<typeof PropertyContractResponseSchema>;
export type PropertyContractDirectoryResponse = z.output<typeof PropertyContractDirectoryResponseSchema>;
export type PropertyWorkspaceResponse = z.output<typeof PropertyWorkspaceResponseSchema>;
