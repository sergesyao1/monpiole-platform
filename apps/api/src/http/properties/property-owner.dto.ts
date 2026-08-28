import { createZodDto } from "nestjs-zod";
import {
  IndividualPropertyOwnerInputSchema, IndividualPropertyOwnerResponseSchema,
  LegalEntityPropertyOwnerInputSchema, LegalEntityPropertyOwnerResponseSchema,
  ListPropertyOwnersQuerySchema, PropertyOwnerDirectoryResponseSchema,
  PropertyOwnerPathSchema, PropertyOwnerTransportInputSchema,
} from "../../contracts/v1/properties/property-owner.schema.js";
import { ProblemDetailsSchema } from "../../contracts/v1/common/problem-details.schema.js";

export class IndividualPropertyOwnerInputDto extends createZodDto(IndividualPropertyOwnerInputSchema) {}
export class LegalEntityPropertyOwnerInputDto extends createZodDto(LegalEntityPropertyOwnerInputSchema) {}
export class PropertyOwnerTransportInputDto extends createZodDto(PropertyOwnerTransportInputSchema) {}
export class IndividualPropertyOwnerResponseDto extends createZodDto(IndividualPropertyOwnerResponseSchema) {}
export class LegalEntityPropertyOwnerResponseDto extends createZodDto(LegalEntityPropertyOwnerResponseSchema) {}
export class PropertyOwnerPathDto extends createZodDto(PropertyOwnerPathSchema) {}
export class PropertyOwnerProblemDetailsDto extends createZodDto(ProblemDetailsSchema) {}
export class ListPropertyOwnersQueryDto extends createZodDto(ListPropertyOwnersQuerySchema) {}
export class PropertyOwnerDirectoryResponseDto extends createZodDto(PropertyOwnerDirectoryResponseSchema) {}
