import { Buffer } from "node:buffer";
import type { PropertyClientDirectoryCursor, PropertyContractCursor } from "@monpiole/property-management";
import { z } from "zod";

import { TransportValidationException } from "../errors/transport-validation.exception.js";

const InstantSchema = z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z"));
const ClientCursorSchema = z.object({ createdAt: InstantSchema, clientId: z.uuid() }).strict();
const ContractCursorSchema = z.object({ createdAt: InstantSchema, contractId: z.uuid() }).strict();
const BASE64URL = /^[A-Za-z0-9_-]+$/u;

export function encodePropertyClientCursor(cursor: PropertyClientDirectoryCursor): string { return encode(cursor); }
export function decodePropertyClientCursor(value: string | undefined): PropertyClientDirectoryCursor | undefined {
  return decode(value, ClientCursorSchema);
}
export function encodePropertyContractCursor(cursor: PropertyContractCursor): string { return encode(cursor); }
export function decodePropertyContractCursor(value: string | undefined): PropertyContractCursor | undefined {
  return decode(value, ContractCursorSchema);
}

function encode(value: object): string { return Buffer.from(JSON.stringify(value), "utf8").toString("base64url"); }
function decode<T>(value: string | undefined, schema: z.ZodType<T>): T | undefined {
  if (value === undefined) return undefined;
  try {
    if (!BASE64URL.test(value)) throw new Error("Invalid encoding");
    const decoded = Buffer.from(value, "base64url");
    if (decoded.toString("base64url") !== value) throw new Error("Non-canonical encoding");
    return schema.parse(JSON.parse(decoded.toString("utf8")));
  } catch {
    throw new TransportValidationException([{ path: "query.cursor", code: "invalid" }]);
  }
}
