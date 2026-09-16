import type { Pool } from "pg";

import type {
  AgencyRegistrationQueryStore,
} from "../../../application/agency-registration-persistence.js";
import {
  type AgencyRegistrationRow,
  toAgencyRegistration,
} from "./agency-registration-mapper.js";
import { withAgencyOnboardingPostgresTransaction } from "./transaction.js";

const SELECT_COLUMNS = `
  registration_id,
  status,
  agency_legal_name,
  agency_trade_name,
  registration_number,
  tax_identifier,
  phone,
  email,
  website,
  address,
  city,
  country_code,
  contact_first_name,
  contact_last_name,
  contact_email,
  contact_phone,
  submitted_at,
  review_started_at,
  reviewed_by_identity_id,
  approved_at,
  rejected_at,
  rejection_reason,
  approval_provisioning_started_at,
  provisioned_tenant_id,
  correlation_id,
  created_at,
  updated_at
`;

export class PostgresAgencyRegistrationQueryStore
  implements AgencyRegistrationQueryStore
{
  constructor(private readonly pool: Pool) {}

  findById(registrationId: string) {
    return withAgencyOnboardingPostgresTransaction(
      this.pool,
      "retrieve",
      async (scope) => {
        const rows = await scope.query<AgencyRegistrationRow>(
          `SELECT ${SELECT_COLUMNS}
             FROM agency_onboarding.agency_registrations
            WHERE registration_id = $1::uuid
            LIMIT 1`,
          [registrationId],
        );

        const row = rows[0];
        return row === undefined ? undefined : toAgencyRegistration(row);
      },
    );
  }

  list() {
    return withAgencyOnboardingPostgresTransaction(
      this.pool,
      "retrieve",
      async (scope) => {
        const rows = await scope.query<AgencyRegistrationRow>(
          `SELECT ${SELECT_COLUMNS}
             FROM agency_onboarding.agency_registrations
            ORDER BY submitted_at DESC, registration_id DESC`,
        );

        return rows.map(toAgencyRegistration);
      },
    );
  }
}