export const propertyTypes = ["APARTMENT", "HOUSE", "LAND", "COMMERCIAL", "OTHER"] as const;
export type PropertyType = typeof propertyTypes[number];

export const transactionTypes = ["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "SALE"] as const;
export type TransactionType = typeof transactionTypes[number];
export type ApartmentSubtype = "STUDIO" | "MULTI_ROOM";
export type PropertyStatus = "DRAFT" | "PUBLISHED" | "WITHDRAWN";
export type PropertyStructuralRole = "STANDALONE" | "COMPOSITE" | "UNIT";
export type PropertyGeolocationPublicVisibility = "EXACT" | "APPROXIMATE" | "HIDDEN";
export type PropertyAvailabilityStatus = "AVAILABLE" | "UNAVAILABLE";
export type PropertyOccupancyStatus = "VACANT" | "OCCUPIED";
export type PricingUnit = "NIGHT" | "WEEK";
export type AmenityCategory = "COMFORT" | "KITCHEN" | "CONNECTIVITY" | "ENERGY_WATER" | "SECURITY" | "BUILDING" | "OUTDOOR" | "SERVICES";
export interface Amenity { readonly code: string; readonly category: AmenityCategory; readonly labelFr: string; readonly displayOrder: number; }
export type PropertyPhotoCategory =
  | "BUILDING_EXTERIOR_OR_ENTRANCE"
  | "MAIN_LIVING_SLEEPING_AREA"
  | "LIVING_ROOM_OR_MAIN_ROOM"
  | "KITCHEN_OR_KITCHENETTE"
  | "BEDROOM_OR_SLEEPING_AREA"
  | "BATHROOM_OR_SHOWER_ROOM"
  | "OTHER";

export interface PropertyPhoto {
  readonly photoId: string;
  readonly mediaKind: "IMAGE";
  readonly position: number;
  readonly category: PropertyPhotoCategory;
  readonly status: "AVAILABLE";
  readonly contentPath: `/v1/${string}`;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly contentByteSize: number;
  readonly contentSha256: string;
  readonly isPrimary: boolean;
  readonly registeredAt: string;
  readonly availableAt: string;
}

export const propertyPhotoCategoryLabels: Readonly<Record<PropertyPhotoCategory, string>> = {
  BUILDING_EXTERIOR_OR_ENTRANCE: "Façade ou entrée de l’immeuble",
  MAIN_LIVING_SLEEPING_AREA: "Pièce principale — vie et nuit",
  LIVING_ROOM_OR_MAIN_ROOM: "Séjour ou pièce principale",
  KITCHEN_OR_KITCHENETTE: "Cuisine ou kitchenette",
  BEDROOM_OR_SLEEPING_AREA: "Chambre ou espace nuit",
  BATHROOM_OR_SHOWER_ROOM: "Salle d’eau ou salle de bain",
  OTHER: "Autre vue",
};

export const propertyTypeLabels: Readonly<Record<PropertyType, string>> = {
  APARTMENT: "Appartement",
  HOUSE: "Maison",
  LAND: "Terrain",
  COMMERCIAL: "Local commercial",
  OTHER: "Autre",
};

export const transactionTypeLabels: Readonly<Record<TransactionType, string>> = {
  LONG_TERM_RENTAL: "Location longue durée",
  SHORT_TERM_RENTAL: "Location courte durée",
  SALE: "Vente",
};

export const propertyStatusLabels: Readonly<Record<PropertyStatus, string>> = { DRAFT: "Brouillon", PUBLISHED: "Publié", WITHDRAWN: "Retiré du catalogue" };
export const propertyStructuralRoleLabels: Readonly<Record<PropertyStructuralRole, string>> = { STANDALONE: "Bien autonome", COMPOSITE: "Ensemble immobilier", UNIT: "Unité" };
export const propertyGeolocationPublicVisibilityLabels: Readonly<Record<PropertyGeolocationPublicVisibility, string>> = {
  EXACT: "Position exacte",
  APPROXIMATE: "Position approximative",
  HIDDEN: "Masquer la position",
};
export const pricingUnitLabels: Readonly<Record<PricingUnit | "MONTH", string>> = {
  MONTH: "Mensuel",
  NIGHT: "Nuit",
  WEEK: "Semaine",
};

export interface PropertyLocation {
  readonly country: string;
  readonly city: string;
  readonly district: string;
  readonly addressLine: string;
}

export interface PropertyDetails {
  readonly usableSurfaceSquareMeters?: number;
  readonly rooms?: number;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly furnished?: boolean;
}

export type CommercialTerms =
  | Readonly<{ kind: "LONG_TERM_RENTAL"; currency: string; rentAmountMinor: number; rentPeriod: "MONTH"; securityDepositAmountMinor?: number; chargesAmountMinor?: number; agencyFeeAmountMinor?: number }>
  | Readonly<{ kind: "SHORT_TERM_RENTAL"; currency: string; rateAmountMinor: number; pricingUnit: PricingUnit; cleaningFeeAmountMinor?: number; securityDepositAmountMinor?: number; minimumStayNights?: number }>
  | Readonly<{ kind: "SALE"; currency: string; salePriceAmountMinor: number; agencyFeeAmountMinor?: number }>;

export type PropertyPricingInput = CommercialTerms & Readonly<{ currency: "XOF" }>;

interface PropertyBase {
  readonly propertyId: string;
  readonly title: string;
  readonly description?: string;
  readonly propertyType: PropertyType;
  readonly transactionType: TransactionType;
  readonly apartmentSubtype?: ApartmentSubtype;
  readonly structuralRole: PropertyStructuralRole;
  readonly location: PropertyLocation;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly details?: PropertyDetails;
  readonly commercialTerms?: CommercialTerms;
  readonly photos?: readonly PropertyPhoto[];
  readonly primaryPhoto?: PropertyPhoto;
}

export type Property = Readonly<PropertyBase & (
  | { readonly status: "DRAFT"; readonly publishedAt?: never; readonly withdrawnAt?: never; readonly canWithdrawFromCatalog: false }
  | { readonly status: "PUBLISHED"; readonly publishedAt: string; readonly withdrawnAt?: never; readonly canWithdrawFromCatalog: boolean }
  | { readonly status: "WITHDRAWN"; readonly publishedAt: string; readonly withdrawnAt: string; readonly canWithdrawFromCatalog: false }
)>;

export type PropertyPortfolioItem = Property extends infer Value
  ? Value extends Property ? Omit<Value, "details" | "commercialTerms" | "photos" | "primaryPhoto" | "canWithdrawFromCatalog"> : never
  : never;

export interface PropertyPortfolioPage {
  readonly items: readonly PropertyPortfolioItem[];
  readonly pageInfo: Readonly<{
    readonly nextCursor: string | null;
    readonly hasNextPage: boolean;
  }>;
}

export interface PropertyPortfolioCriteria {
  readonly limit?: number;
  readonly cursor?: string;
  readonly status?: PropertyStatus;
  readonly type?: PropertyType;
  readonly search?: string;
}

export interface CreatePropertyInput {
  readonly title: string;
  readonly description?: string;
  readonly propertyType: PropertyType;
  readonly transactionType: TransactionType;
  readonly apartmentSubtype?: ApartmentSubtype;
  readonly location: PropertyLocation;
}

export interface UpdatePropertyDetailsInput {
  readonly details: PropertyDetails;
  readonly commercialTerms?: PropertyPricingInput;
}

export interface UpdatePropertyCoreInformationInput {
  readonly title: string;
  readonly description?: string;
  readonly location: PropertyLocation;
  readonly apartmentSubtype?: ApartmentSubtype;
}

export type PropertyGeolocation =
  | Readonly<{ configured: false; source: "OWN" }>
  | Readonly<{ configured: false; source: "INHERITED"; inheritedFromPropertyId: string }>
  | Readonly<{
    configured: true;
    source: "OWN";
    latitude: number;
    longitude: number;
    publicVisibility: PropertyGeolocationPublicVisibility;
  }>
  | Readonly<{
    configured: true;
    source: "INHERITED";
    inheritedFromPropertyId: string;
    latitude: number;
    longitude: number;
    publicVisibility: PropertyGeolocationPublicVisibility;
  }>;

export interface UpdatePropertyGeolocationInput {
  readonly latitude: number;
  readonly longitude: number;
  readonly publicVisibility: PropertyGeolocationPublicVisibility;
}

export type PropertyAvailability =
  | Readonly<{
    propertyId: string; source: "DIRECT"; structuralRole: "STANDALONE" | "UNIT";
    configured: false; canUpdateAvailability: boolean;
  }>
  | Readonly<{
    propertyId: string; source: "DIRECT"; structuralRole: "STANDALONE" | "UNIT";
    configured: true; availabilityStatus: PropertyAvailabilityStatus;
    occupancyStatus: PropertyOccupancyStatus; updatedAt: string; canUpdateAvailability: boolean;
  }>
  | Readonly<{
    propertyId: string; source: "DERIVED_FROM_UNITS"; structuralRole: "COMPOSITE";
    availabilityStatus: PropertyAvailabilityStatus | "NOT_CONFIGURED";
    totalUnitCount: number; configuredUnitCount: number; availableUnitCount: number;
    unavailableUnitCount: number; vacantUnitCount: number; occupiedUnitCount: number;
    unconfiguredUnitCount: number; canUpdateAvailability: false;
  }>;

export interface UpdatePropertyAvailabilityInput {
  readonly availabilityStatus: PropertyAvailabilityStatus;
  readonly occupancyStatus: PropertyOccupancyStatus;
}

export interface PropertyPhotoStandard {
  readonly minimumCount: number;
  readonly additionalRequiredCategories: readonly PropertyPhotoCategory[];
}
export interface PropertyBuilding { readonly buildingId: string; readonly propertyId: string; readonly buildingCode: string; readonly name: string; readonly createdAt: string; readonly updatedAt: string; }
export interface PropertyUnit { readonly unitCode: string; readonly property: Property; }
export interface CompositionPage<T> { readonly items: readonly T[]; readonly pageInfo: { readonly nextCursor: string | null; readonly hasNextPage: boolean } }
export interface BuildingInput { readonly buildingCode: string; readonly name: string; }
export interface UnitInput extends CreatePropertyInput { readonly unitCode: string; }

export interface PropertyOwnership {
  readonly propertyId: string;
  readonly ownerId: string;
  readonly ownershipShare: number;
  readonly createdAt: string;
}

export type PropertyOwner =
  | Readonly<{ ownerType: "INDIVIDUAL"; ownerId: string; firstName: string; lastName: string; phoneNumber?: string; email?: string; createdAt: string; updatedAt: string }>
  | Readonly<{ ownerType: "LEGAL_ENTITY"; ownerId: string; legalName: string; registrationNumber?: string; phoneNumber?: string; email?: string; createdAt: string; updatedAt: string }>;

export function propertyOwnerName(owner: PropertyOwner): string {
  return owner.ownerType === "INDIVIDUAL" ? `${owner.firstName} ${owner.lastName}` : owner.legalName;
}

export type PropertyOwnerInput =
  | Readonly<{ ownerType: "INDIVIDUAL"; firstName: string; lastName: string; phoneNumber?: string; email?: string }>
  | Readonly<{ ownerType: "LEGAL_ENTITY"; legalName: string; registrationNumber?: string; phoneNumber?: string; email?: string }>;

export interface PropertyOwnerDirectoryPage {
  readonly items: readonly PropertyOwner[];
  readonly pageInfo: Readonly<{ readonly nextCursor: string | null; readonly hasNextPage: boolean }>;
}

export interface PropertyOwnerDirectoryCriteria {
  readonly limit?: number;
  readonly cursor?: string;
  readonly search?: string;
}

export interface PropertyClient {
  readonly clientId: string;
  readonly displayName: string;
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PropertyClientInput {
  readonly displayName: string;
  readonly email?: string;
  readonly phoneNumber?: string;
}

export interface PropertyApplicationClientConversion {
  readonly applicationId: string;
  readonly convertedAt: string;
  readonly client: PropertyClient;
}

export interface PropertyClientDirectoryPage {
  readonly items: readonly PropertyClient[];
  readonly pageInfo: Readonly<{ readonly nextCursor: string | null; readonly hasNextPage: boolean }>;
  readonly canCreateClient: boolean;
}

export type PropertyContractType = "LEASE" | "MANAGEMENT" | "OTHER";
export type PropertyContractStatus = "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED";
export type PropertyInquiryStatus="NEW"|"ACKNOWLEDGED"|"CLOSED";
export interface PropertyInquiry{readonly inquiryId:string;readonly propertyId:string;readonly contactName:string;readonly email?:string;readonly phoneNumber?:string;readonly message?:string;readonly consentVersion:string;readonly consentGivenAt:string;readonly status:PropertyInquiryStatus;readonly createdAt:string;readonly updatedAt:string;readonly acknowledgedAt?:string;readonly closedAt?:string;}
export interface PropertyInquiryPage{readonly items:readonly PropertyInquiry[];readonly pageInfo:{readonly hasNextPage:boolean;readonly nextCursor:string|null};}
export type PropertyViewingStatus="SCHEDULED"|"COMPLETED"|"CANCELLED";
export interface PropertyViewing{readonly viewingId:string;readonly propertyId:string;readonly inquiryId:string;readonly status:PropertyViewingStatus;readonly startsAt:string;readonly endsAt:string;readonly timeZone:string;readonly createdAt:string;readonly updatedAt:string;readonly completedAt?:string;readonly cancelledAt?:string;}
export interface PropertyViewingScheduleInput{readonly startsAt:string;readonly endsAt:string;readonly timeZone:string;}
export type PropertyViewingOutcomeStatus="FOLLOW_UP_REQUIRED"|"PROCEED"|"DECLINED";
export interface PropertyViewingOutcome{readonly outcomeId:string;readonly propertyId:string;readonly viewingId:string;readonly status:PropertyViewingOutcomeStatus;readonly note?:string;readonly createdAt:string;readonly updatedAt:string;readonly decidedAt?:string;}
export type PropertyApplicationStatus="SUBMITTED"|"APPROVED"|"REJECTED"|"WITHDRAWN";export interface PropertyApplication{readonly applicationId:string;readonly propertyId:string;readonly inquiryId:string;readonly viewingId:string;readonly outcomeId:string;readonly status:PropertyApplicationStatus;readonly note?:string;readonly createdAt:string;readonly updatedAt:string;readonly decidedAt?:string;}export interface PropertyApplicationPage{readonly items:readonly PropertyApplication[];readonly pageInfo:{readonly hasNextPage:boolean;readonly nextCursor:string|null};}
export interface PropertyContractInput {
  readonly clientId: string;
  readonly contractType: PropertyContractType;
  readonly reference: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly notes?: string;
}
export interface PropertyContract extends PropertyContractInput {
  readonly contractId: string;
  readonly propertyId: string;
  readonly status: PropertyContractStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly activatedAt?: string;
  readonly endedAt?: string;
  readonly cancelledAt?: string;
  readonly client: Pick<PropertyClient, "clientId" | "displayName" | "email" | "phoneNumber">;
  readonly capabilities: Readonly<{
    canUpdate: boolean; canActivate: boolean; canEnd: boolean; canCancel: boolean;
  }>;
}
export interface PropertyContractDirectoryPage {
  readonly items: readonly PropertyContract[];
  readonly pageInfo: Readonly<{ readonly nextCursor: string | null; readonly hasNextPage: boolean }>;
  readonly canCreateContract: boolean;
}
export const propertyContractTypeLabels: Readonly<Record<PropertyContractType, string>> = {
  LEASE: "Bail", MANAGEMENT: "Mandat de gestion", OTHER: "Autre contrat",
};
export const propertyContractStatusLabels: Readonly<Record<PropertyContractStatus, string>> = {
  DRAFT: "Brouillon", ACTIVE: "Actif", ENDED: "Terminé", CANCELLED: "Annulé",
};

export type PropertyPublicationRequirement = "DETAILS" | "COMMERCIAL_TERMS" | "APARTMENT_SUBTYPE"
  | "PRIMARY_PHOTO" | "PHOTO_MINIMUM" | "PHOTO_REQUIRED_VIEWS";
export interface PropertyPublicationReadiness {
  readonly ready: boolean;
  readonly missingRequirements: readonly PropertyPublicationRequirement[];
}
export interface PropertyWorkspaceOwnerSummary {
  readonly ownerId: string;
  readonly displayName: string;
  readonly ownershipShare: number;
}
export interface PropertyWorkspace {
  readonly property: Property;
  readonly availability: PropertyAvailability;
  readonly publicationReadiness: PropertyPublicationReadiness;
  readonly owners: readonly PropertyWorkspaceOwnerSummary[];
  readonly composition: Readonly<{ buildingCount: number; unitCount: number }>;
  readonly contracts: Readonly<{
    totalCount: number; draftCount: number; activeCount: number; endedCount: number; cancelledCount: number;
  }>;
  readonly capabilities: Readonly<{
    canUpdateCoreInformation: boolean; canUpdateDetails: boolean; canUpdatePricing: boolean;
    canUpdateAvailability: boolean; canManagePhotos: boolean; canPublish: boolean;
    canWithdrawFromCatalog: boolean; canManageOwners: boolean; canManageComposition: boolean;
    canViewContracts: boolean; canCreateContract: boolean;
  }>;
}

export type PropertyCommercialStage = "NEW_INQUIRY" | "ACKNOWLEDGED_INQUIRY" | "SCHEDULED_VIEWING" | "COMPLETED_VIEWING" | "FOLLOW_UP_REQUIRED" | "PROCEED" | "DECLINED" | "SUBMITTED_APPLICATION" | "APPROVED_APPLICATION" | "REJECTED_APPLICATION" | "WITHDRAWN_APPLICATION" | "CLIENT_CREATED" | "DRAFT_CONTRACT" | "ACTIVE_CONTRACT" | "ENDED_CONTRACT" | "CANCELLED_CONTRACT" | "CLOSED_INQUIRY";
export type PropertyCommercialNextAction = "ACKNOWLEDGE" | "SCHEDULE_VIEWING" | "COMPLETE_VIEWING" | "RECORD_OUTCOME" | "DECIDE_OUTCOME" | "CREATE_APPLICATION" | "DECIDE_APPLICATION" | "CREATE_CLIENT" | "CREATE_CONTRACT" | "ACTIVATE_CONTRACT";
export interface PropertyCommercialJourneyItem { readonly inquiryId: string; readonly propertyId: string; readonly propertyTitle: string; readonly contactName: string; readonly stage: PropertyCommercialStage; readonly nextAction?: PropertyCommercialNextAction; readonly relevantAt: string; readonly workspaceAnchor: string; }
export interface PropertyCommercialJourneyPage { readonly items: readonly PropertyCommercialJourneyItem[]; readonly pageInfo: Readonly<{ hasNextPage: boolean; nextCursor: string | null }>; }

export function formatMinorAmount(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount / currencyMinorFactor(currency));
  return currency === "XOF" ? formatted.replace(/F\s*CFA/u, "FCFA") : formatted;
}

export function currencyFractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function minorAmountToInputValue(amount: number, currency: string): string {
  const digits = currencyFractionDigits(currency);
  return digits === 0 ? String(amount) : (amount / currencyMinorFactor(currency)).toFixed(digits);
}

export function majorAmountInputToMinor(value: FormDataEntryValue | null, currency: string): number {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const digits = currencyFractionDigits(currency);
  const format = digits === 0 ? /^\d+$/u : new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`, "u");
  if (!format.test(normalized)) return Number.NaN;
  const [integer, fraction = ""] = normalized.split(".");
  const result = Number(integer) * currencyMinorFactor(currency) + Number(fraction.padEnd(digits, "0"));
  return Number.isSafeInteger(result) ? result : Number.NaN;
}

function currencyMinorFactor(currency: string): number {
  return 10 ** currencyFractionDigits(currency);
}

export function formatPublicationDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long", timeStyle: "short", timeZone: "UTC",
  }).format(new Date(value));
}
