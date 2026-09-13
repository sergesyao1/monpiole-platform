const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const PROPERTY_INQUIRY_COMMUNICATION_CHANNELS = [
  "PHONE",
  "SMS",
  "EMAIL",
] as const;

export type PropertyInquiryCommunicationChannel =
  typeof PROPERTY_INQUIRY_COMMUNICATION_CHANNELS[number];

export const PROPERTY_INQUIRY_COMMUNICATION_DIRECTIONS = [
  "OUTBOUND",
  "INBOUND",
] as const;

export type PropertyInquiryCommunicationDirection =
  typeof PROPERTY_INQUIRY_COMMUNICATION_DIRECTIONS[number];

export const PROPERTY_INQUIRY_COMMUNICATION_STATUSES = [
  "RECORDED",
  "SENT",
  "FAILED",
] as const;

export type PropertyInquiryCommunicationStatus =
  typeof PROPERTY_INQUIRY_COMMUNICATION_STATUSES[number];

export interface PropertyInquiryCommunicationValues {
  readonly communicationId: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly inquiryId: string;

  readonly channel: PropertyInquiryCommunicationChannel;
  readonly direction: PropertyInquiryCommunicationDirection;
  readonly status: PropertyInquiryCommunicationStatus;

  readonly summary?: string;

  readonly occurredAt: string;
  readonly performedByActorId: string;
  readonly createdAt: string;
}

export class InvalidPropertyInquiryCommunicationInputError extends Error {
  readonly code = "INVALID_PROPERTY_INQUIRY_COMMUNICATION_INPUT";

  constructor(readonly field: string) {
    super(`Invalid Property inquiry communication ${field}`);
  }
}

export class PropertyInquiryCommunication {
  private constructor(
    readonly values: Readonly<PropertyInquiryCommunicationValues>,
  ) {}

  static create(
    input: PropertyInquiryCommunicationValues,
  ): PropertyInquiryCommunication {
    return new PropertyInquiryCommunication(validate(input));
  }

  static rehydrate(
    values: PropertyInquiryCommunicationValues,
  ): PropertyInquiryCommunication {
    return new PropertyInquiryCommunication(validate(values));
  }
}

function validate(
  input: PropertyInquiryCommunicationValues,
): Readonly<PropertyInquiryCommunicationValues> {
  for (
    const [field, value] of [
      ["communicationId", input.communicationId],
      ["tenantId", input.tenantId],
      ["propertyId", input.propertyId],
      ["inquiryId", input.inquiryId],
    ] as const
  ) {
    if (!UUID.test(value)) {
      throw new InvalidPropertyInquiryCommunicationInputError(field);
    }
  }

  if (!PROPERTY_INQUIRY_COMMUNICATION_CHANNELS.includes(input.channel)) {
    throw new InvalidPropertyInquiryCommunicationInputError("channel");
  }

  if (!PROPERTY_INQUIRY_COMMUNICATION_DIRECTIONS.includes(input.direction)) {
    throw new InvalidPropertyInquiryCommunicationInputError("direction");
  }

  if (!PROPERTY_INQUIRY_COMMUNICATION_STATUSES.includes(input.status)) {
    throw new InvalidPropertyInquiryCommunicationInputError("status");
  }

  const summary =
    input.summary === undefined
      ? undefined
      : bounded(input.summary, "summary", 2_000);

  const performedByActorId = bounded(
    input.performedByActorId,
    "performedByActorId",
    200,
  );

  if (!instant(input.occurredAt)) {
    throw new InvalidPropertyInquiryCommunicationInputError("occurredAt");
  }

  if (!instant(input.createdAt)) {
    throw new InvalidPropertyInquiryCommunicationInputError("createdAt");
  }

  if (Date.parse(input.occurredAt) > Date.parse(input.createdAt)) {
    throw new InvalidPropertyInquiryCommunicationInputError("occurredAt");
  }

  return Object.freeze({
    ...input,
    performedByActorId,
    ...(summary === undefined ? {} : { summary }),
  });
}

function bounded(value: string, field: string, max: number): string {
  const normalized = value.trim();

  if (normalized.length < 1 || normalized.length > max) {
    throw new InvalidPropertyInquiryCommunicationInputError(field);
  }

  return normalized;
}

function instant(value: string): boolean {
  return value.endsWith("Z") && Number.isFinite(Date.parse(value));
}