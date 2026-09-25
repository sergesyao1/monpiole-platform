import type { PropertyApplicationClientConversionRepository } from "./property-application-client-conversion-repository.js";
import { authorizedTenant, type PropertyAuthority } from "./property-authority.js";

export class PropertyApplicationClientConversionNotFoundError extends Error {
  readonly code = "PROPERTY_APPLICATION_CLIENT_CONVERSION_NOT_FOUND";
}
export class PropertyApplicationClientConversionNotEligibleError extends Error {
  readonly code = "PROPERTY_APPLICATION_CLIENT_CONVERSION_NOT_ELIGIBLE";
}

export class ConvertPropertyApplicationToClient {
  constructor(
    private readonly repository: PropertyApplicationClientConversionRepository,
    private readonly identifiers: { generate(): string },
    private readonly clock: { now(): string },
  ) {}

  async execute(command: Readonly<{ authority: PropertyAuthority; propertyId: string; applicationId: string; correlationId: string }>) {
    const result = await this.repository.convert({
      tenantId: authorizedTenant(command.authority, "MANAGE_PROPERTY_APPLICATION_CLIENT_CONVERSIONS"),
      propertyId: command.propertyId,
      applicationId: command.applicationId,
      clientId: this.identifiers.generate(),
      convertedAt: this.clock.now(),
      actorId: command.authority.actorId,
      correlationId: command.correlationId,
    });
    if (result.kind === "NOT_FOUND") throw new PropertyApplicationClientConversionNotFoundError();
    if (result.kind === "NOT_ELIGIBLE") throw new PropertyApplicationClientConversionNotEligibleError();
    if (!("conversion" in result)) throw new PropertyApplicationClientConversionNotFoundError();
    return result.conversion;
  }
}

export class RetrievePropertyApplicationClientConversion {
  constructor(private readonly repository: PropertyApplicationClientConversionRepository) {}
  async execute(query: Readonly<{ authority: PropertyAuthority; propertyId: string; applicationId: string }>) {
    const result = await this.repository.find(
      authorizedTenant(query.authority, "RETRIEVE_PROPERTY_APPLICATIONS"), query.propertyId, query.applicationId,
    );
    if (result === undefined) throw new PropertyApplicationClientConversionNotFoundError();
    return result;
  }
}
