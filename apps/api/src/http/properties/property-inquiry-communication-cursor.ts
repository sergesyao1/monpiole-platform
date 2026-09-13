import { Buffer } from "node:buffer";
import { z } from "zod";
import type {
  PropertyInquiryCommunicationCursor,
} from "@monpiole/property-management";

import {
  TransportValidationException,
} from "../errors/transport-validation.exception.js";

const BASE64URL = /^[A-Za-z0-9_-]+$/u;

const CursorSchema = z.object({
  occurredAt: z.string().datetime(),
  communicationId: z.string().uuid(),
}).strict();

export function encodePropertyInquiryCommunicationCursor(
  cursor: PropertyInquiryCommunicationCursor,
): string {
  return Buffer.from(
    JSON.stringify(cursor),
    "utf8",
  ).toString("base64url");
}

export function decodePropertyInquiryCommunicationCursor(
  value: string,
): PropertyInquiryCommunicationCursor {
  try {
    if (!BASE64URL.test(value)) {
      throw new Error("Invalid encoding");
    }

    const decoded = Buffer.from(
      value,
      "base64url",
    );

    if (decoded.toString("base64url") !== value) {
      throw new Error("Non-canonical encoding");
    }

    return CursorSchema.parse(
      JSON.parse(decoded.toString("utf8")),
    );
  } catch {
    throw new TransportValidationException([
      {
        path: "query.cursor",
        code: "invalid",
      },
    ]);
  }
}