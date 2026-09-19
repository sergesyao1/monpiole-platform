import { describe, expect, it, vi } from "vitest";
import {
  AgencyOnboardingForbiddenError,
  CreateFirstAgencyAdministrator,
  FirstAdministratorAlreadyExistsError,
  FirstAdministratorRegistrationNotFoundError,
  FirstAdministratorRegistrationNotReadyError,
  type AgencyOnboardingAuthority,
  type AgencyRegistration,
  type FirstAdministratorBootstrap,
  type FirstAdministratorBootstrapTransaction,
  type FirstAdministratorBootstrapUnitOfWork,
  type FirstAdministratorIdentityProvisioningPort,
} from "../../../services/agency-onboarding/src/index.js";

const registrationId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";
const administratorId = "33333333-3333-4333-8333-333333333333";
const actorId = "44444444-4444-4444-8444-444444444444";

function approvedRegistration(): AgencyRegistration {
  return {
    id: registrationId,
    status: "APPROVED",
    agencyLegalName: "Agence Test",
    registrationNumber: "REG-001",
    phone: "+2250102030405",
    email: "contact@example.test",
    address: "Abidjan",
    city: "Abidjan",
    countryCode: "CI",
    representativeFirstName: "Awa",
    representativeLastName: "Kone",
    representativeEmail: "awa@example.test",
    representativePhone: "+2250102030405",
    approvedAt: "2026-09-18T12:00:00.000Z",
    approvalProvisioningStartedAt: "2026-09-18T11:59:00.000Z",
    provisionedTenantId: tenantId,
    correlationId: "corr-registration",
    createdAt: "2026-09-18T11:00:00.000Z",
    updatedAt: "2026-09-18T12:00:00.000Z",
  };
}

function authority(
  grants: AgencyOnboardingAuthority["grants"] = [
    "MANAGE_AGENCY_ADMIN_BOOTSTRAP",
  ],
): AgencyOnboardingAuthority {
  return {
    actorId,
    authorityId: "platform-authority",
    grants,
  };
}

function existingAdministrator(
  overrides: Partial<FirstAdministratorBootstrap> = {},
): FirstAdministratorBootstrap {
  return {
    registrationId,
    tenantId,
    internalIdentityId: administratorId,
    administratorKind: "FIRST_ADMINISTRATOR",
    status: "PENDING_IDENTITY",
    bootstrapTokenHash: "a".repeat(64),
    bootstrapTokenExpiresAt: "2026-09-18T13:00:00.000Z",
    createdByPlatformIdentityId: actorId,
    createdAt: "2026-09-18T12:00:00.000Z",
    ...overrides,
  };
}

function harness(input?: {
  registration?: AgencyRegistration;
  existing?: FirstAdministratorBootstrap;
}) {
  let currentExisting = input?.existing;
  const registration =
    input && "registration" in input
      ? input.registration
      : approvedRegistration();

  const transaction: FirstAdministratorBootstrapTransaction = {
    findRegistrationForUpdate: vi.fn(async () => registration),
    findAdministratorByRegistration: vi.fn(
      async () => currentExisting,
    ),
    findAdministratorByBootstrapTokenHashForUpdate: vi.fn(),
    markAdministratorIdentityLinked: vi.fn(),
    markAdministratorActive: vi.fn(),
    rotateAdministratorBootstrapToken: vi.fn(),
    insertAdministrator: vi.fn(async (administrator) => {
      currentExisting = administrator;
    }),
  };

  const unitOfWork: FirstAdministratorBootstrapUnitOfWork = {
    execute: vi.fn(async (operation) => operation(transaction)),
  };

  const identities: FirstAdministratorIdentityProvisioningPort = {
    provision: vi.fn(async () => ({
      tenantId,
      administratorId,
      email: "admin@example.test",
      role: "TENANT_ADMINISTRATOR",
      status: "PENDING_ACTIVATION",
    })),
  };

  const tokens = {
    generate: vi.fn(() => "bootstrap-secret"),
  };

  const tokenHasher = {
    hash: vi.fn(() => "b".repeat(64)),
  };

  const clock = {
    now: vi.fn(() => "2026-09-18T12:00:00.000Z"),
  };

  const useCase = new CreateFirstAgencyAdministrator(
    unitOfWork,
    identities,
    tokens,
    tokenHasher,
    clock,
    { tokenTtlSeconds: 3600 },
  );

  return {
    useCase,
    transaction,
    unitOfWork,
    identities,
    tokens,
    tokenHasher,
  };
}

