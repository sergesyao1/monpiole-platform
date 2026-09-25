import { describe, expect, it } from "vitest";

import {
  ActivatePropertyContract, CancelPropertyContract, CreatePropertyClient, CreatePropertyContract,
  EndPropertyContract, InvalidPropertyClientInputError, InvalidPropertyContractInputError,
  ListPropertyClients, ListPropertyContracts, Property, PropertyClient, PropertyClientNotFoundError, PropertyContract,
  PropertyContractNotFoundError,
  PropertyContractPropertyNotEligibleError, PropertyContractReferenceConflictError,
  PropertyContractTransitionNotAllowedError, PropertyForbiddenError, PropertyNotFoundError,
  RetrievePropertyContract, RetrievePropertyWorkspace, UpdatePropertyContract, assessPropertyLeaseEligibility,
  type PropertyAuthority, type PropertyAvailabilityQuery, type PropertyClientDirectoryCriteria,
  type PropertyClientRepository, type PropertyContractCriteria, type PropertyContractRecord,
  type PropertyContractRepository, type PropertyContractTrace, type PropertyPhotoStandardRepository,
  type PropertyRepository, type PropertyWorkspaceSummaryQuery,
} from "../../services/property-management/src/index.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CLIENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CONTRACT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CORRELATION_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const NOW = "2026-09-08T10:00:00.000Z";
const LATER = "2026-09-08T11:00:00.000Z";

const AUTHORITY: PropertyAuthority = {
  actorId: "administrator", authorityId: "administrator", tenantIds: [TENANT_A],
  grants: [
    "CREATE_PROPERTY_CLIENT", "RETRIEVE_PROPERTY_CLIENTS", "CREATE_PROPERTY_CONTRACT",
    "RETRIEVE_PROPERTY_CONTRACTS", "UPDATE_PROPERTY_CONTRACT", "MANAGE_PROPERTY_CONTRACT_LIFECYCLE",
    "RETRIEVE_PROPERTY_WORKSPACE", "UPDATE_PROPERTY_AVAILABILITY", "PUBLISH_PROPERTY",
  ],
};

function property(transactionType: "LONG_TERM_RENTAL" | "SALE" = "LONG_TERM_RENTAL") {
  return Property.createStandalone({
    propertyId: PROPERTY_ID, tenantId: TENANT_A, title: "Maison Lagune", propertyType: "HOUSE",
    transactionType, location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
    createdAt: NOW, updatedAt: NOW,
  });
}

function client(tenantId = TENANT_A) {
  return PropertyClient.create({
    clientId: CLIENT_ID, tenantId, displayName: "  Awa Koné  ", email: "AWA@EXAMPLE.COM",
    createdAt: NOW, updatedAt: NOW,
  });
}

function contract() {
  return PropertyContract.create({
    contractId: CONTRACT_ID, tenantId: TENANT_A, propertyId: PROPERTY_ID, clientId: CLIENT_ID,
    contractType: "LEASE", reference: " bail-2026-001 ", startDate: "2026-10-01",
    createdAt: NOW, updatedAt: NOW,
  }, property().values);
}

class MemoryClients implements PropertyClientRepository {
  readonly values = new Map<string, PropertyClient>();
  async save(value: PropertyClient) { this.values.set(`${value.values.tenantId}:${value.values.clientId}`, value); }
  async findById(tenantId: string, clientId: string) { return this.values.get(`${tenantId}:${clientId}`); }
  async list(criteria: PropertyClientDirectoryCriteria) {
    const items = [...this.values.values()].filter((value) => value.values.tenantId === criteria.tenantId);
    return { items: items.slice(0, criteria.limit) };
  }
}

class MemoryProperties implements PropertyRepository {
  value = property();
  async saveStandalone() {}
  async findById(tenantId: string, propertyId: string) {
    return tenantId === TENANT_A && propertyId === PROPERTY_ID ? this.value : undefined;
  }
  async updateAtomically() { return undefined; }
}

