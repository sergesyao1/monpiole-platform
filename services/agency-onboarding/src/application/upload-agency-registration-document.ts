import { createHash, randomUUID } from "node:crypto";

import type {
  AgencyDocumentStorage,
} from "./agency-document-storage.js";
import type {
  AgencyRegistrationDocumentUpload,
  AgencyRegistrationDocumentUploadStore,
} from "./agency-registration-document-upload.js";

const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024;
const UPLOAD_TTL_MILLISECONDS = 24 * 60 * 60 * 1000;

const ALLOWED_MIME_TYPES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const);

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export class AgencyRegistrationDocumentUploadValidationError
  extends Error
{
  public readonly code =
    "AGENCY_REGISTRATION_DOCUMENT_UPLOAD_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name =
      "AgencyRegistrationDocumentUploadValidationError";
  }
}

export interface UploadAgencyRegistrationDocumentCommand {
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly content: Uint8Array;
}

export interface UploadAgencyRegistrationDocumentResult {
  readonly uploadId: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly expiresAt: string;
}

export interface UploadAgencyRegistrationDocumentDependencies {
  readonly storage: AgencyDocumentStorage;
  readonly uploads: AgencyRegistrationDocumentUploadStore;
  readonly generateId?: () => string;
  readonly now?: () => Date;
}

function normalizeFilename(value: string): string {
  const filename = value.trim();

  if (filename.length < 1 || filename.length > 255) {
    throw new AgencyRegistrationDocumentUploadValidationError(
      "Document filename must contain between 1 and 255 characters",
    );
  }

  return filename;
}

function normalizeMimeType(value: string): AllowedMimeType {
  const mimeType = value.trim().toLowerCase();

  if (
    !ALLOWED_MIME_TYPES.includes(
      mimeType as AllowedMimeType,
    )
  ) {
    throw new AgencyRegistrationDocumentUploadValidationError(
      "Unsupported agency registration document MIME type",
    );
  }

  return mimeType as AllowedMimeType;
}

function startsWithBytes(
  content: Uint8Array,
  signature: readonly number[],
): boolean {
  if (content.byteLength < signature.length) {
    return false;
  }

  return signature.every(
    (value, index) => content[index] === value,
  );
}

function hasExpectedFileSignature(
  mimeType: AllowedMimeType,
  content: Uint8Array,
): boolean {
  switch (mimeType) {
    case "application/pdf":
      return startsWithBytes(
        content,
        [0x25, 0x50, 0x44, 0x46, 0x2d],
      );

    case "image/jpeg":
      return startsWithBytes(
        content,
        [0xff, 0xd8, 0xff],
      );

    case "image/png":
      return startsWithBytes(
        content,
        [
          0x89,
          0x50,
          0x4e,
          0x47,
          0x0d,
          0x0a,
          0x1a,
          0x0a,
        ],
      );

    case "image/webp":
      return (
        content.byteLength >= 12 &&
        startsWithBytes(
          content,
          [0x52, 0x49, 0x46, 0x46],
        ) &&
        content[8] === 0x57 &&
        content[9] === 0x45 &&
        content[10] === 0x42 &&
        content[11] === 0x50
      );
  }
}

function validateFileSignature(
  mimeType: AllowedMimeType,
  content: Uint8Array,
): void {
  if (!hasExpectedFileSignature(mimeType, content)) {
    throw new AgencyRegistrationDocumentUploadValidationError(
      "Agency registration document content does not match its MIME type",
    );
  }
}
function validateContent(content: Uint8Array): void {
  if (
    content.byteLength < 1 ||
    content.byteLength > MAX_DOCUMENT_SIZE_BYTES
  ) {
    throw new AgencyRegistrationDocumentUploadValidationError(
      "Agency registration document size must be between 1 byte and 50 MiB",
    );
  }
}

export class UploadAgencyRegistrationDocument {
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly storage: AgencyDocumentStorage,
    private readonly uploads: AgencyRegistrationDocumentUploadStore,
    options: {
      readonly generateId?: () => string;
      readonly now?: () => Date;
    } = {},
  ) {
    this.generateId = options.generateId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async execute(
    command: UploadAgencyRegistrationDocumentCommand,
  ): Promise<UploadAgencyRegistrationDocumentResult> {
    const originalFilename =
      normalizeFilename(command.originalFilename);

    const mimeType = normalizeMimeType(command.mimeType);

    validateContent(command.content);
    validateFileSignature(mimeType, command.content);

    const uploadId = this.generateId();
    const storageObjectId = this.generateId();

    const createdAtDate = this.now();
    const expiresAtDate = new Date(
      createdAtDate.getTime() + UPLOAD_TTL_MILLISECONDS,
    );

    const createdAt = createdAtDate.toISOString();
    const expiresAt = expiresAtDate.toISOString();

    const checksumSha256 = createHash("sha256")
      .update(command.content)
      .digest("hex");

    const storageKey =
      `agency-registration-uploads/${storageObjectId}`;

    const upload: AgencyRegistrationDocumentUpload =
      Object.freeze({
        uploadId,
        storageKey,
        originalFilename,
        mimeType,
        sizeBytes: command.content.byteLength,
        checksumSha256,
        createdAt,
        expiresAt,
      });

    await this.storage.store({
      storageKey,
      content: command.content,
    });

    try {
      await this.uploads.create({
        upload,
      });
    } catch (error) {
      try {
        await this.storage.delete(storageKey);
      } catch {
        // Preserve the staging persistence failure as the primary error.
      }

      throw error;
    }

    return Object.freeze({
      uploadId,
      originalFilename,
      mimeType,
      sizeBytes: upload.sizeBytes,
      checksumSha256,
      expiresAt,
    });
  }
}