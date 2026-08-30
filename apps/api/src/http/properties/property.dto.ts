import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ProblemDetailsSchema } from "../../contracts/v1/common/problem-details.schema.js";
import {
  CreatePropertyRequestSchema, ListPropertiesQuerySchema, PropertyPortfolioResponseSchema,
  PropertyResponseSchema, RetrievePropertyPathSchema, UpdatePropertyCoreInformationRequestSchema, UpdatePropertyDetailsRequestSchema,
  PropertyPhotoGalleryResponseSchema, PropertyPhotoPathSchema, PropertyPhotoStandardSchema, RegisterPropertyPhotoRequestSchema,
} from "../../contracts/v1/properties/property.schema.js";

export class CreatePropertyRequestDto extends createZodDto(CreatePropertyRequestSchema) {}
export class PropertyResponseDto extends createZodDto(PropertyResponseSchema as unknown as z.ZodObject) {}
export class RetrievePropertyPathDto extends createZodDto(RetrievePropertyPathSchema) {}
export class PropertyProblemDetailsDto extends createZodDto(ProblemDetailsSchema) {}
export class UpdatePropertyDetailsRequestDto extends createZodDto(UpdatePropertyDetailsRequestSchema) {}
export class UpdatePropertyCoreInformationRequestDto extends createZodDto(UpdatePropertyCoreInformationRequestSchema) {}
export class ListPropertiesQueryDto extends createZodDto(ListPropertiesQuerySchema) {}
export class PropertyPortfolioResponseDto extends createZodDto(PropertyPortfolioResponseSchema) {}
export class PropertyPhotoGalleryResponseDto extends createZodDto(PropertyPhotoGalleryResponseSchema) {}
export class PropertyPhotoPathDto extends createZodDto(PropertyPhotoPathSchema) {}
export class RegisterPropertyPhotoRequestDto extends createZodDto(RegisterPropertyPhotoRequestSchema) {}
export class PropertyPhotoStandardDto extends createZodDto(PropertyPhotoStandardSchema) {}
