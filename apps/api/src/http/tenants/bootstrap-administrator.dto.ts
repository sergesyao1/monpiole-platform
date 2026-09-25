import { createZodDto } from "nestjs-zod";
import { ProblemDetailsSchema } from "../../contracts/v1/common/problem-details.schema.js";
import {
  BootstrapAdministratorPathSchema,
  BootstrapAdministratorRequestSchema,
  BootstrapAdministratorResponseSchema,
} from "../../contracts/v1/tenants/bootstrap-administrator.schema.js";

export class BootstrapAdministratorPathDto extends createZodDto(BootstrapAdministratorPathSchema) {}
export class BootstrapAdministratorRequestDto extends createZodDto(BootstrapAdministratorRequestSchema) {}
export class BootstrapAdministratorResponseDto extends createZodDto(BootstrapAdministratorResponseSchema) {}
export class BootstrapAdministratorProblemDetailsDto extends createZodDto(ProblemDetailsSchema) {}
