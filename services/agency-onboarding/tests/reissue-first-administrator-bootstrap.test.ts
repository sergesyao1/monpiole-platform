import { describe, expect, it, vi } from "vitest";

import {
  AgencyOnboardingForbiddenError,
  FirstAdministratorReissueAdministratorNotFoundError,
  FirstAdministratorReissueNotEligibleError,
  FirstAdministratorReissueRegistrationNotFoundError,
  FirstAdministratorReissueRegistrationNotReadyError,
  InvalidFirstAdministratorBootstrapConfigurationError,
  ReissueFirstAdministratorBootstrap,
  type AgencyRegistration,
  type FirstAdministratorBootstrap,
  type FirstAdministratorBootstrapTransaction,
} from "../src/index.js";

const REGISTRATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMINISTRATOR_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = "2026-09-19T10:00:00.000Z";
const NEW_TOKEN = "new-plaintext-token";
const NEW_HASH = "new-token-hash";

function registration(
  overrides: Partial<AgencyRegistration> = {},
): AgencyRegistration {
  return Object.freeze({
    id: REGISTRATION_ID,
    status: "APPROVED",
    agencyLegalName: "Agence Test",
    registrationNumber: "CI-TEST-001",
    phone: "+2250102030405",
    email: "agency@example.invalid",
    address: "Cocody",
    city: "Abidjan",
    countryCode: "CI",
    contactFirstName: "Awa",
    contactLastName: "Kone",
    contactEmail: "awa@example.invalid",
    contactPhone: "+2250506070809",
    submittedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    correlationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    provisionedTenantId: TENANT_ID,
    ...overrides,
  });
}

function administrator(
  overrides: Partial<FirstAdministratorBootstrap> = {},
): FirstAdministratorBootstrap {
  return Object.freeze({
    registrationId: REGISTRATION_ID,
    tenantId: TENANT_ID,
    internalIdentityId: ADMINISTRATOR_ID,
    invitedEmail: "administrator@example.test",
    administratorKind: "FIRST_ADMINISTRATOR",
    status: "PENDING_IDENTITY",
    bootstrapTokenHash: "old-token-hash",
    bootstrapTokenExpiresAt: "2026-09-18T10:00:00.000Z",
    createdByPlatformIdentityId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    createdAt: "2026-09-18T09:00:00.000Z",
    ...overrides,
  });
}

function harness(input: {
  registration?: AgencyRegistration;
  administrator?: FirstAdministratorBootstrap;
  ttl?: number;
  rejectRotation?: boolean;
} = {}) {
  let current = input.administrator ?? administrator();
  const rotate = vi.fn(async (
    registrationId: string,
    tenantId: string,
    internalIdentityId: string,
    bootstrapTokenHash: string,
    bootstrapTokenExpiresAt: string,
  ) => {
    if (input.rejectRotation) return undefined;
    current = Object.freeze({
      ...current,
      bootstrapTokenHash,
      bootstrapTokenExpiresAt,
    });
    return current;
  });
  const transaction: FirstAdministratorBootstrapTransaction = {
    findRegistrationForUpdate: vi.fn(async () =>
      Object.hasOwn(input, "registration") ? input.registration : registration(),
    ),
    findAdministratorByRegistration: vi.fn(async () =>
      Object.hasOwn(input, "administrator") ? input.administrator : current,
    ),
    findAdministratorByBootstrapTokenHashForUpdate: vi.fn(),
    markAdministratorIdentityLinked: vi.fn(),
    markAdministratorActive: vi.fn(),
    rotateAdministratorBootstrapToken: rotate,
    insertAdministrator: vi.fn(),
  };
  const hash = vi.fn(() => NEW_HASH);
  const useCase = new ReissueFirstAdministratorBootstrap(
    { execute: async (operation) => operation(transaction) },
    { generate: () => NEW_TOKEN },
    { hash },
    { now: () => NOW },
    { tokenTtlSeconds: input.ttl ?? 3600 },
  );
  return { useCase, rotate, hash };
}

