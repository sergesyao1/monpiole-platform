import { createZodDto } from "nestjs-zod";

import {
  RentalAvailabilityPathSchema,
  RentalAvailabilityQuerySchema,
  RentalAvailabilityResponseSchema,
  PublicRentalAvailabilityResponseSchema,
} from "../../contracts/v1/rental-availability/rental-availability.schema.js";

export class RentalAvailabilityPathDto extends createZodDto(RentalAvailabilityPathSchema) {}
export class RentalAvailabilityQueryDto extends createZodDto(RentalAvailabilityQuerySchema) {}
export class RentalAvailabilityResponseDto extends createZodDto(RentalAvailabilityResponseSchema) {}
export class PublicRentalAvailabilityResponseDto extends createZodDto(PublicRentalAvailabilityResponseSchema) {}
