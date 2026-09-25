import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  FilesystemAgencyDocumentStorage,
  InvalidAgencyDocumentStorageKeyError,
} from "../../../apps/api/src/composition/filesystem-agency-document-storage.adapter.js";

const roots: string[] = [];

async function storageFixture() {
  const root = await mkdtemp(
    join(
      tmpdir(),
      "monpiole-agency-documents-",
    ),
  );

  roots.push(root);

  return {
    root,
    storage:
      new FilesystemAgencyDocumentStorage(root),
  };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(
      async (root) => {
        await rm(root, {
          recursive: true,
          force: true,
        });
      },
    ),
  );
});

describe(
  "FilesystemAgencyDocumentStorage",
  () => {
    it(
      "stores and retrieves exact binary content",
      async () => {
        const { root, storage } =
          await storageFixture();

        const content = Buffer.from([
          0x25,
          0x50,
          0x44,
          0x46,
          0x00,
          0xff,
          0x10,
        ]);

        const storageKey =
          "registrations/abc/document.pdf";

        await storage.store({
          storageKey,
          content,
        });

        const result =
          await storage.retrieve(storageKey);

        expect(result).toBeDefined();

        expect(
          Buffer.from(result!.content),
        ).toEqual(content);

        expect(
          await readFile(
            join(
              root,
              "registrations",
              "abc",
              "document.pdf",
            ),
          ),
        ).toEqual(content);
      },
    );

    it(
      "returns undefined for absent content",
      async () => {
        const { storage } =
          await storageFixture();

        await expect(
          storage.retrieve(
            "registrations/missing.pdf",
          ),
        ).resolves.toBeUndefined();
      },
    );

    it(
      "deletes stored content",
      async () => {
        const { storage } =
          await storageFixture();

        const storageKey =
          "registrations/delete-me.pdf";

        await storage.store({
          storageKey,
          content: Buffer.from("content"),
        });

        await storage.delete(storageKey);

        await expect(
          storage.retrieve(storageKey),
        ).resolves.toBeUndefined();

        // delete is intentionally idempotent
        await expect(
          storage.delete(storageKey),
        ).resolves.toBeUndefined();
      },
    );

    it(
      "rejects traversal outside the configured root",
      async () => {
        const { storage } =
          await storageFixture();

        await expect(
          storage.store({
            storageKey:
              "../outside-document.pdf",
            content: Buffer.from("x"),
          }),
        ).rejects.toBeInstanceOf(
          InvalidAgencyDocumentStorageKeyError,
        );
      },
    );

    it(
      "rejects an absolute storage path",
      async () => {
        const { storage } =
          await storageFixture();

        const absolutePath =
          process.platform === "win32"
            ? "C:\\outside\\document.pdf"
            : "/outside/document.pdf";

        await expect(
          storage.retrieve(absolutePath),
        ).rejects.toBeInstanceOf(
          InvalidAgencyDocumentStorageKeyError,
        );
      },
    );

    it(
      "rejects an empty storage key",
      async () => {
        const { storage } =
          await storageFixture();

        await expect(
          storage.retrieve("   "),
        ).rejects.toBeInstanceOf(
          InvalidAgencyDocumentStorageKeyError,
        );
      },
    );

    it(
      "does not overwrite an existing document",
      async () => {
        const { storage } =
          await storageFixture();

        const storageKey =
          "registrations/exclusive.pdf";

        const original =
          Buffer.from("original");

        await storage.store({
          storageKey,
          content: original,
        });

        await expect(
          storage.store({
            storageKey,
            content:
              Buffer.from("replacement"),
          }),
        ).rejects.toMatchObject({
          code: "EEXIST",
        });

        const result =
          await storage.retrieve(storageKey);

        expect(
          Buffer.from(result!.content),
        ).toEqual(original);
      },
    );
  },
);