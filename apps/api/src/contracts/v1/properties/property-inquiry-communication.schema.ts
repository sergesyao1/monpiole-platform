import { z } from "zod";

export const PropertyInquiryCommunicationChannelSchema = z.enum([
  "PHONE",
  "SMS",
  "EMAIL",
]);

export const PropertyInquiryCommunicationDirectionSchema = z.enum([
  "OUTBOUND",
  "INBOUND",
]);

export const PropertyInquiryCommunicationStatusSchema = z.enum([
  "RECORDED",
  "SENT",
  "FAILED",
]);

export const RecordPropertyInquiryCommunicationRequestSchema = z
  .object({
    channel: PropertyInquiryCommunicationChannelSchema,
    direction: PropertyInquiryCommunicationDirectionSchema,
    summary: z.string().trim().min(1).max(2000).optional(),
    occurredAt: z.string().datetime().optional(),
  })
  .strict();

export const PropertyInquiryCommunicationPathSchema = z
  .object({
    propertyId: z.string().uuid(),
    inquiryId: z.string().uuid(),
  })
  .strict();

export const PropertyInquiryCommunicationListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().max(512).optional(),
  })
  .strict();

export const PropertyInquiryCommunicationSchema = z
  .object({
    communicationId: z.string().uuid(),
    propertyId: z.string().uuid(),
    inquiryId: z.string().uuid(),
    channel: PropertyInquiryCommunicationChannelSchema,
    direction: PropertyInquiryCommunicationDirectionSchema,
    status: PropertyInquiryCommunicationStatusSchema,
    summary: z.string().optional(),
    occurredAt: z.string().datetime(),
    performedByActorId: z.string(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const PropertyInquiryCommunicationListSchema = z
  .object({
    items: z.array(PropertyInquiryCommunicationSchema),
    pageInfo: z
      .object({
        hasNextPage: z.boolean(),
        nextCursor: z.string().nullable(),
      })
      .strict(),
  })
  .strict();

export type PropertyInquiryCommunicationResponse =
  z.infer<typeof PropertyInquiryCommunicationSchema>;

export type PropertyInquiryCommunicationList =
  z.infer<typeof PropertyInquiryCommunicationListSchema>;