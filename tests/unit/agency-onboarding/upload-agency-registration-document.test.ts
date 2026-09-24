import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "vitest";

import {
  AgencyRegistrationDocumentUploadValidationError,
  UploadAgencyRegistrationDocument,
  type AgencyDocumentStorage,
  type AgencyRegistrationDocumentUpload,
  type AgencyRegistrationDocumentUploadStore,
} from "../../../services/agency-onboarding/src/index.js";

class MemoryStorage implements AgencyDocumentStorage {
  readonly stored: Array<{
    storageKey: string;
    content: Uint8Array;
  }> = [];

  readonly deleted: string[] = [];

  failStore = false;
  failDelete = false;

  async store(input: {
    readonly storageKey: string;
    readonly content: Uint8Array;
  }): Promise<void> {
    if (this.failStore) {
      throw new Error("storage failure");
    }

    this.stored.push(input);
  }

  async retrieve(): Promise<undefined> {
    return undefined;
  }

  async delete(storageKey: string): Promise<void> {
    if (this.failDelete) {
      throw new Error("delete failure");
    }

    this.deleted.push(storageKey);
  }
}

class MemoryUploadStore
  implements AgencyRegistrationDocumentUploadStore
{
  readonly uploads: AgencyRegistrationDocumentUpload[] = [];

  failCreate = false;

  async create(input: {
    readonly upload: AgencyRegistrationDocumentUpload;
  }): Promise<void> {
    if (this.failCreate) {
      throw new Error("database failure");
    }

    this.uploads.push(input.upload);
  }
}

function createIds(...ids: string[]): () => string {
  let index = 0;

  return () => {
    const id = ids[index];

    if (id === undefined) {
      throw new Error("Unexpected ID generation");
    }

    index += 1;
    return id;
  };
}

function createUseCase(
  storage: MemoryStorage,
  uploads: MemoryUploadStore,
) {
  return new UploadAgencyRegistrationDocument(
    storage,
    uploads,
    {
      generateId: createIds(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ),
      now: () => new Date("2026-09-17T08:00:00.000Z"),
    },
  );
}

