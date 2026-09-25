import { type Property } from "./property.js";
import {
  InvalidPropertyCompositionInputError,
  InvalidPropertyCompositionServerValueError,
  normalizeStructuralCode,
} from "./property-building.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CANONICAL_STRUCTURAL_CODE = /^[A-Z0-9][A-Z0-9._/ -]{0,49}$/u;

export interface PropertyBuildingUnitValues {
  readonly tenantId: string;
  readonly buildingId: string;
  readonly unitPropertyId: string;
  readonly unitCode: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class PropertyBuildingUnit {
  private constructor(readonly values: Readonly<PropertyBuildingUnitValues>) {}

  static create(input: PropertyBuildingUnitValues, unit: Property): PropertyBuildingUnit {
    return new PropertyBuildingUnit(validate(input, unit, true));
  }

  static rehydrate(input: PropertyBuildingUnitValues, unit: Property): PropertyBuildingUnit {
    return new PropertyBuildingUnit(validate(input, unit, false));
  }

  updateCode(unitCode: string, updatedAt: string): PropertyBuildingUnit {
    if (!updatedAt.endsWith("Z") || !Number.isFinite(Date.parse(updatedAt))) {
      throw new InvalidPropertyCompositionServerValueError("updatedAt");
    }
    return new PropertyBuildingUnit(Object.freeze({
      ...this.values,
      unitCode: normalizeStructuralCode(unitCode, "unitCode"),
      updatedAt,
    }));
  }
}

function validate(
  input: PropertyBuildingUnitValues,
  unit: Property,
  clientCode: boolean,
): Readonly<PropertyBuildingUnitValues> {
  for (const field of ["tenantId", "buildingId", "unitPropertyId"] as const) {
    if (!UUID_V4.test(input[field])) throw new InvalidPropertyCompositionServerValueError(field);
  }
  if (unit.values.structuralRole !== "UNIT") {
    throw new InvalidPropertyCompositionServerValueError("unitProperty.structuralRole");
  }
  if (unit.values.tenantId !== input.tenantId) {
    throw new InvalidPropertyCompositionServerValueError("unitProperty.tenantId");
  }
  if (unit.values.propertyId !== input.unitPropertyId) {
    throw new InvalidPropertyCompositionServerValueError("unitProperty.propertyId");
  }
  const unitCode = clientCode ? normalizeStructuralCode(input.unitCode, "unitCode") : rehydrateCode(input.unitCode);
  for (const field of ["createdAt", "updatedAt"] as const) {
    if (!input[field].endsWith("Z") || !Number.isFinite(Date.parse(input[field]))) {
      throw new InvalidPropertyCompositionServerValueError(field);
    }
  }
  return Object.freeze({ ...input, unitCode });
}

function rehydrateCode(value: string): string {
  if (!CANONICAL_STRUCTURAL_CODE.test(value)) {
    throw new InvalidPropertyCompositionServerValueError("unitCode");
  }
  return value;
}
