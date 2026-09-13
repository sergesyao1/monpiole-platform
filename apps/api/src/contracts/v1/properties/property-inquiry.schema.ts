import { z } from "zod";

export const PropertyInquiryStatusSchema = z.enum([
  "NEW",
  "ACKNOWLEDGED",
  "CLOSED",
]);

export const PropertyInquiryIntentSchema = z.enum([
  "CONTACT",
  "VIEWING_REQUEST",
]);

export const PropertyInquiryPreferredContactChannelSchema = z.enum([
  "PHONE",
  "SMS",
  "EMAIL",
]);

export const SubmitPropertyInquiryRequestSchema = z
  .object({
    contactName: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320).optional(),
    phoneNumber: z.string().trim().min(1).max(100).optional(),
    message: z.string().trim().min(1).max(2000).optional(),

    intent: PropertyInquiryIntentSchema,
    preferredContactChannel:
      PropertyInquiryPreferredContactChannelSchema.optional(),

    consent: z.literal(true),
    consentVersion: z.string().trim().min(1).max(50),
    idempotencyKey: z.string().trim().min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.email === undefined &&
      value.phoneNumber === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "A contact channel is required",
        path: ["email"],
      });
    }

    if (
      value.preferredContactChannel === "EMAIL" &&
      value.email === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Email is required for EMAIL preferred contact",
        path: ["preferredContactChannel"],
      });
    }

    if (
      (
        value.preferredContactChannel === "PHONE" ||
        value.preferredContactChannel === "SMS"
      ) &&
      value.phoneNumber === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Phone number is required for PHONE or SMS preferred contact",
        path: ["preferredContactChannel"],
      });
    }
  });

export const PublicPropertyInquiryResponseSchema = z
  .object({
    inquiryId: z.string().uuid(),
    receivedAt: z.string().datetime(),
  })
  .strict();

export const PropertyInquirySchema = z
  .object({
    inquiryId: z.string().uuid(),
    propertyId: z.string().uuid(),

    contactName: z.string(),
    email: z.string().email().optional(),
    phoneNumber: z.string().optional(),
    message: z.string().optional(),

    intent: PropertyInquiryIntentSchema,
    preferredContactChannel:
      PropertyInquiryPreferredContactChannelSchema.optional(),

    consentVersion: z.string(),
    consentGivenAt: z.string().datetime(),

    status: PropertyInquiryStatusSchema,

    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    acknowledgedAt: z.string().datetime().optional(),
    closedAt: z.string().datetime().optional(),
  })
  .strict();

export const PropertyInquiryListSchema = z
  .object({
    items: z.array(PropertyInquirySchema),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      nextCursor: z.string().nullable(),
    }),
  })
  .strict();

export const PropertyInquiryPublicPathSchema = z.object({
  publicPropertyId: z.string().uuid(),
});

export const PropertyInquiryPropertyPathSchema = z.object({
  propertyId: z.string().uuid(),
});

export const PropertyInquiryPathSchema = z.object({
  propertyId: z.string().uuid(),
  inquiryId: z.string().uuid(),
});

export const PropertyInquiryListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(512).optional(),
  status: PropertyInquiryStatusSchema.optional(),
});

export type PropertyInquiryResponse =
  z.infer<typeof PropertyInquirySchema>;

export type PropertyInquiryList =
  z.infer<typeof PropertyInquiryListSchema>;

export type PublicPropertyInquiryResponse =
  z.infer<typeof PublicPropertyInquiryResponseSchema>;
