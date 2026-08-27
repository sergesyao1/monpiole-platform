import { createZodDto } from "nestjs-zod";
import { ProblemDetailsSchema } from "../../contracts/v1/common/problem-details.schema.js";
import {
  CreatePropertyRequestSchema, ListPropertiesQuerySchema, PropertyPortfolioResponseSchema,
  PropertyResponseSchema, RetrievePropertyPathSchema, UpdatePropertyDetailsRequestSchema,
} from "../../contracts/v1/properties/property.schema.js";

export class CreatePropertyRequestDto extends createZodDto(CreatePropertyRequestSchema) {}
export class PropertyResponseDto extends createZodDto(PropertyResponseSchema) {}
export class RetrievePropertyPathDto extends createZodDto(RetrievePropertyPathSchema) {}
export class PropertyProblemDetailsDto extends createZodDto(ProblemDetailsSchema) {}
export class UpdatePropertyDetailsRequestDto extends createZodDto(UpdatePropertyDetailsRequestSchema) {}
export class ListPropertiesQueryDto extends createZodDto(ListPropertiesQuerySchema) {}
export class PropertyPortfolioResponseDto extends createZodDto(PropertyPortfolioResponseSchema) {}
