import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  pgPolicy,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const agencyOnboarding = pgSchema("agency_onboarding");

export const agencyRegistrations = agencyOnboarding.table(
  "agency_registrations",
  {
    registrationId: uuid("registration_id").primaryKey(),
    status: text("status").notNull(),

    agencyLegalName: text("agency_legal_name").notNull(),
    agencyTradeName: text("agency_trade_name"),
    registrationNumber: text("registration_number").notNull(),
    taxIdentifier: text("tax_identifier"),

    phone: text("phone").notNull(),
    email: text("email").notNull(),
    website: text("website"),

    address: text("address").notNull(),
    city: text("city").notNull(),
    countryCode: text("country_code").notNull(),

    contactFirstName: text("contact_first_name").notNull(),
    contactLastName: text("contact_last_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone").notNull(),

    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    reviewStartedAt: timestamp("review_started_at", {
      withTimezone: true,
      mode: "string",
    }),
    reviewedByIdentityId: uuid("reviewed_by_identity_id"),

    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "string",
    }),
    rejectedAt: timestamp("rejected_at", {
      withTimezone: true,
      mode: "string",
    }),
    rejectionReason: text("rejection_reason"),

    approvalProvisioningStartedAt: timestamp(
      "approval_provisioning_started_at",
      {
        withTimezone: true,
        mode: "string",
      },
    ),

    provisionedTenantId: uuid("provisioned_tenant_id"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    correlationId: uuid("correlation_id").notNull(),
  },
  (table) => [
    uniqueIndex("agency_registrations_registration_number_unique")
      .on(table.registrationNumber),

    index("agency_registrations_status_submitted_idx")
      .on(table.status, table.submittedAt.desc(), table.registrationId.desc()),

    uniqueIndex("agency_registrations_provisioned_tenant_unique")
      .on(table.provisionedTenantId)
      .where(sql`${table.provisionedTenantId} IS NOT NULL`),

    check(
      "agency_registrations_status_check",
      sql`${table.status} IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')`,
    ),

    check(
      "agency_registrations_country_check",
      sql`${table.countryCode} ~ '^[A-Z]{2}$'`,
    ),

    check(
      "agency_registrations_legal_name_check",
      sql`char_length(btrim(${table.agencyLegalName})) BETWEEN 1 AND 200`,
    ),

    check(
      "agency_registrations_registration_number_check",
      sql`char_length(btrim(${table.registrationNumber})) BETWEEN 1 AND 100`,
    ),

    check(
      "agency_registrations_rejection_reason_check",
      sql`${table.rejectionReason} IS NULL
        OR char_length(btrim(${table.rejectionReason})) BETWEEN 1 AND 2000`,
    ),

    check(
      "agency_registrations_lifecycle_check",
      sql`
        (
          ${table.status} = 'SUBMITTED'
          AND ${table.reviewStartedAt} IS NULL
          AND ${table.reviewedByIdentityId} IS NULL
          AND ${table.approvedAt} IS NULL
          AND ${table.rejectedAt} IS NULL
          AND ${table.rejectionReason} IS NULL
          AND ${table.approvalProvisioningStartedAt} IS NULL
          AND ${table.provisionedTenantId} IS NULL
        )
        OR
        (
          ${table.status} = 'UNDER_REVIEW'
          AND ${table.reviewStartedAt} IS NOT NULL
          AND ${table.reviewedByIdentityId} IS NOT NULL
          AND ${table.approvedAt} IS NULL
          AND ${table.rejectedAt} IS NULL
          AND ${table.rejectionReason} IS NULL
          AND ${table.provisionedTenantId} IS NULL
        )
        OR
        (
          ${table.status} = 'APPROVED'
          AND ${table.reviewStartedAt} IS NOT NULL
          AND ${table.reviewedByIdentityId} IS NOT NULL
          AND ${table.approvedAt} IS NOT NULL
          AND ${table.rejectedAt} IS NULL
          AND ${table.rejectionReason} IS NULL
          AND ${table.approvalProvisioningStartedAt} IS NOT NULL
          AND ${table.provisionedTenantId} IS NOT NULL
        )
        OR
        (
          ${table.status} = 'REJECTED'
          AND ${table.reviewStartedAt} IS NOT NULL
          AND ${table.reviewedByIdentityId} IS NOT NULL
          AND ${table.approvedAt} IS NULL
          AND ${table.rejectedAt} IS NOT NULL
          AND ${table.rejectionReason} IS NOT NULL
          AND ${table.approvalProvisioningStartedAt} IS NULL
          AND ${table.provisionedTenantId} IS NULL
        )
      `,
    ),

    pgPolicy("agency_registrations_platform_select", {
      for: "select",
      using: sql`
        current_setting('app.platform_capability', true)
          IN (
            'agency-registration:retrieve',
            'agency-registration:review',
            'agency-registration:decide'
          )
      `,
    }),

    pgPolicy("agency_registrations_platform_update", {
      for: "update",
      using: sql`
        current_setting('app.platform_capability', true)
          IN ('agency-registration:review', 'agency-registration:decide')
      `,
      withCheck: sql`
        current_setting('app.platform_capability', true)
          IN ('agency-registration:review', 'agency-registration:decide')
      `,
    }),

    pgPolicy("agency_registrations_public_submit", {
      for: "insert",
      withCheck: sql`
        current_setting('app.platform_capability', true)
          = 'agency-registration:submit'
        AND ${table.status} = 'SUBMITTED'
      `,
    }),
  ],
).enableRLS();

