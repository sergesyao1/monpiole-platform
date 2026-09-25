import { createHash } from "node:crypto";

const FIRST_ADMINISTRATOR_CORRELATION_NAMESPACE =
  "monpiole:agency-onboarding:first-administrator:v1";

export function agencyFirstAdministratorCorrelationId(
  registrationId: string,
): string {
  const normalizedRegistrationId =
    registrationId.trim().toLowerCase();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      .test(normalizedRegistrationId)
  ) {
    throw new Error(
      "First administrator registrationId must be a UUID.",
    );
  }

  const digest = createHash("sha256")
    .update(
      `${FIRST_ADMINISTRATOR_CORRELATION_NAMESPACE}:${normalizedRegistrationId}`,
      "utf8",
    )
    .digest();

  const bytes = Buffer.from(digest.subarray(0, 16));

  // RFC 4122-compatible deterministic UUID:
  // version 5 bits + RFC variant bits.
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = bytes.toString("hex");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}