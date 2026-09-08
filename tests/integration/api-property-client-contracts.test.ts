import { afterEach, describe, expect, it } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import {
  PropertyClientDirectoryResponseSchema, PropertyClientResponseSchema,
  PropertyContractDirectoryResponseSchema, PropertyContractResponseSchema, PropertyWorkspaceResponseSchema,
} from "../../apps/api/src/contracts/v1/properties/property-client-contract.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import {
  ActivatePropertyContract, CancelPropertyContract, CreatePropertyClient, CreatePropertyContract,
  EndPropertyContract, ListPropertyClients, ListPropertyContracts, Property, PropertyClient,
  PropertyContractReferenceConflictError,
  RetrievePropertyClient, RetrievePropertyContract, RetrievePropertyWorkspace, UpdatePropertyContract,
  type PropertyAuthority, type PropertyClientDirectoryCriteria, type PropertyClientRepository,
  type PropertyContractCriteria, type PropertyContractRecord, type PropertyContractRepository,
  type PropertyContractTrace, type PropertyRepository,
} from "../../services/property-management/src/index.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_TENANT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPERTY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CLIENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CONTRACT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CORRELATION = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const NOW = "2026-09-08T10:00:00.000Z";

class Clients implements PropertyClientRepository {
  readonly values = new Map<string, PropertyClient>();
  async save(value: PropertyClient) { this.values.set(`${value.values.tenantId}:${value.values.clientId}`, value); }
  async findById(tenantId: string, clientId: string) { return this.values.get(`${tenantId}:${clientId}`); }
  async list(criteria: PropertyClientDirectoryCriteria) {
    return { items: [...this.values.values()].filter((value) => value.values.tenantId === criteria.tenantId).slice(0, criteria.limit) };
  }
}
class Properties implements PropertyRepository {
  readonly value = Property.createStandalone({
    propertyId: PROPERTY_ID, tenantId: TENANT, title: "Maison Lagune", propertyType: "HOUSE",
    transactionType: "LONG_TERM_RENTAL", location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Riviera" },
    createdAt: NOW, updatedAt: NOW,
  });
  async saveStandalone() {}
  async findById(tenantId: string, propertyId: string) { return tenantId === TENANT && propertyId === PROPERTY_ID ? this.value : undefined; }
  async updateAtomically() { return undefined; }
}
class Contracts implements PropertyContractRepository {
  readonly values = new Map<string, import("../../services/property-management/src/index.js").PropertyContract>();
  constructor(private readonly clients: Clients) {}
  async save(value: import("../../services/property-management/src/index.js").PropertyContract) {
    if ([...this.values.values()].some((item) => item.values.tenantId === value.values.tenantId
      && item.values.reference === value.values.reference)) throw new PropertyContractReferenceConflictError();
    this.values.set(value.values.contractId, value);
  }
  async findById(tenantId: string, propertyId: string, contractId: string) {
    const value = this.values.get(contractId);
    return value?.values.tenantId === tenantId && value.values.propertyId === propertyId ? this.record(value) : undefined;
  }
  async list(criteria: PropertyContractCriteria) {
    if (criteria.tenantId !== TENANT || criteria.propertyId !== PROPERTY_ID) return undefined;
    return { items: [...this.values.values()].map((value) => this.record(value)).slice(0, criteria.limit) };
  }
  async updateAtomically(
    tenantId: string, propertyId: string, contractId: string,
    update: (value: import("../../services/property-management/src/index.js").PropertyContract) => import("../../services/property-management/src/index.js").PropertyContract,
    _trace: PropertyContractTrace,
  ) {
    const record = await this.findById(tenantId, propertyId, contractId);
    if (record === undefined) return undefined;
    const changed = update(record.contract); this.values.set(contractId, changed); return this.record(changed);
  }
  private record(value: import("../../services/property-management/src/index.js").PropertyContract): PropertyContractRecord {
    const client = this.clients.values.get(`${value.values.tenantId}:${value.values.clientId}`);
    if (client === undefined) throw new Error("Missing client");
    return { contract: value, client };
  }
}

