import { describe, expect, it } from "vitest";
import {
  CreateProperty, InvalidPropertyInputError, InvalidPropertyServerValueError, PersistedPropertyCorruptionError,
  Property, PropertyForbiddenError, PropertyNotFoundError, RetrieveProperty, type PropertyRepository,
  UpdatePropertyCoreInformation, UpdatePropertyDetails, InvalidPropertyDetailsError, IncompatibleCommercialTermsError,
  PublishProperty, PropertyPublicationRequirementsNotMetError, WithdrawPropertyFromCatalog,
  PropertyNotPublishedError, PropertyRepublicationNotSupportedError,
  PropertyCommercialTargetNotEligibleError,
  assessPropertyPhotoReadiness, resolvePropertyPhotoStandard,
} from "../../services/property-management/src/index.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PHOTO_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PRIMARY_PHOTO = { photoId: PHOTO_ID, tenantId: TENANT_A, propertyId: PROPERTY_ID, category: "BUILDING_EXTERIOR_OR_ENTRANCE" as const,
  mediaKind: "IMAGE" as const, position: 0,
  status: "AVAILABLE" as const, contentType: "image/png" as const, contentByteSize: 8,
  contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6", isPrimary: true,
  registeredAt: "2026-08-25T12:30:00.000Z", availableAt: "2026-08-25T12:31:00.000Z" };
