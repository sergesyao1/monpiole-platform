const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STRUCTURAL_CODE = /^[A-Z0-9][A-Z0-9._/ -]{0,49}$/u;

export interface PropertyBuildingValues {
  readonly buildingId: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly buildingCode: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class InvalidPropertyCompositionInputError extends Error {
  readonly code = "INVALID_PROPERTY_COMPOSITION_INPUT";
  constructor(readonly field: string) { super(`Invalid property composition ${field}`); }
}
export class InvalidPropertyCompositionServerValueError extends Error {
  constructor(readonly field: string) { super(`Invalid property composition server ${field}`); }
}

export function normalizeStructuralCode(value: string, field: "buildingCode" | "unitCode"): string {
  const normalized = value.trim().toUpperCase();
  if (!STRUCTURAL_CODE.test(normalized)) throw new InvalidPropertyCompositionInputError(field);
  return normalized;
}

function rehydrateStructuralCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!STRUCTURAL_CODE.test(normalized) || normalized !== value) {
    throw new InvalidPropertyCompositionServerValueError("structuralCode");
  }
  return normalized;
}

export class PropertyBuilding {
  private constructor(readonly values: Readonly<PropertyBuildingValues>) {}

  static create(input: PropertyBuildingValues): PropertyBuilding { return new PropertyBuilding(validate(input, true)); }
  static rehydrate(input: PropertyBuildingValues): PropertyBuilding { return new PropertyBuilding(validate(input, false)); }

  update(input: Readonly<{ buildingCode: string; name: string; updatedAt: string }>): PropertyBuilding {
    return PropertyBuilding.create({ ...this.values, ...input });
  }
}

function validate(input: PropertyBuildingValues, clientFields: boolean): Readonly<PropertyBuildingValues> {
  for (const field of ["buildingId", "tenantId", "propertyId"] as const) {
    if (!UUID_V4.test(input[field])) throw new InvalidPropertyCompositionServerValueError(field);
  }
  const buildingCode = clientFields
    ? normalizeStructuralCode(input.buildingCode, "buildingCode")
    : rehydrateStructuralCode(input.buildingCode);
  const name = input.name.trim();
  if (name.length === 0 || name.length > 200) {
    if (clientFields) throw new InvalidPropertyCompositionInputError("name");
    throw new InvalidPropertyCompositionServerValueError("name");
  }
  for (const field of ["createdAt", "updatedAt"] as const) {
    if (!input[field].endsWith("Z") || !Number.isFinite(Date.parse(input[field]))) {
      throw new InvalidPropertyCompositionServerValueError(field);
    }
  }
  return Object.freeze({ ...input, buildingCode, name });
}
