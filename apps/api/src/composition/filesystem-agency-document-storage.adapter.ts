import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  isAbsolute,
  relative,
  resolve,
} from "node:path";

import type {
  AgencyDocumentContent,
  AgencyDocumentStorage,
  StoreAgencyDocumentInput,
} from "@monpiole/agency-onboarding";

export class InvalidAgencyDocumentStorageKeyError
  extends Error {
  public constructor(storageKey: string) {
    super(
      `Invalid agency document storage key: ${storageKey}`,
    );

    this.name =
      "InvalidAgencyDocumentStorageKeyError";
  }
}

export class FilesystemAgencyDocumentStorage
  implements AgencyDocumentStorage {
  private readonly rootPath: string;

  public constructor(rootPath: string) {
    const normalized = rootPath.trim();

    if (normalized.length === 0) {
      throw new Error(
        "Agency document storage root path must not be empty",
      );
    }

    this.rootPath = resolve(normalized);
  }

  public async store(
    input: StoreAgencyDocumentInput,
  ): Promise<void> {
    const path = this.resolveStoragePath(
      input.storageKey,
    );

    await mkdir(
      resolve(path, ".."),
      { recursive: true },
    );

    await writeFile(
      path,
      input.content,
      {
        flag: "wx",
      },
    );
  }

  public async retrieve(
    storageKey: string,
  ): Promise<AgencyDocumentContent | undefined> {
    const path = this.resolveStoragePath(storageKey);

    try {
      const content = await readFile(path);

      return Object.freeze({
        content,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return undefined;
      }

      throw error;
    }
  }

  public async delete(
    storageKey: string,
  ): Promise<void> {
    const path = this.resolveStoragePath(storageKey);

    await rm(path, {
      force: true,
    });
  }

  private resolveStoragePath(
    storageKey: string,
  ): string {
    const normalized = storageKey.trim();

    if (
      normalized.length === 0 ||
      isAbsolute(normalized) ||
      normalized.includes("\0")
    ) {
      throw new InvalidAgencyDocumentStorageKeyError(
        storageKey,
      );
    }

    const candidate = resolve(
      this.rootPath,
      normalized,
    );

    const relation = relative(
      this.rootPath,
      candidate,
    );

    if (
      relation.length === 0 ||
      relation === ".." ||
      relation.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
      isAbsolute(relation)
    ) {
      throw new InvalidAgencyDocumentStorageKeyError(
        storageKey,
      );
    }

    return candidate;
  }
}