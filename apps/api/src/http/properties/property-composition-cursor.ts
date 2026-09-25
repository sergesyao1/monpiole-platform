import { Buffer } from "node:buffer";
import type { CompositionCursor } from "@monpiole/property-management";
import { z } from "zod";
import { TransportValidationException } from "../errors/transport-validation.exception.js";
import { CanonicalStructuralCodeSchema } from "../../contracts/v1/properties/property-composition.schema.js";
const Payload = z.object({ code: CanonicalStructuralCodeSchema, id: z.uuid() }).strict();
export function encodeCompositionCursor(cursor: CompositionCursor): string { return Buffer.from(JSON.stringify(cursor)).toString("base64url"); }
export function decodeCompositionCursor(value?: string): CompositionCursor | undefined { if (value === undefined) return undefined; try { const decoded = Buffer.from(value, "base64url"); if (decoded.toString("base64url") !== value) throw new Error(); return Payload.parse(JSON.parse(decoded.toString())); } catch { throw new TransportValidationException([{ path: "query.cursor", code: "invalid" }]); } }
