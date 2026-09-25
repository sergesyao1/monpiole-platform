import type { AgencyRegistration } from "../../../domain/agency-registration.js";

export interface AgencyRegistrationRow extends Record<string, unknown> {
  readonly registration_id: string;
  readonly status: AgencyRegistration["status"];

  readonly agency_legal_name: string;
  readonly agency_trade_name: string | null;
  readonly registration_number: string;
  readonly tax_identifier: string | null;

  readonly phone: string;
  readonly email: string;
  readonly website: string | null;

  readonly address: string;
  readonly city: string;
  readonly country_code: string;

  readonly contact_first_name: string;
  readonly contact_last_name: string;
  readonly contact_email: string;
  readonly contact_phone: string;

  readonly submitted_at: Date;
  readonly review_started_at: Date | null;
  readonly reviewed_by_identity_id: string | null;

  readonly approved_at: Date | null;
  readonly rejected_at: Date | null;
  readonly rejection_reason: string | null;

  readonly approval_provisioning_started_at: Date | null;
  readonly provisioned_tenant_id: string | null;

  readonly correlation_id: string;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export function toAgencyRegistration(
  row: AgencyRegistrationRow,
): AgencyRegistration {
  return Object.freeze({
    id: row.registration_id,
    status: row.status,

    agencyLegalName: row.agency_legal_name,
    ...(row.agency_trade_name === null
      ? {}
      : { agencyTradeName: row.agency_trade_name }),
    registrationNumber: row.registration_number,
    ...(row.tax_identifier === null
      ? {}
      : { taxIdentifier: row.tax_identifier }),

    phone: row.phone,
    email: row.email,
    ...(row.website === null ? {} : { website: row.website }),

    address: row.address,
    city: row.city,
    countryCode: row.country_code,

    contactFirstName: row.contact_first_name,
    contactLastName: row.contact_last_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,

    submittedAt: row.submitted_at.toISOString(),

    ...(row.review_started_at === null
      ? {}
      : { reviewStartedAt: row.review_started_at.toISOString() }),

    ...(row.reviewed_by_identity_id === null
      ? {}
      : { reviewedByIdentityId: row.reviewed_by_identity_id }),

    ...(row.approved_at === null
      ? {}
      : { approvedAt: row.approved_at.toISOString() }),

    ...(row.rejected_at === null
      ? {}
      : { rejectedAt: row.rejected_at.toISOString() }),

    ...(row.rejection_reason === null
      ? {}
      : { rejectionReason: row.rejection_reason }),

    ...(row.approval_provisioning_started_at === null
      ? {}
      : {
          approvalProvisioningStartedAt:
            row.approval_provisioning_started_at.toISOString(),
        }),

    ...(row.provisioned_tenant_id === null
      ? {}
      : { provisionedTenantId: row.provisioned_tenant_id }),

    correlationId: row.correlation_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}