const STUDIO_PHOTOS = [
  PRIMARY_PHOTO,
  { ...PRIMARY_PHOTO, photoId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", category: "MAIN_LIVING_SLEEPING_AREA" as const, isPrimary: false, position: 1 },
  { ...PRIMARY_PHOTO, photoId: "ffffffff-ffff-4fff-8fff-ffffffffffff", category: "KITCHEN_OR_KITCHENETTE" as const, isPrimary: false, position: 2 },
  { ...PRIMARY_PHOTO, photoId: "11111111-1111-4111-8111-111111111111", category: "BATHROOM_OR_SHOWER_ROOM" as const, isPrimary: false, position: 3 },
  { ...PRIMARY_PHOTO, photoId: "22222222-2222-4222-8222-222222222222", category: "OTHER" as const, isPrimary: false, position: 4 },
  { ...PRIMARY_PHOTO, photoId: "33333333-3333-4333-8333-333333333333", category: "OTHER" as const, isPrimary: false, position: 5 },
];
const AUTHORITY = { actorId: "actor", authorityId: "authority", grants: ["CREATE_PROPERTY", "RETRIEVE_PROPERTY"] as const, tenantIds: [TENANT_A] };
const input = { title: "  Apartment Cocody  ", description: "  Balcony  ", propertyType: "APARTMENT" as const,
  transactionType: "LONG_TERM_RENTAL" as const, apartmentSubtype: "STUDIO" as const,
  location: { country: "CI", city: " Abidjan ", district: " Cocody ", addressLine: " Riviera " } };

class MemoryRepository implements PropertyRepository {
  readonly values = new Map<string, Property>();
  updateWrites = 0;
  async saveStandalone(property: Property) { this.values.set(`${property.values.tenantId}:${property.values.propertyId}`, property); }
  async findById(tenantId: string, propertyId: string) { return this.values.get(`${tenantId}:${propertyId}`); }
  async updateAtomically(tenantId: string, propertyId: string, update: Parameters<PropertyRepository["updateAtomically"]>[2]) {
    const key = `${tenantId}:${propertyId}`; const property = this.values.get(key);
    if (property === undefined) return undefined; const updated = update(property, property.values.photos ?? []);
    if (updated === property) return property;
    this.values.set(key, updated); this.updateWrites += 1; return updated;
  }
}

function publishedProperty(): Property {
  return Property.create({ propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input,
    createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" })
    .defineDetails({ rooms: 2 }, {
      kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 250_000, rentPeriod: "MONTH",
    }, "2026-08-25T13:00:00.000Z")
    .publish("2026-08-25T14:00:00.000Z", STUDIO_PHOTOS);
}

describe("Property Domain and Application", () => {
  it("applique la matrice de publication des biens directs, immeubles et résidences", () => {
    const base = { propertyId: PROPERTY_ID, tenantId: TENANT_A, title: "Bien test", transactionType: "LONG_TERM_RENTAL" as const,
      location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue 1" },
      createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" };
    const terms = { kind: "LONG_TERM_RENTAL" as const, currency: "XOF" as const, rentAmountMinor: 100000, rentPeriod: "MONTH" as const };
    const villa = Property.createStandalone({ ...base, propertyType: "HOUSE" }).defineDetails({ rooms: 3 }, terms, "2026-08-25T13:00:00.000Z");
    expect(villa.publish("2026-08-25T14:00:00.000Z", STUDIO_PHOTOS).values.status).toBe("PUBLISHED");
    const apartment = Property.createStandalone({ ...base, propertyType: "APARTMENT", apartmentSubtype: "STUDIO" })
      .defineDetails({ rooms: 1 }, terms, "2026-08-25T13:00:00.000Z");
    expect(apartment.publish("2026-08-25T14:00:00.000Z", STUDIO_PHOTOS).values.status).toBe("PUBLISHED");
    const whole = Property.createComposite({ ...base, propertyType: "BUILDING", commercializationMode: "WHOLE_BUILDING" })
      .defineDetails({ rooms: 4 }, terms, "2026-08-25T13:00:00.000Z");
    expect(whole.publish("2026-08-25T14:00:00.000Z", STUDIO_PHOTOS).values.status).toBe("PUBLISHED");
    const individual = Property.createComposite({ ...base, propertyType: "BUILDING", commercializationMode: "INDIVIDUAL_UNITS" });
    expect(individual.assessPublicationReadiness(STUDIO_PHOTOS).missingRequirements).toContain("COMMERCIAL_TARGET");
    expect(() => individual.setPricing(terms, "2026-08-25T13:00:00.000Z")).toThrow(PropertyCommercialTargetNotEligibleError);
    const complex = Property.createComposite({ ...base, propertyType: "COMPLEX" });
    expect(complex.assessPublicationReadiness(STUDIO_PHOTOS).missingRequirements).toContain("COMMERCIAL_TARGET");
    expect(() => complex.setPricing(terms, "2026-08-25T13:00:00.000Z")).toThrow(PropertyCommercialTargetNotEligibleError);
  });
  function useCases(repository = new MemoryRepository()) {
    return { repository, create: new CreateProperty(repository, { generate: () => PROPERTY_ID }, { now: () => "2026-08-25T12:00:00.000Z" }), retrieve: new RetrieveProperty(repository) };
  }
  it("creates a normalized DRAFT owned by the single authenticated tenant", async () => {
    const { create } = useCases();
    await expect(create.execute({ ...input, authority: AUTHORITY, correlationId: PROPERTY_ID })).resolves.toMatchObject({
      propertyId: PROPERTY_ID, tenantId: TENANT_A, title: "Apartment Cocody", description: "Balcony", status: "DRAFT",
      location: { city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
    });
  });
  it("rejects blank and overlong titles", () => {
    const base = { propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input, createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" };
    expect(() => Property.create({ ...base, title: " " })).toThrow(InvalidPropertyInputError);
    expect(() => Property.create({ ...base, title: "x".repeat(201) })).toThrow(InvalidPropertyInputError);
  });
  it("rejects unsupported property and transaction types", () => {
    const base = { propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input, createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" };
    expect(() => Property.create({ ...base, propertyType: "CASTLE" as never })).toThrow(InvalidPropertyInputError);
    expect(() => Property.create({ ...base, transactionType: "GIFT" as never })).toThrow(InvalidPropertyInputError);
  });
  it("separates invalid server values and persisted corruption from client input", () => {
    const base = { propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input, createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" };
    expect(() => Property.create({ ...base, propertyId: "invalid" })).toThrow(InvalidPropertyServerValueError);
    expect(() => Property.rehydrate({ ...base, status: "PUBLISHED" as never, structuralRole: "STANDALONE" })).toThrow(PersistedPropertyCorruptionError);
  });
  it("rejects missing grants and ambiguous multi-tenant authority before persistence", async () => {
    const { create, repository } = useCases();
    await expect(create.execute({ ...input, correlationId: PROPERTY_ID, authority: { ...AUTHORITY, grants: [] } })).rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(create.execute({ ...input, correlationId: PROPERTY_ID, authority: { ...AUTHORITY, tenantIds: [TENANT_A, TENANT_B] } })).rejects.toBeInstanceOf(PropertyForbiddenError);
    expect(repository.values.size).toBe(0);
  });
  it("retrieves structurally by authenticated tenant and hides another tenant", async () => {
    const { create, retrieve } = useCases(); await create.execute({ ...input, authority: AUTHORITY, correlationId: PROPERTY_ID });
    await expect(retrieve.execute({ authority: AUTHORITY, propertyId: PROPERTY_ID })).resolves.toMatchObject({ tenantId: TENANT_A });
    await expect(retrieve.execute({ authority: { ...AUTHORITY, tenantIds: [TENANT_B] }, propertyId: PROPERTY_ID })).rejects.toBeInstanceOf(PropertyNotFoundError);
  });
  it("validates details and each compatible commercial variant", () => {
    const base = { propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input, createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" };
    const details = { usableSurfaceSquareMeters: 80.5, rooms: 4, bedrooms: 2, bathrooms: 1, furnished: true };
    expect(Property.create(base).defineDetails(details, { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 250_000, rentPeriod: "MONTH", securityDepositAmountMinor: 500_000, chargesAmountMinor: 25_000 }, "2026-08-25T13:00:00.000Z").values.commercialTerms?.kind).toBe("LONG_TERM_RENTAL");
    expect(Property.create({ ...base, apartmentSubtype: undefined, transactionType: "SHORT_TERM_RENTAL" }).defineDetails(details, { kind: "SHORT_TERM_RENTAL", currency: "XOF", rateAmountMinor: 50_000, pricingUnit: "NIGHT" }, "2026-08-25T13:00:00.000Z").values.commercialTerms?.kind).toBe("SHORT_TERM_RENTAL");
    expect(Property.create({ ...base, apartmentSubtype: undefined, transactionType: "SALE" }).defineDetails(details, { kind: "SALE", currency: "XOF", salePriceAmountMinor: 75_000_000 }, "2026-08-25T13:00:00.000Z").values.commercialTerms?.kind).toBe("SALE");
  });
  it("rejects impossible details, negative money, and incompatible terms", () => {
    const property = Property.create({ propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input, createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" });
    expect(() => property.defineDetails({ rooms: 1, bedrooms: 2 }, { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 1, rentPeriod: "MONTH" }, "2026-08-25T13:00:00.000Z")).toThrow(InvalidPropertyDetailsError);
    expect(() => property.defineDetails({ usableSurfaceSquareMeters: -1 }, { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 1, rentPeriod: "MONTH" }, "2026-08-25T13:00:00.000Z")).toThrow(InvalidPropertyDetailsError);
    expect(() => property.defineDetails({ rooms: 1 }, { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: -1, rentPeriod: "MONTH" }, "2026-08-25T13:00:00.000Z")).toThrow(InvalidPropertyDetailsError);
    expect(() => property.defineDetails({ rooms: 1 }, { kind: "SALE", currency: "XOF", salePriceAmountMinor: 1 }, "2026-08-25T13:00:00.000Z")).toThrow(IncompatibleCommercialTermsError);
  });
  it("publishes an eligible Property once with the publication instant as its mutation instant", () => {
    const property = Property.create({ propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input,
      createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" })
      .defineDetails({ rooms: 1 }, { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 1, rentPeriod: "MONTH" }, "2026-08-25T13:00:00.000Z");
    const published = property.publish("2026-08-25T14:00:00.000Z", STUDIO_PHOTOS);
    expect(published.values).toMatchObject({ status: "PUBLISHED", publishedAt: "2026-08-25T14:00:00.000Z", updatedAt: "2026-08-25T14:00:00.000Z" });
    expect(published.publish("not-an-instant")).toBe(published);
  });
  it("withdraws a published Property while preserving its private data and lifecycle history", () => {
    const published = publishedProperty();
    const withdrawn = published.withdraw("2026-08-25T15:00:00.000Z");
    expect(withdrawn.values).toMatchObject({
      status: "WITHDRAWN", publishedAt: "2026-08-25T14:00:00.000Z",
      withdrawnAt: "2026-08-25T15:00:00.000Z", updatedAt: "2026-08-25T15:00:00.000Z",
      title: "Apartment Cocody", details: { rooms: 2 }, commercialTerms: { rentAmountMinor: 250_000 },
    });
    expect(withdrawn.withdraw("not-an-instant")).toBe(withdrawn);
    expect(() => withdrawn.publish("2026-08-25T16:00:00.000Z", STUDIO_PHOTOS)).toThrow(PropertyRepublicationNotSupportedError);
  });
  it("rejects withdrawal from DRAFT and a withdrawal instant before publication", () => {
    const draft = Property.create({ propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input,
      createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" });
    expect(() => draft.withdraw("2026-08-25T15:00:00.000Z")).toThrow(PropertyNotPublishedError);
    expect(() => publishedProperty().withdraw("2026-08-25T13:59:59.999Z")).toThrow(InvalidPropertyServerValueError);
  });
  it.each(["STANDALONE", "COMPOSITE", "UNIT"] as const)("withdraws a published %s Property independently", (structuralRole) => {
    const published = publishedProperty();
    const candidate = Property.rehydrate({ ...published.values, structuralRole });
    expect(candidate.withdraw("2026-08-25T15:00:00.000Z").values).toMatchObject({
      structuralRole,
      status: "WITHDRAWN",
      publishedAt: "2026-08-25T14:00:00.000Z",
      withdrawnAt: "2026-08-25T15:00:00.000Z",
    });
  });
  it("applique la norme Studio sans exiger de salon ni de chambre séparés", () => {
    const standard = resolvePropertyPhotoStandard({
      propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL", apartmentSubtype: "STUDIO",
    });
    expect(standard).toEqual({
      minimumCount: 6,
      requiredCategories: [
        "BUILDING_EXTERIOR_OR_ENTRANCE", "MAIN_LIVING_SLEEPING_AREA",
        "KITCHEN_OR_KITCHENETTE", "BATHROOM_OR_SHOWER_ROOM",
      ],
    });
    expect(assessPropertyPhotoReadiness(STUDIO_PHOTOS, standard).missingRequiredCategories).toEqual([]);
    expect(standard.requiredCategories).not.toContain("LIVING_ROOM_OR_MAIN_ROOM");
    expect(standard.requiredCategories).not.toContain("BEDROOM_OR_SLEEPING_AREA");
  });
  it("applique la norme Multi-room et ne laisse jamais la quantité compenser une vue", () => {
    expect(resolvePropertyPhotoStandard({
      propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL", apartmentSubtype: "MULTI_ROOM",
    })).toEqual({
      minimumCount: 6,
      requiredCategories: [
        "BUILDING_EXTERIOR_OR_ENTRANCE", "LIVING_ROOM_OR_MAIN_ROOM", "KITCHEN_OR_KITCHENETTE",
        "BEDROOM_OR_SLEEPING_AREA", "BATHROOM_OR_SHOWER_ROOM",
      ],
    });
    const property = Property.create({ propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input,
      createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" })
      .defineDetails({ rooms: 1 }, { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 1, rentPeriod: "MONTH" }, "2026-08-25T13:00:00.000Z");
    const sevenPhotos = [PRIMARY_PHOTO, ...[1, 2, 3, 4, 5, 6].map((number) => ({
      ...PRIMARY_PHOTO, photoId: `${number}${number}${number}${number}${number}${number}${number}${number}-${number}${number}${number}${number}-4${number}${number}${number}-8${number}${number}${number}-${String(number).repeat(12)}`,
      category: "OTHER" as const, isPrimary: false,
    }))];
    expect(() => property.publish("2026-08-25T14:00:00.000Z", sevenPhotos)).toThrowError(expect.objectContaining({
      missingRequirements: ["PHOTO_REQUIRED_VIEWS"],
    }));
  });
  it("fusionne le standard organisation sans permettre de réduire MonPiole", () => {
    expect(resolvePropertyPhotoStandard({
      propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL", apartmentSubtype: "STUDIO",
    }, { minimumCount: 1, additionalRequiredCategories: ["BEDROOM_OR_SLEEPING_AREA"] })).toMatchObject({
      minimumCount: 6,
      requiredCategories: expect.arrayContaining(["MAIN_LIVING_SLEEPING_AREA", "BEDROOM_OR_SLEEPING_AREA"]),
    });
  });
  it("reports the closed publication prerequisites without mutating a DRAFT", () => {
    const property = Property.create({ propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input,
      createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" });
    expect(() => property.publish("2026-08-25T14:00:00.000Z")).toThrowError(expect.objectContaining({
      code: "PROPERTY_PUBLICATION_REQUIREMENTS_NOT_MET",
      missingRequirements: ["DETAILS", "COMMERCIAL_TERMS", "PRIMARY_PHOTO", "PHOTO_MINIMUM", "PHOTO_REQUIRED_VIEWS"],
    }));
    expect(property.values.status).toBe("DRAFT");
  });
  it("updates details through the tenant-scoped application operation", async () => {
    const { create, repository } = useCases(); await create.execute({ ...input, authority: AUTHORITY, correlationId: PROPERTY_ID });
    const update = new UpdatePropertyDetails(repository, { now: () => "2026-08-25T14:00:00.000Z" });
    await expect(update.execute({ authority: { ...AUTHORITY, grants: [...AUTHORITY.grants, "UPDATE_PROPERTY_DETAILS"] }, correlationId: PROPERTY_ID, propertyId: PROPERTY_ID,
      details: { rooms: 3, bedrooms: 2 }, commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 300_000, rentPeriod: "MONTH" } }))
      .resolves.toMatchObject({ details: { rooms: 3, bedrooms: 2 }, commercialTerms: { kind: "LONG_TERM_RENTAL" }, updatedAt: "2026-08-25T14:00:00.000Z" });
  });
  it("publishes through the tenant-scoped operation and replays without consuming another clock instant", async () => {
    const { create, repository } = useCases();
    await create.execute({ ...input, authority: AUTHORITY, correlationId: PROPERTY_ID });
    await new UpdatePropertyDetails(repository, { now: () => "2026-08-25T13:00:00.000Z" }).execute({
      authority: { ...AUTHORITY, grants: ["UPDATE_PROPERTY_DETAILS"] }, correlationId: PROPERTY_ID, propertyId: PROPERTY_ID,
      details: { rooms: 2 }, commercialTerms: { kind: "LONG_TERM_RENTAL", currency: "XOF", rentAmountMinor: 1, rentPeriod: "MONTH" },
    });
    const stored = repository.values.get(`${TENANT_A}:${PROPERTY_ID}`)!;
    repository.values.set(`${TENANT_A}:${PROPERTY_ID}`, Property.rehydrate({ ...stored.values, photos: STUDIO_PHOTOS }));
    let clockCalls = 0;
    const publish = new PublishProperty(repository, { now: () => { clockCalls += 1; return "2026-08-25T14:00:00.000Z"; } });
    const command = { authority: { ...AUTHORITY, grants: ["PUBLISH_PROPERTY"] as const }, correlationId: PROPERTY_ID, propertyId: PROPERTY_ID };
    await expect(publish.execute(command)).resolves.toMatchObject({ outcome: "PUBLISHED", property: { status: "PUBLISHED", publishedAt: "2026-08-25T14:00:00.000Z" } });
    const writesAfterPublication = repository.updateWrites;
    await expect(publish.execute(command)).resolves.toMatchObject({ outcome: "ALREADY_PUBLISHED", property: { publishedAt: "2026-08-25T14:00:00.000Z" } });
    expect(clockCalls).toBe(1);
    expect(repository.updateWrites).toBe(writesAfterPublication);
  });
  it("rejects ineligible, unauthorized and cross-tenant publication", async () => {
    const { create, repository } = useCases();
    await create.execute({ ...input, authority: AUTHORITY, correlationId: PROPERTY_ID });
    const publish = new PublishProperty(repository, { now: () => "2026-08-25T14:00:00.000Z" });
    const command = { authority: { ...AUTHORITY, grants: ["PUBLISH_PROPERTY"] as const }, correlationId: PROPERTY_ID, propertyId: PROPERTY_ID };
    await expect(publish.execute(command)).rejects.toBeInstanceOf(PropertyPublicationRequirementsNotMetError);
    await expect(publish.execute({ ...command, authority: { ...command.authority, grants: [] } })).rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(publish.execute({ ...command, authority: { ...command.authority, tenantIds: [TENANT_B] } })).rejects.toBeInstanceOf(PropertyNotFoundError);
  });
  it("withdraws atomically and replays without another write or clock read", async () => {
    const repository = new MemoryRepository();
    repository.values.set(`${TENANT_A}:${PROPERTY_ID}`, publishedProperty());
    let clockCalls = 0;
    const withdraw = new WithdrawPropertyFromCatalog(repository, { now: () => {
      clockCalls += 1; return "2026-08-25T15:00:00.000Z";
    } });
    const command = { authority: { ...AUTHORITY, grants: ["WITHDRAW_PROPERTY_FROM_CATALOG"] as const }, correlationId: PROPERTY_ID, propertyId: PROPERTY_ID };
    await expect(withdraw.execute(command)).resolves.toMatchObject({
      outcome: "WITHDRAWN", property: { status: "WITHDRAWN", publishedAt: "2026-08-25T14:00:00.000Z",
        withdrawnAt: "2026-08-25T15:00:00.000Z", details: { rooms: 2 } },
    });
    const writesAfterWithdrawal = repository.updateWrites;
    await expect(withdraw.execute(command)).resolves.toMatchObject({ outcome: "ALREADY_WITHDRAWN" });
    expect(clockCalls).toBe(1);
    expect(repository.updateWrites).toBe(writesAfterWithdrawal);
  });
  it("enforces withdrawal state, permission, resource hiding and tenant isolation", async () => {
    const repository = new MemoryRepository();
    repository.values.set(`${TENANT_A}:${PROPERTY_ID}`, publishedProperty());
    const withdraw = new WithdrawPropertyFromCatalog(repository, { now: () => "2026-08-25T15:00:00.000Z" });
    const command = { authority: { ...AUTHORITY, grants: ["WITHDRAW_PROPERTY_FROM_CATALOG"] as const }, correlationId: PROPERTY_ID, propertyId: PROPERTY_ID };
    await expect(withdraw.execute({ ...command, authority: { ...command.authority, grants: [] } })).rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(withdraw.execute({ ...command, authority: { ...command.authority, tenantIds: [] } })).rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(withdraw.execute({ ...command, authority: { ...command.authority, tenantIds: [TENANT_A, TENANT_B] } })).rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(withdraw.execute({ ...command, authority: { ...command.authority, tenantIds: [TENANT_B] } })).rejects.toBeInstanceOf(PropertyNotFoundError);
    await expect(withdraw.execute({ ...command, propertyId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" })).rejects.toBeInstanceOf(PropertyNotFoundError);
    repository.values.set(`${TENANT_A}:${PROPERTY_ID}`, Property.create({ propertyId: PROPERTY_ID, tenantId: TENANT_A, ...input,
      createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" }));
    await expect(withdraw.execute(command)).rejects.toBeInstanceOf(PropertyNotPublishedError);
    expect(repository.updateWrites).toBe(0);
  });
  it("updates only normalized core information through the tenant-scoped operation", async () => {
    const { create, repository } = useCases();
    await create.execute({ ...input, authority: AUTHORITY, correlationId: PROPERTY_ID });
    const update = new UpdatePropertyCoreInformation(repository, { now: () => "2026-08-25T15:00:00.000Z" });
    await expect(update.execute({
      authority: { ...AUTHORITY, grants: [...AUTHORITY.grants, "UPDATE_PROPERTY_CORE_INFORMATION"] },
      correlationId: PROPERTY_ID, propertyId: PROPERTY_ID, title: "  Villa Lagune  ", description: "  Rénovée  ",
      location: { country: "CI", city: " Abidjan ", district: " Marcory ", addressLine: " Zone 4 " },
    })).resolves.toMatchObject({
      title: "Villa Lagune", description: "Rénovée", propertyType: "APARTMENT",
      transactionType: "LONG_TERM_RENTAL", status: "DRAFT",
      location: { city: "Abidjan", district: "Marcory", addressLine: "Zone 4" },
      updatedAt: "2026-08-25T15:00:00.000Z",
    });
  });
  it("rejects invalid core information and unauthorized or cross-tenant updates", async () => {
    const { create, repository } = useCases();
    await create.execute({ ...input, authority: AUTHORITY, correlationId: PROPERTY_ID });
    const update = new UpdatePropertyCoreInformation(repository, { now: () => "2026-08-25T15:00:00.000Z" });
    const command = { authority: { ...AUTHORITY, grants: ["UPDATE_PROPERTY_CORE_INFORMATION"] as const }, correlationId: PROPERTY_ID,
      propertyId: PROPERTY_ID, title: "Villa", location: input.location };
    await expect(update.execute({ ...command, title: " " })).rejects.toBeInstanceOf(InvalidPropertyInputError);
    await expect(update.execute({ ...command, authority: { ...command.authority, grants: [] } })).rejects.toBeInstanceOf(PropertyForbiddenError);
    await expect(update.execute({ ...command, authority: { ...command.authority, tenantIds: [TENANT_B] } })).rejects.toBeInstanceOf(PropertyNotFoundError);
  });
});
