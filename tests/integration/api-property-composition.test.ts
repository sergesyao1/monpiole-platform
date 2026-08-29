import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import type { AuthorityGrant } from "../../apps/api/src/http/authenticated-authority/authenticated-authority.js";
import { PropertyBuildingCodeConflictError, PropertyBuildingNotFoundError, PropertyForbiddenError, PropertyNotFoundError, PropertyUnitCodeConflictError, PropertyUnitNotFoundError } from "../../services/property-management/src/index.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; const PROPERTY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; const BUILDING = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; const UNIT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"; const NOW = "2026-08-28T12:00:00.000Z";
const building = { buildingId: BUILDING, propertyId: PROPERTY, buildingCode: "BAT-A", name: "Immeuble A", createdAt: NOW, updatedAt: NOW };
const property = { propertyId: UNIT, tenantId: TENANT, title: "Appartement A-101", propertyType: "APARTMENT" as const, transactionType: "LONG_TERM_RENTAL" as const, status: "DRAFT" as const, structuralRole: "UNIT" as const, location: { country: "CI", city: "Abidjan", district: "Cocody", addressLine: "Rue 1" }, createdAt: NOW, updatedAt: NOW };
const unit = { unitCode: "A-101", property };
async function expectProblem(response: Response, status: number, code?: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain("application/problem+json");
  expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/u);
  expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/u);
  const body = await response.json() as Record<string, unknown>;
  expect(body).toMatchObject({ status, correlationId: expect.any(String), code: code ?? expect.any(String) });
  expect(body).not.toHaveProperty("stack");
  return body;
}

