import type { Pool } from "pg";

import type { PostgresTransactionScope } from "@monpiole/persistence";

import type {
  FirstAdministratorBootstrap,
  FirstAdministratorBootstrapTransaction,
  FirstAdministratorBootstrapUnitOfWork,
} from "../../../application/first-administrator-persistence.js";
import type { AgencyRegistration } from "../../../domain/agency-registration.js";
import {
  toAgencyRegistration,
  type AgencyRegistrationRow,
} from "./agency-registration-mapper.js";
import { withAgencyOnboardingPostgresTransaction } from "./transaction.js";

interface FirstAdministratorBootstrapRow
  extends Record<string, unknown> {
  readonly registration_id: string;
  readonly tenant_id: string;
  readonly internal_identity_id: string;
  readonly administrator_kind: "FIRST_ADMINISTRATOR";
  readonly status: FirstAdministratorBootstrap["status"];
  readonly bootstrap_token_hash: string;
  readonly bootstrap_token_expires_at: Date;
  readonly bootstrap_token_consumed_at: Date | null;
  readonly created_by_platform_identity_id: string;
  readonly created_at: Date;
  readonly external_issuer: string | null;
  readonly external_subject: string | null;
  readonly identity_linked_at: Date | null;
  readonly activated_at: Date | null;
  readonly cancelled_at: Date | null;
}

function toFirstAdministratorBootstrap(
  row: FirstAdministratorBootstrapRow,
): FirstAdministratorBootstrap {
  return Object.freeze({
    registrationId: row.registration_id,
    tenantId: row.tenant_id,
    internalIdentityId: row.internal_identity_id,
    administratorKind: row.administrator_kind,
    status: row.status,
    bootstrapTokenHash: row.bootstrap_token_hash,
    bootstrapTokenExpiresAt:
      row.bootstrap_token_expires_at.toISOString(),
    ...(row.bootstrap_token_consumed_at === null
      ? {}
      : {
          bootstrapTokenConsumedAt:
            row.bootstrap_token_consumed_at.toISOString(),
        }),
    createdByPlatformIdentityId:
      row.created_by_platform_identity_id,
    createdAt: row.created_at.toISOString(),
    ...(row.external_issuer === null
      ? {}
      : { externalIssuer: row.external_issuer }),
    ...(row.external_subject === null
      ? {}
      : { externalSubject: row.external_subject }),
    ...(row.identity_linked_at === null
      ? {}
      : {
          identityLinkedAt:
            row.identity_linked_at.toISOString(),
        }),
    ...(row.activated_at === null
      ? {}
      : {
          activatedAt: row.activated_at.toISOString(),
        }),
    ...(row.cancelled_at === null
      ? {}
      : {
          cancelledAt: row.cancelled_at.toISOString(),
        }),
  });
}

