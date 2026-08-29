import { createZodDto } from "nestjs-zod";
import { BuildingMutationSchema, BuildingPageSchema, BuildingResponseSchema, CompositionQuerySchema, CreateUnitSchema, PropertyCompositionBuildingPathSchema, PropertyCompositionPropertyPathSchema, PropertyCompositionUnitPathSchema, UnitMutationSchema, UnitPageSchema, UnitResponseSchema } from "../../contracts/v1/properties/property-composition.schema.js";
export class PropertyCompositionPropertyPathDto extends createZodDto(PropertyCompositionPropertyPathSchema) {}
export class PropertyCompositionBuildingPathDto extends createZodDto(PropertyCompositionBuildingPathSchema) {}
export class PropertyCompositionUnitPathDto extends createZodDto(PropertyCompositionUnitPathSchema) {}
export class BuildingMutationDto extends createZodDto(BuildingMutationSchema) {}
export class CreateUnitDto extends createZodDto(CreateUnitSchema) {}
export class UnitMutationDto extends createZodDto(UnitMutationSchema) {}
export class CompositionQueryDto extends createZodDto(CompositionQuerySchema) {}
export class BuildingResponseDto extends createZodDto(BuildingResponseSchema) {}
export class UnitResponseDto extends createZodDto(UnitResponseSchema) {}
export class BuildingPageDto extends createZodDto(BuildingPageSchema) {}
export class UnitPageDto extends createZodDto(UnitPageSchema) {}