describe("Property composition HTTP", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined; let baseUrl = "";
  const calls = { createBuilding: vi.fn(), listBuildings: vi.fn(), updateBuilding: vi.fn(), createUnit: vi.fn(), listUnits: vi.fn(), updateUnit: vi.fn() };
  async function start(options: { authenticated?: boolean; grants?: readonly AuthorityGrant[] } = {}) {
    calls.createBuilding.mockResolvedValue(building); calls.listBuildings.mockResolvedValue({ items: [building], nextCursor: { code: "BAT-A", id: BUILDING } }); calls.updateBuilding.mockResolvedValue({ ...building, name: "Immeuble Alpha" }); calls.createUnit.mockResolvedValue(unit); calls.listUnits.mockResolvedValue({ items: [unit], nextCursor: { code: "A-101", id: UNIT } }); calls.updateUnit.mockResolvedValue({ ...unit, unitCode: "A-102" });
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: { resolve: async () => options.authenticated === false ? undefined : ({ actorId: "actor", authorityId: "authority", grants: options.grants ?? ["CREATE_PROPERTY_BUILDING", "RETRIEVE_PROPERTY_COMPOSITION", "UPDATE_PROPERTY_BUILDING", "CREATE_PROPERTY_UNIT", "UPDATE_PROPERTY_UNIT_STRUCTURE"], tenantIds: [TENANT] }) },
      createPropertyBuilding: { execute: calls.createBuilding }, listPropertyBuildings: { execute: calls.listBuildings }, updatePropertyBuilding: { execute: calls.updateBuilding }, createPropertyUnit: { execute: calls.createUnit }, listPropertyUnits: { execute: calls.listUnits }, updatePropertyUnitStructure: { execute: calls.updateUnit },
    }); await application.listen(0, "127.0.0.1"); const address = application.getHttpServer().address(); if (!address || typeof address === "string") throw new Error("API did not bind"); baseUrl = `http://127.0.0.1:${address.port}`;
  }
  afterEach(async () => { await application?.close(); application = undefined; Object.values(calls).forEach((call) => call.mockReset()); });
  it("expose les six routes et ne transmet jamais de tenant client", async () => { await start();
    const cases: readonly [string, string, unknown, number][] = [
      ["POST", `/v1/properties/${PROPERTY}/buildings`, { buildingCode: "bat-a", name: "Immeuble A" }, 201],
      ["GET", `/v1/properties/${PROPERTY}/buildings?limit=1`, undefined, 200],
      ["PUT", `/v1/properties/${PROPERTY}/buildings/${BUILDING}`, { buildingCode: "BAT-A", name: "Immeuble Alpha" }, 200],
      ["POST", `/v1/properties/${PROPERTY}/buildings/${BUILDING}/units`, { unitCode: "A-101", title: "Appartement A-101", propertyType: "APARTMENT", transactionType: "LONG_TERM_RENTAL", location: property.location }, 201],
      ["GET", `/v1/properties/${PROPERTY}/buildings/${BUILDING}/units?limit=1`, undefined, 200],
      ["PUT", `/v1/properties/${PROPERTY}/buildings/${BUILDING}/units/${UNIT}`, { unitCode: "A-102" }, 200],
    ];
    for (const [method, path, body, status] of cases) { const response = await fetch(`${baseUrl}${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); expect(response.status, `${method} ${path}`).toBe(status); expect(response.headers.get("content-type")).toContain("application/json"); expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/u); expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/u); }
    expect(calls.createBuilding.mock.calls[0]?.[0]).toMatchObject({ propertyId: PROPERTY, authority: { tenantIds: [TENANT] } }); expect(calls.createBuilding.mock.calls[0]?.[0]).not.toHaveProperty("tenantId");
  });
  it.each([
    ["POST", `/v1/properties/${PROPERTY}/buildings`, { buildingCode: "!", name: "A" }],
    ["PUT", `/v1/properties/${PROPERTY}/buildings/${BUILDING}`, { buildingCode: "BAT-A", name: "" }],
    ["POST", `/v1/properties/${PROPERTY}/buildings/${BUILDING}/units`, { unitCode: "A-101", title: "", propertyType: "APARTMENT", transactionType: "SALE", location: property.location }],
    ["PUT", `/v1/properties/${PROPERTY}/buildings/${BUILDING}/units/${UNIT}`, { unitCode: "#" }],
  ] as const)("refuse les entrées strictes invalides", async (method, path, body) => { await start(); const response = await fetch(`${baseUrl}${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, tenantId: TENANT }) }); const problem = await expectProblem(response, 400); expect(problem.errors).toEqual(expect.any(Array)); });
  it("refuse un curseur non canonique", async () => { await start(); await expectProblem(await fetch(`${baseUrl}/v1/properties/${PROPERTY}/buildings?cursor=%%%`), 400); });
  it("retourne 401 sans authentification", async () => { await start({ authenticated: false }); await expectProblem(await fetch(`${baseUrl}/v1/properties/${PROPERTY}/buildings`), 401, "UNAUTHORIZED"); });
  it("traduit les erreurs d’autorisation, d’appartenance et de conflit", async () => { await start(); const scenarios: readonly [ReturnType<typeof vi.fn>, Error, string, number, string, string][] = [
    [calls.createBuilding, new PropertyForbiddenError(), `/v1/properties/${PROPERTY}/buildings`, 403, "POST", "FORBIDDEN"],
    [calls.listBuildings, new PropertyNotFoundError(), `/v1/properties/${PROPERTY}/buildings`, 404, "GET", "PROPERTY_NOT_FOUND"],
    [calls.updateBuilding, new PropertyBuildingNotFoundError(), `/v1/properties/${PROPERTY}/buildings/${BUILDING}`, 404, "PUT", "PROPERTY_BUILDING_NOT_FOUND"],
    [calls.createBuilding, new PropertyBuildingCodeConflictError(), `/v1/properties/${PROPERTY}/buildings`, 409, "POST", "PROPERTY_BUILDING_CODE_CONFLICT"],
    [calls.createUnit, new PropertyUnitCodeConflictError(), `/v1/properties/${PROPERTY}/buildings/${BUILDING}/units`, 409, "POST", "PROPERTY_UNIT_CODE_CONFLICT"],
    [calls.updateUnit, new PropertyUnitNotFoundError(), `/v1/properties/${PROPERTY}/buildings/${BUILDING}/units/${UNIT}`, 404, "PUT", "PROPERTY_UNIT_NOT_FOUND"],
  ]; for (const [call, failure, path, status, method, code] of scenarios) { call.mockRejectedValueOnce(failure); const body = method === "GET" ? undefined : method === "POST" && path.endsWith("units") ? { unitCode: unit.unitCode, title: property.title, propertyType: property.propertyType, transactionType: property.transactionType, location: property.location } : path.endsWith("buildings") ? { buildingCode: "BAT-A", name: "A" } : path.includes("units") ? { unitCode: "A-102" } : { buildingCode: "BAT-A", name: "A" }; const response = await fetch(`${baseUrl}${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); await expectProblem(response, status, code); } });
  it("retourne un Problem Details 500 sûr avec les headers de trace", async () => {
    await start(); calls.listUnits.mockRejectedValueOnce(new Error("sensitive persistence failure"));
    const response = await fetch(`${baseUrl}/v1/properties/${PROPERTY}/buildings/${BUILDING}/units`);
    const problem = await expectProblem(response, 500, "INTERNAL_ERROR");
    expect(JSON.stringify(problem)).not.toContain("sensitive persistence failure");
  });
});
