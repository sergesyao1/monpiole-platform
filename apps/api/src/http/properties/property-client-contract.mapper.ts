import type {
  CreatePropertyClientCommand, CreatePropertyContractCommand, PropertyAuthority,
  PropertyClientView, PropertyContractView, PropertyWorkspaceView, UpdatePropertyContractCommand,
} from "@monpiole/property-management";

import type {
  CreatePropertyClientRequest, CreatePropertyContractRequest, PropertyClientResponse,
  PropertyContractResponse, PropertyWorkspaceResponse, UpdatePropertyContractRequest,
} from "../../contracts/v1/properties/property-client-contract.schema.js";
import { toPropertyAvailabilityResponse } from "./property-availability.mapper.js";
import { toPropertyResponse } from "./property.mapper.js";

export function toCreatePropertyClientCommand(
  request: CreatePropertyClientRequest, correlationId: string, authority: PropertyAuthority,
): CreatePropertyClientCommand { return { ...request, correlationId, authority }; }

export function toPropertyClientResponse(client: PropertyClientView): PropertyClientResponse { return client; }

export function toCreatePropertyContractCommand(
  propertyId: string, request: CreatePropertyContractRequest, correlationId: string, authority: PropertyAuthority,
): CreatePropertyContractCommand { return { propertyId, ...request, correlationId, authority }; }

export function toUpdatePropertyContractCommand(
  propertyId: string, contractId: string, request: UpdatePropertyContractRequest,
  correlationId: string, authority: PropertyAuthority,
): UpdatePropertyContractCommand { return { propertyId, contractId, ...request, correlationId, authority }; }

export function toPropertyContractResponse(contract: PropertyContractView): PropertyContractResponse { return contract; }

export function toPropertyWorkspaceResponse(
  workspace: PropertyWorkspaceView,
  authority: PropertyAuthority,
): PropertyWorkspaceResponse {
  return {
    ...workspace,
    publicationReadiness: {
      ready: workspace.publicationReadiness.ready,
      missingRequirements: [...workspace.publicationReadiness.missingRequirements],
    },
    owners: workspace.owners.map((owner) => ({ ...owner })),
    property: toPropertyResponse(workspace.property, authority),
    availability: workspace.availability.source === "DERIVED_FROM_UNITS"
      ? toPropertyAvailabilityResponse({ ...workspace.availability, canUpdateAvailability: false })
      : toPropertyAvailabilityResponse({
          ...workspace.availability,
          canUpdateAvailability: workspace.capabilities.canUpdateAvailability,
        }),
  };
}
