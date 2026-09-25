import { z } from "zod";
import { ProductTenantIdSchema } from "./create-tenant.schema.js";

export const ActivateAdministratorPathSchema = z.object({
  tenantId: ProductTenantIdSchema,
  administratorId: z.uuid(),
}).strict().meta({ id: "ActivateAdministratorPath" });

export const ActivateAdministratorResponseSchema = z.object({
  tenantId: ProductTenantIdSchema,
  administratorId: z.uuid(),
  email: z.email(),
  role: z.literal("TENANT_ADMINISTRATOR"),
  status: z.literal("ACTIVE"),
}).strict().meta({ id: "ActivateAdministratorResponse" });

export type ActivateAdministratorPath = z.output<typeof ActivateAdministratorPathSchema>;
export type ActivateAdministratorResponse = z.output<typeof ActivateAdministratorResponseSchema>;