class MemoryContracts implements PropertyContractRepository {
  readonly values = new Map<string, PropertyContract>();
  writes = 0;
  constructor(private readonly clients: MemoryClients) {}
  async assessLeaseTarget(tenantId: string, propertyId: string) {
    return tenantId === TENANT_A && propertyId === PROPERTY_ID
      ? { context: { structuralRole: "STANDALONE" as const, transactionType: "LONG_TERM_RENTAL" as const }, eligibility: { eligible: true as const, blockedByActiveLease: false } }
      : undefined;
  }
  async save(value: PropertyContract) {
    if ([...this.values.values()].some((item) => item.values.tenantId === value.values.tenantId
      && item.values.reference === value.values.reference)) throw new PropertyContractReferenceConflictError();
    this.values.set(value.values.contractId, value); this.writes += 1;
  }
  async findById(tenantId: string, propertyId: string, contractId: string) {
    const value = this.values.get(contractId);
    return value?.values.tenantId === tenantId && value.values.propertyId === propertyId
      ? this.record(value)
      : undefined;
  }
  async list(criteria: PropertyContractCriteria) {
    if (criteria.tenantId !== TENANT_A || criteria.propertyId !== PROPERTY_ID) return undefined;
    return { items: [...this.values.values()].map((value) => this.record(value)).slice(0, criteria.limit) };
  }
  async updateAtomically(
    tenantId: string, propertyId: string, contractId: string,
    update: (contract: PropertyContract) => PropertyContract, _trace: PropertyContractTrace,
  ) {
    const record = await this.findById(tenantId, propertyId, contractId);
    if (record === undefined) return undefined;
    const changed = update(record.contract);
    if (changed !== record.contract) { this.values.set(contractId, changed); this.writes += 1; }
    return this.record(changed);
  }
  private record(value: PropertyContract): PropertyContractRecord {
    const found = this.clients.values.get(`${value.values.tenantId}:${value.values.clientId}`);
    if (found === undefined) throw new Error("Missing client fixture");
    return { contract: value, client: found };
  }
}

describe("Property client and contract domain", () => {
  it("assesses standalone, attached unit and configured whole-building rental targets", () => {
    expect(assessPropertyLeaseEligibility({ structuralRole: "STANDALONE", transactionType: "LONG_TERM_RENTAL" })).toEqual({ eligible: true, blockedByActiveLease: false });
    expect(assessPropertyLeaseEligibility({ structuralRole: "UNIT", transactionType: "LONG_TERM_RENTAL", unitAttached: true })).toEqual({ eligible: true, blockedByActiveLease: false });
    expect(assessPropertyLeaseEligibility({ structuralRole: "COMPOSITE", transactionType: "LONG_TERM_RENTAL", buildingCount: 1, wholeBuildingRentalConfigured: true })).toEqual({ eligible: true, blockedByActiveLease: false });
    expect(assessPropertyLeaseEligibility({ structuralRole: "STANDALONE", transactionType: "SALE" })).toMatchObject({ eligible: false, reasonCode: "NOT_LONG_TERM_RENTAL" });
    expect(assessPropertyLeaseEligibility({ structuralRole: "COMPOSITE", transactionType: "LONG_TERM_RENTAL", buildingCount: 1 })).toMatchObject({ eligible: false, reasonCode: "INVALID_RENTAL_TARGET" });
    expect(assessPropertyLeaseEligibility({ structuralRole: "UNIT", transactionType: "LONG_TERM_RENTAL", unitAttached: false })).toMatchObject({ eligible: false, reasonCode: "INVALID_RENTAL_TARGET" });
  });
  it("respecte le mode commercial canonique des immeubles et des résidences", () => {
    const base = { transactionType: "LONG_TERM_RENTAL" as const };
    expect(assessPropertyLeaseEligibility({ ...base, structuralRole: "COMPOSITE", propertyType: "BUILDING",
      commercializationMode: "WHOLE_BUILDING", buildingCount: 1, wholeBuildingRentalConfigured: true })).toMatchObject({ eligible: true });
    expect(assessPropertyLeaseEligibility({ ...base, structuralRole: "COMPOSITE", propertyType: "BUILDING",
      commercializationMode: "INDIVIDUAL_UNITS", buildingCount: 1, wholeBuildingRentalConfigured: true })).toMatchObject({ eligible: false });
    expect(assessPropertyLeaseEligibility({ ...base, structuralRole: "COMPOSITE", propertyType: "COMPLEX",
      buildingCount: 1, wholeBuildingRentalConfigured: true })).toMatchObject({ eligible: false });
    expect(assessPropertyLeaseEligibility({ ...base, structuralRole: "UNIT", unitAttached: true,
      parentBuildingCommercializationMode: "WHOLE_BUILDING" })).toMatchObject({ eligible: false });
    expect(assessPropertyLeaseEligibility({ ...base, structuralRole: "UNIT", unitAttached: true,
      parentBuildingCommercializationMode: "INDIVIDUAL_UNITS" })).toMatchObject({ eligible: true });
  });
  it("normalizes a reusable client without exposing SaaS Tenant semantics", () => {
    expect(client().values).toMatchObject({ displayName: "Awa Koné", email: "awa@example.com" });
    expect(() => PropertyClient.create({ ...client().values, displayName: " " })).toThrow(InvalidPropertyClientInputError);
  });

  it("normalizes references and enforces calendar periods and LEASE eligibility", () => {
    expect(contract().values.reference).toBe("BAIL-2026-001");
    expect(() => PropertyContract.create({ ...contract().values, status: undefined as never,
      startDate: "2026-10-02", endDate: "2026-10-01" } as never, property().values))
      .toThrow(InvalidPropertyContractInputError);
    expect(() => PropertyContract.create({
      contractId: CONTRACT_ID, tenantId: TENANT_A, propertyId: PROPERTY_ID, clientId: CLIENT_ID,
      contractType: "LEASE", reference: "SALE-LEASE", createdAt: NOW, updatedAt: NOW,
    }, property("SALE").values)).toThrow(PropertyContractPropertyNotEligibleError);
  });

  it("supports only DRAFT→ACTIVE→ENDED and cancellation, with idempotent replays", () => {
    const draft = contract();
    const active = draft.activate(LATER);
    expect(active.activate("invalid")).toBe(active);
    const ended = active.end("2026-12-31", "2026-12-31T10:00:00.000Z");
    expect(ended.end("2026-12-31", "invalid")).toBe(ended);
    expect(() => ended.cancel("2027-01-01T00:00:00.000Z")).toThrow(PropertyContractTransitionNotAllowedError);
    expect(draft.cancel(LATER).values.status).toBe("CANCELLED");
  });
});

