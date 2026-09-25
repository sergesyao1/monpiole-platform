import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import {
  ConfiguredDirectPropertyAvailabilitySchema,
  PropertyAvailabilityPathSchema,
  PropertyAvailabilityResponseSchema,
  UpdatePropertyAvailabilityRequestSchema,
} from "../../contracts/v1/properties/property-availability.schema.js";

export class PropertyAvailabilityPathDto extends createZodDto(PropertyAvailabilityPathSchema) {}
export class UpdatePropertyAvailabilityRequestDto extends createZodDto(UpdatePropertyAvailabilityRequestSchema) {}
export class PropertyAvailabilityResponseDto extends createZodDto(PropertyAvailabilityResponseSchema as unknown as z.ZodObject) {}
export class ConfiguredPropertyAvailabilityResponseDto extends createZodDto(ConfiguredDirectPropertyAvailabilitySchema) {}
