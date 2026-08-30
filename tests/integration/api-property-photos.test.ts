import { afterEach, describe, expect, it } from "vitest";

import { createApiApplication } from "../../apps/api/src/bootstrap.js";
import { PropertyPhotoGalleryResponseSchema } from "../../apps/api/src/contracts/v1/properties/property.schema.js";
import { ProblemDetailsSchema } from "../../apps/api/src/contracts/v1/common/problem-details.schema.js";
import {
  DeletePropertyPhoto, ListPropertyPhotos, PropertyPrimaryPhotoDeletionForbiddenError,
  RegisterPropertyPhoto, RetrievePropertyPhotoContent, SelectPropertyPrimaryPhoto,
  RetrievePropertyPhotoStandard, UpdatePropertyPhotoStandard,
  type PropertyPhotoStandardRepository,
  type PropertyPhotoRegistration, type PropertyPhotoRepository, type PropertyPhotoValues,
} from "../../services/property-management/src/index.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROPERTY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_PROPERTY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PHOTO_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PHOTO_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PHOTO_C = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const photo = (photoId: string, propertyId = PROPERTY, isPrimary = false): PropertyPhotoValues => ({
  photoId, tenantId: TENANT, propertyId, category: photoId === PHOTO_A ? "BUILDING_EXTERIOR_OR_ENTRANCE" : "LIVING_ROOM_OR_MAIN_ROOM",
  status: "AVAILABLE", contentType: "image/png", contentByteSize: 8,
  contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6", isPrimary,
  registeredAt: "2026-08-30T10:00:00.000Z", availableAt: "2026-08-30T10:01:00.000Z",
});