describe("Property client, contract and workspace HTTP vertical slice", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl = "";

  async function start(options: { tenantId?: string | null; grants?: PropertyAuthority["grants"] } = {}) {
    const clients = new Clients(); const properties = new Properties(); const contracts = new Contracts(clients);
    const tenantId = options.tenantId === undefined ? TENANT : options.tenantId;
    const grants = options.grants ?? [
      "CREATE_PROPERTY_CLIENT", "RETRIEVE_PROPERTY_CLIENTS", "CREATE_PROPERTY_CONTRACT",
      "RETRIEVE_PROPERTY_CONTRACTS", "UPDATE_PROPERTY_CONTRACT", "MANAGE_PROPERTY_CONTRACT_LIFECYCLE",
      "RETRIEVE_PROPERTY_WORKSPACE", "UPDATE_PROPERTY_AVAILABILITY", "PUBLISH_PROPERTY",
    ];
    const clock = { now: () => NOW };
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: { resolve: async () => tenantId === null ? undefined : ({
        actorId: "actor", authorityId: "authority", tenantIds: [tenantId], grants,
      }) },
      createPropertyClient: new CreatePropertyClient(clients, { generate: () => CLIENT_ID }, clock),
      listPropertyClients: new ListPropertyClients(clients), retrievePropertyClient: new RetrievePropertyClient(clients),
      createPropertyContract: new CreatePropertyContract(contracts, clients, properties, { generate: () => CONTRACT_ID }, clock),
      listPropertyContracts: new ListPropertyContracts(contracts), retrievePropertyContract: new RetrievePropertyContract(contracts),
      updatePropertyContract: new UpdatePropertyContract(contracts, clients, properties, clock),
      activatePropertyContract: new ActivatePropertyContract(contracts, clock),
      endPropertyContract: new EndPropertyContract(contracts, clock), cancelPropertyContract: new CancelPropertyContract(contracts, clock),
      retrievePropertyWorkspace: new RetrievePropertyWorkspace(
        properties,
        { retrieve: async (requestedTenant, requestedProperty) => requestedTenant === TENANT && requestedProperty === PROPERTY_ID
          ? { propertyId: PROPERTY_ID, source: "DIRECT", structuralRole: "STANDALONE", configured: false }
          : undefined },
        { retrieve: async () => undefined, save: async () => undefined },
        { retrieve: async (requestedTenant, requestedProperty) => requestedTenant === TENANT && requestedProperty === PROPERTY_ID ? ({
          owners: [], composition: { buildingCount: 0, unitCount: 0 },
          contracts: {
            totalCount: contracts.values.size,
            draftCount: [...contracts.values.values()].filter((value) => value.values.status === "DRAFT").length,
            activeCount: [...contracts.values.values()].filter((value) => value.values.status === "ACTIVE").length,
            endedCount: [...contracts.values.values()].filter((value) => value.values.status === "ENDED").length,
            cancelledCount: [...contracts.values.values()].filter((value) => value.values.status === "CANCELLED").length,
          },
        }) : undefined },
      ),
    });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  afterEach(async () => { await application?.close(); application = undefined; });
  const request = (path: string, method = "GET", body?: unknown) => fetch(`${baseUrl}${path}`, {
    method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });

  it("creates and reuses a client, then creates, retrieves and activates a contract", async () => {
    await start();
    const clientResponse = await request("/v1/property-clients", "POST", {
      displayName: "Awa Koné", email: "AWA@EXAMPLE.COM",
    });
    expect(clientResponse.status).toBe(201);
    expect(PropertyClientResponseSchema.parse(await clientResponse.json())).toMatchObject({ clientId: CLIENT_ID, email: "awa@example.com" });
    const clients = await request("/v1/property-clients");
    expect(PropertyClientDirectoryResponseSchema.parse(await clients.json())).toMatchObject({ canCreateClient: true, items: [{ clientId: CLIENT_ID }] });

    const created = await request(`/v1/properties/${PROPERTY_ID}/contracts`, "POST", {
      clientId: CLIENT_ID, contractType: "LEASE", reference: "bail-2026-001", startDate: "2026-10-01",
    });
    expect(created.status).toBe(201);
    expect(PropertyContractResponseSchema.parse(await created.json())).toMatchObject({
      contractId: CONTRACT_ID, reference: "BAIL-2026-001", status: "DRAFT", client: { clientId: CLIENT_ID },
    });
    const retrievedClient = await request(`/v1/property-clients/${CLIENT_ID}`);
    expect(PropertyClientResponseSchema.parse(await retrievedClient.json())).toMatchObject({ clientId: CLIENT_ID });
    const retrieved = await request(`/v1/properties/${PROPERTY_ID}/contracts/${CONTRACT_ID}`);
    expect(PropertyContractResponseSchema.parse(await retrieved.json())).toMatchObject({ status: "DRAFT" });
    const updated = await request(`/v1/properties/${PROPERTY_ID}/contracts/${CONTRACT_ID}`, "PUT", {
      clientId: CLIENT_ID, contractType: "LEASE", reference: "bail-2026-updated", startDate: "2026-10-01",
    });
    expect(PropertyContractResponseSchema.parse(await updated.json())).toMatchObject({ reference: "BAIL-2026-UPDATED" });
    const activated = await request(`/v1/properties/${PROPERTY_ID}/contracts/${CONTRACT_ID}/activate`, "POST");
    expect(PropertyContractResponseSchema.parse(await activated.json())).toMatchObject({ status: "ACTIVE", capabilities: { canEnd: true } });
    const ended = await request(`/v1/properties/${PROPERTY_ID}/contracts/${CONTRACT_ID}/end`, "POST", { endDate: "2026-12-31" });
    expect(PropertyContractResponseSchema.parse(await ended.json())).toMatchObject({ status: "ENDED", endDate: "2026-12-31" });
    const replay = await request(`/v1/properties/${PROPERTY_ID}/contracts/${CONTRACT_ID}/end`, "POST", { endDate: "2026-12-31" });
    expect(PropertyContractResponseSchema.parse(await replay.json())).toMatchObject({ status: "ENDED" });
    const list = PropertyContractDirectoryResponseSchema.parse(await (await request(`/v1/properties/${PROPERTY_ID}/contracts`)).json());
    expect(list.items).toHaveLength(1);
    const workspace = PropertyWorkspaceResponseSchema.parse(await (await request(`/v1/properties/${PROPERTY_ID}/workspace`)).json());
    expect(workspace.contracts).toMatchObject({ totalCount: 1, activeCount: 0, endedCount: 1 });
    expect(workspace).not.toHaveProperty("grants");
  });

  it("supports explicit draft cancellation without a destructive endpoint", async () => {
    await start();
    await request("/v1/property-clients", "POST", { displayName: "Awa Koné" });
    await request(`/v1/properties/${PROPERTY_ID}/contracts`, "POST", {
      clientId: CLIENT_ID, contractType: "OTHER", reference: "OTHER-001",
    });
    const cancelled = await request(`/v1/properties/${PROPERTY_ID}/contracts/${CONTRACT_ID}/cancel`, "POST");
    expect(cancelled.status).toBe(200);
    expect(PropertyContractResponseSchema.parse(await cancelled.json())).toMatchObject({ status: "CANCELLED" });
  });

  it("rejects strict invalid bodies and forbidden authorities with safe Problem Details", async () => {
    await start();
    const invalid = await request("/v1/property-clients", "POST", { displayName: "Awa", tenantId: OTHER_TENANT });
    expect(invalid.status).toBe(400);
    expect(ProblemDetailsSchema.parse(await invalid.json())).toMatchObject({ code: "INVALID_REQUEST" });
    await application?.close(); application = undefined;
    await start({ grants: [] });
    const forbidden = await request("/v1/property-clients");
    expect(forbidden.status).toBe(403);
    expect(ProblemDetailsSchema.parse(await forbidden.json())).toMatchObject({ code: "FORBIDDEN" });
  });

  it("hides cross-tenant private resources as not found", async () => {
    await start({ tenantId: OTHER_TENANT });
    const workspace = await request(`/v1/properties/${PROPERTY_ID}/workspace`);
    expect(workspace.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await workspace.json())).toMatchObject({ code: "PROPERTY_NOT_FOUND" });
  });

  it("returns established 401, 404 and 409 Problem Details", async () => {
    await start({ tenantId: null });
    const unauthorized = await request("/v1/property-clients");
    expect(unauthorized.status).toBe(401);
    expect(ProblemDetailsSchema.parse(await unauthorized.json())).toMatchObject({ code: "UNAUTHORIZED" });
    await application?.close(); application = undefined;

    await start();
    const missingClient = await request(`/v1/properties/${PROPERTY_ID}/contracts`, "POST", {
      clientId: CLIENT_ID, contractType: "LEASE", reference: "BAIL-404", startDate: "2026-10-01",
    });
    expect(missingClient.status).toBe(404);
    expect(ProblemDetailsSchema.parse(await missingClient.json())).toMatchObject({ code: "PROPERTY_CLIENT_NOT_FOUND" });
    await request("/v1/property-clients", "POST", { displayName: "Awa Koné" });
    const payload = { clientId: CLIENT_ID, contractType: "LEASE", reference: "BAIL-409", startDate: "2026-10-01" };
    expect((await request(`/v1/properties/${PROPERTY_ID}/contracts`, "POST", payload)).status).toBe(201);
    const conflict = await request(`/v1/properties/${PROPERTY_ID}/contracts`, "POST", payload);
    expect(conflict.status).toBe(409);
    expect(ProblemDetailsSchema.parse(await conflict.json())).toMatchObject({ code: "PROPERTY_CONTRACT_REFERENCE_CONFLICT" });
  });
});
