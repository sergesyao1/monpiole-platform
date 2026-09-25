import{z}from"zod";
export const PropertyViewingStatusSchema=z.enum(["SCHEDULED","COMPLETED","CANCELLED"]);
export const PropertyViewingScheduleSchema=z.object({startsAt:z.string().datetime(),endsAt:z.string().datetime(),timeZone:z.string().trim().min(1).max(100)}).strict();
export const PropertyViewingSchema=z.object({viewingId:z.string().uuid(),propertyId:z.string().uuid(),inquiryId:z.string().uuid(),status:PropertyViewingStatusSchema,startsAt:z.string().datetime(),endsAt:z.string().datetime(),timeZone:z.string(),createdAt:z.string().datetime(),updatedAt:z.string().datetime(),completedAt:z.string().datetime().optional(),cancelledAt:z.string().datetime().optional()}).strict();
export const InquiryViewingSchema=z.object({viewing:PropertyViewingSchema.nullable()}).strict();
export const PropertyViewingInquiryPathSchema=z.object({propertyId:z.string().uuid(),inquiryId:z.string().uuid()});
export const PropertyViewingPathSchema=z.object({propertyId:z.string().uuid(),viewingId:z.string().uuid()});
export type PropertyViewingResponse=z.infer<typeof PropertyViewingSchema>;
