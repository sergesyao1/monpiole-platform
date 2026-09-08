import { createZodDto } from "nestjs-zod";

import { ProblemDetailsSchema } from "../../contracts/v1/common/problem-details.schema.js";
import {
  ListPublicPropertiesQuerySchema,
  PublicPropertyCatalogResponseSchema,
  PublicPropertyDetailSchema,
  PublicPropertyMediaPathSchema,
  PublicPropertyPathSchema,
} from "../../contracts/v1/public-properties/public-property.schema.js";

export class ListPublicPropertiesQueryDto extends createZodDto(ListPublicPropertiesQuerySchema) {}
export class PublicPropertyCatalogResponseDto extends createZodDto(PublicPropertyCatalogResponseSchema) {}
export class PublicPropertyDetailDto extends createZodDto(PublicPropertyDetailSchema) {}
export class PublicPropertyPathDto extends createZodDto(PublicPropertyPathSchema) {}
export class PublicPropertyMediaPathDto extends createZodDto(PublicPropertyMediaPathSchema) {}
export class PublicPropertyProblemDetailsDto extends createZodDto(ProblemDetailsSchema) {}
