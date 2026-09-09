import { z } from "zod";import type{PropertyInquiryCursor}from"@monpiole/property-management";
const Schema=z.object({createdAt:z.string().datetime(),inquiryId:z.string().uuid()}).strict();
export function encodePropertyInquiryCursor(c:PropertyInquiryCursor):string{return Buffer.from(JSON.stringify(c)).toString("base64url");}
export function decodePropertyInquiryCursor(v:string):PropertyInquiryCursor{try{return Schema.parse(JSON.parse(Buffer.from(v,"base64url").toString("utf8")));}catch{throw new InvalidPropertyInquiryCursorError();}}
class InvalidPropertyInquiryCursorError extends Error{readonly code="INVALID_PROPERTY_INQUIRY_LIST";}
