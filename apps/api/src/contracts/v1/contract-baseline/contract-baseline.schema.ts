import { z } from "zod";

import {
  CorrelationIdSchema,
  IdempotencyKeySchema,
  RequestIdSchema,
  TenantIdSchema,
} from "../common/context.schema.js";

export const ContractBaselineRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(100),
  })
  .strict()
  .meta({ id: "ContractBaselineRequest" });

export const ContractBaselineResponseSchema = z
  .object({
    message: z.string().min(1).max(100),
    context: z
      .object({
        tenantId: TenantIdSchema,
        correlationId: CorrelationIdSchema,
        requestId: RequestIdSchema,
        idempotencyKey: IdempotencyKeySchema,
      })
      .strict(),
  })
  .strict()
  .meta({ id: "ContractBaselineResponse" });

export type ContractBaselineRequest = z.output<
  typeof ContractBaselineRequestSchema
>;

export type ContractBaselineResponse = z.output<
  typeof ContractBaselineResponseSchema
>;