class PostgresFirstAdministratorBootstrapTransaction
  implements FirstAdministratorBootstrapTransaction
{
  public constructor(
    private readonly scope: PostgresTransactionScope,
  ) {}

  public async findRegistrationForUpdate(
    registrationId: string,
  ): Promise<AgencyRegistration | undefined> {
    const rows = await this.scope.query<AgencyRegistrationRow>(
      `WITH registration_lock AS (
         SELECT pg_advisory_xact_lock(
           hashtextextended($1::uuid::text, 0)
         )
       )
       SELECT registration.*
         FROM registration_lock
         CROSS JOIN LATERAL (
           SELECT *
             FROM agency_onboarding.agency_registrations
            WHERE registration_id = $1::uuid
         ) AS registration`,
      [registrationId],
    );

    const row = rows[0];

    return row === undefined
      ? undefined
      : toAgencyRegistration(row);
  }

  public async findAdministratorByRegistration(
    registrationId: string,
  ): Promise<FirstAdministratorBootstrap | undefined> {
    const rows =
      await this.scope.query<FirstAdministratorBootstrapRow>(
        `SELECT *
           FROM agency_onboarding.agency_registration_administrators
          WHERE registration_id = $1::uuid`,
        [registrationId],
      );

    const row = rows[0];

    return row === undefined
      ? undefined
      : toFirstAdministratorBootstrap(row);
  }

  public async findAdministratorByBootstrapTokenHashForUpdate(
    bootstrapTokenHash: string,
  ): Promise<FirstAdministratorBootstrap | undefined> {
    const rows =
      await this.scope.query<FirstAdministratorBootstrapRow>(
        `SELECT *
           FROM agency_onboarding.agency_registration_administrators
          WHERE bootstrap_token_hash = $1
          FOR UPDATE`,
        [bootstrapTokenHash],
      );

    const row = rows[0];

    return row === undefined
      ? undefined
      : toFirstAdministratorBootstrap(row);
  }

  public async markAdministratorIdentityLinked(
    bootstrapTokenHash: string,
    internalIdentityId: string,
    externalIssuer: string,
    externalSubject: string,
    bootstrapTokenConsumedAt: string,
    identityLinkedAt: string,
  ): Promise<FirstAdministratorBootstrap | undefined> {
    const rows =
      await this.scope.query<FirstAdministratorBootstrapRow>(
        `UPDATE agency_onboarding.agency_registration_administrators
            SET status = 'IDENTITY_LINKED',
                external_issuer = $3,
                external_subject = $4,
                bootstrap_token_consumed_at = $5::timestamptz,
                identity_linked_at = $6::timestamptz
          WHERE bootstrap_token_hash = $1
            AND internal_identity_id = $2::uuid
            AND status = 'PENDING_IDENTITY'
            AND external_issuer IS NULL
            AND external_subject IS NULL
            AND bootstrap_token_consumed_at IS NULL
            AND identity_linked_at IS NULL
        RETURNING *`,
        [
          bootstrapTokenHash,
          internalIdentityId,
          externalIssuer,
          externalSubject,
          bootstrapTokenConsumedAt,
          identityLinkedAt,
        ],
      );

    const row = rows[0];

    return row === undefined
      ? undefined
      : toFirstAdministratorBootstrap(row);
  }
  public async markAdministratorActive(
    registrationId: string,
    tenantId: string,
    internalIdentityId: string,
    activatedAt: string,
  ): Promise<FirstAdministratorBootstrap | undefined> {
    const rows =
      await this.scope.query<FirstAdministratorBootstrapRow>(
        `UPDATE agency_onboarding.agency_registration_administrators
            SET status = 'ACTIVE',
                activated_at = $4::timestamptz
          WHERE registration_id = $1::uuid
            AND tenant_id = $2::uuid
            AND internal_identity_id = $3::uuid
            AND status = 'IDENTITY_LINKED'
            AND external_issuer IS NOT NULL
            AND external_subject IS NOT NULL
            AND bootstrap_token_consumed_at IS NOT NULL
            AND identity_linked_at IS NOT NULL
            AND activated_at IS NULL
        RETURNING *`,
        [
          registrationId,
          tenantId,
          internalIdentityId,
          activatedAt,
        ],
      );

    const row = rows[0];

    return row === undefined
      ? undefined
      : toFirstAdministratorBootstrap(row);
  }

  public async rotateAdministratorBootstrapToken(
    registrationId: string,
    tenantId: string,
    internalIdentityId: string,
    bootstrapTokenHash: string,
    bootstrapTokenExpiresAt: string,
  ): Promise<FirstAdministratorBootstrap | undefined> {
    const rows = await this.scope.query<FirstAdministratorBootstrapRow>(
      `UPDATE agency_onboarding.agency_registration_administrators
          SET bootstrap_token_hash = $4,
              bootstrap_token_expires_at = $5::timestamptz
        WHERE registration_id = $1::uuid
          AND tenant_id = $2::uuid
          AND internal_identity_id = $3::uuid
          AND status = 'PENDING_IDENTITY'
          AND bootstrap_token_consumed_at IS NULL
          AND identity_linked_at IS NULL
          AND external_issuer IS NULL
          AND external_subject IS NULL
          AND activated_at IS NULL
          AND cancelled_at IS NULL
      RETURNING *`,
      [
        registrationId,
        tenantId,
        internalIdentityId,
        bootstrapTokenHash,
        bootstrapTokenExpiresAt,
      ],
    );

    const row = rows[0];

    return row === undefined
      ? undefined
      : toFirstAdministratorBootstrap(row);
  }

  public async insertAdministrator(
    administrator: FirstAdministratorBootstrap,
  ): Promise<void> {
    const rows = await this.scope.query<{ registration_id: string }>(
      `INSERT INTO agency_onboarding.agency_registration_administrators (
         registration_id,
         tenant_id,
         internal_identity_id,
         administrator_kind,
         status,
         bootstrap_token_hash,
         bootstrap_token_expires_at,
         bootstrap_token_consumed_at,
         created_by_platform_identity_id,
         created_at,
         identity_linked_at,
         activated_at,
         cancelled_at
       )
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10,
         $11,
         $12,
         $13
       )
       RETURNING registration_id`,
      [
        administrator.registrationId,
        administrator.tenantId,
        administrator.internalIdentityId,
        administrator.administratorKind,
        administrator.status,
        administrator.bootstrapTokenHash,
        administrator.bootstrapTokenExpiresAt,
        administrator.bootstrapTokenConsumedAt ?? null,
        administrator.createdByPlatformIdentityId,
        administrator.createdAt,
        administrator.identityLinkedAt ?? null,
        administrator.activatedAt ?? null,
        administrator.cancelledAt ?? null,
      ],
    );

    if (rows.length !== 1) {
      throw new Error(
        `First administrator bootstrap for registration ${administrator.registrationId} could not be inserted.`,
      );
    }
  }
}

export class PostgresFirstAdministratorBootstrapUnitOfWork
  implements FirstAdministratorBootstrapUnitOfWork
{
  public constructor(
    private readonly pool: Pool,
  ) {}

  public execute<Result>(
    operation: (
      transaction: FirstAdministratorBootstrapTransaction,
    ) => Promise<Result>,
  ): Promise<Result> {
    return withAgencyOnboardingPostgresTransaction(
      this.pool,
      "administrator",
      (scope) =>
        operation(
          new PostgresFirstAdministratorBootstrapTransaction(
            scope,
          ),
        ),
    );
  }
}
