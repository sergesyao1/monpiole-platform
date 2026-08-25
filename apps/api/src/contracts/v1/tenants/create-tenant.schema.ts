import { z } from "zod";

export const ProductTenantIdSchema = z.uuid().meta({ id: "ProductTenantId" });

export const CreateTenantRequestSchema = z.object({
  organizationName: z.string().trim().min(1),
  responsiblePersonName: z.string().trim().min(1),
  responsibleEmail: z.string().trim().toLowerCase().check(z.email()),
  responsibleTelephone: z.string().regex(/^\+[1-9][0-9]{1,14}$/),
  country: z.string().regex(/^[A-Z]{2}$/),
}).strict().meta({ id: "CreateTenantRequest" });

export const CreateTenantResponseSchema = z.object({
  tenantId: ProductTenantIdSchema,
  lifecycleState: z.literal("PENDING"),
}).strict().meta({ id: "CreateTenantResponse" });

export type CreateTenantRequest = z.output<typeof CreateTenantRequestSchema>;
export type CreateTenantResponse = z.output<typeof CreateTenantResponseSchema>;
