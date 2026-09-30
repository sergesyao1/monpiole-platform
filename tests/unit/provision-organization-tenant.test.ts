import { describe, expect, it } from "vitest";

import {
  OrganizationTenantProvisioningIdempotencyConflictError,
  OrganizationTenantProvisioningIdempotencyWriteConflictError,
  ProvisionOrganizationTenant,
  deterministicOrganizationTenantProvisioningIntent,
  normalizeOrganizationProvisioningIntent,
  type OrganizationTenantProvisioningIdempotencyRecord,
  type ProvisionOrganizationTenantTransaction,
  type ProvisionOrganizationTenantUnitOfWork,
} from "../../services/tenant-management/src/application/provision-organization-tenant.js";
import { normalizeTenantIntent } from "../../services/tenant-management/src/domain/tenant.js";

const tenantIntent = {
  organizationName: "MonPiole Gestion CI",
  responsiblePersonName: "Ada Example",
  responsibleEmail: "owner@example.invalid",
  responsibleTelephone: "+2250102030405",
  country: "CI",
};

const organizationIntent = {
  type: "PROPERTY_MANAGEMENT_COMPANY" as const,
  legalName: "MonPiole Gestion CI",
  tradeName: "MonPiole Gestion",
  registrationNumber: "CI-ABJ-RECOVERY",
  taxIdentifier: "CC-1234567",
  phone: "+2250102030405",
  email: "owner@example.invalid",
  website: "https://example.invalid",
  address: "Cocody",
  city: "Abidjan",
  countryCode: "CI",
  defaultLanguageCode: "fr",
  defaultLocale: "fr-CI",
  defaultCurrencyCode: "XOF",
  defaultTimezone: "Africa/Abidjan",
};

const command = {
  authority: {
    actorId: "actor-1",
    authorityId: "platform-admin",
    grants: ["CREATE_TENANT"] as const,
    tenantIds: [],
  },
  correlationId:
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  idempotencyKey: "composite-write-conflict",
  tenant: tenantIntent,
  organization: organizationIntent,
};

const persistedResult = {
  tenantId:
    "11111111-1111-4111-8111-111111111111",
  organizationId:
    "22222222-2222-4222-8222-222222222222",
  lifecycleState: "PENDING" as const,
  createdAt: "2026-09-26T10:00:00.000Z",
};

function normalizedIntent(): string {
  return deterministicOrganizationTenantProvisioningIntent(
    normalizeTenantIntent(tenantIntent),
    normalizeOrganizationProvisioningIntent(
      organizationIntent,
    ),
  );
}

function recoveryTransaction(
  record: OrganizationTenantProvisioningIdempotencyRecord | undefined,
): ProvisionOrganizationTenantTransaction {
  return {
    acquireIdempotencyKey: async () => undefined,

    findIdempotency: async () => record,

    findTenantByResponsibleEmail: async () =>
      undefined,

    insertTenant: async () => undefined,

    insertOrganization: async () => undefined,

    insertIdempotency: async () => undefined,

    recordTenantCreated: async () => undefined,
  };
}

class WriteConflictThenRecoveryUnitOfWork
implements ProvisionOrganizationTenantUnitOfWork {
  executions = 0;

  constructor(
    private readonly persisted:
      OrganizationTenantProvisioningIdempotencyRecord | undefined,
  ) {}

  async execute<Result>(
    operation: (
      transaction: ProvisionOrganizationTenantTransaction,
    ) => Promise<Result>,
  ): Promise<Result> {
    this.executions += 1;

    if (this.executions === 1) {
      throw new OrganizationTenantProvisioningIdempotencyWriteConflictError();
    }

    return operation(
      recoveryTransaction(this.persisted),
    );
  }
}

function createUseCase(
  unitOfWork: ProvisionOrganizationTenantUnitOfWork,
) {
  return new ProvisionOrganizationTenant(
    {
      authorizeCreateTenant: async () => true,
    },
    unitOfWork,
    {
      generate: () =>
        "11111111-1111-4111-8111-111111111111",
    },
    {
      generate: () =>
        "22222222-2222-4222-8222-222222222222",
    },
    {
      generate: () =>
        "33333333-3333-4333-8333-333333333333",
    },
    {
      now: () => "2026-09-26T10:00:00.000Z",
    },
  );
}

describe(
  "ProvisionOrganizationTenant write-conflict recovery",
  () => {
    it(
      "returns the persisted result when a write conflict resolves to the same normalized intent",
      async () => {
        const unitOfWork =
          new WriteConflictThenRecoveryUnitOfWork({
            authorityId:
              command.authority.authorityId,
            idempotencyKey:
              command.idempotencyKey,
            normalizedIntent:
              normalizedIntent(),
            result: persistedResult,
            correlationId:
              command.correlationId,
            actorId:
              command.authority.actorId,
          });

        await expect(
          createUseCase(unitOfWork).execute(command),
        ).resolves.toEqual(persistedResult);

        expect(unitOfWork.executions).toBe(2);
      },
    );

    it(
      "rejects recovery when the persisted idempotency record belongs to a different normalized intent",
      async () => {
        const unitOfWork =
          new WriteConflictThenRecoveryUnitOfWork({
            authorityId:
              command.authority.authorityId,
            idempotencyKey:
              command.idempotencyKey,
            normalizedIntent:
              `${normalizedIntent()}-different`,
            result: persistedResult,
            correlationId:
              command.correlationId,
            actorId:
              command.authority.actorId,
          });

        await expect(
          createUseCase(unitOfWork).execute(command),
        ).rejects.toBeInstanceOf(
          OrganizationTenantProvisioningIdempotencyConflictError,
        );

        expect(unitOfWork.executions).toBe(2);
      },
    );
  },
);
