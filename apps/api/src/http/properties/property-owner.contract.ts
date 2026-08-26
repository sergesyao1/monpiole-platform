import { getSchemaPath } from "@nestjs/swagger";
import { ZodValidationException } from "nestjs-zod";
import { z } from "zod";
import {
  CreatePropertyOwnerRequestSchema, PropertyOwnerResponseSchema, UpdatePropertyOwnerRequestSchema,
  type CreatePropertyOwnerRequest, type PropertyOwnerResponse, type UpdatePropertyOwnerRequest,
} from "../../contracts/v1/properties/property-owner.schema.js";
import {
  IndividualPropertyOwnerInputDto, IndividualPropertyOwnerResponseDto,
  LegalEntityPropertyOwnerInputDto, LegalEntityPropertyOwnerResponseDto,
} from "./property-owner.dto.js";

export const propertyOwnerInputSchema = {
  oneOf: [
    { $ref: getSchemaPath(IndividualPropertyOwnerInputDto) },
    { $ref: getSchemaPath(LegalEntityPropertyOwnerInputDto) },
  ],
  discriminator: { propertyName: "ownerType" },
};

export const propertyOwnerResponseSchema = {
  oneOf: [
    { $ref: getSchemaPath(IndividualPropertyOwnerResponseDto) },
    { $ref: getSchemaPath(LegalEntityPropertyOwnerResponseDto) },
  ],
  discriminator: { propertyName: "ownerType" },
};

export function parseCreatePropertyOwnerRequest(value: unknown): CreatePropertyOwnerRequest {
  return parse(CreatePropertyOwnerRequestSchema, value);
}
export function parseUpdatePropertyOwnerRequest(value: unknown): UpdatePropertyOwnerRequest {
  return parse(UpdatePropertyOwnerRequestSchema, value);
}
export function parsePropertyOwnerResponse(value: unknown): PropertyOwnerResponse {
  return PropertyOwnerResponseSchema.parse(value);
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ZodValidationException(result.error);
  return result.data;
}
