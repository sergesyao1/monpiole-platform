import type { Pool } from "pg";

import type { PostgresTransactionScope } from "@monpiole/persistence";

import type {
  AgencyRegistrationReviewTransaction,
  AgencyRegistrationReviewUnitOfWork,
} from "../../../application/agency-registration-persistence.js";
import type { AgencyRegistration } from "../../../domain/agency-registration.js";
import {
  toAgencyRegistration,
  type AgencyRegistrationRow,
} from "./agency-registration-mapper.js";
import { withAgencyOnboardingPostgresTransaction } from "./transaction.js";

class PostgresAgencyRegistrationReviewTransaction
  implements AgencyRegistrationReviewTransaction
{
  public constructor(
    private readonly scope: PostgresTransactionScope,
  ) {}

  public async findForUpdate(
    registrationId: string,
  ): Promise<AgencyRegistration | undefined> {
    const rows = await this.scope.query<AgencyRegistrationRow>(
      `SELECT *
         FROM agency_onboarding.agency_registrations
        WHERE registration_id = $1
        FOR UPDATE`,
      [registrationId],
    );

    const row = rows[0];

    return row === undefined
      ? undefined
      : toAgencyRegistration(row);
  }

  public async update(
    registration: AgencyRegistration,
  ): Promise<void> {
    const rows = await this.scope.query<{ registration_id: string }>(
      `UPDATE agency_onboarding.agency_registrations
          SET status = $2,
              review_started_at = $3,
              reviewed_by_identity_id = $4,
              approved_at = $5,
              rejected_at = $6,
              rejection_reason = $7,
              approval_provisioning_started_at = $8,
              provisioned_tenant_id = $9,
              updated_at = $10
        WHERE registration_id = $1
        RETURNING registration_id`,
      [
        registration.id,
        registration.status,
        registration.reviewStartedAt ?? null,
        registration.reviewedByIdentityId ?? null,
        registration.approvedAt ?? null,
        registration.rejectedAt ?? null,
        registration.rejectionReason ?? null,
        registration.approvalProvisioningStartedAt ?? null,
        registration.provisionedTenantId ?? null,
        registration.updatedAt,
      ],
    );

    if (rows.length !== 1) {
      throw new Error(
        `Agency registration ${registration.id} could not be updated.`,
      );
    }
  }
}

export class PostgresAgencyRegistrationReviewUnitOfWork
  implements AgencyRegistrationReviewUnitOfWork
{
  public constructor(
    private readonly pool: Pool,
  ) {}

  public execute<Result>(
    capability: "review" | "decide",
    operation: (
      transaction: AgencyRegistrationReviewTransaction,
    ) => Promise<Result>,
  ): Promise<Result> {
    return withAgencyOnboardingPostgresTransaction(
      this.pool,
      capability,
      (scope) =>
        operation(
          new PostgresAgencyRegistrationReviewTransaction(scope),
        ),
    );
  }
}