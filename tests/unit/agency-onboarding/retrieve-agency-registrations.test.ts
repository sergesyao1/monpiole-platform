import { describe, expect, it, vi } from "vitest";

import {
  AgencyOnboardingForbiddenError,
  AgencyRegistrationNotFoundError,
  ListAgencyRegistrations,
  RetrieveAgencyRegistration,
  type AgencyOnboardingAuthority,
  type AgencyRegistration,
  type AgencyRegistrationQueryStore,
} from "../../../services/agency-onboarding/src/index.js";

const reviewer: AgencyOnboardingAuthority = Object.freeze({
  actorId: "platform:reviewer",
  authorityId: "platform:reviewer",
  grants: Object.freeze([
    "RETRIEVE_AGENCY_REGISTRATIONS" as const,
  ]),
});

const registration: AgencyRegistration = Object.freeze({
  id: "11111111-1111-4111-8111-111111111111",
  status: "SUBMITTED",

  agencyLegalName: "Agence Test SARL",
  registrationNumber: "CI-ABJ-2026-B-001",

  phone: "+2250102030405",
  email: "contact@example.test",

  address: "Abidjan",
  city: "Abidjan",
  countryCode: "CI",

  contactFirstName: "Jean",
  contactLastName: "Koffi",
  contactEmail: "jean.koffi@example.test",
  contactPhone: "+2250506070809",

  submittedAt: "2026-09-16T12:00:00.000Z",
  correlationId: "22222222-2222-4222-8222-222222222222",
  createdAt: "2026-09-16T12:00:00.000Z",
  updatedAt: "2026-09-16T12:00:00.000Z",
});

function store(
  overrides: Partial<AgencyRegistrationQueryStore> = {},
): AgencyRegistrationQueryStore {
  return {
    findById: vi.fn().mockResolvedValue(registration),
    list: vi.fn().mockResolvedValue([registration]),
    listDocuments: vi.fn().mockResolvedValue([]),
    findDocument: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("ListAgencyRegistrations", () => {
  it("lists registrations for an authorized platform authority", async () => {
    const registrations = store();
    const useCase = new ListAgencyRegistrations(registrations);

    await expect(
      useCase.execute({ authority: reviewer }),
    ).resolves.toEqual([registration]);

    expect(registrations.list).toHaveBeenCalledOnce();
  });

  it("rejects an authority without the retrieve grant", async () => {
    const registrations = store();
    const useCase = new ListAgencyRegistrations(registrations);

    await expect(
      useCase.execute({
        authority: {
          actorId: "platform:other",
          authorityId: "platform:other",
          grants: [],
        },
      }),
    ).rejects.toBeInstanceOf(AgencyOnboardingForbiddenError);

    expect(registrations.list).not.toHaveBeenCalled();
  });
});

describe("RetrieveAgencyRegistration", () => {
  it("retrieves one registration for an authorized platform authority", async () => {
    const registrations = store();
    const useCase = new RetrieveAgencyRegistration(registrations);

    await expect(
      useCase.execute({
        authority: reviewer,
        registrationId: registration.id,
      }),
    ).resolves.toEqual({
      registration,
      documents: [],
    });

    expect(registrations.findById).toHaveBeenCalledWith(
      registration.id,
    );

    expect(
      registrations.listDocuments,
    ).toHaveBeenCalledWith(
      registration.id,
    );
  });

  it("throws the domain not-found error when registration does not exist", async () => {
    const registrations = store({
      findById: vi.fn().mockResolvedValue(undefined),
    });

    const useCase = new RetrieveAgencyRegistration(registrations);

    await expect(
      useCase.execute({
        authority: reviewer,
        registrationId: registration.id,
      }),
    ).rejects.toBeInstanceOf(
      AgencyRegistrationNotFoundError,
    );
  });

  it("checks authorization before querying persistence", async () => {
    const registrations = store();
    const useCase = new RetrieveAgencyRegistration(registrations);

    await expect(
      useCase.execute({
        authority: {
          actorId: "platform:other",
          authorityId: "platform:other",
          grants: [],
        },
        registrationId: registration.id,
      }),
    ).rejects.toBeInstanceOf(AgencyOnboardingForbiddenError);

    expect(registrations.findById).not.toHaveBeenCalled();
  });
});
