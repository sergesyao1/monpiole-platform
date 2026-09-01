import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { ProblemDetailsSchema } from "../../contracts/v1/common/problem-details.schema.js";
import {
  PropertyGeolocationPathSchema,
  PropertyGeolocationResponseSchema,
  UpdatePropertyGeolocationRequestSchema,
} from "../../contracts/v1/properties/property-geolocation.schema.js";

export class PropertyGeolocationPathDto extends createZodDto(PropertyGeolocationPathSchema) {}
export class UpdatePropertyGeolocationRequestDto extends createZodDto(UpdatePropertyGeolocationRequestSchema) {}
export class PropertyGeolocationResponseDto extends createZodDto(PropertyGeolocationResponseSchema as unknown as z.ZodObject) {}
export class PropertyGeolocationProblemDetailsDto extends createZodDto(ProblemDetailsSchema) {}
