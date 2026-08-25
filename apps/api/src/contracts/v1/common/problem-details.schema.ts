import { z } from "zod";

import { CorrelationIdSchema } from "./context.schema.js";

export const ProblemDetailsErrorSchema = z
  .object({
    path: z.string(),
    code: z.string(),
  })
  .strict()
  .meta({ id: "ProblemDetailsError" });

export const ProblemDetailsSchema = z
  .object({
    type: z.url(),
    title: z.string(),
    status: z.int().min(400).max(599),
    detail: z.string().optional(),
    code: z.string(),
    correlationId: CorrelationIdSchema,
    errors: z.array(ProblemDetailsErrorSchema).optional(),
  })
  .strict()
  .meta({ id: "ProblemDetails" });

export type ProblemDetails = z.output<typeof ProblemDetailsSchema>;
