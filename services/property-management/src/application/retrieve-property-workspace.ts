import type { PropertyView } from "./create-property.js";
import type { PropertyAuthority } from "./property-authority.js";
import { authorizedTenant } from "./property-authority.js";
import type { PropertyAvailabilityQuery, PropertyAvailabilityReadModel } from "./property-availability-query.js";
import type { PropertyPhotoStandardRepository } from "./property-photo-standard-repository.js";
import type { PropertyRepository } from "./property-repository.js";
import type { PropertyContractRepository } from "./property-contract-repository.js";
import type { PropertyLeaseEligibility } from "../domain/property-contract.js";
import type { PropertyWorkspaceSummary, PropertyWorkspaceSummaryQuery } from "./property-workspace-summary-query.js";
import { PropertyNotFoundError } from "./retrieve-property.js";
import type { PropertyPublicationReadiness } from "../domain/property.js";

export interface PropertyWorkspaceCapabilities {
  readonly isCommercialTarget: boolean;
  readonly canUpdateCoreInformation: boolean;
  readonly canUpdateDetails: boolean;
  readonly canUpdatePricing: boolean;
  readonly canUpdateAvailability: boolean;
  readonly canManagePhotos: boolean;
  readonly canPublish: boolean;
  readonly canWithdrawFromCatalog: boolean;
  readonly canManageOwners: boolean;
  readonly canManageComposition: boolean;
  readonly canViewContracts: boolean;
  readonly canCreateContract: boolean;
}

export interface PropertyWorkspaceView {
  readonly property: PropertyView;
  readonly availability: PropertyAvailabilityReadModel;
  readonly publicationReadiness: PropertyPublicationReadiness;
  readonly owners: PropertyWorkspaceSummary["owners"];
  readonly composition: PropertyWorkspaceSummary["composition"];
  readonly contracts: PropertyWorkspaceSummary["contracts"];
  readonly leaseEligibility: PropertyLeaseEligibility;
  readonly capabilities: PropertyWorkspaceCapabilities;
}

export interface RetrievePropertyWorkspaceQuery {
  readonly authority: PropertyAuthority;
  readonly propertyId: string;
}

export class RetrievePropertyWorkspace {
  constructor(
    private readonly properties: PropertyRepository,
    private readonly availability: PropertyAvailabilityQuery,
    private readonly photoStandards: PropertyPhotoStandardRepository,
    private readonly summaries: PropertyWorkspaceSummaryQuery,
    private readonly contracts: Pick<PropertyContractRepository, "assessLeaseTarget">,
  ) {}

  async execute(query: RetrievePropertyWorkspaceQuery): Promise<PropertyWorkspaceView> {
    const tenantId = authorizedTenant(query.authority, "RETRIEVE_PROPERTY_WORKSPACE");
    const [property, availability, standard, summary, leaseTarget] = await Promise.all([
      this.properties.findById(tenantId, query.propertyId),
      this.availability.retrieve(tenantId, query.propertyId),
      this.photoStandards.retrieve(tenantId),
      this.summaries.retrieve(tenantId, query.propertyId),
      this.contracts.assessLeaseTarget(tenantId, query.propertyId),
    ]);
    if (property === undefined || availability === undefined || summary === undefined || leaseTarget === undefined) {
      throw new PropertyNotFoundError();
    }
    const baseReadiness = property.assessPublicationReadiness(property.values.photos ?? [], standard);
    const blockedByWholeBuilding = property.values.structuralRole === "UNIT"
      && summary.composition.parentBuilding?.parentBuildingCommercializationMode === "WHOLE_BUILDING";
    const publicationReadiness = blockedByWholeBuilding
      ? { ...baseReadiness, ready: false, missingRequirements: [...new Set([...baseReadiness.missingRequirements, "COMMERCIAL_TARGET" as const])] }
      : baseReadiness;
    return {
      property: property.values,
      availability,
      publicationReadiness,
      ...summary,
      leaseEligibility: leaseTarget.eligibility,
    capabilities: capabilities(query.authority, property.values.status, availability.source, publicationReadiness.ready,
        !publicationReadiness.missingRequirements.includes("COMMERCIAL_TARGET")),
    };
  }
}

function capabilities(
  authority: PropertyAuthority,
  status: PropertyView["status"],
  availabilitySource: PropertyAvailabilityReadModel["source"],
  readyForPublication: boolean,
  isCommercialTarget: boolean,
): PropertyWorkspaceCapabilities {
  const has = (grant: PropertyAuthority["grants"][number]) => authority.grants.includes(grant);
  return {
    isCommercialTarget,
    canUpdateCoreInformation: has("UPDATE_PROPERTY_CORE_INFORMATION"),
    canUpdateDetails: has("UPDATE_PROPERTY_DETAILS"),
    canUpdatePricing: isCommercialTarget && has("UPDATE_PROPERTY_PRICING"),
    canUpdateAvailability: availabilitySource === "DIRECT" && has("UPDATE_PROPERTY_AVAILABILITY"),
    canManagePhotos: has("CREATE_PROPERTY_PHOTO") || has("DELETE_PROPERTY_PHOTO")
      || has("REORDER_PROPERTY_PHOTOS") || has("SELECT_PROPERTY_PRIMARY_PHOTO"),
    canPublish: status === "DRAFT" && readyForPublication && has("PUBLISH_PROPERTY"),
    canWithdrawFromCatalog: status === "PUBLISHED" && has("WITHDRAW_PROPERTY_FROM_CATALOG"),
    canManageOwners: has("ASSIGN_PROPERTY_OWNER") || has("REMOVE_PROPERTY_OWNER"),
    canManageComposition: has("CREATE_PROPERTY_BUILDING") || has("UPDATE_PROPERTY_BUILDING")
      || has("CREATE_PROPERTY_UNIT") || has("UPDATE_PROPERTY_UNIT_STRUCTURE"),
    canViewContracts: has("RETRIEVE_PROPERTY_CONTRACTS"),
    canCreateContract: has("CREATE_PROPERTY_CONTRACT"),
  };
}
