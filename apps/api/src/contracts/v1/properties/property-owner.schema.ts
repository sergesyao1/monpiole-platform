import { z } from "zod";

export const PropertyOwnerIdSchema = z.uuid().meta({ id: "PropertyOwnerId" });
export const PropertyOwnerTypeSchema = z.enum(["INDIVIDUAL", "LEGAL_ENTITY"]);
const PhoneNumberSchema = z.string().trim().min(1).max(100);
const EmailSchema = z.email().max(320).transform((value) => value.toLowerCase());
const ContactShape = { phoneNumber: PhoneNumberSchema.optional(), email: EmailSchema.optional() };

export const IndividualPropertyOwnerInputSchema = z.object({
  ownerType: z.literal("INDIVIDUAL"),
  firstName: z.string().trim().min(1).max(200),
  lastName: z.string().trim().min(1).max(200),
  ...ContactShape,
}).strict();

export const LegalEntityPropertyOwnerInputSchema = z.object({
  ownerType: z.literal("LEGAL_ENTITY"),
  legalName: z.string().trim().min(1).max(300),
  registrationNumber: z.string().trim().min(1).max(200).optional(),
  ...ContactShape,
}).strict();

export const CreatePropertyOwnerRequestSchema = z.discriminatedUnion("ownerType", [
  IndividualPropertyOwnerInputSchema,
  LegalEntityPropertyOwnerInputSchema,
]).meta({ id: "CreatePropertyOwnerRequest" });

export const UpdatePropertyOwnerRequestSchema = z.discriminatedUnion("ownerType", [
  IndividualPropertyOwnerInputSchema,
  LegalEntityPropertyOwnerInputSchema,
]).meta({ id: "UpdatePropertyOwnerRequest" });

export const PropertyOwnerTransportInputSchema = z.object({
  ownerType: PropertyOwnerTypeSchema,
  firstName: z.string().trim().min(1).max(200).optional(),
  lastName: z.string().trim().min(1).max(200).optional(),
  legalName: z.string().trim().min(1).max(300).optional(),
  registrationNumber: z.string().trim().min(1).max(200).optional(),
  ...ContactShape,
}).strict().superRefine((value, context) => {
  const valid = value.ownerType === "INDIVIDUAL"
    ? value.firstName !== undefined && value.lastName !== undefined && value.legalName === undefined && value.registrationNumber === undefined
    : value.legalName !== undefined && value.firstName === undefined && value.lastName === undefined;
  if (!valid) context.addIssue({ code: "custom", message: "Identity fields are incompatible with ownerType", path: ["ownerType"] });
});

const ServerFields = {
  ownerId: PropertyOwnerIdSchema,
  createdAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
  updatedAt: z.iso.datetime({ offset: false }).refine((value) => value.endsWith("Z")),
};

export const IndividualPropertyOwnerResponseSchema = IndividualPropertyOwnerInputSchema.extend(ServerFields).strict();
export const LegalEntityPropertyOwnerResponseSchema = LegalEntityPropertyOwnerInputSchema.extend(ServerFields).strict();
export const PropertyOwnerResponseSchema = z.discriminatedUnion("ownerType", [
  IndividualPropertyOwnerResponseSchema,
  LegalEntityPropertyOwnerResponseSchema,
]).meta({ id: "PropertyOwnerResponse" });

export const PropertyOwnerPathSchema = z.object({ ownerId: PropertyOwnerIdSchema }).strict().meta({ id: "PropertyOwnerPath" });

export type CreatePropertyOwnerRequest = z.output<typeof CreatePropertyOwnerRequestSchema>;
export type UpdatePropertyOwnerRequest = z.output<typeof UpdatePropertyOwnerRequestSchema>;
export type PropertyOwnerResponse = z.output<typeof PropertyOwnerResponseSchema>;
