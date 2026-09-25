import { z } from "zod";
import { ProductTenantIdSchema } from "./create-tenant.schema.js";

export const BootstrapAdministratorPathSchema = z.object({
  tenantId: ProductTenantIdSchema,
}).strict().meta({ id: "BootstrapAdministratorPath" });

export const BootstrapAdministratorRequestSchema = z.object({
  email: z.string().trim().toLowerCase().check(z.email()),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
}).strict().meta({ id: "BootstrapAdministratorRequest" });

export const BootstrapAdministratorResponseSchema = z.object({
  tenantId: ProductTenantIdSchema,
  administratorId: z.uuid(),
  email: z.email(),
  role: z.literal("TENANT_ADMINISTRATOR"),
  status: z.literal("PENDING_ACTIVATION"),
}).strict().meta({ id: "BootstrapAdministratorResponse" });

export type BootstrapAdministratorPath = z.output<typeof BootstrapAdministratorPathSchema>;
export type BootstrapAdministratorRequest = z.output<typeof BootstrapAdministratorRequestSchema>;
export type BootstrapAdministratorResponse = z.output<typeof BootstrapAdministratorResponseSchema>;
