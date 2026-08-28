import { createZodDto } from "nestjs-zod";
import { BuildingMutationSchema, BuildingPageSchema, BuildingResponseSchema, CompositionPathSchema, CompositionQuerySchema, CreateUnitSchema, UnitMutationSchema, UnitPageSchema, UnitResponseSchema } from "../../contracts/v1/properties/property-composition.schema.js";
export class CompositionPathDto extends createZodDto(CompositionPathSchema) {}
export class BuildingMutationDto extends createZodDto(BuildingMutationSchema) {}
export class CreateUnitDto extends createZodDto(CreateUnitSchema) {}
export class UnitMutationDto extends createZodDto(UnitMutationSchema) {}
export class CompositionQueryDto extends createZodDto(CompositionQuerySchema) {}
export class BuildingResponseDto extends createZodDto(BuildingResponseSchema) {}
export class UnitResponseDto extends createZodDto(UnitResponseSchema) {}
export class BuildingPageDto extends createZodDto(BuildingPageSchema) {}
export class UnitPageDto extends createZodDto(UnitPageSchema) {}
