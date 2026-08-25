import { z } from "zod";

export const TenantIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]{2,63}$/)
  .meta({ id: "TenantId" });

export const CorrelationIdSchema = z.uuid().meta({ id: "CorrelationId" });

export const RequestIdSchema = z.uuid().meta({ id: "RequestId" });

export const IdempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9._~:+-]{1,255}$/)
  .meta({ id: "IdempotencyKey" });
