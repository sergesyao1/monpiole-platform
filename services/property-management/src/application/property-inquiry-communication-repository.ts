import type {
  PropertyInquiryCommunication,
} from "../domain/property-inquiry-communication.js";

export interface PropertyInquiryCommunicationCursor {
  readonly occurredAt: string;
  readonly communicationId: string;
}

export interface PropertyInquiryCommunicationPage {
  readonly items: readonly PropertyInquiryCommunication[];
  readonly nextCursor?: PropertyInquiryCommunicationCursor;
}

export type RecordPropertyInquiryCommunicationResult =
  | "CREATED"
  | "INQUIRY_NOT_FOUND";

export interface PropertyInquiryCommunicationRepository {
  record(
    communication: PropertyInquiryCommunication,
    trace: Readonly<{
      correlationId: string;
      actorId: string;
    }>,
  ): Promise<RecordPropertyInquiryCommunicationResult>;

  list(
    tenantId: string,
    propertyId: string,
    inquiryId: string,
    limit: number,
    cursor?: PropertyInquiryCommunicationCursor,
  ): Promise<PropertyInquiryCommunicationPage | undefined>;
}