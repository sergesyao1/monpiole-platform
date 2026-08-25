import { createZodDto } from "nestjs-zod";

import { ProblemDetailsSchema } from "../../contracts/v1/common/problem-details.schema.js";
import { ActivateTenantPathSchema, ActivateTenantResponseSchema } from "../../contracts/v1/tenants/activate-tenant.schema.js";

export class ActivateTenantPathDto extends createZodDto(ActivateTenantPathSchema) {}
export class ActivateTenantResponseDto extends createZodDto(ActivateTenantResponseSchema) {}
export class ActivateTenantProblemDetailsDto extends createZodDto(ProblemDetailsSchema) {}
