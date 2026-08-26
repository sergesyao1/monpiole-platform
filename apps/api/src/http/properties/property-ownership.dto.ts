import { createZodDto } from "nestjs-zod";
import { ProblemDetailsSchema } from "../../contracts/v1/common/problem-details.schema.js";
import {
  AssignPropertyOwnerRequestSchema, PropertyOwnershipListResponseSchema,
  PropertyOwnershipPathSchema, PropertyOwnershipPropertyPathSchema, PropertyOwnershipResponseSchema,
} from "../../contracts/v1/properties/property-ownership.schema.js";

export class AssignPropertyOwnerRequestDto extends createZodDto(AssignPropertyOwnerRequestSchema) {}
export class PropertyOwnershipResponseDto extends createZodDto(PropertyOwnershipResponseSchema) {}
export class PropertyOwnershipListResponseDto extends createZodDto(PropertyOwnershipListResponseSchema) {}
export class PropertyOwnershipPropertyPathDto extends createZodDto(PropertyOwnershipPropertyPathSchema) {}
export class PropertyOwnershipPathDto extends createZodDto(PropertyOwnershipPathSchema) {}
export class PropertyOwnershipProblemDetailsDto extends createZodDto(ProblemDetailsSchema) {}
