import { createZodDto } from "nestjs-zod";

import {
  ContractBaselineRequestSchema,
  ContractBaselineResponseSchema,
} from "../../contracts/v1/contract-baseline/contract-baseline.schema.js";
import { ProblemDetailsSchema } from "../../contracts/v1/common/problem-details.schema.js";

export class ContractBaselineRequestDto extends createZodDto(
  ContractBaselineRequestSchema,
) {}

export class ContractBaselineResponseDto extends createZodDto(
  ContractBaselineResponseSchema,
) {}

export class ProblemDetailsDto extends createZodDto(ProblemDetailsSchema) {}
