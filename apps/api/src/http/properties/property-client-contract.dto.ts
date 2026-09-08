import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import {
  CreatePropertyClientRequestSchema, CreatePropertyContractRequestSchema, EndPropertyContractRequestSchema,
  ListPropertyClientsQuerySchema, ListPropertyContractsQuerySchema, PropertyClientDirectoryResponseSchema,
  PropertyClientPathSchema, PropertyClientResponseSchema, PropertyContractDirectoryResponseSchema,
  PropertyContractPathSchema, PropertyContractResponseSchema, PropertyContractsPathSchema,
  PropertyWorkspaceResponseSchema, UpdatePropertyContractRequestSchema,
} from "../../contracts/v1/properties/property-client-contract.schema.js";

export class CreatePropertyClientRequestDto extends createZodDto(CreatePropertyClientRequestSchema) {}
export class PropertyClientResponseDto extends createZodDto(PropertyClientResponseSchema) {}
export class PropertyClientPathDto extends createZodDto(PropertyClientPathSchema) {}
export class ListPropertyClientsQueryDto extends createZodDto(ListPropertyClientsQuerySchema) {}
export class PropertyClientDirectoryResponseDto extends createZodDto(PropertyClientDirectoryResponseSchema) {}
export class CreatePropertyContractRequestDto extends createZodDto(CreatePropertyContractRequestSchema) {}
export class UpdatePropertyContractRequestDto extends createZodDto(UpdatePropertyContractRequestSchema) {}
export class EndPropertyContractRequestDto extends createZodDto(EndPropertyContractRequestSchema) {}
export class PropertyContractsPathDto extends createZodDto(PropertyContractsPathSchema) {}
export class PropertyContractPathDto extends createZodDto(PropertyContractPathSchema) {}
export class ListPropertyContractsQueryDto extends createZodDto(ListPropertyContractsQuerySchema) {}
export class PropertyContractResponseDto extends createZodDto(PropertyContractResponseSchema) {}
export class PropertyContractDirectoryResponseDto extends createZodDto(PropertyContractDirectoryResponseSchema) {}
export class PropertyWorkspaceResponseDto extends createZodDto(PropertyWorkspaceResponseSchema as unknown as z.ZodObject) {}
