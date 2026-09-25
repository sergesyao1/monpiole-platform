import { Buffer } from "node:buffer";
import { z } from "zod";
import type { PropertyPortfolioCursor } from "@monpiole/property-management";

import { TransportValidationException } from "../errors/transport-validation.exception.js";

const CursorPayloadSchema = z.object({
  createdAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
  propertyId: z.uuid(),
}).strict();
const BASE64URL = /^[A-Za-z0-9_-]+$/u;

export function encodePropertyPortfolioCursor(cursor: PropertyPortfolioCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodePropertyPortfolioCursor(value: string | undefined): PropertyPortfolioCursor | undefined {
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
