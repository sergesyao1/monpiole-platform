import type { PropertyInquiry, PropertyInquiryStatus } from "../domain/property-inquiry.js";
export interface PropertyInquiryCursor { readonly createdAt: string; readonly inquiryId: string; }
export interface PropertyInquiryPage { readonly items: readonly PropertyInquiry[]; readonly nextCursor?: PropertyInquiryCursor; }
export interface PropertyInquiryRepository {
  submitForPublishedProperty(inquiry: PropertyInquiry, publicPropertyId: string, trace: Readonly<{ correlationId: string; actorId: string }>): Promise<PropertyInquiry | undefined>;
  list(tenantId: string, propertyId: string, limit: number, cursor?: PropertyInquiryCursor, status?: PropertyInquiryStatus): Promise<PropertyInquiryPage | undefined>;
  find(tenantId: string, propertyId: string, inquiryId: string): Promise<PropertyInquiry | undefined>;
  update(tenantId: string, propertyId: string, inquiryId: string, change: (inquiry: PropertyInquiry) => PropertyInquiry, trace: Readonly<{ correlationId: string; actorId: string }>): Promise<PropertyInquiry | undefined>;
}
