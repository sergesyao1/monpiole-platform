import { z } from "zod";

export const AgencyRegistrationStatusSchema = z.enum([
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
]);

export const AgencyRegistrationPathSchema = z.object({
  registrationId: z.string().uuid(),
}).strict();

export const AgencyRegistrationDocumentInputSchema = z.object({
  documentType: z.string().trim().min(1).max(100),
  storageKey: z.string().trim().min(1).max(1024),
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict();

export const SubmitAgencyRegistrationRequestSchema = z.object({
  agencyLegalName: z.string().trim().min(1).max(255),
  agencyTradeName: z.string().trim().min(1).max(255).optional(),
  registrationNumber: z.string().trim().min(1).max(100),
  taxIdentifier: z.string().trim().min(1).max(100).optional(),

  phone: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(320),
  website: z.string().trim().url().max(2048).optional(),

  address: z.string().trim().min(1).max(500),
  city: z.string().trim().min(1).max(150),
  countryCode: z.string().regex(/^[A-Z]{2}$/u),

  contactFirstName: z.string().trim().min(1).max(150),
  contactLastName: z.string().trim().min(1).max(150),
  contactEmail: z.string().trim().email().max(320),
  contactPhone: z.string().trim().min(1).max(50),

  documents: z
    .array(AgencyRegistrationDocumentInputSchema)
    .min(1)
    .max(20),
}).strict();

export const RejectAgencyRegistrationRequestSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(2000),
}).strict();

export const AgencyRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
  status: AgencyRegistrationStatusSchema,

  agencyLegalName: z.string(),
  agencyTradeName: z.string().optional(),
  registrationNumber: z.string(),
  taxIdentifier: z.string().optional(),

  phone: z.string(),
  email: z.string(),
  website: z.string().optional(),

  address: z.string(),
  city: z.string(),
  countryCode: z.string(),

  contactFirstName: z.string(),
  contactLastName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),

  submittedAt: z.string(),
  reviewStartedAt: z.string().optional(),
  reviewedByIdentityId: z.string().optional(),

  approvedAt: z.string().optional(),
  rejectedAt: z.string().optional(),
  rejectionReason: z.string().optional(),

  approvalProvisioningStartedAt: z.string().optional(),
  provisionedTenantId: z.string().uuid().optional(),

  correlationId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();

export const AgencyRegistrationListSchema = z.object({
  items: z.array(AgencyRegistrationSchema),
}).strict();

export const SubmitAgencyRegistrationResponseSchema = z.object({
  registrationId: z.string().uuid(),
  status: z.literal("SUBMITTED"),
  submittedAt: z.string(),
}).strict();

export type SubmitAgencyRegistrationRequest =
  z.infer<typeof SubmitAgencyRegistrationRequestSchema>;

export type RejectAgencyRegistrationRequest =
  z.infer<typeof RejectAgencyRegistrationRequestSchema>;

export type AgencyRegistrationResponse =
  z.infer<typeof AgencyRegistrationSchema>;

export type AgencyRegistrationList =
  z.infer<typeof AgencyRegistrationListSchema>;

export type SubmitAgencyRegistrationResponse =
  z.infer<typeof SubmitAgencyRegistrationResponseSchema>;