describe("Property client and contract application", () => {
  it("creates reusable clients and projects directory capability without tenant ids", async () => {
    const repository = new MemoryClients();
    const create = new CreatePropertyClient(repository, { generate: () => CLIENT_ID }, { now: () => NOW });
    const created = await create.execute({ authority: AUTHORITY, correlationId: CORRELATION_ID, displayName: "Awa Koné" });
    expect(created).not.toHaveProperty("tenantId");
    await expect(new ListPropertyClients(repository).execute({ authority: AUTHORITY })).resolves.toMatchObject({
      items: [{ clientId: CLIENT_ID }], canCreateClient: true,
    });
    await expect(create.execute({ authority: { ...AUTHORITY, grants: [] }, correlationId: CORRELATION_ID, displayName: "No" }))
      .rejects.toBeInstanceOf(PropertyForbiddenError);
  });

  it("creates tenant-owned contracts, detects duplicate references and projects client/capabilities", async () => {
    const clients = new MemoryClients(); await clients.save(client());
    const contracts = new MemoryContracts(clients);
    const create = new CreatePropertyContract(contracts, clients, new MemoryProperties(), { generate: () => CONTRACT_ID }, { now: () => NOW });
    const command = { authority: AUTHORITY, correlationId: CORRELATION_ID, propertyId: PROPERTY_ID,
      clientId: CLIENT_ID, contractType: "LEASE" as const, reference: "bail-2026-001", startDate: "2026-10-01" };
    await expect(create.execute(command)).resolves.toMatchObject({
      contractId: CONTRACT_ID, reference: "BAIL-2026-001", client: { displayName: "Awa Koné" },
      capabilities: { canUpdate: true, canActivate: true, canEnd: false, canCancel: true },
    });
    await expect(create.execute(command)).rejects.toBeInstanceOf(PropertyContractReferenceConflictError);
    const page = await new ListPropertyContracts(contracts).execute({ authority: AUTHORITY, propertyId: PROPERTY_ID });
    expect(page.items[0]).not.toHaveProperty("tenantId");
  });

  it("rejects missing Properties, missing clients, missing contracts and tenant mismatches", async () => {
    const clients = new MemoryClients();
    const contracts = new MemoryContracts(clients);
    const create = new CreatePropertyContract(
      contracts, clients, new MemoryProperties(), { generate: () => CONTRACT_ID }, { now: () => NOW },
    );
    const input = {
      authority: AUTHORITY, correlationId: CORRELATION_ID, clientId: CLIENT_ID,
      contractType: "LEASE" as const, reference: "BAIL-2026-001", startDate: "2026-10-01",
    };
    await expect(create.execute({ ...input, propertyId: PROPERTY_ID })).rejects.toBeInstanceOf(PropertyClientNotFoundError);
    await clients.save(client());
    await expect(create.execute({ ...input, propertyId: "22222222-2222-4222-8222-222222222222" }))
      .rejects.toBeInstanceOf(PropertyNotFoundError);
    await contracts.save(contract());
    const retrieve = new RetrievePropertyContract(contracts);
    await expect(retrieve.execute({
      authority: AUTHORITY, propertyId: PROPERTY_ID, contractId: "33333333-3333-4333-8333-333333333333",
    })).rejects.toBeInstanceOf(PropertyContractNotFoundError);
    await expect(retrieve.execute({
      authority: { ...AUTHORITY, tenantIds: [TENANT_B] }, propertyId: PROPERTY_ID, contractId: CONTRACT_ID,
    })).rejects.toBeInstanceOf(PropertyContractNotFoundError);
  });

  it("updates and cancels a draft atomically, then treats cancellation replay as a no-op", async () => {
    const clients = new MemoryClients(); await clients.save(client());
    const contracts = new MemoryContracts(clients); await contracts.save(contract());
    const updated = await new UpdatePropertyContract(contracts, clients, new MemoryProperties(), { now: () => LATER }).execute({
      authority: AUTHORITY, correlationId: CORRELATION_ID, propertyId: PROPERTY_ID, contractId: CONTRACT_ID,
      clientId: CLIENT_ID, contractType: "LEASE", reference: "bail-2026-updated", startDate: "2026-11-01",
    });
    expect(updated).toMatchObject({ reference: "BAIL-2026-UPDATED", startDate: "2026-11-01" });
    const cancel = new CancelPropertyContract(contracts, { now: () => "2026-09-08T12:00:00.000Z" });
    const command = { authority: AUTHORITY, correlationId: CORRELATION_ID, propertyId: PROPERTY_ID, contractId: CONTRACT_ID };
    await expect(cancel.execute(command)).resolves.toMatchObject({ status: "CANCELLED" });
    await expect(cancel.execute(command)).resolves.toMatchObject({ status: "CANCELLED" });
    expect(contracts.writes).toBe(3);
  });

  it("serializes lifecycle mutations and does not write on identical transition replay", async () => {
    const clients = new MemoryClients(); await clients.save(client());
    const contracts = new MemoryContracts(clients); await contracts.save(contract());
    const command = { authority: AUTHORITY, correlationId: CORRELATION_ID, propertyId: PROPERTY_ID, contractId: CONTRACT_ID };
    const activate = new ActivatePropertyContract(contracts, { now: () => LATER });
    await activate.execute(command); await activate.execute(command);
    expect(contracts.writes).toBe(2);
    await new EndPropertyContract(contracts, { now: () => "2026-12-31T10:00:00.000Z" }).execute({ ...command, endDate: "2026-12-31" });
    expect(contracts.writes).toBe(3);
    await expect(new CancelPropertyContract(contracts, { now: () => "2027-01-01T00:00:00.000Z" }).execute(command))
      .rejects.toBeInstanceOf(PropertyContractTransitionNotAllowedError);
  });

  it("retrieves a canonical workspace with server readiness, summaries and explicit capabilities", async () => {
    const properties = new MemoryProperties();
    const availability: PropertyAvailabilityQuery = { retrieve: async () => ({
      propertyId: PROPERTY_ID, source: "DIRECT", structuralRole: "STANDALONE", configured: false,
    }) };
    const standards: PropertyPhotoStandardRepository = { retrieve: async () => undefined, save: async () => undefined };
    const summaries: PropertyWorkspaceSummaryQuery = { retrieve: async () => ({
      owners: [{ ownerId: "11111111-1111-4111-8111-111111111111", displayName: "Awa", ownershipShare: 60 }],
      composition: { buildingCount: 0, unitCount: 0 },
      contracts: { totalCount: 1, draftCount: 0, activeCount: 1, endedCount: 0, cancelledCount: 0 },
    }) };
    const result = await new RetrievePropertyWorkspace(properties, availability, standards, summaries, new MemoryContracts(new MemoryClients()))
      .execute({ authority: AUTHORITY, propertyId: PROPERTY_ID });
    expect(result.publicationReadiness).toMatchObject({ ready: false });
    expect(result.contracts.activeCount).toBe(1);
    expect(result.capabilities).toMatchObject({ canViewContracts: true, canCreateContract: true });
    expect(result).not.toHaveProperty("grants");
  });
});