class MemoryPhotos implements PropertyPhotoRepository {
  values: PropertyPhotoValues[] = [photo(PHOTO_A, PROPERTY, true), photo(PHOTO_B), photo("11111111-1111-4111-8111-111111111111", OTHER_PROPERTY)];
  async list(tenantId: string, propertyId: string) {
    if (tenantId !== TENANT || ![PROPERTY, OTHER_PROPERTY].includes(propertyId)) return undefined;
    return this.values.filter((item) => item.tenantId === tenantId && item.propertyId === propertyId);
  }
  async register(tenantId: string, propertyId: string, registration: PropertyPhotoRegistration) {
    if (tenantId !== TENANT || propertyId !== PROPERTY) return undefined;
    this.values.push({
      photoId: registration.photoId, tenantId, propertyId, category: registration.category,
      status: "AVAILABLE", contentType: registration.contentType, contentByteSize: 8,
      contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6",
      isPrimary: false, registeredAt: registration.registeredAt, availableAt: registration.registeredAt,
    });
    return this.list(tenantId, propertyId);
  }
  async retrieveContent(tenantId: string, propertyId: string, photoId: string) {
    if (!this.values.some((item) => item.tenantId === tenantId && item.propertyId === propertyId && item.photoId === photoId)) return undefined;
    return { contentType: "image/png" as const, contentBase64: "iVBORw0KGgo=", contentByteSize: 8,
      contentSha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6" };
  }
  async selectPrimary(tenantId: string, propertyId: string, photoId: string) {
    const target = this.values.find((item) => item.tenantId === tenantId && item.propertyId === propertyId && item.photoId === photoId);
    if (target === undefined) return undefined;
    this.values = this.values.map((item) => item.propertyId === propertyId ? { ...item, isPrimary: item.photoId === photoId } : item);
    return this.list(tenantId, propertyId);
  }
  async delete(tenantId: string, propertyId: string, photoId: string) {
    const target = this.values.find((item) => item.tenantId === tenantId && item.propertyId === propertyId && item.photoId === photoId);
    if (target === undefined) return false;
    if (target.isPrimary) throw new PropertyPrimaryPhotoDeletionForbiddenError();
    this.values = this.values.filter((item) => item !== target); return true;
  }
}

class MemoryStandards implements PropertyPhotoStandardRepository {
  value: { minimumCount: number; additionalRequiredCategories: readonly ["BEDROOM_OR_SLEEPING_AREA"] } | undefined;
  async retrieve() { return this.value; }
  async save(_tenantId: string, standard: Parameters<PropertyPhotoStandardRepository["save"]>[1]) {
    this.value = { minimumCount: standard.minimumCount, additionalRequiredCategories: ["BEDROOM_OR_SLEEPING_AREA"] };
  }
}

describe("Property photos HTTP API", () => {
  let application: Awaited<ReturnType<typeof createApiApplication>> | undefined;
  let baseUrl = "";
  async function start(granted = true) {
    const repository = new MemoryPhotos();
    const standards = new MemoryStandards();
    application = await createApiApplication({ logger: false }, {
      authenticatedAuthorityProvider: { resolve: async () => ({
        actorId: "actor", authorityId: "authority", tenantIds: [TENANT],
        grants: granted ? ["CREATE_PROPERTY_PHOTO", "RETRIEVE_PROPERTY_PHOTOS", "SELECT_PROPERTY_PRIMARY_PHOTO", "DELETE_PROPERTY_PHOTO", "RETRIEVE_PROPERTY_PHOTO_STANDARD", "MANAGE_PROPERTY_PHOTO_STANDARD"] : [],
      }) },
      listPropertyPhotos: new ListPropertyPhotos(repository),
      registerPropertyPhoto: new RegisterPropertyPhoto(repository, { generate: () => PHOTO_C }, { now: () => "2026-08-30T10:20:00.000Z" }),
      retrievePropertyPhotoContent: new RetrievePropertyPhotoContent(repository),
      selectPropertyPrimaryPhoto: new SelectPropertyPrimaryPhoto(repository, { now: () => "2026-08-30T10:10:00.000Z" }),
      deletePropertyPhoto: new DeletePropertyPhoto(repository),
      retrievePropertyPhotoStandard: new RetrievePropertyPhotoStandard(standards),
      updatePropertyPhotoStandard: new UpdatePropertyPhotoStandard(standards, { now: () => "2026-08-30T10:30:00.000Z" }),
    });
    await application.listen(0, "127.0.0.1");
    const address = application.getHttpServer().address();
    if (address === null || typeof address === "string") throw new Error("API did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }
  afterEach(async () => { await application?.close(); application = undefined; });

  it("liste la galerie et remplace atomiquement la sélection exposée", async () => {
    await start();
    const listed = await fetch(`${baseUrl}/v1/properties/${PROPERTY}/photos`);
    expect(listed.status).toBe(200);
    expect(PropertyPhotoGalleryResponseSchema.parse(await listed.json()).photos.filter((item) => item.isPrimary))
      .toEqual([expect.objectContaining({ photoId: PHOTO_A })]);
    const selected = await fetch(`${baseUrl}/v1/properties/${PROPERTY}/photos/${PHOTO_B}/primary`, { method: "PUT" });
    expect(selected.status).toBe(200);
    expect(PropertyPhotoGalleryResponseSchema.parse(await selected.json()).photos.filter((item) => item.isPrimary))
      .toEqual([expect.objectContaining({ photoId: PHOTO_B })]);
  });

  it("enregistre un contenu réel puis le restitue avec son type média", async () => {
    await start();
    const registered = await fetch(`${baseUrl}/v1/properties/${PROPERTY}/photos`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: "KITCHEN_OR_KITCHENETTE", contentType: "image/png", contentBase64: "iVBORw0KGgo=" }),
    });
    expect(registered.status).toBe(201);
    expect(PropertyPhotoGalleryResponseSchema.parse(await registered.json()).photos).toContainEqual(expect.objectContaining({ photoId: PHOTO_C }));
    const content = await fetch(`${baseUrl}/v1/properties/${PROPERTY}/photos/${PHOTO_C}/content`);
    expect(content.status).toBe(200);
    expect(content.headers.get("content-type")).toContain("image/png");
    expect(Buffer.from(await content.arrayBuffer()).toString("base64")).toBe("iVBORw0KGgo=");
  });

  it("refuse une photo d’un autre bien et la suppression de la principale", async () => {
    await start();
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY}/photos/11111111-1111-4111-8111-111111111111/primary`, { method: "PUT" })).status).toBe(404);
    const deletion = await fetch(`${baseUrl}/v1/properties/${PROPERTY}/photos/${PHOTO_A}`, { method: "DELETE" });
    expect(deletion.status).toBe(409);
    expect(ProblemDetailsSchema.parse(await deletion.json()).code).toBe("PROPERTY_PRIMARY_PHOTO_DELETION_FORBIDDEN");
  });

  it("applique les permissions métier", async () => {
    await start(false);
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY}/photos`)).status).toBe(403);
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY}/photos`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: "OTHER", contentType: "image/png", contentBase64: "iVBORw0KGgo=" }),
    })).status).toBe(403);
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY}/photos/${PHOTO_B}/primary`, { method: "PUT" })).status).toBe(403);
    expect((await fetch(`${baseUrl}/v1/properties/${PROPERTY}/photos/${PHOTO_B}`, { method: "DELETE" })).status).toBe(403);
    expect((await fetch(`${baseUrl}/v1/property-photo-standard`)).status).toBe(403);
    expect((await fetch(`${baseUrl}/v1/property-photo-standard`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ minimumCount: 2, additionalRequiredCategories: [] }),
    })).status).toBe(403);
  });

  it("permet à l’organisation d’augmenter le minimum et d’ajouter une vue", async () => {
    await start();
    const updated = await fetch(`${baseUrl}/v1/property-photo-standard`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ minimumCount: 8, additionalRequiredCategories: ["BEDROOM_OR_SLEEPING_AREA"] }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toEqual({ minimumCount: 8, additionalRequiredCategories: ["BEDROOM_OR_SLEEPING_AREA"] });
    const retrieved = await fetch(`${baseUrl}/v1/property-photo-standard`);
    expect(await retrieved.json()).toEqual({ minimumCount: 8, additionalRequiredCategories: ["BEDROOM_OR_SLEEPING_AREA"] });
  });
});
