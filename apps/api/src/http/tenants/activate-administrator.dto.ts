import { createZodDto } from "nestjs-zod";
import { ProblemDetailsSchema } from "../../contracts/v1/common/problem-details.schema.js";
import {
  ActivateAdministratorPathSchema,
  ActivateAdministratorResponseSchema,
} from "../../contracts/v1/tenants/activate-administrator.schema.js";

export class ActivateAdministratorPathDto extends createZodDto(ActivateAdministratorPathSchema) {}
export class ActivateAdministratorResponseDto extends createZodDto(ActivateAdministratorResponseSchema) {}
export class ActivateAdministratorProblemDetailsDto extends createZodDto(ProblemDetailsSchema) {}
