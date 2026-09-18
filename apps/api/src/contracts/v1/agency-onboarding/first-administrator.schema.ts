import { z } from "zod";

export const CreateFirstAgencyAdministratorPathSchema = z
  .object({
    registrationId: z.string().uuid(),
  })
  .strict();

export type CreateFirstAgencyAdministratorPath =
  z.infer<typeof CreateFirstAgencyAdministratorPathSchema>;
export const CreateFirstAgencyAdministratorRequestSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(320),
  })
  .strict();

export type CreateFirstAgencyAdministratorRequest =
  z.infer<typeof CreateFirstAgencyAdministratorRequestSchema>;

export const CreateFirstAgencyAdministratorResponseSchema = z
  .object({
    registrationId: z.string().uuid(),
    tenantId: z.string().uuid(),
    administratorId: z.string().uuid(),
    role: z.literal("TENANT_ADMINISTRATOR"),
    status: z.literal("PENDING_IDENTITY"),
    bootstrapToken: z.string().min(1).optional(),
    bootstrapTokenExpiresAt: z.string().datetime(),
  })
  .strict();

export type CreateFirstAgencyAdministratorResponse =
  z.infer<typeof CreateFirstAgencyAdministratorResponseSchema>;

export const CompleteFirstAdministratorIdentityRequestSchema = z
  .object({
    bootstrapToken: z.string().min(1),
  })
  .strict();

export type CompleteFirstAdministratorIdentityRequest =
  z.infer<typeof CompleteFirstAdministratorIdentityRequestSchema>;

export const CompleteFirstAdministratorIdentityResponseSchema = z
  .object({
    registrationId: z.string().uuid(),
    tenantId: z.string().uuid(),
    administratorId: z.string().uuid(),
    role: z.literal("TENANT_ADMINISTRATOR"),
    status: z.literal("ACTIVE"),
    identityLinkedAt: z.string().datetime(),
    activatedAt: z.string().datetime(),
  })
  .strict();

export type CompleteFirstAdministratorIdentityResponse =
  z.infer<typeof CompleteFirstAdministratorIdentityResponseSchema>;