const command = {
  registrationId,
  email: "admin@example.test",
  firstName: "Jean",
  lastName: "Kouassi",
  correlationId: "corr-admin",
  authority: authority(),
};

describe("CreateFirstAgencyAdministrator", () => {
  it("creates a pending first administrator and returns the token once", async () => {
    const {
      useCase,
      transaction,
      identities,
      tokens,
      tokenHasher,
    } = harness();

    const result = await useCase.execute(command);

    expect(result).toEqual({
      registrationId,
      tenantId,
      administratorId,
      role: "TENANT_ADMINISTRATOR",
      status: "PENDING_IDENTITY",
      bootstrapToken: "bootstrap-secret",
      bootstrapTokenExpiresAt: "2026-09-18T13:00:00.000Z",
    });

    expect(identities.provision).toHaveBeenCalledWith({
      registrationId,
      tenantId,
      email: "admin@example.test",
      firstName: "Jean",
      lastName: "Kouassi",
      correlationId: "corr-admin",
      requestedByPlatformIdentityId: actorId,
    });

    expect(tokenHasher.hash).toHaveBeenCalledWith(
      "bootstrap-secret",
    );

    expect(transaction.insertAdministrator).toHaveBeenCalledWith(
      expect.objectContaining({
        registrationId,
        tenantId,
        internalIdentityId: administratorId,
        status: "PENDING_IDENTITY",
        bootstrapTokenHash: "b".repeat(64),
        bootstrapTokenExpiresAt: "2026-09-18T13:00:00.000Z",
      }),
    );

    expect(tokens.generate).toHaveBeenCalledTimes(1);
  });

  it("fails closed without the platform bootstrap grant", async () => {
    const { useCase, identities } = harness();

    await expect(
      useCase.execute({
        ...command,
        authority: authority([]),
      }),
    ).rejects.toBeInstanceOf(AgencyOnboardingForbiddenError);

    expect(identities.provision).not.toHaveBeenCalled();
  });

  it("rejects an unknown registration", async () => {
    const { useCase, identities } = harness({
      registration: undefined,
    });

    await expect(
      useCase.execute(command),
    ).rejects.toBeInstanceOf(
      FirstAdministratorRegistrationNotFoundError,
    );

    expect(identities.provision).not.toHaveBeenCalled();
  });

  it("rejects a registration that is not approved", async () => {
    const { useCase, identities } = harness({
      registration: {
        ...approvedRegistration(),
        status: "UNDER_REVIEW",
        provisionedTenantId: undefined,
      },
    });

    await expect(
      useCase.execute(command),
    ).rejects.toBeInstanceOf(
      FirstAdministratorRegistrationNotReadyError,
    );

    expect(identities.provision).not.toHaveBeenCalled();
  });

  it("replays an existing pending bootstrap without returning plaintext token", async () => {
    const existing = existingAdministrator();
    const { useCase, identities, tokens, tokenHasher } = harness({
      existing,
    });

    const result = await useCase.execute(command);

    expect(result).toEqual({
      registrationId,
      tenantId,
      administratorId,
      role: "TENANT_ADMINISTRATOR",
      status: "PENDING_IDENTITY",
      bootstrapTokenExpiresAt: existing.bootstrapTokenExpiresAt,
    });

    expect(result.bootstrapToken).toBeUndefined();
    expect(identities.provision).not.toHaveBeenCalled();
    expect(tokens.generate).not.toHaveBeenCalled();
    expect(tokenHasher.hash).not.toHaveBeenCalled();
  });

  it("rejects creation when the existing bootstrap is beyond pending identity", async () => {
    const { useCase, identities } = harness({
      existing: existingAdministrator({
        status: "IDENTITY_LINKED",
        identityLinkedAt: "2026-09-18T12:10:00.000Z",
      }),
    });

    await expect(
      useCase.execute(command),
    ).rejects.toBeInstanceOf(
      FirstAdministratorAlreadyExistsError,
    );

    expect(identities.provision).not.toHaveBeenCalled();
  });

  it("rejects a provisioning result for another tenant", async () => {
    const harnessValue = harness();

    vi.mocked(
      harnessValue.identities.provision,
    ).mockResolvedValueOnce({
      tenantId: "55555555-5555-4555-8555-555555555555",
      administratorId,
      email: "admin@example.test",
      role: "TENANT_ADMINISTRATOR",
      status: "PENDING_ACTIVATION",
    });

    await expect(
      harnessValue.useCase.execute(command),
    ).rejects.toBeInstanceOf(
      FirstAdministratorAlreadyExistsError,
    );

    expect(
      harnessValue.transaction.insertAdministrator,
    ).not.toHaveBeenCalled();
  });
});
