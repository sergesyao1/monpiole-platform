import { Buffer } from "node:buffer";
import type { PropertyOwnerDirectoryCursor } from "@monpiole/property-management";
import { z } from "zod";

import { TransportValidationException } from "../errors/transport-validation.exception.js";

const CursorPayloadSchema = z.object({
  createdAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
  ownerId: z.uuid(),
}).strict();
const BASE64URL = /^[A-Za-z0-9_-]+$/u;

export function encodePropertyOwnerDirectoryCursor(cursor: PropertyOwnerDirectoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodePropertyOwnerDirectoryCursor(value: string | undefined): PropertyOwnerDirectoryCursor | undefined {
  if (value === undefined) return undefined;
  try {
    if (!BASE64URL.test(value)) throw new Error("Invalid encoding");
    const decoded = Buffer.from(value, "base64url");
    if (decoded.toString("base64url") !== value) throw new Error("Non-canonical encoding");
    return CursorPayloadSchema.parse(JSON.parse(decoded.toString("utf8")));
  } catch {
    throw new TransportValidationException([{ path: "query.cursor", code: "invalid" }]);
  }
}
