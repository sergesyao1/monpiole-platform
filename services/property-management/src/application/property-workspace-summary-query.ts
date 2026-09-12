export interface PropertyWorkspaceOwnerSummary {
  readonly ownerId: string;
  readonly displayName: string;
  readonly ownershipShare: number;
}

export interface PropertyWorkspaceCompositionSummary {
  readonly buildingCount: number;
  readonly unitCount: number;
  readonly directChildCount?: number;
  readonly parentComplex?: Readonly<{ propertyId: string; title: string }>;
  readonly parentBuilding?: Readonly<{
    buildingId: string;
    buildingCode: string;
    buildingName: string;
    parentBuildingCommercializationMode?: "WHOLE_BUILDING" | "INDIVIDUAL_UNITS";
    parentPropertyId: string;
    parentPropertyTitle: string;
  }>;
}

export interface PropertyWorkspaceContractSummary {
  readonly totalCount: number;
  readonly draftCount: number;
  readonly activeCount: number;
  readonly endedCount: number;
  readonly cancelledCount: number;
}

export interface PropertyWorkspaceSummary {
  readonly owners: readonly PropertyWorkspaceOwnerSummary[];
  readonly composition: PropertyWorkspaceCompositionSummary;
  readonly contracts: PropertyWorkspaceContractSummary;
}

export interface PropertyWorkspaceSummaryQuery {
  retrieve(tenantId: string, propertyId: string): Promise<PropertyWorkspaceSummary | undefined>;
}