export const agencyRegistrationDocumentUploads = agencyOnboarding.table(
  "agency_registration_document_uploads",
  {
    uploadId: uuid("upload_id").primaryKey(),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksumSha256: text("checksum_sha256").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    consumedAt: timestamp("consumed_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    uniqueIndex(
      "agency_registration_document_uploads_storage_key_unique",
    ).on(table.storageKey),

    index("agency_registration_document_uploads_expiry_idx")
      .on(table.expiresAt, table.uploadId)
      .where(sql`${table.consumedAt} IS NULL`),

    check(
      "agency_registration_document_uploads_storage_key_check",
      sql`char_length(btrim(${table.storageKey})) BETWEEN 1 AND 1000`,
    ),

    check(
      "agency_registration_document_uploads_filename_check",
      sql`char_length(btrim(${table.originalFilename})) BETWEEN 1 AND 255`,
    ),

    check(
      "agency_registration_document_uploads_mime_type_check",
      sql`char_length(btrim(${table.mimeType})) BETWEEN 1 AND 255`,
    ),

    check(
      "agency_registration_document_uploads_size_check",
      sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 52428800`,
    ),

    check(
      "agency_registration_document_uploads_checksum_check",
      sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),

    check(
      "agency_registration_document_uploads_expiry_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),

    check(
      "agency_registration_document_uploads_consumed_check",
      sql`
        ${table.consumedAt} IS NULL
        OR ${table.consumedAt} >= ${table.createdAt}
      `,
    ),

    pgPolicy("agency_registration_document_uploads_public_submit", {
      for: "all",
      using: sql`
        current_setting('app.platform_capability', true)
          = 'agency-registration:submit'
      `,
      withCheck: sql`
        current_setting('app.platform_capability', true)
          = 'agency-registration:submit'
      `,
    }),
  ],
).enableRLS();
export const agencyRegistrationAdministrators = agencyOnboarding.table(
  "agency_registration_administrators",
  {
    registrationId: uuid("registration_id").primaryKey(),

    tenantId: uuid("tenant_id").notNull(),

    internalIdentityId: uuid("internal_identity_id").notNull(),

    administratorKind: text("administrator_kind").notNull(),

    status: text("status").notNull(),

    bootstrapTokenHash: text("bootstrap_token_hash").notNull(),

    bootstrapTokenExpiresAt: timestamp("bootstrap_token_expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    bootstrapTokenConsumedAt: timestamp("bootstrap_token_consumed_at", {
      withTimezone: true,
      mode: "string",
    }),

    createdByPlatformIdentityId: uuid(
      "created_by_platform_identity_id",
    ).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    identityLinkedAt: timestamp("identity_linked_at", {
      withTimezone: true,
      mode: "string",
    }),

    activatedAt: timestamp("activated_at", {
      withTimezone: true,
      mode: "string",
    }),

    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.registrationId],
      foreignColumns: [agencyRegistrations.registrationId],
      name: "agency_registration_administrators_registration_fk",
    }),

    uniqueIndex(
      "agency_registration_administrators_tenant_unique",
    ).on(table.tenantId),

    uniqueIndex(
      "agency_registration_administrators_identity_unique",
    ).on(table.internalIdentityId),

    uniqueIndex(
      "agency_registration_administrators_token_hash_unique",
    ).on(table.bootstrapTokenHash),

    index("agency_registration_administrators_pending_token_idx")
      .on(table.bootstrapTokenExpiresAt, table.registrationId)
      .where(
        sql`
          ${table.bootstrapTokenConsumedAt} IS NULL
          AND ${table.status} = 'PENDING_IDENTITY'
        `,
      ),

    check(
      "agency_registration_administrators_kind_check",
      sql`${table.administratorKind} = 'FIRST_ADMINISTRATOR'`,
    ),

    check(
      "agency_registration_administrators_status_check",
      sql`
        ${table.status} IN (
          'PENDING_IDENTITY',
          'IDENTITY_LINKED',
          'ACTIVE',
          'CANCELLED'
        )
      `,
    ),

    check(
      "agency_registration_administrators_token_hash_check",
      sql`${table.bootstrapTokenHash} ~ '^[0-9a-f]{64}$'`,
    ),

    check(
      "agency_registration_administrators_expiry_check",
      sql`${table.bootstrapTokenExpiresAt} > ${table.createdAt}`,
    ),

    check(
      "agency_registration_administrators_consumed_check",
      sql`
        ${table.bootstrapTokenConsumedAt} IS NULL
        OR ${table.bootstrapTokenConsumedAt} >= ${table.createdAt}
      `,
    ),

    check(
      "agency_registration_administrators_lifecycle_check",
      sql`
        (
          ${table.status} = 'PENDING_IDENTITY'
          AND ${table.identityLinkedAt} IS NULL
          AND ${table.activatedAt} IS NULL
          AND ${table.cancelledAt} IS NULL
        )
        OR
        (
          ${table.status} = 'IDENTITY_LINKED'
          AND ${table.identityLinkedAt} IS NOT NULL
          AND ${table.activatedAt} IS NULL
          AND ${table.cancelledAt} IS NULL
        )
        OR
        (
          ${table.status} = 'ACTIVE'
          AND ${table.identityLinkedAt} IS NOT NULL
          AND ${table.activatedAt} IS NOT NULL
          AND ${table.cancelledAt} IS NULL
        )
        OR
        (
          ${table.status} = 'CANCELLED'
          AND ${table.activatedAt} IS NULL
          AND ${table.cancelledAt} IS NOT NULL
        )
      `,
    ),

    pgPolicy("agency_registration_administrators_platform_manage", {
      for: "all",
      using: sql`
        current_setting('app.platform_capability', true)
          = 'agency-registration:administrator'
      `,
      withCheck: sql`
        current_setting('app.platform_capability', true)
          = 'agency-registration:administrator'
      `,
    }),
  ],
).enableRLS();
export const agencyRegistrationDocuments = agencyOnboarding.table(
  "agency_registration_documents",
  {
    documentId: uuid("document_id").primaryKey(),
    registrationId: uuid("registration_id").notNull(),

    documentType: text("document_type").notNull(),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksumSha256: text("checksum_sha256").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    foreignKey({
      name: "agency_registration_documents_registration_fk",
      columns: [table.registrationId],
      foreignColumns: [agencyRegistrations.registrationId],
    }),

    index("agency_registration_documents_registration_idx")
      .on(table.registrationId, table.createdAt, table.documentId),

    uniqueIndex("agency_registration_documents_storage_key_unique")
      .on(table.storageKey),

    check(
      "agency_registration_documents_type_check",
      sql`char_length(btrim(${table.documentType})) BETWEEN 1 AND 100`,
    ),

    check(
      "agency_registration_documents_filename_check",
      sql`char_length(btrim(${table.originalFilename})) BETWEEN 1 AND 255`,
    ),

    check(
      "agency_registration_documents_storage_key_check",
      sql`char_length(btrim(${table.storageKey})) BETWEEN 1 AND 1000`,
    ),

    check(
      "agency_registration_documents_size_check",
      sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 52428800`,
    ),

    check(
      "agency_registration_documents_checksum_check",
      sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),

    pgPolicy("agency_registration_documents_platform_select", {
      for: "select",
      using: sql`
        current_setting('app.platform_capability', true)
          IN (
            'agency-registration:retrieve',
            'agency-registration:review',
            'agency-registration:decide'
          )
      `,
    }),

    pgPolicy("agency_registration_documents_public_submit", {
      for: "insert",
      withCheck: sql`
        current_setting('app.platform_capability', true)
          = 'agency-registration:submit'
      `,
    }),
  ],
).enableRLS();