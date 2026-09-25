import { createZodDto } from "nestjs-zod";

import { ProblemDetailsSchema } from "../../contracts/v1/common/problem-details.schema.js";
import { CreateTenantRequestSchema, CreateTenantResponseSchema } from "../../contracts/v1/tenants/create-tenant.schema.js";

export class CreateTenantRequestDto extends createZodDto(CreateTenantRequestSchema) {}
export class CreateTenantResponseDto extends createZodDto(CreateTenantResponseSchema) {}
export class TenantProblemDetailsDto extends createZodDto(ProblemDetailsSchema) {}