const command = {
  registrationId: REGISTRATION_ID,
  correlationId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  authority: {
    actorId: "11111111-1111-4111-8111-111111111111",
    authorityId: "22222222-2222-4222-8222-222222222222",
    grants: ["MANAGE_AGENCY_ADMIN_BOOTSTRAP" as const],
  },
};

describe("ReissueFirstAdministratorBootstrap", () => {
  it("rotates an eligible bootstrap and returns the new plaintext once", async () => {
    const { useCase } = harness();
    await expect(useCase.execute(command)).resolves.toEqual({
      registrationId: REGISTRATION_ID,
      tenantId: TENANT_ID,
      administratorId: ADMINISTRATOR_ID,
      status: "PENDING_IDENTITY",
      bootstrapToken: NEW_TOKEN,
      bootstrapTokenExpiresAt: "2026-09-19T11:00:00.000Z",
    });
  });

  it("persists the hash and expiration without changing tenant or identity", async () => {
    const { useCase, rotate, hash } = harness();
    await useCase.execute(command);
    expect(hash).toHaveBeenCalledWith(NEW_TOKEN);
    expect(rotate).toHaveBeenCalledWith(
      REGISTRATION_ID, TENANT_ID, ADMINISTRATOR_ID,
      NEW_HASH, "2026-09-19T11:00:00.000Z",
    );
    expect(rotate).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), NEW_TOKEN, expect.anything());
  });

  it("rejects an unauthorized authority", async () => {
    const { useCase } = harness();
    await expect(useCase.execute({ ...command, authority: { ...command.authority, grants: [] } }))
      .rejects.toBeInstanceOf(AgencyOnboardingForbiddenError);
  });

  it("rejects a missing registration", async () => {
    const { useCase } = harness({ registration: undefined });
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(
      FirstAdministratorReissueRegistrationNotFoundError,
    );
  });

  it.each(["SUBMITTED", "UNDER_REVIEW", "REJECTED"] as const)(
    "rejects a %s registration", async (status) => {
      const { useCase } = harness({ registration: registration({ status }) });
      await expect(useCase.execute(command)).rejects.toBeInstanceOf(
        FirstAdministratorReissueRegistrationNotReadyError,
      );
    },
  );

  it("rejects an approved registration without a tenant", async () => {
    const value = registration();
    const { provisionedTenantId: _omitted, ...withoutTenant } = value;
    const { useCase } = harness({ registration: withoutTenant });
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(
      FirstAdministratorReissueRegistrationNotReadyError,
    );
  });

  it("rejects a missing administrator", async () => {
    const { useCase } = harness({ administrator: undefined });
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(
      FirstAdministratorReissueAdministratorNotFoundError,
    );
  });

  it.each(["IDENTITY_LINKED", "ACTIVE", "CANCELLED"] as const)(
    "rejects administrator status %s", async (status) => {
      const { useCase } = harness({ administrator: administrator({ status }) });
      await expect(useCase.execute(command)).rejects.toBeInstanceOf(
        FirstAdministratorReissueNotEligibleError,
      );
    },
  );

  it.each([
    { bootstrapTokenConsumedAt: NOW },
    { identityLinkedAt: NOW },
    { externalIssuer: "https://issuer.example/" },
    { externalSubject: "auth0|subject" },
    { tenantId: "33333333-3333-4333-8333-333333333333" },
  ])("rejects ineligible lifecycle data %#", async (overrides) => {
    const { useCase } = harness({ administrator: administrator(overrides) });
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(
      FirstAdministratorReissueNotEligibleError,
    );
  });

  it("rejects a concurrent lifecycle conflict", async () => {
    const { useCase } = harness({ rejectRotation: true });
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(
      FirstAdministratorReissueNotEligibleError,
    );
  });

  it.each([0, -1, 1.5])("rejects invalid TTL %s", async (ttl) => {
    const { useCase } = harness({ ttl });
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(
      InvalidFirstAdministratorBootstrapConfigurationError,
    );
  });
});
