export interface PropertyApplicationClientConversionValues {
  readonly tenantId: string;
  readonly applicationId: string;
  readonly clientId: string;
  readonly convertedAt: string;
}

export class PropertyApplicationClientConversion {
  private constructor(readonly values: Readonly<PropertyApplicationClientConversionValues>) {}

  static create(values: PropertyApplicationClientConversionValues): PropertyApplicationClientConversion {
    return new PropertyApplicationClientConversion(Object.freeze({ ...values }));
  }
}
