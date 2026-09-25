import {
  PropertyInquiryCommunication,
  type PropertyInquiryCommunicationChannel,
  type PropertyInquiryCommunicationDirection,
} from "../domain/property-inquiry-communication.js";
import {
  type PropertyInquiryCommunicationCursor,
  type PropertyInquiryCommunicationPage,
  type PropertyInquiryCommunicationRepository,
} from "./property-inquiry-communication-repository.js";
import {
  authorizedTenant,
  type PropertyAuthority,
} from "./property-authority.js";

export class PropertyInquiryCommunicationNotFoundError extends Error {
  readonly code = "PROPERTY_INQUIRY_COMMUNICATION_NOT_FOUND";
}

export class InvalidPropertyInquiryCommunicationListError extends Error {
  readonly code = "INVALID_PROPERTY_INQUIRY_COMMUNICATION_LIST";
}

export interface RecordPropertyInquiryCommunicationCommand {
  readonly authority: PropertyAuthority;
  readonly propertyId: string;
  readonly inquiryId: string;
  readonly channel: PropertyInquiryCommunicationChannel;
  readonly direction: PropertyInquiryCommunicationDirection;
  readonly summary?: string;
  readonly occurredAt?: string;
  readonly correlationId: string;
}

export interface ListPropertyInquiryCommunicationsQuery {
  readonly authority: PropertyAuthority;
  readonly propertyId: string;
  readonly inquiryId: string;
  readonly limit?: number;
  readonly cursor?: PropertyInquiryCommunicationCursor;
}

export class RecordPropertyInquiryCommunication {
  constructor(
    private readonly repository: PropertyInquiryCommunicationRepository,
    private readonly ids: { generate(): string },
    private readonly clock: { now(): string },
  ) {}

  async execute(
    command: Readonly<RecordPropertyInquiryCommunicationCommand>,
  ): Promise<PropertyInquiryCommunication> {
    const tenantId = authorizedTenant(
      command.authority,
      "MANAGE_PROPERTY_INQUIRIES",
    );

    const now = this.clock.now();

    const communication = PropertyInquiryCommunication.create({
      communicationId: this.ids.generate(),
      tenantId,
      propertyId: command.propertyId,
      inquiryId: command.inquiryId,
      channel: command.channel,
      direction: command.direction,

      // A manual back-office action only records an interaction.
      // SENT / FAILED remain reserved for future delivery integrations.
      status: "RECORDED",

      ...(command.summary === undefined
        ? {}
        : { summary: command.summary }),

      occurredAt: command.occurredAt ?? now,

      // Never supplied by the caller.
      performedByActorId: command.authority.actorId,

      createdAt: now,
    });

    const result = await this.repository.record(
      communication,
      {
        correlationId: command.correlationId,
        actorId: command.authority.actorId,
      },
    );

    if (result === "INQUIRY_NOT_FOUND") {
      throw new PropertyInquiryCommunicationNotFoundError();
    }

    return communication;
  }
}

export class ListPropertyInquiryCommunications {
  constructor(
    private readonly repository: PropertyInquiryCommunicationRepository,
  ) {}

  async execute(
    query: Readonly<ListPropertyInquiryCommunicationsQuery>,
  ): Promise<PropertyInquiryCommunicationPage> {
    const tenantId = authorizedTenant(
      query.authority,
      "RETRIEVE_PROPERTY_INQUIRY",
    );

    const limit = query.limit ?? 20;

    if (
      !Number.isInteger(limit)
      || limit < 1
      || limit > 100
    ) {
      throw new InvalidPropertyInquiryCommunicationListError();
    }

    const page = await this.repository.list(
      tenantId,
      query.propertyId,
      query.inquiryId,
      limit,
      query.cursor,
    );

    if (page === undefined) {
      throw new PropertyInquiryCommunicationNotFoundError();
    }

    return page;
  }
}