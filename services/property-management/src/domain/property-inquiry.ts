const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export const PROPERTY_INQUIRY_STATUSES = ["NEW", "ACKNOWLEDGED", "CLOSED"] as const;
export type PropertyInquiryStatus = typeof PROPERTY_INQUIRY_STATUSES[number];

export const PROPERTY_INQUIRY_INTENTS = ["CONTACT", "VIEWING_REQUEST"] as const;
export type PropertyInquiryIntent = typeof PROPERTY_INQUIRY_INTENTS[number];

export const PROPERTY_INQUIRY_PREFERRED_CONTACT_CHANNELS = ["PHONE", "SMS", "EMAIL"] as const;
export type PropertyInquiryPreferredContactChannel =
  typeof PROPERTY_INQUIRY_PREFERRED_CONTACT_CHANNELS[number];

export interface PropertyInquiryValues {
  readonly inquiryId: string;
  readonly tenantId: string;
  readonly propertyId: string;

  readonly contactName: string;
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly message?: string;

  readonly intent: PropertyInquiryIntent;
  readonly preferredContactChannel?: PropertyInquiryPreferredContactChannel;

  readonly consentVersion: string;
  readonly consentGivenAt: string;
  readonly idempotencyKey: string;

  readonly status: PropertyInquiryStatus;

  readonly createdAt: string;
  readonly updatedAt: string;
  readonly acknowledgedAt?: string;
  readonly closedAt?: string;
}

type CreatePropertyInquiryValues =
  Omit<
    PropertyInquiryValues,
    "status" | "acknowledgedAt" | "closedAt" | "intent"
  > & {
    readonly intent?: PropertyInquiryIntent;
  };

export class InvalidPropertyInquiryInputError extends Error {
  readonly code = "INVALID_PROPERTY_INQUIRY_INPUT";

  constructor(readonly field: string) {
    super(`Invalid Property inquiry ${field}`);
  }
}

export class PropertyInquiryTransitionNotAllowedError extends Error {
  readonly code = "PROPERTY_INQUIRY_TRANSITION_NOT_ALLOWED";
}

export class PropertyInquiry {
  private constructor(readonly values: Readonly<PropertyInquiryValues>) {}

  static create(input: CreatePropertyInquiryValues): PropertyInquiry {
    return new PropertyInquiry(
      validate({
        ...input,
        intent: input.intent ?? "CONTACT",
        status: "NEW",
      }),
    );
  }

  static rehydrate(input: PropertyInquiryValues): PropertyInquiry {
    return new PropertyInquiry(validate(input));
  }

  acknowledge(at: string): PropertyInquiry {
    if (this.values.status === "ACKNOWLEDGED") return this;

    if (this.values.status !== "NEW") {
      throw new PropertyInquiryTransitionNotAllowedError();
    }

    return new PropertyInquiry(
      validate({
        ...this.values,
        status: "ACKNOWLEDGED",
        acknowledgedAt: at,
        updatedAt: at,
      }),
    );
  }

  close(at: string): PropertyInquiry {
    if (this.values.status === "CLOSED") return this;

    return new PropertyInquiry(
      validate({
        ...this.values,
        status: "CLOSED",
        closedAt: at,
        updatedAt: at,
      }),
    );
  }
}

function validate(input: PropertyInquiryValues): Readonly<PropertyInquiryValues> {
  for (
    const [field, value] of [
      ["inquiryId", input.inquiryId],
      ["tenantId", input.tenantId],
      ["propertyId", input.propertyId],
    ] as const
  ) {
    if (!UUID.test(value)) {
      throw new InvalidPropertyInquiryInputError(field);
    }
  }

  const contactName = bounded(input.contactName, "contactName", 200);

  const email = input.email?.trim().toLowerCase();

  if (
    email !== undefined &&
    (email.length > 320 || !EMAIL.test(email))
  ) {
    throw new InvalidPropertyInquiryInputError("email");
  }

  const phoneNumber =
    input.phoneNumber === undefined
      ? undefined
      : bounded(input.phoneNumber, "phoneNumber", 100);

  if (email === undefined && phoneNumber === undefined) {
    throw new InvalidPropertyInquiryInputError("contact");
  }

  const message =
    input.message === undefined
      ? undefined
      : bounded(input.message, "message", 2_000);

  if (!PROPERTY_INQUIRY_INTENTS.includes(input.intent)) {
    throw new InvalidPropertyInquiryInputError("intent");
  }

  const preferredContactChannel = input.preferredContactChannel;

  if (
    preferredContactChannel !== undefined &&
    !PROPERTY_INQUIRY_PREFERRED_CONTACT_CHANNELS.includes(
      preferredContactChannel,
    )
  ) {
    throw new InvalidPropertyInquiryInputError(
      "preferredContactChannel",
    );
  }

  if (
    preferredContactChannel === "EMAIL" &&
    email === undefined
  ) {
    throw new InvalidPropertyInquiryInputError(
      "preferredContactChannel",
    );
  }

  if (
    (preferredContactChannel === "PHONE" ||
      preferredContactChannel === "SMS") &&
    phoneNumber === undefined
  ) {
    throw new InvalidPropertyInquiryInputError(
      "preferredContactChannel",
    );
  }

  const consentVersion = bounded(
    input.consentVersion,
    "consentVersion",
    50,
  );

  const idempotencyKey = bounded(
    input.idempotencyKey,
    "idempotencyKey",
    100,
  );

  if (!PROPERTY_INQUIRY_STATUSES.includes(input.status)) {
    throw new InvalidPropertyInquiryInputError("status");
  }

  for (
    const [field, value] of [
      ["consentGivenAt", input.consentGivenAt],
      ["createdAt", input.createdAt],
      ["updatedAt", input.updatedAt],
    ] as const
  ) {
    if (!instant(value)) {
      throw new InvalidPropertyInquiryInputError(field);
    }
  }

  const acknowledgedAt = input.acknowledgedAt;
  const closedAt = input.closedAt;

  if (
    acknowledgedAt !== undefined &&
    !instant(acknowledgedAt)
  ) {
    throw new InvalidPropertyInquiryInputError("acknowledgedAt");
  }

  if (
    closedAt !== undefined &&
    !instant(closedAt)
  ) {
    throw new InvalidPropertyInquiryInputError("closedAt");
  }

  if (
    (
      input.status === "NEW" &&
      (acknowledgedAt !== undefined || closedAt !== undefined)
    ) ||
    (
      input.status === "ACKNOWLEDGED" &&
      (acknowledgedAt === undefined || closedAt !== undefined)
    ) ||
    (
      input.status === "CLOSED" &&
      closedAt === undefined
    )
  ) {
    throw new InvalidPropertyInquiryInputError("status");
  }

  return Object.freeze({
    ...input,
    contactName,
    intent: input.intent,
    consentVersion,
    idempotencyKey,

    ...(email === undefined ? {} : { email }),
    ...(phoneNumber === undefined ? {} : { phoneNumber }),
    ...(message === undefined ? {} : { message }),

    ...(preferredContactChannel === undefined
      ? {}
      : { preferredContactChannel }),
  });
}

function bounded(
  value: string,
  field: string,
  max: number,
): string {
  const result = value.trim();

  if (result.length < 1 || result.length > max) {
    throw new InvalidPropertyInquiryInputError(field);
  }

  return result;
}

function instant(value: string): boolean {
  return value.endsWith("Z") && Number.isFinite(Date.parse(value));
}