describe("UploadAgencyRegistrationDocument", () => {
  it("stores a valid PDF and persists trusted staging metadata", async () => {
    const storage = new MemoryStorage();
    const uploads = new MemoryUploadStore();
    const useCase = createUseCase(storage, uploads);

    const content = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
    ]);

    const result = await useCase.execute({
      originalFilename: "  registre.pdf  ",
      mimeType: "APPLICATION/PDF",
      content,
    });

    const expectedChecksum = createHash("sha256")
      .update(content)
      .digest("hex");

    assert.deepEqual(result, {
      uploadId: "11111111-1111-4111-8111-111111111111",
      originalFilename: "registre.pdf",
      mimeType: "application/pdf",
      sizeBytes: content.byteLength,
      checksumSha256: expectedChecksum,
      expiresAt: "2026-09-18T08:00:00.000Z",
    });

    assert.equal(
      Object.hasOwn(result, "storageKey"),
      false,
    );

    assert.equal(storage.stored.length, 1);
    assert.equal(uploads.uploads.length, 1);

    const upload = uploads.uploads[0];

    assert.ok(upload);

    assert.equal(
      upload.uploadId,
      "11111111-1111-4111-8111-111111111111",
    );

    assert.equal(
      upload.storageKey,
      "agency-registration-uploads/" +
        "22222222-2222-4222-8222-222222222222",
    );

    assert.notEqual(
      upload.uploadId,
      upload.storageKey,
    );

    assert.equal(upload.checksumSha256, expectedChecksum);
    assert.equal(upload.createdAt, "2026-09-17T08:00:00.000Z");
    assert.equal(upload.expiresAt, "2026-09-18T08:00:00.000Z");
    assert.equal(upload.consumedAt, undefined);

    assert.equal(
      storage.stored[0]?.storageKey,
      upload.storageKey,
    );

    assert.deepEqual(
      storage.stored[0]?.content,
      content,
    );
  });

  for (const mimeType of [
    "image/jpeg",
    "image/png",
    "image/webp",
  ] as const) {
    it(`accepts ${mimeType}`, async () => {
      const storage = new MemoryStorage();
      const uploads = new MemoryUploadStore();
      const useCase = createUseCase(storage, uploads);

      const contents = {
        "image/jpeg": new Uint8Array([
          0xff, 0xd8, 0xff, 0xe0,
        ]),
        "image/png": new Uint8Array([
          0x89, 0x50, 0x4e, 0x47,
          0x0d, 0x0a, 0x1a, 0x0a,
        ]),
        "image/webp": new Uint8Array([
          0x52, 0x49, 0x46, 0x46,
          0x00, 0x00, 0x00, 0x00,
          0x57, 0x45, 0x42, 0x50,
        ]),
      } as const;

      await useCase.execute({
        originalFilename: "document.bin",
        mimeType,
        content: contents[mimeType],
      });

      assert.equal(storage.stored.length, 1);
      assert.equal(uploads.uploads.length, 1);
      assert.equal(
        uploads.uploads[0]?.mimeType,
        mimeType,
      );
    });
  }

  it("rejects an unsupported MIME type before storage", async () => {
    const storage = new MemoryStorage();
    const uploads = new MemoryUploadStore();
    const useCase = createUseCase(storage, uploads);

    await assert.rejects(
      useCase.execute({
        originalFilename: "payload.exe",
        mimeType: "application/octet-stream",
        content: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      }),
      AgencyRegistrationDocumentUploadValidationError,
    );

    assert.equal(storage.stored.length, 0);
    assert.equal(uploads.uploads.length, 0);
  });

  it("rejects an empty document before storage", async () => {
    const storage = new MemoryStorage();
    const uploads = new MemoryUploadStore();
    const useCase = createUseCase(storage, uploads);

    await assert.rejects(
      useCase.execute({
        originalFilename: "empty.pdf",
        mimeType: "application/pdf",
        content: new Uint8Array(),
      }),
      AgencyRegistrationDocumentUploadValidationError,
    );

    assert.equal(storage.stored.length, 0);
    assert.equal(uploads.uploads.length, 0);
  });

  it("rejects a document larger than 50 MiB", async () => {
    const storage = new MemoryStorage();
    const uploads = new MemoryUploadStore();
    const useCase = createUseCase(storage, uploads);

    const oversized =
      new Uint8Array(50 * 1024 * 1024 + 1);

    await assert.rejects(
      useCase.execute({
        originalFilename: "large.pdf",
        mimeType: "application/pdf",
        content: oversized,
      }),
      AgencyRegistrationDocumentUploadValidationError,
    );

    assert.equal(storage.stored.length, 0);
    assert.equal(uploads.uploads.length, 0);
  });

  it("rejects an empty filename before storage", async () => {
    const storage = new MemoryStorage();
    const uploads = new MemoryUploadStore();
    const useCase = createUseCase(storage, uploads);

    await assert.rejects(
      useCase.execute({
        originalFilename: "   ",
        mimeType: "application/pdf",
        content: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      }),
      AgencyRegistrationDocumentUploadValidationError,
    );

    assert.equal(storage.stored.length, 0);
    assert.equal(uploads.uploads.length, 0);
  });

  it("rejects a filename longer than 255 characters", async () => {
    const storage = new MemoryStorage();
    const uploads = new MemoryUploadStore();
    const useCase = createUseCase(storage, uploads);

    await assert.rejects(
      useCase.execute({
        originalFilename: "a".repeat(256),
        mimeType: "application/pdf",
        content: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      }),
      AgencyRegistrationDocumentUploadValidationError,
    );

    assert.equal(storage.stored.length, 0);
    assert.equal(uploads.uploads.length, 0);
  });

  it("deletes the stored object when staging persistence fails", async () => {
    const storage = new MemoryStorage();
    const uploads = new MemoryUploadStore();

    uploads.failCreate = true;

    const useCase = createUseCase(storage, uploads);

    await assert.rejects(
      useCase.execute({
        originalFilename: "registre.pdf",
        mimeType: "application/pdf",
        content: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      }),
      /database failure/,
    );

    assert.equal(storage.stored.length, 1);

    assert.deepEqual(storage.deleted, [
      "agency-registration-uploads/" +
        "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("preserves the persistence error if compensating delete also fails", async () => {
    const storage = new MemoryStorage();
    const uploads = new MemoryUploadStore();

    uploads.failCreate = true;
    storage.failDelete = true;

    const useCase = createUseCase(storage, uploads);

    await assert.rejects(
      useCase.execute({
        originalFilename: "registre.pdf",
        mimeType: "application/pdf",
        content: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      }),
      /database failure/,
    );
  });

  it("does not persist staging metadata when storage fails", async () => {
    const storage = new MemoryStorage();
    const uploads = new MemoryUploadStore();

    storage.failStore = true;

    const useCase = createUseCase(storage, uploads);

    await assert.rejects(
      useCase.execute({
        originalFilename: "registre.pdf",
        mimeType: "application/pdf",
        content: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      }),
      /storage failure/,
    );

    assert.equal(uploads.uploads.length, 0);
    assert.equal(storage.deleted.length, 0);
  });

  for (const scenario of [
    {
      mimeType: "application/pdf",
      content: new Uint8Array([1, 2, 3, 4, 5]),
    },
    {
      mimeType: "image/jpeg",
      content: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    },
    {
      mimeType: "image/png",
      content: new Uint8Array([0xff, 0xd8, 0xff]),
    },
    {
      mimeType: "image/webp",
      content: new Uint8Array([
        0x52, 0x49, 0x46, 0x46,
        0x00, 0x00, 0x00, 0x00,
        0x4e, 0x4f, 0x50, 0x45,
      ]),
    },
  ] as const) {
    it(
      `rejects content that does not match ${scenario.mimeType}`,
      async () => {
        const storage = new MemoryStorage();
        const uploads = new MemoryUploadStore();
        const useCase = createUseCase(storage, uploads);

        await assert.rejects(
          useCase.execute({
            originalFilename: "document.bin",
            mimeType: scenario.mimeType,
            content: scenario.content,
          }),
          AgencyRegistrationDocumentUploadValidationError,
        );

        assert.equal(storage.stored.length, 0);
        assert.equal(uploads.uploads.length, 0);
      },
    );
  }
});
