import { z } from "zod";
import { ProductTenantIdSchema } from "./create-tenant.schema.js";

export const ActivateTenantPathSchema = z.object({
  tenantId: ProductTenantIdSchema,
}).strict().meta({ id: "ActivateTenantPath" });

export const ActivateTenantResponseSchema = z.object({
  tenantId: ProductTenantIdSchema,
  lifecycleState: z.literal("ACTIVE"),
  activatedAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
}).strict().meta({ id: "ActivateTenantResponse" });

export type ActivateTenantPath = z.output<typeof ActivateTenantPathSchema>;
export type ActivateTenantResponse = z.output<typeof ActivateTenantResponseSchema>;
